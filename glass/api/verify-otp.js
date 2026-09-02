/* ================================================================
   AnabulKu — Vercel Serverless Function
   Verifikasi kode OTP yang sudah dikirim via WhatsApp.
   Endpoint: POST /api/verify-otp
   Body: { phone: "08xxx", code: "123456" }
================================================================ */

import { otpStore, toE164 } from './_otp-store.js';

const MAX_ATTEMPTS = 5;

export default async function handler(req, res) {
  /* CORS */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ status: false, reason: 'Method not allowed' });
  }

  const { phone, code } = req.body || {};

  if (!phone || !code) {
    return res.status(400).json({ status: false, reason: 'phone dan code wajib diisi' });
  }

  const target = toE164(phone);
  const entry  = otpStore.get(target);

  if (!entry) {
    return res.status(400).json({
      status: false,
      reason: 'Kode OTP tidak ditemukan atau sudah kedaluwarsa. Kirim ulang OTP.',
    });
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(target);
    return res.status(400).json({
      status: false,
      reason: 'Kode OTP sudah kedaluwarsa. Silakan kirim ulang.',
    });
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(target);
    return res.status(400).json({
      status: false,
      reason: 'Terlalu banyak percobaan. Silakan kirim ulang OTP.',
    });
  }

  if (String(code).trim() !== entry.code) {
    entry.attempts += 1;
    const sisaPercobaan = MAX_ATTEMPTS - entry.attempts;
    return res.status(400).json({
      status: false,
      reason: `Kode OTP salah. Sisa percobaan: ${sisaPercobaan}`,
    });
  }

  /* ✅ OTP benar — hapus agar tidak bisa dipakai ulang */
  otpStore.delete(target);
  return res.status(200).json({ status: true, message: 'Verifikasi berhasil' });
}


const MAX_ATTEMPTS = 5; /* Maksimal salah input sebelum OTP hangus */

export default async function handler(req, res) {
  /* CORS */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ status: false, reason: 'Method not allowed' });
  }

  const { phone, code } = req.body || {};

  if (!phone || !code) {
    return res.status(400).json({ status: false, reason: 'phone dan code wajib diisi' });
  }

  const target = toE164(phone);
  const entry  = otpStore.get(target);

  /* OTP tidak ditemukan atau sudah expired */
  if (!entry) {
    return res.status(400).json({
      status: false,
      reason: 'Kode OTP tidak ditemukan atau sudah kedaluwarsa. Kirim ulang OTP.',
    });
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(target);
    return res.status(400).json({
      status: false,
      reason: 'Kode OTP sudah kedaluwarsa. Silakan kirim ulang.',
    });
  }

  /* Terlalu banyak percobaan salah */
  if (entry.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(target);
    return res.status(400).json({
      status: false,
      reason: 'Terlalu banyak percobaan. Silakan kirim ulang OTP.',
    });
  }

  /* Kode salah */
  if (String(code).trim() !== entry.code) {
    entry.attempts += 1;
    const sisaPercobaan = MAX_ATTEMPTS - entry.attempts;
    return res.status(400).json({
      status: false,
      reason: `Kode OTP salah. Sisa percobaan: ${sisaPercobaan}`,
    });
  }

  /* ✅ OTP benar — hapus dari store supaya tidak bisa dipakai ulang */
  otpStore.delete(target);
  return res.status(200).json({ status: true, message: 'Verifikasi berhasil' });
}
