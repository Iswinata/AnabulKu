/* ===================================================================
   AnabulKu Mitra — Pendaftaran Klinik (daftar.html)
   -------------------------------------------------------------------
   7-step multi-step form controller.
   Data collected per step is merged into a single object and saved to
   localStorage (anabulku:mitra:klinik) on final submit.

   Steps:
     1 — Informasi Klinik  (nama, WA, tipe, hewan, logo, foto)
     2 — Lokasi Klinik     (alamat, kota, provinsi, kodepos, gmaps)
     3 — Jadwal            (hari buka, jam buka/tutup, catatan)
     4 — Layanan           (checkbox services, layanan lain, harga)
     5 — Tim Dokter        (dynamic list of dokter entries)
     6 — Informasi Akun    (email, nama owner, password)
     7 — Konfirmasi        (review + TOS checkbox)
=================================================================== */

(function () {
  "use strict";

  var STORAGE_KEY   = "anabulku:mitra:klinik";
  var DRAFT_KEY     = "anabulku:mitra:draft";
  var TOTAL_STEPS   = 7;

  var STEP_TITLES = [
    "Informasi Klinik",
    "Lokasi Klinik",
    "Jadwal Operasional",
    "Layanan Klinik",
    "Tim Dokter",
    "Informasi Akun",
    "Konfirmasi Data"
  ];

  var currentStep  = 1;
  var formData     = {};        /* accumulated data across all steps */
  var dokterCount  = 1;         /* dynamic dokter entries counter */

  /* ---- DOM shortcuts ---- */
  function $(id) { return document.getElementById(id); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---- Init ---- */
  function init() {
    buildStepDots();
    restoreDraft();
    bindButtons();
    bindUploads();
    bindPwdToggle();
    bindDokterAdd();
    updateView();
  }

  /* ---- Build step indicator dots ---- */
  function buildStepDots() {
    var container = $("stepDots");
    if (!container) return;
    var html = "";
    for (var i = 1; i <= TOTAL_STEPS; i++) {
      html += '<div class="step-dot" id="dot' + i + '" role="listitem" aria-label="Langkah ' + i + '">' + i + '</div>';
    }
    container.innerHTML = html;
  }

  /* ---- Update which step is visible + header title + dots ---- */
  function updateView() {
    /* show/hide steps */
    for (var i = 1; i <= TOTAL_STEPS; i++) {
      var el = $("step" + i);
      if (el) el.hidden = (i !== currentStep);
    }

    /* title */
    var fhTitle = $("fhTitle");
    if (fhTitle) fhTitle.textContent = STEP_TITLES[currentStep - 1] || "Daftar Klinik";

    /* dots */
    for (var j = 1; j <= TOTAL_STEPS; j++) {
      var dot = $("dot" + j);
      if (!dot) continue;
      dot.classList.toggle("is-active", j === currentStep);
      dot.classList.toggle("is-done",   j < currentStep);
    }

    /* button label */
    var btn = $("btnNext");
    if (btn) {
      btn.textContent = (currentStep === TOTAL_STEPS) ? "Daftar Sekarang" : "Lanjut";
    }

    /* scroll to top of form on step change */
    var body = $("formBody");
    if (body) body.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---- Navigation buttons ---- */
  function bindButtons() {
    var btnNext = $("btnNext");
    var btnBack = $("btnBack");

    if (btnNext) {
      btnNext.addEventListener("click", function () {
        if (validateStep(currentStep)) {
          collectStep(currentStep);
          saveDraft();
          if (currentStep === TOTAL_STEPS) {
            submitForm();
          } else {
            if (currentStep === TOTAL_STEPS - 1) {
              buildConfirmCard();
            }
            currentStep++;
            updateView();
          }
        }
      });
    }

    if (btnBack) {
      btnBack.addEventListener("click", function () {
        if (currentStep > 1) {
          currentStep--;
          updateView();
        } else {
          history.back();
        }
      });
    }
  }

  /* ---- Collect data from a step ---- */
  function collectStep(step) {
    switch (step) {
      case 1:
        formData.namaKlinik   = val("namaKlinik");
        formData.waKlinik     = val("waKlinik");
        formData.tipeKlinik   = val("tipeKlinik");
        formData.hewanDilayani= val("hewanDilayani");
        /* image data URLs are already stored by the upload handlers */
        break;

      case 2:
        formData.alamat       = val("alamat");
        formData.kota         = val("kota");
        formData.provinsi     = val("provinsi");
        formData.kodePos      = val("kodePos");
        formData.googleMaps   = val("googleMaps");
        break;

      case 3:
        formData.hari = qsa('input[name="hari"]:checked').map(function (el) { return el.value; });
        formData.jamBuka      = val("jamBuka");
        formData.jamTutup     = val("jamTutup");
        formData.catatanJadwal= val("catatanJadwal");
        break;

      case 4:
        formData.layanan = qsa('input[name="layanan"]:checked').map(function (el) { return el.value; });
        formData.layananLain  = val("layananLain");
        formData.hargaMulai   = val("hargaMulai");
        break;

      case 5:
        formData.dokter = [];
        for (var i = 0; i < dokterCount; i++) {
          formData.dokter.push({
            nama:      val("dokterNama"      + i),
            spesialis: val("dokterSpesialis" + i)
          });
        }
        break;

      case 6:
        formData.emailAkun  = val("emailAkun");
        formData.namaOwner  = val("namaOwner");
        /* intentionally NOT storing password in plain localStorage in a real app,
           but for this prototype we store a flag only */
        formData.hasPassword = !!val("password");
        break;

      case 7:
        /* nothing extra to collect — TOS checked is validated */
        break;
    }
  }

  function val(id) {
    var el = $(id);
    return el ? el.value.trim() : "";
  }

  /* ---- Validation per step ---- */
  function validateStep(step) {
    clearErrors();
    var ok = true;

    switch (step) {
      case 1:
        if (!val("namaKlinik")) { showError("namaKlinik", "Nama klinik wajib diisi"); ok = false; }
        if (!val("waKlinik"))   { showError("waKlinik",   "Nomor WhatsApp wajib diisi"); ok = false; }
        break;

      case 2:
        if (!val("alamat"))   { showError("alamat",   "Alamat wajib diisi"); ok = false; }
        if (!val("kota"))     { showError("kota",     "Kota wajib diisi");   ok = false; }
        if (!val("provinsi")) { showError("provinsi", "Provinsi wajib dipilih"); ok = false; }
        break;

      case 3: {
        var hariChecked = qsa('input[name="hari"]:checked');
        if (!hariChecked.length) { showError("hariError", "Pilih minimal satu hari buka"); ok = false; }
        if (!val("jamBuka"))  { showError("jamBuka",  "Jam buka wajib diisi");  ok = false; }
        if (!val("jamTutup")) { showError("jamTutup", "Jam tutup wajib diisi"); ok = false; }
        break;
      }

      case 4: {
        var layananChecked = qsa('input[name="layanan"]:checked');
        if (!layananChecked.length) { showError("layananError", "Pilih minimal satu layanan"); ok = false; }
        break;
      }

      case 5:
        /* dokter is optional — no hard validation */
        break;

      case 6: {
        if (!val("emailAkun"))  { showError("emailAkun",  "Email wajib diisi"); ok = false; }
        if (!val("namaOwner"))  { showError("namaOwner",  "Nama pemilik wajib diisi"); ok = false; }
        var pwd  = $("password")     ? $("password").value     : "";
        var kpwd = $("konfPassword") ? $("konfPassword").value : "";
        if (pwd.length < 8)   { showError("password",    "Kata sandi minimal 8 karakter"); ok = false; }
        if (pwd !== kpwd)      { showError("konfPassword","Konfirmasi kata sandi tidak cocok"); ok = false; }
        break;
      }

      case 7: {
        var tos = $("tosCheck");
        if (!tos || !tos.checked) {
          showError("tosError", "Anda harus menyetujui syarat & ketentuan");
          ok = false;
        }
        break;
      }
    }

    return ok;
  }

  function showError(id, msg) {
    /* try to attach error to existing field, else create a floating one */
    var target = $(id);
    if (target) {
      target.classList.add("is-error");
      var err = document.createElement("p");
      err.className = "field-error-msg";
      err.id = id + "_err";
      err.textContent = msg;
      target.parentNode.insertBefore(err, target.nextSibling);
    } else {
      /* generic fallback: insert before first child of current step */
      var step = $("step" + currentStep);
      if (!step) return;
      var existing = step.querySelector(".field-error-banner");
      if (!existing) {
        var banner = document.createElement("p");
        banner.className = "field-error-msg field-error-banner";
        banner.style.marginBottom = "8px";
        banner.textContent = msg;
        step.insertBefore(banner, step.firstChild);
      }
    }
  }

  function clearErrors() {
    qsa(".is-error").forEach(function (el) { el.classList.remove("is-error"); });
    qsa(".field-error-msg").forEach(function (el) { el.remove(); });
  }

  /* ---- Image uploads with preview ---- */
  function bindUploads() {
    setupUpload("logoUpload",  "logoPreview",  "logoPlaceholder",  "logoThumb",  "logoDataUrl");
    setupUpload("fotoUpload",  "fotoPreview",  "fotoPlaceholder",  "fotoThumb",  "fotoDataUrl");
  }

  function setupUpload(inputId, previewId, placeholderId, thumbId, dataKey) {
    var input = $(inputId);
    if (!input) return;

    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      if (!file) return;

      /* 2 MB guard */
      if (file.size > 2 * 1024 * 1024) {
        alert("File terlalu besar. Maks 2 MB.");
        input.value = "";
        return;
      }

      var reader = new FileReader();
      reader.onload = function (e) {
        formData[dataKey] = e.target.result;

        var preview     = $(previewId);
        var placeholder = $(placeholderId);
        var thumb       = $(thumbId);

        if (thumb)       thumb.src    = e.target.result;
        if (preview)     preview.hidden = false;
        if (placeholder) placeholder.hidden = true;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---- Password visibility toggle ---- */
  function bindPwdToggle() {
    var btn = $("pwdToggle");
    var inp = $("password");
    if (!btn || !inp) return;

    btn.addEventListener("click", function () {
      var show = inp.type === "password";
      inp.type = show ? "text" : "password";
      /* swap eye icon */
      var icon = $("eyeIcon");
      if (icon) {
        icon.innerHTML = show
          ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
          : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
      }
    });
  }

  /* ---- Dynamic dokter list (Step 5) ---- */
  function bindDokterAdd() {
    var btn = $("btnTambahDokter");
    if (!btn) return;

    btn.addEventListener("click", function () {
      var idx  = dokterCount;
      var list = $("dokterList");
      if (!list) return;

      var entry = document.createElement("div");
      entry.className = "dokter-entry";
      entry.id        = "dokterEntry" + idx;
      entry.innerHTML =
        '<div class="dokter-header">' +
          '<span class="dokter-num">Dokter ' + (idx + 1) + '</span>' +
          '<button type="button" class="dokter-remove" data-idx="' + idx + '">' +
            '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>' +
            ' Hapus' +
          '</button>' +
        '</div>' +
        '<div class="field">' +
          '<label class="field-label" for="dokterNama' + idx + '">Nama Dokter</label>' +
          '<input class="field-input" type="text" id="dokterNama' + idx + '" name="dokterNama' + idx + '" placeholder="drh. Nama Dokter" />' +
        '</div>' +
        '<div class="field">' +
          '<label class="field-label" for="dokterSpesialis' + idx + '">Spesialisasi</label>' +
          '<input class="field-input" type="text" id="dokterSpesialis' + idx + '" name="dokterSpesialis' + idx + '" placeholder="Mis: Kucing & Anjing, Bedah Hewan" />' +
        '</div>';

      /* insert before button */
      list.insertBefore(entry, btn);
      dokterCount++;

      /* bind remove */
      entry.querySelector(".dokter-remove").addEventListener("click", function () {
        entry.remove();
        dokterCount--;
      });
    });
  }

  /* ---- Build confirmation card (Step 7) ---- */
  function buildConfirmCard() {
    collectStep(currentStep); /* ensure current step data is fresh */
    var card = $("confirmCard");
    if (!card) return;

    var tipeMap = {
      umum:    "Klinik Hewan Umum",
      kucing:  "Klinik Khusus Kucing",
      anjing:  "Klinik Khusus Anjing",
      eksotik: "Klinik Hewan Eksotik / Reptil",
      rsh:     "Rumah Sakit Hewan"
    };

    var rows = [
      { label: "Nama Klinik",  value: formData.namaKlinik  || "—" },
      { label: "WhatsApp",     value: formData.waKlinik     || "—" },
      { label: "Tipe Klinik",  value: tipeMap[formData.tipeKlinik] || formData.tipeKlinik || "—" },
      { label: "Alamat",       value: [formData.alamat, formData.kota, formData.provinsi].filter(Boolean).join(", ") || "—" },
      { label: "Jadwal",       value: buildJadwal()                                                                       },
      { label: "Layanan",      value: (formData.layanan && formData.layanan.length) ? formData.layanan.join(", ") : "—"   },
      { label: "Email Akun",   value: formData.emailAkun   || "—" },
      { label: "Pemilik",      value: formData.namaOwner   || "—" }
    ];

    card.innerHTML = rows.map(function (r) {
      return '<div class="confirm-row">' +
        '<span class="confirm-lbl">' + esc(r.label) + '</span>' +
        '<span class="confirm-val">'  + esc(r.value) + '</span>' +
        '</div>';
    }).join("");
  }

  function buildJadwal() {
    var hari = Array.isArray(formData.hari) ? formData.hari.join(", ") : (formData.hari || "");
    if (!hari) return "—";
    return hari + (formData.jamBuka ? "  •  " + formData.jamBuka + "–" + (formData.jamTutup || "") : "");
  }

  /* ---- Final submit ---- */
  function submitForm() {
    collectStep(TOTAL_STEPS);

    /* save to localStorage */
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
      localStorage.removeItem(DRAFT_KEY);  /* clear draft */
    } catch (e) {
      alert("Gagal menyimpan data. Coba lagi.");
      return;
    }

    /* show success overlay */
    var overlay   = $("successOverlay");
    var clinicName = $("successClinicName");
    if (clinicName) clinicName.textContent = formData.namaKlinik || "Klinik Anda";
    if (overlay)   overlay.hidden = false;
  }

  /* ---- Draft save / restore (so data survives accidental back-navigation) ---- */
  function saveDraft() {
    try {
      var draft = JSON.parse(JSON.stringify(formData));
      /* strip large data URLs from draft to keep localStorage small */
      delete draft.logoDataUrl;
      delete draft.fotoDataUrl;
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ step: currentStep, data: draft }));
    } catch (e) { /* ignore */ }
  }

  function restoreDraft() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      var draft = JSON.parse(raw);
      if (!draft || !draft.data) return;

      formData = draft.data;

      /* restore field values */
      restoreField("namaKlinik",    formData.namaKlinik);
      restoreField("waKlinik",      formData.waKlinik);
      restoreField("tipeKlinik",    formData.tipeKlinik);
      restoreField("hewanDilayani", formData.hewanDilayani);
      restoreField("alamat",        formData.alamat);
      restoreField("kota",          formData.kota);
      restoreField("provinsi",      formData.provinsi);
      restoreField("kodePos",       formData.kodePos);
      restoreField("googleMaps",    formData.googleMaps);
      restoreField("jamBuka",       formData.jamBuka);
      restoreField("jamTutup",      formData.jamTutup);
      restoreField("catatanJadwal", formData.catatanJadwal);
      restoreField("layananLain",   formData.layananLain);
      restoreField("hargaMulai",    formData.hargaMulai);
      restoreField("emailAkun",     formData.emailAkun);
      restoreField("namaOwner",     formData.namaOwner);

      /* checkboxes */
      if (Array.isArray(formData.hari)) {
        qsa('input[name="hari"]').forEach(function (cb) {
          cb.checked = formData.hari.indexOf(cb.value) >= 0;
        });
      }
      if (Array.isArray(formData.layanan)) {
        qsa('input[name="layanan"]').forEach(function (cb) {
          cb.checked = formData.layanan.indexOf(cb.value) >= 0;
        });
      }

    } catch (e) { /* malformed draft — ignore */ }
  }

  function restoreField(id, value) {
    if (value == null) return;
    var el = $(id);
    if (el) el.value = value;
  }

  /* ---- HTML escape ---- */
  function esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* ---- Boot ---- */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
