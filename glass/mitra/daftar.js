/* ===================================================================
   AnabulKu Mitra — daftar.js
   Multi-step form logic for daftar.html (7 steps)
=================================================================== */

(function () {
  'use strict';

  /* ── Config ── */
  const TOTAL_STEPS = 6;
  const STEP_TITLES = [
    'Informasi Klinik',
    'Lokasi Klinik',
    'Jadwal Operasional',
    'Layanan Klinik',
    'Informasi Akun',
    'Konfirmasi Data',
  ];
  const BTN_LABELS = ['Lanjut', 'Lanjut', 'Lanjut', 'Lanjut', 'Lanjut', 'Kirim Pendaftaran'];

  /* ── State ── */
  let currentStep = 1;
  let mapAutoOpen = false; /* set to true when step 2 is shown before Maps API is ready */

  /* ── DOM refs ── */
  const stepDots   = document.getElementById('stepDots');
  const stepTrack  = document.querySelector('.step-track');
  const fhTitle    = document.getElementById('fhTitle');
  const btnBack    = document.getElementById('btnBack');
  const btnNext    = document.getElementById('btnNext');
  const formBody   = document.getElementById('formBody');
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

    // Build confirm card on step 6
    if (n === 6) buildConfirmCard();

    // Auto-open map when arriving at step 2
    if (n === 2) {
      mapAutoOpen = true; /* flag read by initMapPicker */
      setTimeout(function () {
        var btn = document.getElementById('btnPickMap');
        /* Maps API already loaded — open immediately */
        if (btn && typeof google !== 'undefined' && google.maps && google.maps.Map) {
          btn.click();
          mapAutoOpen = false;
        }
        /* else: initMapPicker callback will handle it via the mapAutoOpen flag */
      }, 150);
    }
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

    // Step 3: at least one day toggle ON
    if (n === 3) {
      const onToggles = step.querySelectorAll('.jadwal-toggle.is-on');
      const dayErr = step.querySelector('.day-error');
      if (onToggles.length === 0) {
        if (dayErr) { dayErr.textContent = 'Aktifkan minimal satu hari operasional.'; dayErr.classList.add('is-visible'); }
        valid = false;
      } else {
        if (dayErr) dayErr.classList.remove('is-visible');
      }
    }

    // Step 1: at least one tipe layanan checked
    if (n === 1) {
      const tipes = step.querySelectorAll('input[name="tipeLayanan"]:checked');
      const tipeErr = step.querySelector('.tipe-error');
      if (tipes.length === 0) {
        if (tipeErr) { tipeErr.textContent = 'Pilih minimal satu tipe layanan.'; tipeErr.classList.add('is-visible'); }
        valid = false;
      } else {
        if (tipeErr) tipeErr.classList.remove('is-visible');
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

    // Step 4: layanan sudah fixed (konsultasi umum), tidak perlu validasi checkbox

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

    // Step 5: password match
    if (n === 5) {
      const pwd  = document.getElementById('password');
      const conf = document.getElementById('konfPassword');
      if (pwd && conf && pwd.value !== conf.value) {
        conf.classList.add('is-error');
        const err = conf.closest('.field')?.querySelector('.field-error');
        if (err) { err.textContent = 'Kata sandi tidak cocok.'; err.classList.add('is-visible'); }
        valid = false;
      }
    }

    // Step 6: TOS must be checked
    if (n === 6) {
      const tos = document.getElementById('tosCheck');
      if (tos && !tos.checked) {
        alert('Anda harus menyetujui Syarat & Ketentuan untuk melanjutkan.');
        valid = false;
      }
    }

    return valid;
  }

  /* ── Collect jadwal per hari dari toggle UI ── */
  function collectJadwal() {
    const rows = document.querySelectorAll('#jadwalList .jadwal-row');
    const jadwal = [];
    rows.forEach(row => {
      const day     = row.dataset.day;
      const toggle  = row.querySelector('.jadwal-toggle');
      const isOn    = toggle && toggle.classList.contains('is-on');
      const inputs  = row.querySelectorAll('.jadwal-input');
      jadwal.push({
        hari:    day,
        buka:    isOn,
        jamBuka: isOn && inputs[0] ? inputs[0].value : '',
        jamTutup: isOn && inputs[1] ? inputs[1].value : '',
      });
    });
    return jadwal;
  }

  /* ── Collect all form data ── */
  function collectData() {
    const get = id => (document.getElementById(id)?.value || '').trim();
    const getChecked = name =>
      [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(el => el.value);

    const jadwal = collectJadwal();
    const hariAktif = jadwal.filter(j => j.buka).map(j => j.hari);

    return {
      namaKlinik:      get('namaKlinik'),
      waKlinik:        get('waKlinik'),
      tipeKlinik:      getChecked('tipeLayanan'),
      hewanDilayani:   getChecked('hewanDilayani'),
      alamat:          get('alamat'),
      kota:            get('kota'),
      provinsi:        get('provinsi'),
      kodePos:         get('kodePos'),
      lat:             get('klinikLat'),
      lng:             get('klinikLng'),
      formattedAddress:get('formattedAddress'),
      googleRating:    get('googleRating'),
      jadwal:          jadwal,
      harisBuka:       hariAktif.join(', '),
      layanan:         'Konsultasi Umum',
      hargaMulai:      get('hargaMulai'),
      emailAkun:       get('emailAkun'),
      namaOwner:       get('namaOwner'),
      logoDataUrl:     uploadData.logo || '',
      fotoDataUrl:     uploadData.foto || '',
    };
  }

  /* ── Build confirmation card ── */
  function buildConfirmCard() {
    const d = collectData();

    // Format jadwal untuk ditampilkan
    const jadwalText = Array.isArray(d.jadwal)
      ? d.jadwal
          .filter(j => j.buka)
          .map(j => `${j.hari} (${j.jamBuka}–${j.jamTutup})`)
          .join(', ') || '—'
      : d.harisBuka || '—';

    const rows = [
      { lbl: 'Nama Klinik',        val: d.namaKlinik    || '—' },
      { lbl: 'WhatsApp',           val: d.waKlinik       || '—' },
      { lbl: 'Tipe Layanan',       val: Array.isArray(d.tipeKlinik) && d.tipeKlinik.length ? d.tipeKlinik.map(t => t === 'klinik_hewan' ? 'Klinik Hewan' : t === 'grooming_hewan' ? 'Grooming Hewan' : t).join(', ') : '—' },
      { lbl: 'Hewan Dilayani',     val: Array.isArray(d.hewanDilayani) && d.hewanDilayani.length ? d.hewanDilayani.map(h => h.charAt(0).toUpperCase() + h.slice(1)).join(', ') : '—' },
      { lbl: 'Alamat',             val: `${d.alamat}, ${d.kota}, ${d.provinsi} ${d.kodePos}`.replace(/^, |, $/g,'') || '—' },
      { lbl: 'Jadwal Operasional', val: jadwalText },
      { lbl: 'Layanan',            val: d.layanan         || '—' },
      { lbl: 'Harga Mulai',        val: d.hargaMulai ? `Rp ${d.hargaMulai}` : '—' },
      { lbl: 'Email Akun',         val: d.emailAkun      || '—' },
      { lbl: 'Nama Pemilik / PIC', val: d.namaOwner      || '—' },
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
    data.adminStatus = 'pending'; /* menunggu persetujuan admin */
    data.status      = 'pending'; /* backward compat */
    data.createdAt   = new Date().toISOString();
    data.id          = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

    // Simpan password (simpan as-is untuk demo)
    const pwdVal = document.getElementById('password')?.value || '';
    data.password = pwdVal;

    // Save to localStorage so the admin app can read it
    const existing = JSON.parse(localStorage.getItem('mitraKlinik') || '[]');
    existing.push(data);
    localStorage.setItem('mitraKlinik', JSON.stringify(existing));

    // TIDAK auto-login — mitra harus menunggu persetujuan admin
    // Setelah admin ACC, mitra dapat login melalui login.html
    localStorage.removeItem('mitraSession');

    // Show success
    if (successClinicName) successClinicName.textContent = data.namaKlinik;
    if (successOverlay) successOverlay.hidden = false;
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

    /* If user already navigated to step 2 before API loaded, open automatically */
    if (mapAutoOpen) {
      mapAutoOpen = false;
      setTimeout(function () { btn.click(); }, 50);
    }

    const fallback = (window.ANABULKU_CONFIG && window.ANABULKU_CONFIG.FALLBACK_CENTER)
      || { lat: -7.9666, lng: 112.6326 };

    let map = null;
    let marker = null;
    let mapReady = false;

    const geocoder = new google.maps.Geocoder();

    function autofillFromGeocode(lat, lng) {
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status !== 'OK' || !results || !results.length) return;

        /* Use the first (most precise) result */
        const result = results[0];
        const comps  = result.address_components || [];

        /* Helpers */
        const get = (types) => {
          const c = comps.find(c => types.some(t => c.types.includes(t)));
          return c ? c.long_name : '';
        };
        const getShort = (types) => {
          const c = comps.find(c => types.some(t => c.types.includes(t)));
          return c ? c.short_name : '';
        };

        /* Build street address: route + street_number */
        const route  = get(['route']);
        const number = get(['street_number']);
        const sublocality = get(['sublocality_level_1', 'sublocality', 'neighborhood']);
        const streetAddr  = [route, number].filter(Boolean).join(' ')
          || sublocality
          || result.formatted_address.split(',')[0];

        const kota     = get(['locality', 'administrative_area_level_2', 'regency']);
        const provinsi = get(['administrative_area_level_1']);
        const kodePos  = get(['postal_code']);

        /* Autofill form fields — only if they are empty or user hasn't manually edited */
        const alamatEl   = document.getElementById('alamat');
        const kotaEl     = document.getElementById('kota');
        const provinsiEl = document.getElementById('provinsi');
        const kodePosEl  = document.getElementById('kodePos');

        if (alamatEl)   alamatEl.value   = streetAddr  || result.formatted_address;
        if (kotaEl)     kotaEl.value     = kota;
        if (kodePosEl)  kodePosEl.value  = kodePos;

        /* Provinsi is a <select> — try to match by text */
        if (provinsiEl && provinsi) {
          const opts = Array.from(provinsiEl.options);
          const match = opts.find(o =>
            o.value.toLowerCase().includes(provinsi.toLowerCase()) ||
            provinsi.toLowerCase().includes(o.value.toLowerCase())
          );
          if (match) provinsiEl.value = match.value;
        }

        /* Store formatted_address for user app display */
        const hiddenAddr = document.getElementById('formattedAddress');
        if (hiddenAddr) hiddenAddr.value = result.formatted_address;

        /* Update status */
        statusEl.textContent = `📍 ${streetAddr || result.formatted_address}`;
        statusEl.className = 'map-coords-status map-coords-set';
      });
    }

    /* Places Nearby Search — get Google rating for the clinic location */
    function fetchGoogleRating(lat, lng) {
      if (!google.maps.places || !google.maps.places.PlacesService) return;
      const svc = new google.maps.places.PlacesService(map);
      svc.nearbySearch(
        { location: { lat, lng }, radius: 50, type: 'veterinary_care' },
        (results, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && results && results[0]) {
            const r = results[0].rating;
            if (r != null) {
              const hiddenRating = document.getElementById('googleRating');
              if (hiddenRating) hiddenRating.value = r;
            }
          }
        }
      );
    }

    function setCoords(lat, lng) {
      latInput.value = lat.toFixed(7);
      lngInput.value = lng.toFixed(7);
      /* clear any error */
      const err = document.querySelector('.map-coord-error');
      if (err) err.classList.remove('is-visible');

      /* Reverse geocode → autofill address fields + status */
      autofillFromGeocode(lat, lng);

      /* Try to fetch Places rating */
      if (map) fetchGoogleRating(lat, lng);
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

      /* Wait for map to finish first render before geocoding/places calls */
      google.maps.event.addListenerOnce(map, 'idle', function () {
        setCoords(center.lat, center.lng);
      });

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

  /* ── Jadwal toggle handler ── */
  function setupJadwalToggles() {
    const jadwalList = document.getElementById('jadwalList');
    if (!jadwalList) return;
    jadwalList.addEventListener('click', e => {
      const toggle = e.target.closest('.jadwal-toggle');
      if (!toggle) return;
      const row        = toggle.closest('.jadwal-row');
      const jamWrap    = row.querySelector('.jadwal-jam');
      const tutupLabel = row.querySelector('.jadwal-tutup-label');
      const namaEl     = row.querySelector('.jadwal-nama');
      const isOn       = toggle.classList.toggle('is-on');

      toggle.setAttribute('aria-pressed', isOn ? 'true' : 'false');
      if (jamWrap)    jamWrap.hidden    = !isOn;
      if (tutupLabel) tutupLabel.hidden = isOn;
      if (namaEl)     namaEl.classList.toggle('jadwal-nama--off', !isOn);
    });
  }

  /* ── Init ── */
  buildDots();
  showStep(1);
  setupUpload('logoUpload', 'logoPreview', 'logoPlaceholder', 'logoThumb', 'logo');
  setupUpload('fotoUpload', 'fotoPreview', 'fotoPlaceholder', 'fotoThumb', 'foto');
  setupPwdToggle();
  setupJadwalToggles();

})();
