#!/usr/bin/env node
// Checks data/doctors.csv before the site is built and published.
//
//   node scripts/validate-doctors.js [--baseline path/to/previous.csv] [--warnings]
//
// ERRORS stop the deploy (the live site stays on the last good version).
// WARNINGS are shown in the Actions log but never block anything.
//
// This catches formatting and consistency mistakes. It cannot tell whether a
// doctor still works where the row says they do - see check-listings.js for that.
"use strict";

const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

const CSV_PATH = path.resolve(__dirname, "..", "data", "doctors.csv");

const COLUMNS = [
  "Name", "Address", "City", "State/Province Abbreviation", "State/Province",
  "Postal/Zip Code", "Clinic Name", "Phone", "Website", "Specialty", "Country",
  "Additional Search Keywords", "Last Checked",
];

// New specialties are rare; add them here on purpose so a typo can't slip in.
const SPECIALTIES = new Set([
  "Otolaryngology (ENT)",
  "Laryngology",
  "Gastroenterology",
  "Gastroenterology (diagnostic testing)",
  "Phoniatrics",
  "Otolaryngology (ENT) and Phoniatrics",
  "Head & Neck Surgery",
  "Rehabilitation Medicine",
  "Neurology (neurogenic dysphagia)",
  "Anesthesiology",
]);

// Wrong spellings of a country, mapped to the spelling the site uses. The region
// pages group by exact country text, so "UK" would silently create a second country.
const COUNTRY_ALIASES = {
  usa: "United States", us: "United States", "u.s.": "United States", "u.s.a.": "United States",
  "united states of america": "United States", america: "United States",
  uk: "United Kingdom", "u.k.": "United Kingdom", england: "United Kingdom",
  scotland: "United Kingdom", wales: "United Kingdom", "northern ireland": "United Kingdom",
  "great britain": "United Kingdom", britain: "United Kingdom",
  czechia: "Czech Republic", korea: "South Korea", "republic of korea": "South Korea",
  uae: "United Arab Emirates", "u.a.e.": "United Arab Emirates",
  holland: "Netherlands", "the netherlands": "Netherlands",
  ksa: "Saudi Arabia", "kingdom of saudi arabia": "Saudi Arabia",
  turkiye: "Turkey", deutschland: "Germany", espana: "Spain",
};

const US_STATES = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana",
  IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};
const CA_PROVINCES = new Set([
  "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT",
]);

// Doctor-rating and "find a doctor" sites. A listing should point to the doctor's own
// hospital or clinic page, because these sites go stale and are not the practice.
const THIRD_PARTY_SITES =
  /castle ?connolly|healthgrades|doximity|vitals\.com|webmd|zocdoc|usnews|\bent ?health\b|sharecare|ratemds|top ?doctors|doctoralia|npiprofile|npino|yelp|linkedin|facebook/i;

const NAME_PREFIXES = new Set(["Dr", "Mr", "Ms", "Mrs", "Miss", "Prof", "Prof.", "Assoc", "Assoc."]);

// More removals than this in one change is treated as an accident.
const MAX_REMOVALS = 5;
const STALE_DAYS = 365;
const DAY_MS = 24 * 3600 * 1000;

const fold = (v) =>
  String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

function isRealDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function validate(text, { baseline, today = new Date() } = {}) {
  const errors = [];
  const warnings = [];
  const err = (line, msg) => errors.push({ line, msg });
  const warn = (line, msg, cat) => warnings.push({ line, msg, cat: cat || "other" });

  if (text.charCodeAt(0) === 0xfeff) {
    err(1, "File starts with a byte-order mark; save it as plain UTF-8.");
  }

  // The file uses Windows (CRLF) line endings. A row added with plain LF is read as
  // part of the previous row, which silently dropped a doctor once.
  const crlf = (text.match(/\r\n/g) || []).length;
  const bareLf = (text.match(/(?<!\r)\n/g) || []).length;
  const bareCr = (text.match(/\r(?!\n)/g) || []).length;
  if (crlf && (bareLf || bareCr)) {
    err(0, `Mixed line endings (${crlf} CRLF, ${bareLf} LF, ${bareCr} CR). Every row must end the same way as the rest of the file.`);
  }

  let records;
  try {
    records = parse(text.replace(/^\uFEFF/, ""), {
      columns: false,
      skip_empty_lines: true,
      relax_column_count: false,
      trim: false,
      info: true,
    });
  } catch (e) {
    err(e.lines || 0, `The file cannot be read as CSV: ${e.message}`);
    return { errors, warnings, rows: 0 };
  }

  if (!records.length) {
    err(1, "The file is empty.");
    return { errors, warnings, rows: 0 };
  }

  const header = records[0].record;
  if (header.join("\u0000") !== COLUMNS.join("\u0000")) {
    err(1, `Header must be exactly: ${COLUMNS.join(", ")}`);
    return { errors, warnings, rows: 0 };
  }

  const rows = records.slice(1).map((r) => ({
    line: r.info.lines,
    v: Object.fromEntries(COLUMNS.map((c, i) => [c, r.record[i] || ""])),
  }));

  const seenNames = new Map();
  const seenSites = new Map();
  const todayMs = today.getTime();

  for (const { line, v } of rows) {
    const label = v.Name || "(no name)";

    // Fields must not contain line breaks or stray edge/double spaces.
    for (const c of COLUMNS) {
      if (/[\r\n]/.test(v[c])) err(line, `${label}: "${c}" contains a line break (a row was probably merged with the next one).`);
      else if (v[c] !== v[c].trim() || /\s{2,}/.test(v[c])) err(line, `${label}: "${c}" has extra spaces.`);
    }

    if (!v.Name) { err(line, "Row has no Name."); continue; }
    const parts = v.Name.split(" ");
    if (parts.length < 2) err(line, `${label}: Name should be a title and a surname, e.g. "Dr Jane Smith".`);
    else if (!NAME_PREFIXES.has(parts[0])) warn(line, `${label}: Name does not start with a title (Dr, Mr, Ms, Prof...).`, "name without a title");
    if (!v.City) err(line, `${label}: City is empty.`);
    if (!v.Country) err(line, `${label}: Country is empty.`);
    if (!v.Specialty) err(line, `${label}: Specialty is empty.`);
    else if (!SPECIALTIES.has(v.Specialty)) {
      err(line, `${label}: Specialty "${v.Specialty}" is not one of the known values. If it is new, add it to SPECIALTIES in scripts/validate-doctors.js.`);
    }

    const alias = COUNTRY_ALIASES[fold(v.Country)];
    if (alias) err(line, `${label}: Country "${v.Country}" should be written "${alias}".`);

    const abbr = v["State/Province Abbreviation"];
    const region = v["State/Province"];
    const zip = v["Postal/Zip Code"];
    if (v.Country === "United States") {
      if (!abbr) err(line, `${label}: US listing has no state abbreviation.`);
      else if (!US_STATES[abbr]) err(line, `${label}: "${abbr}" is not a US state abbreviation.`);
      else if (!region) err(line, `${label}: US listing has an abbreviation but no state name.`);
      else if (fold(region) !== fold(US_STATES[abbr])) err(line, `${label}: State "${region}" does not match abbreviation ${abbr} (${US_STATES[abbr]}).`);
      if (zip && !/^\d{5}(-\d{4})?$/.test(zip)) err(line, `${label}: ZIP "${zip}" must be 5 digits (or ZIP+4). Leading zeros are easy to lose.`);
      if (!zip) warn(line, `${label}: no ZIP code.`, "US listings without a ZIP code");
    } else if (v.Country === "Canada") {
      if (!abbr) err(line, `${label}: Canadian listing has no province abbreviation.`);
      else if (!CA_PROVINCES.has(abbr)) err(line, `${label}: "${abbr}" is not a Canadian province code.`);
      if (zip && !/^[A-Z]\d[A-Z] ?\d[A-Z]\d$/.test(zip)) err(line, `${label}: Postal code "${zip}" is not in the form A1A 1A1.`);
    } else if (abbr && !region) {
      warn(line, `${label}: has a region abbreviation "${abbr}" but no region name.`, "region abbreviation without a name");
    }

    if (v.Website) {
      let ok = false;
      try {
        const u = new URL(v.Website);
        ok = u.protocol === "https:" || u.protocol === "http:";
      } catch (e) { /* invalid */ }
      // doctors.js silently hides links that aren't absolute http(s), so a typo would just vanish.
      if (!ok) err(line, `${label}: Website "${v.Website}" must be a full http(s) address.`);
      else {
        if (v.Website.startsWith("http://")) warn(line, `${label}: Website uses http:// - try https://.`, "http (not https) websites");
        const key = v.Website.replace(/\/+$/, "").toLowerCase();
        if (seenSites.has(key)) warn(line, `${label}: shares a website with ${seenSites.get(key)}.`, "listings sharing a website");
        else seenSites.set(key, label);
      }
    } else warn(line, `${label}: no website.`, "no website");
    if (THIRD_PARTY_SITES.test(v.Website) || THIRD_PARTY_SITES.test(v["Clinic Name"])) {
      warn(line, `${label}: points to a third-party directory instead of the doctor's own clinic page.`, "third-party directory instead of an official page");
    }
    if (v.Phone && (v.Phone.match(/\d/g) || []).length < 7) err(line, `${label}: Phone "${v.Phone}" has fewer than 7 digits.`);
    if (!v.Phone) warn(line, `${label}: no phone number.`, "no phone number");
    if (!v.Address) warn(line, `${label}: no street address.`, "no street address");
    if (!v["Clinic Name"]) warn(line, `${label}: no clinic or hospital name.`, "no clinic name");

    const checked = v["Last Checked"];
    if (!checked) warn(line, `${label}: never verified (no Last Checked date).`, "never verified");
    else if (!isRealDate(checked)) err(line, `${label}: Last Checked "${checked}" must be a real date as YYYY-MM-DD.`);
    else {
      const ms = Date.parse(checked + "T00:00:00Z");
      if (ms > todayMs + DAY_MS) err(line, `${label}: Last Checked ${checked} is in the future.`);
      else if (todayMs - ms > STALE_DAYS * DAY_MS) warn(line, `${label}: last checked over a year ago (${checked}).`, "last checked over a year ago");
    }

    const key = fold(v.Name);
    if (seenNames.has(key)) err(line, `${label}: listed twice (also on line ${seenNames.get(key)}).`);
    else seenNames.set(key, line);
  }

  // Compare with the previous version so an accidental mass deletion can't go live.
  if (baseline) {
    try {
      const before = parse(baseline.replace(/^\uFEFF/, ""), { columns: true, skip_empty_lines: true, relax_column_count: true });
      const nowNames = new Set(rows.map((r) => fold(r.v.Name)));
      const removed = before.map((b) => b.Name).filter((n) => n && !nowNames.has(fold(n)));
      if (removed.length > MAX_REMOVALS) {
        err(0, `${removed.length} listings were removed in one change (limit ${MAX_REMOVALS}): ${removed.slice(0, 8).join(", ")}${removed.length > 8 ? ", ..." : ""}. If this is intended, put [allow-removals] in the commit message.`);
      }
    } catch (e) {
      warn(0, `Could not compare with the previous version: ${e.message}`);
    }
  }

  return { errors, warnings, rows: rows.length };
}

