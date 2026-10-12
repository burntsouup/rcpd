"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { changedUrls } = require("./indexnow");

const sitemap = (rows) =>
  `<?xml version="1.0"?><urlset>${rows.map(([u, d]) => `\n  <url>\n    <loc>${u}</loc>\n    <lastmod>${d}</lastmod>\n  </url>`).join("")}</urlset>`;

test("only pages changed today or yesterday are submitted", () => {
  const xml = sitemap([
    ["https://noburp.info/", "2026-10-12"],
    ["https://noburp.info/faq.html", "2026-10-11"],
    ["https://noburp.info/about.html", "2026-09-23"],
  ]);
  assert.deepStrictEqual(changedUrls(xml, new Date("2026-10-12T15:00:00Z")), [
    "https://noburp.info/",
    "https://noburp.info/faq.html",
  ]);
});

test("an empty or unrecognised sitemap submits nothing", () => {
  assert.deepStrictEqual(changedUrls("", new Date()), []);
  assert.deepStrictEqual(changedUrls("<html>error</html>", new Date()), []);
});
