/* ================================================================
   AnabulKu — OTP Store (shared module)
   Diimport oleh send-otp.js dan verify-otp.js.

   PENTING: Di Vercel, setiap serverless function berjalan di
   process Node.js yang SAMA selama warm instance masih hidup.
   Module ini di-cache oleh Node require/import cache, sehingga
   Map-nya berbagi state antara send-otp dan verify-otp
   selama masih dalam satu instance.
================================================================ */

export const otpStore = new Map();

/* Konversi nomor lokal Indonesia ke format internasional E.164 */
export function toE164(phone) {
  const cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.startsWith('62')) return cleaned;
  if (cleaned.startsWith('0'))  return '62' + cleaned.slice(1);
  return '62' + cleaned;
}

/* Hapus semua entri expired */
export function purgeExpired() {
  const now = Date.now();
  for (const [key, val] of otpStore.entries()) {
    if (val.expiresAt < now) otpStore.delete(key);
  }
}
