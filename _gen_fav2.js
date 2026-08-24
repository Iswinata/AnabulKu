const fs = require('fs');
const p = 'e:/New Project/';

const part1 = fs.readFileSync(p+'_fav_part1.txt','utf8');

const fav_body = `
<body>
  <div class="app">
    <header class="header">
      <div class="header-top">
        <button class="btn-back" type="button" aria-label="Kembali" onclick="history.back()">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.5 16.5 6 10l6.5-6.5"/></svg>
        </button>
        <div>
          <p class="header-title">Favorit &#10084;&#65039;</p>
          <p class="header-sub" id="favSubtitle">Klinik yang kamu simpan</p>
        </div>
      </div>
    </header>
    <main class="content" id="favContent"></main>
    <nav class="bottomnav" aria-label="Navigasi utama">
      <button class="nav-btn" type="button" onclick="location.href='home.html'" aria-label="Beranda">
        <svg viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12L12 3l9 9"/><path d="M9 21V12h6v9"/></svg>
        <span class="nav-label">Beranda</span>
      </button>
      <button class="nav-btn" type="button" onclick="location.href='riwayat.html'" aria-label="Riwayat">
        <svg viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/></svg>
        <span class="nav-label">Riwayat</span>
      </button>
      <button class="nav-btn active" type="button" aria-current="page" aria-label="Favorit">
        <svg viewBox="0 0 24 24" fill="#F97316" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>
        <span class="nav-label" style="color:#F97316">Favorit</span>
      </button>
      <button class="nav-btn" type="button" onclick="location.href='profil.html'" aria-label="Profil">
        <svg viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>
        <span class="nav-label">Profil</span>
      </button>
    </nav>
  </div>`;

const fav_js = `
  <script>
  (function(){
    'use strict';
    var s={};try{s=JSON.parse(localStorage.getItem('anabulku_user_session'))||{};}catch(e){}
    if(!s.loggedIn){window.location.replace('login.html');return;}
    var content=document.getElementById('favContent');
    var subtitle=document.getElementById('favSubtitle');
    function getFav(){try{return JSON.parse(localStorage.getItem('anabulku_favorit'))||[];}catch(e){return[];}}
    function saveFav(l){try{localStorage.setItem('anabulku_favorit',JSON.stringify(l));}catch(e){}}
    function esc(x){return String(x||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
    function render(){
      var list=getFav();
      subtitle.textContent=list.length?list.length+' klinik tersimpan':'Klinik yang kamu simpan';
      if(!list.length){
        content.innerHTML='<div class="empty-state"><div class="empty-icon">&#10084;&#65039;</div><p class="empty-title">Belum ada favorit</p><p class="empty-sub">Tap ikon hati pada halaman klinik<br>untuk menyimpannya di sini.</p><button class="btn-explore" onclick="location.href=\\'home.html\\'">Jelajahi Klinik</button></div>';
        return;
      }
      content.innerHTML=list.map(function(k){
        var foto=k.foto?'<img src="'+esc(k.foto)+'" alt="'+esc(k.namaKlinik)+'" />':'&#127973;';
        var tags=Array.isArray(k.layanan)?k.layanan.slice(0,3).map(function(l){return'<span class="klinik-tag">'+esc(l)+'</span>';}).join(''):'';
        return'<div class="klinik-card"><div class="klinik-card-top"><div class="klinik-photo">'+foto+'</div><div class="klinik-info"><p class="klinik-name">'+esc(k.namaKlinik||'\u2014')+'</p><p class="klinik-meta">'+esc(k.lokasi||k.alamat||'\u2014')+'</p>'+(tags?'<div class="klinik-tags">'+tags+'</div>':'')+'</div><button class="btn-unfav" data-id="'+esc(k.id)+'" aria-label="Hapus dari favorit"><svg viewBox="0 0 24 24" fill="#EF4444" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg></button></div><div class="klinik-card-footer"><button class="btn-detail" data-id="'+esc(k.id)+'" type="button">Lihat Detail</button><button class="btn-booking" data-id="'+esc(k.id)+'" type="button">Booking</button></div></div>';
      }).join('');
      content.querySelectorAll('.btn-unfav').forEach(function(btn){
        btn.addEventListener('click',function(){
          var id=btn.getAttribute('data-id');
          saveFav(getFav().filter(function(k){return String(k.id)!==String(id);}));render();
        });
      });
      content.querySelectorAll('.btn-detail,.btn-booking').forEach(function(btn){
        btn.addEventListener('click',function(){location.href='clinic-detail.html?id='+encodeURIComponent(btn.getAttribute('data-id'));});
      });
    }
    render();
    window.addEventListener('pageshow',function(e){if(e.persisted)render();});
  })();
  </script>
</body>
</html>`;

fs.writeFileSync(p+'favorit.html', part1+fav_body+fav_js, 'utf8');
console.log('favorit.html OK', fs.statSync(p+'favorit.html').size, 'bytes');
