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

  /* Radius AWAL pencarian dari posisi pengguna (meter). */
  SEARCH_RADIUS_M: 8000,

  /* Radius MAKS bila radius awal belum menemukan klinik.
     Dibatasi agar hasil tetap di cakupan Kota Malang & sekitarnya
     (bukan lintas kota). */
  MAX_RADIUS_M: 15000,

  /* Jumlah maksimum klinik yang ditampilkan */
  MAX_RESULTS: 8,

  /* Dipakai kalau izin lokasi ditolak / GPS tidak tersedia (Malang) */
  FALLBACK_CENTER: { lat: -7.9666, lng: 112.6326 },

  /* Bahasa & region hasil pencarian */
  LANGUAGE: "id",
  REGION: "id"
};
