// ===== Vetiloka Mobile — gaya Anabulku =====
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const rupiah = (n) => "Rp " + n.toLocaleString("id-ID");

// ---------- DATA ----------
const CATEGORIES = [
  { id: "vet", ic: "🩺", name: "Vet" },
  { id: "grooming", ic: "🛁", name: "Grooming" },
  { id: "vaksin", ic: "💉", name: "Vaksin" },
  { id: "shop", ic: "🛒", name: "Pet Shop" },
  { id: "hotel", ic: "🏨", name: "Pet Hotel" },
  { id: "jemput", ic: "🚗", name: "Jemput" },
  { id: "lab", ic: "🔬", name: "Cek Lab" },
  { id: "artikel", ic: "📰", name: "Artikel" },
];

const SERVICES = [
  { id: "vaksin", cat: "vaksin", ico: "💉", name: "Vaksinasi Lengkap", desc: "Vaksin & booster untuk anabul.", price: 250000, rate: 4.9, dur: "30 mnt" },
  { id: "checkup", cat: "vet", ico: "🩺", name: "Pemeriksaan Umum", desc: "Konsultasi & cek kesehatan.", price: 150000, rate: 4.8, dur: "20 mnt" },
  { id: "grooming", cat: "grooming", ico: "🛁", name: "Grooming Premium", desc: "Mandi, potong bulu & kuku.", price: 180000, rate: 4.9, dur: "45 mnt" },
  { id: "dental", cat: "vet", ico: "🦷", name: "Perawatan Gigi", desc: "Pembersihan karang gigi.", price: 320000, rate: 4.7, dur: "40 mnt" },
  { id: "operasi", cat: "vet", ico: "🏥", name: "Operasi & Steril", desc: "Bedah minor & sterilisasi.", price: 900000, rate: 4.9, dur: "2 jam" },
  { id: "darurat", cat: "vet", ico: "🚑", name: "Gawat Darurat 24 Jam", desc: "Penanganan cepat kapan saja.", price: 500000, rate: 5.0, dur: "-" },
  { id: "lab", cat: "lab", ico: "🔬", name: "Cek Lab Lengkap", desc: "Darah, urin & rontgen.", price: 275000, rate: 4.8, dur: "60 mnt" },
  { id: "hotel", cat: "hotel", ico: "🏨", name: "Pet Hotel Harian", desc: "Penitipan nyaman & aman.", price: 100000, rate: 4.6, dur: "/hari" },
];

const ARTICLES = [
  { ic: "🐶", title: "5 Tanda Anjingmu Sehat", desc: "Kenali ciri anabul yang bugar." },
  { ic: "🐱", title: "Cara Merawat Bulu Kucing", desc: "Tips grooming rutin di rumah." },
  { ic: "🥩", title: "Nutrisi Tepat untuk Anabul", desc: "Panduan makanan bergizi." },
];

const TIME_SLOTS = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

// ---------- STATE ----------
const DB = {
  userKey: "vetiloka.user",
  petKey: "vetiloka.pets",
  orderKey: "vetiloka.orders",
  seenKey: "vetiloka.onboarded",
  load(k, def) { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } },
  save(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
};

let state = {
  user: DB.load(DB.userKey, null),
  pets: DB.load(DB.petKey, []),
  orders: DB.load(DB.orderKey, []),
  onboarded: DB.load(DB.seenKey, false),
  onbIndex: 0,
  serviceFilter: "all",
  orderFilter: "all",
  booking: null,
};

// ---------- HELPERS ----------
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove("show"), 2400);
}
function showScreen(name) {
  $$(".screen").forEach((s) => s.classList.toggle("active", s.dataset.screen === name));
}
function svcById(id) { return SERVICES.find((s) => s.id === id); }

// ---------- BOOT FLOW ----------
function boot() {
  setTimeout(() => {
    if (!state.onboarded) { showScreen("onboarding"); renderOnb(); }
    else if (!state.user) { showScreen("auth"); }
    else { enterApp(); }
  }, 1600);
}
function enterApp() {
  showScreen("main");
  navTo("home");
}

// ---------- ONBOARDING ----------
function renderOnb() {
  const dots = $("#onbDots");
  dots.innerHTML = "";
  [0, 1, 2].forEach((i) => {
    const d = document.createElement("i");
    if (i === state.onbIndex) d.classList.add("on");
    dots.appendChild(d);
  });
  $("#onbSlides").style.transform = `translateX(-${state.onbIndex * 100}%)`;
  $$("#onbSlides .onb-slide").forEach((s) => (s.style.transform = `translateX(${state.onbIndex * 100}%)`));
  $("#onbNext").textContent = state.onbIndex === 2 ? "Mulai" : "Lanjut";
}
function finishOnb() {
  state.onboarded = true; DB.save(DB.seenKey, true);
  state.user ? enterApp() : showScreen("auth");
}

