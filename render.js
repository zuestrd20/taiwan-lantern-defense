import { PADS, TYPES, towerStats } from './engine.js';

// Original, resolution-independent illustration. No textures, fonts, or art assets are fetched.
const W = 960, H = 600, TAU = Math.PI * 2;
const INK = '#153a39';
const COLORS = { lantern: '#ffc86e', tea: '#9ce1ad', drum: '#f7a38d', bamboo: '#9cd4e9' };
const ROUTE = [[-30,150],[270,150],[270,390],[630,390],[630,210],[930,210],[930,630]];
let background = null;
let backgroundKey = '';
const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function path(ctx, points, fill, stroke = null, width = 1) {
  if (!points.length) return;
  ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  if (fill) { ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}
function line(ctx, points, color, width = 1) { path(ctx, points, null, color, width); }
function ellipse(ctx, x, y, rx, ry, color, stroke = null, width = 1) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fillStyle = color; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}
function circle(ctx, x, y, r, color, stroke = null, width = 1) { ellipse(ctx, x, y, r, r, color, stroke, width); }
function rounded(ctx, x, y, w, h, r, color, stroke = null, width = 1) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + rr, y); ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr); ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h); ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr); ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}
function glow(ctx, x, y, r, color, alpha = .22) {
  ctx.save(); ctx.globalAlpha *= alpha;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(255,203,113,0)');
  circle(ctx, x, y, r, g); ctx.restore();
}
function seedRandom(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
function segmentDistance(x, y, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}
function clearGround(x, y, radius = 20) {
  if ((PADS || []).some(p => Math.hypot(x - p.x, y - p.y) < radius + 27)) return false;
  for (let i = 1; i < ROUTE.length; i++) if (segmentDistance(x, y, ROUTE[i - 1], ROUTE[i]) < radius + 27) return false;
  return true;
}
function tuft(ctx, x, y, size = 1, color = '#72a77b') {
  line(ctx, [[x - 4 * size,y],[x - 5 * size,y - 6 * size],[x,y - 2 * size],[x + size,y - 8 * size],[x + 3 * size,y],[x + 7 * size,y - 5 * size]], color, 1.5);
}
function tree(ctx, x, y, s = 1, warm = false) {
  ctx.save(); ctx.translate(x,y); ctx.scale(s,s);
  ellipse(ctx, 8, 7, 22, 9, '#193e3e66');
  line(ctx, [[0,4],[0,-23]], '#5a6550', 7);
  line(ctx, [[-1,-10],[-13,-24]], '#495d48', 4);
  const c = warm ? ['#516b50','#77915b','#a3ae6e'] : ['#244f48','#39765b','#649667'];
  ellipse(ctx, 0,-25, 24, 22, c[0], '#20443e', 2);
  ellipse(ctx, -9,-32, 18, 17, c[1]); ellipse(ctx, 8,-35, 17, 18, c[1]);
  ellipse(ctx, -8,-40, 12, 8, c[2]); ellipse(ctx, 11,-42, 7, 5, c[2]);
  line(ctx, [[-15,-23],[-9,-26],[-5,-23]], '#7da47466', 1.5);
  ctx.restore();
}
function rock(ctx, x, y, s = 1) {
  ellipse(ctx,x + 3,y + 4,12*s,4*s,'#234f434a');
  path(ctx,[[x-10*s,y+2*s],[x-7*s,y-8*s],[x+3*s,y-11*s],[x+11*s,y-3*s],[x+9*s,y+3*s]],'#62857a','#345d53',1);
  path(ctx,[[x-7*s,y-8*s],[x+3*s,y-11*s],[x+1*s,y-3*s],[x-9*s,y]],'#8aa495');
}
function lantern(ctx, x, y, r = 6, lit = true) {
  if (lit) glow(ctx,x,y,r * 4.5,'#ffd18a',.14);
  line(ctx,[[x,y-r-5],[x,y-r]],'#c79e61',1.2);
  ellipse(ctx,x,y,r,r*1.2,'#e68858','#8b5540',1.1);
  ellipse(ctx,x,y-1,r*.62,r,'#ffc16e');
  line(ctx,[[x-r*.52,y-r],[x+r*.52,y-r]],'#704938',2);
  line(ctx,[[x-r*.5,y+r],[x+r*.5,y+r]],'#85503a',2);
  line(ctx,[[x,y+r],[x,y+r+5]],'#edba72',1.2);
}
function roof(ctx, x, y, w, h, color = '#b75c4c') {
  path(ctx,[[x+5,y+h+6],[x+w-3,y+h+6],[x+w+10,y+h],[x+w-8,y+3],[x+10,y+3],[x-10,y+h]],'#182f3290');
  path(ctx,[[x+10,y],[x+w-10,y],[x+w+9,y+h],[x+w-4,y+h+3],[x-4,y+h+3],[x-10,y+h]],color,INK,2);
  path(ctx,[[x+10,y],[x+w-10,y],[x+w-1,y+8],[x+3,y+8]],'#d48565');
  for (let k=1;k<8;k++) {
    const xx=x+w*k/8; line(ctx,[[xx,y+3],[xx+(k-4)*1.6,y+h]],'#83473f88',1.4);
  }
  line(ctx,[[x-10,y+h],[x+w+9,y+h]],'#d99066',2.6);
}
function building(ctx, x, y, w, h, color = '#c8ac7c', roofColor = '#9a6250') {
  path(ctx,[[x+5,y+h+4],[x+w+13,y+h+4],[x+w+19,y+14],[x+w,y+5]],'#183d3c65');
  rounded(ctx,x,y,w,h,2,color,INK,2);
  path(ctx,[[x+w-10,y+6],[x+w,y+6],[x+w,y+h],[x+w-10,y+h]],'#93876a');
  rounded(ctx,x+w*.4,y+h*.49,w*.2,h*.51,2,'#536759',INK,1);
  for(const xx of [x+9,x+w-22]) { rounded(ctx,xx,y+h*.45,11,12,2,'#efc77e','#8d7e60',1); line(ctx,[[xx+5.5,y+h*.45],[xx+5.5,y+h*.45+12]],'#9d835d',1); }
  roof(ctx,x-3,y-13,w+6,22,roofColor);
}
function mountainHorizon(ctx) {
  const sky=ctx.createLinearGradient(0,0,0,115);sky.addColorStop(0,'#213b53');sky.addColorStop(.5,'#657b80');sky.addColorStop(1,'#a9aa86');ctx.fillStyle=sky;ctx.fillRect(0,0,W,120);
  circle(ctx,775,28,15,'#f3dda7');circle(ctx,779,24,13,'#567181');
  path(ctx,[[0,74],[50,46],[85,55],[137,14],[189,55],[239,24],[299,60],[352,33],[413,73],[481,15],[551,55],[600,28],[675,70],[718,43],[785,76],[843,30],[910,65],[960,30],[960,122],[0,122]],'#4c6871');
  path(ctx,[[0,92],[47,66],[100,78],[159,52],[214,78],[278,53],[335,87],[390,61],[464,84],[514,46],[574,82],[630,52],[703,86],[766,60],[833,89],[908,56],[960,77],[960,135],[0,135]],'#345d5d');
  path(ctx,[[0,105],[72,88],[136,102],[212,88],[286,111],[355,85],[441,105],[513,88],[576,111],[650,87],[735,110],[818,86],[894,106],[960,91],[960,135],[0,135]],'#3f6b5a');
  for (let i=0;i<23;i++) { const x=i*44+9; path(ctx,[[x,103],[x+6,87+(i%3)*4],[x+13,103]],'#305849'); }
  const mist=ctx.createLinearGradient(0,70,0,129);mist.addColorStop(0,'#acb99b00');mist.addColorStop(.48,'#b9c3a319');mist.addColorStop(1,'#78967700');ctx.fillStyle=mist;ctx.fillRect(0,65,W,70);
}
function drawRiceFields(ctx) {
  // Terraced paddies and a narrow irrigation channel.
  path(ctx,[[31,301],[181,292],[204,311],[202,495],[174,520],[43,519],[24,504]],'#254f43','#254f43',4);
  const rows=[[[37,309],[173,301],[192,316],[191,347],[34,357]],[[34,368],[191,358],[191,397],[32,409]],[[33,420],[190,409],[190,449],[31,461]],[[33,472],[190,460],[186,492],[171,509],[42,508]]];
  rows.forEach((points,i)=>{path(ctx,points,['#6e9660','#81a066','#6b9158','#839e61'][i],'#b0ad6c',3);ctx.save();ctx.beginPath();ctx.moveTo(...points[0]);points.slice(1).forEach(p=>ctx.lineTo(...p));ctx.closePath();ctx.clip();for(let yy=314+i*54;yy<365+i*54;yy+=11){line(ctx,[[25,yy+9],[205,yy-3]],'#bad08855',1.2);for(let xx=43;xx<193;xx+=15)tuft(ctx,xx,yy-(xx-40)*.06,.5,'#c7ce82');}ctx.restore();});
  line(ctx,[[210,303],[210,501],[182,531],[37,531]],'#2a635a',6);line(ctx,[[211,304],[211,500],[181,529],[37,529]],'#75a594',1.5);
  for(let k=0;k<3;k++){line(ctx,[[207,416+k*5],[222,416+k*5]],'#a6a67b',3);}
  // Tiny open-sided resting pavilion beside the paddies.
  line(ctx,[[92,292],[92,269]],'#806b47',3);line(ctx,[[128,290],[128,269]],'#806b47',3);
  path(ctx,[[82,271],[110,250],[139,270]],'#b69762',INK,1.5);line(ctx,[[87,272],[134,272]],'#d0b377',3);
  ellipse(ctx,119,280,7,4,'#9f8054');
}
function drawMarket(ctx) {
  // A buildable square sits between the stalls, with a clear opening around pad 01.
  path(ctx,[[17,88],[116,88],[122,118],[14,118]],'#668472');
  for(const [x,y,scale,tone] of [[20,81,.84,0],[75,81,.84,1],[192,81,.9,0]]) {
    ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
    rounded(ctx,3,6,46,24,2,'#795d48',INK,1.5);
    rounded(ctx,7,19,38,8,2,'#c8a979','#655844',1);
    path(ctx,[[3,-2],[45,-2],[52,15],[-4,15]],tone?'#427d70':'#b46550',INK,1.5);
    for(let j=0;j<4;j++)path(ctx,[[4+j*10,-1],[9+j*10,-1],[14+j*10,15],[4+j*10,15]],tone?'#8fc0a1':'#d89b68');
    for(let j=0;j<4;j++)ellipse(ctx,12+j*8,20,3,2,['#f1bb73','#a6bf77','#dc9164','#e9cea1'][j]);
    line(ctx,[[1,4],[1,29]],'#454e3e',2);line(ctx,[[46,4],[46,29]],'#454e3e',2);
    ctx.restore();
  }
  ctx.beginPath();ctx.moveTo(15,53);ctx.quadraticCurveTo(112,73,235,52);ctx.strokeStyle='#243f3d';ctx.lineWidth=1.4;ctx.stroke();
  [[30,56],[66,60],[104,62],[188,59],[224,54]].forEach(([x,y])=>lantern(ctx,x,y+6,5));
  line(ctx,[[15,53],[15,111]],'#5f6952',3);line(ctx,[[235,52],[235,111]],'#5f6952',3);
}
function drawTemple(ctx) {
  ctx.save(); ctx.translate(12,-27);
  // Red-tile courtyard temple inspired by Taiwan's vernacular roofs.
  path(ctx,[[703,84],[851,84],[866,153],[697,153]],'#244a4270');
  rounded(ctx,703,92,151,57,5,'#b5ae82','#637b64',2);
  for(let y=105;y<148;y+=11)line(ctx,[[706,y],[851,y]],'#d2c39b55',1);
  for(let x=717;x<850;x+=18)line(ctx,[[x,96],[x+4,148]],'#7e8b7050',1);
  rounded(ctx,729,83,96,45,3,'#b28158',INK,2);
  rounded(ctx,765,93,26,35,2,'#294e47','#d5a572',2);
  for(let x=739;x<=814;x+=25)line(ctx,[[x,92],[x,128]],'#a1483f',5);
  // Swept swallowtail eaves, with restrained original flourishes.
  path(ctx,[[714,85],[726,78],[735,59],[777,50],[819,59],[830,78],[842,85],[822,89],[733,89]],'#b95748',INK,2.3);
  path(ctx,[[731,67],[777,54],[824,67],[816,72],[740,72]],'#d18d66');
  line(ctx,[[715,84],[731,87],[824,87],[841,84]],'#e2af77',3);
  line(ctx,[[735,61],[727,55],[725,47]],'#c87957',3);line(ctx,[[819,61],[827,55],[829,47]],'#c87957',3);
  for(let i=0;i<9;i++)line(ctx,[[742+i*8.5,64],[733+i*11,85]],'#813f3b66',1.1);
  line(ctx,[[756,58],[777,51],[798,58]],'#f2ba7d',2);
  circle(ctx,777,47,4,'#c99260','#78533d',1);
  lantern(ctx,744,104,5.5);lantern(ctx,810,104,5.5);
  for(const x of [711,840]){rounded(ctx,x-4,130,8,12,1,'#7c8270',INK,1);ellipse(ctx,x,129,6,3,'#bdad81');circle(ctx,x,124,4,'#a9a886');}
  line(ctx,[[760,146],[795,146]],'#e5c491',4);line(ctx,[[755,151],[800,151]],'#d0b183',4);
  ctx.restore();
}
function drawVillage(ctx) {
  const courtyard=[[699,459],[819,447],[876,505],[846,562],[712,559],[681,521]];
  path(ctx,courtyard,'#627e6260');
  line(ctx,[[713,548],[751,524],[794,526],[837,551]],'#afa67d',12);
  line(ctx,[[750,523],[746,473]],'#b7ac83',9);
  building(ctx,690,464,54,46,'#baac82','#a86a52');
  building(ctx,763,443,61,45,'#c2b48f','#9e5e51');
  building(ctx,790,518,48,39,'#b9aa81','#497f78');
  building(ctx,704,528,49,37,'#c3ad7e','#a5694f');
  for(const [x,y]of [[694,496],[782,484],[810,541]])lantern(ctx,x,y,4.2);
  // A village well and tiled low wall.
  ellipse(ctx,778,523,11,7,'#284b44');ellipse(ctx,778,520,11,6,'#b1aa80','#47695a',2);ellipse(ctx,778,520,6,3,'#4d7770');
  line(ctx,[[768,519],[768,509]],'#886d49',2);line(ctx,[[788,519],[788,509]],'#886d49',2);line(ctx,[[765,509],[791,509]],'#b39664',3);
}
function drawPond(ctx) {
  // Water sits inside the central bend, leaving all strategic pads readable.
  ctx.save();ctx.translate(453,231);ctx.rotate(-.15);
  ctx.beginPath();ctx.moveTo(-63,-12);ctx.bezierCurveTo(-70,-43,-20,-51,16,-37);ctx.bezierCurveTo(61,-35,76,-3,48,23);ctx.bezierCurveTo(12,47,-64,36,-63,-12);ctx.fillStyle='#315f58';ctx.fill();ctx.strokeStyle='#678b6f';ctx.lineWidth=7;ctx.stroke();
  ctx.beginPath();ctx.moveTo(-55,-10);ctx.bezierCurveTo(-54,-36,-19,-41,14,-29);ctx.bezierCurveTo(53,-29,63,-3,41,16);ctx.bezierCurveTo(5,35,-54,29,-55,-10);ctx.fillStyle='#447b70';ctx.fill();
  line(ctx,[[-36,-17],[-2,-17]],'#88b0a166',1.3);line(ctx,[[12,4],[44,4]],'#8eb8a277',1.4);line(ctx,[[-37,14],[-10,14]],'#a2c0a044',1.3);
  ellipse(ctx,-27,2,10,4,'#8eae72');ellipse(ctx,23,-18,7,3,'#a2b979');circle(ctx,25,-20,2,'#e3af9e');
  path(ctx,[[-2,4],[6,1],[12,4],[6,7]],'#d6aa73');path(ctx,[[12,4],[17,1],[17,7]],'#ce9a64');
  ctx.restore();
  for(const [x,y]of [[393,210],[488,267],[408,267]]){line(ctx,[[x,y],[x-3,y-17]],'#a1af72',2);line(ctx,[[x+3,y],[x+8,y-21]],'#83a274',2);line(ctx,[[x+6,y],[x+13,y-9]],'#b1b780',1.5);}
  rock(ctx,388,227,.9);rock(ctx,501,250,.8);
}
function drawRoad(ctx) {
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  line(ctx,ROUTE,'#1b463f80',59);line(ctx,ROUTE,'#8b956f',54);line(ctx,ROUTE,'#c2b58a',47);line(ctx,ROUTE,'#d8c59c',39);
  // Hand-laid irregular paving uses a fixed seed, never frame-to-frame noise.
  const rnd=seedRandom(1337);
  for(let seg=1;seg<ROUTE.length;seg++){
    const a=ROUTE[seg-1], b=ROUTE[seg], len=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/len,dy=(b[1]-a[1])/len;
    for(let d=15;d<len-11;d+=19){const wobble=(rnd()-.5)*10,x=a[0]+dx*d-dy*wobble,y=a[1]+dy*d+dx*wobble;ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(dy,dx));rounded(ctx,-7,-3.5,14,7,2,rnd()>.5?'#b8a78350':'#efdeb233');ctx.restore();}
    for(let d=34;d<len-25;d+=38){const x=a[0]+dx*d,y=a[1]+dy*d;line(ctx,[[x-dy*19-dx*3,y+dx*19-dy*3],[x-dy*22+dx*3,y+dx*22+dy*3]],'#857f6150',1.5);}
  }
  // Small chevrons provide an unobtrusive, language-independent route cue.
  for(const [x,y,a]of [[101,150,0],[270,270,Math.PI/2],[447,390,0],[630,292,-Math.PI/2],[780,210,0],[930,447,Math.PI/2]]){ctx.save();ctx.translate(x,y);ctx.rotate(a);line(ctx,[[-4,-5],[2,0],[-4,5]],'#99875b70',2);ctx.restore();}
  ctx.restore();
}
function drawBridge(ctx) {
  // A narrow creek crosses beneath the main path near the valley gate.
  line(ctx,[[871,490],[890,500],[919,507],[960,504]],'#4d847777',12);
  for(let y=492;y<520;y+=6)line(ctx,[[907,y],[952,y]],'#ac9974',4.5);
  line(ctx,[[905,489],[905,522]],'#756c4e',3);line(ctx,[[954,489],[954,522]],'#756c4e',3);
  for(const x of [905,954])for(const y of [489,522])circle(ctx,x,y,2.5,'#d0b47b');
}
function drawGate(ctx) {
  // The protected lantern arch marks the destination without hiding the lane.
  glow(ctx,929,562,46,'#ffd59a',.14);
  for(const x of [897,959]){rounded(ctx,x-4,544,8,43,2,'#98765a',INK,1.5);rounded(ctx,x-6,581,12,6,1,'#b1a47b',INK,1);}
  path(ctx,[[886,544],[895,537],[907,538],[948,538],[959,536],[969,544],[958,550],[898,550]],'#b7614a',INK,2);
  line(ctx,[[893,547],[963,547]],'#e1aa6b',2);
  lantern(ctx,905,559,5);lantern(ctx,951,559,5);
  rounded(ctx,915,538,27,11,2,'#4a6e55','#d0a86d',1);
  // Three engraved dots serve as a crest rather than tiny unreadable text.
  for(let i=0;i<3;i++)circle(ctx,922+i*6,543.5,1.3,'#f3cc89');
}
function createBackground(ctx) {
  const earth=ctx.createLinearGradient(0,0,0,H);earth.addColorStop(0,'#4e775d');earth.addColorStop(.35,'#618966');earth.addColorStop(1,'#4f795b');ctx.fillStyle=earth;ctx.fillRect(0,0,W,H);
  mountainHorizon(ctx);
  // Broad painterly areas keep landmarks legible rather than using a flat game grid.
  ellipse(ctx,462,302,227,178,'#75916b22');ellipse(ctx,85,421,164,179,'#b2b47712');ellipse(ctx,785,444,156,141,'#c6ab7920');
  const rnd=seedRandom(52819);
  for(let i=0;i<670;i++) { const x=rnd()*W,y=103+rnd()*497;if(!clearGround(x,y,1))continue;ellipse(ctx,x,y,1+rnd()*3,.5+rnd(),i%3?'#bec48b15':'#1f514125'); }
  drawRiceFields(ctx);drawPond(ctx);drawMarket(ctx);drawTemple(ctx);drawVillage(ctx);
  // Distant groves and foreground framing are placed away from routes and plinths.
  const trees=[[9,225,1.1],[35,238,.85],[72,233,.75],[167,250,.8],[25,279,.8],[208,275,.66],[335,113,.83],[367,96,.8],[489,112,.8],[561,115,.86],[599,98,.75],[662,103,.75],[883,110,.9],[915,83,.8],[947,105,1],[369,468,1.2],[407,487,.95],[461,499,1],[530,473,.85],[605,499,1],[653,483,.8],[37,569,1.2],[93,592,1.05],[161,570,.93],[238,549,1.1],[283,584,1.18],[340,570,1],[423,585,1.1],[535,580,1.15],[622,573,1],[664,573,.8],[852,427,.86],[870,584,.9],[883,370,.85],[755,339,.8],[801,345,.65]];
  for(const[x,y,s]of trees)if(clearGround(x,y,23*s))tree(ctx,x,y,s,x%3===0);
  for(let i=0;i<110;i++){const x=15+rnd()*925,y=124+rnd()*462;if(clearGround(x,y,8)&&!((x>20&&x<215&&y>294&&y<535)||(x>375&&x<521&&y>185&&y<283)||(x>680&&x<865&&y>427)))tuft(ctx,x,y,.45+rnd()*.3,i%4?'#96ad7b77':'#d1bf8070');}
  for(const[x,y,s]of [[334,263,.7],[567,222,.65],[547,443,.65],[307,510,1],[648,131,.9],[875,280,.65],[839,574,.6],[113,564,.6]])if(clearGround(x,y,12*s))rock(ctx,x,y,s);
  drawRoad(ctx);drawBridge(ctx);drawGate(ctx);
  // A few planted flowers soften the stone shoulders.
  for(const[x,y]of [[312,183],[228,441],[573,427],[676,354],[844,170],[855,253],[62,190]])if(clearGround(x,y,8)){tuft(ctx,x,y,.8,'#356a4d');for(let j=0;j<3;j++)circle(ctx,x-5+j*5,y-6-(j%2)*3,2.2,['#dbb276','#e6c58b','#cba07a'][j]);}
  // Quiet corner vignette, never obscures the path or UI.
  const vignette=ctx.createRadialGradient(W*.5,H*.5,180,W*.5,H*.5,570);vignette.addColorStop(0,'#062b2b00');vignette.addColorStop(1,'#102f3d44');ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);
}
function getBackground() {
  const key=(PADS||[]).map(p=>`${p.id},${p.x},${p.y}`).join(';');
  if(background&&key===backgroundKey)return background;
  let canvas;
  if(typeof OffscreenCanvas!=='undefined')canvas=new OffscreenCanvas(W,H);
  else if(typeof document!=='undefined'){canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;}
  if(!canvas)return null;
  const ctx=canvas.getContext('2d');if(!ctx)return null;
  createBackground(ctx);background=canvas;backgroundKey=key;return canvas;
}

