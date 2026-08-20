/* ===================================================================
   AnabulKu — Konfigurasi
   -------------------------------------------------------------------
   1. Buka https://console.cloud.google.com/
   2. Aktifkan "Places API (New)".
   3. Buat API key, batasi ke HTTP referrer domain kamu.
   4. Tempel key-nya di GOOGLE_MAPS_API_KEY di bawah.

   Kalau key dibiarkan kosong, aplikasi otomatis memakai data contoh
   (mock) supaya tampilan kartu tetap bisa dilihat.
=================================================================== */

window.ANABULKU_CONFIG = {
  GOOGLE_MAPS_API_KEY: "AIzaSyCFjXB2cpcm9HGwl_KlK0IuvCoul3mRV1c",

  /* Radius AWAL pencarian dari posisi pengguna (meter).
     Kalau belum ada klinik yang cocok, aplikasi otomatis memperlebar
     jangkauan bertahap (×3) hingga maksimal 50 km — jadi tetap dapat
     hasil di lokasi mana pun user membuka, kota padat maupun daerah. */
  SEARCH_RADIUS_M: 8000,

  /* Jumlah maksimum klinik yang ditampilkan */
  MAX_RESULTS: 8,

  /* Dipakai kalau izin lokasi ditolak / GPS tidak tersedia (Malang) */
  FALLBACK_CENTER: { lat: -7.9666, lng: 112.6326 },

  /* Bahasa & region hasil pencarian */
  LANGUAGE: "id",
  REGION: "id"
};
