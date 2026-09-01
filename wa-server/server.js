/* ================================================================
   AnabulKu — WhatsApp OTP Server
   Express + whatsapp-web.js (CommonJS)
================================================================ */

'use strict';

const express               = require('express');
const cors                  = require('cors');
const qrcode                = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const chromium              = require('@sparticuz/chromium');

const app         = express();
const PORT        = process.env.PORT || 3001;
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
let waClient  = null;

async function startWaClient() {
  const executablePath = await chromium.executablePath();
  console.log('[WA] Chromium path:', executablePath);

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './.wa-session' }),
    puppeteer: {
      executablePath,
      args: chromium.args.concat([
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--single-process',
        '--no-zygote',
      ]),
      headless: chromium.headless,
    },
  });

  client.on('qr', async (qr) => {
    waStatus = 'qr';
    try { qrDataUrl = await qrcode.toDataURL(qr); } catch (e) { console.error('[WA] QR error:', e.message); }
    console.log('[WA] QR siap, buka /admin untuk scan');
  });

  client.on('ready', () => {
    waStatus = 'connected'; qrDataUrl = null;
    console.log('[WA] Terhubung!');
  });

  client.on('disconnected', (reason) => {
    waStatus = 'disconnected';
    console.log('[WA] Terputus:', reason);
    setTimeout(startWaClient, 5000);
  });

  client.on('auth_failure', (msg) => {
    waStatus = 'disconnected';
    console.error('[WA] Auth failure:', msg);
  });

  await client.initialize();
  waClient = client;
}

