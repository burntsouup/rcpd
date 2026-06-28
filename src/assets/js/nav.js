// Mobile navigation toggle.
(function () {
  "use strict";
  var toggle = document.getElementById("nav-toggle");
  var header = document.querySelector(".site-header");
  if (!toggle || !header) return;

  function close() {
    header.classList.remove("nav-open");
    toggle.setAttribute("aria-expanded", "false");
  }

  toggle.addEventListener("click", function () {
    var open = header.classList.toggle("nav-open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });

  header.querySelectorAll(".site-nav a").forEach(function (link) {
    link.addEventListener("click", close);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && header.classList.contains("nav-open")) {
      close();
      toggle.focus();
    }
  });
})();
