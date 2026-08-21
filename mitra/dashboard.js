/* ===================================================================
   AnabulKu Mitra — dashboard.js
   State disimpan di localStorage (key: anabulku_*)
=================================================================== */
(function () {
  'use strict';

  /* ── Storage helpers ── */
  const LS = {
    get: (key, def) => { try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; } },
    set: (key, val) => localStorage.setItem(key, JSON.stringify(val)),
  };

  /* ── State ── */
  let bookings = LS.get('anabulku_bookings', []);
  let pasiens  = LS.get('anabulku_pasiens',  []);
  let dokters  = LS.get('anabulku_dokters',  []);
  let klinik   = LS.get('anabulku_klinik',   {});

  function save() {
    LS.set('anabulku_bookings', bookings);
    LS.set('anabulku_pasiens',  pasiens);
    LS.set('anabulku_dokters',  dokters);
    LS.set('anabulku_klinik',   klinik);
    syncToMitraKlinik();
  }

  /* Sync perubahan dashboard kembali ke mitraKlinik[] agar terbaca app user */
  function syncToMitraKlinik() {
    try {
      const list = LS.get('mitraKlinik', []);
      if (!Array.isArray(list) || !list.length) return;

      /* Cari index klinik yang cocok berdasarkan nama atau email */
      let idx = list.findIndex(c =>
        c.namaKlinik && klinik.namaKlinik && c.namaKlinik === klinik.namaKlinik
      );
      if (idx < 0) idx = list.length - 1; /* fallback: klinik terakhir */

      /* Update field profil */
      list[idx] = Object.assign({}, list[idx], {
        namaKlinik: klinik.namaKlinik || list[idx].namaKlinik,
        waKlinik:   klinik.waKlinik   || list[idx].waKlinik,
        alamat:     klinik.alamat     || list[idx].alamat,
        kota:       klinik.kota       || list[idx].kota,
        jamBuka:    klinik.jamBuka    || list[idx].jamBuka,
        jamTutup:   klinik.jamTutup   || list[idx].jamTutup,
        harisBuka:  klinik.harisBuka  || list[idx].harisBuka,
        namaOwner:  klinik.namaOwner  || list[idx].namaOwner,
        /* Sync dokter agar clinic-detail.js bisa membacanya */
        dokters: dokters.map(d => ({
          id:           d.id,
          nama:         d.nama,
          spesialisasi: d.spesialis || 'Dokter Umum',
          hp:           d.hp || '',
          hari:         Array.isArray(d.hari) ? d.hari.join(', ') : (d.hari || ''),
          jamMulai:     d.jamMulai  || '08:00',
          jamSelesai:   d.jamSelesai || '17:00',
        })),
        /* Expose booking ringkas untuk ditampilkan app user (slot terisi) */
        bookings: bookings
          .filter(b => b.status === 'dikonfirmasi' || b.status === 'menunggu')
          .map(b => ({
            tanggal:     b.tanggal,
            jam:         b.jam,
            dokter:      b.dokter,
            status:      b.status,
          })),
      });

      LS.set('mitraKlinik', list);
    } catch (e) { /* silent */ }
  }

  /* Generate unique id */
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* Format rupiah */
  function rupiah(n) {
    const num = parseInt(String(n).replace(/\D/g,''), 10);
    if (!num) return '—';
    return 'Rp ' + num.toLocaleString('id-ID');
  }

  /* Format date */
  function fmtDate(isoDate) {
    if (!isoDate) return '—';
    const d = new Date(isoDate + 'T00:00');
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /* Today's ISO date string (YYYY-MM-DD) */
  function todayStr() { return new Date().toISOString().slice(0, 10); }

  /* Escape HTML */
  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* Badge HTML */
  function badgeHtml(status) {
    const map = {
      menunggu:    ['badge--menunggu',    'Menunggu'],
      dikonfirmasi:['badge--dikonfirmasi','Dikonfirmasi'],
      selesai:     ['badge--selesai',     'Selesai'],
      dibatalkan:  ['badge--dibatalkan',  'Dibatalkan'],
    };
    const [cls, lbl] = map[status] || ['badge--menunggu', status];
    return `<span class="badge ${cls}">${lbl}</span>`;
  }

  /* ── Toast ── */
  const toastEl = document.getElementById('toast');
  let toastTimer;
  function showToast(msg, type = 'success') {
    toastEl.textContent = msg;
    toastEl.className = `toast toast--${type} is-visible`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 2800);
  }

  /* ── Navigation ── */
  const pages = {
    overview: document.getElementById('pageOverview'),
    booking:  document.getElementById('pageBooking'),
    pasien:   document.getElementById('pagePasien'),
    dokter:   document.getElementById('pageDokter'),
    keuangan: document.getElementById('pageKeuangan'),
    profil:   document.getElementById('pageProfil'),
  };
  const navItems   = document.querySelectorAll('.nav-item');
  const topbarTitle = document.getElementById('topbarTitle');

  let activePage = 'overview';

  function goPage(name) {
    if (!pages[name]) return;
    activePage = name;
    Object.entries(pages).forEach(([k, el]) => { el.hidden = k !== name; });
    navItems.forEach(a => {
      const isActive = a.dataset.page === name;
      a.classList.toggle('is-active', isActive);
      a.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
    topbarTitle.textContent = {
      overview:'Overview', booking:'Booking', pasien:'Pasien',
      dokter:'Tim Dokter', keuangan:'Keuangan', profil:'Profil Klinik',
    }[name] || '';
    closeSidebar();

    /* refresh whichever page we navigated to */
    if (name === 'overview')  renderOverview();
    if (name === 'booking')   renderBookingTable();
    if (name === 'pasien')    renderPasienTable();
    if (name === 'dokter')    renderDokterGrid();
    if (name === 'keuangan')  renderKeuangan();
    if (name === 'profil')    loadProfil();
  }

  navItems.forEach(a => {
    a.addEventListener('click', e => { e.preventDefault(); goPage(a.dataset.page); });
  });

  /* "Lihat semua" link on overview card */
  document.querySelectorAll('[data-page]').forEach(el => {
    if (el.tagName === 'A') {
      el.addEventListener('click', e => { e.preventDefault(); goPage(el.dataset.page); });
    }
  });

  /* ── Sidebar mobile toggle ── */
  const sidebar        = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const btnSidebarToggle = document.getElementById('btnSidebarToggle');

  function openSidebar()  { sidebar.classList.add('is-open'); sidebarOverlay.hidden = false; }
  function closeSidebar() { sidebar.classList.remove('is-open'); sidebarOverlay.hidden = true; }

  btnSidebarToggle.addEventListener('click', () => {
    sidebar.classList.contains('is-open') ? closeSidebar() : openSidebar();
  });
  sidebarOverlay.addEventListener('click', closeSidebar);

  /* ── Sidebar clinic info ── */
  function updateSidebarClinic() {
    const n = klinik.namaKlinik || 'Klinik Saya';
    document.getElementById('sidebarClinicName').textContent = n;
    document.getElementById('sidebarLogo').textContent = n.charAt(0).toUpperCase();
  }

  /* ── Nav badge: pending bookings ── */
  function updateNavBadge() {
    const pending = bookings.filter(b => b.status === 'menunggu').length;
    const badge = document.getElementById('navBadgeBooking');
    badge.textContent = pending;
    badge.hidden = pending === 0;
    /* topbar notif dot */
    const dot = document.getElementById('topbarNotifDot');
    if (dot) dot.hidden = pending === 0;
  }

  /* ================================================================
     OVERVIEW
  ================================================================ */
  function renderOverview() {
    const today = todayStr();
    const todayBookings  = bookings.filter(b => b.tanggal === today);
    const todaySelesai   = todayBookings.filter(b => b.status === 'selesai');
    const todayPendapatan = todaySelesai.reduce((s, b) => s + (parseInt(b.biaya, 10) || 0), 0);

    document.getElementById('statBookingHariIni').textContent = todayBookings.length;
    document.getElementById('statSelesai').textContent        = todaySelesai.length;
    document.getElementById('statPasien').textContent         = pasiens.length;
    document.getElementById('statPendapatan').textContent     = rupiah(todayPendapatan);

    /* Greeting */
    const h = new Date().getHours();
    const greeting = h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
    const nama = klinik.namaOwner || klinik.namaKlinik || '';
    document.getElementById('overviewGreeting').textContent = `${greeting}${nama ? ', ' + nama : ''}!`;

    /* Date */
    const dateEl = document.getElementById('pageDate');
    if (dateEl) {
      dateEl.textContent = new Date().toLocaleDateString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
    }

    /* Booking list */
    const list = document.getElementById('overviewBookingList');
    if (!todayBookings.length) {
      list.innerHTML = '<p class="empty-state">Belum ada booking hari ini.</p>';
      return;
    }
    const sorted = [...todayBookings].sort((a, b) => a.jam.localeCompare(b.jam));
    list.innerHTML = sorted.map(b => `
      <div class="booking-item">
        <span class="booking-item-time">${esc(b.jam)}</span>
        <div class="booking-item-info">
          <p class="booking-item-name">${esc(b.namaPemilik)} — <em>${esc(b.namaHewan)}</em></p>
          <p class="booking-item-sub">${esc(b.jenisHewan)} · drh. ${esc(b.dokter)}</p>
        </div>
        ${badgeHtml(b.status)}
      </div>`).join('');
  }

  /* ================================================================
     BOOKING
  ================================================================ */
  let bookingFilter = 'semua';
  let bookingSearch = '';
  let bookingDate   = '';

  function renderBookingTable() {
    updateNavBadge();
    let data = [...bookings].sort((a, b) => {
      const da = (a.tanggal + a.jam).localeCompare(b.tanggal + b.jam);
      return -da; /* newest first */
    });

    if (bookingFilter !== 'semua') data = data.filter(b => b.status === bookingFilter);
    if (bookingDate)  data = data.filter(b => b.tanggal === bookingDate);
    if (bookingSearch) {
      const q = bookingSearch.toLowerCase();
      data = data.filter(b =>
        b.namaPemilik.toLowerCase().includes(q) ||
        b.namaHewan.toLowerCase().includes(q) ||
        b.dokter.toLowerCase().includes(q)
      );
    }

    const tbody = document.getElementById('bookingTbody');
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty-state">Tidak ada data booking.</td></tr>';
      return;
    }
    tbody.innerHTML = data.map((b, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(fmtDate(b.tanggal))}<br><small style="color:#9CA3AF">${esc(b.jam)}</small></td>
        <td>
          <strong>${esc(b.namaPemilik)}</strong><br>
          <small style="color:#9CA3AF">${esc(b.noHP)}</small>
        </td>
        <td>${esc(b.namaHewan)}</td>
        <td>${esc(b.jenisHewan)}</td>
        <td>${esc(b.dokter) || '—'}</td>
        <td>${rupiah(b.biaya)}</td>
        <td>${badgeHtml(b.status)}</td>
        <td>
          <div class="action-btns">
            <button class="btn-icon btn-icon--check" title="Tandai Selesai" onclick="markSelesai('${b.id}')">✓</button>
            <button class="btn-icon btn-icon--edit"  title="Edit"  onclick="editBooking('${b.id}')">✎</button>
            <button class="btn-icon btn-icon--del"   title="Hapus" onclick="hapusBooking('${b.id}')">✕</button>
          </div>
        </td>
      </tr>`).join('');
  }

  /* Filter tabs */
  document.querySelectorAll('.filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      bookingFilter = btn.dataset.filter;
      renderBookingTable();
    });
  });

  /* Search */
  document.getElementById('bookingSearch').addEventListener('input', e => {
    bookingSearch = e.target.value.trim();
    renderBookingTable();
  });

  /* Date filter */
  document.getElementById('bookingDateFilter').addEventListener('change', e => {
    bookingDate = e.target.value;
    renderBookingTable();
  });

  /* Global handlers for table buttons */
  window.markSelesai = function(id) {
    const b = bookings.find(x => x.id === id);
    if (!b) return;
    b.status = 'selesai';
    save();
    renderBookingTable();
    renderOverview();
    showToast('Booking ditandai selesai.');
  };

  window.editBooking = function(id) {
    const b = bookings.find(x => x.id === id);
    if (!b) return;
    openModalBooking(b);
  };

  window.hapusBooking = function(id) {
    if (!confirm('Hapus booking ini?')) return;
    bookings = bookings.filter(x => x.id !== id);
    save();
    renderBookingTable();
    updateNavBadge();
    showToast('Booking dihapus.', 'error');
  };

  /* ── Modal Booking ── */
  const modalBooking      = document.getElementById('modalBooking');
  const modalBookingTitle = document.getElementById('modalBookingTitle');

  function openModalBooking(data) {
    const isEdit = !!data;
    modalBookingTitle.textContent = isEdit ? 'Edit Booking' : 'Booking Baru';
    document.getElementById('bookingEditId').value  = data?.id || '';
    document.getElementById('bTanggal').value       = data?.tanggal || todayStr();
    document.getElementById('bJam').value           = data?.jam || '09:00';
    document.getElementById('bNamaPemilik').value   = data?.namaPemilik || '';
    document.getElementById('bNoHP').value          = data?.noHP || '';
    document.getElementById('bNamaHewan').value     = data?.namaHewan || '';
    document.getElementById('bJenisHewan').value    = data?.jenisHewan || '';
    document.getElementById('bRas').value           = data?.ras || '';
    document.getElementById('bUmur').value          = data?.umur || '';
    document.getElementById('bKeluhan').value       = data?.keluhan || '';
    document.getElementById('bBiaya').value         = data?.biaya || '';
    document.getElementById('bStatus').value        = data?.status || 'menunggu';

    /* Populate dokter select */
    const sel = document.getElementById('bDokter');
    sel.innerHTML = '<option value="" disabled>Pilih dokter</option>';
    dokters.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.nama;
      opt.textContent = d.nama + (d.spesialis ? ` (${d.spesialis})` : '');
      if (data?.dokter === d.nama) opt.selected = true;
      sel.appendChild(opt);
    });
    if (!dokters.length) {
      const opt = document.createElement('option');
      opt.value = 'Dokter Umum';
      opt.textContent = 'Dokter Umum';
      if (!data?.dokter || data.dokter === 'Dokter Umum') opt.selected = true;
      sel.appendChild(opt);
    }

    modalBooking.hidden = false;
    document.getElementById('bTanggal').focus();
  }

  function closeModalBooking() { modalBooking.hidden = true; }

  document.getElementById('btnTambahBooking').addEventListener('click', () => openModalBooking(null));
  document.getElementById('modalBookingClose').addEventListener('click', closeModalBooking);
  document.getElementById('modalBookingCancel').addEventListener('click', closeModalBooking);
  modalBooking.addEventListener('click', e => { if (e.target === modalBooking) closeModalBooking(); });

  document.getElementById('modalBookingSave').addEventListener('click', () => {
    const tanggal    = document.getElementById('bTanggal').value;
    const jam        = document.getElementById('bJam').value;
    const namaPemilik = document.getElementById('bNamaPemilik').value.trim();
    const noHP       = document.getElementById('bNoHP').value.trim();
    const namaHewan  = document.getElementById('bNamaHewan').value.trim();
    const jenisHewan = document.getElementById('bJenisHewan').value;
    const dokter     = document.getElementById('bDokter').value;

    if (!tanggal || !jam || !namaPemilik || !noHP || !namaHewan || !jenisHewan || !dokter) {
      showToast('Lengkapi field yang wajib diisi.', 'error');
      return;
    }

    const editId = document.getElementById('bookingEditId').value;
    const obj = {
      id:          editId || uid(),
      tanggal, jam, namaPemilik, noHP, namaHewan, jenisHewan,
      ras:         document.getElementById('bRas').value.trim(),
      umur:        document.getElementById('bUmur').value.trim(),
      dokter,
      keluhan:     document.getElementById('bKeluhan').value.trim(),
      biaya:       document.getElementById('bBiaya').value.replace(/\D/g,''),
      status:      document.getElementById('bStatus').value,
      createdAt:   editId ? (bookings.find(b => b.id === editId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
    };

    if (editId) {
      const idx = bookings.findIndex(b => b.id === editId);
      if (idx >= 0) bookings[idx] = obj;
    } else {
      bookings.unshift(obj);
      /* Auto-add to pasien list if not exists */
      const exists = pasiens.some(p =>
        p.namaHewan.toLowerCase() === namaHewan.toLowerCase() &&
        p.namaPemilik.toLowerCase() === namaPemilik.toLowerCase()
      );
      if (!exists) {
        pasiens.unshift({
          id:            uid(),
          namaHewan,
          jenisHewan,
          ras:           obj.ras,
          umur:          obj.umur,
          namaPemilik,
          noHP,
          kunjunganTerakhir: tanggal,
          riwayat:       '',
          createdAt:     new Date().toISOString(),
        });
      } else {
        /* Update kunjungan terakhir */
        const p = pasiens.find(p =>
          p.namaHewan.toLowerCase() === namaHewan.toLowerCase() &&
          p.namaPemilik.toLowerCase() === namaPemilik.toLowerCase()
        );
        if (p && tanggal > (p.kunjunganTerakhir || '')) p.kunjunganTerakhir = tanggal;
      }
    }

    save();
    closeModalBooking();
    renderBookingTable();
    updateNavBadge();
    showToast(editId ? 'Booking diperbarui.' : 'Booking ditambahkan.');
  });

  /* ================================================================
     PASIEN
  ================================================================ */
  function renderPasienTable() {
    let data = [...pasiens].sort((a, b) =>
      (b.kunjunganTerakhir || '').localeCompare(a.kunjunganTerakhir || '')
    );
    const q = document.getElementById('pasienSearch').value.trim().toLowerCase();
    if (q) data = data.filter(p =>
      p.namaHewan.toLowerCase().includes(q) ||
      p.namaPemilik.toLowerCase().includes(q)
    );

    const tbody = document.getElementById('pasienTbody');
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty-state">Tidak ada data pasien.</td></tr>';
      return;
    }
    tbody.innerHTML = data.map((p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${esc(p.namaHewan)}</strong></td>
        <td>${esc(p.jenisHewan)}</td>
        <td>${esc(p.ras) || '—'}</td>
        <td>${esc(p.umur) || '—'}</td>
        <td>${esc(p.namaPemilik)}</td>
        <td>${esc(p.noHP)}</td>
        <td>${fmtDate(p.kunjunganTerakhir)}</td>
        <td>
          <div class="action-btns">
            <button class="btn-icon btn-icon--edit"  title="Edit"  onclick="editPasien('${p.id}')">✎</button>
            <button class="btn-icon btn-icon--del"   title="Hapus" onclick="hapusPasien('${p.id}')">✕</button>
          </div>
        </td>
      </tr>`).join('');
  }

  document.getElementById('pasienSearch').addEventListener('input', renderPasienTable);

  window.editPasien = function(id) {
    const p = pasiens.find(x => x.id === id);
    if (!p) return;
    openModalPasien(p);
  };

  window.hapusPasien = function(id) {
    if (!confirm('Hapus data pasien ini?')) return;
    pasiens = pasiens.filter(x => x.id !== id);
    save();
    renderPasienTable();
    showToast('Pasien dihapus.', 'error');
  };

  /* ── Modal Pasien ── */
  const modalPasien      = document.getElementById('modalPasien');
  const modalPasienTitle = document.getElementById('modalPasienTitle');

  function openModalPasien(data) {
    const isEdit = !!data;
    modalPasienTitle.textContent = isEdit ? 'Edit Pasien' : 'Pasien Baru';
    document.getElementById('pasienEditId').value   = data?.id || '';
    document.getElementById('pNamaHewan').value     = data?.namaHewan || '';
    document.getElementById('pJenis').value         = data?.jenisHewan || '';
    document.getElementById('pRas').value           = data?.ras || '';
    document.getElementById('pUmur').value          = data?.umur || '';
    document.getElementById('pWarnaMarkings').value = data?.warnaMarkings || '';
    document.getElementById('pNamaPemilik').value   = data?.namaPemilik || '';
    document.getElementById('pHPPemilik').value     = data?.noHP || '';
    document.getElementById('pRiwayat').value       = data?.riwayat || '';
    modalPasien.hidden = false;
    document.getElementById('pNamaHewan').focus();
  }

  function closeModalPasien() { modalPasien.hidden = true; }

  document.getElementById('btnTambahPasien').addEventListener('click', () => openModalPasien(null));
  document.getElementById('modalPasienClose').addEventListener('click', closeModalPasien);
  document.getElementById('modalPasienCancel').addEventListener('click', closeModalPasien);
  modalPasien.addEventListener('click', e => { if (e.target === modalPasien) closeModalPasien(); });

  document.getElementById('modalPasienSave').addEventListener('click', () => {
    const namaHewan  = document.getElementById('pNamaHewan').value.trim();
    const jenisHewan = document.getElementById('pJenis').value;
    const namaPemilik = document.getElementById('pNamaPemilik').value.trim();
    const noHP       = document.getElementById('pHPPemilik').value.trim();

    if (!namaHewan || !jenisHewan || !namaPemilik || !noHP) {
      showToast('Lengkapi field yang wajib diisi.', 'error');
      return;
    }

    const editId = document.getElementById('pasienEditId').value;
    const obj = {
      id:              editId || uid(),
      namaHewan, jenisHewan, namaPemilik, noHP,
      ras:             document.getElementById('pRas').value.trim(),
      umur:            document.getElementById('pUmur').value.trim(),
      warnaMarkings:   document.getElementById('pWarnaMarkings').value.trim(),
      riwayat:         document.getElementById('pRiwayat').value.trim(),
      kunjunganTerakhir: editId ? (pasiens.find(p => p.id === editId)?.kunjunganTerakhir || '') : '',
      createdAt:       editId ? (pasiens.find(p => p.id === editId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
    };

    if (editId) {
      const idx = pasiens.findIndex(p => p.id === editId);
      if (idx >= 0) pasiens[idx] = obj;
    } else {
      pasiens.unshift(obj);
    }

    save();
    closeModalPasien();
    renderPasienTable();
    showToast(editId ? 'Data pasien diperbarui.' : 'Pasien ditambahkan.');
  });

  /* ================================================================
     DOKTER
  ================================================================ */
  function renderDokterGrid() {
    const grid = document.getElementById('dokterGrid');
    if (!dokters.length) {
      grid.innerHTML = '<p class="empty-state">Belum ada dokter terdaftar.</p>';
      return;
    }

    const SHORT = { Senin:'Sen', Selasa:'Sel', Rabu:'Rab', Kamis:'Kam', Jumat:'Jum', Sabtu:'Sab', Minggu:'Min' };

    grid.innerHTML = dokters.map(d => `
      <div class="dokter-card">
        <div class="dokter-card-header">
          <div style="display:flex;align-items:center;gap:12px">
            <div class="dokter-avatar">${esc(d.nama.charAt(0))}</div>
            <div>
              <p class="dokter-card-name">${esc(d.nama)}</p>
              <p class="dokter-card-spec">${esc(d.spesialis) || 'Dokter Umum'}</p>
            </div>
          </div>
          <div class="dokter-card-actions">
            <button class="btn-icon btn-icon--edit"  title="Edit"  onclick="editDokter('${d.id}')">✎</button>
            <button class="btn-icon btn-icon--del"   title="Hapus" onclick="hapusDokter('${d.id}')">✕</button>
          </div>
        </div>
        <div class="dokter-schedule">
          <div class="dokter-schedule-row">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            <div class="dokter-days">
              ${(d.hari || []).map(h => `<span class="dokter-day-chip">${SHORT[h] || h}</span>`).join('')}
            </div>
          </div>
          <div class="dokter-schedule-row">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            <span>${esc(d.jamMulai) || '08:00'} – ${esc(d.jamSelesai) || '17:00'}</span>
          </div>
          ${d.hp ? `<div class="dokter-schedule-row">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.63 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.89a16 16 0 0 0 5.55 5.55l.97-.97a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.07 16c.001.31.001.62-.001.92z"/></svg>
            <span>${esc(d.hp)}</span>
          </div>` : ''}
        </div>
      </div>`).join('');
  }

  window.editDokter = function(id) {
    const d = dokters.find(x => x.id === id);
    if (!d) return;
    openModalDokter(d);
  };

  window.hapusDokter = function(id) {
    if (!confirm('Hapus dokter ini?')) return;
    dokters = dokters.filter(x => x.id !== id);
    save();
    renderDokterGrid();
    showToast('Dokter dihapus.', 'error');
  };

  /* ── Modal Dokter ── */
  const modalDokter      = document.getElementById('modalDokter');
  const modalDokterTitle = document.getElementById('modalDokterTitle');

  function openModalDokter(data) {
    const isEdit = !!data;
    modalDokterTitle.textContent = isEdit ? 'Edit Dokter' : 'Tambah Dokter';
    document.getElementById('dokterEditId').value = data?.id || '';
    document.getElementById('dNama').value       = data?.nama || '';
    document.getElementById('dSpesialis').value  = data?.spesialis || '';
    document.getElementById('dHP').value         = data?.hp || '';
    document.getElementById('dJamMulai').value   = data?.jamMulai || '08:00';
    document.getElementById('dJamSelesai').value = data?.jamSelesai || '17:00';
    /* Reset hari checkboxes */
    document.querySelectorAll('input[name="dHari"]').forEach(cb => {
      cb.checked = !!(data?.hari || []).includes(cb.value);
    });
    modalDokter.hidden = false;
    document.getElementById('dNama').focus();
  }

  function closeModalDokter() { modalDokter.hidden = true; }

  document.getElementById('btnTambahDokter').addEventListener('click', () => openModalDokter(null));
  document.getElementById('modalDokterClose').addEventListener('click', closeModalDokter);
  document.getElementById('modalDokterCancel').addEventListener('click', closeModalDokter);
  modalDokter.addEventListener('click', e => { if (e.target === modalDokter) closeModalDokter(); });

  document.getElementById('modalDokterSave').addEventListener('click', () => {
    const nama = document.getElementById('dNama').value.trim();
    if (!nama) { showToast('Nama dokter wajib diisi.', 'error'); return; }

    const hari = [...document.querySelectorAll('input[name="dHari"]:checked')].map(cb => cb.value);

    const editId = document.getElementById('dokterEditId').value;
    const obj = {
      id:         editId || uid(),
      nama,
      spesialis:  document.getElementById('dSpesialis').value.trim(),
      hp:         document.getElementById('dHP').value.trim(),
      hari,
      jamMulai:   document.getElementById('dJamMulai').value,
      jamSelesai: document.getElementById('dJamSelesai').value,
    };

    if (editId) {
      const idx = dokters.findIndex(d => d.id === editId);
      if (idx >= 0) dokters[idx] = obj;
    } else {
      dokters.push(obj);
    }

    save();
    closeModalDokter();
    renderDokterGrid();
    showToast(editId ? 'Data dokter diperbarui.' : 'Dokter ditambahkan.');
  });

  /* ================================================================
     KEUANGAN
  ================================================================ */
  function renderKeuangan() {
    const period = document.getElementById('keuanganPeriod').value;
    const today  = new Date();
    const todayISO = todayStr();

    let data = bookings.filter(b => b.status === 'selesai');

    if (period === 'today') {
      data = data.filter(b => b.tanggal === todayISO);
    } else if (period === 'week') {
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      data = data.filter(b => b.tanggal >= weekAgo);
    } else if (period === 'month') {
      const monthPrefix = todayISO.slice(0, 7);
      data = data.filter(b => b.tanggal && b.tanggal.startsWith(monthPrefix));
    }

    data.sort((a, b) => b.tanggal.localeCompare(a.tanggal));

    const total = data.reduce((s, b) => s + (parseInt(b.biaya, 10) || 0), 0);

    /* Unique days with transactions */
    const days = new Set(data.map(b => b.tanggal)).size || 1;
    const rataHari = Math.round(total / days);

    document.getElementById('keuTotal').textContent   = rupiah(total);
    document.getElementById('keuSelesai').textContent = data.length;
    document.getElementById('keuRataHari').textContent = rupiah(rataHari);

    const tbody = document.getElementById('keuanganTbody');
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Tidak ada transaksi pada periode ini.</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(b => `
      <tr>
        <td>${esc(fmtDate(b.tanggal))}<br><small style="color:#9CA3AF">${esc(b.jam)}</small></td>
        <td>${esc(b.namaPemilik)}</td>
        <td>${esc(b.namaHewan)} <small style="color:#9CA3AF">(${esc(b.jenisHewan)})</small></td>
        <td>Konsultasi Umum</td>
        <td>${esc(b.dokter) || '—'}</td>
        <td style="font-weight:700;color:#111827">${rupiah(b.biaya)}</td>
        <td>${badgeHtml(b.status)}</td>
      </tr>`).join('');
  }

  document.getElementById('keuanganPeriod').addEventListener('change', renderKeuangan);

  /* ================================================================
     PROFIL
  ================================================================ */
  function loadProfil() {
    document.getElementById('profilNama').value    = klinik.namaKlinik || '';
    document.getElementById('profilWA').value      = klinik.waKlinik   || '';
    document.getElementById('profilAlamat').value  = klinik.alamat     || '';
    document.getElementById('profilKota').value    = klinik.kota       || '';
    document.getElementById('profilJamBuka').value = klinik.jamBuka    || '08:00';
    document.getElementById('profilJamTutup').value = klinik.jamTutup  || '17:00';

    /* Hari checkboxes */
    const hariList = Array.isArray(klinik.harisBuka)
      ? klinik.harisBuka
      : (klinik.harisBuka || '').split(', ').filter(Boolean);

    document.querySelectorAll('input[name="profilHari"]').forEach(cb => {
      cb.checked = hariList.includes(cb.value);
    });
  }

  document.getElementById('btnSimpanProfil').addEventListener('click', () => {
    klinik.namaKlinik = document.getElementById('profilNama').value.trim();
    klinik.waKlinik   = document.getElementById('profilWA').value.trim();
    klinik.alamat     = document.getElementById('profilAlamat').value.trim();
    klinik.kota       = document.getElementById('profilKota').value.trim();
    klinik.jamBuka    = document.getElementById('profilJamBuka').value;
    klinik.jamTutup   = document.getElementById('profilJamTutup').value;
    klinik.harisBuka  = [...document.querySelectorAll('input[name="profilHari"]:checked')].map(cb => cb.value).join(', ');
    save();
    updateSidebarClinic();
    showToast('Profil klinik disimpan.');
  });

  /* ================================================================
     INIT
  ================================================================ */
  function init() {
    /* Try to load klinik data from registration form (localStorage key: mitraKlinik) */
    if (!klinik.namaKlinik) {
      const reg = LS.get('mitraKlinik', []);
      if (Array.isArray(reg) && reg.length) {
        const latest = reg[reg.length - 1];
        klinik = {
          namaKlinik: latest.namaKlinik || '',
          waKlinik:   latest.waKlinik   || '',
          alamat:     latest.alamat     || '',
          kota:       latest.kota       || '',
          jamBuka:    latest.jamBuka    || '08:00',
          jamTutup:   latest.jamTutup   || '17:00',
          harisBuka:  latest.harisBuka  || '',
          namaOwner:  latest.namaOwner  || '',
        };
        save();
      }
    }

    updateSidebarClinic();
    updateNavBadge();
    goPage('overview');
  }

  init();

})();