// ---------- NAV ----------
function navTo(view) {
  $$("#bottomNav button").forEach((b) => b.classList.toggle("active", b.dataset.nav === view));
  $$(".view").forEach((v) => v.classList.toggle("active", v.dataset.view === view));
  if (view === "home") renderHome();
  if (view === "services") renderServices();
  if (view === "orders") renderOrders();
  if (view === "profile") renderProfile();
}

// ---------- RENDER: HOME ----------
function renderHome() {
  const popular = SERVICES.slice(0, 4);
  const cats = CATEGORIES.map((c) => `
    <div class="cat" data-cat="${c.id}"><div class="ic">${c.ic}</div><span>${c.name}</span></div>`).join("");
  const svcCards = popular.map((s) => `
    <div class="svc-card" data-svc="${s.id}">
      <div class="thumb">${s.ico}</div>
      <div class="body">
        <h4>${s.name}</h4>
        <div class="meta"><span class="price">${rupiah(s.price)}</span><span class="rate">★ ${s.rate}</span></div>
      </div>
    </div>`).join("");
  const arts = ARTICLES.map((a) => `
    <div class="article"><div class="thumb">${a.ic}</div><div><h4>${a.title}</h4><p>${a.desc}</p></div></div>`).join("");

  $("#homeScroll").innerHTML = `
    <div class="banner">
      <div><h3>Diskon 20% Grooming!</h3><p>Untuk booking pertama minggu ini.</p></div>
      <div class="art">🐾</div>
    </div>
    <div class="section-title"><h3>Kategori</h3></div>
    <div class="cat-grid">${cats}</div>
    <div class="section-title"><h3>Layanan Populer</h3><a data-goto="services">Lihat semua</a></div>
    <div class="svc-row">${svcCards}</div>
    <div class="section-title"><h3>Artikel & Tips</h3></div>
    ${arts}`;

  if (state.user) $("#homeCity").textContent = "Halo, " + state.user.name.split(" ")[0];
}

// ---------- RENDER: SERVICES ----------
function renderServices() {
  const filters = [{ id: "all", ic: "✨", name: "Semua" }, ...CATEGORIES.filter((c) => c.id !== "artikel")];
  $("#serviceChips").innerHTML = filters.map((c) =>
    `<button data-filter="${c.id}" class="${state.serviceFilter === c.id ? "on" : ""}">${c.ic} ${c.name}</button>`).join("");
  const list = SERVICES.filter((s) => state.serviceFilter === "all" || s.cat === state.serviceFilter);
  $("#servicesScroll").innerHTML = `<div class="svc-list">` + (list.length ? list.map((s) => `
    <div class="svc-item" data-svc="${s.id}">
      <div class="ic">${s.ico}</div>
      <div class="info"><h4>${s.name}</h4><p>${s.desc} · ⭐ ${s.rate}</p><span class="price">${rupiah(s.price)}</span></div>
    </div>`).join("") : `<div class="empty"><div class="em">🔍</div><p>Belum ada layanan di kategori ini.</p></div>`) + `</div>`;
}

// ---------- RENDER: ORDERS ----------
function renderOrders() {
  const tabs = [{ id: "all", n: "Semua" }, { id: "wait", n: "Berlangsung" }, { id: "done", n: "Selesai" }, { id: "cancel", n: "Dibatalkan" }];
  $("#orderTabs").innerHTML = tabs.map((t) =>
    `<button data-otab="${t.id}" class="${state.orderFilter === t.id ? "on" : ""}">${t.n}</button>`).join("");
  const list = state.orders.filter((o) => state.orderFilter === "all" || o.status === state.orderFilter);
  if (!list.length) {
    $("#ordersScroll").innerHTML = `<div class="empty"><div class="em">🧾</div><p>Belum ada pesanan.<br>Yuk booking layanan pertamamu!</p></div>`;
    return;
  }
  const label = { wait: "Berlangsung", done: "Selesai", cancel: "Dibatalkan" };
  $("#ordersScroll").innerHTML = list.map((o) => `
    <div class="order-card">
      <div class="top"><span class="oid">#${o.id}</span><span class="badge ${o.status}">${label[o.status]}</span></div>
      <div class="line">
        <div class="ic">${o.ico}</div>
        <div><h4>${o.name}</h4><p>🐾 ${o.pet} · 📅 ${o.date} ${o.time}</p></div>
      </div>
      <div class="foot">
        <span class="total">${rupiah(o.price)}</span>
        ${o.status === "wait" ? `<button class="btn-outline" data-cancel="${o.id}">Batalkan</button>` : ""}
      </div>
    </div>`).join("");
}

