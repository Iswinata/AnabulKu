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

  /* Convert a local Date to YYYY-MM-DD in local timezone (not UTC) */
  function localISODate(d) {
    var y  = d.getFullYear();
    var mo = String(d.getMonth() + 1).padStart("2", "0");
    var da = String(d.getDate()).padStart("2", "0");
    return y + "-" + mo + "-" + da;
  }

  /* Active date state — use local date so UTC offset doesn't shift the day */
  var activeDateISO = localISODate(new Date());

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
      var isoDate   = localISODate(d);

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

  /* ── Generate time slots from a single time range ── */
  function generateSlotsFromRange(jamMulai, jamSelesai) {
    if (!jamMulai || !jamSelesai) return [];

    var slots = [];
    var start = parseInt(jamMulai.replace(":", ""), 10);
    var end   = parseInt(jamSelesai.replace(":", ""), 10);

    for (var t = start; t < end; t += 100) {
      var h = Math.floor(t / 100);
      var m = t % 100;
      if (m >= 60) { h++; m -= 60; t = h * 100 + m; }
      if (h >= 24) break;

      var hStr = String(h).padStart(2, "0");
      var mStr = String(m).padStart(2, "0");
      slots.push(hStr + ":" + mStr);
    }
    return slots;
  }

  /* ── Get time slots per-sesi untuk satu hari ──
     Return array of sessions, tiap sesi = {label, slots:[]}
     Mendukung format baru (doc.jadwal) dan format lama (doc.hari + jamMulai/jamSelesai) */
  function getDoctorSessionSlots(doc, dayName, clinicJamBuka, clinicJamTutup) {
    /* Format baru: jadwal = [{hari, mulai, selesai, sessions:[{mulai,selesai}]}] */
    if (Array.isArray(doc.jadwal) && doc.jadwal.length) {
      var dayEntry = null;
      for (var i = 0; i < doc.jadwal.length; i++) {
        if (doc.jadwal[i].hari === dayName) { dayEntry = doc.jadwal[i]; break; }
      }
      if (dayEntry) {
        var sessions = Array.isArray(dayEntry.sessions) && dayEntry.sessions.length
          ? dayEntry.sessions
          : [{ mulai: dayEntry.mulai || "08:00", selesai: dayEntry.selesai || "17:00" }];

        return sessions.map(function(s) {
          return {
            label: s.mulai + "–" + s.selesai,
            slots: generateSlotsFromRange(s.mulai, s.selesai),
          };
        }).filter(function(s) { return s.slots.length > 0; });
      }
    }

    /* Format lama: satu sesi dari jamMulai/jamSelesai */
    var jamMulai   = doc.jamMulai   || clinicJamBuka;
    var jamSelesai = doc.jamSelesai || clinicJamTutup;
    var slots = generateSlotsFromRange(jamMulai, jamSelesai);
    if (!slots.length) slots = ["09:00", "10:00", "13:00", "15:00", "16:00"];
    var label = (jamMulai && jamSelesai) ? jamMulai + "–" + jamSelesai : "Sesi";
    return [{ label: label, slots: slots }];
  }

  /* Flatten semua slot dari semua sesi (untuk getBookedSlots check) */
  function flattenSessionSlots(sessionSlots) {
    var all = [];
    sessionSlots.forEach(function(s) {
      s.slots.forEach(function(t) { if (all.indexOf(t) < 0) all.push(t); });
    });
    return all;
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

  /* ── Map ISO date → Indonesian day name ── */
  var ID_DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

  function isoToDayName(isoDate) {
    var d = new Date(isoDate + "T00:00");
    return ID_DAYS[d.getDay()];
  }

  /* ── Render doctor cards ── */
  function buildDoctorCards(clinic, dateISO) {
    var section = $("cdDoctors");
    if (!section) return;

    var targetDate = dateISO || activeDateISO;
    var selectedDayName = isoToDayName(targetDate);

    var allDokters = clinic.dokters || [];

    /* Jika klinik belum mengisi tim dokter, sembunyikan seluruh section */
    if (!allDokters.length) {
      section.hidden = true;
      return;
    }

    section.hidden = false;

    /* Filter by selected day — support both formats:
       Format baru: doc.jadwal = [{hari, mulai, selesai}]
       Format lama: doc.hari = ['Senin', 'Selasa', ...] */
    var dokters = allDokters.filter(function(doc) {
      /* Format baru: jadwal array */
      if (Array.isArray(doc.jadwal) && doc.jadwal.length) {
        return doc.jadwal.some(function(j) { return j.hari === selectedDayName; });
      }
      /* Format lama: hari array atau string */
      var hariArr = typeof doc.hari === "string"
        ? doc.hari.split(/[,\s]+/).filter(Boolean)
        : (Array.isArray(doc.hari) ? doc.hari : []);
      /* Jika tidak ada jadwal sama sekali, tampilkan di semua hari */
      if (!hariArr.length) return true;
      return hariArr.indexOf(selectedDayName) >= 0;
    });

    if (!dokters.length) {
      section.hidden = false;
      section.innerHTML =
        '<div class="cd-no-doctors-day">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="40" height="40" aria-hidden="true">' +
            '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>' +
            '<circle cx="9" cy="7" r="4"/>' +
            '<path d="M23 21v-2a4 4 0 0 0-3-3.87"/>' +
            '<path d="M16 3.13a4 4 0 0 1 0 7.75"/>' +
          '</svg>' +
          '<p>Tidak ada dokter pada hari yang kamu pilih.</p>' +
        '</div>';
      return;
    }

    section.innerHTML = dokters.map(function(doc) {
      /* ── Day tags: ambil dari jadwal[] (format baru) atau hari[] (format lama) ── */
      var jadwalHari = [];
      if (Array.isArray(doc.jadwal) && doc.jadwal.length) {
        jadwalHari = doc.jadwal.map(function(j) { return j.hari; });
      } else {
        jadwalHari = typeof doc.hari === "string"
          ? doc.hari.split(/[,\s]+/).filter(Boolean)
          : (Array.isArray(doc.hari) ? doc.hari : []);
      }

      var dayTags = jadwalHari.map(function(h) {
        var isActive = h === selectedDayName;
        return '<span class="cd-day-tag' + (isActive ? ' is-today' : '') + '">' + esc(h) + '</span>';
      }).join("");

      /* ── Jam kerja dokter hari ini ── */
      var jamKerjaHtml = "";
      if (Array.isArray(doc.jadwal) && doc.jadwal.length) {
        var dayEntry = null;
        for (var di = 0; di < doc.jadwal.length; di++) {
          if (doc.jadwal[di].hari === selectedDayName) { dayEntry = doc.jadwal[di]; break; }
        }
        if (dayEntry) {
          var sessions = Array.isArray(dayEntry.sessions) && dayEntry.sessions.length
            ? dayEntry.sessions
            : [{ mulai: dayEntry.mulai || "08:00", selesai: dayEntry.selesai || "17:00" }];
          var jamStr = sessions.map(function(s) {
            return esc(s.mulai) + "–" + esc(s.selesai);
          }).join(" &amp; ");
          jamKerjaHtml = '<p class="cd-doc-hours">🕐 ' + jamStr + '</p>';
        }
      } else if (doc.jamMulai || doc.jamSelesai) {
        jamKerjaHtml = '<p class="cd-doc-hours">🕐 ' +
          esc(doc.jamMulai || "08:00") + "–" + esc(doc.jamSelesai || "17:00") + '</p>';
      }

      /* ── Time slots: per-sesi dari getDoctorSessionSlots ── */
      var sessionSlots = getDoctorSessionSlots(doc, selectedDayName, clinic.jamBuka, clinic.jamTutup);
      var bookedSlots  = getBookedSlots(doc.nama, targetDate);
      var multiSesi    = sessionSlots.length > 1;

      /* Render tiap sesi sebagai blok tersendiri dengan header rentang jam */
      var slotsHtml = sessionSlots.map(function(sesi, si) {
        var headerHtml = multiSesi
          ? '<div class="cd-sesi-header"><span class="cd-sesi-num">Sesi ' + (si + 1) + '</span>' +
            '<span class="cd-sesi-range">' + esc(sesi.label) + '</span></div>'
          : '<div class="cd-sesi-header cd-sesi-header--single">' +
            '<span class="cd-sesi-range">' + esc(sesi.label) + '</span></div>';

        var btnHtml = sesi.slots.map(function(t) {
          var isBooked = bookedSlots.indexOf(t) >= 0;
          var cls      = isBooked ? "booked" : "available";
          var disabled = isBooked ? ' disabled aria-disabled="true"' : "";
          var ariaLabel = isBooked ? t + " (penuh)" : t;
          return '<button class="cd-time-slot ' + cls + '" type="button"' + disabled +
                 ' aria-label="' + esc(ariaLabel) + '">' + esc(t) + '</button>';
        }).join("");

        return '<div class="cd-sesi-block">' + headerHtml +
               '<div class="cd-sesi-slots">' + btnHtml + '</div></div>';
      }).join("");

      /* ── Photo ── */
      var photoStyle = doc.fotoDataUrl
        ? ' style="background-image:url(' + esc(doc.fotoDataUrl) + ');"'
        : "";

      return '' +
        '<div class="cd-doc-card" role="article" aria-label="' + esc(doc.nama || "Dokter") + '" data-doc-nama="' + esc(doc.nama) + '">' +
          '<div class="cd-doc-inner">' +
            '<div class="cd-doc-photo"' + photoStyle + ' aria-hidden="true"></div>' +
            '<div class="cd-doc-info">' +
              '<p class="cd-doc-name">' + esc(doc.nama || "Dokter Hewan") + '</p>' +
              '<p class="cd-doc-spec">' + esc(doc.spesialisasi || doc.spesialis || clinic.tipeKlinik || "Dokter Hewan") + '</p>' +
              jamKerjaHtml +
              '<p class="cd-doc-sched-label">Jadwal praktek :</p>' +
              '<div class="cd-doc-days">' + (dayTags || '<span class="cd-day-tag">Setiap hari</span>') + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="cd-doc-divider" aria-hidden="true"></div>' +
          '<div class="cd-time-row">' +
            slotsHtml +
          '</div>' +
          '<div class="cd-time-action-row">' +
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
