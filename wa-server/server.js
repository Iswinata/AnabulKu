/* ================================================================
   AnabulKu — WhatsApp OTP Server
   Express + whatsapp-web.js
   Endpoints:
     GET  /admin          → back office scan QR
     GET  /api/status     → status koneksi WA
     POST /api/send-otp   → kirim OTP
     POST /api/verify-otp → verifikasi OTP
================================================================ */

import express       from 'express';
import cors          from 'cors';
import qrcode        from 'qrcode';
import { Client, LocalAuth } from 'whatsapp-web.js';
import { execSync }  from 'child_process';

/* Auto-detect Chromium path (Railway Nixpacks / Linux / Windows) */
function findChromium() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  const candidates = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/nix/var/nix/profiles/default/bin/chromium',
  ];
  for (const p of candidates) {
    try { execSync(`test -f ${p}`); return p; } catch (_) {}
  }
  try { return execSync('which chromium || which chromium-browser || which google-chrome', { encoding: 'utf8' }).trim(); } catch (_) {}
  return null; // fallback: biarkan puppeteer cari sendiri
}

const app  = express();
const PORT = process.env.PORT || 3001;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'anabulku-admin';

/* ── CORS ── */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',');
app.use(cors({
  origin: (origin, cb) => {
    if (ALLOWED_ORIGINS.includes('*') || !origin || ALLOWED_ORIGINS.includes(origin))
      cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
}));
app.use(express.json());

/* ================================================================
   OTP Store — in-memory, TTL 5 menit
================================================================ */
const otpStore = new Map();

function toE164(phone) {
  const cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.startsWith('62')) return cleaned;
  if (cleaned.startsWith('0'))  return '62' + cleaned.slice(1);
  return '62' + cleaned;
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function purgeExpired() {
  const now = Date.now();
  for (const [k, v] of otpStore.entries()) {
    if (v.expiresAt < now) otpStore.delete(k);
  }
}

/* ================================================================
   WhatsApp Client
================================================================ */
let waStatus  = 'disconnected';
let qrDataUrl = null;

const waClient = new Client({
  authStrategy: new LocalAuth({ dataPath: './.wa-session' }),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    ...(process.env.PUPPETEER_EXECUTABLE_PATH
      ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH }
      : {}),
  },
});

waClient.on('qr', async (qr) => {
  waStatus = 'qr_ready';
  try { qrDataUrl = await qrcode.toDataURL(qr); } catch (e) { console.error('[WA] QR error:', e); }
  console.log('[WA] QR siap — buka /admin untuk scan');
});

waClient.on('authenticated', () => {
  waStatus = 'connecting'; qrDataUrl = null;
  console.log('[WA] Authenticated');
});

waClient.on('ready', () => {
  waStatus = 'ready';
  console.log('[WA] Siap mengirim pesan!');
});

waClient.on('disconnected', (reason) => {
  waStatus = 'disconnected'; qrDataUrl = null;
  console.log('[WA] Disconnected:', reason);
  setTimeout(() => waClient.initialize(), 5000);
});

/* ================================================================
   Back Office — halaman scan QR
================================================================ */
app.get('/admin', (req, res) => {
  if (req.query.token !== ADMIN_TOKEN) {
    return res.status(401).send(`<html><body style="font-family:sans-serif;padding:40px">
      <h2>⛔ Unauthorized</h2><p>Akses: <code>/admin?token=TOKEN_KAMU</code></p>
    </body></html>`);
  }
  const statusLabel = {
    disconnected: '🔴 Tidak Terhubung', qr_ready: '🟡 Scan QR untuk Login',
    connecting:   '🟠 Menghubungkan...', ready:    '🟢 Terhubung & Siap',
  }[waStatus] || waStatus;

  const qrSection = waStatus === 'qr_ready' && qrDataUrl
    ? `<div style="text-align:center;margin:24px 0">
        <p style="color:#666;margin-bottom:12px">Scan QR ini dengan WhatsApp kamu</p>
        <img src="${qrDataUrl}" style="width:260px;height:260px;border:4px solid #ff9800;border-radius:12px" alt="QR"/>
       </div>`
    : waStatus === 'ready'
    ? `<div style="text-align:center;margin:24px 0;padding:20px;background:#f0fdf4;border-radius:12px">
        <p style="font-size:48px">✅</p>
        <p style="color:#16a34a;font-weight:600">WhatsApp terhubung!</p>
        <p style="color:#666;font-size:14px">Server siap mengirim OTP</p>
       </div>`
    : `<div style="text-align:center;margin:24px 0;padding:20px;background:#fefce8;border-radius:12px">
        <p style="font-size:48px">⏳</p>
        <p style="color:#854d0e;font-weight:600">Inisialisasi WhatsApp...</p>
        <p style="color:#666;font-size:14px">Auto-refresh tiap 5 detik</p>
       </div>`;

  res.send(`<!DOCTYPE html>
<html lang="id"><head>
  <meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>AnabulKu — WA Back Office</title>
  ${waStatus !== 'ready' ? '<meta http-equiv="refresh" content="5"/>' : ''}
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',sans-serif;background:#f5f5f5;display:flex;justify-content:center;padding:40px 16px}
    .card{background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.1);padding:32px;width:100%;max-width:420px}
    .brand-name{font-size:22px;font-weight:700;color:#f57c00}
    .badge{display:inline-block;padding:6px 14px;border-radius:999px;background:#f3f4f6;font-size:14px;font-weight:500;margin-bottom:20px}
    .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:14px;color:#555}
    .row:last-child{border-bottom:none} .row b{color:#222}
    .btn{width:100%;margin-top:12px;padding:12px;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer}
    .btn-orange{background:#ff9800;color:#fff} .btn-red{background:#fee2e2;color:#dc2626;margin-top:6px}
  </style>
</head><body><div class="card">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px">
    <span style="font-size:32px">🐾</span>
    <div><div class="brand-name">AnabulKu</div><div style="font-size:12px;color:#888">WA OTP Back Office</div></div>
  </div>
  <div class="badge">${statusLabel}</div>
  ${qrSection}
  <div style="margin-top:16px">
    <div class="row"><span>Status</span><b>${waStatus}</b></div>
    <div class="row"><span>OTP aktif</span><b>${otpStore.size}</b></div>
    <div class="row"><span>Waktu server</span><b>${new Date().toLocaleString('id-ID')}</b></div>
  </div>
  <button class="btn btn-orange" onclick="location.reload()">🔄 Refresh</button>
  ${waStatus === 'ready'
    ? `<form method="POST" action="/admin/logout?token=${ADMIN_TOKEN}" style="margin-top:6px">
         <button class="btn btn-red" type="submit">🚪 Logout WhatsApp</button>
       </form>`
    : ''}
</div></body></html>`);
});

