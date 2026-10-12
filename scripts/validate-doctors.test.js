"use strict";
// Run with: npm test
// Each test recreates a mistake that has happened (or easily could) and checks
// the validator would have stopped it.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { validate, COLUMNS } = require("./validate-doctors");

const GOOD = [
  "Dr Jane Smith", "1 Main St, Boston, MA 02114, United States", "Boston", "MA", "Massachusetts",
  "02114", "Example Hospital", "617-555-0100", "https://example.org/jane-smith",
  "Laryngology", "United States", "", "2026-09-29",
];
const toCsv = (rows, eol = "\r\n") =>
  [COLUMNS, ...rows].map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join(eol) + eol;
const row = (over = {}) => GOOD.map((v, i) => (COLUMNS[i] in over ? over[COLUMNS[i]] : v));
const TODAY = new Date("2026-10-12T00:00:00Z");
const run = (text, opts) => validate(text, { today: TODAY, ...opts });
const hasError = (res, re) => res.errors.some((e) => re.test(e.msg));

test("a correct row passes", () => {
  const res = run(toCsv([row()]));
  assert.deepStrictEqual(res.errors, []);
  assert.strictEqual(res.rows, 1);
});

test("the real directory file has no errors", () => {
  const text = fs.readFileSync(path.resolve(__dirname, "..", "data", "doctors.csv"), "utf8");
  assert.deepStrictEqual(run(text).errors, []);
});

test("a row added with LF in a CRLF file is caught (the vanished-doctor bug)", () => {
  const text = toCsv([row()]) + toCsv([row({ Name: "Dr Bob Jones" })]).split("\r\n").slice(1).join("\n");
  const res = run(text);
  assert.ok(hasError(res, /Mixed line endings/));
});

test("two rows merged into one are caught", () => {
  const merged = row({ "Last Checked": "2026-09-28\nDr Bob Jones" });
  const res = run(toCsv([merged]));
  assert.ok(hasError(res, /line break|real date/));
});

test("a row with the wrong number of fields is caught", () => {
  const text = toCsv([row()]) + "Dr Bob Jones,Only,Three\r\n";
  assert.ok(hasError(run(text), /cannot be read as CSV/));
});

test("a US ZIP that lost its leading zero is caught", () => {
  assert.ok(hasError(run(toCsv([row({ "Postal/Zip Code": "2114" })])), /ZIP/));
});

test("state abbreviation and name must agree", () => {
  assert.ok(hasError(run(toCsv([row({ "State/Province": "Maine" })])), /does not match/));
});

test("an impossible or future date is caught", () => {
  assert.ok(hasError(run(toCsv([row({ "Last Checked": "2026-02-30" })])), /real date/));
  assert.ok(hasError(run(toCsv([row({ "Last Checked": "2027-01-01" })])), /future/));
  assert.ok(hasError(run(toCsv([row({ "Last Checked": "29/09/2026" })])), /real date/));
});

test("a website that is not a full http(s) address is caught", () => {
  assert.ok(hasError(run(toCsv([row({ Website: "www.example.org" })])), /Website/));
});

test("an unknown specialty is caught", () => {
  assert.ok(hasError(run(toCsv([row({ Specialty: "Laryngologist" })])), /Specialty/));
});

test("a wrongly spelled country is caught", () => {
  assert.ok(hasError(run(toCsv([row({ Country: "USA" })])), /should be written "United States"/));
});

test("the same doctor listed twice is caught", () => {
  assert.ok(hasError(run(toCsv([row(), row()])), /listed twice/));
});

test("a wrong header is caught", () => {
  const bad = toCsv([row()]).replace("Specialty", "Speciality");
  assert.ok(hasError(run(bad), /Header/));
});

test("an accidental mass deletion is caught, a small removal is allowed", () => {
  const many = Array.from({ length: 12 }, (_, i) => row({ Name: `Dr Person${i} Name${i}` }));
  const before = toCsv(many);
  assert.ok(hasError(run(toCsv(many.slice(0, 3)), { baseline: before }), /removed in one change/));
  assert.deepStrictEqual(run(toCsv(many.slice(0, 11)), { baseline: before }).errors, []);
});

test("missing phone or address only warns", () => {
  const res = run(toCsv([row({ Phone: "", Address: "" })]));
  assert.deepStrictEqual(res.errors, []);
  assert.ok(res.warnings.length >= 2);
});
