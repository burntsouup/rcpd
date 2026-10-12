#!/usr/bin/env node
// Tells search engines that support IndexNow (Bing, Yandex, Seznam, Naver) which pages
// changed, right after a deploy. Free, no account. Google does not use IndexNow.
//
//   node scripts/indexnow.js [--dry-run]
//
// It must never break a deploy, so every failure ends with a warning and exit code 0.
"use strict";

const site = require("../src/_data/site.js");

const ENDPOINT = "https://api.indexnow.org/IndexNow";

// Pages whose <lastmod> in the sitemap is today (UTC) or yesterday changed in this deploy.
function changedUrls(sitemapXml, now = new Date()) {
  const day = (offset) => new Date(now.getTime() - offset * 86400000).toISOString().slice(0, 10);
  const recent = new Set([day(0), day(1)]);
  const urls = [];
  for (const m of sitemapXml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)) {
    if (recent.has(m[2].trim())) urls.push(m[1].trim());
  }
  return urls;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForKeyFile(keyLocation, key) {
  for (let i = 0; i < 8; i++) {
    try {
      const res = await fetch(`${keyLocation}?t=${Date.now()}`, { signal: AbortSignal.timeout(15000) });
      if (res.ok && (await res.text()).trim() === key) return true;
    } catch (e) { /* retry */ }
    await sleep(10000);
  }
  return false;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const key = site.indexNowKey;
  const host = new URL(site.url).hostname;
  const keyLocation = `${site.url}/${key}.txt`;

  const sitemap = await (await fetch(`${site.url}/sitemap.xml`, { signal: AbortSignal.timeout(20000) })).text();
  const urls = changedUrls(sitemap);
  console.log(`${urls.length} changed page(s) found in the sitemap.`);
  if (!urls.length) return;
  if (dryRun) { console.log(urls.join("\n")); return; }

  if (!(await waitForKeyFile(keyLocation, key))) {
    console.log(`::warning::IndexNow key file is not reachable at ${keyLocation}; skipped.`);
    return;
  }
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host, key, keyLocation, urlList: urls.slice(0, 10000) }),
    signal: AbortSignal.timeout(30000),
  });
  // 200 = accepted, 202 = accepted and the key is still being checked.
  if (res.status === 200 || res.status === 202) console.log(`IndexNow accepted ${urls.length} URL(s) (HTTP ${res.status}).`);
  else console.log(`::warning::IndexNow returned HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

module.exports = { changedUrls };
if (require.main === module) {
  main().catch((e) => console.log(`::warning::IndexNow notification skipped: ${e.message}`));
}