// ---------- RENDER: PROFILE ----------
function renderProfile() {
  const u = state.user || { name: "Tamu", phone: "-" };
  const petCards = state.pets.map((p, i) => `
    <div class="pet-card"><div class="pic">${p.ico}</div><h4>${p.name}</h4><p>${p.type} · ${p.age}</p></div>`).join("");
  $("#profileScroll").innerHTML = `
    <div class="prof-card">
      <div class="prof-avatar">👤</div>
      <div><h3>${u.name}</h3><p>${u.phone}</p></div>
    </div>
    <div class="section-title"><h3>Anabul Saya</h3></div>
    <div class="pet-row">
      ${petCards}
      <div class="pet-add" id="btnAddPet"><div class="plus">＋</div>Tambah</div>
    </div>
    <div class="menu-list">
      <div class="menu-item"><span class="mi">🧾</span><span class="lbl">Riwayat Pesanan</span><span class="arr">›</span></div>
      <div class="menu-item"><span class="mi">📍</span><span class="lbl">Alamat Tersimpan</span><span class="arr">›</span></div>
      <div class="menu-item"><span class="mi">💳</span><span class="lbl">Metode Pembayaran</span><span class="arr">›</span></div>
      <div class="menu-item"><span class="mi">⚙️</span><span class="lbl">Pengaturan</span><span class="arr">›</span></div>
      <div class="menu-item"><span class="mi">❓</span><span class="lbl">Bantuan</span><span class="arr">›</span></div>
      <div class="menu-item danger" id="btnLogout"><span class="mi">🚪</span><span class="lbl">Keluar</span><span class="arr">›</span></div>
    </div>`;
}

// ---------- SHEET SYSTEM ----------
function openSheet(html, full = false) {
  const host = $("#sheetHost");
  host.innerHTML = `<div class="sheet-backdrop" data-close></div>
    <div class="sheet ${full ? "full" : ""}">${full ? "" : '<div class="sheet-grab"></div>'}${html}</div>`;
  host.classList.add("show");
}
function closeSheet() { $("#sheetHost").classList.remove("show"); $("#sheetHost").innerHTML = ""; }

// ---------- DETAIL LAYANAN ----------
function openServiceDetail(id) {
  const s = svcById(id);
  openSheet(`
    <div class="sheet-head"><button class="back" data-close>←</button><h3>Detail Layanan</h3></div>
    <div class="detail-hero">${s.ico}</div>
    <div class="detail-title"><h2>${s.name}</h2><span class="detail-price">${rupiah(s.price)}</span></div>
    <p class="detail-desc">${s.desc} Ditangani dokter hewan berpengalaman dengan fasilitas modern.</p>
    <ul class="detail-list">
      <li>⭐ Rating ${s.rate} / 5.0</li>
      <li>⏱️ Estimasi ${s.dur}</li>
      <li>🏥 Klinik Vetiloka terverifikasi</li>
      <li>🛡️ Garansi layanan & konsultasi lanjutan</li>
    </ul>
    <div class="sticky-cta"><button class="btn-primary block" data-book="${s.id}">Booking Sekarang</button></div>
  `, true);
}

