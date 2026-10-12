#!/usr/bin/env node
// Monthly check that each listing's page still mentions the doctor.
//
//   node scripts/check-listings.js [--limit N] [--only "text"] [--concurrency N]
//                                  [--report file.md] [--json file.json] [--title file.txt]
//
// It only READS public web pages and writes a report. It never edits the directory.
//
// What a pass means: the page loaded and the doctor's name is on it. It does NOT
// prove the doctor treats RCPD, and it can't read sites that block automated visitors
// (those are listed separately, so you know a person needs to look).
"use strict";

const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

const CSV_PATH = path.resolve(__dirname, "..", "data", "doctors.csv");
const IGNORE_PATH = path.resolve(__dirname, "listing-check-ignore.json");

// An honest, identifiable user agent. Some sites block it; those land in "couldn't check".
const USER_AGENT = "Mozilla/5.0 (compatible; noburp-info-listing-check/1.0; +https://noburp.info)";
const TIMEOUT_MS = 20000;
const MAX_BYTES = 1500000;
const HOST_DELAY_MS = 1000;

const TITLES = new Set(["dr", "mr", "ms", "mrs", "miss", "prof", "assoc"]);
const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "md", "phd", "do", "frcs", "facs"]);

// Wording near the doctor's name that suggests they've stopped practising.
const LEFT_WORDING =
  /\b(retired|retiring|in memoriam|passed away|no longer (?:practi[cs]ing|seeing|accepting|working|at|with)|jubilad[oa]|retraite|pensionert|pensioniert|ruhestand)\b/i;

const fold = (v) =>
  String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Letters and digits only, single spaces: makes "Rey-Caro" and "Rey Caro" the same.
const words = (v) =>
  fold(v).replace(/ø/g, "o").replace(/æ/g, "ae").replace(/ß/g, "ss").replace(/đ|ð/g, "d").replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, " ").trim();

function nameParts(fullName) {
  let tokens = String(fullName).replace(/,/g, " ").split(/\s+/).filter(Boolean);
  while (tokens.length > 1 && TITLES.has(fold(tokens[0]).replace(/\./g, ""))) tokens.shift();
  while (tokens.length > 1 && SUFFIXES.has(fold(tokens[tokens.length - 1]).replace(/\./g, ""))) tokens.pop();
  const surname = words(tokens[tokens.length - 1] || "");
  const given = tokens.length > 1 ? words(tokens[0]) : "";
  return { given, surname };
}

function decodeEntities(s) {
  return s
    .replace(/&([a-zA-Z])(?:acute|grave|uml|circ|tilde|cedil|ring|caron);/g, "$1")
    .replace(/&oslash;/gi, "o").replace(/&aelig;/gi, "ae").replace(/&szlig;/g, "ss")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0*39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeChar(parseInt(d, 10)));
}
function safeChar(n) {
  try { return String.fromCodePoint(n); } catch (e) { return " "; }
}

// Visible text, plus JSON-LD (structured data often names the doctor on script-built pages).
function pageText(html) {
  const ld = [];
  const stripped = html
    .replace(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi, (_, body) => { ld.push(body); return " "; })
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(stripped + " " + ld.join(" "));
}

// Pure function (no network) so it can be tested.
function analyzePage(name, html) {
  const { given, surname } = nameParts(name);
  const text = pageText(html);
  const norm = " " + words(text) + " ";
  const result = { nameFound: "none", leftWording: null, textLength: text.replace(/\s+/g, " ").trim().length };
  if (!surname) return result;

  const sur = " " + surname + " ";
  if (!norm.includes(sur)) return result;
  result.nameFound = given && norm.includes(" " + given + " ") ? "full" : "surname";

  // Retirement wording only counts when it sits right after THIS doctor's name.
  // Staff pages list many people, and "Retired" on the next person's line is not about this one.
  const CREDENTIAL = /^(?: (?:m d|md|do|d o|dds|phd|mph|facs|frcs|jr|sr|ii|iii))+/;
  const OTHER_PERSON = / (?:m d|md|do|dr|mr|ms|mrs|prof|phd|pa c|np|au d)(?= |$)/;
  let from = 0;
  for (let i = 0; i < 6; i++) {
    const at = norm.indexOf(sur, from);
    if (at === -1) break;
    const end = at + sur.length - 1;
    const before = norm.slice(Math.max(0, at - 40), at);
    const after = norm.slice(end, end + 140);
    const found = after.match(LEFT_WORDING);
    if (found) {
      const between = after.slice(0, found.index).replace(CREDENTIAL, "");
      if (!OTHER_PERSON.test(between)) { result.leftWording = found[0]; break; }
    }
    const memoriam = before.match(/in memoriam|passed away/);
    if (memoriam) { result.leftWording = memoriam[0]; break; }
    from = at + sur.length;
  }
  return result;
}

