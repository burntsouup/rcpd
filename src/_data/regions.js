const loadDoctors = require("./doctors.js");
const site = require("./site.js");

// Every country and state/province with at least one clinician gets a page, because
// "RCPD doctor in <place>" is exactly what people search for. To keep these pages
// useful rather than thin, each one shows what is there (specialties, cities) and
// where to look next (other places with listed doctors).
const MIN_REGION_DOCTORS = 1;

// A city page is only worth having when several clinicians practise there.
const MIN_CITY_DOCTORS = 3;

// Countries whose State/Province values are clean enough to split further.
const SUBDIVIDED = {
  "United States": "state",
  Canada: "province",
};

// Pages with more clinicians than this skip the structured-data list to keep them light.
const MAX_STRUCTURED = 60;

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

const clinicians = (n) => `${n} ${n === 1 ? "clinician" : "clinicians"}`;
const specialists = (n) => `${n} ${n === 1 ? "Specialist" : "Specialists"}`;

const mostCommon = (values) => {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
};

const tally = (list, pick) => {
  const counts = new Map();
  for (const d of list) {
    const v = pick(d);
    if (v) counts.set(v, (counts.get(v) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

// Machine-readable list of the clinicians on a page, for search engines and AI assistants.
function structuredList(entry) {
  if (entry.doctors.length > MAX_STRUCTURED) return "";
  const data = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${site.url}${entry.url}#doctors`,
    name: `RCPD doctors in ${entry.place}`,
    description:
      "Clinicians reported by patients as treating retrograde cricopharyngeal dysfunction (RCPD, no-burp syndrome). Not an endorsement.",
    numberOfItems: entry.doctors.length,
    itemListElement: entry.doctors.map((d, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Physician",
        name: d.name,
        url: d.website || undefined,
        telephone: d.phone || undefined,
        address: {
          "@type": "PostalAddress",
          addressLocality: d.city || undefined,
          addressRegion: d.region || undefined,
          postalCode: d.postal || undefined,
          addressCountry: d.country || undefined,
        },
        worksFor: d.clinic ? { "@type": "MedicalOrganization", name: d.clinic } : undefined,
      },
    })),
  };
  // "<" is escaped so clinic names can never close the script tag.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

module.exports = function () {
  const doctors = loadDoctors();

  const byCountry = groupBy(doctors, (d) => d.country);
  const countries = [];
  const pages = [];

  // Fields every page needs, whatever its level.
  const finish = (entry) => {
    entry.countLabel = clinicians(entry.count);
    entry.specialistsLabel = specialists(entry.count);
    entry.specialties = tally(entry.doctors, (d) => d.specialty);
    entry.metaTitle = `RCPD Doctors in ${entry.heading} — ${entry.specialistsLabel}`;
    entry.description =
      `${entry.countLabel} in ${entry.place} who treat RCPD (no-burp syndrome), reported by patients. ` +
      `Clinic and contact details for each.`;
    entry.itemListJson = structuredList(entry);
    return entry;
  };

  // City pages for a container (a country, or a state/province inside one).
  const buildCities = (container) => {
    const cityGroups = groupBy(container.doctors, (d) => slugify(d.city));
    container.cityList = [...cityGroups.entries()]
      .map(([slug, list]) => ({ slug, name: mostCommon(list.map((d) => d.city)), count: list.length, list, url: "" }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    container.cities = [];

    for (const c of container.cityList) {
      // A city holding every doctor of its parent would just duplicate the parent page.
      if (c.count < MIN_CITY_DOCTORS || c.count === container.count) continue;
      const abbr = mostCommon(c.list.map((d) => d.stateAbbr || "").concat([""]).filter(Boolean).concat(["_"]));
      const heading =
        container.type === "subdivision" && abbr !== "_" ? `${c.name}, ${abbr}` : `${c.name}, ${container.name}`;
      const entry = finish({
        type: "city",
        name: c.name,
        heading,
        place:
          container.type === "subdivision"
            ? `${c.name}, ${container.name}, ${container.country}`
            : `${c.name}, ${container.country}`,
        slug: c.slug,
        country: container.country,
        countrySlug: container.countrySlug,
        countryUrl: container.countryUrl,
        parent: container,
        count: c.count,
        doctors: c.list,
        url: `${container.url}${c.slug}/`,
        crumbs: [...container.crumbs, { name: container.name, url: container.url }],
      });
      c.url = entry.url;
      container.cities.push({ name: c.name, count: c.count, url: entry.url });
      pages.push(entry);
    }
  };

  for (const [name, list] of byCountry) {
    const slug = slugify(name);
    const subdivisionLabel = SUBDIVIDED[name];
    const subdivisions = [];

    const countryEntry = {
      type: "country",
      name,
      heading: name,
      place: name,
      slug,
      country: name,
      countrySlug: slug,
      countryUrl: `/doctors/${slug}/`,
      count: list.length,
      doctors: list,
      subdivisions,
      subdivisionLabel: subdivisionLabel || "",
      url: `/doctors/${slug}/`,
      crumbs: [],
    };

    if (subdivisionLabel) {
      for (const [regionName, regionList] of groupBy(list, (d) => d.region)) {
        if (regionList.length < MIN_REGION_DOCTORS) continue;
        const entry = finish({
          type: "subdivision",
          label: subdivisionLabel,
          name: regionName,
          heading: regionName,
          place: `${regionName}, ${name}`,
          slug: slugify(regionName),
          country: name,
          countrySlug: slug,
          countryUrl: `/doctors/${slug}/`,
          count: regionList.length,
          doctors: regionList,
          url: `/doctors/${slug}/${slugify(regionName)}/`,
          crumbs: [{ name, url: `/doctors/${slug}/` }],
        });
        subdivisions.push(entry);
        pages.push(entry);
        buildCities(entry);
      }
      subdivisions.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      buildCities(countryEntry);
    }

    finish(countryEntry);
    countries.push(countryEntry);
    if (list.length >= MIN_REGION_DOCTORS) pages.push(countryEntry);
  }

  countries.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  // "Where to look next": other places with listed doctors, so no page is a dead end.
  const top = (items, self, n) =>
    items.filter((x) => x !== self).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, n);
  const pick = (x) => ({ name: x.name, count: x.count, url: x.url });
  const citiesOf = (parent) => pages.filter((p) => p.type === "city" && p.parent === parent);
  for (const c of countries) {
    c.related = { title: "Other countries with listed doctors", items: top(countries, c, 12).map(pick) };
    for (const s of c.subdivisions) {
      s.related = { title: `Other ${s.label}s with listed doctors`, items: top(c.subdivisions, s, 12).map(pick) };
      for (const city of citiesOf(s)) {
        city.related = { title: `More in ${s.name}`, items: [pick(s), ...top(citiesOf(s), city, 8).map(pick)] };
      }
    }
    for (const city of citiesOf(c)) {
      city.related = { title: `More in ${c.name}`, items: [pick(c), ...top(citiesOf(c), city, 8).map(pick)] };
    }
  }

  // The places linked from the home page, always the ones with the most clinicians.
  const bySize = (a, b) => b.count - a.count || a.name.localeCompare(b.name);
  const usa = countries.find((c) => c.name === "United States");
  const featured = {
    countries: [...countries].sort(bySize).slice(0, 12).map(pick),
    states: usa ? [...usa.subdivisions].sort(bySize).slice(0, 8).map(pick) : [],
    cities: pages.filter((p) => p.type === "city").sort(bySize).slice(0, 8).map((p) => ({ name: p.heading, count: p.count, url: p.url })),
  };

  return {
    featured,
    total: doctors.length,
    countryCount: countries.length,
    countries,
    listed: countries.filter((c) => c.count >= MIN_REGION_DOCTORS),
    unlisted: countries.filter((c) => c.count < MIN_REGION_DOCTORS),
    pages,
    minDoctors: MIN_REGION_DOCTORS,
  };
};