app.post('/admin/logout', async (req, res) => {
  if (req.query.token !== ADMIN_TOKEN) return res.status(401).send('Unauthorized');
  try { await waClient.logout(); } catch (_) {}
  waStatus = 'disconnected';
  res.redirect(`/admin?token=${ADMIN_TOKEN}`);
});

/* ================================================================
   API Endpoints
================================================================ */
app.get('/api/status', (_req, res) => {
  res.json({ status: waStatus, ready: waStatus === 'ready' });
});

app.post('/api/send-otp', async (req, res) => {
  const { phone } = req.body || {};
  if (!phone) return res.status(400).json({ status: false, reason: 'Nomor HP wajib diisi' });
  if (waStatus !== 'ready') return res.status(503).json({
    status: false, reason: 'WhatsApp belum terhubung. Hubungi admin untuk scan QR.',
  });

  purgeExpired();
  const target   = toE164(phone);
  const existing = otpStore.get(target);
  if (existing && existing.expiresAt - Date.now() > 4 * 60 * 1000) {
    return res.status(429).json({ status: false, reason: 'Tunggu 60 detik sebelum kirim ulang.' });
  }

  const code = generateOtp();
  otpStore.set(target, { code, expiresAt: Date.now() + 5 * 60 * 1000, attempts: 0 });

  const message =
    `🐾 *AnabulKu — Kode Verifikasi*\n\n` +
    `Kode OTP kamu: *${code}*\n\n` +
    `Berlaku selama *5 menit*. Jangan bagikan kode ini ke siapapun.\n\n` +
    `Jika kamu tidak mendaftar di AnabulKu, abaikan pesan ini.`;

  try {
    await waClient.sendMessage(target + '@c.us', message);
    console.log(`[OTP] Terkirim ke ${target}`);
    return res.json({ status: true, message: 'OTP berhasil dikirim' });
  } catch (err) {
    console.error('[OTP] Gagal kirim:', err.message);
    otpStore.delete(target);
    return res.status(500).json({ status: false, reason: 'Gagal mengirim pesan WhatsApp' });
  }
});

app.post('/api/verify-otp', (req, res) => {
  const { phone, code } = req.body || {};
  if (!phone || !code) return res.status(400).json({ status: false, reason: 'phone dan code wajib diisi' });

  const target = toE164(phone);
  const entry  = otpStore.get(target);

  if (!entry) return res.status(400).json({ status: false, reason: 'OTP tidak ditemukan atau kedaluwarsa. Kirim ulang.' });
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(target);
    return res.status(400).json({ status: false, reason: 'OTP kedaluwarsa. Silakan kirim ulang.' });
  }
  if (entry.attempts >= 5) {
    otpStore.delete(target);
    return res.status(400).json({ status: false, reason: 'Terlalu banyak percobaan. Kirim ulang OTP.' });
  }
  if (String(code).trim() !== entry.code) {
    entry.attempts += 1;
    return res.status(400).json({ status: false, reason: `Kode salah. Sisa percobaan: ${5 - entry.attempts}` });
  }

  otpStore.delete(target);
  return res.json({ status: true, message: 'Verifikasi berhasil' });
});

/* ================================================================
   Start Server
================================================================ */
app.listen(PORT, () => {
  console.log(`[AnabulKu WA Server] Jalan di port ${PORT}`);
  console.log(`[AnabulKu WA Server] Back office: http://localhost:${PORT}/admin?token=${ADMIN_TOKEN}`);
});



waClient.on('auth_failure', (msg) => {
  waStatus = 'disconnected';
  console.error('[WA] Auth failure:', msg);
});

waClient.initialize();