function normUrl(u) {
  try {
    const x = new URL(u);
    return x.hostname.replace(/^www\./, "").toLowerCase() + x.pathname.replace(/\/+$/, "").toLowerCase();
  } catch (e) { return String(u); }
}

const depth = (u) => normUrl(u).split("/").filter(Boolean).length;

const BLOCK_STATUS = new Set([401, 403, 406, 429, 503]);
const BLOCK_PAGE = /(access denied|verify you are human|are you a robot|just a moment|attention required|request blocked|enable javascript and cookies)/i;

// Turns what we saw into one of: ok, problem, unchecked. Pure, so it can be tested.
function classify(listing, fetched) {
  const base = { ok: false, level: "unchecked", reason: "", detail: "", urlChanged: false };
  if (fetched.error) return { ...base, reason: "Couldn't reach the site", detail: fetched.error };
  const s = fetched.status;
  if (s === 404 || s === 410) return { ...base, level: listing["Last Checked"] ? "problem" : "known", reason: "Page not found", detail: `HTTP ${s}` };
  if (BLOCK_STATUS.has(s)) return { ...base, reason: "Site blocks automated visitors", detail: `HTTP ${s}` };
  if (s < 200 || s >= 300) return { ...base, reason: "Unexpected response", detail: `HTTP ${s}` };

  const a = analyzePage(listing.Name, fetched.html);
  const moved = normUrl(fetched.finalUrl) !== normUrl(listing.Website);
  if (a.nameFound === "none") {
    if (BLOCK_PAGE.test(fetched.html.slice(0, 20000)) && a.textLength < 3000) {
      return { ...base, reason: "Site blocks automated visitors", detail: "bot-check page" };
    }
    if (a.textLength < 600) {
      return { ...base, reason: "Page is built by JavaScript, nothing to read", detail: `${a.textLength} characters of text` };
    }
    // Doctors already shown as "Not yet verified" are expected to fail; keep them out of the main list.
    return {
      ...base, level: listing["Last Checked"] ? "problem" : "known", reason: "Doctor's name not on the page",
      detail: moved ? `link now goes to ${fetched.finalUrl}` : "page loads but the name is gone",
    };
  }
  if (a.leftWording) {
    return { ...base, level: "problem", reason: "Page says the doctor may have retired or left", detail: `wording near the name: "${a.leftWording}"` };
  }
  // A profile that now redirects to a shorter address is often a "meet our team" list: worth a look.
  const generic = moved && depth(fetched.finalUrl) < depth(listing.Website);
  return { ...base, ok: true, level: "ok", urlChanged: moved, generic, detail: moved ? fetched.finalUrl : "", match: a.nameFound };
}

async function fetchPage(url) {
  const attempt = async () => {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.8" },
    });
    const type = res.headers.get("content-type") || "";
    let html = "";
    if (res.ok && /text|html|xml|json/i.test(type || "text/html")) {
      const chunks = [];
      let size = 0;
      const reader = res.body.getReader();
      while (size < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value); size += value.length;
      }
      try { reader.cancel(); } catch (e) { /* already closed */ }
      const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
      const charset = (type.match(/charset=([^;]+)/i) || [])[1] || (buf.slice(0, 2048).toString("latin1").match(/charset=["']?([\w-]+)/i) || [])[1] || "utf-8";
      try { html = new TextDecoder(charset.trim()).decode(buf); } catch (e) { html = buf.toString("utf8"); }
    }
    return { status: res.status, finalUrl: res.url || url, html };
  };
  let last;
  for (let i = 0; i < 2; i++) {
    try {
      const r = await attempt();
      if (r.status >= 500 && r.status !== 503 && i === 0) { await sleep(2000); continue; }
      return r;
    } catch (e) {
      last = e;
      if (i === 0) await sleep(2000);
    }
  }
  const cause = last && last.cause && last.cause.code ? ` (${last.cause.code})` : "";
  return { error: (last && last.name === "TimeoutError" ? "timed out" : (last && last.message) || "network error") + cause };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Visit different sites in parallel, but never hit the same site faster than once a second.
async function runAll(listings, concurrency) {
  const byHost = new Map();
  for (const l of listings) {
    let host = "";
    try { host = new URL(l.Website).hostname; } catch (e) { /* ignored below */ }
    if (!byHost.has(host)) byHost.set(host, []);
    byHost.get(host).push(l);
  }
  const queues = [...byHost.values()];
  const results = new Map();
  let next = 0;
  async function worker() {
    while (next < queues.length) {
      const queue = queues[next++];
      for (let i = 0; i < queue.length; i++) {
        const l = queue[i];
        const fetched = await fetchPage(l.Website);
        results.set(l, { fetched, verdict: classify(l, fetched) });
        if (i < queue.length - 1) await sleep(HOST_DELAY_MS);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, queues.length) }, worker));
  return results;
}