// ---------- BOOKING FLOW ----------
function startBooking(id) {
  const s = svcById(id);
  state.booking = { service: s, petIdx: state.pets.length ? 0 : null, date: "", time: "", note: "" };
  renderBookingStep1();
}
function renderBookingStep1() {
  const b = state.booking, s = b.service;
  const petPicks = state.pets.length
    ? state.pets.map((p, i) => `<div class="pet-pick ${b.petIdx === i ? "on" : ""}" data-petpick="${i}">${p.ico} ${p.name}</div>`).join("")
    : `<p style="color:var(--muted);font-size:13px">Belum ada anabul. <a style="color:var(--teal);font-weight:700" data-addpet-inline>Tambah dulu →</a></p>`;
  const today = new Date().toISOString().split("T")[0];
  openSheet(`
    <div class="sheet-head"><button class="back" data-close>←</button><h3>Booking ${s.name}</h3></div>
    <div class="form-group"><label>Pilih Anabul</label><div class="pet-choose">${petPicks}</div></div>
    <div class="form-group"><label>Tanggal</label><input type="date" id="bkDate" min="${today}" value="${b.date}"></div>
    <div class="form-group"><label>Jam</label><div class="slot-grid" id="bkSlots">
      ${TIME_SLOTS.map((t) => `<div class="slot ${b.time === t ? "on" : ""}" data-slot="${t}">${t}</div>`).join("")}
    </div></div>
    <div class="form-group"><label>Catatan (opsional)</label><textarea id="bkNote" rows="2" placeholder="Keluhan / permintaan khusus">${b.note}</textarea></div>
    <div class="sticky-cta"><button class="btn-primary block" id="bkContinue">Lanjut ke Ringkasan</button></div>
  `, true);
}
function renderBookingSummary() {
  const b = state.booking, s = b.service, pet = state.pets[b.petIdx];
  const svcFee = 5000;
  const total = s.price + svcFee;
  openSheet(`
    <div class="sheet-head"><button class="back" id="bkBack">←</button><h3>Ringkasan Pesanan</h3></div>
    <div class="line" style="display:flex;gap:12px;align-items:center;margin-bottom:6px">
      <div class="ic" style="width:56px;height:56px;border-radius:14px;background:var(--mint);display:flex;align-items:center;justify-content:center;font-size:28px">${s.ico}</div>
      <div><h4>${s.name}</h4><p style="color:var(--muted);font-size:13px">${s.dur}</p></div>
    </div>
    <div class="summary-row"><span class="k">Anabul</span><span>${pet.ico} ${pet.name}</span></div>
    <div class="summary-row"><span class="k">Jadwal</span><span>${b.date} · ${b.time}</span></div>
    ${b.note ? `<div class="summary-row"><span class="k">Catatan</span><span>${b.note}</span></div>` : ""}
    <div class="summary-row"><span class="k">Biaya layanan</span><span>${rupiah(s.price)}</span></div>
    <div class="summary-row"><span class="k">Biaya admin</span><span>${rupiah(svcFee)}</span></div>
    <div class="summary-row total"><span>Total</span><span>${rupiah(total)}</span></div>
    <div class="form-group"><label>Metode Pembayaran</label>
      <select id="bkPay"><option>💳 Vetiloka Pay</option><option>🏦 Transfer Bank</option><option>💵 Bayar di Klinik</option></select></div>
    <div class="sticky-cta"><button class="btn-primary block" id="bkConfirm">Konfirmasi & Bayar ${rupiah(total)}</button></div>
  `, true);
}
function confirmBooking() {
  const b = state.booking, s = b.service, pet = state.pets[b.petIdx];
  const order = {
    id: Math.random().toString(36).slice(2, 8).toUpperCase(),
    svcId: s.id, name: s.name, ico: s.ico, pet: pet.name,
    date: b.date, time: b.time, price: s.price + 5000, status: "wait",
    createdAt: Date.now(),
  };
  state.orders.unshift(order);
  DB.save(DB.orderKey, state.orders);
  state.booking = null;
  openSheet(`
    <div class="success-box">
      <div class="big">🎉</div>
      <h2>Booking Berhasil!</h2>
      <p>Pesanan <b>#${order.id}</b> sedang diproses.<br>Kami akan mengabari kamu segera.</p>
      <button class="btn-primary block" id="bkDone" style="margin-top:24px">Lihat Pesanan</button>
    </div>`, true);
}

// ---------- ADD PET ----------
const PET_ICONS = ["🐶", "🐱", "🐰", "🐦", "🐹", "🐢"];
function openAddPet(returnToBooking = false) {
  openSheet(`
    <div class="sheet-head"><button class="back" data-close>←</button><h3>Tambah Anabul</h3></div>
    <div class="form-group"><label>Jenis Hewan</label>
      <div class="pet-choose" id="petIcons">${PET_ICONS.map((i, x) => `<div class="pet-pick ${x === 0 ? "on" : ""}" data-picon="${i}">${i}</div>`).join("")}</div></div>
    <div class="form-group"><label>Nama</label><input type="text" id="petName" placeholder="Nama anabul"></div>
    <div class="form-group"><label>Jenis / Ras</label><input type="text" id="petType" placeholder="Contoh: Kucing Persia"></div>
    <div class="form-group"><label>Umur</label><input type="text" id="petAge" placeholder="Contoh: 2 tahun"></div>
    <div class="sticky-cta"><button class="btn-primary block" data-savepet="${returnToBooking ? 1 : 0}">Simpan</button></div>
  `, true);
  $("#sheetHost")._picon = PET_ICONS[0];
}
function savePet(returnToBooking) {
  const name = $("#petName").value.trim();
  if (!name) return toast("Isi nama anabul dulu");
  const pet = {
    ico: $("#sheetHost")._picon || "🐾",
    name,
    type: $("#petType").value.trim() || "Hewan",
    age: $("#petAge").value.trim() || "-",
  };
  state.pets.push(pet);
  DB.save(DB.petKey, state.pets);
  toast("Anabul ditambahkan 🐾");
  if (returnToBooking && state.booking) { state.booking.petIdx = state.pets.length - 1; renderBookingStep1(); }
  else { closeSheet(); renderProfile(); }
}