/* ================================================================
   Admin Back Office
================================================================ */
app.get('/admin', (req, res) => {
  if (req.query.token !== ADMIN_TOKEN) {
    return res.status(401).send(`<!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>401 Unauthorized</title>
      <style>body{font-family:sans-serif;text-align:center;padding:40px;background:#f5f5f5;color:#333}</style>
    </head><body><h2>⛔ 401 Unauthorized</h2><p>Token tidak valid.</p></body></html>`);
  }

  let body = '';
  if (waStatus === 'connected') {
    body = `
      <div class="card">
        <div class="status-icon">🟢</div>
        <h2 class="status-title connected">WhatsApp Terhubung</h2>
        <p class="status-desc">Server OTP siap mengirim pesan.</p>
      </div>
      <script>setTimeout(()=>location.reload(), 10000)</script>`;
  } else if (waStatus === 'qr' && qrDataUrl) {
    body = `
      <div class="card">
        <div class="status-icon">📱</div>
        <h2 class="status-title">Scan QR Code</h2>
        <div class="qr-wrapper">
          <img src="${qrDataUrl}" alt="QR Code WhatsApp" class="qr-img"/>
        </div>
        <ol class="steps">
          <li>Buka <strong>WhatsApp</strong> di HP kamu</li>
          <li>Ketuk menu <strong>⋮</strong> → <strong>Perangkat Tertaut</strong></li>
          <li>Ketuk <strong>Tautkan Perangkat</strong></li>
          <li>Arahkan kamera ke QR di atas</li>
        </ol>
        <p class="refresh-note">⏳ Halaman otomatis refresh dalam <span id="countdown">5</span> detik...</p>
      </div>
      <script>
        var s = 5;
        var el = document.getElementById('countdown');
        var iv = setInterval(function(){
          s--; if(el) el.textContent = s;
          if(s <= 0){ clearInterval(iv); location.reload(); }
        }, 1000);
      </script>`;
  } else {
    body = `
      <div class="card">
        <div class="status-icon">⏳</div>
        <h2 class="status-title">Menunggu WhatsApp...</h2>
        <p class="status-desc">Sedang menginisialisasi koneksi. Harap tunggu.</p>
        <div class="spinner"></div>
        <p class="refresh-note">Halaman otomatis refresh dalam <span id="countdown">3</span> detik...</p>
      </div>
      <script>
        var s = 3;
        var el = document.getElementById('countdown');
        var iv = setInterval(function(){
          s--; if(el) el.textContent = s;
          if(s <= 0){ clearInterval(iv); location.reload(); }
        }, 1000);
      </script>`;
  }

  res.send(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AnabulKu — WA Admin</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f0f4f8;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 16px;
      color: #333;
    }

    .header {
      text-align: center;
      margin-bottom: 20px;
    }

    .header h1 {
      font-size: 1.4rem;
      font-weight: 700;
      color: #1a1a2e;
    }

    .header p {
      font-size: 0.85rem;
      color: #666;
      margin-top: 4px;
    }

    .card {
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.10);
      padding: 32px 24px;
      width: 100%;
      max-width: 400px;
      text-align: center;
    }

    .status-icon {
      font-size: 3rem;
      margin-bottom: 12px;
    }

    .status-title {
      font-size: 1.25rem;
      font-weight: 700;
      margin-bottom: 8px;
      color: #1a1a2e;
    }

    .status-title.connected {
      color: #16a34a;
    }

    .status-desc {
      font-size: 0.9rem;
      color: #555;
      line-height: 1.5;
    }

    .qr-wrapper {
      margin: 20px auto;
      width: 100%;
      max-width: 280px;
      aspect-ratio: 1 / 1;
      border: 3px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;
    }

    .qr-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }

    .steps {
      text-align: left;
      margin: 16px 0;
      padding-left: 20px;
      font-size: 0.88rem;
      color: #444;
      line-height: 2;
    }

    .steps li {
      margin-bottom: 2px;
    }

    .refresh-note {
      font-size: 0.8rem;
      color: #999;
      margin-top: 16px;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #e2e8f0;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 20px auto;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🐾 AnabulKu WA Admin</h1>
    <p>Panel manajemen WhatsApp OTP</p>
  </div>
  ${body}
</body>
</html>`);
});

/* ── Status ── */
app.get('/api/status', (req, res) => res.json({ status: waStatus }));

/* ── Send OTP ── */
app.post('/api/send-otp', async (req, res) => {
  purgeExpired();
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ status: false, reason: 'Nomor HP wajib diisi' });
  if (waStatus !== 'connected') return res.status(503).json({ status: false, reason: 'WhatsApp server belum terhubung' });

  const target = toE164(phone);
  const otp    = generateOtp();
  otpStore.set(target, { code: otp, expiresAt: Date.now() + 5 * 60 * 1000, attempts: 0 });

  try {
    await waClient.sendMessage(`${target}@c.us`,
      `*AnabulKu* - Kode verifikasi kamu: *${otp}*\n\nBerlaku 5 menit. Jangan bagikan ke siapapun.`
    );
    console.log(`[OTP] Terkirim ke ${target}`);
    return res.json({ status: true, message: 'OTP terkirim' });
  } catch (e) {
    otpStore.delete(target);
    console.error('[OTP] Gagal kirim:', e.message);
    return res.status(500).json({ status: false, reason: 'Gagal mengirim OTP' });
  }
});

/* ── Verify OTP ── */
app.post('/api/verify-otp', (req, res) => {
  purgeExpired();
  const { phone, code } = req.body;
  if (!phone || !code) return res.status(400).json({ status: false, reason: 'Phone dan code wajib diisi' });

  const target = toE164(phone);
  const entry  = otpStore.get(target);

  if (!entry) return res.status(400).json({ status: false, reason: 'OTP tidak ditemukan atau sudah kadaluarsa' });
  if (entry.expiresAt < Date.now()) {
    otpStore.delete(target);
    return res.status(400).json({ status: false, reason: 'OTP sudah kadaluarsa' });
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
   Start
================================================================ */
app.listen(PORT, () => {
  console.log(`[AnabulKu WA Server] Jalan di port ${PORT}`);
  console.log(`[AnabulKu WA Server] Back office: http://localhost:${PORT}/admin?token=${ADMIN_TOKEN}`);
});

startWaClient().catch(e => console.error('[WA] Gagal start:', e.message));

