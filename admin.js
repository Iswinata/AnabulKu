/* ===================================================================
   AnabulKu — Admin Panel JS
   Data dibaca dari localStorage:
     mitraKlinik        → daftar klinik terdaftar
     anabulku_bookings  → semua booking
     anabulku_pengumuman → pengumuman platform
     anabulku_settings  → pengaturan aplikasi
     anabulku_admin_creds → kredensial admin
=================================================================== */
(function () {
  'use strict';

  /* ── Storage helpers ── */
  const LS = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  };

  /* ── Admin credentials ── */
  const CREDS_VERSION = 2;
  (function initCreds() {
    const stored = LS.get('anabulku_admin_creds', null);
    if (!stored || stored._v !== CREDS_VERSION) {
      LS.set('anabulku_admin_creds', {
        _v: CREDS_VERSION,
        username: 'AnabulKu',
        password: 'QwOp1290',
        nama: 'Admin AnabulKu',
      });
    }
  })();

  function getAdminCreds() {
    return LS.get('anabulku_admin_creds', {
      _v: CREDS_VERSION,
      username: 'AnabulKu',
      password: 'QwOp1290',
      nama: 'Admin AnabulKu',
    });
  }

  /* ── Util ── */
  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso.includes('T') ? iso : iso + 'T00:00');
    return d.toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
  }

  function todayStr() { return new Date().toISOString().slice(0,10); }

  function rupiah(n) {
    const num = parseInt(String(n).replace(/\D/g,''), 10);
    if (!num) return 'Rp 0';
    return 'Rp ' + num.toLocaleString('id-ID');
  }

  function rupiahNum(n) {
    return parseInt(String(n || 0).replace(/\D/g,''), 10) || 0;
  }

  function badgeHtml(status) {
    const map = {
      pending:      ['badge--pending',      'Menunggu'],
      aktif:        ['badge--aktif',         'Aktif'],
      ditolak:      ['badge--ditolak',       'Ditolak'],
      nonaktif:     ['badge--nonaktif',      'Nonaktif'],
      menunggu:     ['badge--menunggu',      'Menunggu'],
      dikonfirmasi: ['badge--dikonfirmasi',  'Dikonfirmasi'],
      selesai:      ['badge--selesai',       'Selesai'],
      dibatalkan:   ['badge--dibatalkan',    'Dibatalkan'],
      info:         ['badge--info',          'Info'],
      warning:      ['badge--warning',       'Peringatan'],
      promo:        ['badge--promo',         'Promo'],
    };
    const [cls, lbl] = map[status] || ['badge--nonaktif', status];
    return `<span class="badge ${cls}">${lbl}</span>`;
  }

  /* ── Load / Save data ── */
  function getKliniks()     { return LS.get('mitraKlinik', []); }
  function getBookings()    { return LS.get('anabulku_bookings', []); }
  function getPengumuman()  { return LS.get('anabulku_pengumuman', []); }
  function getSettings()    { return LS.get('anabulku_settings', { registrasi: true, autoApprove: false, maintenance: false }); }

  function saveKliniks(list)    { LS.set('mitraKlinik', list); }
  function saveBookings(list)   { LS.set('anabulku_bookings', list); }
  function savePengumuman(list) { LS.set('anabulku_pengumuman', list); }
  function saveSettings(obj)    { LS.set('anabulku_settings', obj); }

  /* ── Klinik status helper ── */
  function klinikStatus(c) { return c.adminStatus || 'pending'; }

  /* ================================================================
     NAVIGATION
  ================================================================ */
  const pages = {
    overview:   document.getElementById('pageOverview'),
    klinik:     document.getElementById('pageKlinik'),
    booking:    document.getElementById('pageBooking'),
    keuangan:   document.getElementById('pageKeuangan'),
    pengguna:   document.getElementById('pagePengguna'),
    laporan:    document.getElementById('pageLaporan'),
    konten:     document.getElementById('pageKonten'),
    pengaturan: document.getElementById('pagePengaturan'),
  };

  const navItems    = document.querySelectorAll('.nav-item[data-page]');
  const topbarTitle = document.getElementById('topbarTitle');

  function goPage(name) {
    if (!pages[name]) return;
    Object.entries(pages).forEach(([k, el]) => { el.hidden = k !== name; });
    navItems.forEach(a => {
      const active = a.dataset.page === name;
      a.classList.toggle('is-active', active);
      a.setAttribute('aria-current', active ? 'page' : 'false');
    });
    const titles = {
      overview: 'Overview', klinik: 'Klinik Mitra', booking: 'Semua Booking',
      keuangan: 'Keuangan', pengguna: 'Pengguna', laporan: 'Laporan & Analitik',
      konten: 'Konten', pengaturan: 'Pengaturan',
    };
    topbarTitle.textContent = titles[name] || '';
    closeSidebar();

    if (name === 'overview')   renderOverview();
    if (name === 'klinik')     renderKlinikTable();
    if (name === 'booking')    renderBookingTable();
    if (name === 'keuangan')   renderKeuangan();
    if (name === 'pengguna')   renderPenggunaTable();
    if (name === 'laporan')    renderLaporan();
    if (name === 'konten')     renderKonten();
    if (name === 'pengaturan') loadPengaturan();
  }

  navItems.forEach(a => {
    a.addEventListener('click', e => { e.preventDefault(); goPage(a.dataset.page); });
  });

  document.querySelectorAll('[data-page]').forEach(el => {
    if (el.tagName === 'A') {
      el.addEventListener('click', e => { e.preventDefault(); goPage(el.dataset.page); });
    }
  });

  /* ── Sidebar mobile ── */
  const sidebar        = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');

  function openSidebar()  { sidebar.classList.add('is-open'); sidebarOverlay.hidden = false; }
  function closeSidebar() { sidebar.classList.remove('is-open'); sidebarOverlay.hidden = true; }

  document.getElementById('btnSidebarToggle').addEventListener('click', () => {
    sidebar.classList.contains('is-open') ? closeSidebar() : openSidebar();
  });
  sidebarOverlay.addEventListener('click', closeSidebar);

  /* ── Logout → kembali ke halaman login ── */
  document.getElementById('btnLogout').addEventListener('click', () => {
    LS.set('anabulku_admin_session', { loggedIn: false });
    window.location.replace('admin-login.html');
  });

  /* ── Toast ── */
  const toastEl = document.getElementById('toast');
  let toastTimer;
  function showToast(msg, type = 'success') {
    toastEl.textContent = msg;
    toastEl.className = `toast toast--${type} is-visible`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 3000);
  }

  /* ── Nav badges ── */
  function updateBadges() {
    const kliniks  = getKliniks();
    const bookings = getBookings();
    const pendingK = kliniks.filter(c => !c.adminStatus || c.adminStatus === 'pending').length;
    const pendingB = bookings.filter(b => b.status === 'menunggu').length;

    const bK = document.getElementById('navBadgeKlinik');
    bK.textContent = pendingK; bK.hidden = pendingK === 0;

    const bB = document.getElementById('navBadgeBooking');
    bB.textContent = pendingB; bB.hidden = pendingB === 0;
  }

  /* ── Set admin name in sidebar ── */
  function initAdminInfo() {
    const creds = getAdminCreds();
    const session = LS.get('anabulku_admin_session', {});
    const nama = session.nama || creds.nama || 'Admin AnabulKu';
    document.getElementById('sidebarAdminName').textContent = nama;
    const av = document.querySelector('.admin-avatar');
    if (av) av.textContent = nama.charAt(0).toUpperCase();
  }

  /* ================================================================
     OVERVIEW
  ================================================================ */
  function renderOverview() {
    const kliniks  = getKliniks();
    const bookings = getBookings();
    const totalOmset = bookings
      .filter(b => b.status === 'selesai')
      .reduce((s, b) => s + rupiahNum(b.biaya), 0);

    document.getElementById('statKlinik').textContent  = kliniks.length;
    document.getElementById('statPending').textContent = kliniks.filter(c => !c.adminStatus || c.adminStatus === 'pending').length;
    document.getElementById('statBooking').textContent = bookings.length;
    document.getElementById('statOmset').textContent   = rupiah(totalOmset);

    /* Greeting */
    const h = new Date().getHours();
    const greet = h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
    const creds = getAdminCreds();
    document.getElementById('overviewGreeting').textContent = `${greet}, ${creds.nama || 'Admin'}!`;
    document.getElementById('pageDate').textContent = new Date().toLocaleDateString('id-ID', {
      weekday:'long', day:'numeric', month:'long', year:'numeric'
    });

    /* Pending klinik */
    const pendingList = kliniks.filter(c => !c.adminStatus || c.adminStatus === 'pending');
    const pendingEl = document.getElementById('pendingKlinikList');
    if (!pendingList.length) {
      pendingEl.innerHTML = '<p class="empty-state">Tidak ada klinik yang menunggu persetujuan.</p>';
    } else {
      pendingEl.innerHTML = pendingList.slice(0, 5).map((c) => {
        const idx = kliniks.indexOf(c);
        return `<div class="pending-item">
          <div class="pending-item-info">
            <p class="pending-item-name">${esc(c.namaKlinik || 'Klinik')}</p>
            <p class="pending-item-sub">${esc(c.kota || '')} · ${esc(c.namaOwner || '')} · ${fmtDate(c.createdAt || c.registeredAt)}</p>
          </div>
          <div class="pending-item-btns">
            <button class="btn-icon btn-icon--approve" title="Setujui" onclick="approveKlinik(${idx})">✓</button>
            <button class="btn-icon btn-icon--reject"  title="Tolak"   onclick="rejectKlinik(${idx})">✕</button>
            <button class="btn-icon btn-icon--view"    title="Detail"  onclick="viewKlinik(${idx})">👁</button>
          </div>
        </div>`;
      }).join('');
    }

    /* Recent bookings */
    const recentEl = document.getElementById('recentBookingList');
    const recent = [...bookings].sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||'')).slice(0, 6);
    if (!recent.length) {
      recentEl.innerHTML = '<p class="empty-state">Belum ada booking.</p>';
    } else {
      recentEl.innerHTML = recent.map(b => `
        <div class="booking-item">
          <span class="booking-item-time">${esc(b.jam || '—')}</span>
          <div class="booking-item-info">
            <p class="booking-item-name">${esc(b.namaPemilik)} — <em>${esc(b.namaHewan)}</em></p>
            <p class="booking-item-sub">${esc(b.namaKlinik || b.dokter || '—')} · ${fmtDate(b.tanggal)}</p>
          </div>
          ${badgeHtml(b.status)}
        </div>`).join('');
    }

    updateBadges();
  }

  /* ================================================================
     KLINIK MITRA
  ================================================================ */
  let klinikFilter = 'semua';
  let klinikSearch = '';

  function renderKlinikTable() {
    updateBadges();
    // Build {clinic, idx} pairs from a single parse so indexOf is not needed
    const allKliniks = getKliniks();
    let pairs = allKliniks.map((c, i) => ({ c, idx: i }));

    if (klinikFilter !== 'semua') pairs = pairs.filter(p => klinikStatus(p.c) === klinikFilter);
    if (klinikSearch) {
      const q = klinikSearch.toLowerCase();
      pairs = pairs.filter(p =>
        (p.c.namaKlinik||'').toLowerCase().includes(q) ||
        (p.c.kota||'').toLowerCase().includes(q) ||
        (p.c.namaOwner||'').toLowerCase().includes(q)
      );
    }

    const tbody = document.getElementById('klinikTbody');
    if (!pairs.length) {
      tbody.innerHTML = '<tr><td colspan="10" class="empty-state">Tidak ada data klinik.</td></tr>';
      return;
    }

    tbody.innerHTML = pairs.map(({ c, idx }, i) => {
      const st  = klinikStatus(c);
      const hewan = Array.isArray(c.hewanDilayani) ? c.hewanDilayani.join(', ') : (c.hewanDilayani || '—');
      return `<tr>
        <td>${i + 1}</td>
        <td><strong>${esc(c.namaKlinik || '—')}</strong></td>
        <td>${esc(c.kota || '—')}</td>
        <td>${esc(c.tipeKlinik || '—')}</td>
        <td style="max-width:120px;white-space:normal;font-size:12px">${esc(hewan)}</td>
        <td>${esc(c.namaOwner || '—')}</td>
        <td style="font-size:12px">${esc(c.waKlinik || '—')}</td>
        <td>${badgeHtml(st)}</td>
        <td style="font-size:12px;white-space:nowrap">${fmtDate(c.createdAt || c.registeredAt)}</td>
        <td>
          <div class="action-btns">
            ${st === 'pending' ? `
              <button class="btn-icon btn-icon--approve" title="Setujui" onclick="approveKlinik(${idx})">✓</button>
              <button class="btn-icon btn-icon--reject"  title="Tolak"   onclick="rejectKlinik(${idx})">✕</button>
            ` : ''}
            ${st === 'aktif' ? `<button class="btn-icon btn-icon--nonaktif" title="Nonaktifkan" onclick="nonaktifKlinik(${idx})">⊘</button>` : ''}
            ${st === 'nonaktif' || st === 'ditolak' ? `<button class="btn-icon btn-icon--approve" title="Aktifkan" onclick="approveKlinik(${idx})">✓</button>` : ''}
            <button class="btn-icon btn-icon--view"  title="Detail" onclick="viewKlinik(${idx})">👁</button>
            <button class="btn-icon btn-icon--del"   title="Hapus"  onclick="hapusKlinik(${idx})">🗑</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  document.querySelectorAll('#pageKlinik .filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#pageKlinik .filter-tab').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      klinikFilter = btn.dataset.filter;
      renderKlinikTable();
    });
  });

  document.getElementById('klinikSearch').addEventListener('input', e => {
    klinikSearch = e.target.value.trim();
    renderKlinikTable();
  });

  /* ── Sync klinik yang sudah aktif ke anabulku:partner:clinics
       agar mitra.js & clinics.js (home.html) dapat membacanya ── */
  function syncApprovedToPartnerList(klinikObj) {
    if (!klinikObj || !klinikObj.namaKlinik) return;
    const clinic = {
      id:              klinikObj.id || ('mitra-' + Date.now()),
      name:            klinikObj.namaKlinik,
      namaKlinik:      klinikObj.namaKlinik,
      address:         [klinikObj.alamat, klinikObj.kota, klinikObj.provinsi].filter(Boolean).join(', '),
      alamat:          klinikObj.alamat || '',
      kota:            klinikObj.kota || '',
      provinsi:        klinikObj.provinsi || '',
      whatsapp:        klinikObj.waKlinik || '',
      waKlinik:        klinikObj.waKlinik || '',
      tipeKlinik:      klinikObj.tipeKlinik || '',
      hewanDilayani:   Array.isArray(klinikObj.hewanDilayani) ? klinikObj.hewanDilayani : [],
      layanan:         klinikObj.layanan || [],
      jadwal:          klinikObj.jadwal || [],
      harisBuka:       klinikObj.harisBuka || '',
      jamBuka:         klinikObj.jamBuka || '',
      jamTutup:        klinikObj.jamTutup || '',
      rating:          klinikObj.googleRating || klinikObj.rating || null,
      ratingCount:     0,
      lat:             klinikObj.lat || '',
      lng:             klinikObj.lng || '',
      formattedAddress:klinikObj.formattedAddress || '',
      photo:           klinikObj.fotoDataUrl || '',
      fotoDataUrl:     klinikObj.fotoDataUrl || '',
      logo:            klinikObj.logoDataUrl || '',
      logoDataUrl:     klinikObj.logoDataUrl || '',
      mapsUri:         klinikObj.googleMaps || '',
      adminStatus:     'aktif',
      approvedAt:      klinikObj.approvedAt || new Date().toISOString(),
      registeredAt:    klinikObj.createdAt || klinikObj.registeredAt || new Date().toISOString(),
    };

    try {
      const raw  = localStorage.getItem('anabulku:partner:clinics');
      const list = raw ? JSON.parse(raw) : [];
      const idx  = list.findIndex(c => c.id === clinic.id || c.namaKlinik === clinic.namaKlinik);
      if (idx >= 0) list[idx] = clinic;
      else list.push(clinic);
      localStorage.setItem('anabulku:partner:clinics', JSON.stringify(list));
    } catch (_) { /* storage penuh — abaikan */ }
  }

  /* Hapus klinik dari anabulku:partner:clinics saat nonaktif / ditolak */
  function removeFromPartnerList(namaKlinik) {
    try {
      const raw  = localStorage.getItem('anabulku:partner:clinics');
      if (!raw) return;
      const list = JSON.parse(raw).filter(c => c.namaKlinik !== namaKlinik);
      localStorage.setItem('anabulku:partner:clinics', JSON.stringify(list));
    } catch (_) {}
  }

  /* Global klinik actions */
  window.approveKlinik = function(idx) {
    const list = getKliniks();
    if (!list[idx]) return;
    list[idx].adminStatus = 'aktif';
    list[idx].approvedAt  = new Date().toISOString();
    saveKliniks(list);
    syncApprovedToPartnerList(list[idx]);   /* ← sync ke partner list */
    renderKlinikTable(); renderOverview();
    showToast('Klinik disetujui dan kini aktif.');
  };

  window.rejectKlinik = function(idx) {
    const list = getKliniks();
    if (!list[idx]) return;
    const nama = list[idx].namaKlinik;
    list[idx].adminStatus = 'ditolak';
    saveKliniks(list);
    removeFromPartnerList(nama);           /* ← hapus dari user app */
    renderKlinikTable(); renderOverview();
    showToast('Klinik ditolak.', 'error');
  };

  window.nonaktifKlinik = function(idx) {
    if (!confirm('Nonaktifkan klinik ini?')) return;
    const list = getKliniks();
    if (!list[idx]) return;
    const nama = list[idx].namaKlinik;
    list[idx].adminStatus = 'nonaktif';
    saveKliniks(list);
    removeFromPartnerList(nama);           /* ← hapus dari user app */
    renderKlinikTable();
    showToast('Klinik dinonaktifkan.');
  };

  window.hapusKlinik = function(idx) {
    const list = getKliniks();
    const nama = list[idx]?.namaKlinik || 'klinik ini';
    if (!confirm(`Hapus "${nama}" secara permanen? Data tidak dapat dikembalikan.`)) return;
    removeFromPartnerList(nama);           /* ← hapus dari user app */
    list.splice(idx, 1);
    saveKliniks(list);
    renderKlinikTable(); renderOverview();
    showToast('Klinik dihapus.', 'error');
  };

  window.viewKlinik = function(idx) {
    const list = getKliniks();
    const c = list[idx];
    if (!c) return;
    const hewan = Array.isArray(c.hewanDilayani) ? c.hewanDilayani.join(', ') : (c.hewanDilayani || '—');
    const st = klinikStatus(c);
    const dokters = Array.isArray(c.dokters) ? c.dokters.map(d => esc(d.nama)).join(', ') : '—';

    const info = [
      ['Nama Klinik',    c.namaKlinik || '—'],
      ['Status',         null, badgeHtml(st)],
      ['Pemilik',        c.namaOwner || '—'],
      ['WhatsApp',       c.waKlinik || '—'],
      ['Tipe Klinik',    c.tipeKlinik || '—'],
      ['Hewan Dilayani', hewan],
      ['Alamat',         `${c.alamat || '—'}, ${c.kota || ''}, ${c.provinsi || ''}`],
      ['Jam Operasional',`${c.jamBuka || '—'} – ${c.jamTutup || '—'}`],
      ['Hari Buka',      Array.isArray(c.harisBuka) ? c.harisBuka.join(', ') : (c.harisBuka || '—')],
      ['Terdaftar',      fmtDate(c.createdAt || c.registeredAt)],
      ['Dokter',         dokters],
    ];

    const rows = info.map(([lbl, val, html]) =>
      `<div class="klinik-detail-row">
        <span class="klinik-detail-lbl">${lbl}</span>
        <span class="klinik-detail-val">${html || esc(val)}</span>
      </div>`
    ).join('');

    const detailHtml = `
      <div class="klinik-detail-panel">
        <h3 class="klinik-detail-title">${esc(c.namaKlinik || 'Detail Klinik')}</h3>
        <div class="klinik-detail-grid">${rows}</div>
        <div class="klinik-detail-actions">
          ${st === 'pending' ? `
            <button class="btn-success" onclick="approveKlinik(${idx});document.getElementById('klinikDetailPanel').remove()">✓ Setujui</button>
            <button class="btn-danger" style="width:auto" onclick="rejectKlinik(${idx});document.getElementById('klinikDetailPanel').remove()">✕ Tolak</button>
          ` : ''}
          ${st === 'aktif' ? `<button class="btn-outline-danger" onclick="nonaktifKlinik(${idx});document.getElementById('klinikDetailPanel').remove()">⊘ Nonaktifkan</button>` : ''}
          ${st === 'nonaktif' || st === 'ditolak' ? `<button class="btn-success" onclick="approveKlinik(${idx});document.getElementById('klinikDetailPanel').remove()">✓ Aktifkan</button>` : ''}
          <button class="btn-ghost" onclick="document.getElementById('klinikDetailPanel').remove()">✕ Tutup</button>
        </div>
      </div>`;

    // Remove existing panel if any
    const existing = document.getElementById('klinikDetailPanel');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'klinikDetailPanel';
    overlay.className = 'detail-panel-overlay';
    overlay.innerHTML = detailHtml;
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  };

  /* Export klinik CSV */
  document.getElementById('btnExportKlinik').addEventListener('click', () => {
    const list = getKliniks();
    const rows = [['No','Nama Klinik','Kota','Tipe','Pemilik','WhatsApp','Status','Terdaftar']];
    list.forEach((c, i) => {
      rows.push([i+1, c.namaKlinik||'', c.kota||'', c.tipeKlinik||'',
        c.namaOwner||'', c.waKlinik||'', klinikStatus(c), fmtDate(c.createdAt||c.registeredAt)]);
    });
    downloadCsv(rows, 'klinik-mitra.csv');
    showToast('Data klinik diekspor.');
  });

  /* ================================================================
     BOOKING
  ================================================================ */
  let bookingFilter = 'semua';
  let bookingSearch = '';
  let bookingDate   = '';

  function renderBookingTable() {
    updateBadges();
    let data = [...getBookings()].sort((a,b) =>
      ((b.tanggal||'')+(b.jam||'')).localeCompare((a.tanggal||'')+(a.jam||''))
    );

    if (bookingFilter !== 'semua') data = data.filter(b => b.status === bookingFilter);
    if (bookingDate) data = data.filter(b => b.tanggal === bookingDate);
    if (bookingSearch) {
      const q = bookingSearch.toLowerCase();
      data = data.filter(b =>
        (b.namaPemilik||'').toLowerCase().includes(q) ||
        (b.namaHewan||'').toLowerCase().includes(q) ||
        (b.namaKlinik||'').toLowerCase().includes(q)
      );
    }

    const tbody = document.getElementById('bookingTbody');
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty-state">Tidak ada data booking.</td></tr>';
      return;
    }

    tbody.innerHTML = data.map((b, i) => `
      <tr>
        <td>${i+1}</td>
        <td>${esc(fmtDate(b.tanggal))}<br><small style="color:#9CA3AF">${esc(b.jam||'')}</small></td>
        <td style="font-size:12px">${esc(b.namaKlinik || '—')}</td>
        <td><strong>${esc(b.namaPemilik)}</strong><br><small style="color:#9CA3AF">${esc(b.noHP||'')}</small></td>
        <td>${esc(b.namaHewan)} <small style="color:#9CA3AF">(${esc(b.jenisHewan||'')})</small></td>
        <td style="font-size:12px">${esc(b.dokter||'—')}</td>
        <td>Konsultasi Umum</td>
        <td>${rupiah(b.biaya)}</td>
        <td>${badgeHtml(b.status)}</td>
      </tr>`).join('');
  }

  document.querySelectorAll('#pageBooking .filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#pageBooking .filter-tab').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      bookingFilter = btn.dataset.filter;
      renderBookingTable();
    });
  });

  document.getElementById('bookingSearch').addEventListener('input', e => {
    bookingSearch = e.target.value.trim();
    renderBookingTable();
  });

  document.getElementById('bookingDateFilter').addEventListener('change', e => {
    bookingDate = e.target.value;
    renderBookingTable();
  });

  document.getElementById('btnExportBooking').addEventListener('click', () => {
    const data = getBookings();
    const rows = [['No','Tanggal','Jam','Klinik','Pemilik','No HP','Hewan','Jenis','Dokter','Biaya','Status']];
    data.forEach((b, i) => {
      rows.push([i+1, b.tanggal||'', b.jam||'', b.namaKlinik||'',
        b.namaPemilik||'', b.noHP||'', b.namaHewan||'', b.jenisHewan||'',
        b.dokter||'', rupiahNum(b.biaya), b.status||'']);
    });
    downloadCsv(rows, 'booking-anabulku.csv');
    showToast('Data booking diekspor.');
  });

  /* ================================================================
     KEUANGAN
  ================================================================ */
  let keuanganSearch = '';

  function filterBookingsByPeriod(period) {
    const all   = getBookings();
    const today = todayStr();
    if (period === 'today') return all.filter(b => b.tanggal === today);
    if (period === 'week') {
      const ago = new Date(Date.now() - 7*24*60*60*1000).toISOString().slice(0,10);
      return all.filter(b => b.tanggal >= ago);
    }
    if (period === 'month') {
      const mp = today.slice(0,7);
      return all.filter(b => (b.tanggal||'').startsWith(mp));
    }
    return all;
  }

  function renderKeuangan() {
    const period   = document.getElementById('keuanganPeriod').value;
    const bookings = filterBookingsByPeriod(period);
    const selesai  = bookings.filter(b => b.status === 'selesai');
    const kliniks  = getKliniks();

    const totalOmset = selesai.reduce((s, b) => s + rupiahNum(b.biaya), 0);
    const jmlTransaksi = selesai.length;
    const rata = jmlTransaksi > 0 ? Math.round(totalOmset / jmlTransaksi) : 0;

    document.getElementById('keuOmsetTotal').textContent    = rupiah(totalOmset);
    document.getElementById('keuJmlTransaksi').textContent  = jmlTransaksi;
    document.getElementById('keuRataTransaksi').textContent = rupiah(rata);

    /* Omset per klinik */
    const byKlinik = {};
    selesai.forEach(b => {
      const k = b.namaKlinik || 'Tidak Diketahui';
      if (!byKlinik[k]) byKlinik[k] = { count: 0, total: 0 };
      byKlinik[k].count++;
      byKlinik[k].total += rupiahNum(b.biaya);
    });

    const sorted = Object.entries(byKlinik).sort((a,b) => b[1].total - a[1].total);
    document.getElementById('keuKlinikTeratas').textContent = sorted.length ? sorted[0][0] : '—';

    const keuTbody = document.getElementById('keuanganTbody');
    if (!sorted.length) {
      keuTbody.innerHTML = '<tr><td colspan="7" class="empty-state">Belum ada data transaksi selesai.</td></tr>';
    } else {
      keuTbody.innerHTML = sorted.map(([nama, v], i) => {
        const klinik = kliniks.find(c => c.namaKlinik === nama);
        const st = klinik ? klinikStatus(klinik) : 'nonaktif';
        const rataK = v.count > 0 ? Math.round(v.total / v.count) : 0;
        return `<tr>
          <td>${i+1}</td>
          <td><strong>${esc(nama)}</strong></td>
          <td>${esc(klinik?.kota || '—')}</td>
          <td>${v.count}</td>
          <td><strong style="color:#16A34A">${rupiah(v.total)}</strong></td>
          <td>${rupiah(rataK)}</td>
          <td>${badgeHtml(st)}</td>
        </tr>`;
      }).join('');
    }

    /* Riwayat transaksi semua status */
    renderTransaksiTable(bookings);
  }

  function renderTransaksiTable(bookings) {
    const q = keuanganSearch.toLowerCase();
    let data = [...bookings].sort((a,b) =>
      ((b.tanggal||'')+(b.jam||'')).localeCompare((a.tanggal||'')+(a.jam||''))
    );
    if (q) {
      data = data.filter(b =>
        (b.namaKlinik||'').toLowerCase().includes(q) ||
        (b.namaPemilik||'').toLowerCase().includes(q)
      );
    }

    const tbody = document.getElementById('transaksiTbody');
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Tidak ada transaksi.</td></tr>';
      return;
    }

    tbody.innerHTML = data.map((b, i) => `
      <tr>
        <td>${i+1}</td>
        <td style="white-space:nowrap;font-size:12px">${esc(fmtDate(b.tanggal))}</td>
        <td>${esc(b.namaKlinik || '—')}</td>
        <td>${esc(b.namaPemilik || '—')}</td>
        <td>Konsultasi Umum</td>
        <td><strong>${rupiah(b.biaya)}</strong></td>
        <td>${badgeHtml(b.status)}</td>
      </tr>`).join('');
  }

  document.getElementById('keuanganPeriod').addEventListener('change', renderKeuangan);

  document.getElementById('keuanganSearch').addEventListener('input', e => {
    keuanganSearch = e.target.value.trim();
    const period = document.getElementById('keuanganPeriod').value;
    renderTransaksiTable(filterBookingsByPeriod(period));
  });

  document.getElementById('btnExportKeuangan').addEventListener('click', () => {
    const period  = document.getElementById('keuanganPeriod').value;
    const selesai = filterBookingsByPeriod(period).filter(b => b.status === 'selesai');
    const rows    = [['No','Tanggal','Klinik','Pemilik Hewan','Layanan','Biaya','Status']];
    selesai.forEach((b, i) => {
      rows.push([i+1, b.tanggal||'', b.namaKlinik||'', b.namaPemilik||'', 'Konsultasi Umum', rupiahNum(b.biaya), b.status||'']);
    });
    downloadCsv(rows, 'keuangan-anabulku.csv');
    showToast('Data keuangan diekspor.');
  });

  /* ================================================================
     PENGGUNA — terintegrasi dengan anabulku_users (dari register.html)
  ================================================================ */
  let penggunaSearch  = '';
  let penggunaTabMode = 'user'; // 'user' | 'klinik'

  function getUsers() { return LS.get('anabulku_users', []); }

  function renderPenggunaTable() {
    const tbody = document.getElementById('penggunaTbody');

    if (penggunaTabMode === 'user') {
      /* ── Tab: Pengguna Terdaftar (dari login/register) ── */
      let data = getUsers();
      if (penggunaSearch) {
        const q = penggunaSearch.toLowerCase();
        data = data.filter(u =>
          (u.nama||'').toLowerCase().includes(q) ||
          (u.username||'').toLowerCase().includes(q) ||
          (u.email||'').toLowerCase().includes(q) ||
          (u.kota||'').toLowerCase().includes(q)
        );
      }
      if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Belum ada pengguna terdaftar.</td></tr>';
        return;
      }
      const kliniks = getKliniks();
      tbody.innerHTML = data.map((u, i) => {
        /* Cari klinik yang terhubung ke user ini via email */
        const klinik = kliniks.find(c =>
          c.email === u.email || c.namaOwner === u.nama
        );
        const klinikNama   = klinik ? esc(klinik.namaKlinik) : '<span style="color:#9CA3AF">—</span>';
        const klinikStatus = klinik ? badgeHtml(klinik.adminStatus || 'pending') : '<span style="color:#9CA3AF">—</span>';
        return `<tr>
          <td>${i+1}</td>
          <td><strong>${esc(u.nama || '—')}</strong></td>
          <td style="font-size:12px;color:#6B7280">@${esc(u.username || '—')}</td>
          <td style="font-size:12px">${esc(u.email || '—')}</td>
          <td style="font-size:12px">${esc(u.noHp || '—')}</td>
          <td style="font-size:12px">${esc(u.kota || '—')}</td>
          <td style="font-size:12px;white-space:nowrap">${fmtDate(u.createdAt)}</td>
          <td>${klinikNama}</td>
        </tr>`;
      }).join('');

    } else {
      /* ── Tab: Pemilik Klinik (dari mitra/daftar.html) ── */
      const allKliniks = getKliniks();
      let pairs = allKliniks.map((c, i) => ({ c, idx: i }));
      if (penggunaSearch) {
        const q = penggunaSearch.toLowerCase();
        pairs = pairs.filter(p =>
          (p.c.namaOwner||'').toLowerCase().includes(q) ||
          (p.c.email||'').toLowerCase().includes(q)
        );
      }
      if (!pairs.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Tidak ada data pemilik klinik.</td></tr>';
        return;
      }
      tbody.innerHTML = pairs.map(({ c, idx }, i) => {
        return `<tr>
          <td>${i+1}</td>
          <td><strong>${esc(c.namaOwner || '—')}</strong></td>
          <td colspan="2" style="font-size:12px">${esc(c.email || '—')}</td>
          <td style="font-size:12px">${esc(c.waKlinik || '—')}</td>
          <td style="font-size:12px">${esc(c.kota || '—')}</td>
          <td style="font-size:12px;white-space:nowrap">${fmtDate(c.createdAt || c.registeredAt)}</td>
          <td>
            <div style="display:flex;align-items:center;gap:6px">
              ${badgeHtml(klinikStatus(c))}
              <button class="btn-icon btn-icon--view" title="Lihat klinik" onclick="viewKlinik(${idx})">👁</button>
            </div>
          </td>
        </tr>`;
      }).join('');
    }
  }

  /* Tab switcher untuk halaman pengguna */
  (function initPenggunaTab() {
    const bar = document.getElementById('penggunaTabBar');
    if (!bar) return;
    bar.addEventListener('click', e => {
      const btn = e.target.closest('[data-pengguna-tab]');
      if (!btn) return;
      bar.querySelectorAll('[data-pengguna-tab]').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      penggunaTabMode = btn.dataset.penggunaTab;
      updatePenggunaHeader();
      renderPenggunaTable();
    });
  })();

  function updatePenggunaHeader() {
    const subEl = document.querySelector('#pagePengguna .page-sub');
    if (!subEl) return;
    subEl.textContent = penggunaTabMode === 'user'
      ? 'Akun pengguna yang terdaftar di aplikasi'
      : 'Akun pemilik klinik yang terdaftar';
  }

  document.getElementById('penggunaSearch').addEventListener('input', e => {
    penggunaSearch = e.target.value.trim();
    renderPenggunaTable();
  });

  /* ================================================================
     LAPORAN
  ================================================================ */
  function renderLaporan() {
    const period  = document.getElementById('laporanPeriod').value;
    const kliniks = getKliniks();
    const bookings = filterBookingsByPeriod(period);
    const selesai  = bookings.filter(b => b.status === 'selesai');
    const total    = selesai.reduce((s,b) => s + rupiahNum(b.biaya), 0);
    const days     = new Set(bookings.map(b => b.tanggal)).size || 1;

    document.getElementById('laporanPendapatan').textContent  = rupiah(total);
    document.getElementById('laporanSelesai').textContent     = selesai.length;
    document.getElementById('laporanKlinikAktif').textContent = kliniks.filter(c => klinikStatus(c) === 'aktif').length;
    document.getElementById('laporanRataBooking').textContent = (bookings.length / Math.max(days,1)).toFixed(1);

    /* Top 5 klinik */
    const byKlinik = {};
    bookings.forEach(b => {
      const k = b.namaKlinik || 'Tidak Diketahui';
      byKlinik[k] = (byKlinik[k] || 0) + 1;
    });
    const topList = Object.entries(byKlinik).sort((a,b) => b[1]-a[1]).slice(0,5);
    const topEl = document.getElementById('topKlinikList');
    topEl.innerHTML = topList.length
      ? topList.map(([name, count], i) => `
          <div class="top-klinik-item">
            <div class="top-klinik-rank">${i+1}</div>
            <span class="top-klinik-name">${esc(name)}</span>
            <span class="top-klinik-count">${count} booking</span>
          </div>`).join('')
      : '<p class="empty-state">Belum ada data.</p>';

    /* Hewan breakdown */
    const byHewan = {};
    bookings.forEach(b => {
      const h = b.jenisHewan || 'Lainnya';
      byHewan[h] = (byHewan[h] || 0) + 1;
    });
    const entries = Object.entries(byHewan).sort((a,b) => b[1]-a[1]);
    const hewanEl = document.getElementById('hewanBreakdown');
    hewanEl.innerHTML = entries.length
      ? entries.map(([name, count]) => `
          <div class="breakdown-item">
            <div class="breakdown-val">${count}</div>
            <div class="breakdown-lbl">${esc(name)}</div>
          </div>`).join('')
      : '<p class="empty-state">Belum ada data.</p>';
  }

  document.getElementById('laporanPeriod').addEventListener('change', renderLaporan);

  /* ================================================================
     KONTEN
  ================================================================ */
  function renderKonten() {
    const list  = getPengumuman();
    const pengEl = document.getElementById('pengumumanList');
    pengEl.innerHTML = list.length
      ? list.map((p, i) => `
          <div class="pengumuman-item">
            <div>
              ${badgeHtml(p.tipe || 'info')}
              <p class="pengumuman-judul">${esc(p.judul)}</p>
              <p class="pengumuman-isi">${esc(p.isi)}</p>
              <p style="font-size:11px;color:#9CA3AF;margin-top:4px">${fmtDate(p.createdAt)}</p>
            </div>
            <button class="btn-icon btn-icon--del" title="Hapus" onclick="hapusPengumuman(${i})">🗑</button>
          </div>`).join('')
      : '<p class="empty-state">Belum ada pengumuman.</p>';

    /* Kategori count */
    const kliniks = getKliniks();
    const rx = {
      kucing: /(kucing|cat|feline)/i,
      anjing: /(anjing|dog|canine)/i,
      reptil: /(reptil|reptile|eksotik|turtle)/i,
    };
    let ku=0, an=0, re=0;
    kliniks.forEach(c => {
      const h = Array.isArray(c.hewanDilayani) ? c.hewanDilayani.join(' ') : (c.hewanDilayani||'');
      if (rx.kucing.test(h)) ku++;
      if (rx.anjing.test(h)) an++;
      if (rx.reptil.test(h)) re++;
    });
    document.getElementById('katKucing').textContent = ku + ' klinik';
    document.getElementById('katAnjing').textContent = an + ' klinik';
    document.getElementById('katReptil').textContent = re + ' klinik';
  }

  window.hapusPengumuman = function(idx) {
    if (!confirm('Hapus pengumuman ini?')) return;
    const list = getPengumuman();
    list.splice(idx, 1);
    savePengumuman(list);
    renderKonten();
    showToast('Pengumuman dihapus.', 'error');
  };

  /* ================================================================
     PENGATURAN
  ================================================================ */
  function loadPengaturan() {
    const creds    = getAdminCreds();
    const settings = getSettings();
    document.getElementById('setNamaAdmin').value     = creds.nama || '';
    document.getElementById('setUsernameAdmin').value = creds.username || '';
    document.getElementById('setPassBaru').value      = '';
    document.getElementById('toggleRegistrasi').checked  = settings.registrasi !== false;
    document.getElementById('toggleAutoApprove').checked = !!settings.autoApprove;
    document.getElementById('toggleMaintenance').checked = !!settings.maintenance;
  }

  document.getElementById('btnSimpanAkun').addEventListener('click', () => {
    const creds    = getAdminCreds();
    const nama     = document.getElementById('setNamaAdmin').value.trim();
    const username = document.getElementById('setUsernameAdmin').value.trim();
    const pass     = document.getElementById('setPassBaru').value;
    if (!nama || !username) { showToast('Nama dan username wajib diisi.', 'error'); return; }
    LS.set('anabulku_admin_creds', {
      _v: CREDS_VERSION,
      nama, username,
      password: pass || creds.password,
    });
    document.getElementById('sidebarAdminName').textContent = nama;
    showToast('Akun admin diperbarui.');
  });

  ['toggleRegistrasi','toggleAutoApprove','toggleMaintenance'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      const settings = getSettings();
      settings.registrasi  = document.getElementById('toggleRegistrasi').checked;
      settings.autoApprove = document.getElementById('toggleAutoApprove').checked;
      settings.maintenance = document.getElementById('toggleMaintenance').checked;
      saveSettings(settings);
      showToast('Pengaturan disimpan.');
    });
  });

  document.getElementById('btnResetBookings').addEventListener('click', () => {
    if (!confirm('Hapus SEMUA data booking? Tindakan ini tidak dapat dibatalkan.')) return;
    saveBookings([]);
    renderOverview();
    showToast('Semua data booking dihapus.', 'error');
  });

  document.getElementById('btnResetAll').addEventListener('click', () => {
    if (!confirm('Reset SEMUA data platform? Klinik, booking, dan pengaturan akan hilang!')) return;
    if (!confirm('Yakin? Ini tidak bisa dibatalkan!')) return;
    ['mitraKlinik','anabulku_bookings','anabulku_pasiens','anabulku_dokters',
     'anabulku_klinik','anabulku_pengumuman','anabulku_settings',
     'anabulku:partner:clinics'].forEach(k => localStorage.removeItem(k));
    renderOverview();
    showToast('Semua data platform direset.', 'error');
  });

  /* ================================================================
     EXPORT CSV UTIL
  ================================================================ */
  function downloadCsv(rows, filename) {
    const content = rows.map(r =>
      r.map(cell => '"' + String(cell).replace(/"/g,'""') + '"').join(',')
    ).join('\n');
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  /* ================================================================
     INIT — langsung tampilkan dashboard tanpa cek login
  ================================================================ */
  initAdminInfo();
  goPage('overview');

})();
