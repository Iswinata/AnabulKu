/* ===================================================================
   AnabulKu Mitra — Dashboard (index.html)
   -------------------------------------------------------------------
   Reads saved clinic data from localStorage (key: anabulku:mitra:klinik)
   and renders the dashboard. If no data, shows the "Daftar Sekarang" CTA.
   Also syncs clinic data into the main app's mock clinic list so it
   appears when users search from home.html.
=================================================================== */

(function () {
  "use strict";

  var STORAGE_KEY = "anabulku:mitra:klinik";

  function $(id) { return document.getElementById(id); }

  function loadData() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function renderDashboard(data) {
    var hasData = data && data.namaKlinik;

    /* ---- Status banner ---- */
    var banner = $("statusBanner");
    if (!hasData) {
      banner.querySelector(".status-title").textContent = "Belum Terdaftar";
      banner.querySelector(".status-sub").textContent = "Lengkapi pendaftaran untuk mulai tampil di AnabulKu";
      banner.querySelector("circle").setAttribute("fill", "#F97316");
      /* replace checkmark with info dot */
      var path = banner.querySelector("path");
      if (path) path.remove();
    }

    /* ---- Clinic preview ---- */
    var preview = $("clinicPreview");
    if (hasData) {
      $("previewName").textContent  = data.namaKlinik  || "—";
      $("previewType").textContent  = tipeLabel(data.tipeKlinik) || "—";
      $("previewWa").textContent    = data.waKlinik    || "—";
      $("dashboardClinicName").textContent = data.namaKlinik;

      if (data.logoDataUrl) {
        $("previewPhoto").style.backgroundImage = "url('" + data.logoDataUrl + "')";
      }
    } else {
      $("ctaEmpty").hidden = false;
      preview.style.opacity = "0.45";
      preview.style.pointerEvents = "none";
      $("previewName").textContent = "Klinik belum didaftarkan";
      $("previewType").textContent = "—";
      $("previewWa").textContent   = "—";
    }
  }

  function tipeLabel(val) {
    var map = {
      umum:    "Klinik Hewan Umum",
      kucing:  "Klinik Khusus Kucing",
      anjing:  "Klinik Khusus Anjing",
      eksotik: "Klinik Hewan Eksotik / Reptil",
      rsh:     "Rumah Sakit Hewan"
    };
    return map[val] || val || "—";
  }

  /* Push clinic data into the main app's mock list stored in localStorage
     so clinics.js picks it up the next time the user opens home.html.
     Key: anabulku:partner:clinics — clinics.js will check this on init. */
  function syncToMainApp(data) {
    if (!data || !data.namaKlinik) return;

    var clinic = {
      id:          "mitra-" + Date.now(),
      name:        data.namaKlinik,
      address:     [data.alamat, data.kota, data.provinsi].filter(Boolean).join(", "),
      whatsapp:    data.waKlinik,
      type:        data.tipeKlinik,
      animals:     data.hewanDilayani,
      services:    data.layanan || [],
      jadwal:      buildJadwal(data),
      rating:      null,
      ratingCount: 0,
      distanceKm:  null,
      photo:       data.fotoDataUrl || "",
      logo:        data.logoDataUrl || "",
      mapsUri:     data.googleMaps || "",
      registeredAt: new Date().toISOString()
    };

    try {
      var raw = localStorage.getItem("anabulku:partner:clinics");
      var list = raw ? JSON.parse(raw) : [];
      /* update if same name already exists, else push */
      var idx = list.findIndex(function (c) { return c.name === clinic.name; });
      if (idx >= 0) list[idx] = clinic;
      else list.push(clinic);
      localStorage.setItem("anabulku:partner:clinics", JSON.stringify(list));
    } catch (e) { /* storage full — fail silently */ }
  }

  function buildJadwal(data) {
    var hari = Array.isArray(data.hari) ? data.hari.join(", ") : (data.hari || "");
    if (!hari) return "";
    return hari + (data.jamBuka ? "  •  " + data.jamBuka + " – " + (data.jamTutup || "") : "");
  }

  /* ---- Init ---- */
  var data = loadData();
  renderDashboard(data);
  if (data) syncToMainApp(data);

})();
