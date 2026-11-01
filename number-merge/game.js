'use strict';
const COLS=5,ROWS=7,COLORS={2:['#2aa0e0','#1673a8'],4:['#ff8a3d','#e0601a'],8:['#ee5a95','#c63870'],16:['#1fa064','#127a48'],32:['#b23be6','#8420b8'],64:['#c9569a','#9b3475'],128:['#f2c230','#c99410'],256:['#35d4c8','#1b9d94'],512:['#ff5a4d','#c93428'],1024:['#7e6cff','#5240d8'],2048:['#ffd84a','#e8a800']};
const col=v=>COLORS[v]||['#fff','#bbb'];

class StorageManager{
 get(k,d){try{const v=localStorage.getItem('nm_'+k);return v===null?d:JSON.parse(v)}catch(e){return d}}
 set(k,v){try{localStorage.setItem('nm_'+k,JSON.stringify(v))}catch(e){}}
}
class AudioManager{
 constructor(st){this.st=st;this.on=st.get('snd',true);this.vib=st.get('vib',true);this.ctx=null}
 tone(f,d,type='sine',vol=.15,slide=0){if(!this.on)return;try{this.ctx=this.ctx||new(window.AudioContext||window.webkitAudioContext)();const c=this.ctx,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(f,c.currentTime);if(slide)o.frequency.exponentialRampToValueAtTime(f*slide,c.currentTime+d);g.gain.setValueAtTime(vol,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+d);o.connect(g).connect(c.destination);o.start();o.stop(c.currentTime+d)}catch(e){}}
  buzz(n){if(this.vib&&navigator.vibrate)navigator.vibrate(n)}
  unlock(){if(!this.on)return;try{this.ctx=this.ctx||new(window.AudioContext||window.webkitAudioContext)();if(this.ctx.state==='suspended')this.ctx.resume()}catch(e){}}
 drop(){this.tone(220,.1,'triangle',.18,.6)}
 merge(v){this.tone(300+Math.log2(v)*45,.18,'sine',.2,1.5);this.buzz(15)}
 big(){[523,659,784,1047].forEach((f,i)=>setTimeout(()=>this.tone(f,.25,'triangle',.18),i*70));this.buzz([20,30,40])}
 click(){this.tone(600,.05,'square',.08)}
 over(){this.tone(300,.7,'sawtooth',.18,.3);this.buzz(200)}
}
class Block{constructor(v,r){this.v=v;this.y=r;this.r=r;this.s=1;this.pop=0}}
class Board{
  constructor(){this.reset()}
  reset(){this.g=Array.from({length:COLS},()=>[])} // g[c] = blocks from top (index = row)
  free(c){return ROWS-this.g[c].length}
  full(){return this.g.every((_,c)=>this.free(c)===0)}
  snapshot(){return this.g.map(col=>col.map(b=>b.v))}
  restore(s){this.g=s.map(col=>col.map((v,r)=>new Block(v,r)))}
  compact(){this.g.forEach((col,i)=>{const k=col.filter(Boolean);k.forEach((b,r)=>b.r=r);this.g[i]=k})}
 cell(c,r){return this.g[c][r]||null}
 // find group of same-valued orthogonally connected blocks; prefer one containing 'pref'
 findGroup(pref){
  const seen=new Set(),groups=[];
  const starts=[];
  if(pref)starts.push(pref);
  for(let c=0;c<COLS;c++)for(let r=0;r<this.g[c].length;r++)starts.push([c,r]);
  for(const [c0,r0] of starts){
   const k=c0*10+r0;if(seen.has(k))continue;
   const b=this.cell(c0,r0);if(!b)continue;
   const grp=[],st=[[c0,r0]];seen.add(k);
   while(st.length){const [c,r]=st.pop();grp.push([c,r]);
    for(const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1]]){const nc=c+dc,nr=r+dr;
     if(nc<0||nc>=COLS||nr<0)continue;const n=this.cell(nc,nr);const kk=nc*10+nr;
     if(n&&n.v===b.v&&!seen.has(kk)){seen.add(kk);st.push([nc,nr])}}}
   if(grp.length>1)return {grp,v:b.v,target:(pref&&grp.some(p=>p[0]===pref[0]&&p[1]===pref[1]))?pref:grp.reduce((a,p)=>p[1]<a[1]?p:a)};
  }
  return null;
 }
 // Merge one group: result = v*2^floor(log2 n). Returns value gained or 0.
 mergeOnce(pref){
  const f=this.findGroup(pref);if(!f)return null;
  const n=f.grp.length,pw=Math.pow(2,Math.floor(Math.log2(n))),nv=f.v*pw;
  const [tc,tr]=f.target;
  const others=f.grp.filter(p=>!(p[0]===tc&&p[1]===tr)).sort((a,b)=>(Math.abs(a[0]-tc)+Math.abs(a[1]-tr))-(Math.abs(b[0]-tc)+Math.abs(b[1]-tr))).slice(0,pw-1);
  const tb=this.cell(tc,tr);const removed=others.map(([c,r])=>({c,r}));
  others.forEach(([c,r])=>{this.g[c][r]=null});
  tb.v=nv;tb.pop=1;
  this.compact();
  return {nv,tc,tr:tb.r,tb,removed};
 }
}
class PowerUpManager{
 constructor(game){this.G=game;this.cost={ham:150,swap:175,undo:75};this.mode=null}
 afford(k){return this.G.coins>=this.cost[k]}
 pay(k){this.G.coins-=this.cost[k];this.G.save();this.G.ui()}
  hammer(){if(!this.G.running||this.G.over)return;if(this.mode==='ham'){this.mode=null}else if(this.afford('ham'))this.mode='ham';else this.G.audio.tone(150,.2,'square')}
  useHammer(c,r){const G=this.G;if(!G.running||G.over||G.busy)return;const b=G.board.cell(c,r);if(!b)return;this.pay('ham');G.burst(c,r,b.v);G.board.g[c][r]=null;G.board.compact();this.mode=null;G.audio.merge(b.v);G.settle(null)}
  swap(){const G=this.G;if(!G.running||G.over||G.busy||!this.afford('swap'))return;this.pay('swap');[G.cur,G.next]=[G.next,G.cur];G.audio.click();G.ui()}
  undo(){const G=this.G;if(!G.running||G.over||G.busy||!G.prev||!this.afford('undo'))return;this.pay('undo');G.board.restore(G.prev.g);G.score=G.prev.score;G.cur=G.prev.cur;G.next=G.prev.next;G.prev=null;G.audio.click();G.ui()}
}
class Renderer{
  constructor(cv,game){this.cv=cv;this.G=game;this.ctx=cv.getContext('2d');this.parts=[];this.floats=[];this.shake=0;this.ft=16;this.hi=true;this.rz=0;this.resize();addEventListener('resize',()=>this.sz())}
  sz(){if(this.rz)return;this.rz=requestAnimationFrame(()=>{this.rz=0;this.resize()})}
  resize(){const st=this.cv.parentElement,w=st.clientWidth,h=st.clientHeight;this.cell=Math.floor(Math.min(w/COLS,(h-4)/ROWS));const d=devicePixelRatio||1;this.W=this.cell*COLS;this.H=this.cell*ROWS;this.cv.style.width=this.W+'px';this.cv.style.height=this.H+'px';this.cv.width=this.W*d;this.cv.height=this.H*d;this.d=d}
 rr(x,y,w,h,r){const c=this.ctx;c.beginPath();c.roundRect?c.roundRect(x,y,w,h,r):c.rect(x,y,w,h)}
  block(x,y,v,s=1,a=1){const c=this.ctx,m=3,w=this.cell-m*2,[c1,c2]=col(v);c.save();c.globalAlpha=a;c.translate(x+this.cell/2,y+this.cell/2);c.scale(s,s);
   const g=c.createLinearGradient(0,-w/2,0,w/2);g.addColorStop(0,c1);g.addColorStop(1,c2);if(this.hi){c.shadowColor='rgba(0,0,0,.5)';c.shadowBlur=6;c.shadowOffsetY=2}c.fillStyle=g;this.rr(-w/2,-w/2,w,w,10);c.fill();c.shadowColor='transparent';
  c.fillStyle='rgba(255,255,255,.18)';this.rr(-w/2+3,-w/2+3,w-6,w/4,6);c.fill();
  c.fillStyle='#fff';c.font=`800 ${Math.floor(w*(String(v).length>3?.34:String(v).length>2?.42:.5))}px "Trebuchet MS",sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(v,0,2);c.restore()}
  draw(dt){const c=this.ctx,G=this.G,B=G.board,cs=this.cell;this.ft=this.ft*.92+dt*1000*.08;this.hi=this.ft<21;c.setTransform(this.d,0,0,this.d,0,0);c.clearRect(0,0,this.W,this.H);
  c.save();if(this.shake>0){c.translate((Math.random()-.5)*this.shake*6,0);this.shake=Math.max(0,this.shake-dt*5)}
  for(let i=0;i<COLS;i++){c.fillStyle=(i===G.sel&&!G.over)?'#23252e':'#15161b';this.rr(i*cs+3,0,cs-6,this.H,10);c.fill()}
  if(G.sel>=0&&!G.over&&!G.busy&&G.pw.mode!=='ham'){const [c1]=col(G.cur);c.globalAlpha=.25;c.fillStyle=c1;this.rr(G.sel*cs+3,0,cs-6,this.H,10);c.fill();c.globalAlpha=1}
  for(let i=0;i<COLS;i++)B.g[i].forEach((b,r)=>{if(!b)return;b.y+=(b.r-b.y)*Math.min(1,dt*18);if(b.pop>0)b.pop=Math.max(0,b.pop-dt*5);const s=1+Math.sin(b.pop*Math.PI)*.22;
   if(G.pw.mode==='ham'){c.save();c.translate(0,0)}this.block(i*cs,b.y*cs,b.v,s);if(G.pw.mode==='ham')c.restore()});
  if(G.fly)this.block(G.fly.c*cs,G.fly.y*cs,G.fly.v);
  this.parts=this.parts.filter(p=>(p.l-=dt)>0);this.parts.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=500*dt;c.globalAlpha=Math.max(0,p.l*2);c.fillStyle=p.c;c.fillRect(p.x,p.y,p.s,p.s)});c.globalAlpha=1;
  this.floats=this.floats.filter(f=>(f.l-=dt)>0);this.floats.forEach(f=>{f.y-=40*dt;c.globalAlpha=Math.min(1,f.l*2);c.fillStyle='#fff';c.font='800 18px sans-serif';c.textAlign='center';c.fillText('+'+f.t,f.x,f.y)});c.globalAlpha=1;
  c.restore()}
}
class Game{
 constructor(){this.st=new StorageManager();this.audio=new AudioManager(this.st);this.board=new Board();this.pw=new PowerUpManager(this);
  this.best=this.st.get('best',0);this.coins=this.st.get('coins',500);this.$=id=>document.getElementById(id);
 this.rend=new Renderer(this.$('cv'),this);this.sel=-1;this.running=false;this.over=true;this.busy=false;this.fly=null;this._pt=0;
 new InputManager(this);this.bind();this.ui();this.loop();
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.running&&!this.over)this.show('paused')});
 const CP=window.Capacitor&&window.Capacitor.Plugins;
 if(CP&&CP.App)CP.App.addListener('backButton',()=>{
  const o=document.querySelector('.ov.show');
  if(!o){if(this.running&&!this.over)this.show('paused');else CP.App.exitApp();return}
  if(o.id==='paused')this.show(null);
  else if(o.id==='how'||o.id==='set')this.show('menu');
  else CP.App.exitApp()
 })}
 save(){this.st.set('best',this.best);this.st.set('coins',this.coins)}
 pick(){const mx=this.maxV||2;this.count=(this.count||0)+1;
  if(mx>=8&&this.count%5===0){const hi=Math.max(8,mx/2),o=[];for(let v=8;v<=hi;v*=2)o.push(v);return o[Math.random()*o.length|0]} // every 5th block: 8 up to half the biggest number
  const p=[2,2,4,4];if(mx>=32)p.push(8);return p[Math.random()*p.length|0]}
 start(){this.board.reset();this.score=0;this.over=false;this.running=true;this.busy=false;this.fly=null;this.prev=null;this.pw.mode=null;this.maxV=2;this.count=0;this.cur=this.pick();this.next=this.pick();this.sel=2;this.show(null);this.ui()}
 show(id){document.querySelectorAll('.ov').forEach(o=>o.classList.toggle('show',o.id===id))}
 ui(){this.$('score').textContent=this.score|0;this.$('best').textContent=this.best;this.$('coins').textContent=this.coins;this.$('mbest').textContent=this.best;
  const cu=this.$('cur'),[a,b]=col(this.cur||2);cu.textContent=this.cur||2;cu.style.background=`linear-gradient(${a},${b})`;
  this.$('nxt').textContent=this.next||2;this.$('pHam').classList.toggle('on',this.pw.mode==='ham');
  this.$('tSnd').textContent=this.audio.on?'ON':'OFF';this.$('tVib').textContent=this.audio.vib?'ON':'OFF'}
 shoot(c){
  if(!this.running||this.busy||this.over)return;
  if(this.pw.mode==='ham'){return}
  if(this.board.free(c)===0){this.rend.shake=1;this.audio.tone(120,.15,'square');this.audio.buzz(30);return}
  this.busy=true;this.prev={g:this.board.snapshot(),score:this.score,cur:this.cur,next:this.next};
  const r=this.board.g[c].length,v=this.cur;this.fly={c,y:ROWS,v};this.audio.drop();
  const t0=performance.now(),dur=140+r*0;
  const step=now=>{const k=Math.min(1,(now-t0)/dur),e=1-Math.pow(1-k,2);this.fly.y=ROWS+(r-ROWS)*e;
   if(k<1)return requestAnimationFrame(step);
   this.fly=null;const b=new Block(v,r);b.pop=.6;this.board.g[c].push(b);this.settle([c,r],true)};
  requestAnimationFrame(step)}
 settle(pref,advance){
  const cs=this.rend.cell;let combo=0;
  const loop=()=>{const m=this.board.mergeOnce(pref);
   if(!m){return this.finish(advance)}
    combo++;this.score+=m.nv;this.maxV=Math.max(this.maxV,m.nv);this.coinsGain(m.nv);
    const sc=this.$('score');sc.classList.add('pop');clearTimeout(this._pt);this._pt=setTimeout(()=>sc.classList.remove('pop'),120);
    this.burst(m.tc,m.tr,m.nv);this.rend.floats.push({x:m.tc*cs+cs/2,y:m.tr*cs+cs/2,t:m.nv,l:.9});
   m.nv>=64?this.audio.big():this.audio.merge(m.nv);
   if(this.score>this.best){this.best=this.score}
   pref=[m.tc,m.tr];this.ui();setTimeout(loop,150)};
  loop()}
  coinsGain(v){if(v>=32){this.coins+=Math.log2(v)|0}}
  burst(c,r,v){const cs=this.rend.cell,hi=this.rend.hi,n=v>=64?(hi?30:14):(hi?10:5),[a]=col(v);for(let i=0;i<n;i++){const an=Math.random()*6.28,sp=80+Math.random()*220;this.rend.parts.push({x:c*cs+cs/2,y:r*cs+cs/2,vx:Math.cos(an)*sp,vy:Math.sin(an)*sp-80,l:.5+Math.random()*.4,s:3+Math.random()*4,c:Math.random()<.5?a:'#fff'})}}
 finish(advance){
  this.save();
  if(advance){this.cur=this.next;this.next=this.pick()}
  this.busy=false;this.ui();
  if(this.board.full())this.end()}
 end(){this.over=true;this.running=false;this.save();this.audio.over();this.rend.shake=1.5;
  this.$('fs').textContent=this.score;this.$('fb').textContent=this.best;setTimeout(()=>this.show('over'),700)}
 bind(){
  const A={play:()=>this.start(),how:()=>this.show('how'),set:()=>this.show('set'),menu:()=>{this.running=false;this.ui();this.show('menu')},resume:()=>this.show(null),restart:()=>this.start(),
   share:()=>{const t=`I scored ${this.score} in 2048!`;navigator.share?navigator.share({text:t}).catch(()=>{}):navigator.clipboard&&navigator.clipboard.writeText(t)}};
  document.querySelectorAll('[data-a]').forEach(b=>b.addEventListener('click',()=>{this.audio.click();A[b.dataset.a]()}));
  this.$('pause').onclick=()=>{if(this.running){this.audio.click();this.show('paused')}};
  this.$('pHam').onclick=()=>{if(this.busy||!this.running)return;this.audio.click();this.pw.hammer();this.ui()};
  this.$('pSwap').onclick=()=>this.pw.swap();
  this.$('pUndo').onclick=()=>this.pw.undo();
  this.$('tSnd').onclick=()=>{this.audio.on=!this.audio.on;this.st.set('snd',this.audio.on);this.audio.click();this.ui()};
  this.$('tVib').onclick=()=>{this.audio.vib=!this.audio.vib;this.st.set('vib',this.audio.vib);this.audio.buzz(30);this.ui()};
  this.$('rst').onclick=()=>{this.best=0;this.save();this.ui()};
 }
  loop(){let l=performance.now();const f=n=>{const dt=Math.min(.05,(n-l)/1000);l=n;if(!document.hidden)this.rend.draw(dt);requestAnimationFrame(f)};requestAnimationFrame(f)}
}
class InputManager{
  constructor(G){const cv=G.$('cv'),pos=e=>{const r=cv.getBoundingClientRect();return[Math.max(0,Math.min(COLS-1,Math.floor((e.clientX-r.left)/(r.width/COLS)))),Math.floor((e.clientY-r.top)/G.rend.cell)]};
   cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);const[c]=pos(e);G.sel=c;G.down=true;G.audio.unlock()});
   cv.addEventListener('pointermove',e=>{if(G.down||e.pointerType==='mouse')G.sel=pos(e)[0]});
   cv.addEventListener('pointerup',e=>{G.down=false;const[c,r]=pos(e);G.sel=c;
    if(G.pw.mode==='ham'&&!G.busy){G.pw.useHammer(c,r);G.ui();return}
    G.shoot(c)});
   cv.addEventListener('contextmenu',e=>e.preventDefault());
   addEventListener('keydown',e=>{if(e.repeat)return;if(e.key==='ArrowLeft')G.sel=Math.max(0,G.sel-1);if(e.key==='ArrowRight')G.sel=Math.min(COLS-1,G.sel);if(e.key===' '||e.key==='Enter')G.shoot(G.sel)})}
}
window.game=new Game();