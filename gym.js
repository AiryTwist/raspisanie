/* Сгенерировано gimnastika/build_app.py — не править вручную */
/* Фигурка-манекен в стиле силуэтов учебника.
   Позу задаём направлениями частей тела (как в определениях учебника), рисуем на canvas.
   Оси: x — вправо от гимнаста, y — вверх, z — вперёд (куда смотрит гимнаст).
   Руки задаются относительно туловища, ноги — относительно таза (так и в учебнике:
   «положения рук определяются относительно туловища»).
   Слова направлений: up down fwd back out in (out/in — от тела/к телу, для левой руки зеркально),
   right left (абсолютно). Можно складывать: "down+0.3back". Префикс W: — в мировых осях. */
(function(){
const LEN = {head:10.5, neck:5, torso:50, sh:14, hip:7.5, ua:29, fa:25, hand:9, th:43, shin:41, foot:14, ankle:3};
const WID = {torso:17, torsoEdge:9, neck:8, ua:8, fa:6.2, hand:5, th:12.5, shin:8.6, foot:5.6};
const rad = d => d*Math.PI/180;
const V = {
  add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]], sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],
  mul:(a,k)=>[a[0]*k,a[1]*k,a[2]*k], dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
  len:a=>Math.hypot(a[0],a[1],a[2]), norm:a=>{const l=Math.hypot(a[0],a[1],a[2])||1; return [a[0]/l,a[1]/l,a[2]/l];},
  cross:(a,b)=>[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
};
// матрицы 3×3 (массив строк)
const M = {
  I:()=>[[1,0,0],[0,1,0],[0,0,1]],
  mul:(A,B)=>A.map(r=>[0,1,2].map(j=>r[0]*B[0][j]+r[1]*B[1][j]+r[2]*B[2][j])),
  ap:(A,v)=>A.map(r=>r[0]*v[0]+r[1]*v[1]+r[2]*v[2]),
  rx:a=>{const c=Math.cos(rad(a)),s=Math.sin(rad(a)); return [[1,0,0],[0,c,-s],[0,s,c]];},   // + : верх наклоняется вперёд
  ry:a=>{const c=Math.cos(rad(a)),s=Math.sin(rad(a)); return [[c,0,s],[0,1,0],[-s,0,c]];},   // + : поворот направо
  rz:a=>{const c=Math.cos(rad(a)),s=Math.sin(rad(a)); return [[c,s,0],[-s,c,0],[0,0,1]];},   // + : наклон вправо
};
const rot = o => { o=o||{}; return M.mul(M.mul(M.ry(o.yaw||0), M.rz(o.roll||0)), M.rx(o.pitch||0)); };
const BASE = {up:[0,1,0],down:[0,-1,0],fwd:[0,0,1],back:[0,0,-1],right:[1,0,0],left:[-1,0,0]};
function dir(spec, side){   // side: +1 правая, -1 левая
  let v=[0,0,0];
  String(spec).split("+").forEach(t=>{ t=t.trim(); if(!t) return; const m=t.match(/^(-?[\d.]+)?\*?([a-z]+)$/); if(!m) throw new Error("dir "+spec);
    const k=m[1]===undefined?1:parseFloat(m[1]); let b;
    if(m[2]==="out") b=[side,0,0]; else if(m[2]==="in") b=[-side,0,0]; else b=BASE[m[2]];
    if(!b) throw new Error("dir "+spec); v=V.add(v,V.mul(b,k)); });
  return V.norm(v);
}
const mirror = (p,side) => [p[0]*side,p[1],p[2]];
// направление в нужной системе: "W:..." — мировые оси, иначе — оси части тела R
function wdir(spec, side, R){ if(String(spec).startsWith("W:")) return dir(spec.slice(2), side); return M.ap(R, dir(spec, side)); }

function ik(S, T, a, b, pole){   // два звена: плечо S, цель T, длины a,b, куда смотрит локоть
  let d=V.sub(T,S), L=V.len(d); const maxL=(a+b)*0.999; if(L>maxL){ d=V.mul(V.norm(d),maxL); L=maxL; }
  const u=V.norm(d), x=(a*a-b*b+L*L)/(2*L), h=Math.sqrt(Math.max(0,a*a-x*x));
  let p=V.sub(pole, V.mul(u, V.dot(pole,u))); if(V.len(p)<1e-6) p=[0,0,1]; p=V.norm(p);
  return V.add(S, V.add(V.mul(u,x), V.mul(p,h)));
}

// построить скелет: точки и отрезки по группам
function build(P){
  const Rp = rot(P.body);                      // таз
  const Rt = M.mul(Rp, rot(P.torso));          // поясница
  const arch = (P.torso||{}).arch || 0;        // грудной отдел: + наклон вперёд, − прогиб назад (относительно поясницы)
  const Rc = M.mul(Rt, M.rx(arch));            // грудь (от неё — руки и голова)
  const Rh = M.mul(Rc, rot(P.head));           // голова
  const hip=[0,0,0], up=M.ap(Rt,[0,1,0]), lat=M.ap(Rt,[1,0,0]), upC=M.ap(Rc,[0,1,0]), latC=M.ap(Rc,[1,0,0]);
  const WL = LEN.torso*0.45;
  const waist=V.add(hip,V.mul(up,WL));
  const shC=V.add(waist, V.mul(upC, LEN.torso-WL));
  const G = {torso:[], arms:{R:[],L:[]}, legs:{R:[],L:[]}, roots:{}};
  const seg=(arr,a,b,w,cap)=>arr.push({a,b,w,cap});
  // туловище: два четырёхугольника (грудь и поясница) + «позвоночник» из двух звеньев
  const shR=V.add(shC,V.mul(latC,LEN.sh)), shL=V.add(shC,V.mul(latC,-LEN.sh));
  const latP=M.ap(Rp,[1,0,0]);
  const hR=V.add(hip,V.mul(latP,LEN.hip+2.5)), hL=V.add(hip,V.mul(latP,-LEN.hip-2.5));
  const wR=V.add(waist,V.mul(lat,8.5)), wL=V.add(waist,V.mul(lat,-8.5));
  G.torso.push({poly:[V.add(shR,V.mul(upC,-3)),V.add(shL,V.mul(upC,-3)),wL,wR], w:WID.torsoEdge});
  G.torso.push({poly:[wR,wL,hL,hR], w:WID.torsoEdge});
  seg(G.torso, V.add(hip,V.mul(up,4)), waist, WID.torso);
  seg(G.torso, waist, V.add(shC,V.mul(upC,-4)), WID.torso);
  // шея и голова
  const hup=M.ap(Rh,[0,1,0]), hfw=M.ap(Rh,[0,0,1]);
  const neckTop=V.add(shC, V.mul(hup, LEN.neck));
  seg(G.torso, shC, neckTop, WID.neck);
  const hc=V.add(neckTop, V.mul(hup, LEN.head*0.95));
  G.torso.push({circle:hc, r:LEN.head});
  G.torso.push({circle:V.add(V.add(hc,V.mul(hfw,LEN.head*0.92)),V.mul(hup,-2)), r:2.6});   // нос — видно, куда смотрит голова
  G.roots.torso=[shR,shL,hR,hL];
  // руки
  for(const s of ["R","L"]){
    const side=s==="R"?1:-1, S=s==="R"?shR:shL, A=(P.arms||{})[s]||(P.arms||{}).both||{ua:"down+0.08out",fa:"down+0.1out"};
    let E,W,Hd;
    if(A.hand){   // цель кисти в осях туловища (от середины таза)
      const hv=mirror(A.hand,side); const T=V.add(waist, M.ap(Rc, [hv[0], hv[1]-WL, hv[2]]));
      E=ik(S,T,LEN.ua,LEN.fa+LEN.hand*0.5, wdir(A.pole||"out",side,Rc));
      const fd=V.norm(V.sub(T,E)); W=V.add(E,V.mul(fd,LEN.fa)); Hd=V.add(W,V.mul(fd,LEN.hand*0.8));
    } else {
      E=V.add(S, V.mul(wdir(A.ua,side,Rc), LEN.ua));
      const fd=wdir(A.fa||A.ua,side,Rc); W=V.add(E,V.mul(fd,LEN.fa));
      Hd=V.add(W,V.mul(A.hd?wdir(A.hd,side,Rc):fd, LEN.hand));
    }
    const g=G.arms[s]; seg(g,S,E,WID.ua); seg(g,E,W,WID.fa); seg(g,W,Hd,WID.hand);
    G.roots["arm"+s]=[S]; G["hand"+s]=V.add(W,V.mul(V.sub(Hd,W),0.45));
  }
  // ноги
  for(const s of ["R","L"]){
    const side=s==="R"?1:-1, Hh=V.add(hip, V.mul(latP, LEN.hip*side));
    const Lg=(P.legs||{})[s]||(P.legs||{}).both||{};
    const K=V.add(Hh, V.mul(wdir(Lg.th||"down",side,Rp), LEN.th));
    const shd=wdir(Lg.sh||Lg.th||"down",side,Rp);
    const A=V.add(K, V.mul(shd, LEN.shin));
    let fd = Lg.ft==="point" ? shd : wdir(Lg.ft||"fwd+0.12down",side,Rp);
    const T=V.add(A, V.mul(fd, LEN.foot));
    const g=G.legs[s]; seg(g,Hh,K,WID.th); seg(g,K,A,WID.shin); seg(g,A,T,WID.foot);
    g.push({circle:V.add(A,V.mul(shd,-1)), r:WID.shin*0.55});
    G.roots["leg"+s]=[Hh];
    G["feet"+s]=[A,T];
  }
  G.hip=hip; G.headC=hc;
  return G;
}

// проекция: view — угол обзора (0 — спереди, -90 — сбоку, гимнаст смотрит вправо)
function projector(view, tilt){   // tilt — взгляд сверху (градусы): 0 — сбоку, 30 — немного сверху, 90 — вид сверху
  const R=M.mul(M.rx(tilt||0), M.ry(view||0));
  return p=>{ const q=M.ap(R,p); return {x:-q[0], y:-q[1], z:q[2]}; };
}

function groupsOf(G){
  return [["torso",G.torso,G.roots.torso],["armR",G.arms.R,G.roots.armR],["armL",G.arms.L,G.roots.armL],["legR",G.legs.R,G.roots.legR],["legL",G.legs.L,G.roots.legL]];
}
function bboxOf(G, pr){
  let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
  const pt=(p,r)=>{const q=pr(p); x0=Math.min(x0,q.x-r); x1=Math.max(x1,q.x+r); y0=Math.min(y0,q.y-r); y1=Math.max(y1,q.y+r);};
  groupsOf(G).forEach(([,items])=>items.forEach(it=>{ if(it.circle) pt(it.circle,it.r); else if(it.poly) it.poly.forEach(p=>pt(p,it.w/2)); else {pt(it.a,it.w/2); pt(it.b,it.w/2);} }));
  return {x0,x1,y0,y1};
}
// «пол»: самая низкая точка ног и таза (руки и голова могут быть ниже только если опираются)
function floorOf(G, pr, all){
  let y=-1e9; const t=p=>{ y=Math.max(y, pr(p).y); };
  if(all){ groupsOf(G).forEach(([,items])=>items.forEach(it=>{ if(it.circle) t(V.add(it.circle,[0,-it.r,0])); else if(!it.poly){t(it.a);t(it.b);} })); return y; }
  [...G.legs.R, ...G.legs.L].forEach(it=>{ if(!it.circle){t(it.a);t(it.b);} });
  t(V.add(G.hip,[0,-8,0]));
  return y;
}

function drawGroup(ctx, items, pr, extra, mode){
  ctx.lineCap="round"; ctx.lineJoin="round";
  for(const it of items){
    if(it.circle){ const q=pr(it.circle); ctx.beginPath(); ctx.arc(q.x,q.y,it.r+extra,0,Math.PI*2); ctx.fill(); }
    else if(it.poly){ ctx.beginPath(); it.poly.forEach((p,i)=>{const q=pr(p); i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);}); ctx.closePath(); ctx.lineWidth=it.w+extra*2; ctx.stroke(); ctx.fill(); }
    else { const a=pr(it.a), b=pr(it.b); ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.lineWidth=it.w+extra*2; ctx.stroke(); }
  }
}

// ---------- позы из описания ----------
// строка "ноги|руки|ракурс" или объект {base, arm, view, body, torso, head, legs, arms, lift, at:[dx,dz], props:[…]}
function mergeLimbs(base, over){
  const exp = o => { o=o||{}; return {R:Object.assign({}, o.both||{}, o.R||{}), L:Object.assign({}, o.both||{}, o.L||{})}; };
  const b=exp(base), r={R:b.R, L:b.L}; if(!over) return r;
  const o=over;
  if(o.both){ r.R=Object.assign({}, r.R, o.both); r.L=Object.assign({}, r.L, o.both); }
  if(o.R) r.R=Object.assign({}, r.R, o.R); if(o.L) r.L=Object.assign({}, r.L, o.L);
  return r;
}
function resolve(spec){
  if(typeof spec==="string"){ const [leg, arm, view]=spec.split("|"); return pose(leg, arm||undefined, view!==undefined && view!=="" ? {view:+view} : {}); }
  const P = spec.base ? pose(spec.base, spec.arm||undefined) : {view:0, legs:{both:{th:"down",sh:"down"}}, arms:ARMS[spec.arm||"down"]};
  const R = Object.assign({}, P);
  ["view","tilt","lift","floorAll","props","at"].forEach(k=>{ if(spec[k]!==undefined) R[k]=spec[k]; });
  ["body","torso","head"].forEach(k=>{ if(spec[k]) R[k]=Object.assign({}, P[k]||{}, spec[k]); });
  if(spec.legs) R.legs=mergeLimbs(P.legs, spec.legs);
  if(spec.arms) R.arms=mergeLimbs(P.arms, spec.arms);
  return R;
}
// сдвинуть все точки скелета (каждый массив-точку — один раз)
function moveG(G, d){
  const seen=new Set();
  const walk=o=>{ if(!o || typeof o!=="object") return;
    if(Array.isArray(o) && o.length===3 && o.every(v=>typeof v==="number")){ if(!seen.has(o)){ seen.add(o); o[0]+=d[0]; o[1]+=d[1]; o[2]+=d[2]; } return; }
    (Array.isArray(o)?o:Object.values(o)).forEach(walk); };
  walk(G);
}
// ---------- снаряды и предметы (контуром, как в учебнике) ----------
function anchorOf(G, a){
  if(Array.isArray(a)) return V.add(G.hip, a);
  const mid=(p,q)=>V.mul(V.add(p,q),0.5);
  switch(a){
    case "handR": return G.handR; case "handL": return G.handL; case "hands": return mid(G.handR, G.handL);
    case "footR": return G.feetR[0]; case "footL": return G.feetL[0]; case "feet": return mid(G.feetR[0], G.feetL[0]);
    case "head": return G.headC; default: return G.hip;
  }
}
// детали снаряда в мировых осях: {seg:[p,q], w} или {circle:p, r, axis} или {toFloor:p}
function propParts(G, pr){
  const out=[], L=(a,b,w)=>out.push({seg:[a,b], w:w||2.2}), add=V.add, ax=n=>n==="z"?[0,0,1]:n==="y"?[0,1,0]:[1,0,0];
  let floorY=null;
  (G.props||[]).forEach(p=>{
    const A=add(anchorOf(G, p.at||"hip"), [p.dx||0, p.dy||0, p.dz||0]);
    if(p.floor!==undefined) floorY=A[1]-p.floor;
    const box=(c,sx,sy,sz,w)=>{ const v=[]; for(const i of [-1,1]) for(const j of [-1,1]) for(const k of [-1,1]) v.push(add(c,[i*sx/2,j*sy/2,k*sz/2]));
      [[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]].forEach(([a,b])=>L(v[a],v[b],w||1.8)); };
    const legsTo=(pts)=>pts.forEach(q=>out.push({toFloor:q, w:2}));
    const t=p.type;
    if(t==="bar"){ const d=V.mul(ax(p.axis||"x"), (p.len||110)/2); out.push({bar:[V.sub(A,d), add(A,d)], w:3.6}); if(p.posts!==false) legsTo([V.sub(A,d), add(A,d)]); }
    else if(t==="bars"){   // параллельные брусья: две жерди вдоль оси z
      const sep=(p.sep||44)/2, d=V.mul(ax(p.axis||"z"), (p.len||170)/2), s2=V.mul(ax(p.axis==="x"?"z":"x"), sep);
      [add(A,s2), V.sub(A,s2)].forEach(c=>{ out.push({bar:[V.sub(c,d), add(c,d)], w:3.2}); if(p.posts!==false) legsTo([add(V.sub(c,d),V.mul(d,0.25)), V.sub(add(c,d),V.mul(d,0.25))]); }); }
    else if(t==="uneven"){   // брусья разной высоты: нижняя жердь у опоры, верхняя — dyHigh выше и dzHigh в сторону
      const d=V.mul(ax("x"), (p.len||120)/2), hi=add(A,[0,p.dyHigh||60,p.dzHigh||-60]);
      [A,hi].forEach(c=>{ out.push({bar:[V.sub(c,d), add(c,d)], w:3.2}); legsTo([V.sub(c,d), add(c,d)]); }); }
    else if(t==="ring"||t==="rings"){
      const hs = t==="rings" ? [G.handR, G.handL] : [A];
      hs.forEach(h=>{ out.push({circle:add(h,[0,3,0]), r:6.5, w:1.8}); L(add(h,[0,9.5,0]), add(h,[0,p.strap||80,0]), 1.6); }); }
    else if(t==="beam"){ const len=p.len||220, hh=p.h||9; const c=add(A,[0,-hh/2,0]); box(c, p.axis==="x"?len:10, hh, p.axis==="x"?10:len, 2);
      const e=V.mul(ax(p.axis==="x"?"x":"z"), len*0.38); legsTo([add(add(A,[0,-hh,0]),e), add(V.sub(A,e),[0,-hh,0])]); }
    else if(t==="horse"||t==="vault"){ const len=p.len||150, hh=p.h||30, w=p.w||34; const c=add(A,[0,-hh/2,0]); box(c, p.axis==="x"?len:w, hh, p.axis==="x"?w:len, 2);
      if(t==="horse"){ [-1,1].forEach(k=>{ const q=add(A, V.mul(ax(p.axis==="x"?"x":"z"), k*20)); L(q, add(q,[0,9,0]), 2); L(add(q,[0,9,-6]), add(q,[0,9,6]), 2.4); }); }
      const e=V.mul(ax(p.axis==="x"?"x":"z"), len*0.36); legsTo([add(add(A,[0,-hh,0]),e), add(V.sub(A,e),[0,-hh,0])]); }
    else if(t==="box"){ const n=p.n||4, hh=(p.h||100)/n, len=p.len||110, w=p.w||40; for(let i=0;i<n;i++){ const sh=(n-1-i)*4; box(add(A,[0,-hh*(i+0.5),0]), w+sh, hh, len+sh, 1.6); } }
    else if(t==="bench"){ const len=p.len||200, hh=p.h||28; box(add(A,[0,-3,0]), p.axis==="x"?len:24, 6, p.axis==="x"?24:len, 1.8);
      const e=V.mul(ax(p.axis==="x"?"x":"z"), len*0.4); legsTo([add(add(A,[0,-6,0]),e), add(V.sub(A,e),[0,-6,0])]); }
    else if(t==="wall"){   // гимнастическая стенка позади: стойки и перекладины
      const w=p.w||70, h=p.h||300, base=add(A,[0,0,p.dz||-18]); const bot=add(base,[0,-(p.down||110),0]);
      [-1,1].forEach(k=>L(add(bot,[k*w/2,0,0]), add(bot,[k*w/2,h,0]), 2.2));
      for(let y=12;y<h;y+=17) L(add(bot,[-w/2,y,0]), add(bot,[w/2,y,0]), 1.3); }
    else if(t==="mat"){ box(add(A,[0,-3,0]), p.w||90, 6, p.len||160, 1.4); }
    else if(t==="bridge"){ const c=add(A,[0,-6,0]); L(add(c,[0,-6,-40]), add(c,[0,8,40]), 2.4); L(add(c,[0,-6,-40]), add(c,[0,-6,40]), 2); }
    else if(t==="stick"){ const a=add(G.handR,[0,0,0]), b=add(G.handL,[0,0,0]), d=V.norm(V.sub(b,a)), ext=p.ext||18; out.push({bar:[V.sub(a,V.mul(d,ext)), add(b,V.mul(d,ext))], w:3}); }
    else if(t==="ball"){ out.push({circle:A, r:p.r||11, w:2, ball:1}); }
    else if(t==="hoop"){   // обруч: plane "front" (лицом к зрителю, по умолчанию), "side" (сбоку), "flat" (горизонтально)
      const r=p.r||40, pl=p.plane||"front";
      if(pl==="front") out.push({circle:A, r, w:2.4});
      else { const pts=[]; for(let i=0;i<=32;i++){ const a=i/32*Math.PI*2, c=Math.cos(a)*r, s2=Math.sin(a)*r; pts.push(add(A, pl==="side"?[0,s2,c]:[c,0,s2])); } for(let i=0;i<32;i++) L(pts[i],pts[i+1],2.2); } }
    else if(t==="line"){
      if(p.from) L(add(G.hip,p.from), add(G.hip,p.to), p.w||1.8);
      else { const d=V.norm(dir(p.dir||"fwd",1)); L(A, add(A,V.mul(d,p.len||30)), p.w||2.4); } }
    else if(t==="rope"){   // скакалка: дуга от кисти к кисти через точку (по умолчанию — под стопами)
      const via = p.via ? add(G.hip,p.via) : add(V.mul(V.add(G.feetR[0],G.feetL[0]),0.5),[0,-6,0]);
      out.push({curve:[G.handR, via, G.handL], w:1.8}); }
    else if(t==="ribbon"){   // лента: палочка из кисти и волна
      const h=anchorOf(G, p.at||"handR"), dir=V.norm(p.dir||[0,1,0.3]), tip=add(h,V.mul(dir,22));
      L(h,tip,2); const len=p.len||120, sideV=[1,0,0];
      for(let i=0;i<6;i++){ const a=add(tip,V.mul(dir,len*i/6)), b2=add(tip,V.mul(dir,len*(i+1)/6)), m=add(V.mul(V.add(a,b2),0.5),V.mul(sideV,(i%2?1:-1)*14)); out.push({curve:[a,m,b2], w:1.6}); } }
    else if(t==="clubs"){   // булавы в кистях
      [G.handR, G.handL].forEach(h=>{ const d=V.norm(p.dir||[0,1,0]); L(h, add(h,V.mul(d,10)), 2); out.push({circle:add(h,V.mul(d,20)), r:5.5, w:1.8}); }); }
  });
  return {parts:out, floorY};
}

// ---------- схема сверху: строй, перестроения, следы ----------
const BALL_C="#E8762C";   // цвет мяча (слой мячей рисунка)
function drawScheme(spec, SC, BM){   // BM: "top" — мячи ещё раз сплошными поверх всего, "only" — только мячи (слой для цвета)
  const W=spec.w||200, H=spec.h||120, PAD=6;
  const cv=document.createElement("canvas"); cv.width=Math.ceil((W+PAD*2)*SC); cv.height=Math.ceil((H+PAD*2)*SC);
  const c=cv.getContext("2d"); c.strokeStyle="#000"; c.fillStyle="#000"; c.lineCap="round"; c.lineJoin="round";
  const P=([x,y])=>[(x+PAD)*SC,(y+PAD)*SC];
  const head=(a,b,sz)=>{ const ang=Math.atan2(b[1]-a[1], b[0]-a[0]), s=(sz||6)*SC; c.beginPath(); c.moveTo(b[0],b[1]); c.lineTo(b[0]-s*Math.cos(ang-0.45), b[1]-s*Math.sin(ang-0.45)); c.lineTo(b[0]-s*Math.cos(ang+0.45), b[1]-s*Math.sin(ang+0.45)); c.closePath(); c.fill(); };
  const ballDot=it=>{ const [x,y]=P(it.ball), r=(it.r||3)*SC; c.setLineDash([]); c.beginPath(); c.arc(x,y,r+0.6*SC,0,Math.PI*2); c.fill(); };
  if(BM==="only"){ c.fillStyle=BALL_C; (spec.items||[]).forEach(it=>{ if(it.ball) ballDot(it); }); return cv; }
  (spec.items||[]).forEach(it=>{
    c.setLineDash(it.dash?[4*SC,3*SC]:[]);
    if(it.o && it.role==="t"){ const [x,y]=P(it.o), r=(it.r||7.5)*SC, d=(it.d||0)*Math.PI/180;   // учитель: квадрат, тёмная половина — спина, лицо — в сторону d
      c.save(); c.translate(x,y); c.rotate(d); c.lineWidth=1.8*SC; c.strokeRect(-r,-r,2*r,2*r); c.fillRect(-r,-r,r,2*r); c.restore();
      if(it.n){ c.font=`${9*SC}px sans-serif`; c.textAlign="center"; c.textBaseline="middle"; c.fillText(it.n, x, y+r+7*SC); }
    }
    else if(it.o){ const [x,y]=P(it.o), r=(it.r||6.5)*SC, d=(it.d||0)*Math.PI/180;   // человек сверху: кружок, тёмная половина — спина, лицо — в сторону d
      // role:"v" — водящий: залит целиком, прозрачная точка — куда смотрит; team:2 — другая команда: спина бледная (рисунки — маски, цвет только через прозрачность)
      c.lineWidth=1.6*SC; c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.stroke();
      if(it.role==="v"){ c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fill(); c.save(); c.globalCompositeOperation="destination-out"; c.beginPath(); c.arc(x+Math.cos(d)*r*0.45,y+Math.sin(d)*r*0.45,r*0.38,0,Math.PI*2); c.fill(); c.restore(); }
      else if(it.fill!=="none"){ c.save(); if(it.team===2) c.globalAlpha=0.35; c.beginPath(); c.arc(x,y,r,d+Math.PI/2,d+Math.PI*3/2); c.closePath(); c.fill(); c.restore(); }
      if(it.n){ c.fillStyle="#000"; c.font=`${9*SC}px sans-serif`; c.textAlign="center"; c.textBaseline="middle"; if(it.fill!=="none"){ c.save(); c.fillStyle="#000"; c.restore(); } c.fillText(it.n, x+(it.fill==="none"?0:0), y+r+7*SC); }
    }
    else if(it.arrow){ const pts=it.arrow.map(P); c.lineWidth=(it.w||1.6)*SC; c.beginPath(); pts.forEach((q,i)=>i?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1])); c.stroke(); if(it.head!==false) head(pts[pts.length-2], pts[pts.length-1]); if(it.both) head(pts[1], pts[0]); }
    else if(it.arc){ const [cx,cy,r,a0,a1]=it.arc, C=P([cx,cy]); c.lineWidth=(it.w||1.6)*SC; c.beginPath(); c.arc(C[0],C[1],r*SC,a0*Math.PI/180,a1*Math.PI/180, a1<a0); c.stroke();
      if(it.head!==false){ const e=a1*Math.PI/180, b=[C[0]+r*SC*Math.cos(e), C[1]+r*SC*Math.sin(e)], k=a1<a0?1:-1, a=[b[0]+k*Math.sin(e)*4*SC, b[1]-k*Math.cos(e)*4*SC]; head(a,b); } }
    else if(it.line){ const pts=it.line.map(P); c.lineWidth=(it.w||1.4)*SC; c.beginPath(); pts.forEach((q,i)=>i?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1])); c.stroke(); }
    else if(it.rect){ const [x,y,w,h]=it.rect, q=P([x,y]); c.lineWidth=(it.w||1.4)*SC; c.strokeRect(q[0],q[1],w*SC,h*SC); }
    else if(it.ball){ const [x,y]=P(it.ball), r=(it.r||3)*SC; c.lineWidth=1.2*SC; c.save(); c.globalAlpha=0.35; c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fill(); c.restore(); c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.stroke(); }
    else if(it.cone){ const [x,y]=P(it.cone), s=(it.r||6)*SC; c.lineWidth=1.6*SC; c.beginPath(); c.moveTo(x,y-s); c.lineTo(x+s*0.9,y+s*0.7); c.lineTo(x-s*0.9,y+s*0.7); c.closePath(); c.stroke(); }
    else if(it.flag){ const [x,y]=P(it.flag), s=(it.r||6)*SC; c.lineWidth=1.3*SC; c.beginPath(); c.moveTo(x,y+s); c.lineTo(x,y-s); c.stroke(); c.beginPath(); c.moveTo(x,y-s); c.lineTo(x+s*1.1,y-s*0.6); c.lineTo(x,y-s*0.2); c.closePath(); c.fill(); }
    else if(it.circle){ const [x,y,r]=it.circle, q=P([x,y]); c.lineWidth=(it.w||1.3)*SC; c.beginPath(); c.arc(q[0],q[1],r*SC,0,Math.PI*2); c.stroke(); }
    else if(it.text){ const q=P(it.at); c.font=`${it.bold?"bold ":""}${(it.size||10)*SC}px sans-serif`; c.textAlign=it.align||"center"; c.textBaseline="middle"; c.fillText(it.text,q[0],q[1]); }
    else if(it.foot){   // след стопы сверху: d — куда смотрит носок; w: full — с весом (залит), none — без веса, toe/heel — на носке/пятке
      const [x,y]=P(it.foot), L=(it.len||22)*SC, Wd=L*0.38;   // d — куда смотрит носок, как у человека: 0 — вправо, 90 — вниз
      c.save(); c.translate(x,y); c.rotate((it.d||0)*Math.PI/180+Math.PI/2); c.lineWidth=1.4*SC;
      const sole=()=>{ c.beginPath(); c.ellipse(0,-L*0.18,Wd*0.55,L*0.34,0,0,Math.PI*2); }, heel=()=>{ c.beginPath(); c.ellipse(0,L*0.32,Wd*0.42,L*0.17,0,0,Math.PI*2); };
      sole(); (it.w==="full"||it.w==="toe")?c.fill():c.stroke(); heel(); (it.w==="full"||it.w==="heel")?c.fill():c.stroke();
      c.restore(); if(it.n){ c.font=`${9*SC}px sans-serif`; c.textAlign="center"; c.textBaseline="middle"; c.fillText(it.n, x+(it.nx||12)*SC, y+(it.ny||0)*SC); }
      if(it.side){ c.font=`${7*SC}px sans-serif`; c.fillText(it.side, x-(it.nx||12)*SC, y); }
    }
  });
  c.setLineDash([]);
  if(BM==="top") (spec.items||[]).forEach(it=>{ if(it.ball) ballDot(it); });
  return cv;
}

