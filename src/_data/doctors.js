const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

// Reads the doctor directory from data/doctors.csv at build time and returns a
// cleaned, sorted array. No database, no server — the list is baked into the
// static pages and filtered client-side.
module.exports = function () {
  const csvPath = path.resolve("data/doctors.csv");
  const raw = fs.readFileSync(csvPath, "utf8");

  const records = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });

  const clean = (v) => (typeof v === "string" ? v.trim() : "");

  // Strip accents so "sao paulo" finds "São Paulo" and "munchen" finds "München".
  // NFD handles combining marks; these letters are separate codepoints and need
  // mapping by hand. The client-side filter folds the query the same way.
  const LETTERS = { æ: "ae", ø: "o", ß: "ss", ð: "d", þ: "th", œ: "oe", ł: "l", đ: "d" };
  const fold = (v) =>
    v
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[æøßðþœłđ]/g, (c) => LETTERS[c])
      .replace(/[\u2010-\u2015]/g, "-");

  const doctors = records
    .map((r) => {
      const name = clean(r["Name"]);
      const city = clean(r["City"]);
      const state = clean(r["State/Province"]);
      const stateAbbr = clean(r["State/Province Abbreviation"]);
      const country = clean(r["Country"]);
      const postal = clean(r["Postal/Zip Code"]);
      const clinic = clean(r["Clinic Name"]);
      const phone = clean(r["Phone"]);
      const specialty = clean(r["Specialty"]);
      const keywords = clean(r["Additional Search Keywords"]);
      const address = clean(r["Address"]);
      // YYYY-MM-DD when this listing's contact details were last confirmed.
      const checkedRaw = clean(r["Last Checked"]);
      const checked = /^\d{4}-\d{2}-\d{2}$/.test(checkedRaw) ? checkedRaw : "";

      // Only trust absolute http(s) links — guards against javascript: URLs.
      const rawSite = clean(r["Website"]);
      const website = /^https?:\/\//i.test(rawSite) ? rawSite : "";
      let websiteHost = "";
      if (website) {
        try {
          websiteHost = new URL(website).hostname.replace(/^www\./, "");
        } catch (e) {
          websiteHost = "";
        }
      }

      const region = state || stateAbbr;
      // Skip the region when it only repeats the city, so city-states and
      // same-named cantons/counties don't render as "London, London, UK".
      const location = [city, region === city ? "" : region, country]
        .filter(Boolean)
        .join(", ");
      const search = [
        name, clinic, city, state, stateAbbr, country, postal, specialty, keywords,
      ]
        .join(" ")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[æøßðþœłđ]/g, (c) => LETTERS[c])
        .replace(/[\u2010-\u2015]/g, "-")
        .replace(/\s+/g, " ")
        .trim();

      return {
        name, city, state, stateAbbr, region, country, postal,
        clinic, phone, specialty, keywords, address,
        website, websiteHost, location, search, checked,
      };
    })
    .filter((d) => d.name)
    .sort(
      (a, b) =>
        a.country.localeCompare(b.country) ||
        a.region.localeCompare(b.region) ||
        a.city.localeCompare(b.city) ||
        a.name.localeCompare(b.name)
    );

  return doctors;
};
