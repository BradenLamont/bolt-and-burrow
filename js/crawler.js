// Bolt & Burrow — mobile outposts (v0.14).
// The entrance outpost is a big crawler parked at the cave mouth. Walk up its ramp and board it to ride home:
// the ramp folds up, the horn sounds and it drives off; in town it rolls out of the cave's gate, lowers its
// ramp, lets you out and backs into the tunnel again. The halfway outpost is a small crawler: when you build
// it, it drives up the conveyor from the entrance (its headlights cutting through the dark) and unfolds.
// Any key or tap skips either ride. A Haul bot on your crew rides on the big crawler's ore hopper.
'use strict';

const CW = C.CRAWLER;
const CRAWL = ['board', 'close', 'drive', 'emerge', 'open', 'out', 'back'];
let crawl = null;     // the ride home: { stage, t, x0, y0, gate, arrived }
let opDrive = null;   // the halfway crawler driving out: { k, t }
const crawling = () => !!crawl;
const crawlBusy = () => !!crawl || !!opDrive;
const crawlK = () => (crawl ? Math.min(1, crawl.t / CW[crawl.stage]) : 0);
const atRamp = () => !inTown() && pRow() >= CW.ramp.rows[0] && pRow() <= CW.ramp.rows[1] && pCol() >= CW.ramp.col && pCol() <= CW.ramp.col + 1;
// The mech is inside the crawler from the end of boarding until it steps out in town
const crawlHides = () => !!crawl && (['close', 'drive', 'emerge', 'open'].includes(crawl.stage) || (crawl.stage === 'board' && crawlK() > 0.85));

// Where things are: the cave crawler sits on the BASE_BUILDING cells, its ramp beside it
const caveCrawlerBox = () => { const B = C.BASE_BUILDING; return { x: B.cols[0] - 0.3, w: 4.6, y: B.rows[0] }; };
const rampTop = () => ({ x: CW.ramp.col + 0.45, y: 1.1 });
// In town it rolls out of the gate of the cave you left, stopping a few rows below the cliff
const townGateCol = () => C.TOWN.gates[Math.max(0, crawl ? crawl.gate : 0)] + 0.5;
const townStop = () => C.TOWN.gateRow - 3.4;   // bottom edge (in rows) when parked
const townExit = () => ({ x: townGateCol() + 2.3, y: C.TOWN.gateRow - 2.5 });

function startCrawl() {
  if (crawl || inTown() || paused()) return;
  crawl = { stage: 'board', t: 0, x0: P.x, y0: P.y, gate: TOWN().gates.indexOf(S.cave), arrived: false };
  P.digging = []; held.length = 0; joyH = joyV = null; attackHeld = false;
  sfx('ramp'); save();
}
function updateCrawl(dt) {
  if (opDrive) { updateOpDrive(dt); return true; }
  if (!crawl) return false;
  crawl.t += dt;
  const k = crawlK(), st = crawl.stage;
  if (st === 'board') {   // walk up the ramp and in
    const rt = rampTop(), e = ease(k);
    P.x = crawl.x0 + (rt.x - 0.6 - crawl.x0) * e; P.y = crawl.y0 + (rt.y - crawl.y0) * e; P.dir = 'side'; P.face = -1;
  }
  if (st === 'out') {     // step out down the ramp in town
    const ex = townExit(), e = ease(k);
    P.x = townGateCol() + 1.4 + (ex.x - townGateCol() - 1.4) * e; P.y = C.TOWN.gateRow - 2.2 + (ex.y - C.TOWN.gateRow + 2.2) * e; P.dir = 'side'; P.face = 1;
  }
  if ((st === 'drive' || st === 'emerge' || st === 'back') && Math.random() < dt * 5) sfx('engine');
  if (crawl.t >= CW[st]) nextCrawl();
  return true;
}
function nextCrawl() {
  const i = CRAWL.indexOf(crawl.stage);
  if (crawl.stage === 'drive') crawlArrive();
  if (i === CRAWL.length - 1) return endCrawl();
  crawl.stage = CRAWL[i + 1]; crawl.t = 0;
  const snd = { close: 'ramp', drive: 'horn', emerge: 'engine', open: 'ramp', out: 'click', back: 'horn' }[crawl.stage];
  if (snd) sfx(snd);
}
function crawlArrive() {
  if (crawl.arrived) return;
  crawl.arrived = true;
  goToTown(true);
  P.x = townGateCol(); P.y = C.TOWN.gateRow - 2.2;
}
function endCrawl() {
  if (!crawl) return;
  if (!crawl.arrived) crawlArrive();
  const ex = townExit();
  P.x = ex.x; P.y = ex.y; P.dir = 'down'; lastCell = -1;
  crawl = null;
  toast(null, 'Back in town. The crawler heads back to the cave mouth.');
  save(); updateUI();
}
function skipCrawl() {
  if (opDrive) { opDrive = null; camFocus = null; sfx('unfold'); return; }
  if (crawl) endCrawl();
}

