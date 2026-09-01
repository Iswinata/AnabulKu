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

  /* ── Guest login modal ── */
  function showGuestLoginModal() {
    var existing = document.getElementById("cdGuestModal");
    if (existing) existing.remove();

    var backdrop = document.createElement("div");
    backdrop.id = "cdGuestModal";
    backdrop.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center;z-index:9999;";

    var sheet = document.createElement("div");
    sheet.style.cssText = "background:#fff;width:100%;max-width:393px;border-radius:20px 20px 0 0;padding:28px 24px 32px;display:flex;flex-direction:column;align-items:center;gap:10px;box-shadow:0 -4px 24px rgba(0,0,0,.12);animation:modalSlideUp .25s ease both;";
    sheet.innerHTML =
      '<div style="font-size:44px;line-height:1;margin-bottom:4px;">🔒</div>' +
      '<div style="font-size:17px;font-weight:700;color:#1F2937;text-align:center;">Login Diperlukan</div>' +
      '<p style="font-size:13px;color:#6B7280;text-align:center;line-height:1.55;margin-bottom:6px;">Pilih layanan hanya tersedia untuk member AnabulKu. Login atau daftar gratis sekarang!</p>' +
      '<button id="cdGuestLogin" style="width:100%;padding:13px;border-radius:12px;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;border:2px solid #000;background:linear-gradient(180deg,#FF9800,#FFD21F);color:#fff;box-shadow:2px 2px 0 #000;">Masuk</button>' +
      '<button id="cdGuestRegister" style="width:100%;padding:13px;border-radius:12px;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;border:2px solid #000;background:#fff;color:#1F2937;box-shadow:2px 2px 0 #000;margin-top:2px;">Daftar Gratis</button>';

    backdrop.appendChild(sheet);
    document.body.appendChild(backdrop);

    document.getElementById("cdGuestLogin").addEventListener("click", function() { window.location.href = "login.html"; });
    document.getElementById("cdGuestRegister").addEventListener("click", function() { window.location.href = "register.html"; });
    backdrop.addEventListener("click", function(e) { if (e.target === backdrop) backdrop.remove(); });
  }
  function getClinicIndex() {
    var params = new URLSearchParams(window.location.search);
    var id = parseInt(params.get("id"), 10);
    return isNaN(id) ? 0 : id;
  }

  /* ── Aktif klinik dan mitraId-nya ── */
  var activeMitraId = "";

  /* ── Load clinic data from localStorage ── */
  function loadClinic(idx) {
    try {
      var raw = localStorage.getItem("mitraKlinik");
      var list = raw ? JSON.parse(raw) : [];
      var c = list[idx] || null;
      if (!c) return null;
      activeMitraId = c.id || "";

      /* Jika dokters kosong di mitraKlinik, coba baca langsung dari namespace storage
         (anabulku_dokters_<mitraId>) — kasus: mitra baru tambah dokter tapi belum sync */
      if ((!Array.isArray(c.dokters) || !c.dokters.length) && activeMitraId) {
        try {
          var nsRaw = localStorage.getItem("anabulku_dokters_" + activeMitraId);
          if (nsRaw) {
            var nsDokters = JSON.parse(nsRaw);
            if (Array.isArray(nsDokters) && nsDokters.length) {
              c = Object.assign({}, c, { dokters: nsDokters });
              /* Tulis balik ke mitraKlinik agar sync untuk pembacaan berikutnya */
              list[idx] = c;
              try { localStorage.setItem("mitraKlinik", JSON.stringify(list)); } catch (e2) { /* silent */ }
            }
          }
        } catch (eFallback) { /* silent */ }
      }

      return c;
    } catch (e) { return null; }
  }

  /* ── Key namespace booking per klinik ── */
  function bookingKey() {
    return activeMitraId ? "anabulku_bookings_" + activeMitraId : "anabulku_bookings";
  }

  /* ── Load existing bookings dari namespace klinik ini ── */
  function loadBookings() {
    try {
      var raw = localStorage.getItem(bookingKey());
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  /* ── Save new booking: tulis ke namespace klinik + ke key global (untuk riwayat user) ── */
  function saveBooking(booking) {
    try {
      /* 1. Tulis ke namespace klinik agar dashboard mitra bisa membacanya */
      var listKlinik = loadBookings();
      listKlinik.unshift(booking);
      localStorage.setItem(bookingKey(), JSON.stringify(listKlinik));

      /* 2. Tulis juga ke key global anabulku_bookings untuk riwayat user app */
      var globalRaw = localStorage.getItem("anabulku_bookings");
      var listGlobal = globalRaw ? JSON.parse(globalRaw) : [];
      listGlobal.unshift(booking);
      localStorage.setItem("anabulku_bookings", JSON.stringify(listGlobal));
    } catch (e) { /* silent */ }
  }

  /* ── Get booked slots for a specific doctor & date ── */
  function getBookedSlots(dokterNama, tanggal) {
    var bookings = loadBookings();
    var now = Date.now();
    return bookings
      .filter(function(b) {
        if (b.dokter !== dokterNama || b.tanggal !== tanggal) return false;
        /* Slot sudah bebas kalau dibatalkan */
        if (b.status === "dibatalkan") return false;
        /* Slot sudah bebas kalau paymentDeadline expired (belum sempat dibatalkan) */
        if (b.paymentDeadline && new Date(b.paymentDeadline).getTime() <= now) return false;
        return b.status === "menunggu" || b.status === "dikonfirmasi";
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

  /* ── Generate jam per-jam dari range waktu ──
     "08:00"–"12:00" → ["08:00","09:00","10:00","11:00"] */
  function generateHourSlots(mulai, selesai) {
    if (!mulai || !selesai) return [];
    var slots = [];
    var startH = parseInt(mulai.split(":")[0], 10);
    var startM = parseInt(mulai.split(":")[1] || "0", 10);
    var endH   = parseInt(selesai.split(":")[0], 10);
    var endM   = parseInt(selesai.split(":")[1] || "0", 10);
    var endTotal = endH * 60 + endM;
    var cur = startH * 60 + startM;
    while (cur < endTotal) {
      var h = Math.floor(cur / 60);
      var m = cur % 60;
      slots.push(String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0"));
      cur += 60;
    }
    return slots;
  }

  /* ── Kumpulkan sesi dokter di hari tertentu ──
     Return [{sesiLabel, slots:[jam,...]}]
     Tiap sesi punya header label (range) + pilihan jam per jam di dalamnya */
  function getDoctorSesiSlots(doc, dayName) {
    var result = [];

    /* Format baru: jadwal = [{hari, mulai, selesai, sessions:[{mulai,selesai}]}] */
    if (Array.isArray(doc.jadwal) && doc.jadwal.length) {
      var dayEntry = null;
      for (var i = 0; i < doc.jadwal.length; i++) {
        if (doc.jadwal[i].hari === dayName) { dayEntry = doc.jadwal[i]; break; }
      }
      if (!dayEntry) return [];

      var sessions = Array.isArray(dayEntry.sessions) && dayEntry.sessions.length
        ? dayEntry.sessions
        : [{ mulai: dayEntry.mulai || "08:00", selesai: dayEntry.selesai || "17:00" }];

      sessions.forEach(function(s, si) {
        var mulai   = s.mulai   || "08:00";
        var selesai = s.selesai || "17:00";
        result.push({
          sesiLabel: "Sesi " + (si + 1) + " · " + mulai + "–" + selesai,
          slots: generateHourSlots(mulai, selesai)
        });
      });
      return result;
    }

    /* Format lama */
    if (doc.jamMulai && doc.jamSelesai) {
      result.push({
        sesiLabel: doc.jamMulai + "–" + doc.jamSelesai,
        slots: generateHourSlots(doc.jamMulai, doc.jamSelesai)
      });
    }
    return result;
  }

  /* ── Cek apakah jam sudah lewat (hari ini) ── */
  function isSlotPast(dateISO, timeStr) {
    var todayISO = (function() {
      var n = new Date();
      return n.getFullYear() + "-" +
        String(n.getMonth() + 1).padStart(2, "0") + "-" +
        String(n.getDate()).padStart(2, "0");
    })();
    if (dateISO !== todayISO) return false;
    var now  = new Date();
    var nowM = now.getHours() * 60 + now.getMinutes();
    var parts = timeStr.split(":");
    var slotM = parseInt(parts[0], 10) * 60 + parseInt(parts[1] || "0", 10);
    return slotM <= nowM;
  }

  /* ── Ambil data user yang sedang login ── */
  function getLoggedInUser() {
    try {
      var sess = JSON.parse(localStorage.getItem("anabulku_user_session")) || {};
      if (!sess.loggedIn) return null;
      /* Cari noHp dari anabulku_users berdasarkan email */
      var users = JSON.parse(localStorage.getItem("anabulku_users")) || [];
      var found = users.find(function(u) { return u.email === sess.email; });
      return {
        nama: found ? (found.nama || sess.nama || "") : (sess.nama || ""),
        noHp: found ? (found.noHp || "") : ""
      };
    } catch (e) { return null; }
  }

  /* ── Build <option> list dari hewanDilayani klinik ──
     Nilai dari daftar.html: kucing, anjing, reptil
     Fallback ke daftar lengkap jika klinik tidak punya data */
  var HEWAN_LABEL_MAP = {
    kucing:  "Kucing",
    anjing:  "Anjing",
    reptil:  "Reptil / Eksotik",
    kelinci: "Kelinci",
    burung:  "Burung",
    hamster: "Hamster",
    lainnya: "Lainnya",
  };

  var HEWAN_FALLBACK = ["kucing", "anjing", "reptil", "kelinci", "burung", "hamster"];

  function buildHewanOptions(clinic) {
    var list = Array.isArray(clinic.hewanDilayani) && clinic.hewanDilayani.length
      ? clinic.hewanDilayani
      : HEWAN_FALLBACK;

    /* Hapus "lainnya" dari daftar — hanya tampilkan hewan yang dipilih klinik */
    var items = list.filter(function(v) { return v.toLowerCase() !== "lainnya"; });

    return items.map(function(val) {
      var label = HEWAN_LABEL_MAP[val.toLowerCase()] || (val.charAt(0).toUpperCase() + val.slice(1));
      return '<option value="' + esc(label) + '">' + esc(label) + '</option>';
    }).join("");
  }

  /* ── Booking form modal ── */
  var modalEl = null;

  function showBookingModal(clinic, doc, jam, tanggal) {
    /* Cek guest — tampilkan modal login jika belum login */
    var sess = {};
    try { sess = JSON.parse(localStorage.getItem("anabulku_user_session")) || {}; } catch(e) {}
    if (!sess.loggedIn) {
      showGuestLoginModal();
      return;
    }

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
            '<p>' + esc(doc.nama) + ' · ' + esc(tanggal) + (jam ? ' pukul ' + esc(jam) : '') + '</p>' +
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
              buildHewanOptions(clinic) +
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

    /* Auto-fill data user yang login */
    var loggedUser = getLoggedInUser();
    if (loggedUser) {
      var namaInput = modalEl.querySelector("#cdNamaPemilik");
      var noHPInput = modalEl.querySelector("#cdNoHP");
      if (namaInput && loggedUser.nama) namaInput.value = loggedUser.nama;
      if (noHPInput && loggedUser.noHp) noHPInput.value = loggedUser.noHp;
    }

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
        id:              uid(),
        tanggal:         tanggal,
        jam:             jam,
        namaPemilik:     namaPemilik,
        noHP:            noHP,
        namaHewan:       namaHewan,
        jenisHewan:      jenisHewan,
        ras:             "",
        umur:            "",
        dokter:          doc.nama,
        keluhan:         keluhan,
        biaya:           clinic.hargaMulai || "",
        status:          "menunggu",
        statusPembayaran: "menunggu_pembayaran",
        sumber:          "app_user",
        namaKlinik:      clinic.namaKlinik || "",
        createdAt:       new Date().toISOString(),
        paymentDeadline: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      };

      saveBooking(booking);

      /* Simpan pending payment untuk halaman pembayaran */
      try {
        localStorage.setItem("anabulku_pending_payment", JSON.stringify(booking));
      } catch (e) { /* silent */ }

      closeModal();

      /* Redirect ke halaman pembayaran */
      window.location.href = "payment.html";
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

    /* Jika klinik belum mengisi tim dokter, tampilkan pesan kosong */
    if (!allDokters.length) {
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


      /* ── Sesi per hari + jam per-jam di dalamnya ── */
      var sesiList    = getDoctorSesiSlots(doc, selectedDayName);
      var bookedSlots = getBookedSlots(doc.nama, targetDate);

      var slotsHtml;
      if (!sesiList.length) {
        slotsHtml =
          '<div class="cd-no-slots">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="24" height="24" aria-hidden="true">' +
              '<circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>' +
            '</svg>' +
            '<span>Belum ada jadwal jam untuk hari ini</span>' +
          '</div>';
      } else {
        slotsHtml = sesiList.map(function(sesi) {
          var jamBtns = sesi.slots.map(function(jam) {
            var isPast   = isSlotPast(targetDate, jam);
            var isBooked = bookedSlots.indexOf(jam) >= 0;
            var disabled = (isPast || isBooked) ? ' disabled aria-disabled="true"' : "";
            var cls      = isPast ? "past" : (isBooked ? "booked" : "available");
            var ariaLbl  = isPast ? jam + " (sudah lewat)" : (isBooked ? jam + " (penuh)" : jam);
            return '<button class="cd-time-slot ' + cls + '" type="button"' + disabled +
                   ' aria-label="' + esc(ariaLbl) + '" data-sesi-value="' + esc(jam) + '">' +
                   esc(jam) + '</button>';
          }).join("");

          return '<div class="cd-sesi-group">' +
            '<div class="cd-sesi-group-header">' + esc(sesi.sesiLabel) + '</div>' +
            '<div class="cd-sesi-slots">' + jamBtns + '</div>' +
          '</div>';
        }).join("");
      }

      /* ── Photo ── */
      var hasFoto = !!doc.fotoDataUrl;
      var photoInner = hasFoto
        ? '<div class="cd-doc-photo" style="background-image:url(\'' + doc.fotoDataUrl + '\');background-size:cover;background-position:center;background-repeat:no-repeat;" aria-hidden="true"></div>'
        : '<div class="cd-doc-photo cd-doc-photo--empty" aria-hidden="true">' +
            '<img src="lokasi%20icon.png" class="cd-doc-photo-icon" alt="" aria-hidden="true" />' +
          '</div>';

      return '' +
        '<div class="cd-doc-card" role="article" aria-label="' + esc(doc.nama || "Dokter") + '" data-doc-nama="' + esc(doc.nama) + '">' +
          '<div class="cd-doc-inner">' +
            photoInner +
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

    /* Wire time slot selection — single-select global, exclude booked dan past */
    var allSlots = section.querySelectorAll(".cd-time-slot:not(.booked):not(.past)");
    section.querySelectorAll(".cd-doc-card").forEach(function(card) {
      var slots = card.querySelectorAll(".cd-time-slot:not(.booked):not(.past)");
      slots.forEach(function(slot) {
        slot.addEventListener("click", function() {
          if (slot.classList.contains("selected")) {
            /* Klik ulang slot yang sama → batalkan pilihan */
            slot.classList.remove("selected");
            slot.classList.add("available");
          } else {
            /* Hapus selected dari SEMUA slot di semua kartu dokter */
            allSlots.forEach(function(s) {
              s.classList.remove("selected");
              s.classList.add("available");
            });
            slot.classList.remove("available");
            slot.classList.add("selected");
          }
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
          showSuccessToast("Pilih jam konsultasi terlebih dahulu.");
          return;
        }

        var jam = selectedSlot.getAttribute("data-sesi-value") || selectedSlot.textContent.trim();
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

      /* No slots message */
      ".cd-no-slots{display:flex;align-items:center;gap:8px;padding:14px 16px;",
      "background:#F9FAFB;border-radius:8px;color:#9CA3AF;font-size:13px;}",

      /* Toast */
      ".cd-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(80px);",
      "background:#059669;color:#fff;font-family:'Poppins',sans-serif;font-size:14px;font-weight:500;",
      "padding:12px 24px;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.2);",
      "z-index:300;opacity:0;transition:transform .25s,opacity .25s;pointer-events:none;white-space:nowrap;}",
      ".cd-toast--visible{transform:translateX(-50%) translateY(0);opacity:1;}",
    ].join("");
    document.head.appendChild(style);
  }

  /* ── Banner lanjutkan booking (jika ada pending) ── */
  function showResumeBanner() {
    var pending = null;
    try {
      pending = JSON.parse(localStorage.getItem("anabulku_pending_payment"));
    } catch (e) { return; }
    if (!pending || !pending.id) return;

    /* Jangan tampilkan banner kalau booking pending bukan dari klinik ini */
    var idx = getClinicIndex();
    var clinic = loadClinic(idx);
    if (clinic && pending.namaKlinik && pending.namaKlinik !== clinic.namaKlinik) return;

    var banner = document.createElement("div");
    banner.id = "cdResumeBanner";
    banner.setAttribute("role", "alert");
    banner.style.cssText = [
      "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);",
      "width:calc(100% - 40px);max-width:353px;",
      "background:#fff;border:1.5px solid #FF9800;border-radius:13px;",
      "box-shadow:2px 2px 0 #000;",
      "display:flex;align-items:center;gap:10px;",
      "padding:12px 14px;z-index:150;",
      "animation:slideUpBanner .3s cubic-bezier(.34,1.2,.64,1) both;"
    ].join("");

    /* Hitung sisa waktu untuk ditampilkan */
    var deadlineMs = pending.paymentDeadline
      ? new Date(pending.paymentDeadline).getTime()
      : null;
    var remainingMs = deadlineMs ? Math.max(0, deadlineMs - Date.now()) : null;

    /* Jika deadline sudah lewat, batalkan otomatis dan jangan tampilkan banner */
    if (deadlineMs && remainingMs <= 0) {
      try {
        var bksExp = JSON.parse(localStorage.getItem("anabulku_bookings")) || [];
        var expIdx = bksExp.findIndex(function(b) { return b.id === pending.id; });
        if (expIdx >= 0) {
          bksExp[expIdx].status = "dibatalkan";
          bksExp[expIdx].statusPembayaran = "dibatalkan";
          bksExp[expIdx].cancelledReason = "timeout";
          localStorage.setItem("anabulku_bookings", JSON.stringify(bksExp));
        }
        localStorage.removeItem("anabulku_pending_payment");
      } catch (eExp) { /* silent */ }
      return;
    }

    /* Format sisa waktu MM:SS */
    function fmtCountdown(ms) {
      var m = Math.floor(ms / 60000);
      var s = Math.floor((ms % 60000) / 1000);
      return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
    }

    banner.innerHTML =
      '<div style="flex:1;min-width:0;">' +
        '<p style="font-family:Poppins,sans-serif;font-size:11px;font-weight:700;color:#FF9800;margin:0 0 1px;text-transform:uppercase;letter-spacing:.05em;">Booking Belum Selesai</p>' +
        '<p style="font-family:Poppins,sans-serif;font-size:12px;font-weight:500;color:#374151;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
          (pending.dokter ? pending.dokter + ' · ' : '') +
          (pending.jam ? 'Pukul ' + pending.jam : '') +
        '</p>' +
        (deadlineMs ? '<p id="cdBannerCountdown" style="font-family:Poppins,sans-serif;font-size:11px;font-weight:700;color:#EF4444;margin:2px 0 0;">⏱ ' + fmtCountdown(remainingMs) + '</p>' : '') +
      '</div>' +
      '<button id="cdResumeContinue" type="button" style="' +
        'flex-shrink:0;padding:8px 14px;' +
        'background:linear-gradient(180deg,#ff9800 0%,#ffbc59 100%);' +
        'border:none;border-radius:8px;box-shadow:1px 1px 0 #000;' +
        'font-family:Poppins,sans-serif;font-size:12px;font-weight:700;color:#fff;cursor:pointer;' +
      '">Lanjutkan</button>' +
      '<button id="cdResumeDismiss" type="button" aria-label="Tutup" style="' +
        'flex-shrink:0;width:26px;height:26px;border-radius:6px;border:none;' +
        'background:#F3F4F6;color:#9CA3AF;font-size:12px;cursor:pointer;' +
      '">✕</button>';

    /* Inject keyframe jika belum ada */
    if (!document.getElementById("cd-resume-anim")) {
      var kf = document.createElement("style");
      kf.id = "cd-resume-anim";
      kf.textContent = "@keyframes slideUpBanner{from{transform:translateX(-50%) translateY(100px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}";
      document.head.appendChild(kf);
    }

    document.body.appendChild(banner);

    /* Countdown tick di banner */
    if (deadlineMs) {
      var bannerInterval = setInterval(function() {
        var left = Math.max(0, deadlineMs - Date.now());
        var countEl = document.getElementById("cdBannerCountdown");
        if (countEl) countEl.textContent = "⏱ " + fmtCountdown(left);
        if (left <= 0) {
          clearInterval(bannerInterval);
          /* Auto-cancel dan hapus banner */
          try {
            var bks2 = JSON.parse(localStorage.getItem("anabulku_bookings")) || [];
            var i2 = bks2.findIndex(function(b) { return b.id === pending.id; });
            if (i2 >= 0) {
              bks2[i2].status = "dibatalkan";
              bks2[i2].statusPembayaran = "dibatalkan";
              bks2[i2].cancelledReason = "timeout";
              localStorage.setItem("anabulku_bookings", JSON.stringify(bks2));
            }
            localStorage.removeItem("anabulku_pending_payment");
          } catch (e2) { /* silent */ }
          if (banner.parentNode) banner.remove();
        }
      }, 1000);
    }

    document.getElementById("cdResumeContinue").addEventListener("click", function() {
      window.location.href = "payment.html";
    });

    document.getElementById("cdResumeDismiss").addEventListener("click", function() {
      try { localStorage.removeItem("anabulku_pending_payment"); } catch (e) {}
      banner.remove();
    });
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
    showResumeBanner();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
