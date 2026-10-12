"use strict";
// Run with: npm test
const test = require("node:test");
const assert = require("node:assert");
const { analyzePage, classify, nameParts, normUrl } = require("./check-listings");

const page = (body) => `<html><body><main>${body}</main>${"<p>filler text about the clinic and its services.</p>".repeat(30)}</body></html>`;
const listing = (Name = "Dr Jane Smith", Website = "https://example.org/jane-smith") => ({ Name, Website, "Clinic Name": "Example Clinic", "Last Checked": "2026-09-29" });
const ok = (html, over = {}) => ({ status: 200, finalUrl: "https://example.org/jane-smith", html, ...over });

test("names are split into given name and surname", () => {
  assert.deepStrictEqual(nameParts("Dr Jane Smith"), { given: "jane", surname: "smith" });
  assert.deepStrictEqual(nameParts("Dr Ricardo Aulet Jr"), { given: "ricardo", surname: "aulet" });
  assert.deepStrictEqual(nameParts("Prof. Perttu Arkkila"), { given: "perttu", surname: "arkkila" });
  assert.deepStrictEqual(nameParts("Dr Beatriz Arenaz Búa"), { given: "beatriz", surname: "bua" });
});

test("a page naming the doctor passes, ignoring accents, case and entities", () => {
  assert.strictEqual(analyzePage("Dr Mélissa Patry", page("<h1>Melissa PATRY, MD</h1>")).nameFound, "full");
  assert.strictEqual(analyzePage("Dr Mélissa Patry", page("<h1>M&eacute;lissa Patry</h1>")).nameFound, "full");
  assert.strictEqual(analyzePage("Dr Jane Smith", page("<h1>Dr. J. Smith</h1>")).nameFound, "surname");
});

test("a page without the surname is flagged, and a surname inside a longer word is not a match", () => {
  assert.strictEqual(analyzePage("Dr Jane Smith", page("<h1>Our team</h1>")).nameFound, "none");
  assert.strictEqual(analyzePage("Dr Jane Smith", page("<h1>Blacksmithing</h1>")).nameFound, "none");
});

test("names hidden in structured data on script-built pages are found", () => {
  const html = '<html><script type="application/ld+json">{"name":"Jane Smith, MD"}</script><script>var x="no";</script></html>';
  assert.strictEqual(analyzePage("Dr Jane Smith", html).nameFound, "full");
});

test("retirement wording right after the name is flagged", () => {
  const a = analyzePage("Dr John Milligan", page("<p>John Milligan, M.D. Retired September of 2024</p>"));
  assert.ok(a.leftWording);
  assert.ok(analyzePage("Dr Jane Smith", page("<p>Dr. Jane Smith has retired from practice.</p>")).leftWording);
  assert.ok(analyzePage("Dr Jane Smith", page("<p>In memoriam: Dr Jane Smith</p>")).leftWording);
});

test("'Retired' next to OTHER doctors on a staff page is not held against this doctor", () => {
  const staff = page("<p>Manikandan Sugumaran M.D. Glenn Rothman M.D. David Simms M.D. Alyson Kaplan M.D. Stephanie Warrington M.D. John Milligan, M.D. Retired September of 2024 Dan Chapel, M.D. Retired January of 2026</p>");
  assert.strictEqual(analyzePage("Dr Manikandan Sugumaran", staff).leftWording, null);
  assert.ok(analyzePage("Dr Dan Chapel", staff).leftWording);
});

test("classification: found, gone, missing page, blocked, JavaScript-only, unreachable", () => {
  assert.strictEqual(classify(listing(), ok(page("Dr Jane Smith"))).level, "ok");
  assert.strictEqual(classify(listing(), ok(page("Someone else"))).reason, "Doctor's name not on the page");
  assert.strictEqual(classify(listing(), { status: 404, html: "", finalUrl: "" }).reason, "Page not found");
  assert.strictEqual(classify(listing(), { status: 403, html: "", finalUrl: "" }).level, "unchecked");
  assert.strictEqual(classify(listing(), ok("<html><div id=app></div></html>")).level, "unchecked");
  assert.strictEqual(classify(listing(), { error: "timed out" }).level, "unchecked");
  assert.strictEqual(classify(listing(), { status: 500, html: "", finalUrl: "" }).level, "unchecked");
});

test("a bot-check page is 'blocked', not 'doctor gone'", () => {
  const blocked = ok("<html><body><h1>Just a moment...</h1><p>Verify you are human</p></body></html>");
  assert.strictEqual(classify(listing(), blocked).reason, "Site blocks automated visitors");
});

test("a redirect that still names the doctor passes but is noted; one that loses the name is flagged", () => {
  const moved = classify(listing(), ok(page("Dr Jane Smith"), { finalUrl: "https://new.example.org/providers/jane-smith" }));
  assert.ok(moved.ok && moved.urlChanged);
  const lost = classify(listing(), ok(page("Welcome to our home page"), { finalUrl: "https://example.org/" }));
  assert.strictEqual(lost.level, "problem");
  assert.match(lost.detail, /now goes to/);
});

test("trailing slashes, www, http/https and #anchors are not treated as a changed link", () => {
  assert.strictEqual(normUrl("http://www.example.org/a/#x"), normUrl("https://example.org/a"));
});

test("a never-verified doctor whose page lacks their name is 'known', not a new problem", () => {
  const unverified = { ...listing(), "Last Checked": "" };
  assert.strictEqual(classify(unverified, ok(page("Someone else"))).level, "known");
  assert.strictEqual(classify({ ...listing(), "Last Checked": "2026-09-29" }, ok(page("Someone else"))).level, "problem");
});

test("a profile that redirects to a shorter 'list' address is marked generic", () => {
  const l = listing("Dr Jane Smith", "https://example.org/providers/jane-smith");
  const v = classify(l, ok(page("Our team: Jane Smith, Bob Jones"), { finalUrl: "https://example.org/our-team/" }));
  assert.ok(v.ok && v.urlChanged && v.generic);
  const same = classify(l, ok(page("Dr Jane Smith"), { finalUrl: "https://example.org/providers/jane-smith-md" }));
  assert.ok(same.urlChanged && !same.generic);
});