// ---------- The halfway crawler driving out ----------
function startSmallCrawler(k) { opDrive = { k, t: 0 }; sfx('horn'); }
function opDrivePos() {   // where the small crawler is while it drives: along the belt, then a step to the side
  const row = outpostRow(opDrive.k), u = Math.min(1, opDrive.t / CW.smallDrive);
  const drive = Math.min(1, u / 0.85), side = Math.max(0, (u - 0.85) / 0.15);
  return { x: BELT + 0.5 + 2 * ease(side), y: BASE_ROWS - 2 + (row - 1 - (BASE_ROWS - 2)) * ease(drive), moving: u < 1 };
}
function updateOpDrive(dt) {
  opDrive.t += dt;
  if (opDrive.t < CW.smallDrive) { if (Math.random() < dt * 4) sfx('engine'); }
  else if (!opDrive.unfolding) { opDrive.unfolding = true; sfx('unfold'); }
  if (inTown() || opDrive.t >= CW.smallDrive + CW.unfold) { opDrive = null; camFocus = null; return; }
  const p = opDrivePos(); camFocus = { x: P.x, y: Math.max(P.y, p.y + 1) };
}

// ---------- Drawing ----------
function tracks(x, y, w, h, s, moving) {   // a pair of tank tracks, seen from above
  for (const tx of [x - s * 0.08, x + w - s * 0.47]) {
    g.fillStyle = '#2B2A2E'; rr2(g, tx, y, s * 0.55, h, s * 0.2); g.fill();
    g.fillStyle = '#4A5059'; const off = moving ? (time * s * 2 * moving) % (s * 0.3) : 0;
    g.save(); rr2(g, tx, y, s * 0.55, h, s * 0.2); g.clip();
    for (let q = y - s * 0.6 + ((off % (s * 0.3)) + s * 0.3) % (s * 0.3); q < y + h; q += s * 0.3) g.fillRect(tx + 3, q, s * 0.55 - 6, s * 0.12);
    g.restore();
  }
}
function lamp(x, y, s, rgb = '255,200,110', a = 0.45) { opGlow(x, y, s * 0.8, rgb, a); g.fillStyle = '#ffd98a'; g.beginPath(); g.arc(x, y, s * 0.08, 0, 7); g.fill(); }
// The big crawler. x0 = left edge, y1 = bottom edge (screen); it faces down the screen, toward town.
// moving: 1 forward, -1 reversing, 0 parked · rk: how far the ramp is down (0–1) · lights: headlight beams
function bigCrawler(x0, y1, s, moving, rk, lights) {
  const W = s * 0.32, w = s * 4.6, L = s * 2.7, y0 = y1 - L - W * 1.8;
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x0 + s * 0.1, y1 - s * 0.1, w, s * 0.25);
  tracks(x0, y0 + s * 0.1, w, L + W * 1.8, s, moving);
  const hx = x0 + s * 0.45, hw = w - s * 0.9;
  g.fillStyle = '#D9813B'; rr2(g, hx, y0, hw, L, s * 0.15); g.fill();
  g.fillStyle = '#F09A55'; g.fillRect(hx + 4, y0 + 4, hw - 8, s * 0.12);
  // the ore hopper: fuller the more you've stored, and a Haul bot riding on it
  g.fillStyle = '#5D646E'; rr2(g, hx + s * 0.2, y0 + s * 0.35, hw * 0.42, L * 0.5, 4); g.fill();
  g.fillStyle = '#3a2b20'; g.fillRect(hx + s * 0.3, y0 + s * 0.45, hw * 0.42 - s * 0.2, L * 0.5 - s * 0.2);
  const stored = ORE_LIST.reduce((n, o) => n + (S.storage[o] || 0), 0), pile = Math.min(9, 3 + Math.floor(stored / 10));
  for (let q = 0; q < pile; q++) { g.fillStyle = ['#e08a42', '#e2e6ea', '#f2c94c'][q % 3]; g.beginPath(); g.arc(hx + s * 0.45 + (q % 3) * s * 0.35, y0 + s * 0.65 + Math.floor(q / 3) * s * 0.28, s * 0.09, 0, 7); g.fill(); }
  const hauler = equipped().find(b => b.job === 'haul');
  if (hauler) drawBot(g, hauler.type, hx + s * 0.8, y0 + s * 0.45 + Math.sin(time * 3) * s * 0.04, s * 0.14);
  g.fillStyle = '#3a2b20'; rr2(g, hx + hw * 0.52, y0 + s * 0.35, hw * 0.42, s * 0.42, 3); g.fill();
  g.strokeStyle = '#d9813b'; g.lineWidth = 1.5; rr2(g, hx + hw * 0.52, y0 + s * 0.35, hw * 0.42, s * 0.42, 3); g.stroke();
  opText('OUTPOST', hx + hw * 0.73, y0 + s * 0.64, s * 0.24, '#efe3d3');
  const mx = hx + hw * 0.73, my = y0 + s * 1.3;   // the charger mast: its amber ring fills as you charge
  g.fillStyle = '#2B2A2E'; g.beginPath(); g.arc(mx, my, s * 0.22, 0, 7); g.fill();
  g.strokeStyle = '#E8B33A'; g.lineWidth = 3; g.beginPath(); g.arc(mx, my, s * 0.15, -Math.PI / 2, -Math.PI / 2 + 6.28 * opCharge()); g.stroke();
  opGlow(mx, my - s * 0.3, s * 0.6, '255,200,110', 0.3);
  // the cab across the front, with a wide windscreen (the pilot's lamp is on while you ride)
  g.fillStyle = '#3B3F46'; rr2(g, hx, y0 + L - s * 0.65, hw, s * 0.65, s * 0.12); g.fill();
  g.fillStyle = 'rgba(134,207,220,.55)'; rr2(g, hx + s * 0.15, y0 + L - s * 0.55, hw - s * 0.3, s * 0.32, 3); g.fill();
  if (crawlHides()) { g.fillStyle = 'rgba(255,217,138,.4)'; rr2(g, hx + s * 0.15, y0 + L - s * 0.55, hw - s * 0.3, s * 0.32, 3); g.fill(); }
  g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(hx + s * 0.3, y0 + L - s * 0.3); g.lineTo(hx + s * 0.55, y0 + L - s * 0.52); g.stroke();
  g.fillStyle = '#3B3F46'; g.fillRect(hx, y0 + L, hw, W * 1.8);
  g.fillStyle = '#E8B33A'; g.fillRect(hx, y0 + L + W * 1.3, hw, W * 0.5);
  g.fillStyle = '#17130F'; for (let q = 0; q < hw; q += s * 0.3) g.fillRect(hx + q, y0 + L + W * 1.3, s * 0.12, W * 0.5);
  const lit = lights || moving ? 0.6 : 0.35;
  lamp(hx + s * 0.35, y0 + L + W * 0.6, s, '255,230,160', lit); lamp(hx + hw - s * 0.35, y0 + L + W * 0.6, s, '255,230,160', lit);
  if (lights || moving > 0) {   // headlight beams, and dust kicked up behind
    g.save(); g.globalAlpha = 0.18; g.fillStyle = '#fff2c0';
    for (const lx of [hx + s * 0.35, hx + hw - s * 0.35]) { g.beginPath(); g.moveTo(lx, y0 + L + W); g.lineTo(lx - s * 0.6, y1 + s * 2.2); g.lineTo(lx + s * 0.6, y1 + s * 2.2); g.closePath(); g.fill(); }
    g.restore();
  }
  if (moving) for (let q = 0; q < 6; q++) { g.fillStyle = 'rgba(150,130,110,' + (0.35 - q * 0.05) + ')'; g.beginPath(); g.arc(x0 + w * (0.2 + (q % 3) * 0.3), (moving > 0 ? y0 - s * (0.2 + q * 0.18) : y1 + s * (0.2 + q * 0.18)), s * (0.25 + q * 0.06), 0, 7); g.fill(); }
  if (rk > 0) {   // the side ramp
    const rx = x0 + w - s * 0.05, ry = y0 + L * 0.35, rw = s * 1.2 * rk;
    g.fillStyle = '#5D646E'; g.fillRect(rx, ry, rw, s * 1.1);
    g.fillStyle = '#4A5059'; for (let q = 1; q < 6; q++) g.fillRect(rx + q * rw / 6, ry, 2, s * 1.1);
    g.fillStyle = '#E8B33A'; g.fillRect(rx + rw - s * 0.1, ry, s * 0.1, s * 1.1);
  } else { g.fillStyle = '#5D646E'; g.fillRect(x0 + w - s * 0.12, y0 + L * 0.35, s * 0.12, s * 1.1); }   // folded up against the side
}
// The small crawler (the halfway outpost). cx = centre, y1 = bottom (screen); it faces up the screen (deeper).
// state: 'driving' | 'parked' | 'unfolded'
function smallCrawler(cx, y1, s, state, k) {
  const w = s * 1.5, L = s * 2.1, x0 = cx - w / 2, y0 = y1 - L, moving = state === 'driving', open = state === 'unfolded';
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x0 + 4, y1 - 2, w, s * 0.2);
  if (open) {   // stabiliser legs, a fold-down step, a lantern mast
    const e = k == null ? 1 : k;
    g.strokeStyle = '#5D646E'; g.lineWidth = Math.max(3, s * 0.08);
    for (const [ax, ay, dx, dy] of [[x0, y0 + s * 0.2, -1, -1], [x0 + w, y0 + s * 0.2, 1, -1], [x0, y1 - s * 0.2, -1, 1], [x0 + w, y1 - s * 0.2, 1, 1]]) {
      const bx = ax + dx * s * 0.4 * e, by = ay + dy * s * 0.4 * e;
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); g.fillStyle = '#3B3F46'; g.fillRect(bx - s * 0.1, by - s * 0.06, s * 0.2, s * 0.12);
    }
    g.fillStyle = '#6a4a30'; g.fillRect(x0 - s * 0.35 * e, y0 + s * 0.35, s * 0.35 * e, s * 1.4);
    g.fillStyle = 'rgba(0,0,0,.3)'; for (let q = 1; q < 5; q++) g.fillRect(x0 - s * 0.35 * e, y0 + s * 0.35 + q * s * 0.28, s * 0.35 * e, 1);
    g.fillStyle = '#E8B33A'; g.fillRect(x0 - s * 0.35 * e, y0 + s * 0.35, s * 0.06, s * 1.4);
  }
  tracks(x0, y0, w, L, s * 0.7, moving ? -1 : 0);
  g.fillStyle = '#D9813B'; rr2(g, x0 + s * 0.3, y0 + s * 0.1, w - s * 0.6, L - s * 0.2, s * 0.12); g.fill();
  g.fillStyle = '#3B3F46'; rr2(g, x0 + s * 0.3, y0 + s * 0.1, w - s * 0.6, s * 0.5, s * 0.1); g.fill();
  g.fillStyle = 'rgba(134,207,220,.55)'; g.fillRect(x0 + s * 0.4, y0 + s * 0.2, w - s * 0.8, s * 0.2);
  g.fillStyle = '#3a2b20'; g.fillRect(x0 + s * 0.4, y0 + s * 0.85, w - s * 0.8, s * 0.38);
  opText('OP1', cx, y0 + s * 1.12, s * 0.22, '#efe3d3');
  if (moving) {
    for (const lx of [x0 + s * 0.45, x0 + w - s * 0.45]) lamp(lx, y0 + s * 0.05, s, '255,230,160', 0.55);
    g.save(); g.globalAlpha = 0.16; g.fillStyle = '#fff2c0'; g.beginPath(); g.moveTo(cx - s * 0.4, y0); g.lineTo(cx - s * 1.1, y0 - s * 2.5); g.lineTo(cx + s * 1.1, y0 - s * 2.5); g.lineTo(cx + s * 0.4, y0); g.closePath(); g.fill(); g.restore();
    for (let q = 0; q < 4; q++) { g.fillStyle = 'rgba(150,130,110,' + (0.3 - q * 0.06) + ')'; g.beginPath(); g.arc(cx + (q % 2 ? 1 : -1) * s * 0.4, y1 + s * (0.2 + q * 0.2), s * (0.2 + q * 0.08), 0, 7); g.fill(); }
  }
  if (open) {
    g.fillStyle = '#3a2b20'; g.fillRect(cx - 2, y0 - s * 0.7, 4, s * 1.0); lamp(cx, y0 - s * 0.72, s * 1.6, '255,179,71', 0.5);
    g.fillStyle = '#2B2A2E'; g.beginPath(); g.arc(cx, y0 + s * 1.55, s * 0.17, 0, 7); g.fill();
    g.strokeStyle = '#E8B33A'; g.lineWidth = 2.5; g.beginPath(); g.arc(cx, y0 + s * 1.55, s * 0.11, -Math.PI / 2, -Math.PI / 2 + 6.28 * opCharge()); g.stroke();
  }
}
// In a cave, drawn with the walls (pass 2) so your mech walks in front of it on the ramp
function drawCaveCrawler(X, Y, s, W) {
  const B = caveCrawlerBox();
  opFloor(X(C.BASE_BUILDING.cols[0]), Y(C.BASE_BUILDING.rows[1] + 1), (C.BASE_BUILDING.cols[1] - C.BASE_BUILDING.cols[0] + 1) * s, 3 * s, '#3a3128');
  let dy = 0, moving = 0, rk = 1;
  if (crawl && !crawl.arrived) {
    const k = crawlK();
    if (crawl.stage === 'close') rk = 1 - ease(k);
    if (crawl.stage === 'drive') { rk = 0; moving = 1; dy = ease(k) * s * 6; }
  }
  bigCrawler(X(B.x), Y(B.y) + dy, s, moving, rk, moving > 0);
}
function drawHalfwayCrawler(k, X, Y, s, W) {
  const row = outpostRow(k);
  opFloor(X(BELT + 2), Y(row + 1), s, 2 * s, cave().floor);   // the floor under its footprint (those cells are never drawn as floor)
  if (opDrive && opDrive.k === k) return;   // still driving out: drawn on top by drawCrawlers
  smallCrawler(X(BELT + 2.5), Y(row - 1), s * 0.85, 'unfolded');
}
// Drawn over everything: the halfway crawler on its drive, and the big crawler's visit to town
function drawCrawlers(X, Y, s, W) {
  if (opDrive && !inTown()) {
    const p = opDrivePos(), u = opDrive.t - CW.smallDrive;
    smallCrawler(X(p.x), Y(p.y), s * 0.85, p.moving ? 'driving' : u < CW.unfold * 0.4 ? 'parked' : 'unfolded', Math.max(0, Math.min(1, (u - CW.unfold * 0.4) / (CW.unfold * 0.6))));
  }
  if (crawl && crawl.arrived && onTownMap()) {
    const st = crawl.stage, k = crawlK(), stop = townStop();
    let y = stop, rk = 0, moving = 0;
    if (st === 'emerge') { y = C.TOWN.gateRow + 0.5 + (stop - C.TOWN.gateRow - 0.5) * ease(k); moving = 1; }
    if (st === 'open') rk = ease(k);
    if (st === 'out') rk = 1;
    if (st === 'back') { rk = 1 - Math.min(1, k * 3); y = stop + (C.TOWN.gateRow + 0.5 - stop) * ease(Math.max(0, (k - 0.25) / 0.75)); moving = k > 0.25 ? -1 : 0; }
    const sc = s * 0.8;
    g.save(); g.beginPath(); g.rect(0, Y(C.TOWN.gateRow) - s * 0.1, VW, VH); g.clip();   // it comes out of the tunnel behind the cliff
    bigCrawler(X(townGateCol()) - sc * 2.3, Y(y), sc, moving, rk, st === 'emerge');
    g.restore();
  }
  // the ride's fade to black between the cave and town
  if (crawl) {
    const k = crawlK();
    const a = crawl.stage === 'drive' ? Math.max(0, (k - 0.45) / 0.55) : crawl.stage === 'emerge' ? Math.max(0, 1 - k * 2.5) : 0;
    if (a > 0) { g.fillStyle = 'rgba(11,8,6,' + a + ')'; g.fillRect(0, 0, VW, VH); }
  }
}
// Fog holes for headlights and lanterns (called from the darkness pass in render)
function crawlerLights(hole, X, Y, s) {
  if (inTown()) return;
  if (opDrive) {
    const p = opDrivePos();
    hole(X(p.x), Y(p.y + 2.2), s * (p.moving ? 2.6 : 2));   // the beam ahead
    hole(X(p.x), Y(p.y + 0.8), s * 1.6);
  }
  for (let k = 1; k <= outpostCount(); k++) if (!opDrive || opDrive.k !== k) hole(X(BELT + 2.5), Y(outpostRow(k) + 1.3), s * 1.5);   // lantern mast
}
