/* ===================================================================
   AnabulKu Mitra — dashboard.js
   State disimpan di localStorage (key: anabulku_*)
=================================================================== */
(function () {
  'use strict';

  /* ── Session guard: redirect ke login jika belum login ── */
  let MITRA_ID = '';
  (function checkSession() {
    try {
      const sess = JSON.parse(localStorage.getItem('mitraSession') || 'null');
      if (!sess || !sess.loggedIn) {
        window.location.replace('login.html');
        return;
      }
      MITRA_ID = sess.mitraId || '';
    } catch (_) {
      window.location.replace('login.html');
    }
  })();

  /* ── Storage helpers — semua key dinominal per klinik (MITRA_ID) ── */
  const NS = (key) => MITRA_ID ? `${key}_${MITRA_ID}` : key;

  const LS = {
    get: (key, def) => { try { return JSON.parse(localStorage.getItem(NS(key))) ?? def; } catch { return def; } },
    set: (key, val) => localStorage.setItem(NS(key), JSON.stringify(val)),
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

  /* Sync perubahan dashboard kembali ke mitraKlinik[] agar terbaca app user.
     mitraKlinik adalah key GLOBAL (tidak di-namespace) — dibaca semua klinik */
  function syncToMitraKlinik() {
    try {
      /* Baca langsung dari localStorage tanpa namespace */
      let list = [];
      try { list = JSON.parse(localStorage.getItem('mitraKlinik') || '[]'); } catch (_) {}
      if (!Array.isArray(list) || !list.length) return;

      /* Cari index klinik berdasarkan MITRA_ID dulu, lalu fallback nama */
      let idx = MITRA_ID ? list.findIndex(c => c.id === MITRA_ID) : -1;
      if (idx < 0) idx = list.findIndex(c =>
        c.namaKlinik && klinik.namaKlinik && c.namaKlinik === klinik.namaKlinik
      );
      if (idx < 0) return; /* klinik tidak ditemukan — jangan timpa data klinik lain */

      /* Update field profil — JANGAN timpa adminStatus yang sudah di-set admin */
      list[idx] = Object.assign({}, list[idx], {
        namaKlinik:    klinik.namaKlinik    || list[idx].namaKlinik,
        waKlinik:      klinik.waKlinik      || list[idx].waKlinik,
        alamat:        klinik.alamat        || list[idx].alamat,
        kota:          klinik.kota          || list[idx].kota,
        jamBuka:       klinik.jamBuka       || list[idx].jamBuka,
        jamTutup:      klinik.jamTutup      || list[idx].jamTutup,
        harisBuka:     klinik.harisBuka     || list[idx].harisBuka,
        namaOwner:     klinik.namaOwner     || list[idx].namaOwner,
        /* Pertahankan adminStatus dari admin — JANGAN timpa */
        adminStatus:   list[idx].adminStatus || klinik.adminStatus || 'pending',
        hewanDilayani: list[idx].hewanDilayani || klinik.hewanDilayani || [],
        tipeKlinik:    list[idx].tipeKlinik    || klinik.tipeKlinik    || [],
        /* Sync dokter agar clinic-detail.js bisa membacanya */
        dokters: dokters.map(d => ({
          id:           d.id,
          nama:         d.nama,
          spesialisasi: d.spesialis || 'Dokter Umum',
          spesialis:    d.spesialis || 'Dokter Umum',
          hp:           d.hp || '',
          fotoDataUrl:  d.fotoDataUrl || '',
          /* Format baru: jadwal lengkap dengan sessions per hari */
          jadwal:       Array.isArray(d.jadwal) && d.jadwal.length ? d.jadwal : [],
          /* Format lama: compat hari[] + jamMulai/jamSelesai */
          hari:         Array.isArray(d.hari) ? d.hari : (d.hari ? d.hari.split(/[,\s]+/).filter(Boolean) : []),
          jamMulai:     d.jamMulai  || '',
          jamSelesai:   d.jamSelesai || '',
        })),
        /* Simpan bookings & pasiens lengkap untuk fallback restore saat login di browser baru */
        bookings: bookings,
        pasiens:  pasiens,
        /* Expose slot terisi (format ringkas) untuk clinic-detail.js */
        bookedSlots: bookings
          .filter(b => b.status === 'dikonfirmasi' || b.status === 'menunggu')
          .map(b => ({
            tanggal: b.tanggal,
            jam:     b.jam,
            dokter:  b.dokter,
            status:  b.status,
          })),
      });

      /* Tulis kembali ke key global (bukan namespace) */
      localStorage.setItem('mitraKlinik', JSON.stringify(list));
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

  /* Badge HTML — status klinik */
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

  /* Sync statusPembayaran & status dari key global (ditulis app user) ke namespace mitra.
     Dipanggil setiap kali tabel booking di-render agar perubahan user (batal/bayar) langsung
     terlihat di dashboard tanpa mitra perlu reload manual. */
  function syncFromGlobalBookings() {
    try {
      let globalBks = JSON.parse(localStorage.getItem('anabulku_bookings') || '[]');
      if (!Array.isArray(globalBks)) globalBks = [];

      let mitraChanged  = false; /* perubahan di bookings namespace mitra */
      let globalChanged = false; /* perubahan yang perlu ditulis kembali ke key global */

      /* ① User → mitra: baca perubahan dari app user ke namespace mitra */
      globalBks.forEach(function(gb) {
        const idx = bookings.findIndex(b => b.id === gb.id);
        if (idx < 0) return;
        if (bookings[idx].statusPembayaran !== gb.statusPembayaran) {
          bookings[idx].statusPembayaran = gb.statusPembayaran;
          mitraChanged = true;
        }
        if (gb.status === 'dibatalkan' && bookings[idx].status !== 'dibatalkan') {
          bookings[idx].status = 'dibatalkan';
          mitraChanged = true;
        }
      });

      /* ② Mitra → user: tulis status selesai/dikonfirmasi dari mitra ke key global
         agar riwayat.html user langsung menampilkan status terbaru */
      bookings.forEach(function(mb) {
        const gIdx = globalBks.findIndex(g => g.id === mb.id);
        if (gIdx < 0) return;
        const statusesToSync = ['selesai', 'dikonfirmasi', 'dibatalkan'];
        if (statusesToSync.includes(mb.status) && globalBks[gIdx].status !== mb.status) {
          globalBks[gIdx].status = mb.status;
          globalChanged = true;
        }
      });

      if (mitraChanged) LS.set('anabulku_bookings', bookings);
      if (globalChanged) localStorage.setItem('anabulku_bookings', JSON.stringify(globalBks));
    } catch (_) { /* silent */ }
  }

  /* Badge HTML — status pembayaran */
  function badgeBayarHtml(statusPembayaran) {
    const map = {
      menunggu_pembayaran: ['badge--menunggu',    'Belum Dibayar'],
      bayar_ditempat:      ['badge--dikonfirmasi','Bayar di Tempat'],
      lunas:               ['badge--selesai',     'Lunas'],
      dibatalkan:          ['badge--dibatalkan',  'Dibatalkan'],
    };
    if (!statusPembayaran) return '<span class="badge badge--menunggu">Belum Ada</span>';
    const [cls, lbl] = map[statusPembayaran] || ['badge--menunggu', statusPembayaran];
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

  /* ── Logout ── */
  document.getElementById('btnLogoutMitra').addEventListener('click', () => {
    if (!confirm('Yakin ingin keluar dari dashboard?')) return;
    localStorage.removeItem('mitraSession');
    window.location.replace('login.html');
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

    /* Tampilkan nama owner di bawah nama klinik (status "Online") */
    const ownerEl = document.getElementById('sidebarOwnerName');
    if (ownerEl) ownerEl.textContent = klinik.namaOwner ? '● ' + klinik.namaOwner : '● Online';
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

    /* Hitung total pasien unik dari semua booking selesai (bukan dari pasiens[] yang mungkin kosong) */
    const uniquePasien = new Set(
      bookings.filter(b => b.status === 'selesai')
              .map(b => (b.namaPemilik + '||' + b.namaHewan).toLowerCase())
    ).size;

    document.getElementById('statBookingHariIni').textContent = todayBookings.length;
    document.getElementById('statSelesai').textContent        = todaySelesai.length;
    document.getElementById('statPasien').textContent         = uniquePasien;
    document.getElementById('statPendapatan').textContent     = rupiah(todayPendapatan);

    /* Greeting — pakai nama klinik */
    const h = new Date().getHours();
    const greeting = h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
    const nama = klinik.namaKlinik || klinik.namaOwner || '';
    document.getElementById('overviewGreeting').textContent = `${greeting}${nama ? ', ' + nama : ''}!`;

    /* Date */
    const dateEl = document.getElementById('pageDate');
    if (dateEl) {
      dateEl.textContent = new Date().toLocaleDateString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
    }

    /* Booking list: hanya tampilkan yang belum datang (menunggu / dikonfirmasi) */
    const list = document.getElementById('overviewBookingList');
    const jadwalBelumDatang = todayBookings.filter(b => b.status === 'menunggu' || b.status === 'dikonfirmasi');
    if (!jadwalBelumDatang.length) {
      list.innerHTML = '<p class="empty-state">' + (todayBookings.length ? 'Semua pasien hari ini sudah ditangani.' : 'Belum ada booking hari ini.') + '</p>';
      return;
    }
    const sorted = [...jadwalBelumDatang].sort((a, b) => a.jam.localeCompare(b.jam));
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
    syncFromGlobalBookings();
    updateNavBadge();
    let data = [...bookings].sort((a, b) => {
      /* Sort berdasarkan createdAt (waktu booking dibuat) — terbaru di atas.
         Fallback ke tanggal+jam jika createdAt tidak ada. */
      const ca = a.createdAt || (a.tanggal + 'T' + (a.jam || '00:00'));
      const cb = b.createdAt || (b.tanggal + 'T' + (b.jam || '00:00'));
      return cb.localeCompare(ca); /* descending: terbaru di atas */
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
      tbody.innerHTML = '<tr><td colspan="10" class="empty-state">Tidak ada data booking.</td></tr>';
      return;
    }
    tbody.innerHTML = data.map((b, i) => {
      /* Aksi kontekstual berdasarkan status booking */
      let aksiHtml = '';
      if (b.status === 'menunggu') {
        aksiHtml =
          `<button class="btn-icon btn-icon--confirm" title="Konfirmasi Booking" onclick="konfirmasiBooking('${b.id}')">✔</button>` +
          `<button class="btn-icon btn-icon--edit"    title="Edit"               onclick="editBooking('${b.id}')">✎</button>` +
          `<button class="btn-icon btn-icon--del"     title="Batalkan"           onclick="hapusBooking('${b.id}')">✕</button>`;
      } else if (b.status === 'dikonfirmasi') {
        aksiHtml =
          `<button class="btn-icon btn-icon--check"   title="Tandai Selesai"     onclick="markSelesai('${b.id}')">✓</button>` +
          `<button class="btn-icon btn-icon--edit"    title="Edit"               onclick="editBooking('${b.id}')">✎</button>` +
          `<button class="btn-icon btn-icon--del"     title="Batalkan"           onclick="hapusBooking('${b.id}')">✕</button>`;
      } else {
        aksiHtml =
          `<button class="btn-icon btn-icon--edit"    title="Edit"               onclick="editBooking('${b.id}')">✎</button>` +
          `<button class="btn-icon btn-icon--del"     title="Hapus"              onclick="hapusBooking('${b.id}')">✕</button>`;
      }

      return `
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
        <td>${badgeBayarHtml(b.statusPembayaran)}</td>
        <td>${badgeHtml(b.status)}</td>
        <td>
          <div class="action-btns">
            ${aksiHtml}
          </div>
        </td>
      </tr>`;
    }).join('');
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
  window.konfirmasiBooking = function(id) {
    const b = bookings.find(x => x.id === id);
    if (!b) return;
    b.status = 'dikonfirmasi';
    b.konfirmasiAt = new Date().toISOString();
    save();
    renderBookingTable();
    updateNavBadge();
    showToast('Booking dikonfirmasi.');

    /* ── Tulis notifikasi ke user ── */
    try {
      const namaKlinik = klinik.namaKlinik || 'Klinik';
      const tgl = b.tanggal
        ? new Date(b.tanggal + 'T00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        : '';
      const notifList = JSON.parse(localStorage.getItem('anabulku_notifications') || '[]');
      notifList.unshift({
        id:    Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        type:  'success',
        title: 'Booking Dikonfirmasi ✔',
        body:  namaKlinik + ' telah mengkonfirmasi booking ' + (b.namaHewan || '') + '. Silakan datang pada ' + tgl + ' pukul ' + (b.jam || '') + '. Kami menunggu kedatangan Anda!',
        time:  new Date().toISOString(),
        read:  false,
        link:  'riwayat.html',
      });
      /* Batasi max 50 notifikasi */
      localStorage.setItem('anabulku_notifications', JSON.stringify(notifList.slice(0, 50)));
    } catch (_) { /* silent */ }
  };

  window.markSelesai = function(id) {
    const b = bookings.find(x => x.id === id);
    if (!b) return;
    b.status = 'selesai';

    /* Auto-add / update entri pasien saat booking selesai */
    const key = (b.namaPemilik + '||' + b.namaHewan).toLowerCase();
    const existing = pasiens.find(p =>
      (p.namaPemilik + '||' + p.namaHewan).toLowerCase() === key
    );
    if (!existing) {
      pasiens.unshift({
        id:               uid(),
        namaHewan:        b.namaHewan    || '',
        jenisHewan:       b.jenisHewan   || '',
        ras:              b.ras          || '',
        umur:             b.umur         || '',
        namaPemilik:      b.namaPemilik  || '',
        noHP:             b.noHP         || '',
        kunjunganTerakhir: b.tanggal     || todayStr(),
        riwayat:          b.keluhan      || '',
        createdAt:        new Date().toISOString(),
      });
    } else {
      /* Update tanggal kunjungan terakhir jika lebih baru */
      if (b.tanggal && b.tanggal > (existing.kunjunganTerakhir || '')) {
        existing.kunjunganTerakhir = b.tanggal;
      }
    }

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
    /* Bangun daftar dari booking selesai — tidak bergantung pada pasiens[] yang mungkin kosong.
       Gabungkan dengan data pasiens[] jika ada entri yang cocok (untuk ras, umur, riwayat, dll). */
    const bookingSelesai = bookings.filter(b => b.status === 'selesai');

    /* Deduplicate berdasarkan namaPemilik+namaHewan, ambil kunjungan terbaru */
    const map = new Map();
    bookingSelesai.forEach(b => {
      const key = (b.namaPemilik + '||' + b.namaHewan).toLowerCase();
      const existing = map.get(key);
      if (!existing || b.tanggal > (existing.tanggal || '')) {
        map.set(key, b);
      }
    });

    /* Merge dengan pasiens[] untuk data tambahan (ras, umur, riwayat) */
    let data = Array.from(map.values()).map(b => {
      const key = (b.namaPemilik + '||' + b.namaHewan).toLowerCase();
      const extra = pasiens.find(p => (p.namaPemilik + '||' + p.namaHewan).toLowerCase() === key) || {};
      return {
        id:                extra.id               || b.id,
        namaHewan:         b.namaHewan            || '',
        jenisHewan:        b.jenisHewan           || '',
        ras:               extra.ras              || b.ras || '',
        umur:              extra.umur             || b.umur || '',
        namaPemilik:       b.namaPemilik          || '',
        noHP:              b.noHP                 || extra.noHP || '',
        kunjunganTerakhir: b.tanggal              || '',
        riwayat:           extra.riwayat          || b.keluhan || '',
      };
    });

    data.sort((a, b) => (b.kunjunganTerakhir || '').localeCompare(a.kunjunganTerakhir || ''));

    const q = document.getElementById('pasienSearch').value.trim().toLowerCase();
    if (q) data = data.filter(p =>
      p.namaHewan.toLowerCase().includes(q) ||
      p.namaPemilik.toLowerCase().includes(q)
    );

    const tbody = document.getElementById('pasienTbody');
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty-state">Belum ada pasien yang sudah selesai berkunjung.</td></tr>';
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

    grid.innerHTML = dokters.map(d => {
      /* Normalisasi jadwal ke format baru */
      const jadwal = Array.isArray(d.jadwal) && d.jadwal.length
        ? d.jadwal
        : (Array.isArray(d.hari) ? d.hari.map(h => ({ hari: h, mulai: d.jamMulai || '08:00', selesai: d.jamSelesai || '17:00', sessions: [{ mulai: d.jamMulai || '08:00', selesai: d.jamSelesai || '17:00' }] })) : []);

      const jadwalRows = jadwal.map(j => {
        /* Tampilkan semua sesi per hari */
        const sessions = Array.isArray(j.sessions) && j.sessions.length
          ? j.sessions
          : [{ mulai: j.mulai || '08:00', selesai: j.selesai || '17:00' }];
        const sesiHtml = sessions.map((s, si) =>
          `<span class="dokter-jadwal-sesi">${si > 0 ? ' · ' : ''}${esc(s.mulai)}–${esc(s.selesai)}</span>`
        ).join('');
        return `<div class="dokter-jadwal-row">
          <span class="dokter-jadwal-hari">${esc(SHORT[j.hari] || j.hari)}</span>
          <span class="dokter-jadwal-jam">${sesiHtml}</span>
        </div>`;
      }).join('');

      return `
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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" style="flex-shrink:0"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            <div class="dokter-jadwal-list">${jadwalRows || '<span style="color:#9CA3AF;font-size:12px">Belum ada jadwal</span>'}</div>
          </div>
        </div>
      </div>`;
    }).join('');
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

  /* ── Jadwal dokter: multi-sesi per hari ── */

  /* Buat satu baris sesi (input mulai-selesai + tombol hapus) */
  function buatBarisSesi(mulai, selesai) {
    const wrap = document.createElement('div');
    wrap.className = 'sesi-row';
    wrap.innerHTML =
      '<div class="jadwal-jam-pill"><span>Mulai</span><input class="jadwal-input" type="time" value="' + (mulai || '08:00') + '" /></div>' +
      '<span class="jadwal-sep">–</span>' +
      '<div class="jadwal-jam-pill"><span>Selesai</span><input class="jadwal-input" type="time" value="' + (selesai || '17:00') + '" /></div>' +
      '<button type="button" class="btn-hapus-sesi" aria-label="Hapus sesi">✕</button>';
    wrap.querySelector('.btn-hapus-sesi').addEventListener('click', () => wrap.remove());
    return wrap;
  }

  /* Init toggle + "+ Sesi" listener di #dokterJadwalList */
  function initDokterJadwalToggles() {
    /* Clone untuk buang listener lama */
    document.querySelectorAll('#dokterJadwalList .jadwal-toggle').forEach(btn => {
      btn.replaceWith(btn.cloneNode(true));
    });
    document.querySelectorAll('#dokterJadwalList .btn-tambah-sesi').forEach(btn => {
      btn.replaceWith(btn.cloneNode(true));
    });

    document.querySelectorAll('#dokterJadwalList .jadwal-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const row      = btn.closest('.jadwal-row');
        const sesiWrap = row.querySelector('.jadwal-sesi-wrap');
        const sesiList = row.querySelector('.jadwal-sesi-list');
        const lblEl    = row.querySelector('.jadwal-tutup-label');
        const namaEl   = row.querySelector('.jadwal-nama');
        const isOn     = btn.getAttribute('aria-pressed') === 'true';

        btn.setAttribute('aria-pressed', String(!isOn));
        btn.classList.toggle('is-on', !isOn);
        sesiWrap.hidden = isOn;
        lblEl.hidden    = !isOn;
        namaEl.classList.toggle('jadwal-nama--off', isOn);

        /* Auto-tambah 1 sesi default saat hari baru diaktifkan */
        if (!isOn && sesiList.children.length === 0) {
          sesiList.appendChild(buatBarisSesi('08:00', '17:00'));
        }
      });
    });

    document.querySelectorAll('#dokterJadwalList .btn-tambah-sesi').forEach(btn => {
      btn.addEventListener('click', () => {
        const sesiList = btn.closest('.jadwal-sesi-wrap').querySelector('.jadwal-sesi-list');
        sesiList.appendChild(buatBarisSesi('08:00', '17:00'));
      });
    });
  }

  /* Reset semua hari ke "libur", lalu terapkan data jadwal dokter
     jadwal: [{hari, mulai, selesai, sessions:[{mulai,selesai}]}] atau format lama */
  function resetDokterJadwal(jadwal) {
    /* Normalisasi ke map: { "Senin": [{mulai, selesai},...], ... } */
    const map = {};

    if (Array.isArray(jadwal) && jadwal.length && typeof jadwal[0] === 'object' && jadwal[0].hari) {
      jadwal.forEach(j => {
        const sessions = Array.isArray(j.sessions) && j.sessions.length
          ? j.sessions
          : [{ mulai: j.mulai || '08:00', selesai: j.selesai || '17:00' }];
        map[j.hari] = sessions;
      });
    } else if (Array.isArray(jadwal)) {
      jadwal.forEach(h => {
        if (typeof h === 'string') map[h] = [{ mulai: '08:00', selesai: '17:00' }];
      });
    }

    document.querySelectorAll('#dokterJadwalList .jadwal-row').forEach(row => {
      const day      = row.dataset.day;
      const btn      = row.querySelector('.jadwal-toggle');
      const sesiWrap = row.querySelector('.jadwal-sesi-wrap');
      const sesiList = row.querySelector('.jadwal-sesi-list');
      const lblEl    = row.querySelector('.jadwal-tutup-label');
      const namaEl   = row.querySelector('.jadwal-nama');

      const aktif = !!map[day];
      btn.setAttribute('aria-pressed', String(aktif));
      btn.classList.toggle('is-on', aktif);
      sesiWrap.hidden = !aktif;
      lblEl.hidden    = aktif;
      namaEl.classList.toggle('jadwal-nama--off', !aktif);

      /* Reset sesi list */
      sesiList.innerHTML = '';
      if (aktif) {
        map[day].forEach(s => sesiList.appendChild(buatBarisSesi(s.mulai, s.selesai)));
      }
    });
  }

  /* Baca jadwal dari form modal → array [{hari, mulai, selesai, sessions:[]}] */
  function readDokterJadwal() {
    const result = [];
    document.querySelectorAll('#dokterJadwalList .jadwal-row').forEach(row => {
      const btn = row.querySelector('.jadwal-toggle');
      if (btn.getAttribute('aria-pressed') !== 'true') return;
      const day = row.dataset.day;
      const sesiRows = row.querySelectorAll('.sesi-row');
      const sessions = [];
      sesiRows.forEach(sr => {
        const inputs = sr.querySelectorAll('input[type="time"]');
        sessions.push({ mulai: inputs[0]?.value || '08:00', selesai: inputs[1]?.value || '17:00' });
      });
      if (!sessions.length) sessions.push({ mulai: '08:00', selesai: '17:00' });
      result.push({
        hari:     day,
        mulai:    sessions[0].mulai,
        selesai:  sessions[sessions.length - 1].selesai,
        sessions,
      });
    });
    return result;
  }

  /* ── Modal Dokter ── */
  const modalDokter      = document.getElementById('modalDokter');
  const modalDokterTitle = document.getElementById('modalDokterTitle');

  function openModalDokter(data) {
    const isEdit = !!data;
    modalDokterTitle.textContent = isEdit ? 'Edit Dokter' : 'Tambah Dokter';
    document.getElementById('dokterEditId').value = data?.id || '';
    document.getElementById('dNama').value        = data?.nama || '';
    document.getElementById('dSpesialis').value   = data?.spesialis || '';

    /* Init toggle listener (clone dulu untuk hapus listener lama) */
    initDokterJadwalToggles();

    /* Restore jadwal */
    if (data) {
      /* Format baru: jadwal array; Format lama: hari array + jamMulai/jamSelesai */
      const jadwalData = Array.isArray(data.jadwal) && data.jadwal.length
        ? data.jadwal
        : (Array.isArray(data.hari) ? data.hari.map(h => ({ hari: h, mulai: data.jamMulai || '08:00', selesai: data.jamSelesai || '17:00' })) : []);
      resetDokterJadwal(jadwalData);
    } else {
      resetDokterJadwal([]);
    }

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

    const jadwal = readDokterJadwal();
    if (!jadwal.length) { showToast('Pilih minimal satu hari tugas.', 'error'); return; }

    /* Kompat: hari[] dan jamMulai/jamSelesai untuk syncToMitraKlinik & clinic-detail */
    const hari      = jadwal.map(j => j.hari);
    const jamMulai  = jadwal[0]?.mulai   || '08:00';
    const jamSelesai = jadwal[0]?.selesai || '17:00';

    const editId = document.getElementById('dokterEditId').value;
    const obj = {
      id:         editId || uid(),
      nama,
      spesialis:  document.getElementById('dSpesialis').value.trim(),
      jadwal,        /* format baru: [{hari, mulai, selesai}] */
      hari,          /* format lama: compat */
      jamMulai,      /* format lama: compat */
      jamSelesai,    /* format lama: compat */
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
  /* ── Helper: init toggle untuk profilJadwalList ── */
  function initProfilJadwalToggles() {
    document.querySelectorAll('#profilJadwalList .jadwal-toggle').forEach(btn => {
      btn.replaceWith(btn.cloneNode(true));
    });
    document.querySelectorAll('#profilJadwalList .jadwal-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const row    = btn.closest('.jadwal-row');
        const jamEl  = row.querySelector('.jadwal-jam');
        const lblEl  = row.querySelector('.jadwal-tutup-label');
        const namaEl = row.querySelector('.jadwal-nama');
        const isOn   = btn.getAttribute('aria-pressed') === 'true';
        btn.setAttribute('aria-pressed', String(!isOn));
        btn.classList.toggle('is-on', !isOn);
        jamEl.hidden  = isOn;
        lblEl.hidden  = !isOn;
        namaEl.classList.toggle('jadwal-nama--off', isOn);
      });
    });
  }

  /* Isi profilJadwalList dari data jadwal klinik.
     Format daftar.js: jadwal = [{hari, jamBuka, jamTutup, buka}, ...]
     field-name input: profilBuka{Hari} / profilTutup{Hari} */
  function loadProfilJadwal() {
    /* Bangun map dari data jadwal klinik */
    const map = {};

    /* Format daftar.js: [{hari:'Senin', jamBuka:'08:00', jamTutup:'20:00', buka:true}] */
    if (Array.isArray(klinik.jadwal) && klinik.jadwal.length) {
      klinik.jadwal.forEach(j => {
        if (!j.hari) return;
        map[j.hari] = {
          aktif: j.buka !== false,
          buka:  j.jamBuka  || j.mulai   || '08:00',
          tutup: j.jamTutup || j.selesai || '20:00',
        };
      });
    }

    /* Fallback ke harisBuka string + jamBuka/jamTutup tunggal */
    if (!Object.keys(map).length && klinik.harisBuka) {
      const hariList = (klinik.harisBuka || '').split(', ').filter(Boolean);
      hariList.forEach(h => {
        map[h] = { aktif: true, buka: klinik.jamBuka || '08:00', tutup: klinik.jamTutup || '20:00' };
      });
    }

    document.querySelectorAll('#profilJadwalList .jadwal-row').forEach(row => {
      const day    = row.dataset.day;
      const btn    = row.querySelector('.jadwal-toggle');
      const jamEl  = row.querySelector('.jadwal-jam');
      const lblEl  = row.querySelector('.jadwal-tutup-label');
      const namaEl = row.querySelector('.jadwal-nama');
      const entry  = map[day];
      const aktif  = !!(entry && entry.aktif);

      btn.setAttribute('aria-pressed', String(aktif));
      btn.classList.toggle('is-on', aktif);
      jamEl.hidden  = !aktif;
      lblEl.hidden  = aktif;
      namaEl.classList.toggle('jadwal-nama--off', !aktif);

      if (entry) {
        const inputBuka  = row.querySelector(`input[name="profilBuka${day}"]`);
        const inputTutup = row.querySelector(`input[name="profilTutup${day}"]`);
        if (inputBuka)  inputBuka.value  = entry.buka;
        if (inputTutup) inputTutup.value = entry.tutup;
      }
    });
  }

  /* Baca jadwal dari profilJadwalList → array [{hari, jamBuka, jamTutup, buka}] */
  function readProfilJadwal() {
    const result = [];
    document.querySelectorAll('#profilJadwalList .jadwal-row').forEach(row => {
      const day   = row.dataset.day;
      const btn   = row.querySelector('.jadwal-toggle');
      const aktif = btn.getAttribute('aria-pressed') === 'true';
      const inputBuka  = row.querySelector(`input[name="profilBuka${day}"]`);
      const inputTutup = row.querySelector(`input[name="profilTutup${day}"]`);
      result.push({
        hari:     day,
        buka:     aktif,
        jamBuka:  inputBuka  ? inputBuka.value  : '08:00',
        jamTutup: inputTutup ? inputTutup.value : '20:00',
      });
    });
    return result;
  }

  function loadProfil() {
    document.getElementById('profilNama').value   = klinik.namaKlinik || '';
    document.getElementById('profilWA').value     = klinik.waKlinik   || '';
    document.getElementById('profilAlamat').value = klinik.alamat     || '';
    document.getElementById('profilKota').value   = klinik.kota       || '';

    /* Init toggle listeners lalu isi jadwal */
    initProfilJadwalToggles();
    loadProfilJadwal();
  }

  document.getElementById('btnSimpanProfil').addEventListener('click', () => {
    klinik.namaKlinik = document.getElementById('profilNama').value.trim();
    klinik.waKlinik   = document.getElementById('profilWA').value.trim();
    klinik.alamat     = document.getElementById('profilAlamat').value.trim();
    klinik.kota       = document.getElementById('profilKota').value.trim();

    /* Simpan jadwal per hari */
    const jadwal = readProfilJadwal();
    klinik.jadwal    = jadwal;
    klinik.harisBuka = jadwal.filter(j => j.buka).map(j => j.hari).join(', ');

    /* Derivasi jamBuka/jamTutup dari hari pertama yang aktif */
    const firstAktif = jadwal.find(j => j.buka);
    klinik.jamBuka  = firstAktif ? firstAktif.jamBuka  : (klinik.jamBuka  || '08:00');
    klinik.jamTutup = firstAktif ? firstAktif.jamTutup : (klinik.jamTutup || '20:00');

    save();
    updateSidebarClinic();
    showToast('Profil klinik disimpan.');
  });

  /* ================================================================
     INIT
  ================================================================ */
  function init() {
    /* Ambil session dan daftar klinik dari key GLOBAL (tidak di-namespace) */
    let sess = null;
    let reg  = [];
    try { sess = JSON.parse(localStorage.getItem('mitraSession') || 'null'); } catch (_) {}
    try { reg  = JSON.parse(localStorage.getItem('mitraKlinik')  || '[]');  } catch (_) {}

    /* SELALU sync dari mitraKlinik[] saat init agar data pendaftaran selalu fresh. */
    if (!Array.isArray(reg)) reg = [];
    if (Array.isArray(reg) && reg.length) {
      /* Cari klinik berdasarkan mitraId dari session, fallback ke email lalu namaKlinik */
      let match = null;
      if (sess?.mitraId) {
        match = reg.find(k => k.id === sess.mitraId);
      }
      if (!match && sess?.email) {
        match = reg.find(k => k.emailAkun && k.emailAkun.toLowerCase() === sess.email.toLowerCase());
      }
      if (!match && sess?.namaKlinik) {
        match = reg.find(k => k.namaKlinik === sess.namaKlinik);
      }
      /* fallback: klinik terakhir yang didaftarkan */
      if (!match) match = reg[reg.length - 1];

      if (match) {
        /* Derivasi jamBuka/jamTutup dari jadwal[] jika field langsung kosong */
        let jamBuka  = match.jamBuka  || '';
        let jamTutup = match.jamTutup || '';
        if ((!jamBuka || !jamTutup) && Array.isArray(match.jadwal) && match.jadwal.length) {
          const firstDay = match.jadwal.find(j => j.buka !== false);
          if (firstDay) {
            jamBuka  = jamBuka  || firstDay.jamBuka  || '08:00';
            jamTutup = jamTutup || firstDay.jamTutup || '20:00';
          }
        }

        /* Merge: data pendaftaran menimpa profil lama, tapi booking/pasien/dokter dipertahankan */
        klinik = Object.assign({}, klinik, {
          namaKlinik:    match.namaKlinik    || klinik.namaKlinik || '',
          waKlinik:      match.waKlinik      || klinik.waKlinik   || '',
          alamat:        match.alamat        || klinik.alamat     || '',
          kota:          match.kota          || klinik.kota       || '',
          provinsi:      match.provinsi      || '',
          kodePos:       match.kodePos       || '',
          jamBuka,
          jamTutup,
          harisBuka:     match.harisBuka     || '',
          jadwal:        match.jadwal        || [],
          namaOwner:     match.namaOwner     || klinik.namaOwner || '',
          tipeKlinik:    match.tipeKlinik    || '',
          hewanDilayani: match.hewanDilayani || [],
          layanan:       match.layanan       || '',
          hargaMulai:    match.hargaMulai    || '',
          googleRating:  match.googleRating  || null,
          adminStatus:   match.adminStatus   || match.status || '',
          _mitraId:      match.id            || '',
        });
        LS.set('anabulku_klinik', klinik);

        /* Jika namespace storage kosong, restore dari mitraKlinik[] sebagai fallback
           (misalnya saat login di browser baru atau setelah clear namespace storage) */
        if (!dokters.length && Array.isArray(match.dokters) && match.dokters.length) {
          dokters = match.dokters.map(d => ({
            id:         d.id         || (Date.now().toString(36) + Math.random().toString(36).slice(2, 7)),
            nama:       d.nama       || '',
            spesialis:  d.spesialis  || d.spesialisasi || 'Dokter Umum',
            hp:         d.hp         || '',
            fotoDataUrl:d.fotoDataUrl|| '',
            jadwal:     Array.isArray(d.jadwal)  ? d.jadwal  : [],
            hari:       Array.isArray(d.hari)    ? d.hari    : [],
            jamMulai:   d.jamMulai   || '',
            jamSelesai: d.jamSelesai || '',
          }));
          LS.set('anabulku_dokters', dokters);
        }

        /* Restore bookings dari mitraKlinik[].bookings jika namespace kosong */
        if (!bookings.length && Array.isArray(match.bookings) && match.bookings.length) {
          bookings = match.bookings;
          LS.set('anabulku_bookings', bookings);
        }

        /* Restore pasiens dari mitraKlinik[].pasiens jika namespace kosong */
        if (!pasiens.length && Array.isArray(match.pasiens) && match.pasiens.length) {
          pasiens = match.pasiens;
          LS.set('anabulku_pasiens', pasiens);
        }
      }
    }

    /* Fallback: ambil dari session jika mitraKlinik[] tidak ada */
    if (!klinik.namaKlinik && sess?.namaKlinik) {
      klinik.namaKlinik = sess.namaKlinik;
    }
    if (!klinik.namaOwner && sess?.namaOwner) {
      klinik.namaOwner = sess.namaOwner;
    }

    updateSidebarClinic();
    updateNavBadge();
    goPage('overview');
  }

  init();

})();
