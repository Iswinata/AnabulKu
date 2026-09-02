// ===== Vetiloka — booking logic =====
const SERVICES = [
  { id: "vaksin",   ico: "💉", name: "Vaksinasi",     desc: "Vaksin lengkap & booster.",        price: 250000 },
  { id: "checkup",  ico: "🩺", name: "Pemeriksaan",    desc: "Konsultasi & cek kesehatan umum.", price: 150000 },
  { id: "grooming", ico: "🛁", name: "Grooming",       desc: "Mandi, potong bulu & kuku.",       price: 180000 },
  { id: "dental",   ico: "🦷", name: "Perawatan Gigi", desc: "Pembersihan karang gigi.",         price: 320000 },
  { id: "operasi",  ico: "🏥", name: "Operasi",        desc: "Steril & bedah minor.",            price: 900000 },
  { id: "darurat",  ico: "🚑", name: "Gawat Darurat",  desc: "Penanganan cepat 24 jam.",         price: 500000 },
  { id: "lab",      ico: "🔬", name: "Cek Lab",        desc: "Darah, urin & rontgen.",           price: 275000 },
  { id: "kontrol",  ico: "📋", name: "Kontrol Ulang",  desc: "Kontrol pasca perawatan.",         price: 100000 },
];

const KEY = "vetiloka.bookings";
const rupiah = (n) => "Rp " + n.toLocaleString("id-ID");
const $ = (s) => document.querySelector(s);

const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
const save = (data) => localStorage.setItem(KEY, JSON.stringify(data));

const form = $("#bookingForm");
const serviceSelect = $("#serviceSelect");

// Render service cards + select options
function renderServices() {
  const wrap = $("#services");
  wrap.innerHTML = SERVICES.map((s) => `
    <div class="service-card" data-id="${s.id}" role="button" tabindex="0">
      <div class="ico">${s.ico}</div>
      <h3>${s.name}</h3>
      <p>${s.desc}</p>
      <span class="price">${rupiah(s.price)}</span>
    </div>`).join("");

  serviceSelect.innerHTML = `<option value="">Pilih…</option>` +
    SERVICES.map((s) => `<option value="${s.id}">${s.name} — ${rupiah(s.price)}</option>`).join("");

  wrap.querySelectorAll(".service-card").forEach((card) => {
    const pick = () => { serviceSelect.value = card.dataset.id; syncServiceUI(); document.getElementById("pesan").scrollIntoView({ behavior: "smooth" }); };
    card.addEventListener("click", pick);
    card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
  });
}

function syncServiceUI() {
  const s = SERVICES.find((x) => x.id === serviceSelect.value);
  document.querySelectorAll(".service-card").forEach((c) =>
    c.classList.toggle("active", c.dataset.id === serviceSelect.value));
  $("#sumService").textContent = s ? s.name : "—";
  $("#sumPrice").textContent = s ? rupiah(s.price) : "Rp 0";
}
serviceSelect.addEventListener("change", syncServiceUI);

// Toast
let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}