// ---------- кадр: одна или несколько фигур со снарядами ----------
function buildFrame(spec){
  const specs = spec.figures ? spec.figures : [spec];
  const figs = specs.map(sp=>{ const P=resolve(sp), G=build(P); G.props=P.props||[]; if(P.lift) moveG(G,[0,P.lift,0]); if(P.at) moveG(G,[P.at[0]||0,0,P.at[1]||0]); return {P,G}; });
  const view = spec.view!==undefined ? spec.view : figs[0].P.view;
  const pr0 = projector(view, spec.tilt!==undefined ? spec.tilt : figs[0].P.tilt);
  let floor = -1e9, propFloor = null;
  const parts = [];
  figs.forEach(f=>{ floor=Math.max(floor, floorOf(f.G, pr0, f.P.floorAll) + (f.P.lift||0)); const pp=propParts(f.G); parts.push(...pp.parts); if(pp.floorY!==null) propFloor=pp.floorY; });
  if(propFloor!==null) floor = pr0([0,propFloor,0]).y;
  (spec.marks||[]).forEach(m=>{ const o=figs[0].G.hip, P=q=>V.add(o,q);
    if(m.arrow){ const pts=m.arrow.map(P); for(let i=0;i<pts.length-1;i++) parts.push({seg:[pts[i],pts[i+1]], w:m.w||1.5, dash:m.dash}); parts.push({head:[pts[pts.length-2],pts[pts.length-1]]}); }
    if(m.arc){ const c=P(m.arc.c||[0,0,0]), r=m.arc.r||30, a0=(m.arc.from||0)*Math.PI/180, a1=(m.arc.to||270)*Math.PI/180, pl=m.arc.plane||"front", n=24, pts=[];
      for(let i=0;i<=n;i++){ const a=a0+(a1-a0)*i/n, x=Math.cos(a)*r, y=Math.sin(a)*r; pts.push(V.add(c, pl==="side"?[0,y,x]:pl==="flat"?[x,0,y]:[x,y,0])); }
      for(let i=0;i<n;i++) parts.push({seg:[pts[i],pts[i+1]], w:m.w||1.5, dash:m.dash}); if(m.head!==false) parts.push({head:[pts[n-1],pts[n]]}); } });
  return {figs, view, pr0, floor, parts, caption: spec.caption, ground: spec.ground!==undefined ? spec.ground : figs.some(f=>(f.P.props||[]).length)};
}
function render(poses, opt){
  opt=opt||{}; const SC=opt.scale||2, GAP=16, PAD=4;
  if(!Array.isArray(poses)) poses=[poses];
  const frames = poses.map(sp=>{
    if(sp && sp.scheme) return {scheme:sp.scheme};
    const F=buildFrame(sp), fl=F.floor;
    const pr=p=>{const q=F.pr0(p); return {x:q.x, y:q.y-fl, z:q.z};};
    let bb={x0:1e9,x1:-1e9,y0:1e9,y1:-1e9}; const ext=(q,r)=>{ bb.x0=Math.min(bb.x0,q.x-r); bb.x1=Math.max(bb.x1,q.x+r); bb.y0=Math.min(bb.y0,q.y-r); bb.y1=Math.max(bb.y1,q.y+r); };
    F.figs.forEach(f=>{ const b=bboxOf(f.G,pr); ext({x:b.x0,y:b.y0},0); ext({x:b.x1,y:b.y1},0); });
    F.parts.forEach(p=>{ if(p.head) p.head.forEach(q=>ext(pr(q),6)); if(p.curve) p.curve.forEach(q=>ext(pr(q),3)); if(p.seg||p.bar) (p.seg||p.bar).forEach(q=>ext(pr(q),3)); else if(p.circle) ext(pr(p.circle), p.r+2); else if(p.toFloor){ const q=pr(p.toFloor); ext(q,2); ext({x:q.x,y:0},2); } });
    if(F.ground){ ext({x:bb.x0-6,y:0},1); ext({x:bb.x1+6,y:0},1); }
    if(F.caption){ const cw=String(F.caption).length*5.6; const cx=(bb.x0+bb.x1)/2; ext({x:cx-cw/2,y:bb.y1+16},0); ext({x:cx+cw/2,y:bb.y1+16},0); }
    return {F, pr, bb};
  });
  // схемы рисуем отдельными холстами и вставляем как кадры
  frames.forEach(f=>{ if(f.scheme){ f.cv=drawScheme(f.scheme, SC, opt.ball); f.bb={x0:0,x1:f.cv.width/SC,y0:-f.cv.height/SC,y1:0}; } });
  let W=0, top=0;
  frames.forEach(f=>{ f.ox=W-f.bb.x0; W+=f.bb.x1-f.bb.x0+GAP; top=Math.min(top,f.bb.y0); });
  W-=GAP; const bottom=Math.max(...frames.map(f=>f.bb.y1)), H=bottom-top;
  const cv=document.createElement("canvas"); cv.width=Math.ceil((W+PAD*2)*SC); cv.height=Math.ceil((H+PAD*2)*SC);
  const ctx=cv.getContext("2d"); ctx.fillStyle=opt.ball==="only"?BALL_C:"#000"; ctx.strokeStyle="#000"; ctx.lineCap="round"; ctx.lineJoin="round";
  // opt.ball: "top" — мяч поверх фигуры сплошным кругом (не прячется за телом), "only" — только мячи (второй слой рисунка, его красят отдельным цветом)
  const balls=f=>{ if(f.scheme) return; const pr=p=>{const q=f.pr(p); return {x:(q.x+f.ox+PAD)*SC, y:(q.y-top+PAD)*SC};};
    f.F.parts.forEach(p=>{ if(!p.ball) return; const q=pr(p.circle); ctx.beginPath(); ctx.arc(q.x,q.y,(p.r+1)*SC,0,Math.PI*2); ctx.fill(); }); };
  if(opt.ball==="only"){ frames.forEach(f=>{ if(f.scheme) ctx.drawImage(f.cv, (f.ox+f.bb.x0+PAD)*SC, (f.bb.y0-top+PAD)*SC); else balls(f); }); return cv; }
  frames.forEach(f=>{
    if(f.scheme){ ctx.drawImage(f.cv, (f.ox+f.bb.x0+PAD)*SC, (f.bb.y0-top+PAD)*SC); return; }
    const pr=p=>{const q=f.pr(p); return {x:(q.x+f.ox+PAD)*SC, y:(q.y-top+PAD)*SC, z:q.z};};
    // снаряды — тонким контуром, позади фигур
    f.F.parts.forEach(p=>{ ctx.lineWidth=(p.w||2)*SC;
      if(p.head){ const [a,b]=p.head.map(pr), ang=Math.atan2(b.y-a.y,b.x-a.x), hs=6*SC; ctx.beginPath(); ctx.moveTo(b.x,b.y); ctx.lineTo(b.x-hs*Math.cos(ang-0.45),b.y-hs*Math.sin(ang-0.45)); ctx.lineTo(b.x-hs*Math.cos(ang+0.45),b.y-hs*Math.sin(ang+0.45)); ctx.closePath(); ctx.fill(); return; }
      ctx.setLineDash(p.dash?[4*SC,3*SC]:[]);
      if(p.seg||p.bar){ const [a,b]=(p.seg||p.bar).map(pr); if(p.bar && Math.hypot(a.x-b.x,a.y-b.y)<3*SC){ ctx.beginPath(); ctx.arc(a.x,a.y,2.6*SC,0,Math.PI*2); ctx.fill(); } else { ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); } }
      else if(p.circle){ const q=pr(p.circle); ctx.beginPath(); ctx.arc(q.x,q.y,p.r*SC,0,Math.PI*2); ctx.stroke(); }
      else if(p.curve){ const [a,m,b]=p.curve.map(pr); ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.quadraticCurveTo(2*m.x-(a.x+b.x)/2, 2*m.y-(a.y+b.y)/2, b.x, b.y); ctx.stroke(); }
      else if(p.toFloor){ const q=pr(p.toFloor); ctx.beginPath(); ctx.moveTo(q.x,q.y); ctx.lineTo(q.x,(0-top+PAD)*SC); ctx.stroke(); } });
    ctx.setLineDash([]);
    if(f.F.caption){ ctx.save(); ctx.font=`${10*SC}px sans-serif`; ctx.textAlign="center"; ctx.textBaseline="bottom"; ctx.fillText(String(f.F.caption), ((f.bb.x0+f.bb.x1)/2+f.ox+PAD)*SC, (f.bb.y1-top+PAD)*SC); ctx.restore(); }
    if(f.F.ground){ ctx.lineWidth=1.6*SC; ctx.beginPath(); ctx.moveTo((f.bb.x0+f.ox+PAD)*SC,(0-top+PAD)*SC); ctx.lineTo((f.bb.x1+f.ox+PAD)*SC,(0-top+PAD)*SC); ctx.stroke(); }
    f.F.figs.forEach(fig=>{
      const sc=it=>it.circle?{circle:it.circle,r:it.r*SC}:it.poly?{poly:it.poly,w:it.w*SC}:{a:it.a,b:it.b,w:it.w*SC};
      const groups=groupsOf(fig.G).map(([name,items,roots])=>{ let z=0,n=0; items.forEach(it=>{ (it.circle?[it.circle]:it.poly?it.poly:[it.a,it.b]).forEach(p=>{z+=f.pr(p).z;n++;}); });
        return {name, items:items.map(sc), roots, z:z/n + (name==="torso"?0.01:0)}; }).sort((a,b)=>a.z-b.z);
      groups.forEach(g=>{
        ctx.save(); ctx.globalCompositeOperation="destination-out";   // тонкий просвет между частью тела и тем, что за ней (и снарядом)
        ctx.beginPath(); ctx.rect(0,0,cv.width,cv.height); g.roots.forEach(r=>{const q=pr(r); ctx.moveTo(q.x+12*SC,q.y); ctx.arc(q.x,q.y,12*SC,0,Math.PI*2,true);});
        ctx.clip("evenodd"); drawGroup(ctx,g.items,pr,1.6*SC); ctx.restore();
        drawGroup(ctx,g.items,pr,0);
      });
    });
  });
  if(opt.ball==="top") frames.forEach(balls);
  return cv;
}
const hasBall = poses => (Array.isArray(poses)?poses:[poses]).some(sp => sp && (sp.scheme ? (sp.scheme.items||[]).some(i => i.ball) : (sp.figures||[sp]).some(f => (f.props||[]).some(p => p.type==="ball"))));

// ---------- словарь поз ----------
const ARMS = {
  down:{both:{ua:"down+0.08out",fa:"down+0.1out"}},
  side:{both:{ua:"out",fa:"out"}},
  fwd:{both:{ua:"fwd+0.05in",fa:"fwd"}},
  up:{both:{ua:"up+0.06out",fa:"up+0.04out"}},
  back:{both:{ua:"down+1.1back+0.1out",fa:"down+1.1back+0.1out"}},
  sideUp:{both:{ua:"out+up",fa:"out+up"}},
  upOut:{both:{ua:"out+up",fa:"out+up"}},
  sideFwd:{both:{ua:"out+fwd",fa:"out+fwd"}},
  fwdOut:{both:{ua:"out+fwd",fa:"out+fwd"}},
  sideDown:{both:{ua:"out+down",fa:"out+down"}},
  right:{R:{ua:"right",fa:"right"}, L:{ua:"right+0.55fwd",fa:"right+0.1fwd"}},
  hips:{both:{hand:[12.5,25,1],pole:"out+0.3fwd"}},
  shoulders:{both:{hand:[17,53,1],pole:"down"}},
  head:{both:{hand:[3,68,-9],pole:"out+0.2up"}},
  behind:{R:{hand:[-6,30,-14],pole:"out+back+down"}, L:{hand:[-6,26,-14],pole:"out+back+down"}},
  chest:{both:{hand:[1,47,15],pole:"out"}},
  front:{R:{hand:[-13,48,21],pole:"out+fwd"}, L:{hand:[-13,43.5,21],pole:"out+fwd"}},
  bentSide:{both:{ua:"out",fa:"in+0.12up"}},
  bentFwd:{both:{ua:"fwd",fa:"back+0.1up"}},
  bentBack:{both:{ua:"down+1.4back",fa:"fwd"}},
  bentFwdUp:{both:{ua:"fwd",fa:"up"}},
  floor:{both:{ua:"W:down+0.5back+0.25out",fa:"W:down+0.5back+0.25out"}},
  oneUp:{R:{ua:"up+0.06out",fa:"up"}},
  oneSide:{R:{ua:"out",fa:"out"}},
  oneDown:{R:{ua:"down+0.25out",fa:"down+0.25out"}},
};
const STAND = {view:0, legs:{both:{th:"down+0.04out",sh:"down+0.04out"}}};
const LEGS = {
  stand: STAND,
  closed: {view:0, legs:{both:{th:"down",sh:"down+0.02in"}}},
  apart: {view:0, legs:{both:{th:"down+0.3out",sh:"down+0.3out"}}},
  apartR: {view:-90, legs:{R:{th:"down+0.33fwd",sh:"down+0.33fwd"}, L:{th:"down+0.33back",sh:"down+0.33back"}}},
  narrow: {view:0, legs:{both:{th:"down+0.15out",sh:"down+0.15out"}}},
  wide: {view:0, legs:{both:{th:"down+0.5out",sh:"down+0.5out"}}},
  cross: {view:-15, legs:{R:{th:"down+0.12in+0.1fwd",sh:"down+0.1in"}, L:{th:"down+0.06out",sh:"down"}}},
  oneFwd: {view:-90, legs:{L:{th:"fwd",sh:"fwd",ft:"point"}, R:{th:"down",sh:"down"}}},
  oneSideToe: {view:0, legs:{R:{th:"down+0.45out",sh:"down+0.45out",ft:"point"}, L:{th:"down",sh:"down"}}},
  toeFwd: {view:-90, legs:{R:{th:"down+0.45fwd",sh:"down+0.45fwd",ft:"point"}, L:{th:"down",sh:"down"}}},
  toeBack: {view:-90, legs:{R:{th:"down+0.45back",sh:"down+0.45back",ft:"point"}, L:{th:"down",sh:"down"}}},
  onToes: {view:-90, legs:{both:{th:"down",sh:"down",ft:"down+0.25fwd"}}},
  legBent: {view:-90, legs:{R:{th:"fwd+1.7down",sh:"back+1.2down",ft:"point"}, L:{th:"down",sh:"down"}}},
  knees: {view:-90, legs:{both:{th:"down",sh:"back",ft:"back+0.15down"}}},
  kneeR: {view:-90, legs:{R:{th:"down",sh:"back",ft:"back+0.15down"}, L:{th:"fwd",sh:"down",ft:"fwd"}}},
  lungeR: {view:-90, legs:{R:{th:"fwd+down",sh:"down+0.06back"}, L:{th:"down+0.62back",sh:"down+0.62back",ft:"fwd+0.6down"}}},
  lungeL: {view:-90, legs:{L:{th:"fwd+down",sh:"down+0.06back"}, R:{th:"down+0.62back",sh:"down+0.62back",ft:"fwd+0.6down"}}},
  lungeRight: {view:0, legs:{R:{th:"out+down",sh:"down+0.05out"}, L:{th:"down+0.62out",sh:"down+0.62out"}}},
  lungeLeft: {view:0, legs:{L:{th:"out+down",sh:"down+0.05out"}, R:{th:"down+0.62out",sh:"down+0.62out"}}},
  lungeLR: {view:-12, legs:{L:{th:"in+down+0.35fwd",sh:"down+0.05in"}, R:{th:"down+0.62in",sh:"down+0.62in"}}},
  lungeBackR: {view:-90, legs:{L:{th:"fwd+down",sh:"down+0.06back"}, R:{th:"down+0.62back",sh:"down+0.62back",ft:"fwd+0.6down"}}},
  deepLunge: {view:-90, legs:{R:{th:"fwd+0.45down",sh:"down+0.2back"}, L:{th:"down+1.1back",sh:"down+1.1back",ft:"fwd+0.6down"}}},
  squat: {view:-90, legs:{both:{th:"fwd+0.18out+0.08down",sh:"down+0.85back",ft:"fwd+0.9down"}}},
  squatFlat: {view:-90, torso:{pitch:35}, legs:{both:{th:"fwd+0.18out+0.1down",sh:"down+0.6back",ft:"fwd"}}},
  halfSquat: {view:-90, legs:{both:{th:"fwd+1.05down",sh:"down+0.35back",ft:"fwd"}}},
  bendFwd: {view:-90, torso:{pitch:88}, legs:{both:{th:"down",sh:"down"}}},
  bendDown: {view:-90, torso:{pitch:130}, legs:{both:{th:"down",sh:"down"}}},
  halfBend: {view:-90, torso:{pitch:45}, legs:{both:{th:"down",sh:"down"}}},
  bendTouch: {view:-90, torso:{pitch:128}, legs:{both:{th:"down",sh:"down"}}},
  bendGrab: {view:-90, torso:{pitch:165}, head:{pitch:10}, legs:{both:{th:"down+0.06back",sh:"down+0.06back"}}},
  sideBendR: {view:0, torso:{roll:38}, head:{roll:8}, legs:{both:{th:"down+0.3out",sh:"down+0.3out"}}},
  sideBendL: {view:0, torso:{roll:-38}, head:{roll:-8}, legs:{both:{th:"down+0.3out",sh:"down+0.3out"}}},
  archBack: {view:-90, torso:{pitch:-35}, head:{pitch:-15}, legs:{both:{th:"down+0.3out",sh:"down+0.3out"}}},
  turnTorsoR: {view:0, torso:{yaw:75}, legs:{both:{th:"down+0.3out",sh:"down+0.3out"}}},
  sit: {view:-90, legs:{both:{th:"fwd",sh:"fwd",ft:"up+0.5fwd"}}},
  sitHeels: {view:-90, legs:{both:{th:"fwd+0.12down",sh:"back",ft:"back"}}},
  sitHeelsBend: {view:-90, torso:{pitch:96}, head:{pitch:20}, legs:{both:{th:"fwd+0.12down",sh:"back",ft:"back"}}},
  sitAngle: {view:-90, body:{pitch:-45}, legs:{both:{th:"fwd",sh:"fwd",ft:"point"}}},
  lieBack: {view:-90, body:{pitch:-90}, legs:{both:{th:"down",sh:"down",ft:"point"}}},
  lieFront: {view:-90, body:{pitch:90}, legs:{both:{th:"down",sh:"down",ft:"point"}}},
  lieSideR: {view:0, body:{roll:-90}, legs:{both:{th:"down",sh:"down",ft:"point"}}},
  lieArch: {view:-90, body:{pitch:90}, torso:{pitch:-24}, head:{pitch:-15}, floorAll:true, legs:{both:{th:"down+0.3back",sh:"down+0.3back",ft:"point"}}},
  kick: {view:-90, legs:{R:{th:"fwd+0.7up",sh:"fwd+0.7up",ft:"point"}, L:{th:"down",sh:"down"}}},
  jump: {view:0, lift:16, legs:{both:{th:"down",sh:"down+0.02in",ft:"point"}}},
  apartL: {view:-90, legs:{L:{th:"down+0.33fwd",sh:"down+0.33fwd"}, R:{th:"down+0.33back",sh:"down+0.33back"}}},
  headFwd: {view:-90, head:{pitch:40}, legs:{both:{th:"down+0.04out",sh:"down+0.04out"}}},
  headTurnR: {view:0, head:{yaw:80}, legs:{both:{th:"down+0.04out",sh:"down+0.04out"}}},
  plankFore: {view:-90, body:{pitch:78}, legs:{both:{th:"down",sh:"down",ft:"fwd"}}},
  lieBentArms: {view:-90, body:{pitch:90}, legs:{both:{th:"down",sh:"down",ft:"point"}}},
};
const LEG_ARMS = {   // руки «по умолчанию» для положений, где они опираются
  sit:"floor", sitAngle:"floor", lieSideR:"up", lieBack:"down", lieFront:"lieFront", lieArch:"upOut", plankFore:"forearms", lieBentArms:"lieBent", bendTouch:"touch", bendGrab:"grab", sitHeelsBend:"downBody"
};
Object.assign(ARMS, {
  lieFront:{both:{hand:[17,42,9],pole:"back+out"}},
  lieBent:{both:{hand:[15,41,10],pole:"back+out"}},
  forearms:{both:{ua:"fwd+0.05in",fa:"up+0.1in"}},
  touch:{both:{ua:"W:down+0.04fwd",fa:"W:down+0.04fwd"}},
  grab:{both:{hand:[9,-14,10],pole:"back+out"}},
  downBody:{both:{ua:"W:back+0.15down",fa:"W:back+0.05down"}},
});
function pose(leg, arm, extra){
  const L=LEGS[leg]; if(!L) throw new Error("leg "+leg);
  const a=arm||LEG_ARMS[leg]||"down"; const A=ARMS[a]; if(!A) throw new Error("arm "+a);
  return Object.assign({}, L, {arms:A}, extra||{});
}
window.Figure = {render, pose, resolve, hasBall, LEGS, ARMS};
})();

/* Раздел «Словарь» приложения «Расписание»: термины гимнастики (по учебнику Рябчикова и Фирилевой),
   свои слова студента, конструктор упражнения, правила, тренировка.
   Собирается в docs/gym.js вместе с poses.js (рисунки-позы) скриптом gimnastika/build_app.py.
   Пользуется общим из app.js: state.lang, LS, sfetch, openSheet, closeSheet, toast, copyText, render, esc, icon.
   Свои кнопки помечены атрибутами data-g…, чтобы не пересекаться с data-act приложения. */
