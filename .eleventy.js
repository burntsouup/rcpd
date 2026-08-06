const { execFileSync } = require("child_process");

// Last commit date (YYYY-MM-DD) touching a file. Empty string if git can't answer,
// e.g. an uncommitted new file or a build outside a git checkout.
const gitDateCache = new Map();
function gitDate(file) {
  if (gitDateCache.has(file)) return gitDateCache.get(file);
  let out = "";
  try {
    out = execFileSync("git", ["log", "-1", "--format=%cs", "--", file], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch (e) {
    out = "";
  }
  gitDateCache.set(file, out);
  return out;
}

module.exports = function (eleventyConfig) {
  // Copy static assets straight through to the output.
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/CNAME": "CNAME" });
  eleventyConfig.addPassthroughCopy({ "src/robots.txt": "robots.txt" });
  eleventyConfig.addPassthroughCopy({ "src/llms.txt": "llms.txt" });
  eleventyConfig.addPassthroughCopy({ "src/.nojekyll": ".nojekyll" });

  // Rebuild when these change during `npm run dev`.
  eleventyConfig.addWatchTarget("src/assets/");
  eleventyConfig.addWatchTarget("data/doctors.csv");

  // Small helper: strip a phone number down to a tel: href.
  eleventyConfig.addFilter("telHref", (value) => {
    if (!value) return "";
    const digits = String(value).replace(/[^\d+]/g, "");
    return digits ? "tel:" + digits : "";
  });

  // Current year for the footer.
  eleventyConfig.addShortcode("year", () => String(new Date().getFullYear()));

  // Build date (YYYY-MM-DD) — used only where a genuine build timestamp is wanted.
  eleventyConfig.addShortcode("isoDate", () => new Date().toISOString().slice(0, 10));

  // Real last-modified date for a page, so <lastmod> and dateModified stay honest
  // instead of resetting to the build date on every deploy. `extraDeps` lets a
  // data-driven page (the doctor directory) also track its source data.
  eleventyConfig.addFilter("lastModified", (inputPath, extraDeps) => {
    const files = [inputPath]
      .concat(Array.isArray(extraDeps) ? extraDeps : [])
      .filter(Boolean);
    const dates = files.map(gitDate).filter(Boolean).sort();
    return dates.length ? dates[dates.length - 1] : new Date().toISOString().slice(0, 10);
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "_site",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["njk", "md", "html"],
  };
};
