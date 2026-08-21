/* ===================================================================
   AnabulKu Mitra — daftar.js
   Multi-step form logic for daftar.html (7 steps)
=================================================================== */

(function () {
  'use strict';

  /* ── Config ── */
  const TOTAL_STEPS = 7;
  const STEP_TITLES = [
    'Informasi Klinik',
    'Lokasi Klinik',
    'Jadwal Operasional',
    'Layanan Klinik',
    'Tim Dokter',
    'Informasi Akun',
    'Konfirmasi Data',
  ];
  const BTN_LABELS = ['Lanjut', 'Lanjut', 'Lanjut', 'Lanjut', 'Lanjut', 'Lanjut', 'Kirim Pendaftaran'];

  /* ── State ── */
  let currentStep = 1;
  let dokterCount = 1;

  /* ── DOM refs ── */
  const stepDots   = document.getElementById('stepDots');
  const stepTrack  = document.querySelector('.step-track');
  const fhTitle    = document.getElementById('fhTitle');
  const btnBack    = document.getElementById('btnBack');
  const btnNext    = document.getElementById('btnNext');
  const formBody   = document.getElementById('formBody');
  const dokterList = document.getElementById('dokterList');
  const btnTambah  = document.getElementById('btnTambahDokter');
  const confirmCard = document.getElementById('confirmCard');
  const successOverlay = document.getElementById('successOverlay');
  const successClinicName = document.getElementById('successClinicName');
  const pwdToggle  = document.getElementById('pwdToggle');
  const pwdInput   = document.getElementById('password');

  /* ── Build step dots ── */
  function buildDots() {
    stepDots.innerHTML = '';
    for (let i = 1; i <= TOTAL_STEPS; i++) {
      const dot = document.createElement('div');
      dot.className = 'step-dot';
      dot.setAttribute('role', 'listitem');
      dot.setAttribute('aria-label', `Langkah ${i}`);
      dot.textContent = i;
      stepDots.appendChild(dot);
    }
    updateDots();
  }

  function updateDots() {
    const dots = stepDots.querySelectorAll('.step-dot');
    dots.forEach((d, i) => {
      const step = i + 1;
      d.classList.remove('is-active', 'is-done');
      if (step === currentStep) d.classList.add('is-active');
      else if (step < currentStep) d.classList.add('is-done');
    });
  }

  /* ── Show / hide step panels ── */
  function showStep(n) {
    formBody.querySelectorAll('.form-step').forEach(s => {
      const stepNum = parseInt(s.dataset.step, 10);
      s.hidden = stepNum !== n;
    });

    fhTitle.textContent = STEP_TITLES[n - 1];
    btnNext.textContent = BTN_LABELS[n - 1];

    // Back button: on step 1 go to landing, else go to previous step
    btnBack.onclick = n === 1
      ? () => { window.location.href = 'index.html'; }
      : () => goTo(n - 1);

    // Scroll to top
    formBody.scrollTop = 0;
    window.scrollTo(0, 0);

    // Build confirm card on step 7
    if (n === 7) buildConfirmCard();
  }

  function goTo(n) {
    currentStep = Math.max(1, Math.min(TOTAL_STEPS, n));
    updateDots();
    showStep(currentStep);
  }

  /* ── Validation ── */
  function validateStep(n) {
    const step = document.getElementById(`step${n}`);
    if (!step) return true;

    let valid = true;

    // Required inputs & textareas
    step.querySelectorAll('[required]').forEach(el => {
      const err = el.parentElement.querySelector('.field-error') ||
                  el.closest('.field')?.querySelector('.field-error');
      if (!el.value.trim()) {
        el.classList.add('is-error');
        if (err) { err.textContent = 'Wajib diisi.'; err.classList.add('is-visible'); }
        valid = false;
      } else {
        el.classList.remove('is-error');
        if (err) err.classList.remove('is-visible');
      }
    });

    // Step 3: at least one day checked
    if (n === 3) {
      const days = step.querySelectorAll('input[name="hari"]:checked');
      const dayErr = step.querySelector('.day-error');
      if (days.length === 0) {
        if (dayErr) { dayErr.textContent = 'Pilih minimal satu hari.'; dayErr.classList.add('is-visible'); }
        valid = false;
      } else {
        if (dayErr) dayErr.classList.remove('is-visible');
      }
    }

    // Step 1: at least one hewan checked
    if (n === 1) {
      const hewans = step.querySelectorAll('input[name="hewanDilayani"]:checked');
      const hewanErr = step.querySelector('.hewan-error');
      if (hewans.length === 0) {
        if (hewanErr) { hewanErr.textContent = 'Pilih minimal satu jenis hewan.'; hewanErr.classList.add('is-visible'); }
        valid = false;
      } else {
        if (hewanErr) hewanErr.classList.remove('is-visible');
      }
    }

    // Step 4: at least one service checked
    if (n === 4) {
      const services = step.querySelectorAll('input[name="layanan"]:checked');
      const srvErr = step.querySelector('.service-error');
      if (services.length === 0) {
        if (srvErr) { srvErr.textContent = 'Pilih minimal satu layanan.'; srvErr.classList.add('is-visible'); }
        valid = false;
      } else {
        if (srvErr) srvErr.classList.remove('is-visible');
      }
    }

    // Step 2: coordinates must be set
    if (n === 2) {
      const lat = document.getElementById('klinikLat');
      const lng = document.getElementById('klinikLng');
      const coordErr = document.getElementById('step2')?.querySelector('.map-coord-error');
      if (!lat?.value || !lng?.value) {
        if (coordErr) { coordErr.textContent = 'Tentukan titik lokasi di peta.'; coordErr.classList.add('is-visible'); }
        valid = false;
      } else {
        if (coordErr) coordErr.classList.remove('is-visible');
      }
    }

    // Step 6: password match
    if (n === 6) {
      const pwd  = document.getElementById('password');
      const conf = document.getElementById('konfPassword');
      if (pwd && conf && pwd.value !== conf.value) {
        conf.classList.add('is-error');
        const err = conf.closest('.field')?.querySelector('.field-error');
        if (err) { err.textContent = 'Kata sandi tidak cocok.'; err.classList.add('is-visible'); }
        valid = false;
      }
    }

    // Step 7: TOS must be checked
    if (n === 7) {
      const tos = document.getElementById('tosCheck');
      if (tos && !tos.checked) {
        const err = tos.closest('.tos-wrap')?.nextElementSibling;
        alert('Anda harus menyetujui Syarat & Ketentuan untuk melanjutkan.');
        valid = false;
      }
    }

    return valid;
  }

  /* ── Collect all form data ── */
  function collectData() {
    const get = id => (document.getElementById(id)?.value || '').trim();
    const getChecked = name =>
      [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(el => el.value);

    /* Collect dokter entries from the dynamic list */
    const dokters = [];
    if (dokterList) {
      dokterList.querySelectorAll('.dokter-entry').forEach((entry, idx) => {
        const namaEl  = entry.querySelector(`[id^="dokterNama"]`);
        const specEl  = entry.querySelector(`[id^="dokterSpesialis"]`);
        if (namaEl || specEl) {
          dokters.push({
            nama:        (namaEl?.value  || '').trim(),
            spesialisasi:(specEl?.value  || '').trim(),
            hari:        getChecked('hari').join(', '), /* inherit clinic schedule */
          });
        }
      });
    }

    return {
      namaKlinik:    get('namaKlinik'),
      waKlinik:      get('waKlinik'),
      tipeKlinik:    get('tipeKlinik'),
      hewanDilayani: getChecked('hewanDilayani'), /* array: ['kucing','anjing','reptil'] */
      alamat:        get('alamat'),
      kota:          get('kota'),
      provinsi:      get('provinsi'),
      kodePos:       get('kodePos'),
      lat:           get('klinikLat'),
      lng:           get('klinikLng'),
      harisBuka:     getChecked('hari').join(', '),
      jamBuka:       get('jamBuka'),
      jamTutup:      get('jamTutup'),
      catatanJadwal: get('catatanJadwal'),
      layanan:       getChecked('layanan').join(', '),
      layananLain:   get('layananLain'),
      hargaMulai:    get('hargaMulai'),
      emailAkun:     get('emailAkun'),
      namaOwner:     get('namaOwner'),
      dokters:       dokters,
      logoDataUrl:   uploadData.logo || '',
      fotoDataUrl:   uploadData.foto || '',
    };
  }

  /* ── Build confirmation card ── */
  function buildConfirmCard() {
    const d = collectData();
    const rows = [
      { lbl: 'Nama Klinik',       val: d.namaKlinik    || '—' },
      { lbl: 'WhatsApp',          val: d.waKlinik       || '—' },
      { lbl: 'Tipe Layanan',      val: d.tipeKlinik === 'klinik_hewan' ? 'Klinik Hewan' : d.tipeKlinik === 'grooming_hewan' ? 'Grooming Hewan' : d.tipeKlinik || '—' },
      { lbl: 'Hewan Dilayani',    val: Array.isArray(d.hewanDilayani) && d.hewanDilayani.length ? d.hewanDilayani.map(h => h.charAt(0).toUpperCase() + h.slice(1)).join(', ') : '—' },
      { lbl: 'Alamat',            val: `${d.alamat}, ${d.kota}, ${d.provinsi} ${d.kodePos}`.replace(/^, |, $/g,'') || '—' },
      { lbl: 'Hari Buka',         val: d.harisBuka      || '—' },
      { lbl: 'Jam Operasional',   val: d.jamBuka && d.jamTutup ? `${d.jamBuka} – ${d.jamTutup}` : '—' },
      { lbl: 'Layanan',           val: d.layanan         || '—' },
      { lbl: 'Harga Mulai',       val: d.hargaMulai ? `Rp ${d.hargaMulai}` : '—' },
      { lbl: 'Email Akun',        val: d.emailAkun      || '—' },
      { lbl: 'Nama Pemilik / PIC',val: d.namaOwner      || '—' },
    ];

    confirmCard.innerHTML = rows.map(r => `
      <div class="confirm-row">
        <span class="confirm-lbl">${r.lbl}</span>
        <span class="confirm-val">${escHtml(r.val)}</span>
      </div>`).join('');
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  /* ── Submit ── */
  function submitForm() {
    const data = collectData();
    data.status    = 'pending';
    data.createdAt = new Date().toISOString();

    // Save to localStorage so the main app can read it
    const existing = JSON.parse(localStorage.getItem('mitraKlinik') || '[]');
    existing.push(data);
    localStorage.setItem('mitraKlinik', JSON.stringify(existing));

    // Show success
    if (successClinicName) successClinicName.textContent = data.namaKlinik;
    if (successOverlay) successOverlay.hidden = false;
  }

  /* ── Add dokter entry ── */
  function addDokter() {
    const entry = document.createElement('div');
    entry.className = 'dokter-entry';
    entry.id = `dokterEntry${dokterCount}`;
    entry.innerHTML = `
      <div class="dokter-header">
        <span class="dokter-num">Dokter ${dokterCount + 1}</span>
        <button class="dokter-del" type="button" aria-label="Hapus dokter">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
      <div class="field">
        <label class="field-label" for="dokterNama${dokterCount}">Nama Dokter</label>
        <input class="field-input" type="text" id="dokterNama${dokterCount}"
          name="dokterNama${dokterCount}" placeholder="drh. Nama Dokter" />
      </div>
      <div class="field">
        <label class="field-label" for="dokterSpesialis${dokterCount}">Spesialisasi</label>
        <input class="field-input" type="text" id="dokterSpesialis${dokterCount}"
          name="dokterSpesialis${dokterCount}" placeholder="Mis: Kucing & Anjing, Bedah Hewan" />
      </div>`;

    // Delete handler
    entry.querySelector('.dokter-del').addEventListener('click', () => {
      entry.remove();
      renumberDokter();
    });

    dokterList.appendChild(entry);
    dokterCount++;
  }

  function renumberDokter() {
    dokterList.querySelectorAll('.dokter-entry').forEach((el, i) => {
      const num = el.querySelector('.dokter-num');
      if (num) num.textContent = `Dokter ${i + 1}`;
    });
  }

  /* ── File upload state (holds base64 for submission) ── */
  const uploadData = {};

  /* ── File upload preview ── */
  function setupUpload(inputId, previewId, placeholderId, thumbId, dataKey) {
    const input       = document.getElementById(inputId);
    const preview     = document.getElementById(previewId);
    const placeholder = document.getElementById(placeholderId);
    const thumb       = document.getElementById(thumbId);
    if (!input) return;

    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        alert('Ukuran file maksimal 2MB.');
        input.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = e => {
        if (dataKey) uploadData[dataKey] = e.target.result; /* store for submit */
        if (thumb)       { thumb.src = e.target.result; }
        if (preview)     { preview.hidden = false; }
        if (placeholder) { placeholder.hidden = true; }
      };
      reader.readAsDataURL(file);
    });
  }

  /* ── Password toggle ── */
  function setupPwdToggle() {
    if (!pwdToggle || !pwdInput) return;
    pwdToggle.addEventListener('click', () => {
      const isHidden = pwdInput.type === 'password';
      pwdInput.type = isHidden ? 'text' : 'password';
      const icon = document.getElementById('eyeIcon');
      if (icon) {
        icon.innerHTML = isHidden
          ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>'
          : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
      }
    });
  }

  /* ── Google Maps picker ── */
  /* Called by Maps JS API after it loads (window.initMapPicker) */
  window.initMapPicker = function () {
    const btn        = document.getElementById('btnPickMap');
    const wrap       = document.getElementById('mapPickerWrap');
    const canvasEl   = document.getElementById('mapPicker');
    const latInput   = document.getElementById('klinikLat');
    const lngInput   = document.getElementById('klinikLng');
    const statusEl   = document.getElementById('mapCoordsStatus');
    if (!btn || !canvasEl) return;

    const fallback = (window.ANABULKU_CONFIG && window.ANABULKU_CONFIG.FALLBACK_CENTER)
      || { lat: -7.9666, lng: 112.6326 };

    let map = null;
    let marker = null;
    let mapReady = false;

    function setCoords(lat, lng) {
      latInput.value = lat.toFixed(7);
      lngInput.value = lng.toFixed(7);
      statusEl.textContent = `📍 Koordinat tersimpan: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      statusEl.className = 'map-coords-status map-coords-set';
      /* clear any error */
      const err = document.querySelector('.map-coord-error');
      if (err) err.classList.remove('is-visible');
    }

    function initMap(center) {
      if (mapReady) return;
      mapReady = true;
      wrap.hidden = false;

      map = new google.maps.Map(canvasEl, {
        center: center,
        zoom: 16,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      marker = new google.maps.Marker({
        position: center,
        map: map,
        draggable: true,
        title: 'Seret untuk atur lokasi',
      });

      setCoords(center.lat, center.lng);

      /* Drag end → update coords */
      marker.addListener('dragend', () => {
        const pos = marker.getPosition();
        setCoords(pos.lat(), pos.lng());
      });

      /* Click on map → move marker */
      map.addListener('click', (e) => {
        marker.setPosition(e.latLng);
        setCoords(e.latLng.lat(), e.latLng.lng());
      });
    }

    btn.addEventListener('click', () => {
      if (mapReady) {
        /* toggle visibility */
        wrap.hidden = !wrap.hidden;
        if (!wrap.hidden) google.maps.event.trigger(map, 'resize');
        return;
      }

      btn.textContent = 'Memuat peta…';
      btn.disabled = true;

      /* Try to get user's current location first */
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            btn.disabled = false;
            btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> Ubah Lokasi di Peta`;
            initMap({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          },
          () => {
            btn.disabled = false;
            btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> Ubah Lokasi di Peta`;
            initMap(fallback);
          },
          { timeout: 6000 }
        );
      } else {
        btn.disabled = false;
        initMap(fallback);
      }
    });
  };

  /* If Maps API failed to load, set up a plain-link fallback */
  window.addEventListener('load', () => {
    setTimeout(() => {
      if (typeof google === 'undefined' || !google.maps) {
        const btn = document.getElementById('btnPickMap');
        const statusEl = document.getElementById('mapCoordsStatus');
        if (btn) {
          btn.onclick = () => {
            const url = 'https://www.google.com/maps';
            window.open(url, '_blank');
            statusEl.textContent = 'Google Maps dibuka di tab baru. Salin koordinat dari URL maps dan masukkan manual.';
            statusEl.className = 'map-coords-status';
          };
        }
      }
    }, 4000);
  });

  /* ── Next / Submit button ── */
  btnNext.addEventListener('click', () => {
    if (!validateStep(currentStep)) return;
    if (currentStep === TOTAL_STEPS) {
      submitForm();
    } else {
      goTo(currentStep + 1);
    }
  });

  /* ── Add dokter button ── */
  if (btnTambah) btnTambah.addEventListener('click', addDokter);

  /* ── Init ── */
  buildDots();
  showStep(1);
  setupUpload('logoUpload', 'logoPreview', 'logoPlaceholder', 'logoThumb', 'logo');
  setupUpload('fotoUpload', 'fotoPreview', 'fotoPlaceholder', 'fotoThumb', 'foto');
  setupPwdToggle();

})();