(function(){
const ACC = "́";
const st = s => (s||"").replace(/`/g, ACC);
// ударение рисуем сами (не знаком U+0301): в шрифте приложения знак съезжает на соседнюю букву
const sth = s => esc(s||"").replace(/([аеёиоуыэюяАЕЁИОУЫЭЮЯ])`/g, '<span class="gv">$1</span>').replace(/`/g, "");
const plain = s => (s||"").replace(/[`́]/g, "");
const norm = s => plain(s).toLowerCase().replace(/ё/g,"е");
const cap = s => s.charAt(0).toUpperCase()+s.slice(1);
const Zh = () => state.lang==="zh";
if(typeof DORD==="undefined") window.DORD = {sort:(k, ids) => ids.slice(), hid:() => false, toggle(){}, open(){}, on(){}, tt:() => ({h:"", hidden:""})};   // старый app.js из кэша — без порядка и скрытых
const tx = (ru, zh) => Zh() && zh ? zh : ru;
const CJK_RE = /[㐀-鿿]/;
const SPK = `<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>`;
const AUD_BASE = "gym-audio/";
let D = null, FIG = {}, AUD = null, loading = false, failed = false;
const G = {tab:"dict", topic:null, ch:null, cat:null, q:"", more:0, legs:0, arms:4, ex:null, draft:null, pk:null, ipk:null, play:null};
let CAT = {}, CHAP = {}, TOPOF = {}, BYCAT = {}, ITEM = {}, FIGL = {};

const T = {
  ru:{tabs:["Термины","Составить","Моё"], search:"Поиск: выпад, дугами, 叉腰…", found:n=>`Найдено: ${n}`, none:"Ничего не нашлось. Можно добавить своё слово.",
      how:"Как говорить.", sayHd:"Как сказать", nofig:"рисунка нет", book:"Учебник, с.", fig:"рис.", gen:"рисунок по описанию учебника", pack:"Гимнастика", root:"Словарь", nTerms:n=>`${n} ${n%10===1&&n%100!==11?"термин":n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?"термина":"терминов"}`, nCh:n=>`${n} ${n===1?"глава":n<5?"главы":"глав"}`,
      soon:"скоро", soonT:[["🏃","Лёгкая атлетика"],["🏊","Плавание"]], nowT:"Сейчас проходим", pastT:"Пройдено", aheadT:"Впереди", refT:"Справочник", recent:"сначала недавние", passed:(a,b)=>`Пройдено ${a} из ${b}`, rulesChip:"📏 Правила", ordB:"⇅ Порядок и скрытые", ordHid:n=>` · скрыто ${n}`, hidH:n=>`Скрытые термины · ${n}`, hideI:"🙈 Скрыть", showI:"👁 Вернуть", hidTip:"Скрытые термины не видны в списке и в Карточках. Вернуть — открыть термин и нажать «Вернуть».", hidOk:"Термин скрыт — он внизу списка, в «Скрытых»", topicsT:"Разделы словаря", recentH:"🕘 Недавние", toCards:"＋ В карточки", toCardsT:"В какой набор карточек?", newSet:"＋ Новый набор", addedTo:x=>`Добавлено в «${x}»`, already:x=>`Уже есть в «${x}»`,
      report:"⚑ Нашли ошибку?", repT:"Ошибка в термине", repIntro:"Что не так: рисунок, ударение, перевод, объяснение? Сообщение сразу придёт автору словаря.", repPh:"Например: на рисунке другая нога", repSend:"Отправить", repOk:"Спасибо! Сообщение отправлено.", repErr:"Не отправилось — проверьте интернет.", repEmpty:"Напишите пару слов",
      phases:"▶ По фазам", slow:"🐢 Медленно", rep3:"🔁 Повтор ×3", offSave:"⬇ Сохранить главу — будет работать без интернета", offDone:"✓ Глава сохранена на телефоне — работает без интернета", offProg:(a,b)=>`Сохраняем… ${a} из ${b}`, offErr:"Сохранилось не всё — попробуйте ещё раз при хорошем интернете", offOk:"Глава сохранена",
      favLearn:n=>`Учить избранное карточками (${n}) →`, seeAlso:"См. также", everywhere:"Везде", inW:"в", noneHere:"Здесь не нашлось.", searchAllBtn:n=>`Искать везде (${n})`, searchIn:x=>`Поиск в «${x}»`, secN:(a,b)=>`${a} из ${b}`, allSec:"Все", favH:"★ Избранное", mineH:"✎ Мои слова", favNone:"Пока пусто. Нажмите ☆ у любого термина — он появится здесь.",
      more:"Показать ещё", searchAll:"Ищем во всех темах", myEx:"Моё упражнение", play:"▶ Показать", stop:"■ Стоп", exStart:"Начать с примера:", countN:n=>`Счёт ${n}`,
      first2:"Нажмите «＋ Счёт 1» и выберите движение картинкой.", pickT:n=>`Счёт ${n} — что делаем?`, pickHint:"В одном счёте можно выбрать по одному движению для ног, туловища и рук (если нужно — ещё головы и кистей). Фраза соберётся сама.",
      bodyH:"Ноги и туловище", armsH:"Руки", chH:{legs:"Ноги", torso:"Туловище", arms:"Руки", head:"Голова", hands:"Кисти"}, moreCh:"Голова и кисти — если нужно", addN:(n,x)=>`Добавить: ${n} — ${x}`, pickNone:"Выберите картинку", ipT:"Исходное положение", ipHint:"Нажмите на позу и положение рук. Упражнение начнётся заново.",
      ipOk:"Готово", repS:"другую сторону", undoS:"отменить", clrS:"заново", copyS:"скопировать", tapIp:"нажмите, чтобы поменять", extraSum:n=>`Ещё ${n} — редкие термины и для специалистов`, extraH:"Для специалистов", extraCat:"Эти термины нужны тем, кто занимается бальными танцами профессионально. На уроке они обычно не встречаются.",
      bmSoon:"Конструктор для этого раздела скоро появится.", bmPick:"Какой у вас урок? Выберите один раз — потом здесь будет только его конструктор (он меняется, когда открываете другой раздел в «Терминах»).", bmOru:"🤸 ОРУ", bmDance:"💃 Экзерсис", bmAthl:"🏃 Разминка", bmGames:"⚽ Разминка в играх", gwOrder:"Упражнения в движении стоят не от простого к сложному (ускорение — последним)", gwMany:n=>`Для этого возраста хватит ${n} упражнений в движении`, gwOk:"Порядок правильный: ходьба → бег по кругу → упражнения в движении → ОРУ в кругу → растяжка → упражнения с мячом", awNo:"Данные разминки ещё не загружены.", awAge0:"Для кого", awTpl:"Перед чем", awMy:"Моя разминка", awRunT:n=>`Медленный бег — ${n} мин`, awRunHint:(a,b)=>a ? `для этого возраста ${a}–${b} мин` : "", awSbuHint:"от простого к сложному: сложные — в конце", awEmpty:"Пусто — нажмите ＋", awHard:(x,a)=>`«${x}» — технически сложно для группы «${a}»`, awAge:(x,a)=>`«${x}» обычно не дают группе «${a}»`, awOrder:"СБУ стоят не от простого к сложному — сложные перенесите в конец", awMany:n=>`Для этого возраста хватит ${n} СБУ`, awRun:"Начните с медленного бега", awOk:"Порядок правильный: бег → ОРУ → СБУ от простого к сложному → ускорения", awDef:"Заново по образцу", awRules:"Правила разминки", awOlder:"Для старших или сложнее", awPlay:"Игровая форма со стишками", awCard:"Проверь себя (экспресс-карта)", awPlain:"Обычная",  dMy:"Мой экзерсис", dUp:"Затакт", dFirst:"Нажмите «＋ Движение»: например, батман тандю крестом. Счёт разложится сам — по 2 счёта на каждое направление.", dAdd:"Движение", dOther:"с другой ноги", dTempo:"Темп", tempos:["медленно","средне","быстро"], dBar:"Опора (станок)", bars:["без опоры","левым боком","правым боком"], dAddBtn:"Добавить", dWhat:"Что делаем", dWay:"Куда", dSide:"Какой ногой", dLegs:"Позиция ног", dArms:"Руки", dOk:"Готово", dTerm:"Термин", dRead:"Счёт идёт восьмёрками: после 8 снова 1. «Закрыть» — вернуть ногу в позицию из И. п. Термины — по учебнику Рябчикова и Фирилевой (глава «Хореография в спорте»).", infoT:"Почему так говорим",
      fav:"★ Избранное", favTip:"Термины, отмеченные звёздочкой ☆. Нажмите её на любой карточке, чтобы добавить или убрать.", favEmpty:"Пока пусто. Нажмите ☆ на карточке термина — он появится здесь.", favAdd:"В избранном", favDel:"Убрано из избранного", mine:"✎ Мои слова", mineTip:"Свои термины: с занятий, из других предметов. Хранятся на телефоне и в аккаунте.", add:"＋ Добавить слово", mineEmpty:"Пока пусто. Добавьте первое слово — например, то, что преподаватель назвал на занятии.",
      wNew:"Новое слово", wEdit:"Слово", wTerm:"Слово или фраза по-русски", wStress:"Нажмите на ударную гласную в каждом слове", wStressOk:"Ударения расставлены", wZh:"Перевод на китайский", wD:"Объяснение или заметка",
      wSave:"Сохранить", wDel:"Удалить", wNeed:"Напишите слово", wSaved:"Сохранено", wDeleted:"Удалено", wMy:"моё слово",
      rulesTip:'<b>Что не говорим.</b> Очевидное в гимнастике опускают. <b class="gok">✓</b> — так говорим, <b class="gno">✕</b> — так не надо.',
      quizTip:"<b>Тренировка.</b> Посмотрите на рисунок и выберите правильный термин.", right:"Верно", of:"из", next:"Дальше",
      bTip:"<b>Составьте упражнение.</b> Исходное положение, потом движения на каждый счёт. Приложение подберёт правильные слова и подскажет, что опускается.",
      ip1:"1. Исходное положение — ноги и туловище", armsL:"Руки", count:"Счёт", now:"Сейчас", bodyG:"Ноги и туловище", onlyArms:"Из этого положения — только движения рук или «и. п.».",
      armG:{pos:"Руки — в положение", bend:"Руки — согнуть, разогнуть", arc:"Руки — дугами и круги"}, addC:"Добавить", pick:"Выберите движение тела, рук или и то и другое",
      rep:"то же в другую сторону / с другой ноги", undo:"↶ Отменить", clr:"Заново", result:"Как записать и сказать", cmd:"Команда", first:"Добавьте первый счёт выше.",
      copy:"Скопировать упражнение", read:"Читаем: «И. п.» — «исходное положение», «1» — «раз», «3–4» — «три-четыре».",
      loadErr:"Словарь не загрузился. Проверьте интернет и откройте раздел ещё раз.", src:"Источник: Рябчиков А. И., Фирилева Ж. Е. Словарь терминов гимнастики и основ хореографии. СПб., 2009.", srcAthl:"Источники: материалы курса Е. В. Сабуровой (Moodle РГПУ им. Герцена), пособия Беловой и др. (2008), Макиенко, Колодницкого и др. (2011); правила World Athletics / ВФЛА. У каждого термина указан свой источник.", srcGames:"Источники: лекции курса «Спортивные и подвижные игры» в Moodle, учебные пособия из списка литературы, официальные правила (ФИБА, ФИВБ, ФИФА, ITTF, BWF). У каждого термина указан свой источник."},
  zh:{tabs:["术语","造句","我的"], search:"搜索：выпад、叉腰、弓步…", found:n=>`找到 ${n} 个`, none:"没有找到。可以添加自己的词。",
      how:"怎么说。", sayHd:"怎么说", nofig:"没有插图", book:"教材第", fig:"图", gen:"按教材描述绘制", pack:"体操", root:"词典", nTerms:n=>`${n} 个术语`, nCh:n=>`${n} 章`,
      soon:"即将推出", soonT:[["🏃","田径"],["🏊","游泳"]], nowT:"正在学习", pastT:"已学完", aheadT:"接下来要学", refT:"参考资料", recent:"最近的在上", passed:(a,b)=>`已学完 ${a} / ${b}`, rulesChip:"📏 规则", ordB:"⇅ 排序和隐藏", ordHid:n=>` · 已隐藏 ${n}`, hidH:n=>`已隐藏的术语 · ${n}`, hideI:"🙈 隐藏", showI:"👁 恢复", hidTip:"隐藏的术语不会出现在列表和卡片里。要恢复，打开术语点“恢复”。", hidOk:"术语已隐藏——在列表底部“已隐藏”里", topicsT:"词典分类", recentH:"🕘 最近看过", toCards:"＋ 加入卡片", toCardsT:"加入哪个卡片组？", newSet:"＋ 新卡片组", addedTo:x=>`已加入“${x}”`, already:x=>`“${x}”里已经有了`,
      report:"⚑ 发现错误？", repT:"术语有错误", repIntro:"哪里不对：图、重音、翻译、解释？消息会直接发给词典作者。", repPh:"例如：图上是另一条腿", repSend:"发送", repOk:"谢谢！已发送。", repErr:"没有发送成功，请检查网络。", repEmpty:"请写几个字",
      phases:"▶ 分步看", slow:"🐢 慢速", rep3:"🔁 重复 ×3", offSave:"⬇ 保存本章——没有网络也能用", offDone:"✓ 本章已保存在手机上——没有网络也能用", offProg:(a,b)=>`正在保存… ${a} / ${b}`, offErr:"没有全部保存，请在网络好的时候再试一次", offOk:"本章已保存",
      favLearn:n=>`用卡片学习收藏（${n}）→`, seeAlso:"相关术语", everywhere:"全部", inW:"在", noneHere:"这里没有找到。", searchAllBtn:n=>`在全部中搜索（${n}）`, searchIn:x=>`在“${x}”中搜索`, secN:(a,b)=>`${a} / ${b}`, allSec:"全部", favH:"★ 收藏", mineH:"✎ 我的词", favNone:"还没有收藏。点任何术语旁边的 ☆，它就会出现在这里。",
      more:"显示更多", searchAll:"在所有主题中搜索", myEx:"我的练习", play:"▶ 演示并朗读", stop:"■ 停止", exStart:"从例子开始：", countN:n=>`第${n}拍`,
      first2:"点“＋ 第1拍”，用图片选择动作。", pickT:n=>`第${n}拍——做什么？`, pickHint:"一拍里可以给腿、躯干和手臂各选一个动作（需要时还有头和手腕）。句子会自动组成。",
      bodyH:"腿和身体", armsH:"手臂", chH:{legs:"腿", torso:"躯干", arms:"手臂", head:"头", hands:"手腕"}, moreCh:"头和手腕（需要时）", addN:(n,x)=>`添加：${n} — ${x}`, pickNone:"请选择图片", ipT:"预备姿势", ipHint:"选择姿势和手臂位置。练习会重新开始。",
      ipOk:"完成", repS:"另一侧", undoS:"撤销", clrS:"重来", copyS:"复制", tapIp:"点一下可以更换", extraSum:n=>`另外 ${n} 个——少用的和专业术语`, extraH:"专业术语", extraCat:"这些术语是给专业练交谊舞的人用的，课上一般用不到。",
      bmSoon:"本部分的编排工具即将推出。", bmPick:"你上什么课？选一次——以后这里只显示这门课的编排工具（在“术语”里打开别的部分时会自动切换）。", bmOru:"🤸 徒手操", bmDance:"💃 舞蹈基训", bmAthl:"🏃 田径热身", bmGames:"⚽ 球类热身", gwOrder:"行进间练习没有由易到难（加速跑放最后）", gwMany:n=>`这个年龄 ${n} 个行进间练习就够了`, gwOk:"顺序正确：走 → 沿圆圈跑 → 行进间练习 → 圆圈中徒手操 → 拉伸 → 持球练习", awNo:"准备活动数据尚未加载。", awAge0:"对象", awTpl:"准备做什么", awMy:"我的准备活动", awRunT:n=>`慢跑 ${n} 分钟`, awRunHint:(a,b)=>a ? `该年龄 ${a}–${b} 分钟` : "", awSbuHint:"由易到难：难的放最后", awEmpty:"空——点 ＋", awHard:(x,a)=>`“${x}”对“${a}”技术上太难`, awAge:(x,a)=>`“${x}”一般不给“${a}”做`, awOrder:"专门跑练习没有由易到难——把难的移到最后", awMany:n=>`这个年龄 ${n} 个专门跑练习就够了`, awRun:"先从慢跑开始", awOk:"顺序正确：慢跑 → 原地徒手操 → 由易到难的专门跑练习 → 加速跑", awDef:"按样例重做", awRules:"准备活动规则", awOlder:"适合高年级或较难", awPlay:"游戏形式＋儿歌", awCard:"自我检查（快速评估表）", awPlain:"普通形式",  dMy:"我的基训组合", dUp:"弱起", dFirst:"点“＋ 动作”，比如十字形擦地。拍子会自动排好——每个方向2拍。", dAdd:"动作", dOther:"换另一条腿", dTempo:"速度", tempos:["慢","中","快"], dBar:"把杆", bars:["不扶把杆","左侧对把杆","右侧对把杆"], dAddBtn:"添加", dWhat:"做什么", dWay:"方向", dSide:"哪只脚", dLegs:"脚位", dArms:"手", dOk:"完成", dTerm:"术语", dRead:"按八拍数：8之后又从1开始。“закрыть”——把脚收回到预备姿势的位置。术语依据Рябчиков和Фирилева的教材（“运动中的舞蹈编排”一章）。", infoT:"为什么这样说",
      fav:"★ 收藏", favTip:"点了星标 ☆ 的术语。在任何卡片上点星标就能添加或取消。", favEmpty:"还没有收藏。点术语卡片上的 ☆，它就会出现在这里。", favAdd:"已收藏", favDel:"已取消收藏", mine:"✎ 我的词", mineTip:"自己的术语：课上听到的、其他科目的。保存在手机和账号里。", add:"＋ 添加词语", mineEmpty:"还没有词。添加第一个——比如老师在课上说的术语。",
      wNew:"新词", wEdit:"词语", wTerm:"俄语词语或短语", wStress:"点击每个词的重读元音", wStressOk:"重音已标好", wZh:"中文翻译", wD:"解释或备注",
      wSave:"保存", wDel:"删除", wNeed:"请写一个词", wSaved:"已保存", wDeleted:"已删除", wMy:"我的词",
      rulesTip:'<b>哪些词不说。</b> 体操术语省略显而易见的部分。<b class="gok">✓</b> 这样说，<b class="gno">✕</b> 不要这样说。点 🔊 听俄语发音。',
      quizTip:"<b>练习。</b> 看图，选出正确的俄语术语，然后点 🔊 听发音并大声跟读。", right:"答对", of:"/", next:"下一题",
      bTip:"<b>编一个练习。</b> 先选预备姿势，再选每一拍的动作。应用会给出正确的俄语说法，并说明省略了什么。",
      ip1:"1. 预备姿势——腿和身体", armsL:"手臂", count:"第几拍：", now:"现在", bodyG:"腿和身体", onlyArms:"在这个姿势下只能做手臂动作或“и. п.”（还原）。",
      armG:{pos:"手臂——到某个位置", bend:"手臂——屈、伸", arc:"手臂——弧形和绕环"}, addC:"添加", pick:"选择身体或手臂的动作（或两者）",
      rep:"同样做另一侧 / 换腿", undo:"↶ 撤销", clr:"重来", result:"怎么写、怎么说", cmd:"口令", first:"请在上面添加第一拍。",
      copy:"复制练习", read:"读法：“И. п.” = “исходное положение”（预备姿势），“1” = “раз”，“3–4” = “три-четыре”。",
      loadErr:"词典没有加载。请检查网络，再打开一次。", src:"来源：Рябчиков А. И., Фирилева Ж. Е.《体操与舞蹈基础术语词典》，圣彼得堡，2009。", srcAthl:"来源：Е. В. Сабурова 的课程材料（赫尔岑师范大学 Moodle）、Белова 等（2008）、Макиенко、Колодницкий 等（2011）的教材；世界田联 / 全俄田协规则。每个术语都注明了来源。", srcGames:"来源：Moodle 上“球类与活动性游戏”课程的讲义、参考书目中的教材、正式规则（国际篮联、国际排联、国际足联、国际乒联、世界羽联）。每个术语都注明了来源。"}
};
const TL = () => T[Zh()?"zh":"ru"];

/* ---------- загрузка ---------- */
function load(){
  if(D || loading) return; loading = true; failed = false;
  sfetch("gym/data.json").then(r => r.ok ? r.json() : null).then(d => {
    loading = false; if(!d){ failed = true; render(); return; }
    D = d; FIG = d.fig || {}; AUD = d.audio || null;
    if(!D.topics){   // старый формат: одна глава ОРУ
      D.chapters = [{id:"oru", name:"Общеразвивающие упражнения", nz:"基本体操", cats:D.cats.map(c => c.id)}];
      D.topics = [{id:"gym", name:"Гимнастика", nz:"体操", chapters:["oru"]}]; D.cats.forEach(c => c.ch = "oru");
    }
    D.cats.forEach(c => { CAT[c.id] = c; BYCAT[c.id] = []; });
    D.chapters.forEach(c => CHAP[c.id] = c);
    D.topics.forEach(t => t.chapters.forEach(c => TOPOF[c] = t));
    // разделы с zh:1 («Русский для учёбы») — только для китайского языка; язык меняется на ходу, поэтому фильтруем при каждом обращении
    ALLT = D.topics; Object.defineProperty(D, "topics", {get:() => (typeof NO_DICT!=="undefined" && NO_DICT.includes(String(state.group))) ? ALLT.filter(t => t.zh && (Zh() || (typeof devMode==="function" && devMode()))) : (Zh() || (typeof devMode==="function" && devMode())) ? ALLT : ALLT.filter(t => !t.zh), configurable:true});   // староста в режиме старосты видит и «Русский для учёбы» на русском   // у юристов спорта нет — только «Русский для учёбы» (китайский язык)
    D.items.forEach(indexItem);
    FIGL.oru = true;
    if(window.MYCH){ applyMy(); MYCH.on(myChanged); MYCH.checkIncoming(); }
    render();
  }).catch(() => { loading = false; failed = true; render(); });
}
function indexItem(it){
  ITEM[it.id] = it; (BYCAT[it.c] || (BYCAT[it.c] = [])).push(it);
  if((TOPOF[(CAT[it.c]||{}).ch]||{}).zh) it._zo = 1;
  it.fig = [...new Set(it.fig)];   // в главах встречается один рисунок дважды («рис. 161, 161»)
  it.figs = it.fig.length ? it.fig : it.gen ? [genFig("g:"+it.id, it.gen)] : [];
  const hy = x => x.replace(/[`́]/g,"").replace(/([А-Яа-яЁё]+)-([А-Яа-яЁё]+)/g, "$1$2 $1-$2");   // «Нале-во» ищется и как «налево»
  it._tw = words(hy(it.t)); it._w = words(hy([it.t, ...(it.say||[])].join(" "))); it._dw = words(it.d||""); it._tt = norm(it.t).replace(/\s*\([^)]*\)/g,"").replace(/[^a-zа-я0-9 ]+/g," ").replace(/\s+/g," ").trim();
  it._n = wnorm([it.t, it.d||"", ...(it.say||[])].join(" ")); it._t = wnorm(it.t); it._r = (it.zh||"")+" "+(it.dz||"");
}
/* «Мои главы» (mych.js): тема «mych» со своими главами студента; при каждом изменении — убрать старое и добавить заново */
let ALLT = [];
function applyMy(){
  if(!D || !window.MYCH) return; const p = MYCH.parts();
  D.items = D.items.filter(it => { if(it.my){ delete ITEM[it.id]; return false; } return true; });
  D.cats = D.cats.filter(c => { if(c.my){ delete CAT[c.id]; delete BYCAT[c.id]; return false; } return true; });
  D.chapters = D.chapters.filter(c => { if(c.my){ delete CHAP[c.id]; delete TOPOF[c.id]; return false; } return true; });
  ALLT = ALLT.filter(t => !t.my).concat([p.topic]);
  p.chapters.forEach(c => { D.chapters.push(c); CHAP[c.id] = c; TOPOF[c.id] = p.topic; FIGL[c.id] = true; });
  p.cats.forEach(c => { D.cats.push(c); CAT[c.id] = c; BYCAT[c.id] = []; });
  Object.keys(FIG).forEach(k => { if(k.startsWith("u-")) delete FIG[k]; }); Object.assign(FIG, MYCH.figs());
  p.items.forEach(it => { D.items.push(it); indexItem(it); });
  STEMS = null;
}
function myChanged(){
  applyMy(); if(state.screen!=="dict") return;
  if(G.topic==="mych" && G.ch && !CHAP[G.ch]) G.ch = null;   // главу удалили
  const r = $("gres"); if(G.q.trim() && r) r.innerHTML = results(); else render();
  const it = document.querySelector("#sheet .gitem"); if(it && SH.length){ const id = it.dataset.gid; if(id && !ITEM[id]) closeSheet(); else refreshSheet(); }
}
const chOf = it => (CAT[it.c]||{}).ch;
function words(s){ return norm(s).replace(/[^a-zа-я0-9]+/g," ").trim().split(" ").filter(Boolean); }
function wnorm(x){ return " "+norm(x).replace(/[^a-zа-я0-9]+/g," ")+" "; }
// рисунки главы — отдельным файлом, при первом открытии
function loadFigs(ch){
  if(!ch || FIGL[ch] || !D.figFiles || !D.figFiles[ch]) return; FIGL[ch] = "…";
  sfetch(D.figFiles[ch]).then(r => r.ok ? r.json() : null).then(f => { if(!f) return; Object.assign(FIG, f); FIGL[ch] = true;
    clearTimeout(loadFigs.t); loadFigs.t = setTimeout(() => {   // несколько глав подряд — одна перерисовка; при поиске — только результаты (клавиатура не закрывается)
      if(state.screen!=="dict") return;
      const r = $("gres"); if(G.q.trim() && r) r.innerHTML = results(); else render();
      const sh = document.querySelector("#sheet .gsheet"); if(sh && SH.length) refreshSheet(); }, 60); }).catch(() => { FIGL[ch] = false; });
}
// где человек в словаре — хранится в истории браузера: «назад» ведёт на шаг вверх, а после обновления страницы открывается то же место
// dp — сколько шагов истории от начала словаря, tdp — на каком шаге открыт список глав раздела: крошки отматывают ровно столько, сколько нужно
const navState = () => ({topic:G.topic, ch:G.ch, cat:G.cat, tab:G.tab, open:!!G.open, sub:!!G.sub, dp:G.dp||0, tdp:G.tdp});
function navTo(topic, ch){
  const sameTopic = topic && topic===G.topic; G.dp = (G.dp||0) + 1; G.tdp = topic && !ch ? G.dp : sameTopic ? G.tdp : undefined;
  G.topic = topic; G.ch = ch; G.cat = null; G.more = 0; G.open = false; G.sub = false; G.scope = null;
  history.pushState({screen:"dict", gym:navState()}, ""); window.scrollTo(0,0); render();
}
function saveNav(){ try{ history.replaceState(Object.assign({}, history.state||{}, {screen:"dict", gym:navState()}), ""); }catch(e){} }
function restore(g){ const keep = g && g.open && g.ch && g.ch===G.ch ? G.cat : null; G.topic = g && g.topic || null; G.ch = g && g.ch || null; G.cat = keep || g && g.cat || null; if(g && g.tab) G.tab = g.tab; G.more = 0; G.open = !!(g && g.open); G.sub = !!(g && g.sub); G.dp = g && g.dp || 0; G.tdp = g ? g.tdp : undefined; G.scope = null; }
let RESTORED = false;
// крошки: вернуться на n шагов назад; если истории не хватило (ничего не произошло) — просто открыть нужное место
function backTo(n, topic){
  if(n <= 0) return navTo(topic, null);
  let moved = false; const h = () => { moved = true; }; addEventListener("popstate", h, {once:true}); history.go(-n);
  setTimeout(() => { removeEventListener("popstate", h); if(!moved && state.screen==="dict") navTo(topic, null); }, 400);
}

/* ---------- озвучка (только в китайском режиме) ---------- */
const audioKey = t => plain(t).replace(/\s+/g," ").trim().toLowerCase();
function clipParts(t){
  if(!AUD) return null;
  const k = audioKey(t); if(AUD[k]) return [k];
  let m = t.match(/^(\d+)(?:–(\d+))?\s*—\s*(.*)$/), pre = [], rest = t;
  if(m){ pre = m[2] ? [m[1], m[2]] : [m[1]]; rest = m[3]; }
  else if((m = t.match(/^И\. п\.\s*—\s*(.*)$/))){ pre = ["и. п."]; rest = m[1]; }
  const rk = audioKey(rest);
  const parts = AUD[rk] ? [rk] : rest.split(/,\s*|\s(?=с\s)/).map(audioKey);
  const all = pre.map(audioKey).concat(parts);
  return all.every(x => AUD[x]) ? all : null;
}
let PLAY = null;
function speak(t){
  if(!Zh()) return;
  if(PLAY){ PLAY.stop = true; if(PLAY.a) try{ PLAY.a.pause(); }catch(e){} }
  try{ speechSynthesis.cancel(); }catch(e){}
  const parts = clipParts(t);
  if(parts){
    const job = PLAY = {stop:false}; let i = 0, left = LS.get("gymRep3", false) ? 2 : 0; const rate = LS.get("gymSlow", false) ? .75 : 1;
    const next = () => { if(job.stop) return; if(i >= parts.length){ if(left-- > 0){ i = 0; setTimeout(next, 900); } return; }
      const a = new Audio(AUD_BASE + AUD[parts[i++]]); a.playbackRate = rate; job.a = a; a.onended = () => setTimeout(next, 120); a.onerror = next; a.play().catch(()=>{}); };
    next(); return;
  }
  try{
    const u = new SpeechSynthesisUtterance(plain(t).replace(/\s*\([^)]*\)/g,"").replace(/И\. п\./g,"Исходное положение").replace(/и\. п\./g,"исходное положение").replace(/(\d)–(\d)/g,"$1, $2").replace(/—/g,","));
    u.lang = "ru-RU"; u.rate = LS.get("gymSlow", false) ? .6 : .8;
    const v = speechSynthesis.getVoices().find(v => /^ru/i.test(v.lang)); if(v) u.voice = v;
    speechSynthesis.speak(u);
  }catch(e){}
}
const spk = t => Zh() ? `<button class="gspk" data-gsay="${esc(t)}" aria-label="🔊">${SPK}</button>` : "";

/* ---------- рисунки ---------- */
function poseOf(code){ const [leg, arm, view] = code.split("|"); return Figure.pose(leg, arm||undefined, view!==undefined && view!=="" ? {view:+view} : {}); }
function genFig(key, codes){
  if(!FIG[key]){ const cv = Figure.render(codes.map(poseOf)); FIG[key] = [cv.toDataURL("image/png"), cv.width, cv.height]; }
  return key;
}
// f = [картинка, w, h, цветная?, слой «мяч»]: обычный рисунок — маска цвета текста; мяч — оранжевым слоем поверх; цветные (жесты ФИБА) — как есть
const fig = id => { const f = FIG[id]; if(!f) return ""; const ar = (f[1]/f[2]).toFixed(3);
  if(f[3]) return `<img class="gfig gimg" src="${f[0]}" alt="" style="--ar:${ar};aspect-ratio:${ar}">`;
  return `<i class="gfig" style="--m:url(${f[0]});--ar:${ar};aspect-ratio:${ar}${f[4] ? `;background:url(${f[4]}) center/contain no-repeat,var(--ink)` : ""}${f[5] ? `;--gu:${f[5]}px` : ""}"></i>`; };
const wide = ids => ids.some(i => FIG[i] && FIG[i][1]/FIG[i][2] > 1.25);
const figBtn = (ids, title) => ids.length
  ? `<div class="gfigs ${ids.length>1?"two":""}">${ids.map(i => `<button class="gfigbtn" data-gzoom="${ids.join(",")}" data-gtitle="${esc(title)}" aria-label="+">${fig(i)}</button>`).join("")}</div>`
  : `<div class="gnofig">${TL().nofig}</div>`;
const sayLine = t => `<div class="gsayl"><span>${sth(t)}</span>${spk(t)}</div>`;
const figNames = f => f.map(x => x.replace("a"," а").replace("b"," б")).join(", ");
function srcLine(it){
  if(it._zo) return "";   // разговорник: источника-учебника нет
  if(it.src) return (Zh()?"来源：":"Источник: ") + esc(it.src);   // главы игр и др.: источник — лекция/правила, не страница учебника
  const t = TL(), book = it.fig.filter(x => !/^g-/.test(x)), f = book.length ? (Zh()?"，":", ")+t.fig+" "+figNames(book) : (it.gen || it.fig.length) ? " · "+t.gen : "";   // «g-…» — нарисованы по описанию, это не номера рисунков учебника
  return Zh() ? `${t.book} ${it.p} 页${f}` : `${t.book} ${it.p}${f}`;
}

/* ---------- избранное ---------- */
const favs = () => { const v = LS.get("gymFav", []); return Array.isArray(v) ? v : []; };
const isFav = id => favs().includes(id);
const favBtn = id => `<button class="gfav ${isFav(id)?"on":""}" data-gfav="${esc(id)}" aria-label="${TL().fav}" aria-pressed="${isFav(id)}">${isFav(id)?"★":"☆"}</button>`;

/* ---------- мои слова ---------- */
const myWords = () => LS.get("myWords", []);
function wordCard(w){
  return `<div class="gcard mine"><div class="gbody">
      <div class="gterm"><b>${sth(w.t)}</b>${spk(w.t)}${favBtn(w.id)}<button class="gedit" data-gedit="${w.id}" aria-label="✎">${icon("edit","sm")}</button></div>
      ${w.zh?`<div class="gzhl">${esc(w.zh)}</div>`:""}${w.d?`<div class="gd">${esc(w.d)}</div>`:""}
      <div class="gsrc">✎ ${TL().wMy}</div></div></div>`;
}
const VOW = "аеёиоуыэюяАЕЁИОУЫЭЮЯ";
// черновик: текст без знаков + номер ударной буквы в каждом слове
function draftFrom(t){
  const words = []; let clean = "";
  (t||"").split(/(\s+)/).forEach(part => {
    if(!part) return;
    if(/^\s+$/.test(part)){ clean += part; return; }
    const i = part.indexOf("`"), p = part.replace(/`/g,"");
    words.push(i > 0 ? i-1 : -1); clean += p;
  });
  return {text:clean, marks:words};
}
function draftText(dr){   // слово с ` после ударной гласной
  let wi = 0;
  return dr.text.split(/(\s+)/).map(part => {
    if(!part || /^\s+$/.test(part)) return part;
    const m = dr.marks[wi++]; return m >= 0 && m < part.length && VOW.includes(part[m]) ? part.slice(0,m+1)+"`"+part.slice(m+1) : part;
  }).join("");
}
function stressPicker(dr){
  let wi = 0, need = 0, done = 0;
  const html = dr.text.split(/(\s+)/).map(part => {
    if(!part || /^\s+$/.test(part)) return part ? " " : "";
    const idx = wi++, vow = [...part].map((ch,i) => VOW.includes(ch) ? i : -1).filter(i => i >= 0);
    const auto = /ё/i.test(part) || vow.length < 2 || !/[а-яё]/i.test(part);
    if(!auto){ need++; if(dr.marks[idx] >= 0) done++; }
    return `<span class="gsw">${[...part].map((ch,i) => !auto && VOW.includes(ch) ? `<button class="${dr.marks[idx]===i?"on":""}" data-gstress="${idx}:${i}">${esc(ch)}</button>` : `<i>${esc(ch)}</i>`).join("")}</span>`;
  }).join("");
  return `<div class="gpick">${html||"&nbsp;"}</div><small class="${need&&done<need?"":"gokt"}">${need&&done<need?TL().wStress:need?"✓ "+TL().wStressOk:""}</small>`;
}
function openWord(id){
  const w = id ? myWords().find(x => x.id===id) : null, t = TL();
  G.draft = Object.assign(draftFrom(w ? w.t : ""), {id: w ? w.id : null});
  openSheet(`<h2>${w?t.wEdit:t.wNew}</h2><div class="form">
    <label>${t.wTerm}<input id="gw_t" value="${esc(G.draft.text)}" autocomplete="off" lang="ru"></label>
    <div id="gw_st" class="gstress">${stressPicker(G.draft)}</div>
    <label>${t.wZh}<input id="gw_zh" value="${esc(w?w.zh||"":"")}" autocomplete="off" lang="zh"></label>
    <label>${t.wD}<textarea id="gw_d" rows="3">${esc(w?w.d||"":"")}</textarea></label></div>
    <div class="btnrow"><button class="btn" data-gsave>${t.wSave}</button>${w?`<button class="btn danger" data-gdel="${w.id}">${t.wDel}</button>`:""}</div>`);
}
function saveWord(){
  const dr = G.draft; if(!dr) return;
  const t = draftText(dr).trim(); if(!t){ toast(TL().wNeed); return; }
  const list = myWords(), rec = {id: dr.id || ("w"+Date.now().toString(36)), t, zh: ($("gw_zh").value||"").trim(), d: ($("gw_d").value||"").trim(), at: Date.now()};
  const i = list.findIndex(x => x.id===rec.id); if(i >= 0) list[i] = rec; else list.unshift(rec);
  LS.set("myWords", list); G.draft = null; closeSheet(); G.tab = "mine"; toast(TL().wSaved); render();
}

/* ---------- термины ---------- */
const emOf = it => { const c = CHAP[chOf(it)]; return c && c.em; };
const bare = x => norm(x).replace(/[^a-zа-я0-9]+/g,"");
// ссылки на другие термины прямо в объяснении: «…из упора…» → статья «Упор» (сначала из той же главы, потом общие термины)
let STEMS = null;
const ENDS = new Set(["","а","у","е","ом","ы","ой","ам","ами","ах","и","ь","ю","я","ей","ем","ов","ям","ях","ою","ею"]);
const PREF = ["ob","sn","oru","st"];
function stems(){
  if(STEMS) return STEMS; STEMS = {};
  D.items.forEach(it => { if(it._zo) return; const w = plain(it.t).toLowerCase().replace(/ё/g,"е").replace(/[!.]/g,"").trim(); if(!/^[а-я-]{3,}$/.test(w)) return;
    const st = /(но|мо|ри|ди|ти)$/.test(w) && !/ено$/.test(w) ? w : w.length > 4 ? w.replace(/[аяоеыиьйу]$/, "") : w;   // наречия («продольно», «внутри», «сзади») — только точно этим словом (не «продольной», «внутрь»)
    (STEMS[st] || (STEMS[st] = [])).push(it); });
  return STEMS;
}
const NOLINK = new Set(["кругом","кольцом","прямой","прямо"]);   // «поворот кругом» — не «круг», «прыжок кольцом» — не «кольца»
function linkTarget(word, it){
  const w = word.toLowerCase().replace(/ё/g,"е"), S = stems(); if(NOLINK.has(w)) return null;
  for(let k = w.length; k >= Math.max(3, w.length-3); k--){ const c = S[w.slice(0,k)]; if(!c || !ENDS.has(w.slice(k))) continue;
    const ch = chOf(it), tp = TOPOF[ch], ok = c.filter(x => x.id!==it.id && TOPOF[chOf(x)]===tp); if(!ok.length) return null;
    return ok.find(x => chOf(x)===ch) || PREF.map(p => ok.find(x => chOf(x)===p)).find(Boolean) || ok[0]; }
  return null;
}
function links(it){   // [[кусок текста, статья|null], …]
  const out = [], seen = new Set(); let last = 0, n = 0; const d = it.d || "";
  d.replace(/[А-Яа-яЁё`]+/g, (m, pos) => { if(n >= 8) return m; const tg = linkTarget(m.replace(/`/g,""), it);
    if(tg && !seen.has(tg.id)){ seen.add(tg.id); n++; out.push([d.slice(last, pos), null], [m, tg]); last = pos + m.length; } return m; });
  out.push([d.slice(last), null]); return out;
}
const linkedD = it => links(it).map(([x, tg]) => tg ? `<a class="glink" data-gopen="${esc(tg.id)}">${sth(x)}</a>` : sth(x)).join("");
const alsoZh = it => { const ls = links(it).filter(x => x[1]).map(x => x[1]); return ls.length ? `<div class="galso"><small>${TL().seeAlso}</small>${ls.map(x => `<button data-gopen="${esc(x.id)}"><span>${sth(x.t)}</span><i>${esc(x.zh||"")}</i></button>`).join("")}</div>` : ""; };
function sayBlock(it){   // фразы «как сказать»; строку, повторяющую сам термин, не показываем — он уже в заголовке
  const ls = it.say.filter(x => bare(x) !== bare(it.t));
  return ls.length ? `<div class="gsay"><small class="gsayh">${TL().sayHd}</small>${ls.map(sayLine).join("")}</div>` : "";
}
// обозначения под схемой игры: только значки, которые есть на рисунке (it.lg из build_app.py); свёрнуто
const LGI = {
  t:['<rect x="4" y="4" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"/><rect x="4" y="11" width="14" height="7" fill="currentColor"/>',"учитель","老师"],
  v:['<path fill-rule="evenodd" fill="currentColor" d="M3.5 11a7.5 7.5 0 1 0 15 0a7.5 7.5 0 1 0-15 0Z M8.2 7.6a2.8 2.8 0 1 0 5.6 0a2.8 2.8 0 1 0-5.6 0Z"/>',"водящий (точка — куда смотрит)","捉人者等特殊角色（白点：面朝的方向）"],
  p:['<circle cx="11" cy="11" r="7.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 11 A7.5 7.5 0 0 0 18.5 11Z" fill="currentColor"/>',"игрок (тёмная половина — спина)","队员（深色一半是后背）"],
  p2:['<circle cx="11" cy="11" r="7.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 11 A7.5 7.5 0 0 0 18.5 11Z" fill="currentColor" opacity=".35"/>',"игрок другой команды","另一队队员"],
  ball:['<circle cx="11" cy="11" r="5" fill="currentColor" fill-opacity=".35" stroke="currentColor" stroke-width="1.5"/>',"мяч","球"],
  cone:['<path d="M11 3 L19 18 L3 18Z" fill="none" stroke="currentColor" stroke-width="2"/>',"конус, ориентир","锥筒、标志物"],
  flag:['<path d="M6 19 V3" stroke="currentColor" stroke-width="2"/><path d="M6 3 L17 6.5 L6 10Z" fill="currentColor"/>',"флажок","小旗"],
  ring:['<circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" stroke-width="1.5"/>',"круг на полу","地上的圆圈"],
  line:['<path d="M2 11 H20" stroke="currentColor" stroke-width="2"/>',"линия, граница","线、边界"],
  run:['<path d="M2 11 H15" stroke="currentColor" stroke-width="1.6" stroke-dasharray="3 3"/><path d="M15 7 L21 11 L15 15Z" fill="currentColor"/>',"бег","跑动路线"],
  pass:['<path d="M2 11 H15" stroke="currentColor" stroke-width="1.6" stroke-dasharray="1 3" stroke-linecap="round"/><path d="M15 7 L21 11 L15 15Z" fill="currentColor"/>',"передача мяча","传球"],
  move:['<path d="M2 11 H15" stroke="currentColor" stroke-width="1.8"/><path d="M15 7 L21 11 L15 15Z" fill="currentColor"/>',"направление движения","移动方向"]
};
const legend = it => it.lg && it.lg.length ? `<details class="glg"><summary>${Zh()?"图例":"Обозначения"}</summary>${it.lg.filter(k => LGI[k]).map(k => `<span><svg viewBox="0 0 22 22" width="22" height="22">${LGI[k][0]}</svg>${Zh()?LGI[k][2]:LGI[k][1]}</span>`).join("")}</details>` : "";
function card(it, extra){
  const t = TL(), ph = carOk(it);
  return `<div class="gcard ${wide(it.figs)?"wide":""}${ph?" gcarc":""}">${!it.figs.length ? "" : ph ? `<div class="gfigw">${carHTML(it)}${lzHTML(it, 0)}</div>` : `<div class="gfigw">${figBtn(it.figs, it.t)}${lzHTML(it, null)}</div>`}
    <div class="gbody">${legend(it)}
      <div class="gterm"><b>${sth(it.t)}</b>${spk(it.t)}${favBtn(it.id)}</div>
      ${Zh()?`<div class="gzhl">${esc(it.zh)}</div>`:""}
      <div class="gd">${Zh()?esc(it.dz):linkedD(it)}</div>
      ${Zh()?alsoZh(it):""}
      ${sayBlock(it)}
      ${Zh()?`<div class="gaud"><button class="${LS.get("gymSlow",false)?"on":""}" data-gslow>${t.slow}</button><button class="${LS.get("gymRep3",false)?"on":""}" data-grep3>${t.rep3}</button></div>`:""}
      <div class="gsrc">${srcLine(it)}</div>
      ${extra||""}
      <div class="gtools"><button data-gtocards="${esc(it.id)}">${t.toCards}</button>${it.my ? `<button data-myedit="${esc(it.mch+":"+it.mid)}">${MYCH.T().editBtn}</button>` : `<button data-greport="${esc(it.id)}">${t.report}</button><button data-ghide="${esc(it.id)}">${DORD.hid("i:"+it.id) ? t.showI : t.hideI}</button>`}</div>
    </div></div>`;
}
const VOWS = "аеиоуыэюя";
function lev(a, b, max){
  if(Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({length:b.length+1}, (_, i) => i);
  for(let i = 1; i <= a.length; i++){ const cur = [i]; let best = i;
    for(let j = 1; j <= b.length; j++){ const x = a[i-1], y = b[j-1], sub = x===y ? 0 : VOWS.includes(x) && VOWS.includes(y) ? .5 : 1;
      cur[j] = Math.min(prev[j]+1, cur[j-1]+1, prev[j-1] + sub); best = Math.min(best, cur[j]); }
    if(best > max) return max + 1; prev = cur; }
  return prev[b.length];
}
function wcost(q, w){   // 0 — слово начинается так; иначе число опечаток (до 1 в коротких словах, до 2 — в длинных)
  if(w.startsWith(q)) return 0;
  const max = q.length >= 7 ? 2 : q.length >= 4 ? 1 : 0; if(!max) return 9;
  const c = Math.min(lev(q, w.slice(0, q.length), max), lev(q, w, max)); return c <= max ? c : 9;
}
function fuzzy(it, qn){   // {cost, tier}: 4 — точно название, 3 — название начинается так, 2 — все слова в названии, 1 — в названии и фразах «как сказать», 0 — что-то только в объяснении
  if(it._tt===qn) return {cost:0, tier:4};
  let cost = 0, inD = false, inT = true;
  for(const x of qn.split(" ")){ let c = 9; for(const w of it._w){ c = Math.min(c, wcost(x, w)); if(!c) break; }
    if(c < 9){ cost += c; if(!it._tw.some(w => wcost(x, w) < 9)) inT = false; continue; }
    if(it._dw.some(w => w.startsWith(x))){ inD = true; continue; }
    return null; }
  if(inD) cost += 1.5;   // найдено только в объяснении — ниже, чем название с опечаткой
  return {cost, tier: inD ? 0 : it._tt.startsWith(qn) ? 3 : inT ? 2 : 1};
}
const visItems = () => Zh() ? D.items : D.items.filter(it => !it._zo);
function matches(q){
  const words = q.trim().split(/\s+/).filter(Boolean);
  const hit = (n, raw) => words.every(w => CJK_RE.test(w) ? raw.includes(w) : n.includes(" "+norm(w)));
  let items;
  if(CJK_RE.test(q)){ const inT = it => words.every(w => (it.zh||"").includes(w)); items = visItems().filter(it => hit(it._n, it._r)); items.sort((a,b) => (inT(b)?1:0) - (inT(a)?1:0)); }
  else {   // опечатки, «е/ё» и ударения не мешают; если есть точные совпадения — опечаточные не показываем
    const qn = norm(q).replace(/[^a-zа-я0-9 ]+/g," ").replace(/\s+/g," ").trim();
    const qj = qn.includes(" ") ? qn.replace(/ /g, "") : null;   // «нале во», «нале-во» — ищем и слитно: «налево»
    const both = it => { const a = fuzzy(it, qn), b = qj && fuzzy(it, qj); return !a ? b : !b ? a : (b.cost - b.tier*1.2 < a.cost - a.tier*1.2 ? b : a); };
    const m = qn ? visItems().map((it, i) => [it, both(it), i]).filter(x => x[1]) : [];
    const best = m.length ? Math.min(...m.map(x => x[1].cost)) : 0;
    const sc = r => r.cost - r.tier * 1.2;   // название с опечаткой («упор присед») выше, чем точное слово где-то во фразах
    items = m.filter(x => x[1].cost <= best + .5 || x[1].tier >= 2).sort((a, b) => sc(a[1]) - sc(b[1]) || a[2] - b[2]).map(x => x[0]);
  }
  const mine = myWords().filter(w => hit(wnorm([w.t,w.d||""].join(" ")), (w.zh||"")+" "+(w.d||"")));
  return {items, mine};
}
const short = it => Zh() ? (it.zh||"") : plain(it.d||"").split(/[.;]\s/)[0];
// термин без рисунка — значок его группы (правила, судейство, площадка, техника…), а не пустое окошко
const CIC = {
  whistle:'<circle cx="8" cy="14" r="5"/><path d="M8 9h13v4h-8M5 10 3 6"/>',
  rules:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2.5h6V4M9 10h6M9 14h6M9 18h4"/>',
  history:'<path d="M3 21h18M4 9h16l-8-5zM6 9v9M10 9v9M14 9v9M18 9v9M4 18h16"/>',
  court:'<rect x="2.5" y="5" width="19" height="14" rx="1"/><path d="M12 5v14"/><circle cx="12" cy="12" r="3"/>',
  ball:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M5.6 5.6c3 3 3 9.8 0 12.8M18.4 5.6c-3 3-3 9.8 0 12.8"/>',
  shuttle:'<path d="M12 21a2.5 2.5 0 0 1-2.5-2.5L7 4h10l-2.5 14.5A2.5 2.5 0 0 1 12 21z"/><path d="M10 4l1.2 12M14 4l-1.2 12M8 10h8"/>',
  paddle:'<circle cx="10" cy="10" r="6.5"/><path d="m14.6 14.6 5 5"/><circle cx="19.5" cy="5" r="1.5"/>',
  tactics:'<circle cx="6" cy="17" r="2.5"/><path d="M15 4l4 4M19 4l-4 4M8.5 15c2.5-5 5-7.5 8.5-7.5"/><path d="M13.5 6.5 17 7.5l-1 3.5"/>',
  tech:'<circle cx="14.5" cy="4.5" r="2"/><path d="M7 21l3.5-6 3 2.5V22M5 10.5 8.5 8h5l2 4 3.5 1M10.5 15l2.5-7"/>',
  method:'<rect x="3" y="3.5" width="18" height="12.5" rx="1"/><path d="M8 21l4-5 4 5M7 8h7M7 11.5h4"/>',
  error:'<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
  safety:'<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  trophy:'<path d="M8 4h8v6a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 14v4M8 21h8M9 18h6"/>',
  people:'<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2c3 .3 5 2.6 5 5.8"/>',
  music:'<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  book:'<path d="M2 5h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2zM22 5h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z"/>',
  write:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  kids:'<circle cx="8" cy="4.5" r="2"/><path d="M8 7.5v7M5 10.5h6M6 21l2-6.5 2 6.5"/><circle cx="17" cy="10.5" r="1.6"/><path d="M17 13v4M15 15h4M15.5 21l1.5-4 1.5 4"/>',
  dumbbell:'<path d="M6 6v12M18 6v12M3 9.5v5M21 9.5v5M6 12h12"/>',
  clock:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M10 2h4M12 2v3"/>',
  tree:'<rect x="9" y="3" width="6" height="4" rx="1"/><rect x="3" y="17" width="6" height="4" rx="1"/><rect x="15" y="17" width="6" height="4" rx="1"/><path d="M12 7v5M6 17v-5h12v5"/>',
  flag:'<path d="M5 21V4h11l-2 4 2 4H5"/>'
};
const CIC_RULES = [[/ошибк/,"error"],[/безопасн/,"safety"],[/судейств|судей|нарушен|фол|санкц|жест/,"whistle"],[/истори/,"history"],[/запис/,"write"],
  [/инвентар|оборудован|мяч,|ракетк/,"equip"],[/площадк|поле\b|поле,|разметк|^стол/,"court"],[/тактик/,"tactics"],[/правил|счёт|протокол|документ|положение о|календар/,"rules"],
  [/соревнован|зачёт|рекорд|многобор|гто/,"trophy"],[/методик|обучени|упражнени|разминк|занятие|урок|руководств|подготовк|объяснени/,"method"],
  [/музык|ритм|танц/,"music"],[/возраст/,"kids"],[/местност/,"flag"],[/участник|амплуа|рол[ье]|команд|строй/,"people"],[/качеств|нагрузк/,"dumbbell"],[/перерыв|время/,"clock"],
  [/классификац|группы и виды|виды и уровни/,"tree"],
  [/техник|приём|удар|подач|передач|стойк|перемещ|передвиж|блок|бег|ходьб|прыж|метан|ядр|копь|спринт|старт|эстафет|барьер|кросс|стипль|движен|положени|разбег/,"tech"]];
const CIC_EQ = {bd:"shuttle", nt:"paddle"};
const CIC_MEMO = {};
function icOf(n, ch){ n = (n||"").toLowerCase(); for(const [re, v] of CIC_RULES) if(re.test(n)) return v==="equip" ? CIC_EQ[ch] || "ball" : v; return null; }
function catIcon(it){   // сначала подзаголовок внутри раздела, потом название раздела
  const c = CAT[it.c]; if(!c) return "book"; if(c.ic) return c.ic;
  const key = it.c + "|" + (it.g||""); if(CIC_MEMO[key]) return CIC_MEMO[key];
  return CIC_MEMO[key] = (it.g && icOf(it.g, c.ch)) || icOf(c.name, c.ch) || "book";
}
const icThumb = it => `<span class="gth gthi"><svg viewBox="0 0 24 24" aria-hidden="true">${CIC[catIcon(it)]||CIC.book}</svg></span>`;
const thumb = it => { const f = it.figs && it.figs[0]; if(!f) return icThumb(it);   // выжимки-схемы (nt) тоже показываем картинкой — Даша хочет видеть её всегда
  if(FIG[f] && FIG[f][3] && it.nf > 1) return `<span class="gth"><img class="gimg1" src="${FIG[f][0]}" alt=""></span>`;   // лента цветных кадров — в списке только первый
  return `<span class="gth${FIG[f] && FIG[f][1]/FIG[f][2] > 1.5 ? " gw" : ""}">${FIG[f] ? fig(f) : ""}</span>`; };
const rowHTML = it => `<div class="grw" data-gopen="${esc(it.id)}">${thumb(it)}<span class="gct"><b>${sth(it.t)}</b><small>${esc(short(it))}</small></span>${spk(it.t)}${favBtn(it.id)}</div>`;
const wordRow = w => `<div class="grw mine" data-gwopen="${esc(w.id)}"><span class="gth gmy">✎</span><span class="gct"><b>${sth(w.t)}</b><small>${esc(Zh()?w.zh||w.d||"":w.d||w.zh||"")}</small></span>${spk(w.t)}${favBtn(w.id)}</div>`;
const nameOf = x => esc(tx(x.name, x.nz));
function results(){
  const q = G.q.trim(); if(!q) return "";
  const all = matches(q), lim = 60 + G.more*60, t = TL();
  // где искать: в главе, в разделе (гимнастика, игры…) или во всём словаре
  const tp = G.tab==="dict" && D.topics.find(x => x.id===G.topic), ch = tp && CHAP[G.ch];
  const opts = (ch ? [["ch", nameOf(ch), it => chOf(it)===ch.id]] : []).concat(tp && tp.chapters.length > 1 ? [["tp", nameOf(tp), it => TOPOF[chOf(it)]===tp]] : []).concat([["all", t.everywhere, () => true]]);
  const sc = opts.find(o => o[0]===G.scope) || opts[0];
  const items = all.items.filter(sc[2]), mine = sc[0]==="all" ? all.mine : [], n = items.length + mine.length;
  let h = opts.length > 1 ? `<div class="gscope">${opts.map(o => `<button class="${o===sc?"on":""}" data-gscope="${o[0]}">${o[0]==="all"?"":t.inW+" "}${o[1]} <small>${all.items.filter(o[2]).length + (o[0]==="all"?all.mine.length:0)}</small></button>`).join("")}</div>` : `<h3>${t.found(n)} · ${t.searchAll}</h3>`;
  h += mine.map(wordRow).join("");
  let shown = 0, last = null; const need = new Set();
  for(const it of items){ if(shown >= lim) break; const ch = chOf(it);
    if(ch !== last){ last = ch; const tp = TOPOF[ch]; h += `<div class="ggh">${tp?nameOf(tp)+" › ":""}${CHAP[ch]?nameOf(CHAP[ch]):""}</div>`; }
    if(!FIGL[ch]) need.add(ch); h += rowHTML(it); shown++; }
  need.forEach(loadFigs);
  if(items.length > shown) h += `<button class="btn wide ghost gmore" data-gmore>${TL().more} (${items.length-shown})</button>`;
  if(!n && sc[0]!=="all" && all.items.length + all.mine.length) return h + `<div class="empty">${t.noneHere}</div><button class="btn wide ghost" data-gscope="all">${t.searchAllBtn(all.items.length + all.mine.length)}</button>`;
  return h + (n ? "" : `<div class="empty">${t.none}</div><button class="btn wide" data-gnew>${t.add}</button>`);
}
const nMain = k => (BYCAT[k]||[]).filter(it => !it.x).length;   // x — редкий термин: в списке спрятан под «Ещё», в поиске есть
const countT = t => t.chapters.reduce((a,c) => a + (CHAP[c] ? countC(CHAP[c]) : 0), 0);
const countC = c => c.cats.reduce((b,k) => b + nMain(k), 0);
function crumb(){
  const t = TL(), tp = D.topics.find(x => x.id===G.topic), ch = CHAP[G.ch];
  return `<div class="gcrumb"><button data-gnav="root">${t.root}</button>${tp?` › ${ch?`<button data-gnav="topic">${nameOf(tp)}</button>`:`<b>${nameOf(tp)}</b>`}`:""}${ch?` › <b>${nameOf(ch)}</b>`:""}</div>`;
}
/* порядок и скрытые (DORD из app.js — общий с Карточками) */
const ordTopics = () => DORD.sort("root", D.topics.map(x => x.id)).map(id => D.topics.find(x => x.id===id)).filter(Boolean);
const ordChaps = tp => DORD.sort("t:"+tp.id, tp.chapters.filter(c => CHAP[c]));
const ordCats = ch => DORD.sort("c:"+ch.id, ch.cats.filter(k => CAT[k]));
const ordBtn = (lvl, nh) => `<button class="gordb" data-gord="${lvl}">${TL().ordB}${nh ? TL().ordHid(nh) : ""}</button>`;
function openOrd(lvl){
  const t = TL(), tp = D.topics.find(x => x.id===G.topic), ch = CHAP[G.ch];
  if(lvl==="root") return DORD.open("root", t.topicsT, "t", D.topics.map(x => ({id:x.id, name:`${TOPIC_EM[x.id]||"📘"} ${nameOf(x)}`})));
  if(lvl==="topic" && tp) return DORD.open("t:"+tp.id, tx(tp.name, tp.nz), "c", tp.chapters.filter(c => CHAP[c]).map(c => ({id:c, name:nameOf(CHAP[c])})));
  if(lvl==="ch" && ch) return DORD.open("c:"+ch.id, tx(ch.name, ch.nz), "k", ch.cats.filter(k => CAT[k]).map(k => ({id:k, name:esc(tx(CAT[k].name, CAT[k].nz))})));
}
const TOPIC_EM = {gym:"🤸", dance:"💃", athl:"🏃", games:"⚽", swim:"🏊", rus:"🗣", mych:"📝"};
function termsView(){
  const t = TL();
  if(!G.topic){
    const live = ordTopics().filter(tp => !DORD.hid("t:"+tp.id)).map(tp => `<button class="gtile" data-gtopic="${tp.id}">${FIG["g-tile-"+tp.id] ? `<span class="gill">${fig("g-tile-"+tp.id)}</span>` : `<span class="gem">${TOPIC_EM[tp.id]||"📘"}</span>`}<b>${nameOf(tp)}</b><small>${t.nTerms(countT(tp))} · ${t.nCh(tp.chapters.length)}</small></button>`).join("");
    const soon = t.soonT.filter(([e,n]) => !D.topics.some(tp => tx(tp.name,tp.nz)===n)).map(([e,n]) => `<div class="gtile soon">${(() => { const id = /Плав|游泳/.test(n) ? "swim" : /атлет|田径/.test(n) ? "athl" : ""; return id && FIG["g-tile-"+id] ? `<span class="gill">${fig("g-tile-"+id)}</span>` : `<span class="gem">${e}</span>`; })()}<b>${esc(n)}</b><small>${t.soon}</small></div>`).join("");
    return `<div class="gtiles">${live}${soon}</div>` + ordBtn("root", D.topics.filter(tp => DORD.hid("t:"+tp.id)).length);
  }
  const tp = D.topics.find(x => x.id===G.topic); if(!tp){ G.topic = null; return termsView(); }
  if(!G.ch){
    if(tp.my) return crumb() + MYCH.topicHTML();   // «Мои главы»: список глав и кнопки (mych.js)
    if(tp.chapters.length===1){ G.ch = tp.chapters[0]; return termsView(); }
    const chs = ordChaps(tp).filter(c => !DORD.hid("c:"+c)), ob = ordBtn("topic", tp.chapters.filter(c => CHAP[c] && DORD.hid("c:"+c)).length);
    if(tp.now && CHAP[tp.now]){   // раздел по семестру: текущая тема сверху, пройденные — сворачиваемым списком (сначала недавние)
      // ahead — темы впереди (ещё не начинали), ref — справочные главы вне семестра (лёгкая атлетика)
      const ahead = chs.filter(c => (tp.ahead||[]).includes(c) && c!==tp.now), ref = chs.filter(c => (tp.ref||[]).includes(c) && c!==tp.now);
      const nw = CHAP[tp.now], past = chs.filter(c => c!==tp.now && !ahead.includes(c) && !ref.includes(c)), open = LS.get("gPastOpen", {})[tp.id] !== false, semN = past.length + ahead.length + 1;
      const row = c => `<button class="gchr" data-gch="${c}"><b>${CHAP[c].em ? (isPic(CHAP[c].em) ? `<span class="emi">${emH(CHAP[c].em)}</span>` : CHAP[c].em+" ") : ""}${nameOf(CHAP[c])}</b><small>${t.nTerms(countC(CHAP[c]))}</small>${icon("chev","sm muted")}</button>`;
      const tail = (ahead.length ? `<div class="ggh">${t.aheadT}</div>` + ahead.map(row).join("") : "") + (ref.length ? `<div class="ggh">${t.refT}</div>` + ref.map(row).join("") : "");
      return crumb() + `<div class="gprog"><span>${t.passed(past.length, semN)}</span><i><b style="width:${Math.round(past.length/semN*100)}%"></b></i></div>`
        + `<button class="gnow" data-gch="${nw.id}"><span class="gbadge">${t.nowT}</span><b>${nw.em ? (isPic(nw.em) ? `<span class="emi">${emH(nw.em)}</span>` : nw.em+" ") : ""}${nameOf(nw)}</b><small>${t.nTerms(countC(nw))}</small></button>`
        + `<details class="gpast" data-gpast="${tp.id}"${open?" open":""}><summary>${icon("chev","sm")}<span>✓ ${t.pastT} · ${past.length}</span><small>${t.recent}</small></summary>`
        + past.map(c => `<button class="gchr done" data-gch="${c}"><span class="gck">✓</span><b>${nameOf(CHAP[c])}</b><small>${t.nTerms(countC(CHAP[c]))}</small>${icon("chev","sm muted")}</button>`).join("") + `</details>` + tail + ob;
    }
    return crumb() + chs.map(c => `<button class="gchr" data-gch="${c}"><b>${nameOf(CHAP[c])}</b><small>${t.nTerms(countC(CHAP[c]))}</small>${icon("chev","sm muted")}</button>`).join("") + ob;
  }
  const ch = CHAP[G.ch]; if(!ch){ G.ch = null; return termsView(); }
  loadFigs(ch.id);
  const cats = (ch.id==="oru" && D.rules && D.rules.length ? [{id:"rules", name:t.rulesChip, nz:t.rulesChip}] : []).concat(ordCats(ch).filter(k => !DORD.hid("k:"+k)).map(k => CAT[k]).filter(Boolean));
  if(!G.cat || !cats.some(c => c.id===G.cat)) G.cat = (cats.find(c => !c.x) || cats[0] || {}).id;
  const xcats = cats.filter(c => c.x), mcats = cats.filter(c => !c.x || c.id===G.cat);   // подразделы «для специалистов» — только в панели «Все»
  const ci = cats.findIndex(c => c.id===G.cat), cur = cats[ci];
  const grid = LS.get("gymGrid", false);
  let h = `<div class="gcrow">${crumb()}<button class="gview" data-gview aria-label="${grid?"☰":"▦"}">${grid?"☰":"▦"}</button></div>` + (ch.full ? `<div class="gfull">${esc(tx(ch.full, ch.fz))}</div>` : "") + (ch.my ? MYCH.chHead(ch.id) : "");
  const bar = `<div class="gchips gbar"><div class="gstrip">${mcats.map(c => `<button class="${c.id===G.cat?"on":""}" data-gcat="${c.id}">${esc(tx(c.name,c.nz))}</button>`).join("")}</div><button class="gallb${G.open?" on":""}" data-gtoggle>${t.allSec} ${G.open?"▴":"▾"}</button></div>`;
  if(cats.length < 2) {}
  else if(G.open){ h += bar; const b = c => `<button class="${c.id===G.cat?"on":""}" data-gcat="${c.id}">${esc(tx(c.name,c.nz))}<small>${c.id==="rules" ? D.rules.length : c.x ? (BYCAT[c.id]||[]).length : nMain(c.id)}</small></button>`;
    h += `<div class="gall">${cats.filter(c => !c.x).map(b).join("")}</div>` + (xcats.length ? `<div class="ggh">${t.extraH}</div><div class="gall">${xcats.map(b).join("")}</div>` : "") + (ch.my ? "" : ordBtn("ch", ch.cats.filter(k => DORD.hid("k:"+k)).length)); }
  else h += bar;
  if(G.cat==="rules") return h + rulesView();
  const c = CAT[G.cat]; if(!c) return h;
  if(c.tip) h += `<div class="gtip"><b>${t.how}</b> ${sth(Zh() ? c.tz||c.tip : c.tip)}</div>`;
  let g = null;
  if(c.x) h += `<div class="gtip">${t.extraCat}</div>`;
  const all0 = BYCAT[c.id]||[], all = all0.filter(it => !DORD.hid("i:"+it.id)), hidI = all0.filter(it => DORD.hid("i:"+it.id)), ext = c.x ? [] : all.filter(it => it.x);
  const gc = `grows${grid?" ggrid":""}`; h += `<div class="${gc}">`;
  all.filter(it => c.x || !it.x).forEach(it => { if(it.g && it.g!==g){ g = it.g; h += `<div class="ggh">${esc(tx(it.g, it.gz||it.g))}</div>`; } h += rowHTML(it); });
  h += `</div>`;
  if(ext.length) h += `<details class="gext"><summary>${icon("chev","sm")}<span>${t.extraSum(ext.length)}</span></summary><div class="${gc}">${ext.map(rowHTML).join("")}</div></details>`;
  if(hidI.length) h += `<details class="gext ghid"><summary>${icon("chev","sm")}<span>${t.hidH(hidI.length)}</span></summary><p class="muted small">${t.hidTip}</p><div class="${gc}">${hidI.map(rowHTML).join("")}</div></details>`;
  return h + (ch.my ? "" : isOff(ch.id) ? `<p class="goffok">${t.offDone}</p>` : `<button class="btn wide ghost goff" data-goff="${esc(ch.id)}">${t.offSave}</button>`);
}
function mineView(){
  const t = TL(), f = favs(), its = f.map(id => ITEM[id]).filter(Boolean), wf = myWords().filter(w => f.includes(w.id)), ws = myWords();
  const rc = recent().map(id => ITEM[id]).filter(Boolean).slice(0, G.recAll ? 50 : 8);
  its.concat(rc).forEach(it => loadFigs(chOf(it)));
  return (rc.length ? `<h3>${t.recentH}</h3>` + rc.map(rowHTML).join("") + (!G.recAll && recent().length > 8 ? `<button class="btn wide ghost gmore" data-grecall>${t.more}</button>` : "") : "")
    + `<h3>${t.favH}</h3>` + (its.length||wf.length ? wf.map(wordRow).join("") + its.map(rowHTML).join("") + (its.length ? `<button class="btn wide gfavlearn" data-gfavlearn>${t.favLearn(its.length)}</button>` : "") : `<div class="empty">${t.favNone}</div>`)
    + `<h3>${t.mineH}</h3><div class="gtip">${t.mineTip}</div>` + ws.map(wordRow).join("") + `<button class="btn wide" data-gnew>${t.add}</button>`;
}
const recent = () => { const v = LS.get("gymRecent", []); return Array.isArray(v) ? v : []; };
function openItem(id){
  const it = ITEM[id]; if(!it) return; loadFigs(chOf(it));
  LS.set("gymRecent", [id, ...recent().filter(x => x!==id)].slice(0, 50));
  pushSheet(itemSheet(id)); centerTerms();
}
// внизу карточки — лента всех терминов подраздела: текущий по центру, соседей видно, листается в стороны
const itemSheet = id => () => { if(!ITEM[id]) return closeSheet(); openSheet(`<div class="gym gsheet gitem" data-gid="${esc(id)}">${card(ITEM[id], termStrip(id))}</div>`); initCar(); };

/* ---------- рисунок из нескольких кадров: в карточке по одному кадру на всю ширину, листается стрелками и пальцем ---------- */
const FRC = {};   // id рисунка → {fr:[[a,b],…], W, H} — границы кадров (по прозрачным промежуткам)
// кадры карточки: кадры ленты-рисунка (nf) + остальные рисунки статьи (схема и официальный жест) — одной лентой, по одному кадру
// китайский режим: под русским рисунком — расшифровка надписей (it.lz = [[кадр, по-русски, 中文], …]); fr — номер кадра или null (все)
const lzHTML = (it, fr) => { if(!Zh() || !it.lz) return ""; const L = it.lz.filter(x => fr===null || x[0]===fr);
  return `<div class="glz" data-glz="${esc(it.id)}">${L.map(x => `<div><span>${esc(x[1])}</span><b>${esc(x[2])}</b></div>`).join("")}</div>`; };
const carOk = it => it.figs.length > 0 && it.figs.every(f => /^[gc]-/.test(f)) && (it.nf > 1 || it.figs.length > 1);
const carN = it => (it.nf > 1 ? it.nf : 1) + it.figs.length - 1;
const CARL = {};   // id статьи → [[рисунок, кадр], …]
const carHTML = it => `<div class="gcar" data-gcar="${esc(it.id)}"><div class="gcvw"><button class="gcv" data-gzoom="${esc(it.figs[0])}" data-gtitle="${esc(it.t)}" data-gfr="0" aria-label="+"></button></div>`
  + `<div class="gcn"><button data-gcs="-1" aria-label="‹">‹</button><span class="gcnn">1 / ${carN(it)}</span><button data-gcs="1" aria-label="›">›</button></div></div>`;
function frameCss(fid, i){   // стиль, показывающий i-й кадр ленты: маска/фон нужного размера, сдвинутые к кадру
  const f = FIG[fid], c = FRC[fid]; if(!f || !c) return ""; const [a, b] = c.fr[i], w = b - a, sz = `${(c.W / w * 100).toFixed(3)}% auto`, px = c.W > w ? (a / (c.W - w) * 100).toFixed(3) : 0, pos = `${px}% 0/${sz} no-repeat`;
  // все кадры одной ленты — в одном масштабе (узкий кадр не раздувается, широкий не сжимается сильнее остальных): подписи одного размера
  const geo = `aspect-ratio:${w}/${c.H};width:min(calc(100% * ${(w / c.mw).toFixed(4)}),calc(var(--gch) * ${(w / c.H).toFixed(4)})${f[5] ? `,calc(${f[5]}px * var(--gk) * ${(w / c.H).toFixed(4)})` : ""});`.replace("var(--gch)", f[5] ? "var(--gchf)" : "var(--gch)");   // фигурки: высота по масштабу, не растягиваются
  if(f[3]) return geo + `background:url(${f[0]}) ${pos}`;
  return geo + `-webkit-mask:url(${f[0]}) ${pos};mask:url(${f[0]}) ${pos};background:${f[4] ? `url(${f[4]}) ${pos},` : ""}var(--ink)`;
}
function withFrames(fid, n, cb){
  if(FRC[fid]) return cb(); const f = FIG[fid]; if(!f) return cb();
  const img = new Image(); img.onload = () => { const fr = frames(img, n); FRC[fid] = {fr, W: img.naturalWidth, H: img.naturalHeight, mw: Math.max(...fr.map(x => x[1] - x[0]))}; cb(); }; img.src = f[0];
}
function initCar(){
  const el = document.querySelector("#sheet .gcar"); if(!el) return; const it = ITEM[el.dataset.gcar];
  // официальные картинки (c-…) из нескольких жестов: кадры — по широким прозрачным промежуткам (0 — определить самим)
  const need = it.figs.map((f, k) => [f, k === 0 && it.nf > 1 ? it.nf : /^c-/.test(f) ? 0 : 1]); let left = need.length;
  const done = () => { if(--left) return; CARL[it.id] = need.flatMap(([f]) => FRC[f] ? FRC[f].fr.map((_, i) => [f, i]) : []); if(document.body.contains(el)) carDraw(el, 0); };
  need.forEach(([f, n]) => withFrames(f, n, done));
}
function carDraw(el, i){
  const L = CARL[el.dataset.gcar]; if(!L || !L.length) return; const n = L.length; i = (i + n) % n; const [fid, fi] = L[i];
  el.dataset.i = i; const v = el.querySelector(".gcv"); v.setAttribute("style", frameCss(fid, fi)); v.dataset.gzoom = fid; v.dataset.gfr = fi;
  el.querySelector(".gcnn").textContent = `${i+1} / ${n}`;
  const it = ITEM[el.dataset.gcar], lz = el.parentNode && el.parentNode.querySelector(".glz");
  if(lz) lz.outerHTML = /^g-/.test(fid) ? lzHTML(it, fi) || `<div class="glz"></div>` : `<div class="glz"></div>`;
  else if(it && it.lz && /^g-/.test(fid)) el.insertAdjacentHTML("afterend", lzHTML(it, fi));
}
let CSW = null;   // листание кадров пальцем (и чтобы при этом не переключался термин)
document.addEventListener("touchstart", e => { const g = e.target.closest && e.target.closest("#sheet .gcar"); CSW = g && e.touches.length===1 ? {g, x:e.touches[0].clientX, y:e.touches[0].clientY} : null; }, {passive:true});
document.addEventListener("touchend", e => { if(!CSW) return; const t = e.changedTouches[0], dx = t.clientX - CSW.x, dy = t.clientY - CSW.y, g = CSW.g; CSW = null;
  if(Math.abs(dx) < 40 || Math.abs(dy) > Math.abs(dx) * .7) return; carDraw(g, +(g.dataset.i||0) + (dx < 0 ? 1 : -1)); }, {passive:true});

/* ---------- увеличение рисунка: на весь экран, двумя пальцами, кнопками − ＋, двойным касанием ---------- */
function openZoom(ids, title, fr){
  pushSheet(() => {
    const inner = fr !== null && FRC[ids[0]] ? `<i class="gzf" style="${frameCss(ids[0], fr)}"></i>` : ids.map(f => fig(f)).join("");
    openSheet(`<div class="gym gzv"><h2>${sth(title)}</h2><div class="gzbar"><button data-gzz="-1" aria-label="−">−</button><span id="gzpct">100%</span><button data-gzz="1" aria-label="＋">＋</button></div>`
      + `<div class="gzsc" id="gzsc"><div class="gzin" id="gzin">${inner}</div></div><div class="gzhint">${Zh() ? "双指缩放 · 双击放大" : "Увеличить — двумя пальцами или двойным касанием"}</div></div>`);
    zoomInit();
  });
}
let ZM = {z:1};
function zoomSet(z, cx, cy){
  const sc = $("gzsc"), inn = $("gzin"); if(!sc || !inn) return; z = Math.max(1, Math.min(5, z)); const k = z / ZM.z;
  cx = cx != null ? cx : sc.clientWidth / 2; cy = cy != null ? cy : sc.clientHeight / 2; const x = sc.scrollLeft + cx, y = sc.scrollTop + cy;
  ZM.z = z; inn.style.width = (z * 100) + "%"; sc.scrollLeft = x * k - cx; sc.scrollTop = y * k - cy;
  const p = $("gzpct"); if(p) p.textContent = Math.round(z * 100) + "%";
}
function zoomInit(){
  const sc = $("gzsc"); if(!sc) return; ZM = {z:1}; let pin = null, lastTap = 0;
  const pt = (e, r = sc.getBoundingClientRect()) => [(e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left, (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top];
  const dist = e => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  sc.addEventListener("touchstart", e => {
    if(e.touches.length === 2){ pin = {d: dist(e), z: ZM.z}; return; }
    const now = Date.now(); if(now - lastTap < 300){ const r = sc.getBoundingClientRect(); zoomSet(ZM.z > 1.2 ? 1 : 2.5, e.touches[0].clientX - r.left, e.touches[0].clientY - r.top); lastTap = 0; } else lastTap = now;
  }, {passive:true});
  sc.addEventListener("touchmove", e => { if(e.touches.length !== 2 || !pin) return; e.preventDefault(); const [cx, cy] = pt(e); zoomSet(pin.z * dist(e) / pin.d, cx, cy); }, {passive:false});
  sc.addEventListener("touchend", e => { if(e.touches.length < 2) pin = null; }, {passive:true});
}
function termStrip(id){
  const it = ITEM[id], c = CAT[it.c], list = (BYCAT[it.c]||[]).filter(x => (c && c.x) || !x.x || it.x); if(list.length < 2) return "";
  return `<div class="gtstrip"><div class="gts">${list.map(x => `<button class="${x.id===id?"on":""}" data-gnext="${esc(x.id)}">${thumb(x)}<b>${sth(x.t)}</b></button>`).join("")}</div></div>`;
}
function centerTerms(){ setTimeout(() => { const s = document.querySelector("#sheet .gts"), on = s && s.querySelector(".on"); if(on) s.scrollLeft = on.offsetLeft - (s.clientWidth - on.offsetWidth)/2; }, 0); }
let SW = null;
document.addEventListener("touchstart", e => { const g = e.target.closest && e.target.closest("#sheet .gitem"); SW = g && !e.target.closest(".gts,.gcar") && e.touches.length===1 ? {x:e.touches[0].clientX, y:e.touches[0].clientY} : null; }, {passive:true});
document.addEventListener("touchend", e => { if(!SW) return; const t = e.changedTouches[0], dx = t.clientX - SW.x, dy = t.clientY - SW.y; SW = null;
  if(Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * .6) return;
  const s = document.querySelector("#sheet .gts"); if(!s) return; const bs = [...s.querySelectorAll("button")], i = bs.findIndex(b => b.classList.contains("on")), nb = bs[i + (dx < 0 ? 1 : -1)];
  if(nb){ switchItem(nb.dataset.gnext, dx < 0 ? 1 : -1); } }, {passive:true});
function switchItem(id, dir){
  if(!ITEM[id] || !SH.length) return; LS.set("gymRecent", [id, ...recent().filter(x => x!==id)].slice(0, 50));
  SH[SH.length-1] = itemSheet(id); SH[SH.length-1](); $("sheet").scrollTop = 0; centerTerms();
  const c = document.querySelector("#sheet .gcard"); if(c && dir) c.animate([{transform:`translateX(${dir*40}px)`, opacity:.3}, {transform:"none", opacity:1}], {duration:180, easing:"ease-out"});
}
function openMine(id){ const w = myWords().find(x => x.id===id); if(!w) return; pushSheet(() => openSheet(`<div class="gym gsheet gitem">${wordCard(w)}</div>`)); }

/* ---------- правила ---------- */
function rulesView(){
  let h = `<div class="gtip">${TL().rulesTip}</div>`;
  D.rules.forEach((r,i) => {
    h += `<div class="gcard col"><b class="gh4">${i+1}. ${esc(tx(r.h,r.hz))}</b><div class="gd">${esc(tx(r.d,r.dz))}</div>
      ${r.ok.map(t => `<div class="gok"><i>✓</i><span>${sth(t)}</span>${spk(t)}</div>`).join("")}
      ${r.no.map(t => `<div class="gno"><i>✕</i><span>${esc(t)}</span></div>`).join("")}
      <div class="gsrc">${Zh()?TL().book+" "+r.p+" 页":TL().book+" "+r.p}</div></div>`;
  });
  return h;
}

/* ---------- конструктор ---------- */
const ARMW = {"вниз":"вниз","в стороны":"в сто`роны","вперёд":"вперёд","вверх":"вверх","назад":"наза`д","в стороны — кверху":"в сто`роны — кве`рху","вверх наружу":"вверх нару`жу",
  "на пояс":"на по`яс","к плечам":"к плеча`м","за голову":"за го`лову","за спину":"за спи`ну","перед грудью":"пе`ред гру`дью","перед собой":"пе`ред собо`й"};
const ARMZH = {"вниз":"两臂下垂","в стороны":"侧平举","вперёд":"前平举","вверх":"上举","назад":"后举","в стороны — кверху":"侧上举","вверх наружу":"上举外展",
  "на пояс":"叉腰","к плечам":"两手触肩","за голову":"抱头","за спину":"背手","перед грудью":"胸前屈臂","перед собой":"胸前交叠","согн:в стороны":"侧屈臂","согн:вперёд":"前屈臂"};
const ARMPOSE = {"вниз":"down","в стороны":"side","вперёд":"fwd","вверх":"up","назад":"back","в стороны — кверху":"sideUp","вверх наружу":"upOut",
  "на пояс":"hips","к плечам":"shoulders","за голову":"head","за спину":"behind","перед грудью":"chest","перед собой":"front","согн:в стороны":"bentSide","согн:вперёд":"bentFwd"};
const ARMNAME = k => Zh() ? ARMZH[k]||k : (k.startsWith("согн:") ? "руки согнуты "+k.slice(5) : "руки "+k);
const STD = ["на пояс","к плечам","за голову","за спину","перед грудью","перед собой"];
const SIMPLE = {"вниз":["в стороны","вперёд","назад","вверх"],"в стороны":["вниз","вперёд","вверх","назад","в стороны — кверху","вверх наружу"],
  "вперёд":["вниз","в стороны","вверх","вверх наружу"],"вверх":["вниз","в стороны","вперёд","вверх наружу","в стороны — кверху"],"назад":["вниз","в стороны"],
  "в стороны — кверху":["в стороны","вверх"],"вверх наружу":["вверх","в стороны","вперёд"]};
const ru = k => "ру`ки "+ARMW[k];
const putCmd = k => cap(ru(k))+" — ставь!";
const BODYNAME = {stand:["основная стойка","基本站立"],apart:["стойка ноги врозь","开立"],knees:["на коленях","跪立"],lunge:["выпад","弓步"],squat:["присед","蹲"],bend:["наклон","屈体"],
  sit:["сед","坐"],lie:["лёжа","卧"],toe:["нога на носке","脚尖点地"],toes:["на носках","提踵"],legbent:["нога согнута","屈腿"],turn:["поворот туловища","转体"]};
const N = (ru, zh) => ({ru, zh});
const NOTE = {
  std: k => N(`Из «руки ${k}» слово «разогнуть» не говорим — просто новое положение.`, `从“руки ${k}”（${ARMZH[k]}）伸直时不说“разогнуть”，只说新位置。`),
  unbendSame: N("Локти не меняют положения — направление не называем. И не «выпрямить руки».","肘的位置不变——不说方向。也不说“выпрямить руки”。"),
  unbendDir: N("Локти меняют положение — направление называем.","肘的位置改变——要说方向。"),
  arcFwd: N("«Дугами вперёд» не говорим — это обычный путь рук.","不说“дугами вперёд”——这是手臂的常规路线。"),
  simple: N("Простое движение (до 90°) — называем только новое положение, без «поднять» или «развести».","简单动作（不超过90°）——只说新位置，不说“поднять”或“развести”。"),
  bendSame: N("Локти остаются на месте — направление не называем.","肘不动——不说方向。"),
  bendDown: N("Локти поднимаются вперёд — направление называем.","肘向前抬起——要说方向。"),
  circle: N("Круг заканчивается там же, где начался; называем, куда руки начинают движение.","绕环回到起点；说手臂开始运动的方向。"),
  arc: N("Порядок: «дугами» → куда начинаем → «руки» → где заканчиваем.","词序：“дугами” → 开始方向 → “руки” → 结束位置。"),
  ipLast: N("На последний счёт можно сказать просто «и. п.» — исходное положение.","最后一拍可以只说“и. п.”——预备姿势。"),
  ipExtra: N("Уже в исходном положении — этот счёт лишний.","已经在预备姿势了——这一拍是多余的。"),
};
function armOpts(k){
  const r = [];
  if(STD.includes(k)){
    ["вниз","в стороны","вперёд","вверх"].forEach(P => r.push({g:"pos",t:ru(P),to:P,cmd:putCmd(P),note:P==="вниз"?null:NOTE.std(k)}));
    STD.filter(Q => Q!==k).forEach(Q => r.push({g:"pos",t:ru(Q),to:Q,cmd:putCmd(Q)}));
  } else if(k.startsWith("согн:")){
    const d = k.slice(5);
    r.push({g:"bend",t:"разогну`ть ру`ки",to:d,cmd:"Разогну`ть ру`ки!",note:NOTE.unbendSame});
    ["вверх","вперёд","в стороны"].filter(P => P!==d).forEach(P => r.push({g:"bend",t:"разогну`ть ру`ки "+ARMW[P],to:P,cmd:"Разогну`ть ру`ки "+ARMW[P]+"!",note:NOTE.unbendDir}));
  } else {
    (SIMPLE[k]||[]).forEach(P => r.push({g:"pos",t:ru(P),to:P,cmd:putCmd(P), note:(k==="вниз"&&P==="вверх")||(k==="вверх"&&P==="вниз") ? NOTE.arcFwd : NOTE.simple}));
    if(k==="в стороны"||k==="вперёд") r.push({g:"bend",t:"согну`ть ру`ки",to:"согн:"+k,cmd:"Согну`ть ру`ки!",note:NOTE.bendSame});
    if(k==="вниз") r.push({g:"bend",t:"согну`ть ру`ки вперёд",to:"согн:вперёд",cmd:"Согну`ть ру`ки вперёд!",note:NOTE.bendDown});
    STD.forEach(Q => r.push({g:"pos",t:ru(Q),to:Q,cmd:putCmd(Q)}));
    D.moves.arcs.filter(a => a.from.includes(k)).forEach(a => r.push({g:"arc",t:a.t,to:a.to,note:a.t.startsWith("круг")?NOTE.circle:NOTE.arc}));
  }
  return r;
}
const armKey = t => plain(t).replace(/^руки /,"");
function bFig(leg, armK){
  const a = ARMPOSE[armK] || "down", lv = Figure.LEGS[leg].view||0, lying = /^(lie|sit|plank)/.test(leg);
  const code = lying ? `${leg}|${armK==="вниз"?"":a}` : `${leg}|${a}|${lv===0?-30:-62}`;
  return genFig("b:"+code, [code]);
}
/* ---------- конструктор: 5 частей тела в одном счёте ----------
   Порядок в счёте (учебник, с. 12): ноги / всё тело → туловище → руки → голова → кисти, через запятую.
   Ноги и туловище одновременно — «с» + творительный: «выпад вправо с наклоном вперёд».
   Возвраты (с. 69): встать, выпрямиться, опуститься, приставить, обратный поворот; «и. п.» — на любом счёте. */
const NS = (ru, zh) => ru ? {ru, zh} : null;
const bodyNote = t => { const m = D.moves.body.find(x => norm(x.t)===norm(t)); return m && m.note ? NS(m.note, m.nz) : null; };
const bodyCmd = t => { const m = D.moves.body.find(x => norm(x.t)===norm(t)); return m ? m.cmd||"" : ""; };
const LEGM = [   // st — чем становятся ноги; pose — рисунок; side — какая нога (для «приставить»)
  {k:"squat", t:"присе`д", st:"squat", pose:"squat", from:["stand"]},
  {k:"halfSquat", t:"полуприсе`д", st:"squat", pose:"halfSquat", from:["stand","apart"]},
  {k:"lungeR", t:"вы`пад пра`вой", st:"lunge", pose:"lungeR", side:"R", mir:"leg", from:["stand"]},
  {k:"lungeL", t:"вы`пад ле`вой", st:"lunge", pose:"lungeL", side:"L", mir:"leg", from:["stand"], cmd:"Вы`пад ле`вой — приня`ть!", like:"вы`пад пра`вой"},
  {k:"lungeRight", t:"вы`пад впра`во", st:"lunge", pose:"lungeRight", side:"R", mir:"side", from:["stand"]},
  {k:"lungeLeft", t:"вы`пад вле`во", st:"lunge", pose:"lungeLeft", side:"L", mir:"side", from:["stand"], cmd:"Вы`пад вле`во — приня`ть!", like:"вы`пад впра`во"},
  {k:"toeFwd", t:"пра`вую вперёд на носо`к", st:"toe", pose:"toeFwd", side:"R", mir:"leg", from:["stand"]},
  {k:"toeSide", t:"пра`вую в сто`рону на носо`к", st:"toe", pose:"oneSideToe", side:"R", mir:"leg", from:["stand"]},
  {k:"toeBack", t:"пра`вую наза`д на носо`к", st:"toe", pose:"toeBack", side:"R", mir:"leg", from:["stand"]},
  {k:"kick", t:"мах пра`вой вперёд", st:null, pose:"kick", mir:"leg", from:["stand"]},
  {k:"legBent", t:"согну`ть пра`вую", st:"legbent", pose:"legBent", side:"R", mir:"leg", from:["stand"]},
  {k:"toes", t:"подня`ться на носки`", st:"toes", pose:"onToes", from:["stand","apart"]}];
const LEGBACK = {squat:"встать", toes:"опусти`ться", toe:"приста`вить #", legbent:"приста`вить #", lunge:"толчко`м приста`вить #"};
const TORM = {
  bendFwd:{t:"накло`н вперёд", ins:"с накло`ном вперёд", P:{pitch:88}, cmd:"Наклони`ться!", rt:"vy"},
  bendR:{t:"накло`н впра`во", ins:"с накло`ном впра`во", P:{roll:38}, cmd:"Наклони`ться впра`во!", mir:"side", rt:"vy"},
  bendL:{t:"накло`н вле`во", ins:"с накло`ном вле`во", P:{roll:-38}, cmd:"Наклони`ться вле`во!", mir:"side", rt:"vy"},
  halfBend:{t:"полунакло`н вперёд", ins:"с полунакло`ном вперёд", P:{pitch:45}, rt:"vy"},
  bendBack:{t:"накло`н наза`д", ins:"с накло`ном наза`д", P:{pitch:-30}, cmd:"Наклони`ться наза`д!", rt:"vy"},
  turnR:{t:"поворо`т ту`ловища напра`во", ins:"с поворо`том ту`ловища напра`во", P:{yaw:70}, mir:"side", rt:"turn"},
  turnL:{t:"поворо`т ту`ловища нале`во", ins:"с поворо`том ту`ловища нале`во", P:{yaw:-70}, mir:"side", rt:"turn", like:"поворо`т ту`ловища напра`во"}};
const TORBACK = {vy:{t:"вы`прямиться", cmd:"Вы`прямиться!"}, turn:{t:"обра`тный поворо`т ту`ловища"}};
const HEADM = {
  fwd:{t:"накло`н головы` вперёд", P:{pitch:40}}, back:{t:"накло`н головы` наза`д", P:{pitch:-35}},
  right:{t:"накло`н головы` впра`во", P:{roll:30}, mir:"side"}, left:{t:"накло`н головы` вле`во", P:{roll:-30}, mir:"side"},
  turnR:{t:"поворо`т головы` напра`во", P:{yaw:75}, mir:"side", turn:1}, turnL:{t:"поворо`т головы` нале`во", P:{yaw:-75}, mir:"side", turn:1}};
const HANDM = {fist:{t:"ки`сти в кула`к"}, open:{t:"разогну`ть па`льцы"}};
const CH = ["legs","torso","arms","head","hands"];
const NOTE2 = {
  withS: N("Ноги и туловище двигаются одновременно — соединяем через «с»: «выпад вправо с наклоном вперёд».","腿和躯干同时动作——用“с”连接：«выпад вправо с наклоном вперёд»。"),
  order: N("Порядок: сначала ноги и туловище, потом руки, голова, кисти — через запятую.","顺序：先说腿和躯干，再说手臂、头、手腕，用逗号隔开。"),
  head: N("Голову называем всегда: «наклон головы», иначе это наклон туловища.","头一定要说出来：«наклон головы»，否则就是躯干前屈。"),
  turnT: N("Поворот — направо/налево, наклон — вправо/влево.","转体说“направо/налево”，侧屈说“вправо/влево”。")};
const legPoseOf = e => e.lg ? e.lg.pose : e.basePose;
// рисунок состояния: ноги из позы, туловище и голова — поверх
function stFig(e, kickPose){
  const leg = kickPose || legPoseOf(e), L = Figure.LEGS[leg] || Figure.LEGS.stand, lying = /^(lie|sit|plank)/.test(leg);
  const tor = e.torso ? TORM[e.torso].P : (L.torso || null), head = e.head ? HEADM[e.head].P : (L.head || null);
  const arm = lying && e.arms==="вниз" ? undefined : (ARMPOSE[e.arms] || "down");
  let view = L.view||0; const pitch = (tor&&tor.pitch) || (head&&head.pitch), side = (tor&&(tor.roll||tor.yaw)) || (head&&(head.roll||head.yaw));
  if(!lying){ if(pitch && view===0) view = -62; else if(side && view===-90) view = -35; else if(!pitch && !side) view = view===0 ? -30 : -62; }
  const extra = {view}; if(tor) extra.torso = tor; if(head) extra.head = head;
  const key = "s:"+[leg, arm||"", JSON.stringify(tor||{}), JSON.stringify(head||{}), view].join("|");
  if(!FIG[key]){ const cv = Figure.render([Figure.pose(leg, arm, extra)]); FIG[key] = [cv.toDataURL("image/png"), cv.width, cv.height]; }
  return key;
}
function startEx(){
  const Lg = D.builder.legs[G.legs], A = D.builder.arms[G.arms], st = Lg.st;
  const e = {lines:[], cnt:0, hist:[], blockStart:0, blockMir:null, base:"stand", basePose:"stand", lg:null, torso:null, arms:armKey(A.t), head:null, hands:null, fixed:false};
  if(st==="stand"||st==="apart"){ e.base = st; e.basePose = Lg.pose; }
  else if(st==="squat"||st==="lunge") e.lg = {st, pose:Lg.pose, side:/L|Left/.test(Lg.pose)?"L":"R"};
  else if(st==="bend") e.torso = "bendFwd";
  else { e.fixed = st; e.basePose = Lg.pose; e.base = st; }   // сед, лёжа, на коленях — ноги не двигаем
  e.start = {lg:e.lg, torso:e.torso, arms:e.arms, head:null, hands:null};
  G.ex = e;
}
const atStart = e => JSON.stringify([e.lg,e.torso,e.arms,e.head,e.hands])===JSON.stringify([e.start.lg,e.start.torso,e.start.arms,e.start.head,e.start.hands]);
function exOpts(e){
  const o = {legs:[], torso:[], arms:[], head:[], hands:[]};
  if(!e.fixed){
    if(!e.lg){ if(!e.torso) LEGM.filter(m => m.from.includes(e.base)).forEach(m => o.legs.push(Object.assign({}, m, {cmd:m.cmd||bodyCmd(m.t), note:bodyNote(m.like||m.t)}))); }
    else { const bt = LEGBACK[e.lg.st]; if(bt){ const t = bt.replace("#", e.lg.side==="L"?"ле`вую":"пра`вую"); o.legs.push({k:"back", t, back:1, cmd:bodyCmd(bt.replace("#","пра`вую"))}); } }
  }
  const torsoOk = !e.fixed ? (!e.lg || e.lg.st==="lunge" || (e.lg.pose==="halfSquat")) : (e.fixed==="sit"||e.fixed==="knees");
  if(e.torso) o.torso.push(Object.assign({k:"back", back:1}, TORBACK[TORM[e.torso].rt]));
  else if(torsoOk) Object.keys(TORM).filter(k => !e.fixed || /^turn/.test(k)).forEach(k => o.torso.push(Object.assign({k}, TORM[k], {note: TORM[k].like||k==="turnR" ? bodyNote("поворо`т ту`ловища напра`во") : /^bend[RL]/.test(k) ? NOTE2.turnT : null})));
  o.arms = armOpts(e.arms);
  Object.keys(HEADM).filter(k => k!==e.head).forEach(k => o.head.push(Object.assign({k}, HEADM[k], {note:NOTE2.head})));
  if(e.head && HEADM[e.head].turn) o.head.unshift({k:"back", t:"обра`тный поворо`т головы`", back:1});
  o.hands.push(e.hands==="fist" ? {k:"open", t:HANDM.open.t} : {k:"fist", t:HANDM.fist.t});
  return o;
}
// что получится, если выбрать pick = {legs:i, torso:i, arms:i, head:i, hands:i}
function exPreview(e, pick){
  const o = exOpts(e), g = c => pick[c]!==null && pick[c]!==undefined ? o[c][pick[c]] : null;
  const Lm = g("legs"), Tm = g("torso"), Am = g("arms"), Hm = g("head"), Km = g("hands");
  const parts = [], notes = []; let withS = false;
  if(Lm && Tm && !Lm.back && !Tm.back){ parts.push(Lm.t+" "+Tm.ins); withS = true; }
  else { if(Lm) parts.push(Lm.t); if(Tm) parts.push(Tm.t); }
  [Am,Hm,Km].forEach(m => { if(m) parts.push(m.t); });
  const txt = parts.join(", ");
  const n = [Lm,Tm,Am,Hm,Km].filter(Boolean).length, main = Lm || Tm;
  let cmd = "";
  if(n===1) cmd = (Lm||Tm||Am||{}).cmd || "";
  else if(main && !withS){ const c = main.cmd; const rest = parts.slice(1).join(", ");
    cmd = c && !c.includes("—") ? c.replace(/!$/,"")+", "+rest+"!" : cap(txt)+" — приня`ть!"; }
  else if(main) cmd = cap(txt)+" — приня`ть!";
  [Lm,Tm,Am,Hm].forEach(m => { if(m && m.note) notes.push(m.note); });
  if(withS) notes.unshift(NOTE2.withS); if(n>=3) notes.push(NOTE2.order);
  return {txt, cmd, notes, Lm, Tm, Am, Hm, Km, n};
}
function exApply(e, pick){
  const p = exPreview(e, pick); if(!p.n) return null;
  const s = JSON.parse(JSON.stringify(Object.assign({}, e, {hist:[]}))); let kick = null;
  if(p.Lm){ if(p.Lm.back) s.lg = null; else if(p.Lm.st) s.lg = {st:p.Lm.st, pose:p.Lm.pose, side:p.Lm.side||null, k:p.Lm.k}; else kick = p.Lm.pose; }
  if(p.Tm) s.torso = p.Tm.back ? null : p.Tm.k;
  if(p.Am) s.arms = p.Am.to;
  if(p.Hm) s.head = p.Hm.back ? null : p.Hm.k;
  if(p.Km) s.hands = p.Km.k==="fist" ? "fist" : null;
  const mir = [p.Lm,p.Tm,p.Hm].map(m => m && m.mir).find(Boolean); if(mir && s.blockMir!=="leg") s.blockMir = mir;
  return {s, p, kick};
}
function addPick(pick){
  const e = G.ex, r = exApply(e, pick); if(!r) return; exSnap();
  const s = r.s; s.hist = e.hist; s.cnt = e.cnt+1;
  s.lines = e.lines.concat([{n:String(s.cnt), txt:r.p.txt, cmd:r.p.cmd, notes:r.p.notes, fig:stFig(s, r.kick)}]);
  G.ex = s;
}
function exSnap(){ const e = G.ex; e.hist.push(JSON.stringify(Object.assign({}, e, {hist:[]}))); }
function addIp(){
  const e = G.ex; if(!e.cnt) return; exSnap(); const was = atStart(e);
  Object.assign(e, JSON.parse(JSON.stringify(e.start))); e.cnt++;
  e.lines.push({n:String(e.cnt), txt:"и. п.", cmd:"", notes:[was?NOTE.ipExtra:NOTE.ipLast], fig:stFig(e)});
}
const canRepeat = () => { const e = G.ex; return e.cnt>e.blockStart && atStart(e); };
function addRepeat(){
  const e = G.ex; if(!canRepeat()) return; exSnap();
  const n = e.cnt-e.blockStart, a = e.cnt+1, z = e.cnt+n;
  const txt = e.blockMir==="leg" ? "то же с друго`й ноги`" : e.blockMir==="side" ? "то же в другу`ю сто`рону" : "то же";
  e.lines.push({n:a+"–"+z, txt, cmd:"", notes:[], fig:null});
  e.cnt = z; e.blockStart = z; e.blockMir = null;
}
function undo(){ const e = G.ex; if(!e.hist.length) return; const h = e.hist.slice(0,-1), prev = JSON.parse(e.hist[e.hist.length-1]); G.ex = Object.assign(prev, {hist:h}); }
function ipPhrase(){
  const Lg = D.builder.legs[G.legs], A = D.builder.arms[G.arms];
  if(A.none) return {txt:Lg.t, rule:N("Руки вниз — обычное положение, его не называем.","两臂下垂是默认姿势，不用说。")};
  if(Lg.withArms) return {txt:Lg.withArms+", "+A.t, rule:N("Ноги как в основной стойке, но руки другие — говорим просто «стойка» и называем руки.","腿同基本站立、手臂不同时，只说“стойка”，再说手臂。")};
  return {txt:Lg.t+", "+A.t, rule:N("Сначала ноги и туловище, потом через запятую — руки.","先说腿和身体，再用逗号接手臂。")};
}
const ipText = () => { const p = ipPhrase().txt; return p.charAt(0).toLowerCase()+p.slice(1); };
function exerciseText(){
  return ["И. п. — "+plain(ipText())].concat(G.ex.lines.map(l => l.n+" — "+plain(l.txt))).join(";\n") + ".";
}
const note = n => `<div class="gnote">${Zh()?esc(n.zh):sth(n.ru)}</div>`;
const EXAMPLES = [
  {ru:"Руки", zh:"手臂", legs:"Основна`я сто`йка", arms:"ру`ки вниз", steps:[{arms:"руки в стороны"},{arms:"руки вверх"},{arms:"руки в стороны"},"ip"]},
  {ru:"Наклоны", zh:"体侧屈", legs:"Сто`йка но`ги врозь", arms:"ру`ки на по`яс", steps:[{torso:"наклон вправо"},{torso:"выпрямиться"},"rep"]},
  {ru:"Выпады", zh:"弓步", legs:"Основна`я сто`йка", arms:"ру`ки на по`яс", steps:[{legs:"выпад правой"},{legs:"толчком приставить правую"},"rep"]},
  {ru:"Приседы", zh:"蹲", legs:"Основна`я сто`йка", arms:"ру`ки вниз", steps:[{legs:"присед", arms:"руки вперёд"},{legs:"встать", arms:"руки вниз"}]},
  {ru:"Голова", zh:"头部", legs:"Основна`я сто`йка", arms:"ру`ки на по`яс", steps:[{head:"поворот головы направо"},{head:"обратный поворот головы"},"rep"]},
  {ru:"Всё вместе", zh:"组合", legs:"Основна`я сто`йка", arms:"ру`ки вниз", steps:[{legs:"выпад вправо", torso:"наклон вперёд", arms:"руки в стороны"},"ip",{legs:"выпад влево", torso:"наклон вперёд", arms:"руки вверх", head:"наклон головы назад"},"ip"]}];
function runExample(i){
  const x = EXAMPLES[i], B = D.builder; if(!x) return;
  G.legs = Math.max(0, B.legs.findIndex(l => l.t===x.legs)); G.arms = Math.max(0, B.arms.findIndex(a => a.t===x.arms)); startEx();
  x.steps.forEach(st => {
    if(st==="ip") return addIp(); if(st==="rep") return addRepeat();
    const o = exOpts(G.ex), pick = {};
    CH.forEach(c => { if(st[c]){ const i = o[c].findIndex(m => norm(m.t)===norm(st[c])); if(i>=0) pick[c] = i; } });
    addPick(pick); });
  G.ex.hist = [];
}
const lineFig = l => l.fig || null;
function builderView(){
  if(!G.ex || !G.ex.start || G.ex.start.lg===undefined) startEx();
  const e = G.ex, t = TL(), ip = ipText(), ipF = stFig(Object.assign({}, e, e.start));
  const lastF = (() => { for(let i=e.lines.length-1;i>=0;i--){ if(e.lines[i].fig) return e.lines[i].fig; } return ipF; })();
  let h = `<div class="gexm"><small>${t.exStart}</small>${EXAMPLES.map((x,i) => `<button data-gex="${i}">${esc(tx(x.ru,x.zh))}</button>`).join("")}</div>`;
  h += `<div class="gcard col gexc"><div class="gexh"><b>${t.myEx}</b><button class="gplay" data-gplay ${e.lines.length?"":"disabled"}>${G.play?t.stop:t.play}</button></div>
    <div class="gstage" id="gstage">${fig(lastF)}</div>
    <div class="gl2 gip2" id="gl-ip" data-gipopen><span class="gn">И. п.</span><span class="gtx">${sth(ip)}<small>${t.tapIp}</small></span><span class="gmini">${fig(ipF)}</span><span class="gi">✎</span></div>`;
  e.lines.forEach((l,i) => { const f = lineFig(l);
    h += `<div class="gl2" id="gl-${i}"><span class="gn">${l.n}</span><span class="gtx">${sth(l.txt)}</span><span class="gmini">${f?fig(f):""}</span>${l.notes.length||l.cmd?`<button class="gi" data-ginfo="${i}" aria-label="ⓘ">ⓘ</button>`:`<span class="gi"></span>`}</div>`; });
  if(!e.lines.length) h += `<div class="gsrc">${t.first2}</div>`;
  else h += `<div class="gtools2"><button data-gipnow>↩ ${e.cnt+1} — и. п.</button><button data-grep ${canRepeat()?"":"disabled"}>⇄ ${t.repS}</button><button data-gundo ${e.hist.length?"":"disabled"}>↶ ${t.undoS}</button><button data-gclr>✕ ${t.clrS}</button><button data-gcopy>${icon("share","sm")} ${t.copyS}</button></div>`;
  h += `</div><button class="btn wide gplus" data-gpick>＋ ${t.countN(e.cnt+1)}</button><p class="gsrc">${t.read}</p>`;
  return h;
}
const tile = (attr, i, f, label, on, emj) => `<button class="gpt ${on?"on":""}" ${attr}="${i}"><span>${emj?`<b class="gemj">${emj}</b>`:f?fig(f):""}</span><small>${sth(label)}</small></button>`;
function openPick(){
  const e = G.ex, t = TL(), o = exOpts(e), n = e.cnt+1; G.pk = {};
  const prev = (c, i) => { const r = exApply(e, {[c]:i}); return r ? stFig(r.s, r.kick) : null; };
  const sec = c => o[c].length ? `<div class="ggh">${t.chH[c]}</div><div class="gpg">${o[c].map((m,i) => tile("data-gp", c+":"+i, c==="hands"?null:prev(c,i), m.t, false, c==="hands" ? (m.k==="fist"?"✊":"🖐") : null)).join("")}</div>` : "";
  pushSheet(() => openSheet(`<div class="gym gsheet"><h2>${t.pickT(n)}</h2><p class="muted small">${t.pickHint}</p>
    ${e.cnt||canRepeat() ? `<div class="gquick">${e.cnt?`<button data-gpip>↩ ${n} — и. п.</button>`:""}${canRepeat()?`<button data-gprep>⇄ ${t.rep}</button>`:""}</div>` : ""}
    ${["legs","torso","arms"].map(sec).join("")}
    <details class="gmore2" ${e.head||e.hands?"open":""}><summary>${t.moreCh}</summary>${["head","hands"].map(sec).join("")}</details>
    <div class="gpfoot"><div class="gpprev" id="gpprev"></div><button class="btn wide" id="gpadd" data-gpadd disabled>${t.pickNone}</button></div></div>`));
}
function pickLabel(){
  const e = G.ex, t = TL(), p = exPreview(e, G.pk);
  const btn = $("gpadd"); if(btn){ btn.disabled = !p.n; btn.innerHTML = `<span>${p.n ? sth(t.addN(e.cnt+1, p.txt)) : t.pickNone}</span>`; }
  const pv = $("gpprev"); if(pv){ const r = p.n ? exApply(e, G.pk) : null; pv.innerHTML = r ? fig(stFig(r.s, r.kick)) : ""; }
}
function openIp(){
  const t = TL(), B = D.builder; G.ipk = {l:G.legs, a:G.arms};
  pushSheet(() => openSheet(`<div class="gym gsheet"><h2>${t.ipT}</h2><p class="muted small">${t.ipHint}</p>
    <div class="ggh">${t.bodyH}</div><div class="gpg">${B.legs.map((L,i) => tile("data-gil", i, bFig(L.pose, armKey(B.arms[G.ipk.a].t)), L.t, i===G.ipk.l)).join("")}</div>
    <div class="ggh">${t.armsH}</div><div class="gpg">${B.arms.map((A,i) => tile("data-gia", i, bFig(B.legs[G.ipk.l].pose, armKey(A.t)), A.t, i===G.ipk.a)).join("")}</div>
    <div class="gpfoot"><button class="btn wide" data-gipok>${t.ipOk}</button></div></div>`));
}
function openInfo(i){
  const l = G.ex.lines[i], t = TL(); if(!l) return; const f = lineFig(l);
  pushSheet(() => openSheet(`<div class="gym gsheet"><h2>${esc(l.n)} — ${sth(l.txt)}</h2>${f?`<div class="gstage">${fig(f)}</div>`:""}
    ${l.cmd?`<div class="gsayl"><span>${t.cmd}: «${sth(l.cmd)}»</span>${spk(l.cmd)}</div>`:""}<div class="ggh">${t.infoT}</div>${l.notes.map(note).join("")}</div>`));
}
// показ упражнения по счётам: подсветка строки, большой человечек, в китайском режиме — голос
function playEx(){
  if(G.play){ clearTimeout(G.play); G.play = null; document.querySelectorAll(".gl2.on").forEach(x => x.classList.remove("on")); return render(); }
  const e = G.ex, ip = ipText(), steps = [{id:"gl-ip", f:stFig(Object.assign({}, e, e.start)), say:"И. п. — "+ip}]
    .concat(e.lines.map((l,i) => ({id:"gl-"+i, f:lineFig(l), say:l.n+" — "+l.txt})));
  let k = 0, lastF = steps[0].f;
  const btn = document.querySelector("[data-gplay]"); if(btn) btn.textContent = TL().stop;
  const step = () => {
    document.querySelectorAll(".gl2.on").forEach(x => x.classList.remove("on"));
    if(k >= steps.length){ G.play = null; const b2 = document.querySelector("[data-gplay]"); if(b2) b2.textContent = TL().play; return; }
    const s = steps[k++], el = $(s.id), st = $("gstage"); if(!el || !st){ G.play = null; return; }
    el.classList.add("on"); if(s.f) lastF = s.f; st.innerHTML = fig(lastF); st.classList.remove("pop"); void st.offsetWidth; st.classList.add("pop");
    el.scrollIntoView({block:"nearest", behavior:"smooth"}); speak(s.say);
    G.play = setTimeout(step, Zh() ? 2300 : 1300);
  };
  step();
}

/* ---------- в карточки, ошибка, фазы, без интернета ---------- */
const cardSets = () => { const v = LS.get("cardSets", []); return Array.isArray(v) ? v : []; };
function openToCards(id){
  const t = TL(), ss = cardSets();
  pushSheet(() => openSheet(`<div class="gym gsheet"><h2>${t.toCardsT}</h2>${ss.map(x => `<button class="grw gset" data-gtoset="${esc(x.id)}" data-gid="${esc(id)}"><span class="gth gthem">${emH(x.em, "🗂")}</span><span class="gct"><b>${esc(x.name)}</b><small>${x.refs.length}</small></span></button>`).join("")}
    <button class="btn wide" data-gtoset="" data-gid="${esc(id)}">${t.newSet}</button></div>`));
}
function addToSet(setId, id){
  const t = TL(), all = cardSets(), it = ITEM[id]; let s = all.find(x => x.id===setId);
  if(!s){ const ch = CHAP[chOf(it)]; s = {id:"s" + Date.now().toString(36) + Math.random().toString(36).slice(2,5), name: ch ? ch.name : t.pack, em:"i:bookmark", refs:[], at:Date.now()}; all.push(s); }
  const r = "g:" + id, had = s.refs.includes(r); if(!had) s.refs.push(r); LS.set("cardSets", all);
  toast(had ? t.already(s.name) : t.addedTo(s.name)); history.back();
}
function openReportT(id){
  const t = TL(), it = ITEM[id];
  pushSheet(() => openSheet(`<div class="gym gsheet"><h2>${t.repT}</h2><p><b>${sth(it.t)}</b></p><p class="muted">${t.repIntro}</p>
    <div class="form"><textarea id="grep_t" placeholder="${esc(t.repPh)}"></textarea></div><div class="btnrow"><button class="btn" data-grepsend="${esc(id)}">${t.repSend}</button></div><p id="grep_m"></p></div>`));
}
async function sendReportT(id){
  const t = TL(), it = ITEM[id], ta = $("grep_t"), m = $("grep_m"); if(!m || !ta) return;
  const txt = ta.value.trim(); if(!txt){ m.textContent = t.repEmpty; return; }
  m.innerHTML = typeof SPIN!=="undefined" ? SPIN : "…";
  try{
    const ch = CHAP[chOf(it)];
    const r = await fetch("https://ntfy.sh/", {method:"POST", body:JSON.stringify({topic:`${DATA.notify}-report`, title:`🐞 Словарь · ${ch?ch.name:""} · ${plain(it.t)} · ${state.lang}`,
      message:`${txt}\n\nСтатья ${it.id}: ${plain(it.t)}`, tags:["bug"]})});
    if(!r.ok) throw new Error(r.status);
    m.textContent = t.repOk; ta.value = "";
  }catch(e){ m.textContent = t.repErr; }
}
// по фазам: кадры рисунка-описания по одному, крупно, по кругу. Границы кадров — по пустым промежуткам между ними
const PH = {i:0, fr:null, img:null, timer:null, play:true};
function openPhases(id){
  const it = ITEM[id], f = FIG[it.figs[0]]; if(!f) return;
  clearInterval(PH.timer); Object.assign(PH, {i:0, fr:null, play:true});
  pushSheet(() => openSheet(`<div class="gym gsheet gphase"><h2>${sth(it.t)}</h2><canvas id="gphc"></canvas><div class="gphnav"><button data-gphs="-1">‹</button><span id="gphn"></span><button data-gphs="1">›</button><button data-gphp id="gphp">⏸</button></div></div>`));
  PH.ball = null; PH.color = !!f[3]; if(f[4]){ const bi = new Image(); bi.onload = () => { PH.ball = bi; drawPhase(); }; bi.src = f[4]; }
  const img = new Image(); img.onload = () => { PH.img = img; PH.fr = frames(img, it.nf); drawPhase(); clearInterval(PH.timer); PH.timer = setInterval(() => { if(!$("gphc")){ clearInterval(PH.timer); return; } if(PH.play){ PH.i = (PH.i+1) % PH.fr.length; drawPhase(); } }, 1400); };
  img.src = f[0];
}
function frames(img, n){
  const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight; const x = c.getContext("2d"); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data, W = c.width, H = c.height, col = new Array(W).fill(false);
  for(let i = 0; i < W; i++) for(let j = 0; j < H; j++) if(d[(j*W+i)*4+3] > 24){ col[i] = true; break; }
  const gaps = []; let s = -1;
  for(let i = 0; i <= W; i++){ const e = i===W || col[i]; if(!e && s < 0) s = i; if(e && s >= 0){ if(s > 0 && i < W) gaps.push([s, i]); s = -1; } }
  if(!n) n = gaps.filter(g => g[1] - g[0] >= 20).length + 1;
  const cut = gaps.sort((a,b) => (b[1]-b[0]) - (a[1]-a[0])).slice(0, n-1).sort((a,b) => a[0]-b[0]);
  const out = []; let from = 0; cut.forEach(g => { out.push([from, g[0]]); from = g[1]; }); out.push([from, W]);
  return out;
}
function drawPhase(){
  const c = $("gphc"); if(!c || !PH.fr) return; const img = PH.img, H = img.naturalHeight, mw = Math.max(...PH.fr.map(f => f[1]-f[0]));
  const cw = c.clientWidth || 320, dpr = window.devicePixelRatio || 1, k = Math.min(cw / mw, 300 / H), ch = Math.round(H*k);
  c.width = cw*dpr; c.height = ch*dpr; c.style.height = ch + "px";
  const x = c.getContext("2d"); x.scale(dpr, dpr); const [a, b] = PH.fr[PH.i];
  x.drawImage(img, a, 0, b-a, H, (cw - (b-a)*k)/2, 0, (b-a)*k, ch);
  if(!PH.color){ x.globalCompositeOperation = "source-in"; x.fillStyle = getComputedStyle(c).color; x.fillRect(0, 0, cw, ch); }
  if(PH.ball){ x.globalCompositeOperation = "source-over"; x.drawImage(PH.ball, a, 0, b-a, H, (cw - (b-a)*k)/2, 0, (b-a)*k, ch); }
  const n = $("gphn"); if(n) n.textContent = `${PH.i+1} / ${PH.fr.length}`;
}
// глава без интернета: рисунки главы и (у китайских студентов) озвучка всех её терминов попадают в память телефона
async function saveOffline(chId, btn){
  const t = TL(), ch = CHAP[chId]; if(!ch) return;
  const its = D.items.filter(it => chOf(it)===chId), files = new Set();
  if(Zh() && AUD) its.forEach(it => [it.t, ...(it.say||[])].forEach(x => (clipParts(x)||[]).forEach(k => files.add(AUD_BASE + AUD[k]))));
  const list = [...files]; let done = 0, bad = 0; const total = list.length + 1;
  const show = () => { if(btn) btn.textContent = t.offProg(done, total); };
  show();
  try{ const r = D.figFiles && D.figFiles[chId] ? await sfetch(D.figFiles[chId]) : null; if(r && !r.ok) bad++; }catch(e){ bad++; } done++; show();
  let i = 0; const worker = async () => { while(i < list.length){ const u = list[i++]; try{ const r = await fetch(u); if(!r.ok) bad++; }catch(e){ bad++; } done++; show(); } };
  await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);
  if(bad){ toast(t.offErr); if(btn){ btn.textContent = t.offSave; btn.disabled = false; } return; }
  const o = LS.get("gymOff", {}) || {}; o[chId + (Zh()?":zh":"")] = Date.now(); LS.set("gymOff", o); toast(t.offOk); render();
}
const isOff = chId => !!((LS.get("gymOff", {}) || {})[chId + (Zh()?":zh":"")]);
function phOf(){ const t = TL(), tp = G.tab==="dict" && D.topics.find(x => x.id===G.topic), ch = tp && CHAP[G.ch];
  return ch ? t.searchIn(tx(ch.name, ch.nz)) : tp ? t.searchIn(tx(tp.name, tp.nz)) : t.search; }
/* ---------- конструктор для танцев: экзерсис по счёту ----------
   Каждое движение само раскладывается на счёт по 2 (как на уроке: «1–2 — правую вперёд на носок, закрыть в первую позицию»).
   Термины и определения — учебник, глава «Хореография в спорте» (Батман тандю, Крестом, Плие, Рон де жам, Пор де бра, Препарасьон). */
// схема стоп сверху: танцор смотрит вверх (вперёд — вверх); опорная стопа сплошная, рабочая — там, куда выведена, след — пунктиром
const FOOT = "M0,0 C-5,0 -6.2,-8 -5.6,-15 C-5,-23 -4.2,-30 0,-30 C4.2,-30 6,-23 5.8,-15 C5.4,-8 5,0 0,0Z";
const FPOS = [{r:[3,0,80], l:[-3,0,-80]}, {r:[24,0,80], l:[-24,0,-80]}, {r:[-12,-7,85], l:[12,7,-85], front:"r"}, {l:[12,-7,-85], r:[-12,7,85], front:"l"}, {r:[8,0,0], l:[-8,0,0]}];
function footSvg(o){   // o: {l:позиция из DLEGS, side:"r"|"l", d:"f"|"s"|"b", path:"fsbs"…, rond:"fsb"|"bsf", mask:1 — одноцветная (для картинки в словаре)}
  const P = FPOS[o.l||0], cx = 60, cy = 66, sg = o.side==="l" ? -1 : 1, acc = o.mask ? "currentColor" : "var(--accent)";
  const tgt = d => d==="f" ? [0,-44] : d==="b" ? [0,44] : [sg*(o.l===1 ? 58 : 46), 0];
  const foot = (k, st) => { const [x,y,a] = P[k]; return `<path d="${FOOT}" transform="translate(${cx+x} ${cy+y}) rotate(${a})" ${st}/>`; };
  const work = o.d || o.rond || o.all ? (o.side==="l" ? "l" : "r") : null, sup = work==="r" ? "l" : "r";
  let h = "";
  if(o.bar) h += `<rect x="${o.bar===1 ? cx-56 : cx+50}" y="20" width="6" height="92" rx="3" fill="currentColor" opacity=".35"/>`;   // опора (станок)
  const pts = [...new Set((o.path||o.rond||"").split(""))];
  if(!o.mini) pts.forEach(d => { const [x,y] = tgt(d); h += `<circle cx="${cx+x}" cy="${cy+y}" r="3" fill="currentColor" opacity=".25"/>`;
    if(o.path && o.path.length>1){ const ns = o.path.split("").map((c,i) => c===d ? 2*i+1 : 0).filter(Boolean).join(",");
      h += `<text x="${cx+x+(d==="s"?0:9)}" y="${cy+y+(d==="s"?-8:4)}" font-size="9" font-weight="700" text-anchor="${d==="s"?"middle":"start"}" fill="currentColor" opacity=".55">${ns}</text>`; } });
  if(o.rond){ const a = tgt(o.rond[0]), b = tgt(o.rond[2]), r = 44;
    h += `<path d="M${cx+a[0]},${cy+a[1]} A${r},${r} 0 0 ${(o.rond[0]==="f") === (sg>0) ? 1 : 0} ${cx+b[0]},${cy+b[1]}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="3 3" opacity=".45"/>`;
    const ax = cx+b[0], ay = cy+b[1], dx = -sg;   // стрелка в конце дуги: куда ведём носок
    h += `<path d="M${ax+dx*7},${ay} L${ax-dx*2},${ay-5} L${ax-dx*2},${ay+5}Z" fill="currentColor" opacity=".7"/>`; }
  const w2 = work || "r", s2 = w2==="r" ? "l" : "r", order = P.front===s2 ? [w2, s2] : [s2, w2];   // передняя (в 5-й позиции) рисуется поверх
  order.forEach(k => { h += k===work && (o.d || o.all) ? foot(k, `fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2.5 2" opacity=".45"`) : foot(k, `fill="currentColor" opacity="${o.mask?1:.8}"`); });
  if(o.all) (o.path||"").split("").forEach(d => { const [x,y] = tgt(d), ang = d==="f" ? 0 : d==="b" ? 180 : sg*90, L = Math.hypot(x,y), ux = x/L, uy = y/L;   // картинка «крестом»: все направления сразу
    h += `<path d="${FOOT}" transform="translate(${cx+x-ux*30} ${cy+y-uy*30}) rotate(${ang})" fill="currentColor" opacity=".55"/>`; });
  if(o.d){ const [x,y] = tgt(o.d), ang = o.d==="f" ? 0 : o.d==="b" ? 180 : sg*90, L = Math.hypot(x,y), ux = x/L, uy = y/L;
    h += `<line x1="${cx+ux*10}" y1="${cy+uy*10}" x2="${cx+x-ux*6}" y2="${cy+y-uy*6}" stroke="${acc}" stroke-width="1.6" stroke-dasharray="3 2.5"/>`;
    h += `<path d="${FOOT}" transform="translate(${cx+x-ux*30+ux*0} ${cy+y-uy*30}) rotate(${ang})" fill="${acc}"/><circle cx="${cx+x}" cy="${cy+y}" r="3.6" fill="${acc}"/>`; }
  return `<svg class="gfs" viewBox="${o.mini ? "6 14 108 104" : "-6 6 132 120"}" aria-hidden="true">${h}</svg>`;
}
const DLEGS = [
  {t:"пе`рвая пози`ция ног", z:"一位脚", cl:"в пе`рвую пози`цию"},
  {t:"втора`я пози`ция ног", z:"二位脚", cl:"во втору`ю пози`цию"},
  {t:"пя`тая пози`ция ног, пра`вая впереди`", z:"五位脚，右脚在前", cl:"в пя`тую пози`цию", five:1},
  {t:"пя`тая пози`ция ног, ле`вая впереди`", z:"五位脚，左脚在前", cl:"в пя`тую пози`цию", five:1},
  {t:"шеста`я пози`ция ног", z:"六位脚（平行）", cl:"в шесту`ю пози`цию"}];
const DARMS = [
  {t:"ру`ки на по`яс", z:"双手叉腰", one:"на по`яс", oz:"叉腰"},
  {t:"ру`ки в подготови`тельной пози`ции", z:"手在预备位", one:"в подготови`тельной пози`ции", oz:"在预备位"},
  {t:"ру`ки во второ`й пози`ции", z:"手在二位", one:"во второ`й пози`ции", oz:"在二位"}];
// у опоры (станка): 1 — левым боком, 2 — правым; рабочая — дальняя от опоры нога
const DBAR = [null, {t:"Сто`я ле`вым бо`ком к опо`ре", z:"左侧对把杆", hand:"ле`вая рука` на опо`ре, пра`вая ", hz:"左手扶把杆，右手", outer:"r"},
  {t:"Сто`я пра`вым бо`ком к опо`ре", z:"右侧对把杆", hand:"пра`вая рука` на опо`ре, ле`вая ", hz:"右手扶把杆，左手", outer:"l"}];
const DTEMPO = [1000, 750, 520];
const DDIR = {f:["вперёд","向前"], s:["в сто`рону","向旁"], b:["наза`д","向后"]};
const DWAY = [   // направления для батманов
  {k:"xf", t:"кресто`м вперёд (ан део`р)", z:"十字形向前（向外）", seq:"fsbs"},
  {k:"xb", t:"кресто`м наза`д (ан деда`н)", z:"十字形向后（向内）", seq:"bsfs"},
  {k:"f", t:"вперёд", z:"向前", seq:"f"}, {k:"s", t:"в сто`рону", z:"向旁", seq:"s"}, {k:"b", t:"наза`д", z:"向后", seq:"b"}];
const DROND = [{k:"out", t:"ан део`р", z:"向外", seq:"fsb"}, {k:"in", t:"ан деда`н", z:"向内", seq:"bsf"}];
const DSIDE = [{k:"r", t:"пра`вой", acc:"пра`вую", z:"右脚"}, {k:"l", t:"ле`вой", acc:"ле`вую", z:"左脚"}];
const DM = [
  {k:"prep", t:"Препарасьо`н", z:"准备动作", n:["Подготовительное движение перед упражнением. Делается на затакт — до счёта «раз».","练习前的准备动作，在弱起拍（“一”之前）完成。"]},
  {k:"demi", t:"Деми` плие`", z:"半蹲", n:["Полуприсед, пятки от пола не отрываем. Колени смотрят в стороны, над носками.","半蹲，脚跟不离地。膝盖朝两侧，对准脚尖。"]},
  {k:"grand", t:"Гран плие`", z:"全蹲", n:["Присед с полным сгибанием ног. Сначала деми плие, потом пятки отрываются (во второй позиции — не отрываются).","完全屈膝的蹲。先半蹲，再抬起脚跟（二位脚时脚跟不离地）。"]},
  {k:"tandu", t:"Батма`н тандю`", z:"擦地", way:DWAY, side:1, how:"на носо`к", n:["Вытянутая нога скользит по полу и выводится на носок, затем возвращается обратно. «Крестом вперёд» (ан деор): вперёд, в сторону, назад, в сторону. «Крестом назад» (ан дедан): назад, в сторону, вперёд, в сторону.","伸直的腿沿地面滑出到脚尖点地，再收回。“十字形向前”（向外）：前、旁、后、旁；“十字形向后”（向内）：后、旁、前、旁。"]},
  {k:"jete", t:"Батма`н тандю` жетэ`", z:"小踢腿", way:DWAY, side:1, how:"бросо`ком", n:["Как батман тандю, но нога бросается невысоко — носок на уровне щиколотки (25°).","和擦地一样，但腿向外踢出，不高——脚尖在脚踝高度（25°）。"]},
  {k:"rond", t:"Рон де жам пар тэр", z:"地面划圈", way:DROND, side:1, n:["Круг ногой, носок касается пола. Ан деор — вперёд, в сторону, назад; ан дедан — наоборот. Нога возвращается через первую позицию.","用脚尖在地面划圈。向外：前、旁、后；向内：相反。腿经过一位收回。"]},
  {k:"grbat", t:"Гран батма`н жетэ`", z:"大踢腿", way:DWAY, side:1, how:"ма`хом", n:["Нога выбрасывается махом на 90° и выше, опускается сдержанно.","腿向上踢到90°以上，放下时要控制。"]},
  {k:"releve", t:"Релевэ`", z:"立起", n:["Подъём на полупальцы.","立到半脚尖。"]},
  {k:"turn", hide:1, t:"Поворо`т", z:"转身", n:["Поворачиваемся к опоре другим боком — упражнение повторяется с другой ноги.","转身换另一侧扶把杆——用另一条腿重复练习。"]},
  {k:"pdb", t:"Пе`рвое пор де бра`", z:"第一组手臂练习", n:["Руки проходят через позиции: первая — третья — вторая — подготовительная.","手臂依次经过：一位—三位—二位—预备位。"]}];
const DMOF = k => DM.find(m => m.k===k);
const cap1 = s => s.charAt(0).toUpperCase()+s.slice(1);
// строки одного движения: [{c:сколько счётов (0 — затакт), t:текст}]
function dLines(b, ip){
  const m = DMOF(b.m), L = DLEGS[ip.l] || DLEGS[0], side = DSIDE.find(s => s.k===b.side) || DSIDE[0];
  const close = (d, i, seq) => {   // в пятой позиции говорим, какой ногой закрываем: спереди или сзади
    if(!L.five) return "закры`ть " + L.cl;
    const back = d==="b" || d==="s" && (seq==="s" || (seq.charAt(0)==="f") === (i===1));
    return "закры`ть " + L.cl + (back ? " сза`ди" : " спе`реди");
  };
  if(b.m==="prep") return [{c:0, t:"ру`ки че`рез пе`рвую пози`цию во втору`ю"}];
  if(b.m==="turn") return [{c:0, t:"поворо`т к опо`ре други`м бо`ком", fs:1}];
  if(b.m==="demi") return [{c:2, t:"деми` плие`", fs:1}, {c:2, t:"вы`прямить но`ги", fs:1}];
  if(b.m==="grand") return [{c:4, t:"гран плие`", fs:1}, {c:4, t:"вы`прямить но`ги", fs:1}];
  if(b.m==="releve") return [{c:2, t:"релевэ` на полупа`льцы", fs:1}, {c:2, t:"опусти`ться", fs:1}];
  if(b.m==="pdb") return ["пе`рвую","тре`тью","втору`ю","подготови`тельную"].map(p => ({c:2, t:"ру`ки в "+p+" пози`цию"}));
  if(b.m==="rond"){ const w = DROND.find(x => x.k===b.way) || DROND[0], s = w.seq;
    return [{c:2, t:side.acc+" "+DDIR[s[0]][0]+" на носо`к", d:s[0], rond:s}, {c:2, t:"носко`м по по`лу "+DDIR[s[1]][0], d:s[1], rond:s}, {c:2, t:"носко`м по по`лу "+DDIR[s[2]][0], d:s[2], rond:s}, {c:2, t:(ip.l===0 ? "" : "че`рез пе`рвую пози`цию ")+close(s[0]==="f"?"b":"f", 0, s[0]), fs:1}]; }
  const w = DWAY.find(x => x.k===b.way) || DWAY[0];
  return w.seq.split("").map((d,i) => ({c:2, t:side.acc+" "+DDIR[d][0]+" "+m.how+", "+close(d, i, w.seq), d, path:w.seq}));
}
function dTitle(b){
  const m = DMOF(b.m), w = (m.way||[]).find(x => x.k===b.way), side = DSIDE.find(s => s.k===b.side);
  return {ru: m.t + (w ? " "+w.t : "") + (m.side && side ? ", "+side.t : ""), zh: m.z + (w ? " · "+w.z : "") + (m.side && side ? " · "+side.z : "")};
}
function dStart(){ const o = G.dz || {}; G.dz = {l:o.l||0, a:o.a||0, bar:o.bar||0, tempo:o.tempo===undefined ? 1 : o.tempo, meter:o.meter||4, blocks:[], hist:[]}; }
// весь экзерсис: строки со счётом, счёт идёт восьмёрками (после 8 снова 1)
function dAll(){
  const z = G.dz; let c = 0; const out = [];
  z.blocks.forEach((b, bi) => {
    const pr = z.blocks[bi-1]; if(pr && pr.m!==b.m && c%8) c += 8 - c%8;   // новое упражнение — с «раз» новой восьмёрки; повтор того же — продолжает счёт
    out.push({head:dTitle(b), bi});
    dLines(b, z).forEach(l => {
      let n; if(!l.c) n = "и"; else { const s = c%8 + 1; n = l.c===1 ? ""+s : s+"–"+(s+l.c-1); c += l.c; }
      out.push(Object.assign({}, l, {n, bi, side:b.side, bar:curBar(bi+1)})); });
  });
  return out;
}
const dIp = () => { const z = G.dz, B = DBAR[z.bar]; return B ? B.t+", "+DLEGS[z.l].t+", "+B.hand+DARMS[z.a].one : cap1(DLEGS[z.l].t)+", "+DARMS[z.a].t; };
const dIpZh = () => { const z = G.dz, B = DBAR[z.bar]; return B ? B.z+"，"+DLEGS[z.l].z+"，"+B.hz+DARMS[z.a].oz : DLEGS[z.l].z+"，"+DARMS[z.a].z; };
function dText(){
  let h = "И. п. — " + plain(dIp()) + ".";
  dAll().forEach(r => { h += r.head ? "\n" + plain(r.head.ru) + ":" : "\n" + (r.n==="и" ? "Затакт" : r.n) + " — " + plain(r.t) + ";"; });
  return h.replace(/;$/, ".");
}
const DEX = [
  {ru:"У опоры: обе ноги", zh:"扶把杆：两条腿", l:0, a:2, bar:1, b:[{m:"tandu", way:"xf", side:"r"},{m:"turn"},{m:"tandu", way:"xf", side:"l"}]},
  {ru:"Плие", zh:"蹲", l:0, a:0, b:[{m:"demi"},{m:"demi"},{m:"grand"}]},
  {ru:"Тандю крестом", zh:"十字形擦地", l:0, a:0, b:[{m:"tandu", way:"xf", side:"r"},{m:"tandu", way:"xb", side:"r"}]},
  {ru:"Урок по порядку", zh:"一节课的顺序", l:0, a:1, b:[{m:"prep"},{m:"demi"},{m:"demi"},{m:"tandu", way:"xf", side:"r"},{m:"jete", way:"xf", side:"r"},{m:"rond", way:"out", side:"r"},{m:"releve"},{m:"grbat", way:"xf", side:"r"},{m:"pdb"}]}];
const dSvg = (r, mini) => { const bar = r.bar===undefined ? curBar() : r.bar; return r.d || r.rond ? footSvg({l:G.dz.l, bar, side:r.side, d:r.d, path:r.path, rond:r.rond, mini}) : r.fs || r.m==="turn" ? footSvg({l:G.dz.l, bar, mini}) : ""; };
function danceView(){
  if(!G.dz) dStart();
  const z = G.dz, t = TL(), rows = dAll();
  let h = `<div class="gexm"><small>${t.exStart}</small>${DEX.map((x,i) => `<button data-gdex="${i}">${esc(tx(x.ru,x.zh))}</button>`).join("")}</div>`;
  h += `<div class="gcard col gexc"><div class="gexh"><b>${t.dMy}</b><button class="gplay" data-gdplay ${z.blocks.length?"":"disabled"}>${G.dplay?t.stop:t.play}</button></div>
    <div class="gdstage" id="gdstage">${footSvg({l:z.l, bar:z.bar})}</div>
    <div class="gdbeat" id="gdbeat">${[1,2,3,4,5,6,7,8].map(i => `<i>${i}</i>`).join("")}</div>
    <div class="gdtm"><span>${t.dTempo}</span>${t.tempos.map((x,i) => chip("data-gdtempo", i, z.tempo===i, x)).join("")}<span class="gsep"></span>${[4,3].map(m => chip("data-gdmeter", m, z.meter===m, m+"/4")).join("")}</div>
    <div class="gl2 gip2" id="gd-ip" data-gdipopen><span class="gn">И. п.</span><span class="gtx">${sth(dIp())}<small>${Zh() ? esc(dIpZh())+" · " : ""}${t.tapIp}</small></span><span class="gmini">${footSvg({l:z.l, bar:z.bar, mini:1})}</span><span class="gi">✎</span></div>`;
  rows.forEach((r, i) => {
    if(r.head) h += `<div class="gdh"><span class="gtx"><b>${sth(r.head.ru)}</b>${Zh()?`<small>${esc(r.head.zh)}</small>`:""}</span><button class="gi" data-gdinfo="${r.bi}" aria-label="ⓘ">ⓘ</button></div>`;
    else h += `<div class="gl2" id="gd-${i}"><span class="gn">${r.n==="и" ? t.dUp : r.n}</span><span class="gtx">${sth(r.t)}</span><span class="gmini">${dSvg(r, 1)}</span>${spk((r.n==="и"?"":r.n+" — ")+r.t)}</div>`;
  });
  if(!z.blocks.length) h += `<div class="gsrc">${t.dFirst}</div>`;
  else h += `<div class="gtools2"><button data-gdother ${dLastSide()?"":"disabled"}>⇄ ${t.dOther}</button><button data-gdundo ${z.hist.length?"":"disabled"}>↶ ${t.undoS}</button><button data-gdclr>✕ ${t.clrS}</button><button data-gdcopy>${icon("share","sm")} ${t.copyS}</button></div>`;
  return h + `</div><button class="btn wide gplus" data-gdpick>＋ ${t.dAdd}</button><p class="gsrc">${t.dRead}</p>`;
}
const curBar = upto => { const z = G.dz; let b = z.bar; z.blocks.slice(0, upto===undefined ? z.blocks.length : upto).forEach(x => { if(x.m==="turn" && b) b = 3 - b; }); return b; };   // после поворота опора с другой стороны
const dLastSide = () => { const b = G.dz.blocks[G.dz.blocks.length-1]; return b && b.side ? b : null; };
const chip = (attr, v, on, label) => `<button class="${on?"on":""}" ${attr}="${v}">${label}</button>`;
function openDPick(){
  if(!G.dpk) G.dpk = {m:"tandu", way:"xf", side:"r"};
  if(DBAR[curBar()]) G.dpk.side = DBAR[curBar()].outer;
  pushSheet(() => { const t = TL(), p = G.dpk, m = DMOF(p.m);
    if(m.way && !m.way.some(w => w.k===p.way)) p.way = m.way[0].k;
    const prev = dLines(p, G.dz).map(l => `<div class="gl2"><span class="gn">${l.c ? "" : t.dUp}</span><span class="gtx">${sth(l.t)}</span><span class="gmini">${dSvg(Object.assign({side:p.side}, l), 1)}</span></div>`).join("");
    return openSheet(`<div class="gym gsheet"><h2>${t.dAdd}</h2>
      <div class="ggh">${t.dWhat}</div><div class="gdch">${DM.filter(x => !x.hide).map(x => chip("data-gdm", x.k, x.k===p.m, `${sth(x.t)}${Zh()?`<small>${esc(x.z)}</small>`:""}`)).join("")}</div>
      ${m.way ? `<div class="ggh">${t.dWay}</div><div class="gdch">${m.way.map(w => chip("data-gdw", w.k, w.k===p.way, `${sth(w.t)}${Zh()?`<small>${esc(w.z)}</small>`:""}`)).join("")}</div>` : ""}
      ${m.side ? `<div class="ggh">${t.dSide}</div><div class="gdch">${DSIDE.map(s => chip("data-gds", s.k, s.k===p.side, `${sth(cap1(s.t))}${Zh()?`<small>${esc(s.z)}</small>`:""}`)).join("")}</div>` : ""}
      <div class="gnote">${Zh() ? esc(m.n[1]) : esc(m.n[0])}</div>
      <div class="gdprev"><div class="ggh">${sth(dTitle(p).ru)}</div>${prev}</div>
      <div class="gpfoot"><button class="btn wide" data-gdadd>${t.dAddBtn}</button></div></div>`); });
}
function openDIp(){
  pushSheet(() => { const t = TL(), z = G.dz;
    return openSheet(`<div class="gym gsheet"><h2>${t.ipT}</h2>
      <div class="ggh">${t.dBar}</div><div class="gdch">${t.bars.map((x,i) => chip("data-gdbar", i, i===z.bar, x)).join("")}</div>
      <div class="ggh">${t.dLegs}</div><div class="gdch">${DLEGS.map((l,i) => chip("data-gdil", i, i===z.l, `${sth(cap1(l.t))}${Zh()?`<small>${esc(l.z)}</small>`:""}`)).join("")}</div>
      <div class="ggh">${t.dArms}</div><div class="gdch">${DARMS.map((a,i) => chip("data-gdia", i, i===z.a, `${sth(cap1(a.t))}${Zh()?`<small>${esc(a.z)}</small>`:""}`)).join("")}</div>
      <div class="gpfoot"><button class="btn wide" data-gdipok>${t.dOk}</button></div></div>`); });
}
function openDInfo(bi){
  const b = G.dz.blocks[bi]; if(!b) return; const m = DMOF(b.m), it = D.items.find(x => plain(x.t)===plain(m.t)) || (m.k==="pdb" ? D.items.find(x => plain(x.t)==="Первое пор де бра") : null);
  pushSheet(() => openSheet(`<div class="gym gsheet"><h2>${sth(dTitle(b).ru)}</h2>${Zh()?`<p class="muted">${esc(dTitle(b).zh)}</p>`:""}<div class="gnote">${Zh()?esc(m.n[1]):esc(m.n[0])}</div>
    ${it ? `<button class="btn wide ghost" data-gopen="${esc(it.id)}">${TL().dTerm}: ${sth(it.t)}</button>` : ""}</div>`));
}
let DAC = null;
function tick(strong, soft){   // щелчок метронома
  try{ DAC = DAC || new (window.AudioContext||window.webkitAudioContext)(); const o = DAC.createOscillator(), g = DAC.createGain(), t0 = DAC.currentTime;
    o.frequency.value = strong ? 1320 : soft ? 660 : 880; g.gain.setValueAtTime(strong ? .35 : soft ? .08 : .2, t0); g.gain.exponentialRampToValueAtTime(.001, t0 + .06);
    o.connect(g); g.connect(DAC.destination); o.start(t0); o.stop(t0 + .07); }catch(e){}
}
function dStop(){ clearTimeout(G.dplay); G.dplay = null; document.querySelectorAll(".gl2.on,.gdbeat i.on").forEach(x => x.classList.remove("on")); const b = document.querySelector("[data-gdplay]"); if(b) b.textContent = TL().play; }
// показ под счёт: метроном, номер счёта и подсветка строки; в китайском режиме строка ещё и звучит
function dPlay(){
  if(G.dplay) return dStop();
  const rows = dAll(), beats = []; let k = 0;
  rows.forEach((r, i) => { if(r.head) return; if(!r.c) beats.push({i, n:0, say:r.t, r}); else for(let j=0;j<r.c;j++) beats.push({i, n:parseInt(r.n)+j, say:j ? null : r.n+" — "+r.t, r}); });
  const z = G.dz, ms = DTEMPO[z.tempo] * (Zh() ? 1.3 : 1); let p = 0;
  const btn = document.querySelector("[data-gdplay]"); if(btn) btn.textContent = TL().stop;
  const step = () => {
    if(p >= beats.length) return dStop();
    const s = beats[p++], el = $("gd-"+s.i);
    document.querySelectorAll(".gl2.on,.gdbeat i.on").forEach(x => x.classList.remove("on"));
    if(el){ el.classList.add("on"); el.scrollIntoView({block:"nearest", behavior:"smooth"}); }
    const bt = document.querySelectorAll("#gdbeat i"); if(s.n && bt[s.n-1]) bt[s.n-1].classList.add("on");
    const sg = $("gdstage"); if(sg && s.say){ const v = dSvg(s.r); if(v) sg.innerHTML = v; }
    tick(s.n===1); if(s.say && Zh()) speak(s.say);
    if(s.n && z.meter===3) [1,2].forEach(j => setTimeout(() => { if(G.dplay) tick(false, true); }, ms*j/3));   // 3/4: каждый счёт — такт из трёх долей
    G.dplay = setTimeout(step, s.n ? ms : ms*1.2);
  };
  step();
}
function dClick(d){   // клики танцевального конструктора; true — обработано
  const z = G.dz, snap = () => z.hist.push(JSON.stringify(z.blocks));
  if(d.gbm!==undefined){ dStop(); LS.set("gymBmTopic", d.gbm); render(); return true; }
  if(d.gdplay!==undefined){ dPlay(); return true; }
  if(d.gdpick!==undefined){ dStop(); openDPick(); return true; }
  if(d.gdipopen!==undefined){ dStop(); openDIp(); return true; }
  if(d.gdinfo!==undefined){ openDInfo(+d.gdinfo); return true; }
  if(d.gdm!==undefined){ G.dpk.m = d.gdm; refreshSheet(); return true; }
  if(d.gdw!==undefined){ G.dpk.way = d.gdw; refreshSheet(); return true; }
  if(d.gds!==undefined){ G.dpk.side = d.gds; refreshSheet(); return true; }
  if(d.gdil!==undefined){ z.l = +d.gdil; refreshSheet(); render(); return true; }
  if(d.gdia!==undefined){ z.a = +d.gdia; refreshSheet(); render(); return true; }
  if(d.gdbar!==undefined){ z.bar = +d.gdbar; refreshSheet(); render(); return true; }
  if(d.gdtempo!==undefined){ z.tempo = +d.gdtempo; render(); return true; }
  if(d.gdmeter!==undefined){ z.meter = +d.gdmeter; render(); return true; }
  if(d.gdother!==undefined){ dStop(); const b = dLastSide(); if(b){ snap(); if(z.bar) z.blocks.push({m:"turn"}); z.blocks.push(Object.assign({}, b, {side:b.side==="r"?"l":"r"})); } render(); return true; }
  if(d.gdipok!==undefined){ closeSheet(); render(); return true; }
  if(d.gdadd!==undefined){ const p = G.dpk, m = DMOF(p.m); snap(); z.blocks.push(Object.assign({m:p.m}, m.way ? {way:p.way} : {}, m.side ? {side:p.side} : {})); closeSheet(); render(); return true; }
  if(d.gdundo!==undefined){ dStop(); if(z.hist.length) z.blocks = JSON.parse(z.hist.pop()); render(); return true; }
  if(d.gdclr!==undefined){ dStop(); snap(); z.blocks = []; render(); return true; }
  if(d.gdcopy!==undefined){ copyText(dText(), document.querySelector("[data-gdcopy]")); return true; }
  if(d.gdex!==undefined){ dStop(); const x = DEX[+d.gdex]; if(x){ snap(); z.l = x.l; z.a = x.a; z.bar = x.bar||0; z.blocks = x.b.map(b => Object.assign({}, b)); } render(); return true; }
  return false;
}
/* ---------- конструктор разминки лёгкой атлетики (данные: atletika/warmup.json → D.athlWu) ----------
   порядок всегда: разминочный бег → ОРУ на месте → СБУ в колоннах (от простого к сложному) → галопы и ускорения → специальная часть (перед прыжками/метаниями) */
const AW = () => bmode()==="games" ? D.gamesWu : D.athlWu;   // один конструктор на два набора данных: лёгкая атлетика (atletika/warmup.json) и игры (igry/warmup.json)
const AK = () => bmode()==="games" ? "gamesWu" : "athlWu";
const AO = () => AW().order || ["run","oru","sbu","acc","spec"];   // порядок частей; "run" — минуты бега
const AP = () => AO().filter(k => k!=="run");
const SP = () => AW().sortPart || "sbu";   // часть, которая идёт от простого к сложному
const aAge = () => (AW().ages.find(a => a.k===G.az.age) || AW().ages[0]);
const aTpl = () => (AW().templates.find(x => x.k===G.az.tpl) || AW().templates[0]);
const aLvl = id => { const it = ITEM[id]; return it && it.wu && it.wu.lvl || 1; };
const aInfo = id => (AW().ex||{})[id] || {};
const aPart = id => aInfo(id).part || (ITEM[id] && ITEM[id].wu && ITEM[id].wu.part) || "oru";
const aOkAge = (id, age) => { const a = aInfo(id).ages; return !a || !a.length || a.includes(age); };
const aOkTpl = id => { const x = aInfo(id).tpl; return !x || !x.length || x.includes(G.az.tpl); };   // упражнения с мячом — только для своей игры (в выборе — внизу, «для другой игры»)
function aSave(){ LS.set(AK(), G.az); }
function aStart(){
  const o = LS.get(AK(), null), W = AW(); G.azk = AK();
  G.az = o && o.b ? o : {age: (W.ages[1]||W.ages[0]).k, tpl: W.templates[0].k, b:null, hist:[]};
  if(!G.az.b) aDefault(); G.az.hist = [];
}
function aDefault(){   // готовая разминка из warmup.json для выбранного возраста и вида
  const z = G.az, W = AW(), df = ((W.defaults||{})[z.age]||{})[z.tpl] || {}, age = aAge();
  z.b = {run: Math.round(((age.run||{}).max || 3))};
  AP().forEach(p => { z.b[p] = (df[p] || (p==="spec" ? aTpl().spec || [] : [])).filter(id => ITEM[id]); });
  z.b[SP()] = aSort(z.b[SP()] || []);
}
const aPlay = () => G.az.age==="1-4" && G.az.play!==false;
const aLast = id => ITEM[id] && ITEM[id].wu && ITEM[id].wu.last ? 1 : 0;
const aSort = ids => ids.slice().sort((a, b) => aLast(a) - aLast(b) || aLvl(a) - aLvl(b));   // СБУ / упражнения в движении — от простого к сложному, ускорение последним
function aWarn(){   // подсказки: что не так в порядке и возрасте
  const z = G.az, age = aAge(), t = TL(), out = [];
  AP().forEach(p => (z.b[p]||[]).forEach(id => { if(aLvl(id) > (age.maxLvl||5)) out.push(t.awHard(sth(ITEM[id].t), tx(age.name, age.nz))); else if(!aOkAge(id, age.k)) out.push(t.awAge(sth(ITEM[id].t), tx(age.name, age.nz))); }));
  const g = bmode()==="games", s = z.b[SP()] || [], srt = aSort(s); if(s.some((id, i) => id!==srt[i])) out.push(g ? t.gwOrder : t.awOrder);
  const [lo, hi] = age[SP()+"N"] || age.sbuN || [0, 99]; if(s.length && s.length > hi) out.push(g ? t.gwMany(hi) : t.awMany(hi));
  if(!z.b.run) out.push(t.awRun);
  return out;
}
const aDose = id => { const x = aInfo(id).dose; return x && (x[G.az.age] || x.all) || (ITEM[id] && ITEM[id].wu && ITEM[id].wu.dose) || ""; };
function aRow(id, p, i){
  const it = ITEM[id]; if(!it) return ""; loadFigs(chOf(it));
  const hard = aLvl(id) > (aAge().maxLvl||5) || !aOkAge(id, G.az.age), x = aInfo(id), play = aPlay() && x.game;   // младшим — игровой образ и стишок под счёт
  return `<div class="gl2 gaw${hard?" warn":""}"><span class="gn">${i+1}</span>${thumb(it)}<span class="gtx" data-gopen="${esc(id)}"><b>${sth(it.t)}</b><small>${esc(aDose(id))}</small>${play ? `<span class="gagame">🎲 ${esc(tx(x.game, x.gz))}</span>${x.rhyme ? `<span class="garhy">🎵 ${esc(x.rhyme)}</span>` : ""}` : ""}</span>${spk(it.t)}<button class="gi" data-gadel="${p}:${i}" aria-label="✕">✕</button></div>`;
}
function athlView(){
  const W = AW(), t = TL(); if(!W) return `<div class="gsrc">${t.awNo}</div>`;
  if(!G.az || G.azk!==AK()) aStart();
  const z = G.az, age = aAge(), parts = W.parts || [];
  const pn = k => { const x = parts.find(p => p.k===k) || {}; return tx(x.name || k, x.nz); };
  let h = `<div class="ggh">${t.awAge0}</div><div class="gdch">${W.ages.map(a => chip("data-gaage", a.k, a.k===z.age, esc(tx(a.name, a.nz)))).join("")}</div>`;
  h += `<div class="ggh">${t.awTpl}</div><div class="gdch">${W.templates.map(x => chip("data-gatpl", x.k, x.k===z.tpl, esc(tx(x.name, x.nz)))).join("")}</div>`;
  const notes = Zh() ? (age.nz_notes || age.notes || []) : (age.notes || []);
  if(z.age==="1-4" && W.play) h += `<div class="gdch">${chip("data-gaplay", 1, aPlay(), "🎲 "+t.awPlay)}${chip("data-gaplay", 0, !aPlay(), t.awPlain)}</div>` + (aPlay() ? `<div class="gnote gawn">${esc(tx(W.play.ru, W.play.z))}</div>` : "");
  if(notes.length) h += `<div class="gnote gawn">${notes.map(esc).join("<br>")}</div>`;
  h += `<div class="gcard col gexc"><div class="gexh"><b>${t.awMy}</b><small class="muted">${esc(age.total||"")}</small></div>`;
  const rmin = age.run || {};
  let n = 0;
  AO().forEach(p => {
    if(p==="run"){ h += `<div class="gdh"><span class="gtx"><b>${++n}. ${esc(pn("run"))}</b></span></div><div class="gl2"><span class="gn">⏱</span><span class="gtx">${t.awRunT(z.b.run)}<small>${t.awRunHint(rmin.min, rmin.max)}</small></span><button class="gi" data-garun="-1">−</button><button class="gi" data-garun="1">＋</button></div>`; return; }
    if(p==="spec" && !(z.b.spec||[]).length && !(aTpl().spec||[]).length) return;
    z.b[p] = z.b[p] || [];
    h += `<div class="gdh"><span class="gtx"><b>${++n}. ${esc(pn(p))}</b>${p===SP() ? `<small>${t.awSbuHint}</small>` : ""}</span><button class="gi" data-gapick="${p}" aria-label="＋">＋</button></div>`;
    h += z.b[p].map((id, i) => aRow(id, p, i)).join("") || `<div class="gsrc">${t.awEmpty}</div>`;
  });
  const w = aWarn();
  h += w.length ? `<div class="gnote gawn">⚠️ ${w.join("<br>⚠️ ")}</div>` : `<div class="gnote gawn">✓ ${bmode()==="games" ? t.gwOk : t.awOk}</div>`;
  h += `<div class="gtools2"><button data-gadef>↺ ${t.awDef}</button><button data-gaundo ${z.hist.length?"":"disabled"}>↶ ${t.undoS}</button><button data-gaclr>✕ ${t.clrS}</button><button data-gacopy>${icon("share","sm")} ${t.copyS}</button></div></div>`;
  if(W.card){ const c = W.card, ck = z.chk || {}; let n = 0, k = 0;   // чек-лист «проверь себя» по экспресс-карте курса
    const gs = c.groups.map((g, gi) => `<div class="ggh">${esc(tx(g.name, g.nz))}</div>` + g.items.map((x, i) => { const key = gi+"."+i, on = !!ck[key]; n++; if(on) k++; return `<label class="gack"><input type="checkbox" data-gachk="${key}"${on?" checked":""}><span>${esc(x)}</span></label>`; }).join("")).join("");
    h += `<details class="gpast"><summary>${icon("chev","sm")}<span>✅ ${t.awCard} · ${k}/${n}</span></summary><div class="gnote gawn">${esc(c.src)}</div>${gs}</details>`; }
  if(W.rules && W.rules.length) h += `<details class="gpast"><summary>${icon("chev","sm")}<span>${t.awRules}</span></summary>${W.rules.map(r => `<div class="gnote gawn">${esc(tx(r.ru, r.z))}</div>`).join("")}</details>`;
  return h + `<p class="gsrc">${esc(W.src||"")}</p>`;
}
function aText(){   // план разминки текстом — скопировать в конспект
  const z = G.az, W = AW(), age = aAge(), parts = W.parts || [], out = [];
  const pn = k => { const x = parts.find(p => p.k===k) || {}; return x.name || k; };
  out.push(`Разминка (${age.name}, ${aTpl().name.toLowerCase()})`);
  let n = 0;
  AO().forEach(p => { if(p==="run"){ out.push(`${++n}. ${pn("run")} — ${z.b.run} мин`); return; } if(!(z.b[p]||[]).length) return; out.push(`${++n}. ${pn(p)}`); z.b[p].forEach((id, i) => { const x = aInfo(id); out.push(`   ${i+1}) ${plain(ITEM[id].t)}${aDose(id) ? " — "+aDose(id) : ""}`); if(aPlay() && x.game) out.push(`      игра: ${x.game}${x.rhyme ? "; счёт: «"+x.rhyme+"»" : ""}`); }); });
  return out.join("\n");
}
function openAPick(p){
  pushSheet(() => { const t = TL(), z = G.az, age = aAge();
    const foreign = id => bmode()!=="games" && D.gamesWu && (D.gamesWu.ex||{})[id];   // упражнения разминки игр — не в конструктор лёгкой атлетики
    const all = Object.keys(AW().ex||{}).filter(id => ITEM[id] && aPart(id)===p).concat(bmode()==="games" ? [] : D.items.filter(it => it.wu && it.wu.part===p && !(AW().ex||{})[it.id] && !foreign(it.id)).map(it => it.id));
    const uniq = [...new Set(all)], ok = uniq.filter(id => aOkAge(id, age.k) && aOkTpl(id) && aLvl(id) <= (age.maxLvl||5)), other = uniq.filter(id => !ok.includes(id));
    const row = id => { const it = ITEM[id], on = z.b[p].includes(id); loadFigs(chOf(it)); return `<div class="grw${on?" on":""}" data-gaadd="${p}:${esc(id)}">${thumb(it)}<span class="gct"><b>${sth(it.t)}</b><small>${esc(aDose(id))}</small></span><span class="gi">${on?"✓":"＋"}</span></div>`; };
    return openSheet(`<div class="gym gsheet"><h2>${esc(tx(((AW().parts||[]).find(x => x.k===p)||{}).name||p, ((AW().parts||[]).find(x => x.k===p)||{}).nz))}</h2>${ok.map(row).join("")}${other.length ? `<div class="ggh">${t.awOlder}</div>${other.map(row).join("")}` : ""}</div>`); });
}
function aClick(d){   // клики конструктора разминки; true — обработано
  if(!G.az) return false;
  const z = G.az, snap = () => { z.hist.push(JSON.stringify(z.b)); if(z.hist.length > 30) z.hist.shift(); }, done = () => { aSave(); render(); return true; };
  if(d.gaage!==undefined){ snap(); z.age = d.gaage; aDefault(); return done(); }
  if(d.gatpl!==undefined){ snap(); z.tpl = d.gatpl; aDefault(); return done(); }
  if(d.gadef!==undefined){ snap(); aDefault(); return done(); }
  if(d.gachk!==undefined){ z.chk = z.chk || {}; z.chk[d.gachk] = !z.chk[d.gachk]; aSave(); render(); return true; }
  if(d.gaplay!==undefined){ z.play = d.gaplay==='1'; return done(); }
  if(d.gaclr!==undefined){ snap(); AP().forEach(p => z.b[p] = []); return done(); }
  if(d.gaundo!==undefined){ if(z.hist.length) z.b = JSON.parse(z.hist.pop()); return done(); }
  if(d.garun!==undefined){ snap(); z.b.run = Math.max(0, Math.min(15, z.b.run + (+d.garun))); return done(); }
  if(d.gadel!==undefined){ const [p, i] = d.gadel.split(":"); snap(); z.b[p].splice(+i, 1); return done(); }
  if(d.gapick!==undefined){ openAPick(d.gapick); return true; }
  if(d.gaadd!==undefined){ const k = d.gaadd.indexOf(":"), p = d.gaadd.slice(0, k), id = d.gaadd.slice(k+1); snap();
    z.b[p] = (z.b[p]||[]).includes(id) ? z.b[p].filter(x => x!==id) : (z.b[p]||[]).concat(id); if(p===SP()) z.b[p] = aSort(z.b[p]); aSave(); refreshSheet(); render(); return true; }
  if(d.gacopy!==undefined){ copyText(aText(), document.querySelector("[data-gacopy]")); return true; }
  return false;
}
// в разделе — только его конструктор (в плавании — только плавание, в танцах — только танцы); выбор между конструкторами — только на общем экране словаря
const BM_OF = {gym:"oru", dance:"dance", athl:"athl", games:"games"};
const bmOk = k => k==="oru" || k==="dance" || k==="athl" && D && D.athlWu || k==="games" && D && D.gamesWu;
// урок запоминаем по последнему открытому спортивному разделу: на общем экране словаря тоже только его конструктор
const bmTopic = () => { if(G.topic && G.topic!=="rus" && G.topic!=="mych"){ if(LS.get("gymBmTopic", null)!==G.topic) LS.set("gymBmTopic", G.topic); return G.topic; } return LS.get("gymBmTopic", null); };
const bmode = () => { const tp = bmTopic(); return tp ? (bmOk(BM_OF[tp]) ? BM_OF[tp] : "none") : "pick"; };
const bmSwitch = () => { const t = TL(); if(bmode()!=="pick") return ""; return `<div class="gsrc">${t.bmPick}</div><div class="gbm">${[["gym",t.bmOru],["dance",t.bmDance]].concat(D && D.athlWu ? [["athl",t.bmAthl]] : []).concat(D && D.gamesWu ? [["games",t.bmGames]] : []).map(([k,l]) => `<button data-gbm="${k}">${l}</button>`).join("")}</div>`; };

function screen(){
  const t = TL();
  { const hs = history.state;   // словарь открыли заново (шаг истории без места в словаре) — начинаем со списка разделов, иначе «назад» уводит из словаря мимо него
    if(hs && hs.gym){ if(!RESTORED) restore(hs.gym); } else if(G.topic || G.ch) restore(null);
    RESTORED = true; }
  if(!D){ load(); return failed ? `<div class="empty">${t.loadErr}</div>` : `<div class="loading">${typeof SPIN!=="undefined"?SPIN:"…"}</div>`; }
  const keys = ["dict","build","mine"]; if(!keys.includes(G.tab)) G.tab = "dict";
  bmTopic();   // запоминаем раздел (урок), даже если «Составить» в нём не открывали
  let h = `<div class="gym"><div class="search gsearch">${icon("search","sm")}<input id="gsearch" placeholder="${esc(phOf())}" value="${esc(G.q)}" autocomplete="off" enterkeyhint="search"><button class="${G.q?"":"hide"}" data-gclearq aria-label="×">${icon("x","sm")}</button></div>`;
  h += `<div id="gres">${results()}</div><div id="gmain" class="${G.q.trim()?"ghide":""}">`;
  h += `<div class="seg">${keys.map((k,i) => `<button class="${G.tab===k?"on":""}" data-gtab="${k}">${t.tabs[i]}</button>`).join("")}</div>`;
  if(G.dplay && !(G.tab==="build" && bmode()==="dance")) dStop();
  h += G.tab==="dict" ? termsView() : G.tab==="build" ? bmSwitch() + (bmode()==="pick" ? "" : bmode()==="none" ? `<div class="gsrc">${t.bmSoon}</div>` : bmode()==="dance" ? danceView() : bmode()==="athl" || bmode()==="games" ? athlView() : builderView()) : mineView();
  const srcT = G.tab==="build" ? (bmode()==="athl" || bmode()==="games" || bmode()==="none" || bmode()==="pick" ? "" : t.src) : G.tab!=="dict" || !G.topic ? "" : G.topic==="games" ? t.srcGames : G.topic==="athl" ? t.srcAthl : G.topic==="rus" || G.topic==="mych" ? "" : t.src;   // у игр свои источники; общая подпись — только в разделах гимнастики и танцев
  h += `${srcT?`<p class="muted small gsrcfoot">${srcT}</p>`:""}</div></div>`;
  setTimeout(stickChips, 0);
  return h;
}
function updateSearch(v){
  G.q = v; const r = $("gres"), m = $("gmain"); if(!r || !m) return;
  r.innerHTML = results(); m.classList.toggle("ghide", !!v.trim());
  const x = document.querySelector("[data-gclearq]"); if(x) x.classList.toggle("hide", !v);
}
let qTimer = null;
document.addEventListener("input", e => { if(e.target.id==="gsearch" && !e.isComposing){ clearTimeout(qTimer); const v = e.target.value; qTimer = setTimeout(() => updateSearch(v), 150); }
  if(e.target.id==="gw_t" && G.draft){ const old = draftText(G.draft); G.draft.text = e.target.value; const keep = draftFrom(old).marks; G.draft.marks = G.draft.text.split(/\s+/).filter(Boolean).map((w,i) => keep[i]!==undefined && w.length>keep[i] ? keep[i] : -1); $("gw_st").innerHTML = stressPicker(G.draft); } });
document.addEventListener("compositionend", e => { if(e.target.id==="gsearch") updateSearch(e.target.value); });
// свернуть/развернуть «Пройдено» — запоминаем для каждого раздела
document.addEventListener("toggle", e => { const d = e.target; if(d && d.dataset && d.dataset.gpast){ const o = LS.get("gPastOpen", {}) || {}; o[d.dataset.gpast] = d.open; LS.set("gPastOpen", o); } }, true);
document.addEventListener("click", e => {
  const b = e.target.closest("[data-gachk],[data-gaage],[data-gaplay],[data-gatpl],[data-gadef],[data-gaclr],[data-gaundo],[data-garun],[data-gadel],[data-gapick],[data-gaadd],[data-gacopy],[data-gsay],[data-gbm],[data-gdbar],[data-gdtempo],[data-gdmeter],[data-gdother],[data-gdplay],[data-gdpick],[data-gdipopen],[data-gdinfo],[data-gdm],[data-gdw],[data-gds],[data-gdil],[data-gdia],[data-gdipok],[data-gdadd],[data-gdundo],[data-gdclr],[data-gdcopy],[data-gdex],[data-gzoom],[data-gcs],[data-gzz],[data-gtab],[data-gcat],[data-gfav],[data-gopen],[data-gwopen],[data-gnav],[data-gtopic],[data-gch],[data-gmore],[data-grep],[data-gundo],[data-gclr],[data-gnew],[data-gedit],[data-gsave],[data-gdel],[data-gstress],[data-gcopy],[data-gclearq],[data-gnext],[data-gview],[data-gtocards],[data-gtoset],[data-greport],[data-grepsend],[data-gphase],[data-gphs],[data-gphp],[data-goff],[data-gfavlearn],[data-gslow],[data-grep3],[data-grecall],[data-gscope],[data-gtoggle],[data-gex],[data-gplay],[data-gpick],[data-gp],[data-gipnow],[data-gpadd],[data-gpip],[data-gprep],[data-gipopen],[data-gil],[data-gia],[data-gipok],[data-ginfo],[data-gord],[data-ghide]");
  if(!b || !D) return;
  const d = b.dataset;
  if(dClick(d)) return;
  if(aClick(d)) return;
  if(d.gsay!==undefined) return speak(d.gsay);
  if(d.gfav!==undefined){ const f = favs(), on = !f.includes(d.gfav); LS.set("gymFav", on ? [...f, d.gfav] : f.filter(x => x!==d.gfav)); if(navigator.vibrate) navigator.vibrate(10);
    document.querySelectorAll(`[data-gfav="${CSS.escape(d.gfav)}"]`).forEach(x => { x.classList.toggle("on", on); x.textContent = on ? "★" : "☆"; x.setAttribute("aria-pressed", on); });
    if(G.tab==="mine" && !G.q.trim() && !$("modal").classList.contains("open")) render(); return; }
  if(d.gopen!==undefined) return openItem(d.gopen);
  if(d.gwopen!==undefined) return openMine(d.gwopen);
  if(d.gzoom!==undefined) return openZoom(d.gzoom.split(","), d.gtitle||"", d.gfr!==undefined ? +d.gfr : null);
  if(d.gcs!==undefined){ const g = b.closest(".gcar"); if(g) carDraw(g, +(g.dataset.i||0) + +d.gcs); return; }
  if(d.gzz!==undefined) return zoomSet(+d.gzz > 0 ? ZM.z * 1.5 : ZM.z / 1.5);
  if(d.gnew!==undefined) return openWord(null);
  if(d.gedit!==undefined) return openWord(d.gedit);
  if(d.gsave!==undefined) return saveWord();
  if(d.gdel!==undefined){ LS.set("myWords", myWords().filter(w => w.id!==d.gdel)); LS.set("gymFav", favs().filter(x => x!==d.gdel)); closeSheet(); toast(TL().wDeleted); return render(); }
  if(d.gstress!==undefined){ const [wi, ci] = d.gstress.split(":").map(Number); G.draft.marks[wi] = G.draft.marks[wi]===ci ? -1 : ci; $("gw_st").innerHTML = stressPicker(G.draft); return; }
  if(d.gcopy!==undefined) return copyText(exerciseText(), b);
  if(d.gclearq!==undefined){ const i = $("gsearch"); if(i){ i.value = ""; i.focus(); } return updateSearch(""); }
  if(d.gtoggle!==undefined){ if(G.open){ G.open = false; saveNav(); return render(); }   // свернуть — остаёмся в том же разделе
    if(G.sub) return history.back();   // открыть все разделы: «назад» к развёрнутой панели или просто развернуть
    G.open = true; saveNav(); render(); const a = document.querySelector(".gym .gall"); if(a && a.getBoundingClientRect().top < 0) window.scrollTo(0, window.scrollY + a.getBoundingClientRect().top - 70); return; }
  if(d.gcat!==undefined && G.tab==="dict" && b.closest(".gstrip")){ G.cat = d.gcat; saveNav(); render();
    const cr = document.querySelector(".gym .gcrumb"), hd = document.querySelector("header"); if(cr && cr.getBoundingClientRect().top < 0) window.scrollTo(0, Math.max(0, window.scrollY + cr.getBoundingClientRect().top - (hd ? hd.offsetHeight : 0) - 6)); return; }
  if(d.gcat!==undefined && G.tab==="dict"){   // выбрали раздел: панель сворачивается, «назад» снова её разворачивает
    G.cat = d.gcat; G.open = true; G.sub = false; saveNav();
    G.open = false; G.sub = true; G.dp = (G.dp||0) + 1; history.pushState({screen:"dict", gym:navState()}, ""); render();
    const cr = document.querySelector(".gym .gcrumb"), hd = document.querySelector("header"); if(cr && cr.getBoundingClientRect().top < 0) window.scrollTo(0, Math.max(0, window.scrollY + cr.getBoundingClientRect().top - (hd ? hd.offsetHeight : 0) - 6)); return; }
  if(d.gnext!==undefined) return switchItem(d.gnext);
  if(d.gview!==undefined){ LS.set("gymGrid", !LS.get("gymGrid", false)); return render(); }
  if(d.gtocards!==undefined) return openToCards(d.gtocards);
  if(d.gtoset!==undefined) return addToSet(d.gtoset, d.gid);
  if(d.greport!==undefined) return openReportT(d.greport);
  if(d.grepsend!==undefined) return sendReportT(d.grepsend);
  if(d.gphase!==undefined) return openPhases(d.gphase);
  if(d.gphs!==undefined){ if(!PH.fr) return; PH.play = false; const p = $("gphp"); if(p) p.textContent = "▶"; PH.i = (PH.i + +d.gphs + PH.fr.length) % PH.fr.length; return drawPhase(); }
  if(d.gphp!==undefined){ PH.play = !PH.play; b.textContent = PH.play ? "⏸" : "▶"; return; }
  if(d.goff!==undefined){ if(b.disabled) return; b.disabled = true; return saveOffline(d.goff, b); }
  if(d.gslow!==undefined || d.grep3!==undefined){ const k = d.gslow!==undefined ? "gymSlow" : "gymRep3", on = !LS.get(k, false); LS.set(k, on); document.querySelectorAll(d.gslow!==undefined ? "[data-gslow]" : "[data-grep3]").forEach(x => x.classList.toggle("on", on)); return; }
  if(d.grecall!==undefined){ G.recAll = true; return render(); }
  if(d.gfavlearn!==undefined){ const st = {v:"set", id:"r:fav"}; history.pushState({screen:"cards", cards:st}, ""); state.screen = "cards"; if(window.CARDS) CARDS.restore(st); window.scrollTo(0,0); return render(); }
  if(d.gscope!==undefined){ G.scope = d.gscope; G.more = 0; const r = $("gres"); if(r) r.innerHTML = results(); return; }
  if(d.gnav!==undefined) return d.gnav==="root" ? backTo(G.dp||0, null) : backTo(G.tdp!==undefined && G.tdp < (G.dp||0) ? G.dp - G.tdp : 0, G.topic);
  if(d.gord!==undefined) return openOrd(d.gord);
  if(d.ghide!==undefined){ const was = DORD.hid("i:"+d.ghide); DORD.toggle("i:"+d.ghide); if(!was) toast(TL().hidOk); return; }
  if(d.gtopic!==undefined) return navTo(d.gtopic, null);
  if(d.gch!==undefined) return navTo(G.topic, d.gch);
  if(d.gmore!==undefined){ G.more++; const r = $("gres"); if(r) r.innerHTML = results(); return; }
  if(d.gplay!==undefined) return playEx();
  if(d.gpick!==undefined) return openPick();
  if(d.gipopen!==undefined) return openIp();
  if(d.ginfo!==undefined) return openInfo(+d.ginfo);
  if(d.gp!==undefined){ const [c, i] = d.gp.split(":"); G.pk[c] = G.pk[c]===+i ? null : +i;
    document.querySelectorAll(`#sheet [data-gp^="${c}:"]`).forEach(x => x.classList.toggle("on", x.dataset.gp===c+":"+G.pk[c])); return pickLabel(); }
  if(d.gil!==undefined || d.gia!==undefined){ if(d.gil!==undefined) G.ipk.l = +d.gil; else G.ipk.a = +d.gia; refreshSheet(); return; }
  if(G.play && d.gtab===undefined){ clearTimeout(G.play); G.play = null; }
  if(d.gpadd!==undefined){ addPick(G.pk); closeSheet(); return render(); }
  if(d.gipnow!==undefined){ addIp(); return render(); }
  if(d.gpip!==undefined){ addIp(); closeSheet(); return render(); }
  if(d.gprep!==undefined){ addRepeat(); closeSheet(); return render(); }
  if(d.gipok!==undefined){ G.legs = G.ipk.l; G.arms = G.ipk.a; startEx(); closeSheet(); return render(); }
  if(d.gtab){ if(G.play){ clearTimeout(G.play); G.play = null; } G.tab = d.gtab; }
  else if(d.gcat){ G.cat = d.gcat; }
  else if(d.gex!==undefined){ runExample(+d.gex); }
  else if(d.grep!==undefined){ addRepeat(); }
  else if(d.gundo!==undefined){ undo(); }
  else if(d.gclr!==undefined){ startEx(); }
  if(d.gtab || d.gcat) setTimeout(saveNav, 0);
  const chips = document.querySelector(".gym .gchips"), sl = chips ? chips.scrollLeft : 0, catTap = !!d.gcat;
  const top0 = catTap && chips ? chips.getBoundingClientRect().top : null;
  render();
  const c2 = document.querySelector(".gym .gchips"); if(c2){ c2.scrollLeft = sl; stickChips();
    if(catTap){ const on = c2.querySelector(".on"); if(on){ const l = on.offsetLeft, r = l + on.offsetWidth; if(l < c2.scrollLeft+8 || r > c2.scrollLeft+c2.clientWidth-8) c2.scrollTo({left: l-(c2.clientWidth-on.offsetWidth)/2, behavior:"smooth"}); }
      // новый раздел — с его начала, но полоса остаётся там же на экране (без рывка наверх)
      const st = parseFloat(c2.style.top)||0, cur = c2.getBoundingClientRect().top;
      if(top0!==null && cur <= st+1){ const list = c2.nextElementSibling; if(list) window.scrollTo(0, window.scrollY + list.getBoundingClientRect().top - st - c2.offsetHeight - 6); } } }
});
// полоса разделов прилипает под шапкой приложения
// полоса разделов: прилипает под шапкой и после любой перерисовки (закрыли карточку, картинку и т. п.) остаётся там же, где была
// прокрутили вниз — поиск и вкладки уехали; чуть вверх — поиск возвращается и прилипает над лентой разделов
let lastY = 0;
function placeTop(){ const g = document.querySelector(".gym"), hd = document.querySelector("header"); if(!g) return; const h = hd ? hd.offsetHeight : 0, sr = g.querySelector(".gsearch"), c = g.querySelector(".gchips");
  if(sr) sr.style.top = h + "px"; if(c) c.style.top = (h + (g.classList.contains("gpin") && sr ? sr.offsetHeight + 8 : 0)) + "px"; }
window.addEventListener("scroll", () => { if(state.screen!=="dict") return; const g = document.querySelector(".gym"); if(!g) return;
  const y = window.scrollY, dy = y - lastY; let pin = g.classList.contains("gpin");
  if(y < 160) pin = false; else if(dy < -8) pin = true; else if(dy > 8) pin = false; else return;
  lastY = y; if(pin !== g.classList.contains("gpin")){ g.classList.toggle("gpin", pin); placeTop(); } }, {passive:true});
function stickChips(){ const c = document.querySelector(".gym .gchips"), hd = document.querySelector("header"); if(!c) return; if(hd) c.style.top = hd.offsetHeight + "px"; placeTop();
  const sp = c.querySelector(".gstrip"); if(sp){ const on = sp.querySelector(".on"); if(on) sp.scrollLeft = on.offsetLeft - (sp.clientWidth - on.offsetWidth)/2; return; }   // текущий раздел — по центру, соседи по бокам
  const key = G.ch||""; if(G.chipSL && G.chipSL.k===key) c.scrollLeft = G.chipSL.x;
  else { const on = c.querySelector(".on"); if(on && on.offsetLeft+on.offsetWidth > c.clientWidth) c.scrollLeft = on.offsetLeft-(c.clientWidth-on.offsetWidth)/2; }
  if(!c._gl){ c._gl = 1; c.addEventListener("scroll", () => { G.chipSL = {k:G.ch||"", x:c.scrollLeft}; }, {passive:true}); } }
const css = `
.gym .gsearch{margin-bottom:10px}
.gym .ghide{display:none}
.gym .gchips{flex-wrap:nowrap;overflow-x:auto;padding:8px 14px 10px;margin:0 -14px;scrollbar-width:none;position:sticky;top:0;z-index:6;background:var(--bg)}
.gym .gchips button{white-space:nowrap;background:var(--card)}
.gym .gchips button.on{background:var(--accent)}
.gym .pick.gsm button{font-size:13.5px;padding:6px 11px;min-height:34px}
.gym .gtip{background:var(--accent-soft);border-radius:14px;padding:10px 12px;font-size:14px;margin:2px 0 10px}
.gym .gtip b{color:var(--accent)} .gym .gtip b.gok{color:var(--ok)} .gym .gtip b.gno{color:var(--exam)}
.gym .gcard{background:var(--card);border-radius:var(--r);padding:12px;margin-bottom:10px;box-shadow:var(--shadow);display:flex;gap:12px;align-items:flex-start}
.gym .gcard.col,.gym .gcard.wide{flex-direction:column;align-items:stretch}
.gym .gcard.wide .gfigs{width:100%} .gym .gcard.wide .gfigbtn{width:100%;height:112px}
.gym .gcard.mine{border-left:3px solid var(--accent)}
.gym .gfigs{display:flex;gap:4px;flex-shrink:0} .gym .gfigs.two .gfigbtn{width:60px}
.gfig{display:block;background:var(--ink);-webkit-mask:var(--m) center/contain no-repeat;mask:var(--m) center/contain no-repeat} .gfig.gimg{background:none;-webkit-mask:none;mask:none;object-fit:contain;border-radius:6px}
.gym .gfigbtn{width:86px;height:86px;border-radius:12px;background:var(--card2);display:flex;align-items:center;justify-content:center;padding:6px}
.gym .gfigbtn .gfig{width:100%;height:100%}
.gym .gnofig{width:86px;height:86px;border-radius:12px;border:1.5px dashed var(--line);display:flex;align-items:center;justify-content:center;text-align:center;font-size:11px;color:var(--muted);padding:6px;flex-shrink:0}
.gym .gbody{flex:1;min-width:0}
.gym .gterm{display:flex;align-items:flex-start;gap:6px} .gym .gfav{flex:none;width:34px;height:34px;margin:-4px -4px 0 0;border-radius:50%;font-size:21px;line-height:1;color:var(--muted);display:flex;align-items:center;justify-content:center} .gym .gfav.on{color:#f2b01e} .gym .gfav:active{transform:scale(.85)} .gym .gterm b{font-size:17.5px;font-weight:750;flex:1}
.gym .gzhl{color:var(--muted);font-size:13.5px;margin-top:1px}
.gym .gd{font-size:14.5px;margin-top:6px;white-space:pre-line} .gym .glg{margin:0 0 8px;font-size:13px;color:var(--muted)} .gym .glg summary{cursor:pointer;font-weight:600} .gym .glg span{display:flex;align-items:center;gap:8px;margin-top:5px;color:var(--text)} .gym .glg svg{flex-shrink:0}
.gym .gsay{margin-top:10px;background:var(--card2);border-radius:12px;padding:6px 4px 4px 12px;display:flex;flex-direction:column}
.gym .gsayh{font-size:12px;font-weight:650;color:var(--muted);padding:2px 0 2px}
.gym .gsay .gsayl{background:none;border-radius:0;padding:4px 4px 4px 0;min-height:34px} .gym .gsay .gsayl+.gsayl{border-top:1px solid var(--line)}
.gym .gsayl{display:flex;align-items:center;gap:6px;background:var(--card2);border-radius:10px;padding:6px 6px 6px 10px;font-size:14.5px;font-weight:600;min-height:38px}
.gym .gsayl span{flex:1}
.gym .gordb{display:block;margin:14px auto 4px;padding:8px 14px;border-radius:16px;color:var(--muted);font-size:13px;background:none;border:1px dashed var(--line,rgba(128,128,128,.35))}
.gym .gall + .gordb,.gym .gall ~ .gordb{margin:8px 0 4px}
.gym .gspk,.gym .gedit{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--accent);flex-shrink:0}
.gym .gspk svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.gym .gsrc{font-size:12px;color:var(--muted);margin-top:6px}
.gym .gsrcfoot{margin:14px 4px 0}
.gym .gh4{font-size:16px;display:block}
.gym div.gok,.gym div.gno{display:flex;align-items:center;gap:8px;font-size:15px;padding:3px 0}
.gym .gok i,.gym .gno i{font-style:normal;font-weight:800;width:18px;text-align:center}
.gym .gok i{color:var(--ok)} .gym .gno i{color:var(--exam)} .gym .gok span{flex:1;font-weight:650}
.gym .gno span{flex:1;color:var(--muted);text-decoration:line-through;text-decoration-color:var(--exam)}
.gym .glbl{font-size:13px;font-weight:700;color:var(--muted);margin:12px 4px 6px}
.gym .ggrp{font-size:12px;font-weight:700;color:var(--muted);margin:10px 2px 5px}
.gym .gphrase{display:flex;align-items:center;gap:8px;font-size:19px;font-weight:750;line-height:1.3} .gym .gphrase>span{flex:1} .gym .gip{color:var(--accent)}
.gym .gipfig{display:flex;justify-content:center;margin-top:10px} .gym .gipfig .gfigbtn{width:150px;height:150px}
.gym .gstate{font-size:13.5px;color:var(--muted)} .gym .gstate b{color:var(--ink)}
.gym .gadd{margin-top:12px} .gym .gadd:disabled{opacity:.45}
.gym .gtools{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.gym .gtools button{border-radius:10px;background:var(--accent-soft);color:var(--accent);font-weight:650;font-size:13.5px;padding:8px 11px}
.gym .gtools button:disabled{opacity:.35}
.gym .gln{border-bottom:.5px solid var(--line);padding:4px 0} .gym .gln:last-of-type{border-bottom:0}
.gym .grow{display:flex;gap:10px;align-items:center;font-size:15.5px}
.gym .gn{min-width:44px;font-weight:800;color:var(--accent)} .gym .grow>span:nth-child(2){flex:1}
.gym .gmini{width:46px;height:52px;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.gym .gmini .gfig{max-width:46px;max-height:52px;width:100%;height:100%}
.gym .gcmd{font-size:13px;color:var(--muted);margin:0 0 4px 54px}
.gym .gnote{font-size:13px;margin:0 0 6px 54px;background:var(--accent-soft);border-radius:8px;padding:5px 8px}
.gym .gcopy{margin-top:10px;align-self:flex-start}
.gym .gquiz{text-align:center} .gym .gscore{font-size:13px;color:var(--muted)}
.gym .gqfig{height:170px;display:flex;justify-content:center;gap:10px;margin:6px 0 12px} .gym .gqfig .gfig{height:auto;width:min(100%,calc(170px*var(--ar)))}
.gym .gopts{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.gym .gopts button{border-radius:12px;background:var(--card2);padding:12px 8px;font-weight:650;font-size:15px;min-height:52px}
.gym .gopts button.ok{background:var(--ok-soft);color:var(--ok);outline:2px solid var(--ok)}
.gym .gopts button.bad{background:var(--exam-soft);color:var(--exam)}
.gym .gqinfo{margin-top:10px;text-align:left}
.gv{position:relative}
.gv::after{content:"";position:absolute;left:50%;top:-.1em;width:.1em;height:.3em;border-radius:.05em;background:currentColor;transform:translateX(-50%) rotate(30deg);pointer-events:none}
.gzoom{display:flex;gap:16px;justify-content:center;align-items:center;min-height:260px;padding:10px 0}
.gym .glz{width:100%;font-size:13px;line-height:1.35;margin:4px 0 2px;display:flex;flex-direction:column;gap:3px} .gym .glz:empty{display:none} .gym .glz div{display:flex;gap:8px;justify-content:space-between;border-bottom:1px dashed var(--line,#ddd);padding:2px 0} .gym .glz span{color:var(--muted)} .gym .glz b{font-weight:600;text-align:right}
.gcar{width:100%;--gch:min(36vh,300px);--gchf:min(52vh,480px);--gk:1.15} .gcar .gcvw{display:flex;justify-content:center;align-items:center;min-height:120px} .gcar .gcv{display:block;border:0;padding:0;cursor:zoom-in;border-radius:0}
.gcar .gcn{display:flex;justify-content:center;align-items:center;gap:18px;margin-top:6px} .gcar .gcn button,.gzv .gzbar button{width:48px;height:38px;border-radius:12px;border:0;background:var(--card);color:var(--accent);font-size:24px;line-height:1;padding:0;display:flex;align-items:center;justify-content:center}
.gcar .gcnn{font-size:14px;color:var(--muted);min-width:52px;text-align:center}
.gcard.gcarc .gfigw{flex-direction:column;gap:8px} .gcard.gcarc .gfigw .gfigs{width:100%}
#sheet:has(.gzv){max-height:calc(var(--vvh,100vh) - 12px);height:calc(var(--vvh,100vh) - 12px);max-width:none;display:flex;flex-direction:column}
.gzv{display:flex;flex-direction:column;flex:1;min-height:0} .gzv h2{margin:0 44px 6px 0;font-size:17px}
.gzv .gzbar{display:flex;justify-content:center;align-items:center;gap:14px;margin-bottom:6px} .gzv .gzbar button{width:44px;height:36px;border-radius:12px;border:0;background:var(--card);color:var(--accent);font-size:22px}
.gzv .gzbar span{font-size:13px;color:var(--muted);min-width:44px;text-align:center}
.gzv .gzsc{flex:1;min-height:0;overflow:auto;touch-action:pan-x pan-y;-webkit-overflow-scrolling:touch;background:var(--card);border-radius:14px}
.gzv .gzin{width:100%;min-height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:14px;padding:8px;box-sizing:border-box}
.gzv .gzin .gfig,.gzv .gzin .gzf{display:block;width:100%!important;height:auto!important;max-width:none!important;max-height:none!important}
.gzv .gzhint{font-size:12px;color:var(--muted);text-align:center;margin-top:6px}
.gzoom .gfig{height:auto;width:min(86vw,calc(260px*var(--ar)),640px)}
.gstress .gpick{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:22px;font-weight:700;margin:4px 0}
.gstress .gsw{display:inline-flex}
.gstress .gsw i{font-style:normal;padding:4px 1px}
.gstress .gsw button{padding:2px 4px;border-radius:8px;background:var(--accent-soft);color:var(--accent);margin:0 1px;font-weight:800}
.gstress .gsw button.on{background:var(--accent);color:var(--accent-ink,#fff)}
.gstress small{display:block;color:var(--muted);font-size:13px;margin-bottom:8px} .gstress small.gokt{color:var(--ok)}
`;
const css2 = `
.gym .gcrumb{font-size:14px;color:var(--muted);margin:2px 2px 8px;display:flex;flex-wrap:wrap;gap:4px;align-items:center} .gym .gcrumb button{color:var(--accent);font-weight:600;padding:2px 0} .gym .gcrumb b{color:var(--ink)}
.gym .gtiles{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.gym .gtile{background:var(--card);border-radius:var(--r);box-shadow:var(--shadow);padding:16px 14px;text-align:left;display:flex;flex-direction:column;gap:3px;min-height:118px}
.gym .gtile:first-child{grid-column:1/-1;background:linear-gradient(135deg,var(--accent-soft),var(--card))}
.gym .gtile .gem{font-size:34px;line-height:1.1} .gym .gtile .gill{width:58px;height:58px;border-radius:50%;background:var(--accent-soft);display:flex;align-items:center;justify-content:center;padding:7px;box-sizing:border-box} .gym .gtile .gill .gfig{width:100%;height:100%;background:var(--accent)} .gym .gtile b{font-size:17px;margin-top:6px} .gym .gtile small{color:var(--muted);font-size:13px} .gym .gtile.soon{opacity:.45;box-shadow:none}
.gym .gchr{display:flex;align-items:center;gap:8px;width:100%;background:var(--card);border-radius:14px;padding:13px 14px;margin-bottom:6px;text-align:left;box-shadow:var(--shadow)}
.gym .gprog{display:flex;align-items:center;gap:10px;font-size:12.5px;color:var(--muted);margin:2px 2px 12px}
.gym .gprog i{flex:1;height:6px;border-radius:3px;background:var(--line);overflow:hidden} .gym .gprog i b{display:block;height:100%;background:var(--accent)}
.gym .gnow{display:flex;flex-direction:column;align-items:flex-start;gap:3px;width:100%;text-align:left;padding:14px;margin-bottom:14px;border-radius:var(--r);background:var(--accent-soft);border:1.5px solid var(--accent);box-shadow:var(--shadow)}
.gym .gnow .gbadge{font-size:11.5px;padding:2px 9px;border-radius:10px;background:var(--accent);color:var(--accent-ink,#fff)} .gym .gnow b{font-size:17px;margin-top:4px} .gym .gnow small{color:var(--muted);font-size:13px}
.gym .gpast>summary{list-style:none;display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:var(--muted);padding:4px 2px 8px;user-select:none}
.gym .gpast>summary::-webkit-details-marker{display:none} .gym .gpast>summary small{margin-left:auto;font-size:12px}
.gym .gpast>summary svg{transition:transform .2s} .gym .gpast[open]>summary svg{transform:rotate(90deg)}
.gym .gchr.done b{font-weight:500;color:var(--muted)} .gym .gck{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:13px;background:var(--accent-soft);color:var(--accent);flex-shrink:0}
.gym .gthem{display:grid;place-items:center;font-size:22px;background:var(--accent-soft);color:var(--accent)}
.gym .gchr b{flex:1;font-size:15.5px} .gym .gchr small{color:var(--muted);font-size:13px;white-space:nowrap}
.gym .gth .gimg1{width:100%;height:100%;object-fit:cover;object-position:0 0;border-radius:6px} .gym .gth.gthi{background:var(--accent-soft);color:var(--accent)} .gym .gthi svg{width:58%;height:58%;max-width:44px;max-height:44px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round} .gym .gth.gthl{background:transparent} .gym .gthl i{width:34px;height:34px;border-radius:50%;background:var(--accent-soft);color:var(--accent);display:flex;align-items:center;justify-content:center;font-style:normal;font-weight:700;font-size:16px}
.gym .ggh{font-size:12.5px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.3px;margin:14px 4px 6px}
.gym .grw{display:flex;align-items:center;gap:10px;background:var(--card);border-radius:14px;padding:7px 8px 7px 7px;margin-bottom:6px;cursor:pointer;box-shadow:var(--shadow)}
.gym .grw:active{background:var(--card2)}
.gym .gth{width:52px;height:52px;flex:none;border-radius:11px;background:var(--card2);display:flex;align-items:center;justify-content:center;padding:4px}
.gym .gth .gfig{width:100%;height:100%} .gym .gth.gmy{color:var(--accent);font-size:20px;padding:0}
.gym .gct{flex:1;min-width:0} .gym .gct b{display:block;font-size:15.5px;font-weight:700;line-height:1.3} .gym .gct small{display:block;color:var(--muted);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}
.gym .grw .gfav{margin:0} .gym .grw .gspk{margin:0 -6px 0 0}
.gym .gall{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 10px}
.gym .gall button{background:var(--card);border-radius:16px;padding:6px 11px;font-size:13.5px;box-shadow:var(--shadow);display:flex;gap:5px;align-items:baseline}
.gym .gall button small{color:var(--muted);font-size:11px}
.gym .gall button.on{background:var(--accent);color:var(--accent-ink,#fff)} .gym .gall button.on small{color:inherit;opacity:.8}
.gym .gbar{display:flex;align-items:center;gap:6px;overflow:visible;padding:8px 0 10px 14px}
.gym .gstrip{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;flex:1;min-width:0;position:relative;scroll-behavior:auto}
.gym .gstrip::-webkit-scrollbar{display:none}
.gym .gstrip button{flex:none;white-space:nowrap;max-width:44%;overflow:hidden;text-overflow:ellipsis;background:var(--card);border-radius:16px;padding:6px 11px;font-size:13.5px;box-shadow:var(--shadow)}
.gym .gstrip button.on{background:var(--accent);color:var(--accent-ink,#fff);font-weight:600;max-width:60%}
.gym .gallb{flex:none;background:none!important;box-shadow:none;color:var(--accent);font-weight:600;font-size:13.5px;padding:6px 14px 6px 4px;white-space:nowrap}
.gym .gscope{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}
.gym .gscope button{background:var(--card);border-radius:16px;padding:6px 11px;font-size:13.5px;box-shadow:var(--shadow)}
.gym .gscope button small{color:var(--muted);font-size:11.5px} .gym .gscope button.on{background:var(--accent);color:var(--accent-ink,#fff)} .gym .gscope button.on small{color:inherit;opacity:.85}
.gym .gfigw{position:relative}
.gym .gphb{position:absolute;right:8px;bottom:8px;background:var(--card);color:var(--accent);border-radius:14px;padding:5px 10px;font-size:13px;font-weight:600;box-shadow:var(--shadow)}
.gym .glink{color:inherit;text-decoration:underline;text-decoration-color:var(--accent);text-decoration-thickness:1.5px;text-underline-offset:2px;cursor:pointer}
.gym .galso{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 4px;align-items:center} .gym .galso small{color:var(--muted);font-size:12px;width:100%}
.gym .galso button{background:var(--accent-soft);border-radius:12px;padding:4px 9px;font-size:13.5px;display:flex;gap:5px;align-items:baseline} .gym .galso button i{font-style:normal;color:var(--muted);font-size:12px}
.gym .gaud{display:flex;gap:6px;margin:8px 0 2px} .gym .gaud button{border-radius:14px;padding:5px 10px;font-size:13px;background:var(--card2);color:var(--muted)} .gym .gaud button.on{background:var(--accent-soft);color:var(--accent);font-weight:600}
.gym .gtools{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;padding-top:10px;border-top:1px solid var(--line)}
.gym .gtools button{border-radius:14px;padding:6px 11px;font-size:13.5px;background:var(--card2)} .gym .gtools button:first-child{color:var(--accent);font-weight:600}
.gym .gtools button:last-child{color:var(--muted);margin-left:auto}
.gym .gset{width:100%;text-align:left}
.gym .goff{margin-top:14px} .gym .goffok{color:var(--muted);font-size:13px;text-align:center;margin:14px 0 4px}
.gym .gfavlearn{margin:6px 0 4px}
.gphase canvas{width:100%;display:block;color:var(--text);margin:8px 0}
.gphase .gphnav{display:flex;justify-content:center;align-items:center;gap:14px}
.gphase .gphnav button{width:42px;height:42px;border-radius:50%;background:var(--card2);font-size:20px;color:var(--accent)} .gphase .gphnav span{min-width:50px;text-align:center;color:var(--muted)}
.gym textarea#grep_t{width:100%;min-height:90px}
.gym .gfull{font-size:13px;color:var(--muted);margin:-4px 0 4px}
.gym .gth.gw{width:84px}
.gsheet .gcard{box-shadow:none;padding:0;background:transparent;flex-direction:column;align-items:stretch}
.gsheet .gcard .gfigs{width:100%;justify-content:center} .gsheet .gcard .gfigbtn{width:100%;max-width:220px;height:200px;margin:0 auto} .gsheet .gcard .gfigs.two .gfigbtn{width:48%;height:180px}
.gsheet .gcard .gnofig{display:none}
#sheet:has(.gitem){min-height:86vh}
.gsheet.gitem .gcard .gfigbtn{width:100%;max-width:none;height:min(32vh,260px)} .gsheet.gitem .gfigbtn{display:flex;align-items:center;justify-content:center} .gsheet.gitem .gfigbtn:has(.gfig[style*="--gu"]){height:auto} .gsheet.gitem .gfigbtn .gfig[style*="--gu"]{height:min(calc(var(--gu) * 1.15),52vh,480px);width:auto;max-width:100%} .gsheet.gitem .gcard .gfigs.two .gfigbtn{width:49%;height:min(28vh,220px)}
.gsheet .gterm b{font-size:22px}
.gym .gmore{margin-top:6px}
.gym .gexm{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:10px} .gym .gexm small{width:100%;color:var(--muted);font-size:13px}
.gym .gexm button{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:6px 12px;font-weight:600;font-size:14px}
.gym .gexc{padding:12px 12px 8px}
.gym .gexh{display:flex;align-items:center;justify-content:space-between;gap:8px} .gym .gexh b{font-size:17px}
.gym .gplay{background:var(--accent);color:var(--accent-ink,#fff);border-radius:16px;padding:7px 13px;font-weight:700;font-size:14px} .gym .gplay:disabled{opacity:.4}
.gym .gstage{height:170px;display:flex;align-items:center;justify-content:center;background:var(--card2);border-radius:14px;margin:10px 0 6px}
.gym .gstage .gfig{height:150px;width:min(100%,calc(150px*var(--ar)))} .gym .gstage.pop .gfig{animation:gpop .35s ease-out}
@keyframes gpop{from{transform:scale(.85);opacity:.3}to{transform:none;opacity:1}}
.gym .gl2{display:flex;align-items:center;gap:8px;padding:7px 4px;border-top:.5px solid var(--line);border-radius:10px;transition:background .25s;font-size:15.5px}
.gym .gl2.on{background:var(--accent-soft)} .gym .gl2 .gn{min-width:40px;font-weight:800;color:var(--accent)} .gym .gl2 .gtx{flex:1;min-width:0} .gym .gl2 .gtx small{display:block;color:var(--muted);font-size:12px}
.gym .gip2{cursor:pointer;border-top:0} .gym .gl2 .gi{width:30px;height:30px;flex:none;border-radius:50%;color:var(--muted);font-size:17px;display:flex;align-items:center;justify-content:center}
.gym .gtools2{display:flex;flex-wrap:wrap;gap:4px 14px;padding:8px 4px 2px;border-top:.5px solid var(--line)}
.gym .gtools2 button{display:inline-flex;align-items:center;gap:4px;color:var(--muted);font-size:13.5px;font-weight:600;padding:4px 0} .gym .gtools2 button:disabled{opacity:.35}
.gym .gplus{margin-top:2px;font-size:17px;padding:14px}
.gym .gquick{display:flex;gap:8px;flex-wrap:wrap;margin:4px 0} .gym .gquick button{background:var(--accent-soft);color:var(--accent);border-radius:12px;padding:8px 12px;font-weight:650;font-size:14px}
.gym .gpg{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}
.gym .gpt{background:var(--card);border-radius:12px;padding:6px 4px 7px;display:flex;flex-direction:column;align-items:center;gap:3px;border:2px solid transparent}
.gym .gpt>span{height:66px;width:100%;display:flex;align-items:center;justify-content:center} .gym .gpt .gfig{height:62px;width:min(100%,calc(62px*var(--ar)))}
.gym .gmore2{margin-top:14px;background:var(--card);border-radius:14px;padding:2px 10px 8px} .gym .gmore2 summary{cursor:pointer;padding:10px 2px;font-weight:650;color:var(--accent);list-style:none} .gym .gmore2 summary::after{content:" ▾"} .gym .gmore2[open] summary::after{content:" ▴"} .gym .gmore2 .ggh:first-of-type{margin-top:2px}
.gym .gemj{font-size:38px;line-height:1} .gym .gpt small{font-size:12px;line-height:1.2;text-align:center} .gym .gpt.on{border-color:var(--accent);background:var(--accent-soft)}
.gym .gpfoot{position:sticky;bottom:0;padding:10px 0 4px;background:linear-gradient(transparent,var(--bg) 30%);display:flex;gap:8px;align-items:center} .gym .gpfoot .btn{flex:1} .gym .gpprev{width:48px;height:58px;flex:none;display:flex;align-items:center;justify-content:center} .gym .gpprev:empty{display:none} .gym .gpprev .gfig{width:100%;height:100%}
`;
const css3 = `
.gym .gdtm{display:flex;align-items:center;justify-content:center;gap:4px;flex-wrap:wrap;margin:2px 0 8px;font-size:12.5px;color:var(--muted)}
.gym .gdtm button{background:var(--card2);border-radius:12px;padding:4px 7px;font-size:12px;font-weight:600} .gym .gdtm button.on{background:var(--accent-soft);color:var(--accent)} .gym .gdtm .gsep{width:6px}
.gym .gfs{width:100%;height:100%;color:var(--text,#222)} .gym .gmini .gfs{width:52px;height:52px}
.gym .gdstage{height:150px;display:flex;justify-content:center;background:var(--card2);border-radius:14px;margin:10px 0 0} .gym .gdstage .gfs{width:auto;height:150px}
.gym .gbm{display:flex;gap:6px;margin:0 0 10px} .gym .gbm button{flex:1;background:var(--card);border-radius:12px;padding:8px 6px;font-weight:650;font-size:14px;box-shadow:var(--shadow)}
.gym .gbm button.on{background:var(--accent);color:var(--accent-ink,#fff)}
.gym .gaw .gtx{cursor:pointer} .gym .gaw.warn{background:var(--accent-soft)} .gym .gaw .gth{flex-shrink:0} .gym .grw.on{background:var(--accent-soft)} .gym .gnote.gawn{margin-left:0} .gym .gack{display:flex;gap:8px;align-items:flex-start;padding:6px 2px;font-size:14px} .gym .gack input{margin-top:3px;accent-color:var(--accent)} .gym .gagame,.gym .garhy{display:block;font-size:13px;margin-top:2px} .gym .garhy{font-style:italic;color:var(--accent)} .gym .gaw+.gdh,.gym .gsrc+.gdh{margin-top:6px}
.gym .gdbeat{display:flex;gap:4px;justify-content:center;margin:10px 0 6px} .gym .gdbeat i{font-style:normal;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--card2);color:var(--muted);font-weight:800;font-size:15px;transition:all .12s}
.gym .gdbeat i.on{background:var(--accent);color:var(--accent-ink,#fff);transform:scale(1.15)}
.gym .gdh{display:flex;align-items:center;gap:8px;padding:10px 4px 2px;border-top:.5px solid var(--line)} .gym .gdh .gtx{flex:1;min-width:0} .gym .gdh b{font-size:15px;color:var(--accent)} .gym .gdh small{display:block;color:var(--muted);font-size:12px}
.gym .gdh .gi{width:30px;height:30px;flex:none;border-radius:50%;color:var(--muted);font-size:17px;display:flex;align-items:center;justify-content:center}
.gym .gdh+.gl2{border-top:0}
.gym .gdch{display:flex;flex-wrap:wrap;gap:6px;margin:2px 0 8px} .gym .gdch button{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:7px 11px;font-size:14px;font-weight:600;text-align:left}
.gym .gdch button small{display:block;font-weight:400;color:var(--muted);font-size:11.5px} .gym .gdch button.on{border-color:var(--accent);background:var(--accent-soft);color:var(--accent)}
.gym .gdprev{background:var(--card2);border-radius:12px;padding:4px 10px 6px;margin:8px 0} .gym .gdprev .gl2:first-of-type{border-top:0}
.gym .gext{margin-top:8px} .gym .gext summary{list-style:none;display:flex;align-items:center;gap:6px;color:var(--muted);font-size:14px;font-weight:600;padding:10px 4px;cursor:pointer}
.gym .gext summary::-webkit-details-marker{display:none} .gym .gext summary svg{transition:transform .2s} .gym .gext[open] summary svg{transform:rotate(90deg)}
`;
const css4 = `
.gym .grw .gfav,.gym .grw .gspk{width:44px;height:44px;margin:-6px -6px -6px 0}
.gym .gterm .gfav,.gym .gterm .gspk{width:44px;height:44px;margin:-8px -6px -6px 0}
.gym .gstrip button{padding:9px 13px} .gym .gallb{padding:11px 14px 11px 6px}
.gym .gall button,.gym .gscope button{padding:9px 13px}
.gym .gtools button,.gym .gaud button{padding:10px 14px}
.gym .gcrumb button{padding:9px 0}
.gym .gth{width:64px;height:64px} .gym .gth.gw{width:104px}
.gym .gsrc,.gym .gsayh,.gym .galso small,.gym .ggrp{font-size:13px} .gym .ggh{font-size:13px} .gym .gfull{font-size:13.5px}
.gym .gall button small,.gym .gscope button small{font-size:12.5px} .gym .gct small{font-size:13.5px}
.gym .gsrc,.gym .gfull,.gym .ggh,.gym .gct small,.gym .gsayh,.gym .ggrp,.gym .gall button small,.gym .gscope button small,.gym .gcrumb{color:color-mix(in srgb,var(--muted) 60%,var(--text))}
.gym .gall button.on small,.gym .gscope button.on small{color:inherit}
.gym .gcrow{display:flex;align-items:center;gap:6px} .gym .gcrow .gcrumb{flex:1;min-width:0}
.gym .gview{flex:none;width:44px;height:44px;margin:-6px -6px 2px 0;border-radius:12px;font-size:20px;color:var(--accent);display:flex;align-items:center;justify-content:center}
.gym .ggrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.gym .ggrid .ggh{grid-column:1/-1;margin:8px 4px 0}
.gym .ggrid .grw{flex-direction:column;align-items:stretch;position:relative;margin:0;padding:8px;gap:6px}
.gym .ggrid .gth,.gym .ggrid .gth.gw{width:100%;height:118px;padding:6px}
.gym .ggrid .gct b{font-size:14.5px} .gym .ggrid .gct small{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.gym .ggrid .gfav{position:absolute;top:4px;right:4px;margin:0;background:color-mix(in srgb,var(--card) 80%,transparent);border-radius:50%}
.gym .ggrid .gspk{position:absolute;top:4px;left:4px;margin:0;background:color-mix(in srgb,var(--card) 80%,transparent);border-radius:50%}
.gtstrip{margin:14px -16px 0;padding:4px 0 6px}
.gym .gallb.on{color:var(--accent)}
.gts{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding:4px 16px;position:relative}
.gts::-webkit-scrollbar{display:none}
.gts button{flex:none;width:112px;display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px;border-radius:12px;background:var(--card);box-shadow:var(--shadow);text-align:center;min-height:44px}
.gts button b{font-size:12.5px;font-weight:600;line-height:1.2;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.gts button .gth,.gts button .gth.gw{width:100%;height:44px;padding:2px}
.gts button.on{background:var(--accent);color:var(--accent-ink,#fff)} .gts button.on .gth{background:var(--card)}
.gym.gpin .gsearch{position:sticky;z-index:7;box-shadow:0 0 0 8px var(--bg),var(--shadow);animation:gslide .18s ease-out}
@keyframes gslide{from{transform:translateY(-70%);opacity:0}}
`;
const s = document.createElement("style"); s.textContent = css + css2 + css3 + css4; document.head.appendChild(s);
if(window.speechSynthesis) try{ speechSynthesis.getVoices(); }catch(e){}
/* ---------- для «Карточек»: случайное упражнение ОРУ из конструктора ----------
   kind "pose" — только исходное положение; иначе 2–3 счёта движений, потом «и. п.» (и иногда «то же в другую сторону»).
   Возвращает {ip:{txt, fig, rule}, lines:[{n, txt, fig, notes}]}; fig — [dataURL, ширина, высота]. Состояние конструктора не трогает. */
function randomEx(kind){
  if(!D || !window.Figure) return null;
  const keep = {legs:G.legs, arms:G.arms, ex:G.ex}, rnd = a => a[Math.floor(Math.random()*a.length)], B = D.builder;
  try{
    G.legs = rnd(B.legs.map((l, i) => [l, i]).filter(([l]) => l.st==="stand" || l.st==="apart").map(x => x[1]));
    G.arms = rnd(B.arms.map((a, i) => i)); startEx();
    const ip = ipPhrase(), ipF = stFig(Object.assign({}, G.ex, G.ex.start)), out = {ip:{txt:ip.txt, fig:FIG[ipF], rule:ip.rule}, lines:[]};
    if(kind==="pose") return out;
    // как в настоящих ОРУ: 1 — основное движение (ноги или туловище, часто с руками); дальше либо сразу «и. п.» и «то же в другую сторону»,
    // либо ещё движение рук (головы) и возврат основного; в конце — «и. п.»
    const opt = (o, c, back) => { const a = o[c].map((m, i) => [m, i]).filter(([m]) => back ? m.back : !m.back && (c!=="arms" || m.g!=="arc" || Math.random() < .3)); return a.length ? rnd(a)[1] : null; };
    let o = exOpts(G.ex), mains = ["legs","torso"].filter(c => opt(o, c)!==null), main = mains.length && Math.random() < .8 ? rnd(mains) : "arms";
    const p1 = {[main]:opt(o, main)}; if(main!=="arms" && Math.random() < .5){ const a = opt(o, "arms"); if(a!==null) p1.arms = a; }
    if(p1[main]===null || !exApply(G.ex, p1)) return out;
    addPick(p1);
    if(Math.random() < .45 || main==="arms"){ if(main==="arms" && Math.random() < .6){ o = exOpts(G.ex); const a = opt(o, "arms"); if(a!==null) addPick({arms:a}); } }
    else {
      o = exOpts(G.ex); const c2 = o.head.length && Math.random() < .2 ? "head" : "arms", a = opt(o, c2); if(a!==null) addPick({[c2]:a});
      o = exOpts(G.ex); const b = opt(o, main, true); if(b!==null) addPick({[main]:b});
    }
    if(!G.ex.cnt) return out;
    addIp(); if(canRepeat() && G.ex.blockMir && Math.random() < .5) addRepeat();
    out.lines = G.ex.lines.map(l => ({n:l.n, txt:l.txt, fig:l.fig ? FIG[l.fig] : null, notes:l.notes || []}));
    return out;
  } catch(e){ return null; }
  finally { G.legs = keep.legs; G.arms = keep.arms; G.ex = keep.ex; }
}
window.GYM = {screen, load, restore, foot:footSvg, randomEx, open:(topic, ch) => { if(state.screen!=="dict"){ state.screen = "dict"; history.pushState({screen:"dict"}, ""); } G.tab = "dict"; G.q = ""; navTo(topic, ch); }};   // foot — схема стоп для «Карточек» (набор «Экзерсис на слух»)
})();
