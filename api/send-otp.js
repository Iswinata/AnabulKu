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


export default async function handler(req, res) {
  /* Hanya izinkan POST */
  if (req.method !== 'POST') {
    return res.status(405).json({ status: false, reason: 'Method not allowed' });
  }

  const { target, message } = req.body || {};

  if (!target || !message) {
    return res.status(400).json({ status: false, reason: 'target dan message wajib diisi' });
  }

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WA_FROM) {
    console.error('[AnabulKu] Twilio env variables belum diset');
    return res.status(500).json({ status: false, reason: 'Konfigurasi server belum lengkap' });
  }

  /* Format nomor tujuan: pastikan pakai format internasional tanpa + di depan */
  const toNumber = target.startsWith('+') ? target : `+${target}`;

  /* Twilio pakai x-www-form-urlencoded */
  const body = new URLSearchParams({
    From: TWILIO_WA_FROM,
    To:   `whatsapp:${toNumber}`,
    Body: message,
  });

  const basicAuth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      }
    );

    const data = await response.json();

    if (response.ok) {
      return res.status(200).json({ status: true, sid: data.sid });
    } else {
      console.error('[AnabulKu] Twilio error:', data);
      return res.status(200).json({ status: false, reason: data.message || 'Twilio gagal kirim pesan' });
    }
  } catch (err) {
    console.error('[AnabulKu] Twilio proxy error:', err);
    return res.status(500).json({ status: false, reason: 'Gagal menghubungi Twilio API' });
  }
}

