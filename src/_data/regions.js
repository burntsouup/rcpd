const loadDoctors = require("./doctors.js");

// A region needs at least this many doctors to get its own page. Below this a
// page would be too thin to be useful, so those doctors are reachable only
// through the main searchable directory.
const MIN_DOCTORS = 3;

// Countries whose State/Province values are clean enough to split further.
const SUBDIVIDED = {
  "United States": "state",
  Canada: "province",
};

const slugify = (value) =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const groupBy = (items, key) => {
  const map = new Map();
  for (const item of items) {
    const value = key(item);
    if (!value) continue;
    if (!map.has(value)) map.set(value, []);
    map.get(value).push(item);
  }
  return map;
};

module.exports = function () {
  const doctors = loadDoctors();

  const byCountry = groupBy(doctors, (d) => d.country);
  const countries = [];
  const pages = [];

  for (const [name, list] of byCountry) {
    const slug = slugify(name);
    const subdivisionLabel = SUBDIVIDED[name];
    const subdivisions = [];

    if (subdivisionLabel) {
      for (const [regionName, regionList] of groupBy(list, (d) => d.region)) {
        if (regionList.length < MIN_DOCTORS) continue;
        const entry = {
          type: "subdivision",
          label: subdivisionLabel,
          name: regionName,
          slug: slugify(regionName),
          country: name,
          countrySlug: slug,
          countryUrl: `/doctors/${slug}/`,
          count: regionList.length,
          doctors: regionList,
          url: `/doctors/${slug}/${slugify(regionName)}/`,
        };
        subdivisions.push(entry);
        pages.push(entry);
      }
      subdivisions.sort((a, b) => a.name.localeCompare(b.name));
    }

    const entry = {
      type: "country",
      name,
      slug,
      country: name,
      countrySlug: slug,
      countryUrl: `/doctors/${slug}/`,
      count: list.length,
      doctors: list,
      subdivisions,
      subdivisionLabel: subdivisionLabel || "",
      url: `/doctors/${slug}/`,
    };
    countries.push(entry);
    if (list.length >= MIN_DOCTORS) pages.push(entry);
  }

  countries.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return {
    total: doctors.length,
    countryCount: countries.length,
    countries,
    listed: countries.filter((c) => c.count >= MIN_DOCTORS),
    unlisted: countries.filter((c) => c.count < MIN_DOCTORS),
    pages,
    minDoctors: MIN_DOCTORS,
  };
};
