/* ================================================================
   AnabulKu — Vercel Serverless Function
   Proxy ke Fonnte API untuk menghindari CORS block di browser.
   Endpoint: POST /api/send-otp
   Body: { target: "628xxx", message: "..." }
================================================================ */

const FONNTE_TOKEN = process.env.FONNTE_TOKEN;

export default async function handler(req, res) {
  /* Hanya izinkan POST */
  if (req.method !== 'POST') {
    return res.status(405).json({ status: false, reason: 'Method not allowed' });
  }

  const { target, message } = req.body || {};

  if (!target || !message) {
    return res.status(400).json({ status: false, reason: 'target dan message wajib diisi' });
  }

  if (!FONNTE_TOKEN) {
    console.error('[AnabulKu] FONNTE_TOKEN env variable belum diset');
    return res.status(500).json({ status: false, reason: 'Konfigurasi server belum lengkap' });
  }

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
    return res.status(200).json(data);
  } catch (err) {
    console.error('[AnabulKu] Fonnte proxy error:', err);
    return res.status(500).json({ status: false, reason: 'Gagal menghubungi Fonnte API' });
  }
}


