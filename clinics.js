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
  var NEARBY_ENDPOINT = "https://places.googleapis.com/v1/places:searchNearby";
  var TEXT_ENDPOINT   = "https://places.googleapis.com/v1/places:searchText";

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
    "places.googleMapsUri",
    "places.types",
    "places.primaryType"
  ].join(",");

  /* Tipe tempat yang dianggap "klinik hewan" */
  var VET_TYPES = {
    veterinary_care: true,
    animal_hospital: true
  };

  /* Kata kunci cadangan bila Places tidak mengirim types */
  var VET_WORDS = /(klinik hewan|rumah sakit hewan|dokter hewan|vet|veterin|animal (clinic|hospital)|pet clinic|drh)/i;

  /* Kata kunci nama utk memprioritaskan klinik sesuai spesies.
     Klinik yang melayani semua hewan tetap ditampilkan, hanya urutannya
     yang dinaikkan bila namanya menyebut spesies terkait. */
  var SPECIES_WORDS = {
    kucing:  /(kucing|\bcat\b|cats|kitten|feline)/i,
    anjing:  /(anjing|\bdog\b|dogs|canine|puppy|\bk9\b)/i,
    reptile: /(reptil|reptile|eksotik|exotic|kura|turtle|ular|snake|iguana|gecko|tortoise)/i
  };

  /* Query pencarian per kategori (dipakai pada fallback Text Search) */
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
     Cache sederhana (localStorage, 10 menit) — hemat kuota API dan
     tetap menampilkan hasil walau kuota harian sempat sesekali habis.
  ================================================================= */
  var CACHE_TTL_MS = 10 * 60 * 1000;

  function cacheKey(category, center) {
    var la = center.lat.toFixed(2), ln = center.lng.toFixed(2);
    return "anabulku:clinics:" + category + ":" + la + "," + ln;
  }
  function cacheGet(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || (Date.now() - obj.t) > CACHE_TTL_MS) return null;
      return obj.items;
    } catch (e) { return null; }
  }
  function cacheSet(key, items) {
    try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), items: items })); }
    catch (e) { /* storage penuh / diblokir — abaikan */ }
  }

  /* Ubah satu objek "place" dari API menjadi bentuk kartu */
  function toItem(p, center, key) {
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
  }

  /* Hanya sisakan tempat yang benar-benar klinik hewan */
  function keepVet(p) {
    if (p.primaryType && VET_TYPES[p.primaryType]) return true;
    var t = p.types || [];
    for (var i = 0; i < t.length; i++) if (VET_TYPES[t[i]]) return true;
    if (t.length) return false;
    var nm = (p.displayName && p.displayName.text) || "";
    return VET_WORDS.test(nm);
  }

  /* Urutkan dari yang terdekat */
  function byDistance(items) {
    return items.slice().sort(function (a, b) {
      return (a.distanceKm == null ? 1e9 : a.distanceKm) -
             (b.distanceKm == null ? 1e9 : b.distanceKm);
    });
  }

  /* Apakah nama menyebut spesies LAIN (bukan kategori yang sedang dipilih)? */
  function mentionsOtherSpecies(name, category) {
    for (var k in SPECIES_WORDS) {
      if (k === category) continue;
      if (SPECIES_WORDS.hasOwnProperty(k) && SPECIES_WORDS[k].test(name)) return true;
    }
    return false;
  }

  /* Filter + urutkan sesuai kolom yang dipencet:
     • "terdekat" → semua klinik hewan, urut terdekat.
     • kucing / anjing / reptile:
         - klinik yang namanya menyebut spesies itu      → grup utama
         - klinik hewan UMUM (tak menyebut spesies apa pun,
           jadi melayani semua termasuk spesies ini)      → grup pelengkap
         - klinik KHUSUS spesies lain
           (mis. "Cat Clinic" saat mencari anjing)         → DIBUANG
       Urutan hasil: grup utama (terdekat) lalu pelengkap (terdekat). */
  function filterBySpecies(items, category) {
    var rx = SPECIES_WORDS[category];
    if (!rx) return byDistance(items);      /* kategori "terdekat" */

    var strong = [], general = [];
    for (var i = 0; i < items.length; i++) {
      var nm = items[i].name || "";
      if (rx.test(nm)) strong.push(items[i]);
      else if (!mentionsOtherSpecies(nm, category)) general.push(items[i]);
      /* selain itu: klinik khusus spesies lain → dibuang */
    }
    return byDistance(strong).concat(byDistance(general));
  }

  function postJson(url, body, key) {
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": FIELD_MASK
      },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error("Places " + res.status + ": " + t.slice(0, 160));
        });
      }
      return res.json();
    });
  }

  /* --------- Metode utama: Nearby Search (rank DISTANCE) ---------
     • locationRestriction CIRCLE didukung penuh di searchNearby
     • rankPreference DISTANCE → hasil sudah urut terdekat
     • includedTypes veterinary_care → dijamin hanya klinik hewan
     • kuota terpisah dari SearchText */
  function fetchNearby(center, key, radius) {
    var body = {
      includedTypes: ["veterinary_care"],
      maxResultCount: 20,                 /* ambil kolam besar utk difilter spesies */
      rankPreference: "DISTANCE",
      languageCode: CFG.LANGUAGE || "id",
      regionCode: CFG.REGION || "id",
      locationRestriction: {
        circle: {
          center: { latitude: center.lat, longitude: center.lng },
          radius: radius
        }
      }
    };
    return postJson(NEARBY_ENDPOINT, body, key).then(function (data) {
      return (data.places || []).filter(keepVet);
    });
  }

  /* --------- Cadangan: Text Search (kalau Nearby gagal) --------- */
  function fetchText(category, center, key) {
    var body = {
      textQuery: QUERIES[category] || QUERIES.terdekat,
      languageCode: CFG.LANGUAGE || "id",
      regionCode: CFG.REGION || "id",
      maxResultCount: CFG.MAX_RESULTS || 8,
      includedType: "veterinary_care",
      locationBias: {
        circle: {
          center: { latitude: center.lat, longitude: center.lng },
          radius: CFG.SEARCH_RADIUS_M || 10000
        }
      }
    };
    return postJson(TEXT_ENDPOINT, body, key).then(function (data) {
      return (data.places || []).filter(keepVet);
    });
  }

  /* Jangkauan bertahap: mulai dari radius awal (config), lalu diperlebar
     3x sampai maksimal 50 km (batas Nearby Search). Dengan begini klinik
     tetap ketemu di kota padat MAUPUN daerah yang jarang klinik —
     "sesuai lokasi mana pun user membuka". */
  function radiusSteps() {
    var start = Math.max(1000, CFG.SEARCH_RADIUS_M || 8000);
    var steps = [], r = start;
    while (r < 50000) { steps.push(r); r *= 3; }
    steps.push(50000);
    return steps.filter(function (v, i, a) { return a.indexOf(v) === i; });
  }

  /* =================================================================
     Ambil data klinik:
       cache → Nearby (radius bertahap, filter spesies) → Text → contoh
  ================================================================= */
  function fetchClinics(category, center) {
    var key = CFG.GOOGLE_MAPS_API_KEY;
    var max = CFG.MAX_RESULTS || 8;

    if (!key) {
      return Promise.resolve({
        items: filterBySpecies(MOCK_CLINICS.slice(), category).slice(0, max),
        mock: true, source: "mock"
      });
    }

    var ck = cacheKey(category, center);
    var cached = cacheGet(ck);
    if (cached) return Promise.resolve({ items: cached, mock: false, source: "cache" });

    function toItems(places) {
      return places.map(function (p) { return toItem(p, center, key); });
    }

    function finalize(items, source, radius) {
      items = items.slice(0, max);
      if (items.length) cacheSet(ck, items);
      var rx = SPECIES_WORDS[category];
      var specific = rx ? items.filter(function (c) { return rx.test(c.name); }).length : 0;
      return {
        items: items, mock: false, source: source,
        radiusKm: Math.round(radius / 1000), specific: specific
      };
    }

    var steps = radiusSteps();

    /* Coba tiap radius sampai dapat hasil (setelah difilter spesies) */
    function tryStep(i) {
      if (i >= steps.length) {
        /* semua radius kosong → Text Search sebagai cadangan terakhir */
        return fetchText(category, center, key).then(function (places) {
          return finalize(filterBySpecies(toItems(places), category), "text",
                          steps[steps.length - 1]);
        });
      }
      return fetchNearby(center, key, steps[i]).then(function (places) {
        var items = filterBySpecies(toItems(places), category);
        if (items.length) return finalize(items, "nearby", steps[i]);
        return tryStep(i + 1);        /* perluas jangkauan */
      });
    }

    return tryStep(0).catch(function (err) {
      console.warn("[AnabulKu] Nearby gagal:", err.message);
      /* error (mis. kuota harian Nearby) → fallback Text Search */
      return fetchText(category, center, key).then(function (places) {
        return finalize(filterBySpecies(toItems(places), category), "text",
                        steps[steps.length - 1]);
      });
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
          if (res.mock) {
            noteEl.textContent = "Data contoh — isi GOOGLE_MAPS_API_KEY di config.js untuk data Google Maps asli.";
          } else if (res.source === "cache") {
            noteEl.textContent = "Sumber data: Google Maps (tersimpan sementara)";
          } else {
            var t = "Google Maps — " + res.items.length + " klinik, radius " + res.radiusKm + " km";
            if (category !== "terdekat" && !res.specific) {
              t += " (klinik umum yang juga melayani " + category + ")";
            }
            noteEl.textContent = t;
          }
        })
        .catch(function (err) {
          console.error("[AnabulKu]", err);
          listEl.innerHTML = mockWithDistance().map(cardHtml).join("");
          noteEl.textContent = "Gagal memuat data Google Maps (" +
            String(err.message || err).slice(0, 120) +
            ") — menampilkan data contoh.";
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