const esc = (s) => String(s || "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();

function buildReport({ date, total, rows, skippedNoSite, ignoredList, mention }) {
  const ignored = ignoredList.length;
  const ok = rows.filter((r) => r.verdict.level === "ok");
  const problems = rows.filter((r) => r.verdict.level === "problem");
  const unchecked = rows.filter((r) => r.verdict.level === "unchecked");
  const known = rows.filter((r) => r.verdict.level === "known");
  const changed = ok.filter((r) => r.verdict.urlChanged);
  const month = date.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  const line = (r) => `| ${esc(r.listing.Name)} | ${esc(r.listing["Clinic Name"])} | ${esc(r.verdict.reason)}${r.verdict.detail ? " - " + esc(r.verdict.detail) : ""} | [open](${r.listing.Website}) |`;
  const out = [];
  out.push(`# Listing check - ${month}`);
  if (mention) out.push(`\n@${mention}, the monthly check of the doctor directory has finished.`);
  out.push(`\nChecked **${rows.length}** of ${total} listings (${skippedNoSite} have no website${ignored ? `, ${ignored} are on the ignore list` : ""}).\n`);
  out.push(`| Result | Listings |\n|---|---|`);
  out.push(`| Doctor's name found on their page | ${ok.length} |`);
  out.push(`| **Need a look** | **${problems.length}** |`);
  out.push(`| Couldn't be checked automatically | ${unchecked.length} |`);
  out.push(`| Name found, but the link now redirects | ${changed.length} |`);
  if (known.length) out.push(`| Already marked "Not yet verified" | ${known.length} |`);

  out.push(`\n## Need a look (${problems.length})\n`);
  if (problems.length) {
    out.push(`These pages loaded (or no longer exist) and something looks different. Open each one, and if the doctor has moved or left, update or remove the listing. A flag is not proof: a page can simply have been redesigned.\n`);
    out.push(`| Doctor | Clinic | What we saw | Page |\n|---|---|---|---|`);
    problems.sort((a, b) => a.listing.Name.localeCompare(b.listing.Name)).forEach((r) => out.push(line(r)));
  } else out.push("Nothing to look at this month.");

  if (known.length) {
    out.push(`\n## Already marked "Not yet verified" (${known.length})\n`);
    out.push(`These are shown on the site without a "Details checked" date. They are listed here so they aren't forgotten, but they don't count as new problems.\n`);
    out.push(`| Doctor | Clinic | What we saw | Page |\n|---|---|---|---|`);
    known.sort((a, b) => a.listing.Name.localeCompare(b.listing.Name)).forEach((r) => out.push(line(r)));
  }

  out.push(`\n## Couldn't be checked automatically (${unchecked.length})\n`);
  out.push(`<details><summary>Show the list</summary>\n`);
  out.push(`These sites blocked the check, were down, or only show content through JavaScript. That says nothing about the doctor. They need a person if you want them checked.\n`);
  out.push(`| Doctor | Clinic | Why | Page |\n|---|---|---|---|`);
  unchecked.sort((a, b) => a.verdict.reason.localeCompare(b.verdict.reason) || a.listing.Name.localeCompare(b.listing.Name)).forEach((r) => out.push(line(r)));
  out.push(`\n</details>`);

  out.push(`\n## Links that now redirect (${changed.length})\n`);
  out.push(`<details><summary>Show the list</summary>\n`);
  out.push(`The doctor's name is still there, but the address redirects somewhere else. The listing works today; updating the link avoids breakage later.\n`);
  out.push(`Rows marked **list page** now redirect to a shorter address, often a general "our team" page, so the doctor's own profile may be gone.\n`);
  out.push(`| Doctor | Clinic | Now goes to | Page |\n|---|---|---|---|`);
  changed.sort((a, b) => Number(!!b.verdict.generic) - Number(!!a.verdict.generic) || a.listing.Name.localeCompare(b.listing.Name))
    .forEach((r) => out.push(`| ${esc(r.listing.Name)} | ${esc(r.listing["Clinic Name"])} | ${r.verdict.generic ? "**list page** " : ""}${esc(r.verdict.detail)} | [open](${r.listing.Website}) |`));
  out.push(`\n</details>`);

  if (ignored) {
    out.push(`\n## Not checked on purpose (${ignored})\n`);
    out.push(`<details><summary>Show the list</summary>\n`);
    out.push(`These listings link to a page that can't show whether the doctor is still there (a topic page, or a page in a script the check can't read). They were checked by hand. Edit \`scripts/listing-check-ignore.json\` to change this list.\n`);
    out.push(`| Doctor | Reason |\n|---|---|`);
    ignoredList.forEach((e) => out.push(`| ${esc(e.name)} | ${esc(e.reason)} |`));
    out.push(`\n</details>`);
  }

  out.push(`\n---\n*How this works: once a month a script opens each listing's page and looks for the doctor's name. It never changes the directory. A pass means the doctor is still named on that page; it does not confirm they treat RCPD.*`);
  let text = out.join("\n");
  if (text.length > 60000) text = text.slice(0, 60000) + "\n\n*(report shortened)*";
  return { text, month, counts: { ok: ok.length, problems: problems.length, known: known.length, unchecked: unchecked.length, changed: changed.length } };
}

function loadIgnore() {
  try {
    return JSON.parse(fs.readFileSync(IGNORE_PATH, "utf8"));
  } catch (e) { return []; }
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (name) => { const i = args.indexOf(name); return i === -1 ? undefined : args[i + 1]; };
  const limit = Number(opt("--limit")) || Infinity;
  const only = opt("--only");
  const concurrency = Number(opt("--concurrency")) || 10;

  const all = parse(fs.readFileSync(CSV_PATH, "utf8").replace(/^\uFEFF/, ""), { columns: true, skip_empty_lines: true, relax_column_count: true, trim: true });
  const ignoreEntries = loadIgnore();
  const ignoreNames = new Set(ignoreEntries.map((e) => fold(e.name)));
  let listings = all.filter((l) => /^https?:\/\//i.test(l.Website));
  const skippedNoSite = all.length - listings.length;
    listings = listings.filter((l) => !ignoreNames.has(fold(l.Name)));
  const ignoredList = ignoreEntries.filter((e) => all.some((l) => fold(l.Name) === fold(e.name)));
  if (only) listings = listings.filter((l) => fold(l.Name).includes(fold(only)));
  listings = listings.slice(0, limit);

  console.log(`Checking ${listings.length} listings...`);
  const started = Date.now();
  const results = await runAll(listings, concurrency);
  const rows = listings.map((listing) => ({ listing, ...results.get(listing) }));
  console.log(`Done in ${Math.round((Date.now() - started) / 1000)}s.`);

  const report = buildReport({
    date: new Date(), total: all.length, rows, skippedNoSite, ignoredList,
    mention: process.env.GITHUB_ACTIONS === "true" ? process.env.GITHUB_REPOSITORY_OWNER : "",
  });
  const c = report.counts;
  console.log(`Name found: ${c.ok} | Need a look: ${c.problems} | Known unverified: ${c.known} | Couldn't check: ${c.unchecked} | Redirects: ${c.changed}`);
  for (const r of rows.filter((x) => x.verdict.level === "problem")) console.log(`  ! ${r.listing.Name}: ${r.verdict.reason} - ${r.verdict.detail}`);

  const reportPath = opt("--report");
  if (reportPath) fs.writeFileSync(reportPath, report.text);
  const titlePath = opt("--title");
  if (titlePath) fs.writeFileSync(titlePath, `Listing check - ${report.month}: ${c.problems} need a look`);
  const jsonPath = opt("--json");
  if (jsonPath) {
    fs.writeFileSync(jsonPath, JSON.stringify(rows.map((r) => ({ name: r.listing.Name, website: r.listing.Website, status: r.fetched.status || null, error: r.fetched.error || null, finalUrl: r.fetched.finalUrl || null, ...r.verdict })), null, 1));
  }
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report.text + "\n");
}

module.exports = { analyzePage, classify, nameParts, normUrl, words };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
