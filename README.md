# noburp.info

```
 _   _   ___      ____   _   _  ____   ____
| \ | | / _ \    | __ ) | | | ||  _ \ |  _ \
|  \| || | | |   |  _ \ | | | || |_) || |_) |
| |\  || |_| |   | |_) || |_| ||  _ < |  __/
|_| \_| \___/    |____/  \___/ |_| \_\|_|
```

**A plain-language guide to retrograde cricopharyngeal dysfunction (RCPD), the
inability to burp, and a worldwide directory of clinicians who treat it.**

Live site: **[noburp.info](https://noburp.info)** &nbsp;·&nbsp; Community: [r/noburp](https://www.reddit.com/r/noburp/)

---

## Why this exists

RCPD is common, treatable, and barely known. Many people go decades without a
name for it. Once they find one, the next problem is finding a doctor who has
actually heard of it. This site tries to fix both: it explains the condition
without jargon, and it keeps a list of clinicians who treat it that is checked
against official sources instead of copied around forum posts.

It is an educational resource, not medical advice.

## What's in it

- **Explainer pages** on what RCPD is, why you can't burp, treatment (mostly a
  Botox injection), and whether it's dangerous.
- **A private self-check.** A short symptom quiz that runs entirely in your
  browser. Nothing is sent anywhere.
- **A research page** summarising the published studies.
- **The doctor directory:** 300+ clinicians in 40 countries, searchable on one
  page, with a generated page for every country (and for US states and Canadian
  provinces).
- **Machine-readable extras:** schema.org structured data on the pages,
  `llms.txt`, a sitemap, and IndexNow pings after each deploy.

## How it's built

There is no server and no database. It is a static site made with
[Eleventy](https://www.11ty.dev/) and hosted on GitHub Pages. The doctor
directory is a single CSV file that is read at build time and baked into the
pages. The search box is a small piece of plain JavaScript that filters the
cards already on the page.

```
 data/doctors.csv
        │
        ▼
 ┌───────────────┐   tests + validation   ┌──────────────┐
 │  git push     │ ─────────────────────▶ │  Eleventy    │ ──▶ GitHub Pages
 │  to main      │   (stops on errors)    │  build       │     noburp.info
 └───────────────┘                        └──────────────┘
                                                 │
                                                 └──▶ IndexNow ping (Bing & co.)

 1st of every month:
 check-listings.js ──▶ opens every doctor's page ──▶ one GitHub issue
                                                     listing what needs a look
```

The only runtime dependencies are Node and two packages (`@11ty/eleventy`,
`csv-parse`). There's no front-end framework and no build step for CSS or JS.

## The doctor directory

All listings live in [`data/doctors.csv`](data/doctors.csv), one row per
clinician:

| Column | Notes |
| --- | --- |
| `Name`, `Clinic Name`, `Specialty` | Free text; specialties come from a fixed list so typos can't slip in |
| `Address`, `City`, `State/Province`, `Postal/Zip Code`, `Country` | Used to build the country and region pages |
| `Phone`, `Website` | Official clinic or hospital pages only |
| `Additional Search Keywords` | Extra terms the search box matches (local-language names, nearby cities) |
| `Last Checked` | Date someone last confirmed the listing |

**What gets a doctor listed:** a current, verifiable practice, plus evidence
that they treat RCPD. That can be an RCPD page on their clinic or hospital
site, a published paper, or a direct report from a patient they treated. A
single map pin or a research authorship on its own isn't enough. Listings that
turn out to have no support are removed.

### Keeping it honest (automatically)

Three checks keep the data from quietly going wrong:

1. **Validation on every deploy.** [`scripts/validate-doctors.js`](scripts/validate-doctors.js)
   checks formatting, required fields, and duplicates *before* anything is
   built. An error stops the deploy, so the live site stays on the last good
   version. It also refuses a change that removes more than five listings at
   once unless the commit message contains `[allow-removals]`.
2. **A monthly listing check.** [`scripts/check-listings.js`](scripts/check-listings.js)
   runs from GitHub Actions on the 1st of each month. It opens each doctor's
   page, looks for their name, and files **one** GitHub issue with whatever needs
   a human look. It only reads public pages and never edits the data.
   Known false alarms (non-English pages and the like) are listed in
   [`scripts/listing-check-ignore.json`](scripts/listing-check-ignore.json).
3. **Tests.** The checkers themselves are tested, and the tests run before every
   deploy.

## Running it locally

You need Node 20 or newer.

```sh
git clone https://github.com/burntsouup/rcpd.git
cd rcpd
npm install
npm run dev        # builds and serves at http://localhost:8080 with live reload
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run build` | Production build into `_site/` |
| `npm run validate` | Check `data/doctors.csv` |
| `npm run check-listings` | Run the listing check by hand (slow; opens every site) |
| `npm test` | Run the test suite |

## Project layout

```
.
├── data/doctors.csv          the directory (source of truth)
├── src/
│   ├── *.njk                 pages
│   ├── _data/                site settings, FAQs, and the doctor/region loaders
│   ├── _includes/            base layout and partials
│   └── assets/               CSS, JS, fonts, images
├── scripts/                  validation, listing check, IndexNow, and their tests
├── .eleventy.js              Eleventy config
└── .github/workflows/        deploy.yml and check-listings.yml
```

## Suggesting a doctor or a correction

Use the **Suggest a doctor** button on the
[directory page](https://noburp.info/find-a-doctor.html). Corrections are just as
welcome as additions: a doctor who has moved, retired, or doesn't treat RCPD is
exactly what keeps the list useful.

If you're reading the code and spot a bug, an issue or pull request is welcome.

## License and credits

The **code** (templates, scripts, and styles) is released under the
[MIT License](LICENSE).

The **written content** (the explainer pages, FAQ, and research summaries) and
the **doctor directory data** are *not* covered by that license. Please don't
republish them without asking first.

The directory began with the specialists map built by the
[r/noburp](https://www.reddit.com/r/noburp/) community, and it only stays
useful because of the patients and doctors who keep sending corrections.
Thank you.
