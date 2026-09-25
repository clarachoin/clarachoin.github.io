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
      '<figure><img src="" alt=""><video controls playsinline hidden></video><figcaption></figcaption></figure>' +
      '<button type="button" class="lightbox-next" aria-label="Image suivante">›</button>';
    document.body.appendChild(lb);

    var imgEl = lb.querySelector("img");
    var videoEl = lb.querySelector("video");
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

    function stopVideo() {
      videoEl.pause();
      videoEl.hidden = true;
      videoEl.removeAttribute("src");
      videoEl.load();
    }

    function show(index) {
      if (!groupList.length) return;
      groupIndex = (index + groupList.length) % groupList.length;
      var thumb = groupList[groupIndex];
      var videoSrc = thumb.getAttribute("data-video");
      if (videoSrc) {
        var text = thumb.getAttribute("data-alt") || "";
        imgEl.hidden = true;
        imgEl.removeAttribute("src");
        videoEl.hidden = false;
        videoEl.src = videoSrc;
        captionEl.textContent = text;
        var p = videoEl.play();
        if (p && p.catch) p.catch(function () { /* autoplay blocked — controls stay available */ });
      } else {
        stopVideo();
        var img = thumb.querySelector("img");
        imgEl.hidden = false;
        imgEl.src = img.currentSrc || img.src;
        imgEl.alt = img.alt || "";
        captionEl.textContent = img.alt || "";
      }
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
      stopVideo();
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
     Gallery filters — one filterable image grid per topic (e.g.
     photography, communications). Pills are generated from an
     explicit data-cats list on the grid when given (so a category
     with no photos yet still gets a pill), otherwise from whichever
     data-cat values are present, so new sub-categories surface
     automatically without touching this file. Each grid is paired
     with the filter bar whose id is "<data-gallery><value>Filters".
     ========================================================= */
  var GALLERY_CAT_LABELS = {
    photography: {
      portraits:  { fr: "Portraits",   en: "Portraits" },
      landscapes: { fr: "Paysages",    en: "Landscapes" },
      events:     { fr: "Événements", en: "Events" },
      animals:    { fr: "Animaux",     en: "Animals" },
      marketing:  { fr: "Marketing",   en: "Marketing" },
      nature:     { fr: "Nature",      en: "Nature" },
      sport:      { fr: "Sport",       en: "Sport" },
      street:     { fr: "Street",      en: "Street" },
      videos:     { fr: "Vidéos",      en: "Videos" }
    },
    communications: {
      rh:        { fr: "Communication interne, RH, RSE",  en: "Internal Communication, HR, CSR" },
      externe:   { fr: "Communication externe",            en: "External Communication" },
      redaction: { fr: "Conception Rédaction",              en: "Content & Copywriting" },
      strategie: { fr: "Stratégie de communication et RH",  en: "Communication & HR Strategy" }
    }
  };
  var ALL_LABEL = { fr: "Tout voir", en: "See all" };

  function initGalleryFilters() {
    var grids = document.querySelectorAll(".photo-grid[data-gallery]");

    Array.prototype.forEach.call(grids, function (grid) {
      var galleryKey = grid.getAttribute("data-gallery");
      var filterBar = document.getElementById(galleryKey + "Filters");
      if (!filterBar) return;

      var thumbs = Array.prototype.slice.call(grid.querySelectorAll("button.thumb"));
      var explicitCats = grid.getAttribute("data-cats");
      var cats = [];
      if (explicitCats) {
        explicitCats.split(",").forEach(function (c) {
          c = c.trim();
          if (c) cats.push(c);
        });
      } else {
        thumbs.forEach(function (t) {
          var c = t.getAttribute("data-cat");
          if (c && cats.indexOf(c) === -1) cats.push(c);
        });
      }

      // Mix the pictures (new order on every visit). Done after the pills are
      // collected so they keep the folder order.
      if (grid.hasAttribute("data-shuffle")) {
        for (var i = thumbs.length - 1; i > 0; i--) {
          var k = Math.floor(Math.random() * (i + 1));
          var tmp = thumbs[i]; thumbs[i] = thumbs[k]; thumbs[k] = tmp;
        }
        thumbs.forEach(function (t) { grid.appendChild(t); });
      }

      var emptyMsg = document.getElementById(galleryKey + "Empty");
      var active = "all";
      var labels = GALLERY_CAT_LABELS[galleryKey] || {};

      function label(key, lang) {
        if (key === "all") return ALL_LABEL[lang] || ALL_LABEL.fr;
        var entry = labels[key];
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
        var visibleCount = 0;
        thumbs.forEach(function (t) {
          var match = active === "all" || t.getAttribute("data-cat") === active;
          t.hidden = !match;
          if (match) visibleCount++;
        });
        if (emptyMsg) emptyMsg.hidden = visibleCount > 0;
      }

      render(currentLang());
      apply();

      document.addEventListener("cc:langchange", function (e) {
        render(e.detail.lang);
      });
    });
  }

  /* =========================================================
     Dynamic galleries — fills every [data-gallery-src="key"] container
     with thumbnails from window.GALLERY_DATA[key] (generated from the
     image folder by scripts/build-gallery.js).
     ========================================================= */
  function initDynamicGalleries() {
    var data = window.GALLERY_DATA || {};
    Array.prototype.forEach.call(document.querySelectorAll("[data-gallery-src]"), function (box) {
      var key = box.getAttribute("data-gallery-src");
      (data[key] || []).forEach(function (item) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "thumb";
        btn.setAttribute("data-group", key);
        if (item.cat) btn.setAttribute("data-cat", item.cat);
        if (item.type === "video") {
          // First frame as the cover; the video itself plays in the lightbox.
          btn.setAttribute("data-video", encodeURI(item.src));
          btn.setAttribute("aria-label", item.alt || "Vidéo");
          var vid = document.createElement("video");
          vid.src = encodeURI(item.src) + "#t=0.1";
          vid.preload = "metadata";
          vid.muted = true;
          vid.playsInline = true;
          vid.setAttribute("aria-hidden", "true");
          vid.tabIndex = -1;
          var badge = document.createElement("span");
          badge.className = "play-badge";
          badge.setAttribute("aria-hidden", "true");
          badge.textContent = "▶";
          btn.appendChild(vid);
          btn.appendChild(badge);
          btn.setAttribute("data-alt", item.alt || "");
        } else {
          var img = document.createElement("img");
          img.src = encodeURI(item.src);
          img.alt = item.alt || "";
          img.loading = "lazy";
          btn.appendChild(img);
        }
        box.appendChild(btn);
      });
    });
  }

  /* =========================================================
     Carousel — arrows scroll the track by one page of slides.
     Clicking a slide is handled by the lightbox (button.thumb).
     ========================================================= */
  function initCarousels() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-carousel]"), function (root) {
      var track = root.querySelector(".carousel-track");
      var prev = root.querySelector(".carousel-btn.prev");
      var next = root.querySelector(".carousel-btn.next");
      if (!track || !prev || !next) return;

      function update() {
        var max = track.scrollWidth - track.clientWidth;
        prev.disabled = track.scrollLeft <= 1;
        next.disabled = track.scrollLeft >= max - 1;
      }
      function page(dir) {
        track.scrollBy({ left: dir * track.clientWidth, behavior: "smooth" });
      }

      prev.addEventListener("click", function () { page(-1); });
      next.addEventListener("click", function () { page(1); });
      track.addEventListener("scroll", update, { passive: true });
      window.addEventListener("resize", update);
      update();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initDynamicGalleries();
    applyLang(currentLang());
    initLangToggle();
    initNavToggle();
    initLightbox();
    initGalleryFilters();
    initCarousels();
  });
})();
