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

  function score() {
    return steps.reduce(function (sum, step) {
      var picked = step.querySelector("input[type=radio]:checked");
      return sum + (picked ? parseInt(picked.value, 10) : 0);
    }, 0);
  }

  function finish() {
    var total20 = score(); // 0..20
    var band, title, text;
    if (total20 >= 14) {
      band = ["band--high", "Strong overlap with RCPD"];
      title = "Your answers line up closely with RCPD.";
      text =
        "Several of your responses match the hallmark pattern of RCPD. Consider seeing a " +
        "laryngologist (a throat-focused ENT) for an evaluation. The directory can help you start.";
    } else if (total20 >= 7) {
      band = ["band--mod", "Some overlap with RCPD"];
      title = "Some of your answers overlap with RCPD.";
      text =
        "You report some symptoms associated with RCPD. It may be worth tracking them and " +
        "speaking with a healthcare professional, especially if they affect daily life.";
    } else {
      band = ["band--low", "Little overlap with RCPD"];
      title = "Your answers show little overlap with RCPD.";
      text =
        "Your responses don't strongly match the typical RCPD pattern. If you still have concerns, " +
        "a healthcare professional is the best next step.";
    }

    document.getElementById("result-band").className = "band " + band[0];
    document.getElementById("result-band").textContent = band[1];
    document.getElementById("result-title").textContent = title;
    document.getElementById("result-text").textContent =
      text + " (Self-check score: " + total20 + " of 20.)";

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
