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
      var hewan = (c.hewanDilayani || "").toLowerCase();
      var tipe  = (c.tipeKlinik    || "").toLowerCase();
      /* "semua" artinya melayani semua jenis hewan */
      if (hewan === "semua") return true;
      return rx.test(hewan) || rx.test(tipe) || rx.test(c.namaKlinik || "");
    });
  }

  /* =================================================================
     Render
  ================================================================= */

  function cardHtml(c, idx) {
    /* Link to clinic detail page */
    var href = "clinic-detail.html?id=" + idx;

    /* Foto thumbnail — use uploaded photo or logo if available */
    var photoStyle = "";
    if (c.fotoDataUrl) {
      photoStyle = ' style="background-image:url(' + esc(c.fotoDataUrl) + ');"';
    } else if (c.logoDataUrl) {
      photoStyle = ' style="background-image:url(' + esc(c.logoDataUrl) + ');"';
    }

    /* Jam operasional */
    var jam = c.jamBuka && c.jamTutup ? esc(c.jamBuka) + "–" + esc(c.jamTutup) : "";

    /* WhatsApp chip */
    var waNum = (c.waKlinik || "").replace(/\D/g, "");

    return '' +
      '<a class="clinic-card" href="' + esc(href) + '">' +
        '<span class="clinic-texture" aria-hidden="true"></span>' +
        '<span class="clinic-photo"' + photoStyle + ' aria-hidden="true"></span>' +
        '<span class="clinic-body">' +
          '<span class="clinic-name">' + esc(c.namaKlinik || "Klinik Hewan") + '</span>' +
          '<span class="clinic-addr">' + esc([c.kota, c.provinsi].filter(Boolean).join(", ") || c.alamat || "") + '</span>' +
          '<span class="clinic-meta">' +
            (jam ? '<span class="clinic-chip">' +
              '<svg class="clinic-ico" viewBox="0 0 24 24" aria-hidden="true">' +
                '<path fill="#AC6600" d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm.5 10.8V7a.5.5 0 0 0-1 0v6.2l4.2 2.4a.5.5 0 1 0 .5-.87L12.5 12.8z"/>' +
              '</svg>' +
              '<span class="clinic-val">' + jam + '</span>' +
            '</span>' : '') +
            (waNum ? '<span class="clinic-chip">' +
              '<svg class="clinic-ico" viewBox="0 0 24 24" aria-hidden="true">' +
                '<path fill="#22C55E" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.168-.01-.357-.012-.549-.012-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>' +
              '</svg>' +
              '<span class="clinic-val">WhatsApp</span>' +
            '</span>' : '') +
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
      '<a href="mitra/index.html" class="clinic-empty-cta">Daftarkan Klinik →</a>' +
    '</div>';
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
      section.scrollIntoView({ behavior: "smooth", block: "nearest" });

      var all      = getMitraClinics();
      var filtered = filterClinics(all, category);

      if (!filtered.length) {
        listEl.innerHTML = emptyHtml();
        noteEl.textContent = all.length === 0
          ? "Belum ada klinik yang mendaftar sebagai mitra."
          : "Tidak ada klinik untuk kategori ini.";
        return;
      }

      /* Pass original index so clinic-detail.html?id= matches localStorage array position */
      listEl.innerHTML = filtered.map(function(c) {
        var originalIdx = all.indexOf(c);
        return cardHtml(c, originalIdx);
      }).join("");
      noteEl.textContent = filtered.length + " klinik mitra terdaftar";
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
