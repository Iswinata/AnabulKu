/* ===================================================================
   AnabulKu — clinic-detail.js
   Reads clinic data from localStorage["mitraKlinik"] by ?id= param
   and renders: main clinic card, date-strip, doctor cards with
   schedule tags, time slots, and Pilih Layanan button.
=================================================================== */

(function () {
  "use strict";

  /* ── Util ── */
  function esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function $(id) { return document.getElementById(id); }

  /* ── Get clinic index from URL ── */
  function getClinicIndex() {
    var params = new URLSearchParams(window.location.search);
    var id = parseInt(params.get("id"), 10);
    return isNaN(id) ? 0 : id;
  }

  /* ── Load clinic data from localStorage ── */
  function loadClinic(idx) {
    try {
      var raw = localStorage.getItem("mitraKlinik");
      var list = raw ? JSON.parse(raw) : [];
      return list[idx] || null;
    } catch (e) { return null; }
  }

  /* ── Date strip — 7 days starting from today ── */
  var DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"]; // Mon–Sun
  var DAY_LETTERS_ID = ["S", "M", "S", "R", "K", "J", "S"]; // Minggu–Sabtu (locale)

  function buildDateStrip(selectedDayIdx) {
    var strip = $("cdDateStrip");
    if (!strip) return;

    var today = new Date();
    strip.innerHTML = "";

    for (var i = 0; i < 7; i++) {
      var d = new Date(today);
      d.setDate(today.getDate() + i);

      var dayOfWeek = d.getDay(); // 0=Sun … 6=Sat
      var dayLetter = DAY_LETTERS_ID[dayOfWeek];
      var dayNum    = d.getDate();

      var btn = document.createElement("button");
      btn.className = "cd-day-btn" + (i === (selectedDayIdx || 0) ? " is-active" : "");
      btn.setAttribute("type", "button");
      btn.setAttribute("aria-label", d.toLocaleDateString("id-ID", { weekday:"long", day:"numeric", month:"long" }));
      btn.innerHTML =
        '<span class="cd-day-letter">' + dayLetter + '</span>' +
        '<span class="cd-day-num">' + dayNum + '</span>';

      btn.addEventListener("click", (function(idx, allBtns) {
        return function() {
          allBtns.forEach(function(b) { b.classList.remove("is-active"); });
          allBtns[idx].classList.add("is-active");
        };
      })(i, null)); // patch below after building

      strip.appendChild(btn);
    }

    /* Patch click handlers with live NodeList */
    var allBtns = strip.querySelectorAll(".cd-day-btn");
    allBtns.forEach(function(btn, i) {
      btn.addEventListener("click", function() {
        allBtns.forEach(function(b) { b.classList.remove("is-active"); });
        btn.classList.add("is-active");
      });
    });
  }

  /* ── Render doctor cards ── */
  function buildDoctorCards(clinic) {
    var section = $("cdDoctors");
    if (!section) return;

    var dokters = clinic.dokters || [];

    /* Fallback: if dokters array empty, show placeholder based on clinic name */
    if (!dokters.length) {
      /* Check if namaOwner exists to create a placeholder */
      if (clinic.namaOwner) {
        dokters = [{
          nama:        "drh. " + clinic.namaOwner,
          spesialisasi: clinic.tipeKlinik || "Dokter Hewan",
          hari:        clinic.harisBuka  || "",
        }];
      }
    }

    if (!dokters.length) {
      section.innerHTML = '<p class="cd-no-doctors">Informasi dokter belum tersedia.</p>';
      return;
    }

    /* Default time slots (can be extended per clinic in future) */
    var defaultSlots = ["10:00", "13:00", "15:00", "16:00"];

    section.innerHTML = dokters.map(function(doc, idx) {
      /* Parse hari string "Senin, Rabu, Jumat" → tags */
      var hariArr = (doc.hari || clinic.harisBuka || "").split(/[,\s]+/).filter(Boolean);
      var dayTags = hariArr.map(function(h) {
        return '<span class="cd-day-tag">' + esc(h) + '</span>';
      }).join("");

      /* Time slots */
      var slots = (doc.slots || defaultSlots).map(function(t, si) {
        var cls = si === 1 ? "selected" : "available"; /* 13:00 pre-selected as example */
        return '<button class="cd-time-slot ' + cls + '" type="button">' + esc(t) + '</button>';
      }).join("");

      /* Photo — use clinic foto or logo if uploaded */
      var photoStyle = "";
      if (doc.fotoDataUrl) {
        photoStyle = ' style="background-image:url(' + esc(doc.fotoDataUrl) + ');"';
      }

      return '' +
        '<div class="cd-doc-card" role="article" aria-label="' + esc(doc.nama || "Dokter") + '">' +
          '<div class="cd-doc-inner">' +
            '<div class="cd-doc-photo"' + photoStyle + ' aria-hidden="true"></div>' +
            '<div class="cd-doc-info">' +
              '<p class="cd-doc-name">' + esc(doc.nama || "Dokter Hewan") + '</p>' +
              '<p class="cd-doc-spec">' + esc(doc.spesialisasi || clinic.tipeKlinik || "Dokter Hewan") + '</p>' +
              '<p class="cd-doc-sched-label">Jadwal dokter :</p>' +
              '<div class="cd-doc-days">' + dayTags + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="cd-doc-divider" aria-hidden="true"></div>' +
          '<div class="cd-time-row">' +
            slots +
            '<button class="cd-pilih-btn" type="button">Pilih Layanan</button>' +
          '</div>' +
        '</div>';
    }).join("");

    /* Wire "Pilih Layanan" buttons */
    section.querySelectorAll(".cd-pilih-btn").forEach(function(btn, i) {
      btn.addEventListener("click", function() {
        var doc = dokters[i] || {};
        var waNum = (clinic.waKlinik || "").replace(/\D/g, "");
        if (waNum) {
          var msg = encodeURIComponent(
            "Halo, saya ingin memesan layanan di " + (clinic.namaKlinik || "klinik Anda") +
            (doc.nama ? " dengan " + doc.nama : "") + "."
          );
          window.open("https://wa.me/62" + waNum.replace(/^0/, "") + "?text=" + msg, "_blank", "noopener");
        } else {
          alert("Nomor WhatsApp klinik belum tersedia.");
        }
      });
    });

    /* Wire time slot selection */
    section.querySelectorAll(".cd-doc-card").forEach(function(card) {
      var slots = card.querySelectorAll(".cd-time-slot");
      slots.forEach(function(slot) {
        slot.addEventListener("click", function() {
          slots.forEach(function(s) {
            s.classList.remove("selected");
            s.classList.add("available");
          });
          slot.classList.remove("available");
          slot.classList.add("selected");
        });
      });
    });
  }

  /* ── Render main clinic card ── */
  function renderClinic(clinic) {
    /* Name */
    var nameEl = $("cdName");
    if (nameEl) nameEl.textContent = clinic.namaKlinik || "Klinik Hewan";

    /* Address */
    var addrEl = $("cdAddr");
    if (addrEl) {
      var parts = [clinic.alamat, clinic.kota, clinic.provinsi].filter(Boolean);
      addrEl.textContent = parts.join(", ") || "—";
    }

    /* Distance — placeholder (no GPS in this version) */
    var distEl = $("cdDist");
    if (distEl) distEl.textContent = "Mitra Terdaftar";

    /* Photo */
    var photoEl = $("cdPhoto");
    if (photoEl) {
      var imgSrc = clinic.fotoDataUrl || clinic.logoDataUrl || "";
      if (imgSrc) photoEl.style.backgroundImage = "url(" + imgSrc + ")";
    }

    /* Page title */
    document.title = (clinic.namaKlinik || "Klinik") + " — AnabulKu";

    buildDateStrip(0);
    buildDoctorCards(clinic);
  }

  /* ── Init ── */
  function init() {
    var idx    = getClinicIndex();
    var clinic = loadClinic(idx);

    if (!clinic) {
      /* No data — redirect back */
      document.body.innerHTML =
        '<div style="font-family:Poppins,sans-serif;padding:40px;text-align:center;color:#6B7280;">' +
        '<p>Data klinik tidak ditemukan.</p>' +
        '<a href="home.html" style="color:#ff9800;font-weight:600;">← Kembali ke Beranda</a>' +
        '</div>';
      return;
    }

    renderClinic(clinic);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
