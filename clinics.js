/* ===================================================================
   AnabulKu — Daftar Klinik Mitra
   -------------------------------------------------------------------
   Hanya menampilkan klinik yang sudah mendaftar melalui website mitra
   (mitra/daftar.html). Data dibaca dari localStorage key "mitraKlinik".

   Tidak ada geolocation, tidak ada Google Places API.
=================================================================== */

(function () {
  "use strict";

  /* =================================================================
     Util
  ================================================================= */

  function $(sel, root) { return (root || document).querySelector(sel); }

  function esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* Label judul per kategori */
  var LABELS = {
    kucing:   "Klinik Kucing",
    anjing:   "Klinik Anjing",
    reptile:  "Klinik Reptile",
    terdekat: "Semua Klinik Mitra"
  };

  /* Kata kunci filter per kategori — cocokkan ke field hewanDilayani & tipeKlinik */
  var FILTER = {
    kucing:  /(kucing|cat|feline|kitten)/i,
    anjing:  /(anjing|dog|canine|puppy)/i,
    reptile: /(reptil|reptile|eksotik|exotic|turtle|ular|iguana|gecko)/i
  };

  /* =================================================================
     Baca data klinik dari localStorage
  ================================================================= */
  function getMitraClinics() {
    try {
      var raw = localStorage.getItem("mitraKlinik");
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  /* Saring klinik berdasarkan kategori yang dipilih */
  function filterClinics(clinics, category) {
    if (category === "terdekat") return clinics; /* tampilkan semua */

    var rx = FILTER[category];
    if (!rx) return clinics;

    return clinics.filter(function (c) {
      var tipe = (c.tipeKlinik || "").toLowerCase();

      /* hewanDilayani bisa berupa array (format baru) atau string (format lama) */
      if (Array.isArray(c.hewanDilayani)) {
        /* format baru: array of strings, e.g. ['kucing', 'anjing'] */
        return c.hewanDilayani.some(function (h) { return rx.test(h); });
      }

      /* format lama: string tunggal */
      var hewan = (c.hewanDilayani || "").toLowerCase();
      if (hewan === "semua") return true;
      return rx.test(hewan) || rx.test(tipe) || rx.test(c.namaKlinik || "");
    });
  }

  /* =================================================================
     Render
  ================================================================= */

  function cardHtml(c, idx, userLoc) {
    /* Link to clinic detail page */
    var href = "clinic-detail.html?id=" + idx;

    /* Foto thumbnail — use uploaded photo or logo if available */
    var photoStyle = "";
    if (c.fotoDataUrl) {
      photoStyle = ' style="background-image:url(' + esc(c.fotoDataUrl) + ');"';
    } else if (c.logoDataUrl) {
      photoStyle = ' style="background-image:url(' + esc(c.logoDataUrl) + ');"';
    }

    /* Alamat — prefer Google-geocoded formatted address, then manual entry, then kota/provinsi */
    var alamat = esc(c.formattedAddress || c.alamat || [c.kota, c.provinsi].filter(Boolean).join(", ") || "");

    /* Rating — prefer Google Places rating, then stored value, then default 5.0 */
    var rawRating = c.googleRating != null && c.googleRating !== "" ? c.googleRating
                  : c.rating != null ? c.rating : null;
    var rating = rawRating != null ? parseFloat(rawRating).toFixed(1) : "5.0";
    var ratingChip =
      '<span class="clinic-chip clinic-chip--rating" aria-label="Rating ' + esc(rating) + '">' +
        '<svg class="clinic-ico" viewBox="0 0 24 24" fill="#FF9800" aria-hidden="true">' +
          '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>' +
        '</svg>' +
        '<span class="clinic-val">' + esc(rating) + '</span>' +
      '</span>';

    /* Distance chip — only if clinic has coords and user location is known */
    var distChip = "";
    var cLat = parseFloat(c.lat);
    var cLng = parseFloat(c.lng);
    if (userLoc && !isNaN(cLat) && !isNaN(cLng)) {
      var km = haversineKm(userLoc.lat, userLoc.lng, cLat, cLng);
      distChip =
        '<span class="clinic-chip clinic-chip--dist" aria-label="Jarak ' + esc(fmtDistance(km)) + '">' +
          '<svg class="clinic-ico" viewBox="0 0 24 24" fill="none" stroke="#FF9800" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>' +
          '</svg>' +
          '<span class="clinic-val">' + esc(fmtDistance(km)) + '</span>' +
        '</span>';
    }

    return '' +
      '<a class="clinic-card" href="' + esc(href) + '">' +
        '<span class="clinic-texture" aria-hidden="true"></span>' +
        '<span class="clinic-photo"' + photoStyle + ' aria-hidden="true"></span>' +
        '<span class="clinic-body">' +
          '<span class="clinic-name">' + esc(c.namaKlinik || "Klinik Hewan") + '</span>' +
          (alamat ? '<span class="clinic-addr">' + alamat + '</span>' : '') +
          '<span class="clinic-meta">' +
            ratingChip +
            (distChip ? distChip : '') +
          '</span>' +
        '</span>' +
      '</a>';
  }

  function emptyHtml() {
    return '<div class="clinic-empty">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="48" height="48" aria-hidden="true">' +
        '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>' +
        '<polyline points="9 22 9 12 15 12 15 22"/>' +
      '</svg>' +
      '<p>Belum ada klinik terdaftar untuk kategori ini.</p>' +
    '</div>';
  }

  /* =================================================================
     Geolocation & Distance
  ================================================================= */

  /** Haversine formula — returns distance in km between two lat/lng points */
  function haversineKm(lat1, lng1, lat2, lng2) {
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function fmtDistance(km) {
    if (km < 1) return Math.round(km * 1000) + " m";
    return km.toFixed(1) + " km";
  }

  /** Get user location — returns Promise<{lat,lng}|null> */
  function getUserLocation() {
    return new Promise(function(resolve) {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        function(pos) { resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
        function()    { resolve(null); },
        { timeout: 6000 }
      );
    });
  }

  /* =================================================================
     Controller
  ================================================================= */

  function init() {
    var section = $("#clinic-results");
    if (!section) {
      console.warn("[AnabulKu] #clinic-results tidak ditemukan di halaman.");
      return;
    }

    var titleEl = $("#clinic-results-title", section);
    var listEl  = $("#clinic-list", section);
    var noteEl  = $("#clinic-note", section);
    var cats    = document.querySelectorAll(".cat[data-category]");
    var activeCategory = null;
    var userLocation = null; /* cached after first geolocation */

    /* Try to get user location eagerly on init for faster first display */
    getUserLocation().then(function(loc) { userLocation = loc; });

    function setActive(btn) {
      for (var i = 0; i < cats.length; i++) cats[i].classList.remove("is-active");
      if (btn) btn.classList.add("is-active");
    }

    function show(category, btn) {
      /* Klik kategori yang sama → tutup */
      if (activeCategory === category) {
        section.hidden = true;
        activeCategory = null;
        setActive(null);
        return;
      }

      activeCategory = category;
      setActive(btn);
      section.hidden = false;
      titleEl.textContent = LABELS[category] || LABELS.terdekat;
      section.scrollIntoView({ behavior: "smooth", block: "nearest" });

      var all      = getMitraClinics();
      var filtered = filterClinics(all, category);

      if (!filtered.length) {
        listEl.innerHTML = emptyHtml();
        noteEl.textContent = "";
        return;
      }

      /* Render cards — pass userLocation for distance chip.
         If geolocation hasn't resolved yet, re-render once it does. */
      function renderCards(loc) {
        listEl.innerHTML = filtered.map(function(c) {
          var originalIdx = all.indexOf(c);
          return cardHtml(c, originalIdx, loc);
        }).join("");
        noteEl.textContent = filtered.length + " klinik mitra terdaftar";
      }

      if (userLocation) {
        renderCards(userLocation);
      } else {
        /* Render immediately without distance, then re-render with distance once ready */
        renderCards(null);
        getUserLocation().then(function(loc) {
          userLocation = loc;
          if (loc && activeCategory === category) renderCards(loc);
        });
      }
    }

    for (var i = 0; i < cats.length; i++) {
      (function (btn) {
        btn.addEventListener("click", function (ev) {
          ev.preventDefault();
          show(btn.getAttribute("data-category"), btn);
        });
      })(cats[i]);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
