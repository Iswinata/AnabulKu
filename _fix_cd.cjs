const fs = require('fs');
const p = 'e:/New Project/';

/* ── 1. Fix clinic-detail.html: hapus duplikasi DOCTYPE di baris 45-87 ── */
let html = fs.readFileSync(p+'clinic-detail.html','utf8');
const lines = html.split('\n');
// Baris 44 (index 43) = kosong setelah </div> back-row, baris 45-87 = duplikasi
// Hapus dari baris index 44 s/d 87 (inklusif) = lines[44..87]
const fixed = [...lines.slice(0,44), ...lines.slice(88)].join('\n');
fs.writeFileSync(p+'clinic-detail.html', fixed, 'utf8');
console.log('clinic-detail.html fixed, lines:', fixed.split('\n').length);

/* ── 2. Update guest modal di clinic-detail.js ke dark glassmorphism ── */
let js = fs.readFileSync(p+'clinic-detail.js','utf8');
js = js.replace(
  `backdrop.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center;z-index:9999;"`,
  `backdrop.style.cssText = "position:fixed;inset:0;background:rgba(10,8,30,0.80);backdrop-filter:blur(6px);display:flex;align-items:flex-end;justify-content:center;z-index:9999;"`
);
js = js.replace(
  `sheet.style.cssText = "background:#fff;width:100%;max-width:393px;border-radius:20px 20px 0 0;padding:28px 24px 32px;display:flex;flex-direction:column;align-items:center;gap:10px;box-shadow:0 -4px 24px rgba(0,0,0,.12);animation:modalSlideUp .25s ease both;"`,
  `sheet.style.cssText = "background:linear-gradient(160deg,#1e1942 0%,#0f0c29 100%);border:1px solid rgba(255,255,255,0.12);width:100%;max-width:393px;border-radius:24px 24px 0 0;padding:28px 24px 32px;display:flex;flex-direction:column;align-items:center;gap:10px;box-shadow:0 -8px 48px rgba(0,0,0,0.55);animation:modalSlideUp .25s ease both;"`
);
js = js.replace(
  `'<div style="font-size:44px;line-height:1;margin-bottom:4px;">🔒</div>' +\n      '<div style="font-size:17px;font-weight:700;color:#1F2937;text-align:center;">Login Diperlukan</div>' +\n      '<p style="font-size:13px;color:#6B7280;text-align:center;line-height:1.55;margin-bottom:6px;">Pilih layanan hanya tersedia untuk member AnabulKu. Login atau daftar gratis sekarang!</p>' +\n      '<button id="cdGuestLogin" style="width:100%;padding:13px;border-radius:12px;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;border:2px solid #000;background:linear-gradient(180deg,#FF9800,#FFD21F);color:#fff;box-shadow:2px 2px 0 #000;">Masuk</button>' +\n      '<button id="cdGuestRegister" style="width:100%;padding:13px;border-radius:12px;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;border:2px solid #000;background:#fff;color:#1F2937;box-shadow:2px 2px 0 #000;margin-top:2px;">Daftar Gratis</button>'`,
  `'<div style="width:56px;height:56px;border-radius:9999px;background:rgba(255,152,0,0.15);border:2px solid rgba(255,152,0,0.40);display:grid;place-items:center;font-size:26px;margin-bottom:4px;">🔒</div>' +\n      '<div style="font-size:17px;font-weight:700;color:#fff;text-align:center;">Login Diperlukan</div>' +\n      '<p style="font-size:13px;color:rgba(255,255,255,0.55);text-align:center;line-height:1.55;margin-bottom:6px;">Pilih layanan hanya tersedia untuk member AnabulKu. Login atau daftar gratis sekarang!</p>' +\n      '<button id="cdGuestLogin" style="width:100%;padding:13px;border-radius:14px;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;border:none;background:linear-gradient(135deg,#FF9800,#FFB74D);color:#fff;box-shadow:0 6px 24px rgba(255,152,0,0.40);">Masuk</button>' +\n      '<button id="cdGuestRegister" style="width:100%;padding:13px;border-radius:14px;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;border:1px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.85);margin-top:2px;">Daftar Gratis</button>'`
);
fs.writeFileSync(p+'clinic-detail.js', js, 'utf8');
console.log('clinic-detail.js guest modal updated');
