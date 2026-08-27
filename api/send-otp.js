/* ================================================================
   AnabulKu — Vercel Serverless Function
   Generate OTP, simpan sementara di memory, kirim via Fonnte (WhatsApp).
   Endpoint: POST /api/send-otp
   Body: { phone: "08xxx" }
================================================================ */

import { otpStore, toE164, purgeExpired } from './_otp-store.js';

const FONNTE_TOKEN = process.env.FONNTE_TOKEN;

/* Generate 6-digit OTP */
function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export default async function handler(req, res) {
  /* CORS */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ status: false, reason: 'Method not allowed' });
  }

  const { phone } = req.body || {};

  if (!phone) {
    return res.status(400).json({ status: false, reason: 'Nomor HP wajib diisi' });
  }

  if (!FONNTE_TOKEN) {
    console.error('[AnabulKu] FONNTE_TOKEN env variable belum diset');
    return res.status(500).json({ status: false, reason: 'Konfigurasi server belum lengkap' });
  }

  purgeExpired();

  const target = toE164(phone);

  /* Rate-limit: cegah spam kirim ulang dalam 60 detik pertama */
  const existing = otpStore.get(target);
  if (existing && existing.expiresAt - Date.now() > 4 * 60 * 1000) {
    return res.status(429).json({
      status: false,
      reason: 'Kode OTP sudah dikirim. Tunggu 60 detik sebelum kirim ulang.',
    });
  }

  const code      = generateOtp();
  const expiresAt = Date.now() + 5 * 60 * 1000; /* 5 menit */
  otpStore.set(target, { code, expiresAt, attempts: 0 });

  const message =
    `🐾 *AnabulKu — Kode Verifikasi*\n\n` +
    `Kode OTP kamu: *${code}*\n\n` +
    `Berlaku selama *5 menit*. Jangan bagikan kode ini ke siapapun.\n\n` +
    `Jika kamu tidak mendaftar di AnabulKu, abaikan pesan ini.`;

  try {
    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': FONNTE_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ target, message }),
    });

    const data = await response.json();

    if (!response.ok || data.status === false) {
      console.error('[AnabulKu] Fonnte error:', data);
      otpStore.delete(target);
      return res.status(502).json({ status: false, reason: 'Gagal mengirim OTP via WhatsApp' });
    }

    return res.status(200).json({ status: true, message: 'OTP berhasil dikirim' });
  } catch (err) {
    console.error('[AnabulKu] Fonnte proxy error:', err);
    otpStore.delete(target);
    return res.status(500).json({ status: false, reason: 'Gagal menghubungi layanan WhatsApp' });
  }
}


export default async function handler(req, res) {
  /* CORS */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ status: false, reason: 'Method not allowed' });
  }

  const { phone } = req.body || {};

  if (!phone) {
    return res.status(400).json({ status: false, reason: 'Nomor HP wajib diisi' });
  }

  if (!FONNTE_TOKEN) {
    console.error('[AnabulKu] FONNTE_TOKEN env variable belum diset');
    return res.status(500).json({ status: false, reason: 'Konfigurasi server belum lengkap' });
  }

  purgeExpired();

  const target = toE164(phone);

  /* Rate-limit: cegah spam kirim ulang dalam 60 detik pertama */
  const existing = otpStore.get(target);
  if (existing && existing.expiresAt - Date.now() > 4 * 60 * 1000) {
    return res.status(429).json({
      status: false,
      reason: 'Kode OTP sudah dikirim. Tunggu 60 detik sebelum kirim ulang.',
    });
  }

  const code      = generateOtp();
  const expiresAt = Date.now() + 5 * 60 * 1000; /* 5 menit */
  otpStore.set(target, { code, expiresAt, attempts: 0 });

  const message =
    `🐾 *AnabulKu — Kode Verifikasi*\n\n` +
    `Kode OTP kamu: *${code}*\n\n` +
    `Berlaku selama *5 menit*. Jangan bagikan kode ini ke siapapun.\n\n` +
    `Jika kamu tidak mendaftar di AnabulKu, abaikan pesan ini.`;

  try {
    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': FONNTE_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ target, message }),
    });

    const data = await response.json();

    if (!response.ok || data.status === false) {
      console.error('[AnabulKu] Fonnte error:', data);
      otpStore.delete(target);
      return res.status(502).json({ status: false, reason: 'Gagal mengirim OTP via WhatsApp' });
    }

    return res.status(200).json({ status: true, message: 'OTP berhasil dikirim' });
  } catch (err) {
    console.error('[AnabulKu] Fonnte proxy error:', err);
    otpStore.delete(target);
    return res.status(500).json({ status: false, reason: 'Gagal menghubungi layanan WhatsApp' });
  }
}

/* Export store agar bisa diakses dari verify-otp.js */
export { otpStore, toE164 };

