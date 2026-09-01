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
  if (req.query.token !== ADMIN_TOKEN) return res.status(401).send('<h2>401 Unauthorized</h2>');
  let body = '';
  if (waStatus === 'connected') {
    body = '<h2 style="color:green">🟢 WhatsApp Terhubung</h2><p>OTP siap dikirim.</p>';
  } else if (waStatus === 'qr' && qrDataUrl) {
    body = `<h2>📱 Scan QR Code</h2>
      <img src="${qrDataUrl}" style="width:300px;height:300px"/>
      <p>Buka WhatsApp → Perangkat Tertaut → Tautkan Perangkat</p>
      <script>setTimeout(()=>location.reload(),5000)</script>`;
  } else {
    body = '<h2>⏳ Menunggu WhatsApp...</h2><script>setTimeout(()=>location.reload(),3000)</script>';
  }
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>AnabulKu WA Admin</title>
    <style>body{font-family:sans-serif;text-align:center;padding:40px;background:#f5f5f5}</style>
    </head><body>${body}</body></html>`);
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

