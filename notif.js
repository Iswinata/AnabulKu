/* ===================================================================
   AnabulKu — notif.js
   Standalone notification system untuk user app
   -------------------------------------------------------------------
   Notifikasi disimpan di localStorage["anabulku_notifications"]
   Format: [{id, type, title, body, time, read, link}]
=================================================================== */

(function () {
  'use strict';

  const STORAGE_KEY = 'anabulku_notifications';
  const MAX_NOTIF = 50;

  /* ── Helpers ── */
  function LS_get(key, def) {
    try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; }
  }
  function LS_set(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  /* ── Get all notifications ── */
  function getNotifs() {
    return LS_get(STORAGE_KEY, []);
  }

  /* ── Save notifications (dengan limit MAX_NOTIF) ── */
  function saveNotifs(list) {
    LS_set(STORAGE_KEY, list.slice(0, MAX_NOTIF));
  }

  /* ── Add new notification ── */
  function addNotif(notif) {
    const list = getNotifs();
    list.unshift({
      id:    Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      type:  notif.type  || 'info', /* info | success | warning | error */
      title: notif.title || 'Notifikasi',
      body:  notif.body  || '',
      time:  notif.time  || new Date().toISOString(),
      read:  notif.read  || false,
      link:  notif.link  || null,
    });
    saveNotifs(list);
  }

  /* ── Mark notification as read ── */
  function markRead(id) {
    const list = getNotifs();
    const notif = list.find(n => n.id === id);
    if (notif) {
      notif.read = true;
      saveNotifs(list);
    }
  }

  /* ── Mark all as read ── */
  function markAllRead() {
    const list = getNotifs();
    list.forEach(n => { n.read = true; });
    saveNotifs(list);
  }

  /* ── Delete notification ── */
  function deleteNotif(id) {
    let list = getNotifs();
    list = list.filter(n => n.id !== id);
    saveNotifs(list);
  }

  /* ── Clear all notifications ── */
  function clearAll() {
    saveNotifs([]);
  }

  /* ── Get unread count ── */
  function getUnreadCount() {
    return getNotifs().filter(n => !n.read).length;
  }

  /* ── Expose global API ── */
  window.AnabulkuNotif = {
    getNotifs,
    addNotif,
    markRead,
    markAllRead,
    deleteNotif,
    clearAll,
    getUnreadCount,
  };

  /* ── Auto-init bell icon badge on any page ── */
  function updateBellBadge() {
    const badge = document.querySelector('.act-btn[aria-label="Notifikasi"] .badge');
    if (!badge) return;
    const count = getUnreadCount();
    badge.textContent = count;
    badge.hidden = count === 0;
  }

  /* ── Render notification panel (dropdown) ── */
  function renderNotifPanel() {
    const bellBtn = document.querySelector('.act-btn[aria-label="Notifikasi"]');
    if (!bellBtn) return;

    /* Buat panel jika belum ada */
    let panel = document.getElementById('notifPanel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'notifPanel';
      panel.className = 'notif-panel';
      panel.hidden = true;
      panel.innerHTML =
        '<div class="notif-panel-header">' +
          '<h3 class="notif-panel-title">Notifikasi</h3>' +
          '<button class="notif-panel-mark-all" id="notifMarkAll" type="button">Tandai Semua Dibaca</button>' +
        '</div>' +
        '<div class="notif-panel-body" id="notifPanelBody"></div>';
      document.body.appendChild(panel);
    }

    const panelBody = document.getElementById('notifPanelBody');
    const list = getNotifs();

    if (!list.length) {
      panelBody.innerHTML =
        '<div class="notif-empty">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="48" height="48" aria-hidden="true">' +
            '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>' +
          '</svg>' +
          '<p>Belum ada notifikasi</p>' +
        '</div>';
    } else {
      panelBody.innerHTML = list.map(n => {
        const iconMap = {
          success: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/>',
          warning: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
          error:   '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>',
          info:    '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
        };
        const icon = iconMap[n.type] || iconMap.info;
        const colorMap = { success: '#10B981', warning: '#F59E0B', error: '#EF4444', info: '#3B82F6' };
        const color = colorMap[n.type] || colorMap.info;

        const timeStr = fmtTime(n.time);
        const readClass = n.read ? 'is-read' : '';

        return `
        <div class="notif-item ${readClass}" data-id="${n.id}" ${n.link ? `data-link="${n.link}"` : ''}>
          <div class="notif-item-icon" style="color:${color}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20" aria-hidden="true">${icon}</svg>
          </div>
          <div class="notif-item-content">
            <p class="notif-item-title">${esc(n.title)}</p>
            <p class="notif-item-body">${esc(n.body)}</p>
            <p class="notif-item-time">${timeStr}</p>
          </div>
          ${!n.read ? '<span class="notif-item-dot"></span>' : ''}
        </div>`;
      }).join('');
    }

    /* Wire handlers */
    document.querySelectorAll('.notif-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        markRead(id);
        updateBellBadge();
        renderNotifPanel();
        const link = item.dataset.link;
        if (link) window.location.href = link;
      });
    });

    const markAllBtn = document.getElementById('notifMarkAll');
    if (markAllBtn) {
      markAllBtn.onclick = () => {
        markAllRead();
        updateBellBadge();
        renderNotifPanel();
      };
    }
  }

  /* Toggle panel */
  function toggleNotifPanel() {
    const panel = document.getElementById('notifPanel');
    if (!panel) {
      renderNotifPanel();
      const p = document.getElementById('notifPanel');
      if (p) p.hidden = false;
    } else {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) renderNotifPanel();
    }
  }

  /* Close panel when clicking outside */
  document.addEventListener('click', e => {
    const panel = document.getElementById('notifPanel');
    const bellBtn = document.querySelector('.act-btn[aria-label="Notifikasi"]');
    if (panel && !panel.hidden && bellBtn) {
      if (!panel.contains(e.target) && !bellBtn.contains(e.target)) {
        panel.hidden = true;
      }
    }
  });

  /* Wire bell button */
  function wireBellButton() {
    const bellBtn = document.querySelector('.act-btn[aria-label="Notifikasi"]');
    if (!bellBtn) return;
    bellBtn.addEventListener('click', e => {
      e.stopPropagation();
      toggleNotifPanel();
    });
  }

  /* Format time ago */
  function fmtTime(isoStr) {
    const d = new Date(isoStr);
    const now = Date.now();
    const diff = now - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Baru saja';
    if (mins < 60) return mins + ' menit lalu';
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + ' jam lalu';
    const days = Math.floor(hours / 24);
    if (days < 7) return days + ' hari lalu';
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  }

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── Badge pending transaksi di icon Riwayat (bottom nav) ── */
  /* Didefinisikan sebelum auto-init agar bisa dipanggil di DOMContentLoaded */
  function updateRiwayatBadge() {
    const navBtn = document.getElementById('navRiwayat');
    if (!navBtn) return;

    /* Hitung booking yang belum selesai bayar */
    let bookings = [];
    let pending = null;
    try { bookings = JSON.parse(localStorage.getItem('anabulku_bookings')) || []; } catch (_) {}
    try { pending  = JSON.parse(localStorage.getItem('anabulku_pending_payment')) || null; } catch (_) {}

    const pendingId = pending?.id || null;

    const count = bookings.filter(b => {
      const s     = (b.status || '').toLowerCase();
      const bayar = b.statusPembayaran || '';
      const sudahBayar  = bayar === 'lunas' || bayar === 'bayar_ditempat';
      const dibatalkan  = s === 'dibatalkan' || bayar === 'dibatalkan';
      const isPending   = pendingId && b.id === pendingId;
      return !sudahBayar && !dibatalkan && (isPending || s === 'menunggu' || s === 'dikonfirmasi');
    }).length +
    /* pending payment yang belum masuk bookings */
    (pendingId && !bookings.find(b => b.id === pendingId) ? 1 : 0);

    /* Pastikan button punya position:relative */
    navBtn.style.position = 'relative';

    /* Cari atau buat badge element */
    let badge = navBtn.querySelector('.riwayat-pending-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'riwayat-pending-badge';
      badge.setAttribute('aria-hidden', 'true');
      badge.style.cssText =
        'position:absolute;top:4px;right:8px;min-width:16px;height:16px;padding:0 4px;' +
        'border-radius:99px;background:#EF4444;color:#fff;font-size:9px;font-weight:700;' +
        'display:none;align-items:center;justify-content:center;line-height:1;pointer-events:none;';
      navBtn.appendChild(badge);
    }

    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }

  /* Auto-init on DOMContentLoaded */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      updateBellBadge();
      wireBellButton();
      updateRiwayatBadge();
    });
  } else {
    updateBellBadge();
    wireBellButton();
    updateRiwayatBadge();
  }

  /* Expose update function untuk dipanggil manual jika perlu */
  window.AnabulkuNotif.updateUI = function () {
    updateBellBadge();
    updateRiwayatBadge();
    if (document.getElementById('notifPanel') && !document.getElementById('notifPanel').hidden) {
      renderNotifPanel();
    }
  };

  /* Expose badge updater secara global agar halaman lain bisa trigger */
  window.AnabulkuNotif.updateRiwayatBadge = updateRiwayatBadge;

})();
