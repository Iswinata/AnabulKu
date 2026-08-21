/* ===================================================================
   AnabulKu — clinic-detail.js
   Reads clinic data from localStorage["mitraKlinik"] by ?id= param
   and renders: main clinic card, date-strip, doctor cards with
   schedule tags, time slots, and Pilih Layanan button.

   Booking dari user disimpan ke localStorage["anabulku_bookings"]
   agar muncul di dashboard klinik mitra.
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

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

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

  /* ── Load existing bookings from dashboard ── */
  function loadBookings() {
    try {
      var raw = localStorage.getItem("anabulku_bookings");
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  /* ── Save new booking from user ── */
  function saveBooking(booking) {
    try {
      var list = loadBookings();
      list.unshift(booking);
      localStorage.setItem("anabulku_bookings", JSON.stringify(list));
    } catch (e) { /* silent */ }
  }

  /* ── Get booked slots for a specific doctor & date ── */
  function getBookedSlots(dokterNama, tanggal) {
    var bookings = loadBookings();
    return bookings
      .filter(function(b) {
        return b.dokter === dokterNama &&
               b.tanggal === tanggal &&
               (b.status === "menunggu" || b.status === "dikonfirmasi");
      })
      .map(function(b) { return b.jam; });
  }

  /* ── Date strip — 7 days starting from today ── */
  var DAY_LETTERS_ID = ["M", "S", "S", "R", "K", "J", "S"]; // Min=0,Sen=1,...,Sab=6

  /* Active date state */
  var activeDate = new Date();
  var activeDateISO = activeDate.toISOString().slice(0, 10);

  function buildDateStrip(onDateChange) {
    var strip = $("cdDateStrip");
    if (!strip) return;

    var today = new Date();
    strip.innerHTML = "";

    for (var i = 0; i < 7; i++) {
      var d = new Date(today);
      d.setDate(today.getDate() + i);

      var dayOfWeek = d.getDay();
      var dayLetter = DAY_LETTERS_ID[dayOfWeek];
      var dayNum    = d.getDate();
      var isoDate   = d.toISOString().slice(0, 10);

      var btn = document.createElement("button");
      btn.className = "cd-day-btn" + (i === 0 ? " is-active" : "");
      btn.setAttribute("type", "button");
      btn.setAttribute("data-date", isoDate);
      btn.setAttribute("aria-label", d.toLocaleDateString("id-ID", {
        weekday: "long", day: "numeric", month: "long"
      }));
      btn.innerHTML =
        '<span class="cd-day-letter">' + dayLetter + '</span>' +
        '<span class="cd-day-num">' + dayNum + '</span>';

      strip.appendChild(btn);
    }

    /* Wire click on all buttons */
    var allBtns = strip.querySelectorAll(".cd-day-btn");
    allBtns.forEach(function(btn) {
      btn.addEventListener("click", function() {
        allBtns.forEach(function(b) { b.classList.remove("is-active"); });
        btn.classList.add("is-active");
        activeDateISO = btn.getAttribute("data-date");
        if (onDateChange) onDateChange(activeDateISO);
      });
    });
  }

  /* ── Generate time slots from doctor schedule ── */
  function generateSlots(jamMulai, jamSelesai) {
    /* Default slots if no schedule */
    if (!jamMulai || !jamSelesai) return ["09:00", "10:00", "13:00", "15:00", "16:00"];

    var slots = [];
    var start = parseInt(jamMulai.replace(":", ""), 10);
    var end   = parseInt(jamSelesai.replace(":", ""), 10);

    /* Generate every 60 min slot, skip 12:00-13:00 (lunch) */
    for (var t = start; t < end; t += 100) {
      /* Normalise: if minutes reach 60, roll over */
      var h = Math.floor(t / 100);
      var m = t % 100;
      if (m >= 60) { h++; m -= 60; t = h * 100 + m; }
      if (h >= 24) break;
      if (h === 12) continue; /* skip lunch */

      var hStr = String(h).padStart(2, "0");
      var mStr = String(m).padStart(2, "0");
      slots.push(hStr + ":" + mStr);
    }
    return slots.length ? slots : ["09:00", "10:00", "13:00", "15:00", "16:00"];
  }

  /* ── Booking form modal ── */
  var modalEl = null;

  function showBookingModal(clinic, doc, jam, tanggal) {
    /* Remove existing modal if any */
    if (modalEl) modalEl.remove();

    modalEl = document.createElement("div");
    modalEl.className = "cd-booking-modal-backdrop";
    modalEl.setAttribute("role", "dialog");
    modalEl.setAttribute("aria-modal", "true");
    modalEl.setAttribute("aria-labelledby", "cdModalTitle");
    modalEl.innerHTML =
      '<div class="cd-booking-modal">' +
        '<div class="cd-modal-header">' +
          '<h2 class="cd-modal-title" id="cdModalTitle">Booking Konsultasi</h2>' +
          '<button class="cd-modal-close" type="button" aria-label="Tutup">✕</button>' +
        '</div>' +
        '<div class="cd-modal-body">' +
          '<div class="cd-modal-info">' +
            '<p><strong>' + esc(clinic.namaKlinik) + '</strong></p>' +
            '<p>' + esc(doc.nama) + ' · ' + esc(tanggal) + ' pukul ' + esc(jam) + '</p>' +
          '</div>' +
          '<div class="cd-modal-field">' +
            '<label class="cd-modal-label" for="cdNamaPemilik">Nama Pemilik *</label>' +
            '<input class="cd-modal-input" type="text" id="cdNamaPemilik" placeholder="Nama lengkap Anda" />' +
          '</div>' +
          '<div class="cd-modal-field">' +
            '<label class="cd-modal-label" for="cdNoHP">No. WhatsApp *</label>' +
            '<input class="cd-modal-input" type="tel" id="cdNoHP" placeholder="08xxxxxxxxxx" inputmode="numeric" />' +
          '</div>' +
          '<div class="cd-modal-row">' +
            '<div class="cd-modal-field">' +
              '<label class="cd-modal-label" for="cdNamaHewan">Nama Hewan *</label>' +
              '<input class="cd-modal-input" type="text" id="cdNamaHewan" placeholder="Nama hewan peliharaan" />' +
            '</div>' +
            '<div class="cd-modal-field">' +
              '<label class="cd-modal-label" for="cdJenisHewan">Jenis Hewan *</label>' +
              '<select class="cd-modal-input" id="cdJenisHewan">' +
                '<option value="" disabled selected>Pilih jenis</option>' +
                '<option value="Kucing">Kucing</option>' +
                '<option value="Anjing">Anjing</option>' +
                '<option value="Kelinci">Kelinci</option>' +
                '<option value="Hamster">Hamster</option>' +
                '<option value="Burung">Burung</option>' +
                '<option value="Reptil">Reptil</option>' +
                '<option value="Lainnya">Lainnya</option>' +
              '</select>' +
            '</div>' +
          '</div>' +
          '<div class="cd-modal-field">' +
            '<label class="cd-modal-label" for="cdKeluhan">Keluhan / Catatan</label>' +
            '<textarea class="cd-modal-input" id="cdKeluhan" rows="2" placeholder="Gejala atau catatan tambahan"></textarea>' +
          '</div>' +
          '<p class="cd-modal-error" id="cdModalError" hidden></p>' +
        '</div>' +
        '<div class="cd-modal-footer">' +
          '<button class="cd-modal-btn-cancel" type="button">Batal</button>' +
          '<button class="cd-modal-btn-submit" type="button">Konfirmasi Booking</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modalEl);

    /* Close handlers */
    function closeModal() { if (modalEl) { modalEl.remove(); modalEl = null; } }
    modalEl.querySelector(".cd-modal-close").addEventListener("click", closeModal);
    modalEl.querySelector(".cd-modal-btn-cancel").addEventListener("click", closeModal);
    modalEl.addEventListener("click", function(e) { if (e.target === modalEl) closeModal(); });

    /* Submit */
    modalEl.querySelector(".cd-modal-btn-submit").addEventListener("click", function() {
      var namaPemilik = modalEl.querySelector("#cdNamaPemilik").value.trim();
      var noHP        = modalEl.querySelector("#cdNoHP").value.trim();
      var namaHewan   = modalEl.querySelector("#cdNamaHewan").value.trim();
      var jenisHewan  = modalEl.querySelector("#cdJenisHewan").value;
      var keluhan     = modalEl.querySelector("#cdKeluhan").value.trim();
      var errEl       = modalEl.querySelector("#cdModalError");

      if (!namaPemilik || !noHP || !namaHewan || !jenisHewan) {
        errEl.textContent = "Lengkapi semua field yang wajib diisi.";
        errEl.hidden = false;
        return;
      }

      var booking = {
        id:          uid(),
        tanggal:     tanggal,
        jam:         jam,
        namaPemilik: namaPemilik,
        noHP:        noHP,
        namaHewan:   namaHewan,
        jenisHewan:  jenisHewan,
        ras:         "",
        umur:        "",
        dokter:      doc.nama,
        keluhan:     keluhan,
        biaya:       clinic.hargaMulai || "",
        status:      "menunggu",
        sumber:      "app_user",
        namaKlinik:  clinic.namaKlinik || "",
        createdAt:   new Date().toISOString(),
      };

      saveBooking(booking);
      closeModal();
      showSuccessToast("Booking berhasil! Klinik akan mengkonfirmasi segera.");

      /* Re-render doctor section to mark slot as taken */
      buildDoctorCards(clinic, activeDateISO);
    });

    /* Focus first input */
    setTimeout(function() {
      var first = modalEl.querySelector("#cdNamaPemilik");
      if (first) first.focus();
    }, 50);
  }

  /* ── Success toast ── */
  function showSuccessToast(msg) {
    var t = document.createElement("div");
    t.className = "cd-toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function() { t.classList.add("cd-toast--visible"); }, 10);
    setTimeout(function() {
      t.classList.remove("cd-toast--visible");
      setTimeout(function() { t.remove(); }, 300);
    }, 3500);
  }

  /* ── Render doctor cards ── */
  function buildDoctorCards(clinic, dateISO) {
    var section = $("cdDoctors");
    if (!section) return;

    var dokters = clinic.dokters || [];

    /* Fallback: if dokters array empty, create placeholder from clinic owner */
    if (!dokters.length) {
      if (clinic.namaOwner) {
        dokters = [{
          nama:         "drh. " + clinic.namaOwner,
          spesialisasi: clinic.tipeKlinik || "Dokter Hewan",
          hari:         clinic.harisBuka  || "",
          jamMulai:     clinic.jamBuka    || "08:00",
          jamSelesai:   clinic.jamTutup   || "17:00",
        }];
      }
    }

    if (!dokters.length) {
      section.innerHTML = '<p class="cd-no-doctors">Informasi dokter belum tersedia.</p>';
      return;
    }

    var targetDate = dateISO || activeDateISO;

    section.innerHTML = dokters.map(function(doc) {
      /* Schedule tags */
      var hariArr = typeof doc.hari === "string"
        ? doc.hari.split(/[,\s]+/).filter(Boolean)
        : (Array.isArray(doc.hari) ? doc.hari : []);

      var dayTags = hariArr.map(function(h) {
        return '<span class="cd-day-tag">' + esc(h) + '</span>';
      }).join("");

      /* Generate time slots */
      var allSlots   = generateSlots(doc.jamMulai || clinic.jamBuka, doc.jamSelesai || clinic.jamTutup);
      var bookedSlots = getBookedSlots(doc.nama, targetDate);

      var slotsHtml = allSlots.map(function(t) {
        var isBooked = bookedSlots.indexOf(t) >= 0;
        var cls = isBooked ? "booked" : "available";
        var disabled = isBooked ? ' disabled aria-disabled="true"' : "";
        var label = isBooked ? t + " (penuh)" : t;
        return '<button class="cd-time-slot ' + cls + '" type="button"' + disabled +
               ' aria-label="' + esc(label) + '">' + esc(t) + '</button>';
      }).join("");

      /* Photo */
      var photoStyle = doc.fotoDataUrl
        ? ' style="background-image:url(' + esc(doc.fotoDataUrl) + ');"'
        : "";

      return '' +
        '<div class="cd-doc-card" role="article" aria-label="' + esc(doc.nama || "Dokter") + '" data-doc-nama="' + esc(doc.nama) + '">' +
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
            slotsHtml +
            '<button class="cd-pilih-btn" type="button">Pilih Layanan</button>' +
          '</div>' +
        '</div>';
    }).join("");

    /* Wire time slot selection */
    section.querySelectorAll(".cd-doc-card").forEach(function(card) {
      var slots = card.querySelectorAll(".cd-time-slot:not(.booked)");
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

    /* Wire "Pilih Layanan" buttons */
    section.querySelectorAll(".cd-pilih-btn").forEach(function(btn, i) {
      btn.addEventListener("click", function() {
        var doc = dokters[i] || {};
        var card = section.querySelectorAll(".cd-doc-card")[i];
        var selectedSlot = card ? card.querySelector(".cd-time-slot.selected") : null;

        if (!selectedSlot) {
          /* If no slot selected, try WhatsApp fallback */
          var waNum = (clinic.waKlinik || "").replace(/\D/g, "");
          if (waNum) {
            var msg = encodeURIComponent(
              "Halo, saya ingin memesan layanan di " + (clinic.namaKlinik || "klinik Anda") +
              (doc.nama ? " dengan " + doc.nama : "") + "."
            );
            window.open("https://wa.me/62" + waNum.replace(/^0/, "") + "?text=" + msg, "_blank", "noopener");
          } else {
            showSuccessToast("Pilih waktu konsultasi terlebih dahulu.");
          }
          return;
        }

        var jam = selectedSlot.textContent.trim();
        showBookingModal(clinic, doc, jam, activeDateISO);
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

    /* Distance — placeholder */
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

    /* Build date strip — re-render doctors on date change */
    buildDateStrip(function(newDate) {
      buildDoctorCards(clinic, newDate);
    });

    buildDoctorCards(clinic, activeDateISO);
  }

  /* ── Inject modal & toast styles ── */
  function injectStyles() {
    if (document.getElementById("cd-booking-styles")) return;
    var style = document.createElement("style");
    style.id = "cd-booking-styles";
    style.textContent = [
      /* Booked slot */
      ".cd-time-slot.booked{background:#F3F4F6!important;color:#9CA3AF!important;",
      "border-color:#E5E7EB!important;cursor:not-allowed!important;text-decoration:line-through;}",

      /* Modal backdrop */
      ".cd-booking-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.5);",
      "z-index:200;display:flex;align-items:flex-end;justify-content:center;",
      "padding:0;font-family:'Poppins',sans-serif;}",

      "@media(min-width:480px){.cd-booking-modal-backdrop{align-items:center;padding:20px;}}",

      /* Modal box */
      ".cd-booking-modal{background:#fff;border-radius:16px 16px 0 0;width:100%;max-width:480px;",
      "max-height:92vh;overflow-y:auto;box-shadow:0 -4px 40px rgba(0,0,0,.15);}",
      "@media(min-width:480px){.cd-booking-modal{border-radius:16px;max-height:90vh;}}",

      /* Modal header */
      ".cd-modal-header{display:flex;align-items:center;justify-content:space-between;",
      "padding:18px 20px 14px;border-bottom:1px solid #F3F4F6;}",
      ".cd-modal-title{font-size:17px;font-weight:800;color:#111827;}",
      ".cd-modal-close{width:28px;height:28px;border-radius:6px;background:#F3F4F6;",
      "color:#6B7280;font-size:13px;display:grid;place-items:center;border:none;cursor:pointer;}",

      /* Modal body */
      ".cd-modal-body{padding:16px 20px;display:flex;flex-direction:column;gap:12px;}",
      ".cd-modal-info{background:#FFF7ED;border-radius:8px;padding:10px 14px;font-size:13px;color:#374151;}",
      ".cd-modal-info p{margin:0;line-height:1.5;}",
      ".cd-modal-field{display:flex;flex-direction:column;gap:4px;}",
      ".cd-modal-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;}",
      ".cd-modal-label{font-size:13px;font-weight:600;color:#374151;}",
      ".cd-modal-input{width:100%;padding:9px 12px;border:1.5px solid #D1D5DB;border-radius:8px;",
      "font-family:inherit;font-size:14px;color:#1F2937;outline:none;",
      "transition:border-color .15s;-webkit-appearance:none;}",
      ".cd-modal-input:focus{border-color:#FF9800;}",
      "textarea.cd-modal-input{height:auto;resize:vertical;}",
      ".cd-modal-error{font-size:12px;color:#DC2626;background:#FEF2F2;",
      "border-radius:6px;padding:8px 12px;margin:0;}",

      /* Modal footer */
      ".cd-modal-footer{display:flex;gap:10px;justify-content:flex-end;",
      "padding:14px 20px 20px;border-top:1px solid #F3F4F6;}",
      ".cd-modal-btn-cancel{padding:10px 20px;border:1.5px solid #D1D5DB;border-radius:8px;",
      "font-family:inherit;font-size:14px;font-weight:600;color:#374151;background:#fff;cursor:pointer;}",
      ".cd-modal-btn-submit{padding:10px 24px;background:linear-gradient(90deg,#FF9800,#FFC46D);",
      "color:#fff;font-family:inherit;font-size:14px;font-weight:700;border:none;border-radius:8px;",
      "box-shadow:2px 2px 0 #000;cursor:pointer;transition:transform .1s,box-shadow .1s;}",
      ".cd-modal-btn-submit:hover{transform:translate(-1px,-1px);box-shadow:3px 3px 0 #000;}",

      /* Toast */
      ".cd-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(80px);",
      "background:#059669;color:#fff;font-family:'Poppins',sans-serif;font-size:14px;font-weight:500;",
      "padding:12px 24px;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.2);",
      "z-index:300;opacity:0;transition:transform .25s,opacity .25s;pointer-events:none;white-space:nowrap;}",
      ".cd-toast--visible{transform:translateX(-50%) translateY(0);opacity:1;}",
    ].join("");
    document.head.appendChild(style);
  }

  /* ── Init ── */
  function init() {
    injectStyles();
    var idx    = getClinicIndex();
    var clinic = loadClinic(idx);

    if (!clinic) {
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
