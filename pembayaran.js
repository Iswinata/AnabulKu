/* ===================================================================
   AnabulKu — pembayaran.js
=================================================================== */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function fmt(n) { return "Rp "+Number(n).toLocaleString("id-ID"); }

  var PLATFORM_FEE = 5000;
  var TIMER_SECS   = 5 * 60;
  var timerInterval = null;
  var secsLeft = TIMER_SECS;
  var booking  = null;
  var expired  = false;

  function loadBooking() { try{return JSON.parse(localStorage.getItem("anabulku_pending_payment")||"null");}catch(e){return null;} }
  function fmtTgl(iso) { if(!iso)return"—"; return new Date(iso+"T00:00").toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"}); }

  function renderSummary(b) {
    $("pyKlinik").textContent  = b.namaKlinik||"—";
    $("pyDokter").textContent  = b.dokter ? b.dokter.replace(/^drh\.\s*/i,"drh. ") : "—";
    $("pyTanggal").textContent = fmtTgl(b.tanggal);
    $("pyJam").textContent     = b.jam ? b.jam+" WIB" : "—";
    $("pyHewan").textContent   = [b.namaHewan, b.jenisHewan].filter(Boolean).join(" — ")||"—";
    var biaya = parseInt(b.biaya||0,10);
    $("pyBiaya").textContent = biaya ? fmt(biaya) : "Gratis";
    var total = biaya + PLATFORM_FEE;
    $("pyTotal").textContent       = fmt(total);
    $("pyFooterTotal").textContent = fmt(total);
    booking.totalBayar = total;
  }

  function startCountdown() {
    if (booking&&booking.paymentDeadline) secsLeft=Math.max(0,Math.round((new Date(booking.paymentDeadline).getTime()-Date.now())/1000));
    timerInterval=setInterval(tick,1000); tick();
  }
  function tick() {
    if (secsLeft<=0){clearInterval(timerInterval);onExpired();return;}
    var m=String(Math.floor(secsLeft/60)).padStart(2,"0"), s=String(secsLeft%60).padStart(2,"0"), txt=m+":"+s;
    var urgent=secsLeft<=60;
    var timer=$("pyTimer"); if(timer)timer.textContent=txt;
    var cd=$("pyCountdown"); if(cd)cd.classList.toggle("is-urgent",urgent);
    var qt=$("pyQrisTimer"); if(qt)qt.textContent=txt;
    var qb=$("pyQrisTimerBadge"); if(qb)qb.classList.toggle("is-urgent",urgent);
    secsLeft--;
  }
  function onExpired() {
    expired=true; closeAll(); openOverlay("pyExpiredOverlay");
    try {
      var key=booking.mitraId?"anabulku_bookings_"+booking.mitraId:"anabulku_bookings";
      ["anabulku_bookings",key].forEach(function(k){
        var l=JSON.parse(localStorage.getItem(k)||"[]");
        l=l.map(function(b){return b.id===booking.id?Object.assign({},b,{status:"dibatalkan"}):b;});
        localStorage.setItem(k,JSON.stringify(l));
      });
    }catch(e){}
  }

  var VA_MAP={bca:{name:"BCA",icon:"🏦",prefix:"1234"},mandiri:{name:"Mandiri",icon:"🏦",prefix:"8880"},bni:{name:"BNI",icon:"🏦",prefix:"9888"}};
  function genVA(m){var seed=(booking&&booking.id)?booking.id.replace(/\D/g,"").slice(0,8):"00000000";return VA_MAP[m].prefix+seed.padStart(8,"0");}

  function buildInfoRows(id,rows){
    var el=$(id);if(!el)return;
    el.innerHTML=rows.map(function(r){return'<div class="py-info-rows-row"><span class="py-info-rows-key">'+esc(r.k)+'</span><span class="py-info-rows-val">'+esc(r.v)+'</span></div>';}).join("");
  }

  function openOverlay(id){var el=$(id);if(el){el.hidden=false;el.removeAttribute("hidden");}}
  function closeOverlay(id){var el=$(id);if(el)el.hidden=true;}
  function closeAll(){["pyQrisOverlay","pyVaOverlay","pySuksesOverlay","pyLeaveOverlay"].forEach(closeOverlay);}

  function markPaid(method){
    try{
      var b=Object.assign({},booking,{status:"menunggu",statusPembayaran:"menunggu_konfirmasi",metodePembayaran:method,submittedAt:new Date().toISOString()});
      var key=b.mitraId?"anabulku_bookings_"+b.mitraId:"anabulku_bookings";
      ["anabulku_bookings",key].forEach(function(k){
        var l=JSON.parse(localStorage.getItem(k)||"[]");
        l=l.map(function(x){return x.id===b.id?b:x;});
        localStorage.setItem(k,JSON.stringify(l));
      });
      localStorage.removeItem("anabulku_pending_payment");
    }catch(e){}
  }
  function showSukses(method){
    clearInterval(timerInterval); markPaid(method);
    var ref=$("pySuccessRef"); if(ref&&booking)ref.textContent="ID Booking: "+(booking.id||"—").toUpperCase();
    closeAll(); openOverlay("pySuksesOverlay");
  }

  function showQris() {
    if (!booking) return;
    buildInfoRows("pyQrisInfoRows",[
      {k:"Klinik",  v:booking.namaKlinik||"—"},
      {k:"Dokter",  v:booking.dokter||"—"},
      {k:"Tanggal", v:fmtTgl(booking.tanggal)},
      {k:"Pukul",   v:(booking.jam||"—")+" WIB"},
      {k:"Total",   v:fmt(booking.totalBayar||0)}
    ]);
    openOverlay("pyQrisOverlay");
  }
  function showVA(method) {
    if (!booking||!VA_MAP[method]) return;
    var info=VA_MAP[method], vaNum=genVA(method);
    var bi=$("pyVaBankIcon"); if(bi)bi.textContent=info.icon;
    var bn=$("pyVaBankName"); if(bn)bn.textContent="Transfer "+info.name;
    var vn=$("pyVaNumber");   if(vn)vn.textContent=vaNum;
    buildInfoRows("pyVaInfoRows",[
      {k:"Atas Nama", v:"AnabulKu "+info.name},
      {k:"Nominal",   v:fmt(booking.totalBayar||0)},
      {k:"Klinik",    v:booking.namaKlinik||"—"},
      {k:"Batas Bayar",v:booking.paymentDeadline?new Date(booking.paymentDeadline).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"}):"—"}
    ]);
    openOverlay("pyVaOverlay");
  }

  function wireEvents() {
    /* Method select */
    document.querySelectorAll(".py-method-item").forEach(function(btn){
      btn.addEventListener("click",function(){
        document.querySelectorAll(".py-method-item").forEach(function(b){b.classList.remove("is-selected");b.setAttribute("aria-checked","false");});
        btn.classList.add("is-selected"); btn.setAttribute("aria-checked","true");
      });
    });

    /* Bayar Sekarang */
    var payBtn=$("pyBtnPay");
    if(payBtn)payBtn.addEventListener("click",function(){
      if(expired)return;
      var sel=document.querySelector(".py-method-item.is-selected");
      var method=sel?sel.getAttribute("data-method"):"qris";
      if(method==="qris")showQris(); else showVA(method);
    });

    /* QRIS */
    var qc=$("pyQrisClose"); if(qc)qc.addEventListener("click",function(){closeOverlay("pyQrisOverlay");});
    var qo=$("pyQrisOk");    if(qo)qo.addEventListener("click",function(){showSukses("qris");});

    /* VA */
    var vc=$("pyVaClose"); if(vc)vc.addEventListener("click",function(){closeOverlay("pyVaOverlay");});
    var vo=$("pyVaOk");    if(vo)vo.addEventListener("click",function(){var s=document.querySelector(".py-method-item.is-selected");showSukses(s?s.getAttribute("data-method"):"va");});

    /* Copy VA */
    var cb=$("pyBtnCopy");
    if(cb)cb.addEventListener("click",function(){
      var n=$("pyVaNumber"); if(!n)return;
      navigator.clipboard.writeText(n.textContent.trim()).then(function(){
        cb.textContent="Tersalin ✓"; cb.classList.add("copied");
        setTimeout(function(){cb.textContent="Salin";cb.classList.remove("copied");},2000);
      }).catch(function(){});
    });

    /* Sukses home */
    var sh=$("pySuksesHome"); if(sh)sh.addEventListener("click",function(){window.location.href="home.html";});
    /* Expired home */
    var eh=$("pyExpiredHome"); if(eh)eh.addEventListener("click",function(){window.location.href="home.html";});

    /* Back */
    var bk=$("pyBtnBack");
    if(bk)bk.addEventListener("click",function(){
      if(expired){window.location.href="home.html";return;}
      openOverlay("pyLeaveOverlay");
    });
    /* Leave */
    var lc=$("pyLeaveConfirm"); if(lc)lc.addEventListener("click",function(){clearInterval(timerInterval);window.location.href="home.html";});
    var ls=$("pyLeaveStay");    if(ls)ls.addEventListener("click",function(){closeOverlay("pyLeaveOverlay");});

    /* Intercept browser back */
    history.pushState(null,"",window.location.href);
    window.addEventListener("popstate",function(e){
      if(expired)return;
      e.preventDefault();
      openOverlay("pyLeaveOverlay");
    });
  }

  /* ── Init ── */
  function init() {
    booking=loadBooking();
    if(!booking){window.location.replace("home.html");return;}
    renderSummary(booking);
    startCountdown();
    wireEvents();
  }

  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",init);}else{init();}
})();

