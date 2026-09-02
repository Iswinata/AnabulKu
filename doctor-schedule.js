/* ===================================================================
   AnabulKu — doctor-schedule.js
=================================================================== */
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }
  function uid() { return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }

  /* ── Demo fallback ── */
  var DEMO = {
    id:"demo-001", namaKlinik:"Klinik Hewan AnabulKu",
    alamat:"Jl. Contoh No. 1", kota:"Jakarta", hargaMulai:"50000",
    dokters:[
      { nama:"drh. Siti Rahayu", spesialisasi:"Dokter Umum",
        jadwal:[{hari:"Senin",mulai:"08:00",selesai:"12:00"},{hari:"Selasa",mulai:"08:00",selesai:"12:00"},
                {hari:"Rabu",mulai:"13:00",selesai:"17:00"},{hari:"Kamis",mulai:"08:00",selesai:"12:00"},
                {hari:"Jumat",mulai:"08:00",selesai:"12:00"},{hari:"Sabtu",mulai:"09:00",selesai:"14:00"},
                {hari:"Minggu",mulai:"09:00",selesai:"13:00"}]},
      { nama:"drh. Budi Santoso", spesialisasi:"Dokter Bedah",
        jadwal:[{hari:"Senin",mulai:"13:00",selesai:"17:00"},{hari:"Rabu",mulai:"08:00",selesai:"12:00"},
                {hari:"Jumat",mulai:"13:00",selesai:"17:00"},{hari:"Sabtu",mulai:"09:00",selesai:"14:00"},
                {hari:"Minggu",mulai:"09:00",selesai:"13:00"}]}
    ]
  };

  /* ── Load clinic ── */
  var activeMitraId = "";
  function getClinicIndex() {
    var p = new URLSearchParams(window.location.search);
    var id = parseInt(p.get("id"),10); return isNaN(id)?0:id;
  }
  function loadClinic(idx) {
    try {
      var list = JSON.parse(localStorage.getItem("mitraKlinik")||"[]");
      var c = list[idx]||null;
      if (!c) { activeMitraId=DEMO.id; return DEMO; }
      activeMitraId = c.id||"";
      if ((!Array.isArray(c.dokters)||!c.dokters.length)&&activeMitraId) {
        try {
          var nd = JSON.parse(localStorage.getItem("anabulku_dokters_"+activeMitraId)||"[]");
          if (nd.length) { c=Object.assign({},c,{dokters:nd}); list[idx]=c; localStorage.setItem("mitraKlinik",JSON.stringify(list)); }
        } catch(e){}
      }
      return c;
    } catch(e) { return DEMO; }
  }

  /* ── Booking helpers ── */
  function bookingKey() { return activeMitraId?"anabulku_bookings_"+activeMitraId:"anabulku_bookings"; }
  function loadBookings() { try{return JSON.parse(localStorage.getItem(bookingKey())||"[]");}catch(e){return[];} }
  function saveBooking(b) {
    try {
      var kl=loadBookings(); kl.unshift(b); localStorage.setItem(bookingKey(),JSON.stringify(kl));
      var gl=JSON.parse(localStorage.getItem("anabulku_bookings")||"[]"); gl.unshift(b); localStorage.setItem("anabulku_bookings",JSON.stringify(gl));
    } catch(e){}
  }
  function getBookedSlots(nama,tgl) {
    var now=Date.now();
    return loadBookings().filter(function(b){
      if(b.dokter!==nama||b.tanggal!==tgl)return false;
      if(b.status==="dibatalkan")return false;
      if(b.paymentDeadline&&new Date(b.paymentDeadline).getTime()<=now)return false;
      return b.status==="menunggu"||b.status==="dikonfirmasi";
    }).map(function(b){return b.jam;});
  }

  /* ── Date helpers ── */
  var ID_DAYS=["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  var DAY_LETTERS=["M","S","S","R","K","J","S"];
  function localISO(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
  function isoToDay(iso){return ID_DAYS[new Date(iso+"T00:00").getDay()];}
  function isSlotPast(isoDate,jam){
    var now=new Date(); var today=new Date(); today.setHours(0,0,0,0);
    var slotDate=new Date(isoDate+"T00:00");
    if(slotDate<today)return true;
    if(slotDate.getTime()===today.getTime()){
      var h=parseInt(jam.split(":")[0],10),m=parseInt(jam.split(":")[1]||0,10);
      return(h*60+m)<=(now.getHours()*60+now.getMinutes());
    }
    return false;
  }

  /* ── Generate slots ── */
  function genSlots(mulai,selesai) {
    if(!mulai||!selesai)return[];
    var slots=[],cur=parseInt(mulai.split(":")[0],10)*60+parseInt(mulai.split(":")[1]||0,10);
    var end=parseInt(selesai.split(":")[0],10)*60+parseInt(selesai.split(":")[1]||0,10);
    while(cur<end){slots.push(String(Math.floor(cur/60)).padStart(2,"0")+":"+String(cur%60).padStart(2,"0"));cur+=60;}
    return slots;
  }
  function getSesiSlots(doc,dayName) {
    if(Array.isArray(doc.jadwal)&&doc.jadwal.length){
      var entries=doc.jadwal.filter(function(j){return j.hari===dayName;});
      if(!entries.length)return[];
      var result=[];
      entries.forEach(function(e){
        var sessions=Array.isArray(e.sessions)&&e.sessions.length?e.sessions:[{mulai:e.mulai||"08:00",selesai:e.selesai||"17:00",label:""}];
        sessions.forEach(function(s,si){result.push({label:s.label||(sessions.length>1?"Sesi "+(si+1):""),slots:genSlots(s.mulai,s.selesai)});});
      });
      return result;
    }
    var h=typeof doc.hari==="string"?doc.hari.split(/[,\s]+/).filter(Boolean):(Array.isArray(doc.hari)?doc.hari:[]);
    if(!h.length||h.indexOf(dayName)>=0) return [{label:"",slots:genSlots(doc.jamMulai||"08:00",doc.jamSelesai||"17:00")}];
    return[];
  }

  /* ── Active state ── */
  var activeDateISO=localISO(new Date());
  var activeClinic=null;
  var modalEl=null;

  /* ── Date strip ── */
  function buildDateStrip(onChange) {
    var strip=$("dsDateStrip");if(!strip)return;
    var today=new Date();strip.innerHTML="";
    for(var i=0;i<7;i++){
      var d=new Date(today);d.setDate(today.getDate()+i);
      var iso=localISO(d);
      var btn=document.createElement("button");
      btn.type="button";btn.className="ds-day-btn"+(i===0?" is-active":"");
      btn.setAttribute("data-date",iso);
      btn.setAttribute("aria-label",d.toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long"}));
      btn.innerHTML='<span class="ds-day-letter">'+DAY_LETTERS[d.getDay()]+'</span><span class="ds-day-num">'+d.getDate()+'</span>';
      strip.appendChild(btn);
    }
    var allBtns=strip.querySelectorAll(".ds-day-btn");
    allBtns.forEach(function(btn){
      btn.addEventListener("click",function(){
        allBtns.forEach(function(b){b.classList.remove("is-active");});
        btn.classList.add("is-active");
        activeDateISO=btn.getAttribute("data-date");
        if(onChange)onChange(activeDateISO);
      });
    });
  }

  /* ── Empty state ── */
  function emptyHtml(msg) {
    return '<div class="ds-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg><p>'+esc(msg)+'</p></div>';
  }

  /* ── Toast ── */
  function showToast(msg) {
    var t=document.createElement("div");t.className="ds-toast";t.textContent=msg;
    document.body.appendChild(t);
    setTimeout(function(){if(t.parentNode)t.remove();},3000);
  }

  /* ── Guest modal ── */
  function showGuestModal() {
    var old=document.getElementById("dsGuestModal");if(old)old.remove();
    var backdrop=document.createElement("div");backdrop.id="dsGuestModal";backdrop.className="ds-guest-backdrop";
    var sheet=document.createElement("div");sheet.className="ds-guest-sheet";
    sheet.innerHTML='<div class="ds-guest-icon">🔒</div>'
      +'<div class="ds-guest-title">Login Diperlukan</div>'
      +'<p class="ds-guest-sub">Fitur ini hanya tersedia untuk member AnabulKu.</p>'
      +'<button class="ds-guest-btn-primary" id="dsGuestLogin">Masuk</button>'
      +'<button class="ds-guest-btn-secondary" id="dsGuestReg">Daftar Gratis</button>';
    backdrop.appendChild(sheet);document.body.appendChild(backdrop);
    document.getElementById("dsGuestLogin").onclick=function(){window.location.href="login.html";};
    document.getElementById("dsGuestReg").onclick=function(){window.location.href="register.html";};
    backdrop.addEventListener("click",function(e){if(e.target===backdrop)backdrop.remove();});
  }


  /* ── Build doctor cards ── */
  function buildDoctorCards(clinic, dateISO) {
    var list=$("dsDoctorList");if(!list)return;
    var targetDate=dateISO||activeDateISO;
    var dayName=isoToDay(targetDate);
    var allDok=clinic.dokters||[];
    var titleEl=$("dsDoctorTitle");if(titleEl)titleEl.textContent="Dokter Tersedia — "+dayName;
    if(!allDok.length){list.innerHTML=emptyHtml("Klinik ini belum memiliki data dokter.");return;}
    var dokters=allDok.filter(function(doc){
      if(Array.isArray(doc.jadwal)&&doc.jadwal.length)return doc.jadwal.some(function(j){return j.hari===dayName;});
      var h=typeof doc.hari==="string"?doc.hari.split(/[,\s]+/).filter(Boolean):(Array.isArray(doc.hari)?doc.hari:[]);
      return!h.length||h.indexOf(dayName)>=0;
    });
    if(!dokters.length){list.innerHTML=emptyHtml("Tidak ada dokter yang bertugas pada hari ini.");return;}

    list.innerHTML=dokters.map(function(doc){
      var jadwalHari=Array.isArray(doc.jadwal)&&doc.jadwal.length?doc.jadwal.map(function(j){return j.hari;}):(typeof doc.hari==="string"?doc.hari.split(/[,\s]+/).filter(Boolean):(Array.isArray(doc.hari)?doc.hari:[]));
      var dayTags=jadwalHari.map(function(h){return'<span class="ds-day-tag'+(h===dayName?" is-today":"")+'">'+esc(h)+'</span>';}).join("");
      var jamHtml="";
      if(Array.isArray(doc.jadwal)&&doc.jadwal.length){
        var entry=null;for(var di=0;di<doc.jadwal.length;di++){if(doc.jadwal[di].hari===dayName){entry=doc.jadwal[di];break;}}
        if(entry){var ss=Array.isArray(entry.sessions)&&entry.sessions.length?entry.sessions:[{mulai:entry.mulai||"08:00",selesai:entry.selesai||"17:00"}];
          jamHtml='<p class="ds-doc-hours">🕐 '+ss.map(function(s){return esc(s.mulai)+"–"+esc(s.selesai);}).join(" &amp; ")+'</p>';}
      } else if(doc.jamMulai||doc.jamSelesai){
        jamHtml='<p class="ds-doc-hours">🕐 '+esc(doc.jamMulai||"08:00")+"–"+esc(doc.jamSelesai||"17:00")+'</p>';
      }
      var fotoStyle=doc.fotoDataUrl?' style="background-image:url(\''+doc.fotoDataUrl+'\');background-size:cover;background-position:center;"':"";
      var sesiList=getSesiSlots(doc,dayName);
      var bookedSlots=getBookedSlots(doc.nama,targetDate);
      var slotsHtml;
      if(!sesiList.length){
        slotsHtml='<div class="ds-no-slots"><svg viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="1.5" width="20" height="20"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg><span>Belum ada jadwal jam untuk hari ini</span></div>';
      } else {
        slotsHtml=sesiList.map(function(sesi){
          var btns=sesi.slots.map(function(jam){
            var past=isSlotPast(targetDate,jam),booked=bookedSlots.indexOf(jam)>=0;
            var cls=past?"past":(booked?"booked":"available");
            var dis=(past||booked)?' disabled aria-disabled="true"':"";
            return'<button type="button" class="ds-time-slot '+cls+'" data-jam="'+esc(jam)+'"'+dis+'>'+esc(jam)+'</button>';
          }).join("");
          return(sesi.label?'<div class="ds-sesi-group-header">'+esc(sesi.label)+'</div>':'')+'<div class="ds-sesi-slots">'+btns+'</div>';
        }).join('<div style="height:10px"></div>');
      }
      return'<div class="ds-doc-card" data-dok="'+esc(doc.nama)+'">'
        +'<div class="ds-doc-inner">'
          +'<div class="ds-doc-photo"'+fotoStyle+'>'
            +(!doc.fotoDataUrl?'<img src="lokasi icon.png" class="ds-doc-photo-icon" alt="" aria-hidden="true" />':"")
          +'</div>'
          +'<div class="ds-doc-info"><p class="ds-doc-name">'+esc(doc.nama)+'</p><p class="ds-doc-spec">'+esc(doc.spesialisasi||"Dokter Hewan")+'</p>'+jamHtml+'</div>'
        +'</div>'
        +(dayTags?'<p class="ds-doc-sched-label">Jadwal dokter:</p><div class="ds-doc-days">'+dayTags+'</div>':"")
        +'<div class="ds-doc-divider"></div>'
        +'<div class="ds-time-row">'+slotsHtml+'</div>'
        +'<div class="ds-time-action-row"><button class="ds-pilih-btn" type="button">Pilih Layanan</button></div>'
      +'</div>';
    }).join("");

    /* Wire slot clicks */
    var allSlots=list.querySelectorAll(".ds-time-slot:not(.booked):not(.past)");
    list.querySelectorAll(".ds-doc-card").forEach(function(card){
      card.querySelectorAll(".ds-time-slot:not(.booked):not(.past)").forEach(function(slot){
        slot.addEventListener("click",function(){
          if(slot.classList.contains("selected")){slot.classList.remove("selected");slot.classList.add("available");}
          else{allSlots.forEach(function(s){s.classList.remove("selected");if(!s.classList.contains("booked")&&!s.classList.contains("past"))s.classList.add("available");});slot.classList.remove("available");slot.classList.add("selected");}
        });
      });
      var pb=card.querySelector(".ds-pilih-btn");
      if(pb)pb.addEventListener("click",function(){
        var dokNama=card.getAttribute("data-dok");
        var dok=null;for(var i=0;i<allDok.length;i++){if(allDok[i].nama===dokNama){dok=allDok[i];break;}}
        var sel=card.querySelector(".ds-time-slot.selected");
        if(!sel){showToast("Pilih jam konsultasi terlebih dahulu.");return;}
        var sess={};try{sess=JSON.parse(localStorage.getItem("anabulku_user_session")||"{}");}catch(e){}
        if(!sess.loggedIn){showGuestModal();return;}
        showBookingModal(clinic,dok||{},sel.getAttribute("data-jam"),targetDate);
      });
    });
  }


  /* ── Booking modal ── */
  function showBookingModal(clinic, doc, jam, tgl) {
    if(modalEl)modalEl.remove();
    var tglFmt=new Date(tgl+"T00:00").toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"});

    /* Ambil data user yang sudah login */
    var sess={};try{sess=JSON.parse(localStorage.getItem("anabulku_user_session")||"{}");}catch(e){}
    var userNama=sess.nama||sess.name||sess.username||"";
    var userHp=sess.noHp||sess.hp||sess.phone||"";
    /* Coba ambil dari anabulku_users jika session tidak lengkap */
    if((!userNama||!userHp)&&sess.email){
      try{
        var users=JSON.parse(localStorage.getItem("anabulku_users")||"[]");
        var found=null;for(var ui=0;ui<users.length;ui++){if(users[ui].email===sess.email){found=users[ui];break;}}
        if(found){userNama=userNama||found.nama||found.name||"";userHp=userHp||found.noHp||found.hp||"";}
      }catch(e){}
    }

    /* Build opsi jenis hewan dari data klinik */
    var hewanList=[];
    if(Array.isArray(clinic.hewanDilayani)&&clinic.hewanDilayani.length){
      hewanList=clinic.hewanDilayani;
    } else if(typeof clinic.hewanDilayani==="string"&&clinic.hewanDilayani.trim()){
      hewanList=clinic.hewanDilayani.split(/[,;]+/).map(function(h){return h.trim();}).filter(Boolean);
    }
    /* Fallback jika klinik belum isi data hewan */
    if(!hewanList.length) hewanList=["Kucing","Anjing","Kelinci","Burung","Reptil","Lainnya"];
    var hewanOptions='<option value="">Pilih jenis hewan</option>'+hewanList.map(function(h){return'<option value="'+esc(h)+'">'+esc(h)+'</option>';}).join("");

    var backdrop=document.createElement("div");backdrop.className="ds-modal-backdrop";modalEl=backdrop;
    backdrop.innerHTML='<div class="ds-modal" role="dialog" aria-modal="true" aria-labelledby="dsModalTitle">'
      +'<div class="ds-modal-header"><span class="ds-modal-title" id="dsModalTitle">Konfirmasi Booking</span>'
      +'<button class="ds-modal-close" type="button" aria-label="Tutup">&times;</button></div>'
      +'<div class="ds-modal-body">'
        +'<div class="ds-modal-row"><span class="ds-modal-label">Klinik</span><span class="ds-modal-value">'+esc(clinic.namaKlinik||"")+'</span></div>'
        +'<div class="ds-modal-row"><span class="ds-modal-label">Dokter</span><span class="ds-modal-value">'+esc(doc.nama||"")+'</span></div>'
        +'<div class="ds-modal-row"><span class="ds-modal-label">Tanggal</span><span class="ds-modal-value">'+esc(tglFmt)+'</span></div>'
        +'<div class="ds-modal-row"><span class="ds-modal-label">Jam</span><span class="ds-modal-value">'+esc(jam)+'</span></div>'
        +'<div class="ds-modal-divider"></div>'
        +'<div class="ds-modal-field"><label for="dsNamaPemilik">Nama Pemilik</label><input id="dsNamaPemilik" type="text" placeholder="Nama lengkap pemilik hewan" autocomplete="name" value="'+esc(userNama)+'"/></div>'
        +'<div class="ds-modal-field"><label for="dsNoHpPemilik">Nomor HP</label><input id="dsNoHpPemilik" type="tel" placeholder="08xxxxxxxxxx" autocomplete="tel" value="'+esc(userHp)+'"/></div>'
        +'<div class="ds-modal-field-row">'
        +'<div class="ds-modal-field"><label for="dsNamaHewan">Nama Hewan</label><input id="dsNamaHewan" type="text" placeholder="Nama hewan"/></div>'
        +'<div class="ds-modal-field"><label for="dsJenisHewan">Jenis Hewan</label>'
          +'<select id="dsJenisHewan">'+hewanOptions+'</select></div>'
        +'</div>'
        +'<div class="ds-modal-field"><label for="dsKeluhan">Keluhan</label><textarea id="dsKeluhan" placeholder="Jelaskan keluhan hewan kamu…"></textarea></div>'
        +'<button class="ds-modal-confirm" type="button" id="dsConfirmBtn">Konfirmasi Booking</button>'
      +'</div></div>';
    document.body.appendChild(backdrop);
    backdrop.querySelector(".ds-modal-close").onclick=function(){backdrop.remove();modalEl=null;};
    backdrop.addEventListener("click",function(e){if(e.target===backdrop){backdrop.remove();modalEl=null;}});
    document.getElementById("dsConfirmBtn").onclick=function(){
      var nama=(document.getElementById("dsNamaPemilik").value||"").trim();
      var nohp=(document.getElementById("dsNoHpPemilik").value||"").trim();
      var hewan=(document.getElementById("dsNamaHewan").value||"").trim();
      var jenis=document.getElementById("dsJenisHewan").value;
      var keluhan=(document.getElementById("dsKeluhan").value||"").trim();
      if(!nama||!hewan||!jenis){showToast("Lengkapi semua data terlebih dahulu.");return;}
      var sess2={};try{sess2=JSON.parse(localStorage.getItem("anabulku_user_session")||"{}");}catch(e){}
      var booking={
        id:uid(),mitraId:activeMitraId,
        namaPemilik:nama,noHpPemilik:nohp,namaHewan:hewan,jenisHewan:jenis,keluhan:keluhan,
        dokter:doc.nama||"",spesialisasi:doc.spesialisasi||"",
        tanggal:tgl,jam:jam,biaya:clinic.hargaMulai||"",
        status:"menunggu",statusPembayaran:"menunggu_pembayaran",
        sumber:"app_user",namaKlinik:clinic.namaKlinik||"",
        createdAt:new Date().toISOString(),
        paymentDeadline:new Date(Date.now()+5*60*1000).toISOString(),
        userEmail:sess2.email||"",userId:sess2.uid||""
      };
      saveBooking(booking);
      try{localStorage.setItem("anabulku_pending_payment",JSON.stringify(booking));}catch(e){}
      backdrop.remove();modalEl=null;
      window.location.href="pembayaran.html";
    };
    /* Focus field pertama yang kosong */
    setTimeout(function(){
      var f=document.getElementById("dsNamaPemilik");
      if(f&&!f.value){f.focus();}
      else{var g=document.getElementById("dsNamaHewan");if(g)g.focus();}
    },50);
  }

  /* ── Init ── */
  function init() {
    var idx=getClinicIndex();
    activeClinic=loadClinic(idx);
    var nameEl=$("dsClinicName");if(nameEl)nameEl.textContent=activeClinic.namaKlinik||"Pilih Dokter & Jadwal";
    var addrEl=$("dsClinicAddr");if(addrEl)addrEl.textContent=[activeClinic.alamat,activeClinic.kota].filter(Boolean).join(", ");
    var bnName=$("dsBannerName");if(bnName)bnName.textContent=activeClinic.namaKlinik||"—";
    var bnAddr=$("dsBannerAddr");if(bnAddr)bnAddr.textContent=[activeClinic.alamat,activeClinic.kota].filter(Boolean).join(", ")||"—";
    var bnDist=$("dsBannerDist");if(bnDist&&activeClinic.jarak)bnDist.textContent=activeClinic.jarak;
    var bnRating=$("dsBannerRating");if(bnRating&&activeClinic.rating)bnRating.textContent=activeClinic.rating;
    var bnPhoto=$("dsBannerPhoto");
    if(bnPhoto&&(activeClinic.fotoDataUrl||activeClinic.logoDataUrl)){
      bnPhoto.style.backgroundImage="url('"+( activeClinic.fotoDataUrl||activeClinic.logoDataUrl)+"')";
      bnPhoto.style.backgroundSize="cover";bnPhoto.style.backgroundPosition="center";
    }
    buildDateStrip(function(newDate){buildDoctorCards(activeClinic,newDate);});
    buildDoctorCards(activeClinic,activeDateISO);
  }

  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",init);}else{init();}
})();

