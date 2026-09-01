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

  /* ── Favorit helpers ── */
  var LS_FAV = 'anabulku_favorit';
  function getFavIds() {
    try { return JSON.parse(localStorage.getItem(LS_FAV)) || []; } catch(e) { return []; }
  }
  function toggleFav(idx) {
    var ids = getFavIds();
    var pos = ids.indexOf(idx);
    if (pos === -1) { ids.push(idx); } else { ids.splice(pos, 1); }
    try { localStorage.setItem(LS_FAV, JSON.stringify(ids)); } catch(e) {}
    return ids.indexOf(idx) !== -1;
  }

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

  /* Hanya tampilkan klinik yang sudah disetujui admin (adminStatus === 'aktif') */
  function getApprovedClinics() {
    return getMitraClinics().filter(function(c) { return c.adminStatus === 'aktif'; });
  }

  /* Saring klinik berdasarkan kategori yang dipilih */
  function filterClinics(clinics, category) {
    if (category === "terdekat") return clinics; /* tampilkan semua */

    var rx = FILTER[category];
    if (!rx) return clinics;

    return clinics.filter(function (c) {
      /* hewanDilayani bisa berupa array (format baru) atau string (format lama) */
      if (Array.isArray(c.hewanDilayani) && c.hewanDilayani.length > 0) {
        return c.hewanDilayani.some(function (h) { return rx.test(h); });
      }

      /* format lama: string tunggal */
      var hewan = (c.hewanDilayani || "").toLowerCase();
      if (hewan === "semua") return true;

      /* fallback ke tipeKlinik (bisa array atau string) dan nama klinik */
      var tipeStr = Array.isArray(c.tipeKlinik)
        ? c.tipeKlinik.join(" ").toLowerCase()
        : (c.tipeKlinik || "").toLowerCase();

      return rx.test(hewan) || rx.test(tipeStr) || rx.test(c.namaKlinik || "");
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
    var _foto = c.fotoDataUrl || c.logoDataUrl || "";
    if (_foto) {
      /* Jangan esc() data URL — base64 tidak perlu di-escape dan esc() akan merusak karakter quote */
      photoStyle = ' style="background-image:url(\'' + _foto + '\');"';
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

    var isFav = getFavIds().indexOf(idx) !== -1;
    var favFill   = isFav ? 'url(#favGrad)' : 'none';
    var favStroke = isFav ? '#c0392b' : '#9ca3af';
    var favLabel  = isFav ? 'Hapus dari favorit' : 'Tambah ke favorit';

    return '' +
      '<svg style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">' +
        '<defs><linearGradient id="favGrad" x1="0%" y1="0%" x2="100%" y2="100%">' +
          '<stop offset="0%" stop-color="#FF5252"/>' +
          '<stop offset="100%" stop-color="#C62828"/>' +
        '</linearGradient></defs>' +
      '</svg>' +
      '<div class="clinic-card-wrap">' +
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
        '</a>' +
        '<button class="clinic-fav-btn' + (isFav ? ' is-fav' : '') + '" type="button" data-fav-idx="' + idx + '" aria-label="' + favLabel + '" aria-pressed="' + isFav + '">' +
          '<svg viewBox="0 0 24 24" fill="' + favFill + '" stroke="' + favStroke + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>' +
          '</svg>' +
        '</button>' +
      '</div>';
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

      /* Build list of {clinic, originalIdx} for approved clinics only.
         We keep the original index from the full mitraKlinik array so that
         clinic-detail.js (which reads the same full array) gets the right entry. */
      var fullList = getMitraClinics();
      var approvedWithIdx = [];
      for (var j = 0; j < fullList.length; j++) {
        if (fullList[j].adminStatus === 'aktif') {
          approvedWithIdx.push({ clinic: fullList[j], idx: j });
        }
      }

      /* Filter by category */
      var rx = FILTER[category];
      var filteredWithIdx = category === 'terdekat' ? approvedWithIdx : approvedWithIdx.filter(function(entry) {
        var c = entry.clinic;
        if (!rx) return true;

        /* hewanDilayani array (format baru dari daftar.js) */
        if (Array.isArray(c.hewanDilayani) && c.hewanDilayani.length > 0) {
          return c.hewanDilayani.some(function(h) { return rx.test(h); });
        }

        /* format lama: string */
        var hewan = (c.hewanDilayani || '').toLowerCase();
        if (hewan === 'semua') return true;

        var tipeStr = Array.isArray(c.tipeKlinik)
          ? c.tipeKlinik.join(' ').toLowerCase()
          : (c.tipeKlinik || '').toLowerCase();

        return rx.test(hewan) || rx.test(tipeStr) || rx.test(c.namaKlinik || '');
      });

      if (!filteredWithIdx.length) {
        listEl.innerHTML = emptyHtml();
        noteEl.textContent = "";
        return;
      }

      /* Render cards — pass userLocation for distance chip.
         If geolocation hasn't resolved yet, re-render once it does. */
      function renderCards(loc) {
        listEl.innerHTML = filteredWithIdx.map(function(entry) {
          return cardHtml(entry.clinic, entry.idx, loc);
        }).join("");
        noteEl.textContent = "";

        /* Bind tombol favorit */
        listEl.querySelectorAll('[data-fav-idx]').forEach(function(btn) {
          btn.addEventListener('click', function(e) {
            e.preventDefault(); e.stopPropagation();
            var idx   = parseInt(btn.getAttribute('data-fav-idx'), 10);
            var isNow = toggleFav(idx);
            var svg   = btn.querySelector('svg');
            if (svg) {
              svg.setAttribute('fill',   isNow ? 'url(#favGrad)' : 'none');
              svg.setAttribute('stroke', isNow ? '#c0392b' : '#9ca3af');
            }
            /* Inject gradient def sekali saja */
            if (isNow && !document.getElementById('favGradDef')) {
              var svgDef = document.createElementNS('http://www.w3.org/2000/svg','svg');
              svgDef.setAttribute('id','favGradDef');
              svgDef.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';
              svgDef.innerHTML =
                '<defs><linearGradient id="favGrad" x1="0%" y1="0%" x2="100%" y2="100%">' +
                  '<stop offset="0%" stop-color="#FF5252"/>' +
                  '<stop offset="100%" stop-color="#C62828"/>' +
                '</linearGradient></defs>';
              document.body.appendChild(svgDef);
            }
            btn.setAttribute('aria-pressed', String(isNow));
            btn.setAttribute('aria-label', isNow ? 'Hapus dari favorit' : 'Tambah ke favorit');
            btn.classList.toggle('is-fav', isNow);
            /* Animasi pop */
            btn.style.transform = 'scale(1.3)';
            setTimeout(function(){ btn.style.transform = ''; }, 180);
          });
        });
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

  /* =================================================================
     Grooming Controller — helper vars & functions
  ================================================================= */

  var GROOMING_LABELS = { kucing: "Grooming Kucing", anjing: "Grooming Anjing" };
  var GROOMING_FILTER = {
    kucing: /(kucing|cat|feline|kitten)/i,
    anjing: /(anjing|dog|canine|puppy)/i
  };

  function groomingEmptyHtml() {
    return '<div class="clinic-empty">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="48" height="48" aria-hidden="true">' +
        '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>' +
        '<polyline points="9 22 9 12 15 12 15 22"/>' +
      '</svg>' +
      '<p>Belum ada grooming terdaftar untuk kategori ini.</p>' +
    '</div>';
  }

  function groomingCardHtml(clinic, idx, userLoc) {
    var href = "clinic-detail.html?id=" + idx;

    var photoStyle = "";
    var _foto = clinic.fotoDataUrl || clinic.logoDataUrl || "";
    if (_foto) {
      photoStyle = ' style="background-image:url(\'' + _foto + '\');"';
    }

    var alamat = esc(clinic.formattedAddress || clinic.alamat || [clinic.kota, clinic.provinsi].filter(Boolean).join(", ") || "");

    var rawRating = clinic.googleRating != null && clinic.googleRating !== "" ? clinic.googleRating
                  : clinic.rating != null ? clinic.rating : null;
    var rating = rawRating != null ? parseFloat(rawRating).toFixed(1) : "5.0";
    var ratingChip =
      '<span class="clinic-chip clinic-chip--rating" aria-label="Rating ' + esc(rating) + '">' +
        '<svg class="clinic-ico" viewBox="0 0 24 24" fill="#FF9800" aria-hidden="true">' +
          '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>' +
        '</svg>' +
        '<span class="clinic-val">' + esc(rating) + '</span>' +
      '</span>';

    var distChip = "";
    var cLat = parseFloat(clinic.lat);
    var cLng = parseFloat(clinic.lng);
    if (userLoc && !isNaN(cLat) && !isNaN(cLng)) {
      var R = 6371;
      var dLat = (cLat - userLoc.lat) * Math.PI / 180;
      var dLng = (cLng - userLoc.lng) * Math.PI / 180;
      var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(userLoc.lat * Math.PI / 180) * Math.cos(cLat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
      var km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      var distLabel = km < 1 ? Math.round(km * 1000) + " m" : km.toFixed(1) + " km";
      distChip =
        '<span class="clinic-chip clinic-chip--dist" aria-label="Jarak ' + esc(distLabel) + '">' +
          '<svg class="clinic-ico" viewBox="0 0 24 24" fill="none" stroke="#FF9800" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>' +
          '</svg>' +
          '<span class="clinic-val">' + esc(distLabel) + '</span>' +
        '</span>';
    }

    var isFav     = getFavIds().indexOf(idx) !== -1;
    var favFill   = isFav ? 'url(#favGrad)' : 'none';
    var favStroke = isFav ? '#c0392b' : '#9ca3af';
    var favLabel  = isFav ? 'Hapus dari favorit' : 'Tambah ke favorit';

    return '' +
      '<svg style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">' +
        '<defs><linearGradient id="favGrad" x1="0%" y1="0%" x2="100%" y2="100%">' +
          '<stop offset="0%" stop-color="#FF5252"/>' +
          '<stop offset="100%" stop-color="#C62828"/>' +
        '</linearGradient></defs>' +
      '</svg>' +
      '<div class="clinic-card-wrap">' +
        '<a class="clinic-card" href="' + esc(href) + '">' +
          '<span class="clinic-texture" aria-hidden="true"></span>' +
          '<span class="clinic-photo"' + photoStyle + ' aria-hidden="true"></span>' +
          '<span class="clinic-body">' +
            '<span class="clinic-name">' + esc(clinic.namaKlinik || "Grooming Hewan") + '</span>' +
            (alamat ? '<span class="clinic-addr">' + alamat + '</span>' : '') +
            '<span class="clinic-meta">' +
              ratingChip +
              (distChip ? distChip : '') +
            '</span>' +
          '</span>' +
        '</a>' +
        '<button class="clinic-fav-btn' + (isFav ? ' is-fav' : '') + '" type="button" data-fav-idx="' + idx + '" aria-label="' + favLabel + '" aria-pressed="' + isFav + '">' +
          '<svg viewBox="0 0 24 24" fill="' + favFill + '" stroke="' + favStroke + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>' +
          '</svg>' +
        '</button>' +
      '</div>';
  }

  function initGrooming() {
    var section = document.getElementById("grooming-results");
    if (!section) return;
    var titleEl = document.getElementById("grooming-results-title");
    var listEl  = document.getElementById("grooming-list");
    var noteEl  = document.getElementById("grooming-note");
    var gCards  = document.querySelectorAll(".g-card[data-grooming]");
    var activeGrooming = null;

    function showGrooming(category, btn) {
      if (activeGrooming === category) {
        section.hidden = true;
        activeGrooming = null;
        gCards.forEach(function(c) { c.classList.remove("is-active"); });
        return;
      }
      activeGrooming = category;
      gCards.forEach(function(c) { c.classList.remove("is-active"); });
      if (btn) btn.classList.add("is-active");
      section.hidden = false;
      if (titleEl) titleEl.textContent = GROOMING_LABELS[category] || "Grooming";
      section.scrollIntoView({ behavior: "smooth", block: "nearest" });

      var fullList = getMitraClinics();
      var approved = [];
      for (var j = 0; j < fullList.length; j++) {
        var m = fullList[j];
        if (m.adminStatus !== 'aktif') continue;
        var tipe = Array.isArray(m.tipeKlinik) ? m.tipeKlinik : [];
        if (tipe.indexOf('grooming_hewan') === -1) continue;
        approved.push({ clinic: m, idx: j });
      }

      var rx = GROOMING_FILTER[category];
      var filtered = approved.filter(function(entry) {
        var c = entry.clinic;
        if (Array.isArray(c.hewanDilayani) && c.hewanDilayani.length) {
          return c.hewanDilayani.some(function(h) { return rx.test(h); });
        }
        var hewan = (c.hewanDilayani || '').toLowerCase();
        if (hewan === 'semua') return true;
        return rx.test(hewan) || rx.test(c.namaKlinik || '');
      });

      if (!filtered.length) {
        if (listEl) listEl.innerHTML = groomingEmptyHtml();
        if (noteEl) noteEl.textContent = "";
        return;
      }

      if (listEl) {
        var renderGroomingCards = function(userLoc) {
          listEl.innerHTML = filtered.map(function(entry) {
            return groomingCardHtml(entry.clinic, entry.idx, userLoc);
          }).join("");
          if (noteEl) noteEl.textContent = filtered.length + " mitra grooming terdaftar";

          listEl.querySelectorAll('[data-fav-idx]').forEach(function(fbtn) {
            fbtn.addEventListener('click', function(e) {
              e.preventDefault(); e.stopPropagation();
              var fi    = parseInt(fbtn.getAttribute('data-fav-idx'), 10);
              var isNow = toggleFav(fi);
              var svg   = fbtn.querySelector('svg');
              if (svg) {
                svg.setAttribute('fill',   isNow ? 'url(#favGrad)' : 'none');
                svg.setAttribute('stroke', isNow ? '#c0392b' : '#9ca3af');
              }
            });
          });
        };

        renderGroomingCards(null);
        getUserLocation().then(function(loc) {
          if (loc && activeGrooming === category) renderGroomingCards(loc);
        });
      }
    }

    gCards.forEach(function(card) {
      card.addEventListener("click", function(ev) {
        ev.preventDefault();
        showGrooming(card.getAttribute("data-grooming"), card);
      });
    });
  }

  window._anabulkuInitGrooming = initGrooming;

})();
