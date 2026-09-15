/* =========================================================
   Clara Choin — Portfolio
   Core behaviour: language switching, mobile nav, lightbox,
   photography filter. No external requests, no forms, no tracking.
   ========================================================= */
(function () {
  "use strict";

  var STORAGE_KEY = "cc-lang";
  var DEFAULT_LANG = "fr";

  function getStoredLang() {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function storeLang(lang) {
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      /* storage unavailable — language just won't persist */
    }
  }

  function currentLang() {
    return getStoredLang() || DEFAULT_LANG;
  }

  function applyLang(lang) {
    var dict = window.I18N && window.I18N[lang];
    if (!dict) return;

    document.documentElement.setAttribute("lang", lang);

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (dict[key] !== undefined) {
        el.textContent = dict[key];
      }
    });

    document.querySelectorAll("[data-i18n-title]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-title");
      if (dict[key] !== undefined) {
        document.title = dict[key];
      }
    });

    document.querySelectorAll(".lang-toggle button").forEach(function (btn) {
      var isActive = btn.getAttribute("data-lang") === lang;
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    document.dispatchEvent(new CustomEvent("cc:langchange", { detail: { lang: lang } }));
  }

  function initLangToggle() {
    document.querySelectorAll(".lang-toggle button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var lang = btn.getAttribute("data-lang");
        storeLang(lang);
        applyLang(lang);
      });
    });
  }

  function initNavToggle() {
    var toggle = document.querySelector(".nav-toggle");
    var nav = document.querySelector(".main-nav");
    if (!toggle || !nav) return;
    toggle.addEventListener("click", function () {
      var isOpen = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
    nav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* =========================================================
     Lightbox — click any .thumb button to view the full,
     uncropped image. Navigates within its data-group siblings
     that are currently visible (so it respects active filters).
     ========================================================= */
  function initLightbox() {
    var thumbs = document.querySelectorAll("button.thumb");
    if (!thumbs.length) return;

    var lb = document.createElement("div");
    lb.className = "lightbox";
    lb.hidden = true;
    lb.setAttribute("role", "dialog");
    lb.setAttribute("aria-modal", "true");
    lb.innerHTML =
      '<button type="button" class="lightbox-close" aria-label="Fermer">✕</button>' +
      '<button type="button" class="lightbox-prev" aria-label="Image précédente">‹</button>' +
      '<figure><img src="" alt=""><figcaption></figcaption></figure>' +
      '<button type="button" class="lightbox-next" aria-label="Image suivante">›</button>';
    document.body.appendChild(lb);

    var imgEl = lb.querySelector("img");
    var captionEl = lb.querySelector("figcaption");
    var closeBtn = lb.querySelector(".lightbox-close");
    var prevBtn = lb.querySelector(".lightbox-prev");
    var nextBtn = lb.querySelector(".lightbox-next");

    var groupList = [];
    var groupIndex = 0;
    var lastFocused = null;

    function groupOf(thumb) {
      return thumb.getAttribute("data-group") || "default";
    }

    function visibleThumbsInGroup(group) {
      return Array.prototype.filter.call(
        document.querySelectorAll('button.thumb[data-group="' + group + '"]'),
        function (el) { return el.offsetParent !== null; }
      );
    }

    function show(index) {
      if (!groupList.length) return;
      groupIndex = (index + groupList.length) % groupList.length;
      var thumb = groupList[groupIndex];
      var img = thumb.querySelector("img");
      imgEl.src = img.currentSrc || img.src;
      imgEl.alt = img.alt || "";
      captionEl.textContent = img.alt || "";
      var multi = groupList.length > 1;
      prevBtn.hidden = !multi;
      nextBtn.hidden = !multi;
    }

    function open(thumb) {
      lastFocused = document.activeElement;
      var group = groupOf(thumb);
      groupList = visibleThumbsInGroup(group);
      if (!groupList.length) groupList = [thumb];
      var idx = groupList.indexOf(thumb);
      show(idx === -1 ? 0 : idx);
      lb.hidden = false;
      document.body.style.overflow = "hidden";
      closeBtn.focus();
      document.addEventListener("keydown", onKeydown);
    }

    function close() {
      lb.hidden = true;
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeydown);
      if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
    }

    function onKeydown(e) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") show(groupIndex + 1);
      if (e.key === "ArrowLeft") show(groupIndex - 1);
    }

    document.addEventListener("click", function (e) {
      var thumb = e.target.closest("button.thumb");
      if (thumb) open(thumb);
    });

    closeBtn.addEventListener("click", close);
    prevBtn.addEventListener("click", function () { show(groupIndex - 1); });
    nextBtn.addEventListener("click", function () { show(groupIndex + 1); });
    lb.addEventListener("click", function (e) {
      if (e.target === lb) close();
    });
  }

  /* =========================================================
     Photography filter — pills are generated from whichever
     data-cat values are present in the grid, so new sub-categories
     (and new photos) surface automatically without touching this file.
     ========================================================= */
  var PHOTO_CAT_LABELS = {
    portraits:  { fr: "Portraits",   en: "Portraits" },
    landscapes: { fr: "Paysages",    en: "Landscapes" },
    events:     { fr: "Événements", en: "Events" },
    animals:    { fr: "Animaux",     en: "Animals" },
    marketing:  { fr: "Marketing",   en: "Marketing" },
    nature:     { fr: "Nature",      en: "Nature" },
    sport:      { fr: "Sport",       en: "Sport" },
    street:     { fr: "Street",      en: "Street" }
  };
  var ALL_LABEL = { fr: "Tout voir", en: "See all" };

  function initPhotoFilter() {
    var grid = document.querySelector(".photo-grid[data-gallery]");
    var filterBar = document.getElementById("galleryFilters");
    if (!grid || !filterBar) return;

    var thumbs = Array.prototype.slice.call(grid.querySelectorAll("button.thumb"));
    var cats = [];
    thumbs.forEach(function (t) {
      var c = t.getAttribute("data-cat");
      if (c && cats.indexOf(c) === -1) cats.push(c);
    });

    var active = "all";

    function label(key, lang) {
      if (key === "all") return ALL_LABEL[lang] || ALL_LABEL.fr;
      var entry = PHOTO_CAT_LABELS[key];
      return entry ? (entry[lang] || entry.fr) : key;
    }

    function render(lang) {
      filterBar.innerHTML = "";
      ["all"].concat(cats).forEach(function (key) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = label(key, lang);
        btn.setAttribute("aria-pressed", key === active ? "true" : "false");
        btn.addEventListener("click", function () {
          active = key;
          apply();
          render(lang);
        });
        filterBar.appendChild(btn);
      });
    }

    function apply() {
      thumbs.forEach(function (t) {
        var match = active === "all" || t.getAttribute("data-cat") === active;
        t.hidden = !match;
      });
    }

    render(currentLang());
    apply();

    document.addEventListener("cc:langchange", function (e) {
      render(e.detail.lang);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    applyLang(currentLang());
    initLangToggle();
    initNavToggle();
    initLightbox();
    initPhotoFilter();
  });
})();
