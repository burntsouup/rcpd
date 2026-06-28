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

  // Build date (YYYY-MM-DD) for structured data and the sitemap.
  eleventyConfig.addShortcode("isoDate", () => new Date().toISOString().slice(0, 10));

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