// ---------- EVENTS ----------
function bindEvents() {
  // onboarding
  $("#onbNext").addEventListener("click", () => {
    if (state.onbIndex < 2) { state.onbIndex++; renderOnb(); } else finishOnb();
  });
  $("#onbSkip").addEventListener("click", finishOnb);

  // auth
  $("#authForm").addEventListener("submit", (e) => {
    e.preventDefault();
    state.user = { name: $("#authName").value.trim(), phone: $("#authPhone").value.trim() };
    DB.save(DB.userKey, state.user);
    toast("Selamat datang, " + state.user.name.split(" ")[0] + "!");
    enterApp();
  });

  // bottom nav
  $("#bottomNav").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-nav]");
    if (b) navTo(b.dataset.nav);
  });
  $("#btnNotif").addEventListener("click", () => toast("Tidak ada notifikasi baru 🔔"));

  // global delegated clicks
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (t.closest("[data-close]")) return closeSheet();
    const goto = t.closest("[data-goto]"); if (goto) return navTo(goto.dataset.goto);
    const cat = t.closest("[data-cat]"); if (cat) { if (cat.dataset.cat === "artikel") return toast("Halaman artikel segera hadir 📰"); state.serviceFilter = cat.dataset.cat === "shop" ? "all" : cat.dataset.cat; navTo("services"); return; }
    const svc = t.closest("[data-svc]"); if (svc) return openServiceDetail(svc.dataset.svc);
    const filt = t.closest("[data-filter]"); if (filt) { state.serviceFilter = filt.dataset.filter; return renderServices(); }
    const otab = t.closest("[data-otab]"); if (otab) { state.orderFilter = otab.dataset.otab; return renderOrders(); }
    const book = t.closest("[data-book]"); if (book) return startBooking(book.dataset.book);
    const pp = t.closest("[data-petpick]"); if (pp) { state.booking.petIdx = +pp.dataset.petpick; return renderBookingStep1(); }
    if (t.closest("[data-addpet-inline]")) return openAddPet(true);
    if (t.closest("#btnAddPet")) return openAddPet(false);
    const savePetBtn = t.closest("[data-savepet]"); if (savePetBtn) return savePet(+savePetBtn.dataset.savepet);
    const picon = t.closest("[data-picon]"); if (picon) { $$("#petIcons .pet-pick").forEach((x) => x.classList.remove("on")); picon.classList.add("on"); $("#sheetHost")._picon = picon.dataset.picon; return; }
    const slot = t.closest("[data-slot]"); if (slot) { $$("#bkSlots .slot").forEach((x) => x.classList.remove("on")); slot.classList.add("on"); state.booking.time = slot.dataset.slot; return; }
    if (t.closest("#bkContinue")) {
      const d = $("#bkDate").value; state.booking.date = d; state.booking.note = $("#bkNote").value.trim();
      if (state.booking.petIdx == null) return toast("Pilih atau tambah anabul dulu");
      if (!d) return toast("Pilih tanggal booking");
      if (!state.booking.time) return toast("Pilih jam booking");
      return renderBookingSummary();
    }
    if (t.closest("#bkBack")) return renderBookingStep1();
    if (t.closest("#bkConfirm")) return confirmBooking();
    if (t.closest("#bkDone")) { closeSheet(); state.orderFilter = "all"; navTo("orders"); return; }
    const cancel = t.closest("[data-cancel]"); if (cancel) {
      const o = state.orders.find((x) => x.id === cancel.dataset.cancel);
      if (o) { o.status = "cancel"; DB.save(DB.orderKey, state.orders); toast("Pesanan dibatalkan"); renderOrders(); }
      return;
    }
    if (t.closest("#btnLogout")) {
      localStorage.removeItem(DB.userKey);
      state.user = null; toast("Kamu telah keluar");
      showScreen("auth"); return;
    }
  });
}

// ---------- INIT ----------
bindEvents();
boot();

// PWA service worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}
