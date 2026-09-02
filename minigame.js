/* ===================================================================
   AnabulKu — minigame.js  (Kucing Lompat)  part 1/2
=================================================================== */
(function () {
  "use strict";

  var canvas = document.getElementById("mgCanvas");
  if (!canvas) return;
  var ctx    = canvas.getContext("2d");
  var hint   = document.getElementById("mgHint");
  var scoreEl= document.getElementById("mgScore");
  var bestEl = document.getElementById("mgBest");

  var W = canvas.width, H = canvas.height;
  var GROUND = H - 18, GRAVITY = 0.55, JUMP_V = -11;
  var SPEED_INIT = 4, SPEED_MAX = 9;

  var state = "idle", score = 0, frameCount = 0;
  var best  = parseInt(localStorage.getItem("mg_best") || "0", 10);
  var speed = SPEED_INIT;
  var obs = [], obsTimer = 0, obsInterval = 70;

  var cat = { x:40, y:GROUND, w:24, h:22, vy:0, onGround:true, legFrame:0, legTick:0 };
  var clouds = [{x:280,y:18,w:44,op:0.18},{x:160,y:30,w:30,op:0.12},{x:80,y:14,w:36,op:0.15}];

  function drawGround() {
    ctx.strokeStyle="rgba(255,200,100,0.30)"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,GROUND+cat.h+2); ctx.lineTo(W,GROUND+cat.h+2); ctx.stroke();
    ctx.fillStyle="rgba(255,200,100,0.15)";
    for (var x=(frameCount*speed)%18; x<W; x+=18) ctx.fillRect(x,GROUND+cat.h+3,6,2);
  }

  function drawClouds() {
    clouds.forEach(function(c) {
      ctx.fillStyle="rgba(255,255,255,"+c.op+")";
      ctx.beginPath(); ctx.ellipse(c.x,c.y,c.w,8,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(c.x-10,c.y+4,c.w*0.6,6,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(c.x+12,c.y+3,c.w*0.55,6,0,0,Math.PI*2); ctx.fill();
      c.x-=0.4; if(c.x+c.w<0) c.x=W+c.w;
    });
  }

  function drawCat(x,y,dead) {
    var bx=x,by=y,clr=dead?"#f87171":"#ffbd5d";
    ctx.fillStyle=clr;
    ctx.beginPath(); ctx.roundRect(bx,by,cat.w,cat.h-6,6); ctx.fill();
    ctx.beginPath(); ctx.roundRect(bx+4,by-10,16,14,5); ctx.fill();
    /* ears */
    ctx.beginPath(); ctx.moveTo(bx+5,by-10); ctx.lineTo(bx+3,by-17); ctx.lineTo(bx+10,by-10); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(bx+14,by-10); ctx.lineTo(bx+21,by-17); ctx.lineTo(bx+19,by-10); ctx.closePath(); ctx.fill();
    ctx.fillStyle="rgba(255,100,100,0.5)";
    ctx.beginPath(); ctx.moveTo(bx+6,by-11); ctx.lineTo(bx+5,by-15); ctx.lineTo(bx+10,by-11); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(bx+15,by-11); ctx.lineTo(bx+20,by-15); ctx.lineTo(bx+18,by-11); ctx.closePath(); ctx.fill();
    /* eyes */
    if (dead) {
      ctx.strokeStyle="#fff"; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(bx+7,by-7); ctx.lineTo(bx+10,by-4); ctx.moveTo(bx+10,by-7); ctx.lineTo(bx+7,by-4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx+13,by-7); ctx.lineTo(bx+16,by-4); ctx.moveTo(bx+16,by-7); ctx.lineTo(bx+13,by-4); ctx.stroke();
    } else {
      ctx.fillStyle="#1a1a2e";
      ctx.beginPath(); ctx.ellipse(bx+9,by-5,2.5,2.5,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(bx+16,by-5,2.5,2.5,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#fff";
      ctx.beginPath(); ctx.ellipse(bx+10,by-6,1,1,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(bx+17,by-6,1,1,0,0,Math.PI*2); ctx.fill();
    }
    /* nose */
    ctx.fillStyle="#f97316"; ctx.beginPath(); ctx.ellipse(bx+12,by-2,2,1.5,0,0,Math.PI*2); ctx.fill();
    /* whiskers */
    ctx.strokeStyle="rgba(255,255,255,0.6)"; ctx.lineWidth=0.8;
    [[bx+10,by-2,bx+2,by-1],[bx+10,by-1,bx+2,by+1],[bx+14,by-2,bx+22,by-1],[bx+14,by-1,bx+22,by+1]].forEach(function(l){
      ctx.beginPath(); ctx.moveTo(l[0],l[1]); ctx.lineTo(l[2],l[3]); ctx.stroke();
    });
    /* tail */
    ctx.strokeStyle=clr; ctx.lineWidth=3; ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(bx,by+cat.h-10); ctx.quadraticCurveTo(bx-10,by+cat.h-2,bx-6,by+cat.h-16); ctx.stroke();
    /* legs */
    var lo=cat.onGround?(Math.floor(cat.legFrame/2)%2===0?2:-1):0;
    ctx.fillStyle=dead?"#f87171":"#ffa726";
    ctx.beginPath(); ctx.roundRect(bx+3,by+cat.h-7,5,7+lo,3); ctx.fill();
    ctx.beginPath(); ctx.roundRect(bx+10,by+cat.h-7,5,7-lo,3); ctx.fill();
    ctx.beginPath(); ctx.roundRect(bx+16,by+cat.h-7,5,7+lo,3); ctx.fill();
  }

  function drawObs(o) {
    var bx=o.x, by=GROUND+cat.h-o.h;
    if (o.type==="fish") {
      ctx.fillStyle="#60a5fa"; ctx.beginPath(); ctx.ellipse(bx+8,by+o.h/2,10,6,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#3b82f6"; ctx.beginPath(); ctx.moveTo(bx-2,by+o.h/2-6); ctx.lineTo(bx-10,by+o.h/2-10); ctx.lineTo(bx-10,by+o.h/2+6); ctx.lineTo(bx-2,by+o.h/2+2); ctx.closePath(); ctx.fill();
      ctx.fillStyle="#fff"; ctx.beginPath(); ctx.ellipse(bx+13,by+o.h/2-1,2.5,2.5,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#1a1a2e"; ctx.beginPath(); ctx.ellipse(bx+14,by+o.h/2-1,1.2,1.2,0,0,Math.PI*2); ctx.fill();
    } else {
      ctx.fillStyle="#9ca3af";
      ctx.beginPath(); ctx.ellipse(bx+8,by+o.h/2+2,9,7,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(bx+16,by+o.h/2,6,6,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#d1d5db";
      ctx.beginPath(); ctx.ellipse(bx+14,by+o.h/2-6,3,3,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(bx+19,by+o.h/2-6,3,3,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#f87171"; ctx.beginPath(); ctx.ellipse(bx+18,by+o.h/2-1,1.5,1.5,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle="#9ca3af"; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(bx,by+o.h/2+4); ctx.quadraticCurveTo(bx-8,by+o.h/2-2,bx-4,by+o.h/2+8); ctx.stroke();
    }
  }

  function spawnObs() {
    var type=Math.random()<0.5?"fish":"mouse";
    var h=type==="fish"?18:20, w=type==="fish"?22:24;
    obs.push({x:W+10,h:h,w:w,type:type});
  }

  function hit(o) {
    var cx1=cat.x+4,cx2=cat.x+cat.w-4,cy1=cat.y-8,cy2=cat.y+cat.h;
    var ox1=o.x+3,ox2=o.x+o.w-3,oy1=GROUND+cat.h-o.h,oy2=GROUND+cat.h+2;
    return cx1<ox2&&cx2>ox1&&cy1<oy2&&cy2>oy1;
  }

  function update() {
    frameCount++;
    speed=Math.min(SPEED_MAX,SPEED_INIT+score*0.003);
    cat.vy+=GRAVITY; cat.y+=cat.vy;
    if(cat.y>=GROUND){cat.y=GROUND;cat.vy=0;cat.onGround=true;}else{cat.onGround=false;}
    if(cat.onGround){cat.legTick++;if(cat.legTick%6===0)cat.legFrame++;}
    obsTimer++;
    if(obsTimer>=obsInterval){
      spawnObs(); obsTimer=0;
      obsInterval=Math.max(38,55+Math.floor(Math.random()*40)-Math.min(20,score*0.02));
    }
    obs=obs.filter(function(o){o.x-=speed;return o.x+o.w>-10;});
    for(var i=0;i<obs.length;i++){if(hit(obs[i])){die();return;}}
    score++;
    if(scoreEl)scoreEl.textContent=score;
  }

  function draw() {
    ctx.clearRect(0,0,W,H);
    drawClouds(); drawGround();
    obs.forEach(drawObs);
    drawCat(cat.x,cat.y,state==="dead");
    if(state==="dead"){
      ctx.fillStyle="rgba(0,0,0,0.5)"; ctx.fillRect(0,0,W,H);
      ctx.textAlign="center";
      ctx.fillStyle="#f1f5f9"; ctx.font="bold 14px Poppins,sans-serif";
      ctx.fillText("💔 Game Over! Skor: "+score,W/2,H/2-10);
      ctx.fillStyle="rgba(255,255,255,0.55)"; ctx.font="11px Poppins,sans-serif";
      ctx.fillText("Tap / Spasi untuk main lagi",W/2,H/2+10);
      ctx.textAlign="left";
    }
    if(state==="idle"){
      ctx.textAlign="center";
      ctx.fillStyle="rgba(255,255,255,0.6)"; ctx.font="12px Poppins,sans-serif";
      ctx.fillText("🐱  Tap untuk mulai!",W/2,H/2+4);
      ctx.textAlign="left";
    }
  }

  function loop(){if(state==="running")update();draw();requestAnimationFrame(loop);}

  function start(){
    state="running"; score=0; frameCount=0; obs=[]; obsTimer=0;
    speed=SPEED_INIT; obsInterval=70;
    cat.y=GROUND; cat.vy=0; cat.onGround=true; cat.legFrame=0; cat.legTick=0;
    if(hint)hint.classList.add("hidden");
  }

  function die(){
    state="dead";
    if(score>best){best=score;localStorage.setItem("mg_best",best);if(bestEl)bestEl.textContent=best;}
  }

  function jump(){
    if(state==="idle"){start();return;}
    if(state==="dead"){start();return;}
    if(cat.onGround){cat.vy=JUMP_V;cat.onGround=false;}
  }

  /* Input */
  var wrap=canvas.parentElement;
  wrap.addEventListener("click",jump);
  wrap.addEventListener("touchstart",function(e){e.preventDefault();jump();},{passive:false});
  document.addEventListener("keydown",function(e){
    if(e.code==="Space"||e.code==="ArrowUp"){
      var r=canvas.getBoundingClientRect();
      if(r.top<window.innerHeight&&r.bottom>0){e.preventDefault();jump();}
    }
  });

  /* Init */
  if(bestEl)bestEl.textContent=best;
  if(scoreEl)scoreEl.textContent=0;
  loop();
})();

