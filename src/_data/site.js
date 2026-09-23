module.exports = {
  name: "No Burp",
  shortTitle: "No Burp",
  title: "RCPD / No-Burp Syndrome — Information & Resources",
  description:
    "Plain-language information about RCPD (Retrograde Cricopharyngeal Dysfunction), the inability to burp: what it is, a symptom self-check, the research, and a directory of doctors who treat it.",
  url: "https://noburp.info",
  lang: "en",
  locale: "en_US",
  author: "Kyle Czernuszka",
  email: "czernuka@outlook.com",
  reddit: "https://www.reddit.com/r/noburp/",
  // Where "suggest a doctor" / "report outdated info" links go. Empty formUrl =
  // pre-filled email to `email`; set it (e.g. a Google Form link) to use a form.
  // If you switch to a form, update the privacy page to match.
  directoryFeedback: { formUrl: "" },
  themeColor: "#16323d",
  // Primary navigation. Old .html filenames are preserved so existing inbound links keep working.
  nav: [
    { text: "Home", url: "/" },
    { text: "Self-check", url: "/diagnosis.html" },
    { text: "Treatment", url: "/rcpd-treatment.html" },
    { text: "Research", url: "/research.html" },
    { text: "Find a doctor", url: "/find-a-doctor.html" },
    { text: "FAQ", url: "/faq.html" },
  ],
};