function main() {
  const args = process.argv.slice(2);
  const bi = args.indexOf("--baseline");
  const basePath = bi !== -1 ? args[bi + 1] : undefined;
  const baseline = basePath && fs.existsSync(basePath) ? fs.readFileSync(basePath, "utf8") : undefined;
  const text = fs.readFileSync(CSV_PATH, "utf8");
  const { errors, warnings, rows } = validate(text, { baseline });

  const inActions = process.env.GITHUB_ACTIONS === "true";
  for (const { line, msg } of errors) {
    if (inActions) console.log(`::error file=data/doctors.csv${line ? `,line=${line}` : ""}::${msg}`);
    else console.log(`ERROR   ${line ? "line " + line + ": " : ""}${msg}`);
  }
  if (args.includes("--warnings")) {
    for (const { line, msg } of warnings) console.log(`warning ${line ? "line " + line + ": " : ""}${msg}`);
  } else if (warnings.length) {
    // Warnings are about missing details, not mistakes, so only summarise them.
    const byCat = {};
    for (const w of warnings) byCat[w.cat] = (byCat[w.cat] || 0) + 1;
    console.log("\nWarnings (do not block publishing; add --warnings to list each one):");
    for (const [cat, n] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${cat}`);
  }

  console.log(`\nChecked ${rows} listings: ${errors.length} error(s), ${warnings.length} warning(s).`);
  if (errors.length) {
    console.log("The site was NOT published. Fix the errors above and push again.");
    process.exit(1);
  }
  console.log("Directory data looks good.");
}

module.exports = { validate, COLUMNS };
if (require.main === module) main();
