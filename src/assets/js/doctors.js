// Client-side filter for the doctor directory. The full list is rendered into
// the page at build time (good for SEO and works without JS); this just hides
// the cards that don't match the search terms.
(function () {
  "use strict";

  var input = document.getElementById("doctor-search");
  var grid = document.getElementById("doctor-grid");
  var count = document.getElementById("doctor-count");
  var empty = document.getElementById("finder-empty");
  if (!input || !grid) return;

  var cards = Array.prototype.slice.call(grid.querySelectorAll(".doctor"));
  var totalLabel = count ? count.getAttribute("data-total") || cards.length : cards.length;

  function update() {
    var query = input.value.trim().toLowerCase();
    var tokens = query ? query.split(/\s+/) : [];
    var shown = 0;

    cards.forEach(function (card) {
      var haystack = card.getAttribute("data-search") || "";
      var match = tokens.every(function (t) {
        return haystack.indexOf(t) !== -1;
      });
      card.hidden = !match;
      if (match) shown++;
    });

    if (count) {
      count.textContent = query
        ? "Showing " + shown + " of " + totalLabel + " doctors"
        : totalLabel + " doctors listed";
    }
    if (empty) empty.hidden = shown !== 0;
  }

  input.addEventListener("input", update);
  // Allow pressing Enter without submitting/reloading.
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") e.preventDefault();
  });
  update();
})();