/** Draw a tower centered on x/y. Size is the illustrated footprint, in logical pixels. */
export function drawTowerIcon(ctx, type, x, y, size = 52, level = 1) {
  ctx.save();ctx.translate(x,y);ctx.scale(size/52,size/52);ctx.lineCap='round';ctx.lineJoin='round';
  const lv=clamp(Math.floor(finite(level,1)),1,3);
  ellipse(ctx,3,15,22,9,'#142f3b55');
  ellipse(ctx,0,12,21,10,'#697d66',INK,1.8);ellipse(ctx,0,9,21,9,'#b2b08c',INK,1.5);
  if(type==='tea'){
    for(const sx of [-14,14]){line(ctx,[[sx,9],[sx,-10]],'#416b4d',3);ellipse(ctx,sx-4,-7,6,3,'#81bd82',INK,1);ellipse(ctx,sx+3,-13,6,3,'#9ec687',INK,1);}
    rounded(ctx,-12,-12,25,22,6,'#689f84',INK,2);
    ellipse(ctx,1,9,12,4,'#477d6c');ellipse(ctx,1,-11,13,5,'#c5d4a1',INK,1.8);ellipse(ctx,1,-12,8,2.5,'#48765d');
    ctx.beginPath();ctx.arc(14,-3,7,-1.25,1.3);ctx.strokeStyle=INK;ctx.lineWidth=5;ctx.stroke();ctx.strokeStyle='#8ebb91';ctx.lineWidth=2.5;ctx.stroke();
    line(ctx,[[-1,-19],[-4,-24],[-2,-28]],'#d0e6bb',2);line(ctx,[[5,-21],[8,-26],[6,-31]],'#d0e6bb99',1.6);
    if(lv>=2){ellipse(ctx,1,-17,11,3.5,'#d6c892',INK,1.5);circle(ctx,1,-20,3,'#8fbc8a',INK,1);}
    if(lv>=3){path(ctx,[[-12,-16],[-16,-27],[-9,-23],[-5,-30],[0,-25],[7,-32],[12,-23],[18,-26],[14,-15]],'#9cc98f',INK,1.3);ellipse(ctx,1,-16,13,4,'#c9d89a',INK,1.5);}
  }else if(type==='drum'){
    line(ctx,[[-13,11],[-10,-11]],'#815b48',5);line(ctx,[[13,11],[10,-11]],'#815b48',5);
    rounded(ctx,-18,-20,36,26,8,'#bc6354',INK,2);ellipse(ctx,0,5,18,7,'#984a43',INK,1.7);
    ellipse(ctx,0,-19,18,9,'#e6c08c',INK,2);ellipse(ctx,0,-19,13,6,'#c69768','#af7f55',1);
    for(let i=0;i<5;i++)circle(ctx,-13+i*6.5,-11,1.5,'#efbe79');
    line(ctx,[[-14,-27],[11,-5]],INK,5);line(ctx,[[-14,-27],[11,-5]],'#d4b27b',2.5);circle(ctx,-14,-27,3.5,'#d89365',INK,1.2);
    line(ctx,[[14,-29],[-9,-8]],INK,5);line(ctx,[[14,-29],[-9,-8]],'#e3c08a',2.5);circle(ctx,14,-29,3.5,'#e2a472',INK,1.2);
    if(lv>=2){line(ctx,[[-22,-13],[-22,6]],'#d6ac73',2);line(ctx,[[22,-13],[22,6]],'#d6ac73',2);circle(ctx,-22,9,3,'#f2c97e');circle(ctx,22,9,3,'#f2c97e');}
    if(lv>=3){path(ctx,[[-16,-36],[0,-42],[16,-36],[0,-32]],'#d4a165',INK,1.5);line(ctx,[[0,-41],[0,-28]],'#f2d18f',2);}
  }else if(type==='bamboo'){
    for(const [bx,top]of [[-12,-27],[0,-35],[12,-24]]){
      rounded(ctx,bx-4,top,8,11-top,2,'#75a97d',INK,1.8);
      for(let yy=top+7;yy<11;yy+=10)line(ctx,[[bx-4,yy],[bx+4,yy]],'#c4dba0',1.6);
      ellipse(ctx,bx,top,4,2,'#c0d69c',INK,1);
    }
    line(ctx,[[-17,4],[17,4]],'#ad9162',3);line(ctx,[[-17,-7],[17,-7]],'#c9a974',3);
    path(ctx,[[1,-23],[10,-34],[19,-31],[9,-25]],'#b1ce91',INK,1);path(ctx,[[-9,-18],[-21,-28],[-24,-19],[-15,-15]],'#93bb80',INK,1);
    if(lv>=2){rounded(ctx,-21,-20,7,29,2,'#529879',INK,1.4);ellipse(ctx,-17.5,-20,3.5,2,'#cae1a5');}
    if(lv>=3){rounded(ctx,17,-30,7,39,2,'#68a489',INK,1.4);ellipse(ctx,20.5,-30,3.5,2,'#d5e6b3');line(ctx,[[17,-12],[24,-12]],'#e0ce8b',2);}
  }else{
    // A warm lantern turret, not a weapon-shaped generic turret.
    line(ctx,[[-11,9],[-11,-23]],INK,6);line(ctx,[[11,9],[11,-23]],INK,6);
    line(ctx,[[-11,8],[-11,-24]],'#a98a5e',3);line(ctx,[[11,8],[11,-24]],'#c5a269',3);
    glow(ctx,0,-11,27,'#ffca6e',.28);
    ellipse(ctx,0,-10,12,16,'#e69458',INK,1.8);ellipse(ctx,0,-10,7,15,'#ffce77');
    line(ctx,[[-9,-22],[9,-22]],'#895940',3);line(ctx,[[-9,2],[9,2]],'#895940',3);
    line(ctx,[[0,3],[0,9]],'#e9b46a',2);
    path(ctx,[[-21,-23],[-14,-30],[0,-35],[14,-30],[21,-23]],'#ac5b46',INK,1.8);line(ctx,[[-20,-23],[20,-23]],'#e2b272',2.4);
    if(lv>=2){path(ctx,[[-17,-32],[0,-41],[17,-32]],'#ad6150',INK,1.5);line(ctx,[[-15,-32],[15,-32]],'#f0c884',1.6);}
    if(lv>=3){circle(ctx,0,-45,4,'#ffe1a0',INK,1.2);line(ctx,[[-17,-18],[-23,-12]],'#c69761',1.5);line(ctx,[[17,-18],[23,-12]],'#c69761',1.5);lantern(ctx,-24,-6,4,false);lantern(ctx,24,-6,4,false);}
  }
  // Level pips remain visible when silhouettes are small on mobile.
  for(let i=0;i<lv;i++)circle(ctx,(i-(lv-1)/2)*6,16,2,'#ffe0a2','#416055',.8);
  ctx.restore();
}
function padIdOf(value) { return value&&typeof value==='object'?value.id:value; }
function findPad(value) { const id=padIdOf(value);return (PADS||[]).find(p=>p.id===id)||null; }
function findTower(game, value) {
  if(value&&typeof value==='object'&&value.type)return value;
  return (game.towers||[]).find(t=>t.id===value)||null;
}
function colorFor(type) { return COLORS[type]||(TYPES&&TYPES[type]&&TYPES[type].color)||'#f7c875'; }
function statsFor(type, level = 1) { try { return towerStats(type,level)||{}; } catch { return {}; } }
function drawRange(ctx, x, y, range, color, preview, time) {
  if(!Number.isFinite(range)||range<=0)return;
  ctx.save();circle(ctx,x,y,range,preview?'#d6eac519':'#ffdb9020');ctx.strokeStyle=color;ctx.globalAlpha=.66;ctx.lineWidth=1.6;ctx.setLineDash(preview?[5,6]:[2,6]);ctx.lineDashOffset=-time*4;ctx.beginPath();ctx.arc(x,y,range,0,TAU);ctx.stroke();ctx.setLineDash([]);ctx.restore();
}
function drawPads(ctx, game, selectedPad, selectedTower, hoverPad, time) {
  const occupied=new Map((game.towers||[]).map(t=>[t.padId,t]));
  const selectedId=padIdOf(selectedPad), hoverId=padIdOf(hoverPad);
  (PADS||[]).forEach((p,i)=>{
    const tower=occupied.get(p.id),active=p.id===selectedId||p.id===hoverId||(selectedTower&&selectedTower.padId===p.id);
    if(tower){if(active){ellipse(ctx,p.x,p.y+9,29,15,'#ffd59b33',colorFor(tower.type),2);ctx.save();ctx.setLineDash([3,5]);ellipse(ctx,p.x,p.y+9,33,18,'#00000000','#f9d49a99',1);ctx.restore();}return;}
    ellipse(ctx,p.x+2,p.y+7,25,13,'#193c3c66');
    ellipse(ctx,p.x,p.y+4,25,15,active?'#c8bd87':'#8b9b79',INK,1.7);
    ellipse(ctx,p.x,p.y,24,14,active?'#d8d09d':'#bdc19a',active?'#fff0b9':'#d9d6ad',1.8);
    ellipse(ctx,p.x,p.y,19,10,'#718c7140');
    ctx.strokeStyle=active?'#355c4d':'#597858';ctx.lineWidth=2;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(p.x-4,p.y);ctx.lineTo(p.x+4,p.y);ctx.moveTo(p.x,p.y-4);ctx.lineTo(p.x,p.y+4);ctx.stroke();
    rounded(ctx,p.x-8,p.y+13,16,13,5,'#234c45eb','#92aa7c',.9);ctx.font='bold 8px system-ui, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#e4d9ad';ctx.fillText(String(i+1).padStart(2,'0'),p.x,p.y+19.5);
    if(active){ctx.save();ctx.strokeStyle='#fae1a8';ctx.globalAlpha=.7+.2*Math.sin(time*3);ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y,30,19,0,0,TAU);ctx.stroke();ctx.restore();}
  });
}
function drawEnemy(ctx, enemy, time, reducedMotion) {
  const x=finite(enemy.x),y=finite(enemy.y),kind=enemy.type||'wisp';
  const boss=enemy.boss||/boss|king|lord|guardian|titan/i.test(kind),veil=kind==='veil',armor=/armor|shell|stone|brute/i.test(kind),rush=/rush|swift|fast|runner|fox/i.test(kind),swarm=/swarm|small|mote|bat/i.test(kind);
  const s=boss?(kind==='moonlord'?2:kind==='shelllord'?1.85:1.7):armor?1.1:swarm?.7:rush?.88:1;
  const phase=String(enemy.id||'0').split('').reduce((a,c)=>a+c.charCodeAt(0),0)*1.7;
  const bob=reducedMotion?0:Math.sin(time*5+phase)*2;
  ctx.save();ctx.translate(x,y);ellipse(ctx,1,8,12*s,5*s,'#17394055');ctx.translate(0,bob);ctx.scale(s,s);
  if(boss){
    glow(ctx,0,-5,26,kind==='moonlord'?'#f0b0e0':'#beb0ef',.18);
    path(ctx,[[-17,8],[-16,-4],[-21,-12],[-13,-15],[-8,-24],[0,-19],[9,-24],[14,-13],[21,-9],[15,0],[17,9],[8,6],[0,12],[-9,7]],kind==='shelllord'?'#798f9f':kind==='moonlord'?'#a875a1':'#837caa','#343e60',2);
    path(ctx,[[-15,-9],[-9,-16],[0,-12],[9,-16],[15,-7],[8,3],[-9,3]],kind==='shelllord'?'#bdcbd0':kind==='moonlord'?'#dca4c9':'#b3a0c7');
    path(ctx,[[-12,-24],[-8,-34],[-1,-25]],'#d8b786','#373d52',1.3);path(ctx,[[6,-25],[12,-34],[14,-22]],'#d8b786','#373d52',1.3);
    path(ctx,[[-5,-6],[0,-12],[5,-6],[0,0]],'#f0c58d','#615675',1);
    if(kind==='shelllord') { line(ctx,[[-15,-4],[-8,2],[-10,7]],'#526c81',2);line(ctx,[[11,-11],[6,-3],[13,2]],'#526c81',2); }
    if(kind==='moonlord') { ctx.save();ctx.strokeStyle='#e7bcdb';ctx.lineWidth=1.2;ctx.beginPath();ctx.ellipse(0,-9,24,13,-.35,0,TAU);ctx.stroke();circle(ctx,-22,-2,2,'#fbe0ad');ctx.restore(); }
  }else if(armor){
    path(ctx,[[-14,7],[-17,-4],[-11,-16],[2,-20],[15,-10],[17,2],[9,11],[-4,13]],'#738994','#2a4654',1.8);
    path(ctx,[[-11,-15],[2,-20],[7,-7],[-3,-4]],'#abb8bb');path(ctx,[[7,-7],[15,-10],[17,2],[5,5]],'#829eaa');
    line(ctx,[[-3,-4],[-8,7]],'#476b78',2);line(ctx,[[5,5],[9,11]],'#476b78',2);
  }else if(rush){
    path(ctx,[[-17,7],[-9,-1],[-13,-12],[-3,-8],[5,-18],[12,-8],[15,2],[7,10],[-3,7]],'#c199b2','#614b70',1.6);
    path(ctx,[[-16,5],[-24,0],[-19,11],[-8,10]],'#927caa');path(ctx,[[-10,-7],[-13,-12],[-5,-10]],'#e2bbca');
  }else if(veil){
    ctx.beginPath();ctx.moveTo(-14,8);ctx.bezierCurveTo(-24,-2,-4,-21,6,-16);ctx.bezierCurveTo(22,-9,14,7,4,9);ctx.quadraticCurveTo(1,1,-4,10);ctx.quadraticCurveTo(-9,5,-14,8);ctx.fillStyle='#9cccc2';ctx.fill();ctx.strokeStyle='#3c7e80';ctx.lineWidth=1.8;ctx.stroke();
    ctx.beginPath();ctx.ellipse(0,-3,20,9,-.4,.5,5.7);ctx.strokeStyle='#c3e7c8';ctx.lineWidth=1.8;ctx.stroke();line(ctx,[[14,-12],[20,-17],[19,-9]],'#b4dfc5',2);
  }else{
    ctx.beginPath();ctx.moveTo(-13,8);ctx.bezierCurveTo(-17,-1,-10,-19,1,-19);ctx.bezierCurveTo(13,-18,16,-4,11,6);ctx.quadraticCurveTo(5,2,3,10);ctx.quadraticCurveTo(-3,4,-8,11);ctx.closePath();ctx.fillStyle=swarm?'#afcbd4':'#c2ced3';ctx.fill();ctx.strokeStyle='#516e86';ctx.lineWidth=1.7;ctx.stroke();
    ellipse(ctx,-3,-13,6,3,'#e2e7df88');
  }
  // Every foe is a whimsical mist creature with the same readable glowing eyes.
  for(const ex of [-5,5]){ellipse(ctx,ex,-5,2.1,3.1,boss?'#ffe3ac':'#294f68');circle(ctx,ex-.3,-6.1,.8,'#e4f7f1');}
  if(enemy.slow<1&&enemy.slowRemaining>0){ctx.save();ctx.strokeStyle='#b8edce';ctx.lineWidth=1.2;ctx.setLineDash([3,3]);ctx.beginPath();ctx.ellipse(0,5,18,8,0,0,TAU);ctx.stroke();ctx.restore();circle(ctx,-14,-6,1.5,'#d8f6cf');circle(ctx,14,1,1.7,'#d8f6cf');}
  ctx.restore();
  const hp=finite(enemy.hp,1),max=Math.max(1,finite(enemy.maxHp,hp));
  if(hp<max||boss){const bw=boss?38:24,yy=y-27*s+bob;rounded(ctx,x-bw/2,yy,bw,4,2,'#243d44dd');rounded(ctx,x-bw/2+.5,yy+.5,Math.max(0.01,(bw-1)*clamp(hp/max,0,1)),3,1.5,boss?'#e7b28f':'#a5ddab');}
}
function drawProjectile(ctx,p,time) {
  const x=finite(p.x),y=finite(p.y),type=p.type||'lantern';ctx.save();
  if(type==='bamboo'){ctx.translate(x,y);ctx.rotate(finite(p.angle,time*6));line(ctx,[[-7,0],[6,0]],'#153e39',4);line(ctx,[[-6,0],[5,0]],'#c1df9d',2);path(ctx,[[5,-2],[10,0],[5,2]],'#e1e7b4');}
  else if(type==='tea'){ellipse(ctx,x,y,4,3,'#b9e6bc','#427d6c',1);circle(ctx,x-1,y-1,1.1,'#ecf5d3');}
  else if(type==='drum'){circle(ctx,x,y,5,'#f3bb9560','#ffd4a8',1.5);}
  else{glow(ctx,x,y,13,'#ffd17b',.4);circle(ctx,x,y,3.5,'#ffdb97','#de9259',1);circle(ctx,x-1,y-1,1.4,'#fff4c9');}ctx.restore();
}
function drawEffect(ctx,e,time) {
  const x=finite(e.x),y=finite(e.y),type=e.type||'';
  const life=clamp(finite(e.life,.3),0,2),duration=Math.max(.1,finite(e.maxLife,finite(e.duration,.5))),t=clamp(1-life/duration,0,1);
  ctx.save();ctx.globalAlpha=clamp(life/duration,.08,1);
  if(type==='drum'||type==='shockwave'||type==='pulse'||type==='splash'){
    const r=Math.max(8,finite(e.radius,finite(e.range,55))*(.3+.7*t));ctx.lineWidth=2.5;ctx.strokeStyle='#ffd2a1';ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.stroke();ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,r*.75,0,TAU);ctx.stroke();
  }else if(type==='tea'||type==='slow'){
    for(let i=0;i<5;i++){const a=i*TAU/5+time;ellipse(ctx,x+Math.cos(a)*(6+t*15),y+Math.sin(a)*(6+t*15),2.5,4,'#cdeab5');}
  }else if(type==='hit'||type==='lantern'||type==='bamboo'||type==='kill'||type==='pop'||type==='death'){
    const color=type==='bamboo'?'#cee7aa':type==='kill'||type==='pop'||type==='death'?'#d6d4ef':'#ffe0a3';
    for(let i=0;i<6;i++){const a=i*TAU/6;line(ctx,[[x+Math.cos(a)*(3+t*6),y+Math.sin(a)*(3+t*6)],[x+Math.cos(a)*(7+t*14),y+Math.sin(a)*(7+t*14)]],color,2);}
  }else if(type==='build'||type==='upgrade'){
    ctx.strokeStyle='#ffe8aa';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y,24+20*t,13+11*t,0,0,TAU);ctx.stroke();for(let i=0;i<4;i++)circle(ctx,x-15+i*10,y-10-t*26-i%2*8,2,'#ffdda0');
  }else if(type==='gold'||type==='sell'){
    ctx.fillStyle='#ffe1a1';ctx.strokeStyle='#28453ddd';ctx.lineWidth=3;ctx.textAlign='center';ctx.font='bold 13px system-ui, sans-serif';if(e.text){ctx.strokeText(e.text,x,y-12*t);ctx.fillText(e.text,x,y-12*t);}
  }else if(type==='wave'){
    ctx.strokeStyle='#ffdf9b';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(x,y,45+t*finite(e.radius,160),22+t*finite(e.radius,160)*.5,0,0,TAU);ctx.stroke();
  }else if(type==='leak'||type==='damage'){
    ctx.strokeStyle='#edb19b';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,12+24*t,0,TAU);ctx.stroke();
  }else{circle(ctx,x,y,3+8*t,'#fff1b370');}
  ctx.restore();
}

