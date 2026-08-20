/* ===================================================================
   AnabulKu — Pencarian klinik hewan terdekat (Google Places API)
   -------------------------------------------------------------------
   Alur:
   1. Pengguna menekan salah satu kategori (Kucing / Anjing / Reptile /
      Terdekat) di halaman home.
   2. Ambil posisi pengguna via Geolocation API (fallback: config).
   3. Panggil Places API (New) "searchText" untuk klinik hewan sekitar.
   4. Hitung jarak (Haversine), render kartu sesuai spec Figma.

   Tanpa API key → otomatis pakai data contoh (MOCK_CLINICS).
=================================================================== */

(function () {
  "use strict";

  var CFG = window.ANABULKU_CONFIG || {};
  var PLACES_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

  /* Field yang diminta ke Places API — mempengaruhi biaya, ambil seperlunya */
  var FIELD_MASK = [
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.shortFormattedAddress",
    "places.rating",
    "places.userRatingCount",
    "places.location",
    "places.photos",
    "places.googleMapsUri"
  ].join(",");

  /* Query pencarian per kategori */
  var QUERIES = {
    kucing:   "klinik hewan kucing",
    anjing:   "klinik hewan anjing",
    reptile:  "klinik hewan reptil eksotik",
    terdekat: "klinik hewan"
  };

  var LABELS = {
    kucing:   "Klinik Kucing Terdekat",
    anjing:   "Klinik Anjing Terdekat",
    reptile:  "Klinik Reptile Terdekat",
    terdekat: "Klinik Terdekat"
  };

  /* ---------- Data contoh (dipakai bila API key kosong / gagal) ---------- */
  var MOCK_CLINICS = [
    {
      name: "PawCare Veterinary Clinic",
      address: "Jl. Soekarno Hatta No. 88, Lowokwaru, Malang",
      rating: 4.6,
      distanceKm: 3.4,
      photo: "",
      mapsUri: "https://www.google.com/maps/search/klinik+hewan"
    },
    {
      name: "Klinik Hewan Sahabat Satwa",
      address: "Jl. Bendungan Sutami No. 12, Sumbersari, Malang",
      rating: 4.8,
      distanceKm: 1.9,
      photo: "",
      mapsUri: "https://www.google.com/maps/search/klinik+hewan"
    },
    {
      name: "Vet Care Malang",
      address: "Jl. Bandung No. 5, Penanggungan, Malang",
      rating: 4.4,
      distanceKm: 5.2,
      photo: "",
      mapsUri: "https://www.google.com/maps/search/klinik+hewan"
    }
  ];

  /* =================================================================
     Util
  ================================================================= */

  function $(sel, root) { return (root || document).querySelector(sel); }

  function esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* Jarak garis lurus antar dua koordinat, dalam km (Haversine) */
  function distanceKm(a, b) {
    var R = 6371;
    var dLat = (b.lat - a.lat) * Math.PI / 180;
    var dLng = (b.lng - a.lng) * Math.PI / 180;
    var la1 = a.lat * Math.PI / 180;
    var la2 = b.lat * Math.PI / 180;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(la1) * Math.cos(la2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function fmtKm(km) {
    if (km == null) return "-";
    return (km < 10 ? km.toFixed(1) : Math.round(km)) + "km";
  }

  function fmtRating(r) {
    if (r == null) return "-";
    return r.toFixed(1).replace(".", ",");
  }

  /* Posisi pengguna; SELALU resolve.
     Ada watchdog karena di sebagian browser (mis. dibuka via file://)
     getCurrentPosition bisa tidak memanggil callback sama sekali. */
  function getUserLocation() {
    var fallback = CFG.FALLBACK_CENTER || { lat: -7.9666, lng: 112.6326 };

    return new Promise(function (resolve) {
      var done = false;
      function finish(coords) {
        if (done) return;
        done = true;
        resolve(coords);
      }

      setTimeout(function () { finish(fallback); }, 9000);   /* watchdog */

      if (!navigator.geolocation) return finish(fallback);

      try {
        navigator.geolocation.getCurrentPosition(
          function (pos) {
            finish({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          },
          function () { finish(fallback); },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
        );
      } catch (e) {
        finish(fallback);
      }
    });
  }

  /* URL foto Places (New). Butuh API key. */
  function photoUrl(place, key) {
    if (!key || !place.photos || !place.photos.length) return "";
    return "https://places.googleapis.com/v1/" + place.photos[0].name +
           "/media?maxHeightPx=400&maxWidthPx=400&key=" + encodeURIComponent(key);
  }

  /* =================================================================
     Ambil data dari Google Places API (New)
  ================================================================= */
  function fetchClinics(category, center) {
    var key = CFG.GOOGLE_MAPS_API_KEY;

    /* Tanpa key → data contoh */
    if (!key) return Promise.resolve({ items: mockWithDistance(), mock: true });

    var body = {
      textQuery: QUERIES[category] || QUERIES.terdekat,
      languageCode: CFG.LANGUAGE || "id",
      regionCode: CFG.REGION || "id",
      maxResultCount: CFG.MAX_RESULTS || 8,
      locationBias: {
        circle: {
          center: { latitude: center.lat, longitude: center.lng },
          radius: CFG.SEARCH_RADIUS_M || 10000
        }
      }
    };

    return fetch(PLACES_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": FIELD_MASK
      },
      body: JSON.stringify(body)
    })
      .then(function (res) {
        if (!res.ok) throw new Error("Places API " + res.status);
        return res.json();
      })
      .then(function (data) {
        var places = data.places || [];
        var items = places.map(function (p) {
          var loc = p.location
            ? { lat: p.location.latitude, lng: p.location.longitude }
            : null;
          return {
            name: (p.displayName && p.displayName.text) || "Klinik Hewan",
            address: p.shortFormattedAddress || p.formattedAddress || "",
            rating: typeof p.rating === "number" ? p.rating : null,
            ratingCount: p.userRatingCount || 0,
            distanceKm: loc ? distanceKm(center, loc) : null,
            photo: photoUrl(p, key),
            mapsUri: p.googleMapsUri || ""
          };
        });

        items.sort(function (a, b) {
          return (a.distanceKm == null ? 1e9 : a.distanceKm) -
                 (b.distanceKm == null ? 1e9 : b.distanceKm);
        });

        return { items: items, mock: false };
      });
  }

  function mockWithDistance() {
    return MOCK_CLINICS.slice().sort(function (a, b) {
      return a.distanceKm - b.distanceKm;
    });
  }

  /* =================================================================
     Render
  ================================================================= */

  function cardHtml(c) {
    var href = c.mapsUri || "#";
    var photoStyle = c.photo ? ' style="background-image:url(\'' + esc(c.photo) + '\')"' : "";

    return '' +
      '<a class="clinic-card" href="' + esc(href) + '" target="_blank" rel="noopener">' +
        '<span class="clinic-texture" aria-hidden="true"></span>' +
        '<span class="clinic-photo"' + photoStyle + ' aria-hidden="true"></span>' +
        '<span class="clinic-body">' +
          '<span class="clinic-name">' + esc(c.name) + '</span>' +
          '<span class="clinic-addr">' + esc(c.address) + '</span>' +
          '<span class="clinic-meta">' +
            '<span class="clinic-chip">' +
              '<svg class="clinic-ico" viewBox="0 0 24 24" aria-hidden="true">' +
                '<path fill="#AC6600" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/>' +
              '</svg>' +
              '<span class="clinic-val">' + esc(fmtKm(c.distanceKm)) + '</span>' +
            '</span>' +
            '<span class="clinic-chip">' +
              '<svg class="clinic-ico" viewBox="0 0 24 24" aria-hidden="true">' +
                '<path fill="#AC6600" d="M12 2.6l2.9 5.88 6.5.95-4.7 4.58 1.11 6.47L12 17.43l-5.81 3.05 1.11-6.47L2.6 9.43l6.5-.95L12 2.6z"/>' +
              '</svg>' +
              '<span class="clinic-val">' + esc(fmtRating(c.rating)) + '</span>' +
            '</span>' +
          '</span>' +
        '</span>' +
      '</a>';
  }

  function skeletonHtml() {
    var one = '<span class="clinic-card is-skeleton" aria-hidden="true">' +
                '<span class="clinic-photo"></span>' +
                '<span class="clinic-body">' +
                  '<span class="sk sk-name"></span>' +
                  '<span class="sk sk-addr"></span>' +
                  '<span class="sk sk-meta"></span>' +
                '</span>' +
              '</span>';
    return one + one;
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
      listEl.innerHTML = skeletonHtml();
      noteEl.textContent = "Mencari lokasi kamu…";
      section.scrollIntoView({ behavior: "smooth", block: "nearest" });

      getUserLocation()
        .then(function (center) {
          noteEl.textContent = "Memuat klinik terdekat…";
          return fetchClinics(category, center);
        })
        .then(function (res) {
          if (!res.items.length) {
            listEl.innerHTML = "";
            noteEl.textContent = "Tidak ada klinik ditemukan di sekitarmu.";
            return;
          }
          listEl.innerHTML = res.items.map(cardHtml).join("");
          noteEl.textContent = res.mock
            ? "Data contoh — isi GOOGLE_MAPS_API_KEY di config.js untuk data Google Maps asli."
            : "Sumber data: Google Maps";
        })
        .catch(function (err) {
          console.error(err);
          listEl.innerHTML = mockWithDistance().map(cardHtml).join("");
          noteEl.textContent = "Gagal memuat data Google Maps — menampilkan data contoh.";
        });
    }

    if (!cats.length) {
      console.warn("[AnabulKu] Tidak ada tombol .cat[data-category] — cek home.html.");
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

  /* Script dimuat di akhir <body>, jadi DOM bisa saja sudah siap */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();


