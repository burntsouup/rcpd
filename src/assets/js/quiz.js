// Accessible multi-step self-check. No answer is preselected, and you cannot
// advance a step until you have chosen a response — this avoids the old tool's
// false "low risk" result from untouched default values.
(function () {
  "use strict";

  var form = document.getElementById("quiz");
  if (!form) return;

  var intro = document.getElementById("quiz-intro");
  var progress = document.getElementById("quiz-progress");
  var stepsWrap = document.getElementById("quiz-steps");
  var result = document.getElementById("quiz-result");

  var bar = document.getElementById("progress-bar");
  var progressText = document.getElementById("progress-text");

  var prevBtn = document.getElementById("quiz-prev");
  var nextBtn = document.getElementById("quiz-next");
  var submitBtn = document.getElementById("quiz-submit");

  var steps = Array.prototype.slice.call(form.querySelectorAll(".quiz__q"));
  var total = steps.length;
  var current = 0;

  function answered(index) {
    return !!steps[index].querySelector("input[type=radio]:checked");
  }

  function refreshControls() {
    prevBtn.hidden = current === 0;
    var last = current === total - 1;
    nextBtn.hidden = last;
    submitBtn.hidden = !last;
    var ok = answered(current);
    nextBtn.disabled = !ok;
    submitBtn.disabled = !ok;
  }

  function showStep(index) {
    current = index;
    steps.forEach(function (step, i) {
      step.hidden = i !== index;
    });
    var pct = ((index + 1) / total) * 100;
    bar.style.setProperty("--progress", pct + "%");
    progressText.textContent = "Question " + (index + 1) + " of " + total;
    refreshControls();
    var legend = steps[index].querySelector("legend");
    if (legend) legend.setAttribute("tabindex", "-1"), legend.focus();
  }

  function start() {
    intro.hidden = true;
    progress.hidden = false;
    stepsWrap.hidden = false;
    result.hidden = true;
    showStep(0);
  }

  function values() {
    return steps.map(function (step) {
      var picked = step.querySelector("input[type=radio]:checked");
      return picked ? parseInt(picked.value, 10) : 0;
    });
  }

  function finish() {
    // The first question (inability to burp) is the cardinal symptom of RCPD:
    // if someone burps normally, RCPD is essentially ruled out regardless of the
    // rest. So it gates the result and is weighted double in the score.
    var v = values();
    var cardinal = v[0]; // 0-4
    var support = v.slice(1).reduce(function (a, b) {
      return a + b;
    }, 0); // 0-20

    var band, label, title, text;

    if (cardinal === 0) {
      band = "band--low";
      label = "RCPD looks unlikely";
      title = "You can burp, which makes RCPD unlikely.";
      text =
        "RCPD is defined by being unable to burp, so your answers don't fit the usual pattern. " +
        "If bloating, gas, or discomfort still bother you, they may have another cause \u2014 such " +
        "as reflux, IBS, or swallowing air \u2014 that's worth raising with a doctor.";
    } else {
      // Cardinal symptom carries the most weight; a "strong match" also requires
      // the inability to burp to be frequent (Often/Always), not just present.
      var pts = cardinal * 3 + support; // 3-32
      if (pts >= 20 && cardinal >= 3) {
        band = "band--high";
        label = "Strong match with RCPD";
        title = "Your answers line up closely with RCPD.";
        text =
          "Your responses match the hallmark pattern of RCPD \u2014 an inability to burp alongside " +
          "gurgling, bloating, and excess gas. Consider seeing a laryngologist (a throat-focused " +
          "ENT) for an evaluation. RCPD is treatable, most often with a single Botox injection.";
      } else if (pts >= 11) {
        band = "band--mod";
        label = "Possible match with RCPD";
        title = "Some of your answers overlap with RCPD.";
        text =
          "You report several symptoms associated with RCPD. It may be worth tracking them and " +
          "speaking with a laryngologist or your doctor, especially if they affect your daily life.";
      } else {
        band = "band--low";
        label = "Weak match with RCPD";
        title = "Only a few of your answers overlap with RCPD.";
        text =
          "You have some symptoms, but they don't strongly fit the RCPD pattern. If you remain " +
          "concerned \u2014 particularly if you genuinely cannot burp \u2014 a doctor is the best next step.";
      }
    }

    var bandEl = document.getElementById("result-band");
    bandEl.className = "band " + band;
    bandEl.textContent = label;
    document.getElementById("result-title").textContent = title;
    document.getElementById("result-text").textContent = text;

    progress.hidden = true;
    stepsWrap.hidden = true;
    result.hidden = false;
    result.focus();
  }

  form.addEventListener("change", function (e) {
    if (e.target && e.target.type === "radio") refreshControls();
  });

  document.getElementById("quiz-start").addEventListener("click", start);
  nextBtn.addEventListener("click", function () {
    if (answered(current) && current < total - 1) showStep(current + 1);
  });
  prevBtn.addEventListener("click", function () {
    if (current > 0) showStep(current - 1);
  });
  submitBtn.addEventListener("click", function () {
    if (answered(current)) finish();
  });
  document.getElementById("quiz-restart").addEventListener("click", function () {
    form.reset();
    result.hidden = true;
    progress.hidden = true;
    stepsWrap.hidden = true;
    intro.hidden = false;
    document.getElementById("quiz-start").focus();
  });
})();