/** Render a complete frame in a 960 × 600 logical coordinate system. Engine state is read-only. */
export function render(ctx, game = {}, { selectedPad = null, selectedTower = null, hoverPad = null, buildType = null, reducedMotion = false } = {}) {
  if(!ctx)return;
  ctx.save();ctx.globalAlpha=1;ctx.lineCap='round';ctx.lineJoin='round';
  const time=reducedMotion?0:finite(game.time);
  const bg=getBackground();if(bg)ctx.drawImage(bg,0,0,W,H);else createBackground(ctx);
  const chosenTower=findTower(game,selectedTower), chosenPad=findPad(selectedPad),hovered=findPad(hoverPad);
  if(chosenTower)drawRange(ctx,chosenTower.x,chosenTower.y,finite(chosenTower.range,statsFor(chosenTower.type,chosenTower.level).range),colorFor(chosenTower.type),false,time);
  else {const p=hovered||chosenPad;if(buildType&&p&&!(game.towers||[]).some(t=>t.padId===p.id))drawRange(ctx,p.x,p.y,statsFor(buildType).range,colorFor(buildType),true,time);}
  drawPads(ctx,game,selectedPad,chosenTower,hoverPad,time);
  // Tiny warm fireflies and shrine lanterns are the only ambient movement.
  if(!reducedMotion){for(let i=0;i<9;i++){const x=346+i*53+Math.sin(time*.37+i*4)*13,y=116+(i%3)*36+Math.sin(time*.59+i)*7;ctx.save();ctx.globalAlpha=.15+.35*(1+Math.sin(time*1.7+i))/2;glow(ctx,x,y,7,'#eddda2',.23);circle(ctx,x,y,1,'#ffe5a1');ctx.restore();}}
  const actors=[...(game.towers||[]).map(v=>({kind:'tower',v,y:finite(v.y)})),...(game.enemies||[]).map(v=>({kind:'enemy',v,y:finite(v.y)}))].sort((a,b)=>a.y-b.y);
  for(const a of actors)if(a.kind==='tower')drawTowerIcon(ctx,a.v.type,finite(a.v.x),finite(a.v.y),52,finite(a.v.level,1));else drawEnemy(ctx,a.v,time,reducedMotion);
  for(const p of game.projectiles||[])drawProjectile(ctx,p,time);
  for(const e of game.effects||[])drawEffect(ctx,e,time);
  if(buildType&&hovered&&!(game.towers||[]).some(t=>t.padId===hovered.id)&&hovered.id!==padIdOf(selectedPad)){ctx.save();ctx.globalAlpha=.52;drawTowerIcon(ctx,buildType,hovered.x,hovered.y,52,1);ctx.restore();}
  ctx.restore();
}
