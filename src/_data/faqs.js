// Single source of truth for the FAQ page. The visible accordion and the
// FAQPage JSON-LD are both rendered from this list, so the structured data can
// never drift away from the copy a reader actually sees.
//
// Block shapes inside `a`:
//   "some text"        -> a paragraph (may contain inline HTML)
//   { list: [ ... ] }  -> an unordered list
// `extra` is visible-only HTML (figures, onward links) and is deliberately kept
// out of the schema.

const items = [
  {
    q: "What is RCPD?",
    open: true,
    a: [
      "RCPD stands for Retrograde Cricopharyngeal Dysfunction. It's a condition where the cricopharyngeus muscle in the throat fails to relax properly, preventing a natural burp. This can cause chronic bloating, discomfort, and gurgling noises as trapped air can't escape.",
    ],
    extra: `<figure class="figure">
            <div class="figure__pair">
              <img src="/assets/img/without-rcpd.png" alt="Anatomy of a normal burp, where the cricopharyngeus relaxes to release air" loading="lazy" width="403" height="253">
              <img src="/assets/img/with-rcpd.png" alt="Anatomy of RCPD, where the cricopharyngeus stays tight and traps air" loading="lazy" width="526" height="518">
            </div>
            <figcaption class="figure-note">
              Illustrations by
              <a href="https://www.reddit.com/user/natalie_uic/" target="_blank" rel="noopener">u/natalie_uic</a>.
            </figcaption>
          </figure>`,
  },
  {
    q: "What causes RCPD, and is it common?",
    a: [
      "The exact cause isn't fully understood. In RCPD the cricopharyngeus muscle — the upper esophageal sphincter — doesn't relax to vent swallowed air the way it should, so gas builds up instead of being released as a burp. For most people it appears to be a lifelong trait, and many recall never having been able to burp. Nobody knows yet how many people have it. It may be more common than once thought, and it's widely under-recognized, so people often go years without a name for their symptoms.",
    ],
  },
  {
    q: "What are the common signs and symptoms?",
    a: [
      {
        list: [
          "Inability to burp, or extreme difficulty burping",
          "Frequent gurgling, rumbling, or squeaking noises in the throat or upper chest",
          "Bloating, chest pressure, or discomfort after meals or carbonated drinks",
          "Excessive flatulence",
          "Occasional relief through passing gas, “air-vomiting,” or lying down",
          "Social or dietary changes to avoid triggers like carbonated beverages",
        ],
      },
    ],
  },
  {
    q: "How is RCPD diagnosed?",
    a: [
      "RCPD is often recognized from its distinctive symptom pattern — chiefly a lifelong inability to burp combined with gurgling, bloating, and excess gas. Standard tests such as endoscopy or a barium swallow usually come back normal, which is part of why it's frequently missed or mistaken for reflux, IBS, or aerophagia. Some specialists use high-resolution esophageal manometry to help confirm it. A laryngologist familiar with RCPD is best placed to make the call.",
    ],
  },
  {
    q: "Is RCPD dangerous or life-threatening?",
    a: [
      "No. RCPD is not considered dangerous or life-threatening, and it has not been shown to cause lasting physical damage. What it does affect is quality of life — chronic discomfort, dietary avoidance and anxiety are common.",
    ],
    extra: `<p>
            <a href="/is-rcpd-dangerous.html">Read the full answer, including the symptoms that
            are <em>not</em> RCPD and should be checked &rarr;</a>
          </p>`,
  },
  {
    q: "What treatment options are available?",
    a: [
      {
        list: [
          "<strong>Botox injection:</strong> the most established and effective treatment. It relaxes the cricopharyngeus so trapped air can finally escape as a burp. Reported success rates are high — frequently around 90% — and for many people a single injection brings lasting relief.",
          "<strong>Cricopharyngeal myotomy:</strong> a surgical option that partially divides the muscle, sometimes considered when Botox doesn't provide a durable benefit.",
          "<strong>Self-help measures:</strong> some people find partial relief from posture changes, certain exercises, or limiting carbonation — but these manage symptoms rather than correct the underlying problem.",
        ],
        extra: `<p><a class="arrow" href="/rcpd-treatment.html">What to expect from treatment, with the research &rarr;</a></p>`,
  },
    ],
  },
  {
    q: "What does the Botox injection do?",
    a: [
      "For RCPD, a botulinum toxin (Botox) injection relaxes the cricopharyngeus muscle in the upper esophageal sphincter. That muscle is supposed to relax to let gas escape as a burp, but in RCPD it stays overly tight — trapping air and causing bloating, discomfort, and gurgling. Relaxing it lets people burp, often for the first time.",
    ],
  },
  {
    q: "Does the treatment last, or does it wear off?",
    a: [
      "This is one of the more reassuring parts of RCPD treatment. Although Botox itself wears off over a few months, many people keep the ability to burp long after it fades — the reflex seems to “re-learn” itself, and for a large share of patients the benefit is durable or even permanent. Some people need a second injection (about one in five in the largest long-term study), and a few choose a myotomy for a more permanent fix.",
    ],
    extra: `<p><a class="arrow" href="/rcpd-treatment.html">What to expect from treatment, with the research &rarr;</a></p>`,
  },
  {
    q: "What should I do if I suspect I have RCPD?",
    a: [
      {
        list: [
          "Document your symptoms, including triggers and how often they happen.",
          "Consult a specialist — ideally a laryngologist (a throat-focused ENT).",
          "Ask about treatment options — most often a Botox injection.",
        ],
      },
    ],
    extra: `<p><a class="arrow" href="/find-a-doctor.html">Find a doctor near you &rarr;</a></p>`,
  },
  {
    q: "What is “air-vomiting”?",
    a: [
      "Air-vomiting (sometimes “air-puking”) is the forced expulsion of trapped air from the stomach or esophagus. It mimics vomiting without bringing up any solids or liquids, and some people with RCPD use it to relieve discomfort.",
    ],
  },
  {
    q: "What is emetophobia?",
    a: [
      "Emetophobia is an intense fear of vomiting, seeing vomit, or feeling nauseous. Some people with RCPD also have it. Trapped gas can cause nausea-like sensations, and many people with RCPD find it hard to vomit, which can add to anxiety about being sick.",
    ],
  },
  {
    q: "What is an ENT doctor?",
    a: [
      "An ENT (Ear, Nose, and Throat) doctor, also called an otolaryngologist, diagnoses and treats conditions of the ears, nose, throat, and related head-and-neck structures. A <em>laryngologist</em> — an ENT focused on the voice box and swallowing — is the primary specialist for treating RCPD.",
    ],
  },
];

const stripTags = (s) => String(s).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

module.exports = items.map((item) => ({
  ...item,
  // Plain-text version of the visible answer, for the FAQPage schema.
  schemaText: item.a
    .map((block) => (typeof block === "string" ? stripTags(block) : block.list.map(stripTags).join(" ")))
    .join(" "),
}));
