// Bolt & Burrow — hazards. Unstable rock (Basalt Deeps) starts shaking once two of its sides are
// dug open, or as soon as you pass close by with one side open. When it collapses it scatters
// rubble, hurts the walker if it's close, and sets nearby unstable rock shaking (a chain reaction).
'use strict';

const wobble = new Map();   // cell index → seconds it has been shaking

function exposed(c, r) {
  let n = 0;
  for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const t = at(c + a, r + b); if (isFloor(t) || t === 'chasm') n++; }
  return n;
}
function updateRocks(dt) {
  if (inTown()) return;
  const R = C.ROCK;
  const r0 = Math.max(BASE_ROWS, pRow() - 12), r1 = Math.min(ROWS - 2, pRow() + 12);
  for (let r = r0; r <= r1; r++) for (let c = 1; c < COLS - 1; c++) {
    const i = idx(c, r);
    if (T[i] !== 'loose') { wobble.delete(i); continue; }
    const open = exposed(c, r);
    const near = Math.hypot(c + 0.5 - P.x, r + 0.5 - P.y) <= R.triggerRadius;
    if (wobble.has(i) || open >= R.exposedSides || (open >= 1 && near)) {
      const w = (wobble.get(i) || 0) + dt;
      if (w >= R.wobble) { wobble.delete(i); caveIn(c, r); } else wobble.set(i, w);
    }
  }
}
function caveIn(c, r) {
  const R = C.ROCK;
  T[idx(c, r)] = null; DMG[idx(c, r)] = 0;
  burst(c + 0.5, r + 0.5, C.BLOCKS.loose.color, 18);
  // chain reaction: nearby unstable rock starts shaking, already part-way to collapse
  for (let rr = r - 3; rr <= r + 3; rr++) for (let cc = c - 3; cc <= c + 3; cc++) {
    if (!inBounds(cc, rr) || T[idx(cc, rr)] !== 'loose') continue;
    if (Math.hypot(cc - c, rr - r) > R.chainRadius) continue;
    const j = idx(cc, rr);
    if (!wobble.has(j)) wobble.set(j, R.wobble * R.chainStart);
  }
  const spots = [];
  for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
    const cc = c + a, rr = r + b;
    if ((a || b) && inBounds(cc, rr) && !at(cc, rr) && !onBelt(cc, rr) && !outpostAt(cc, rr)) spots.push([cc, rr]);
  }
  for (let k = 0; k < R.rubble && spots.length; k++) {
    const [cc, rr] = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
    if (Math.abs(cc + 0.5 - P.x) < 0.5 + HB && Math.abs(rr + 0.5 - P.y) < 0.5 + HB) continue; // never bury the walker
    T[idx(cc, rr)] = 'rubble';
  }
  P.shake = 0.35;
  if (Math.hypot(c + 0.5 - P.x, r + 0.5 - P.y) < R.hitRadius) {
    const n = cargoCount();
    const lost = cargoRemove(n - Math.floor(n * (1 - R.cargoLoss)));
    toast('Cave-in!', 'Lost ' + Math.round(R.batteryLoss * 100) + '% battery' + (lost ? ' and ' + lost + ' ore' : '') + '. Unstable rock collapses as you pass.');
    drain(batteryMax() * R.batteryLoss);
  }
}
