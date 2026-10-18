// Bolt & Burrow — ore drops, the magnet, and Flux upgrades (the Computer car).
// Every ore block holds 1–4 pieces of ore: the pixels drawn on it. When the block breaks (by the dig arm,
// a weapon, a blast charge…) each piece pops out onto the floor, and the mech's magnet pulls it in.
'use strict';

// ---------- Ore pixels ----------
// How many pieces an ore block holds, and where its pixels sit (fixed for each cell, so it never changes)
const orePieces = (c, r) => 1 + Math.floor(hash(c, r, 90) * C.ORE_DROP.oreMax);
const pixelAt = (c, r, k) => ({ x: 0.15 + hash(c, r, k * 3 + 91) * 0.6, y: 0.15 + hash(r, c, k * 7 + 92) * 0.6 });

// ---------- Drops on the floor ----------
let drops = [];   // { type, x, y, vx, vy, t, pulled }
function dropOre(type, x, y, n = 1, spread = 1.4) {
  for (let k = 0; k < n; k++) {
    const a = Math.random() * 7, sp = spread * (0.5 + Math.random());
    drops.push({ type, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0 });
  }
}
// The pieces from a broken ore block, flying out from where their pixels were
function dropBlockOre(t, c, r) {
  let n = orePieces(c, r);
  if (Math.random() < modVal('sorter')) n++;   // the Sorter mod sometimes finds one more
  for (let k = 0; k < n; k++) { const p = pixelAt(c, r, k % C.ORE_DROP.oreMax); dropOre(t, c + p.x, r + 1 - p.y, 1, 1.1); }
}
const clearDrops = () => { drops = []; };
const magnetRange = () => C.ORE_DROP.magnet + coreVal('magnet');
let fullWarnT = 0;
function updateDrops(dt) {
  if (inTown()) { drops = []; return; }
  const R = magnetRange(), pull = C.ORE_DROP.pull * (1 + coreLevel('magnet') * 0.25), room = cargoCount() < cargoMax();
  for (const d of drops) {
    d.t += dt;
    const dx = P.x - d.x, dy = P.y - d.y, dist = Math.hypot(dx, dy);
    if (d.t > 0.35 && dist < R && room) {   // the magnet: faster the closer it gets
      const sp = Math.max(2, pull * (1.2 - dist / R));
      d.vx = dx / (dist || 1) * sp; d.vy = dy / (dist || 1) * sp;
    } else { d.vx *= Math.pow(0.02, dt); d.vy *= Math.pow(0.02, dt); }
    const nx = d.x + d.vx * dt, ny = d.y + d.vy * dt;
    // bounce off rock while scattering
    if (isFloor(at(Math.floor(nx), Math.floor(d.y))) || at(Math.floor(nx), Math.floor(d.y)) === 'chasm') d.x = nx; else d.vx *= -0.4;
    if (isFloor(at(Math.floor(d.x), Math.floor(ny))) || at(Math.floor(d.x), Math.floor(ny)) === 'chasm') d.y = ny; else d.vy *= -0.4;
    if (dist < 0.45 && d.t > 0.35) {
      if (cargoCount() < cargoMax()) { cargoAdd(d.type); d.got = true; sfx('ore'); floatText(P.x, P.y + 0.8, '+' + C.BLOCKS[d.type].label, C.BLOCKS[d.type].ore); }
    }
  }
  drops = drops.filter(d => !d.got);
  if (!room && drops.some(d => Math.hypot(P.x - d.x, P.y - d.y) < R) && time - fullWarnT > 4) {
    fullWarnT = time; floatText(P.x, P.y + 1, 'Cargo full', '#e2705a');
    hintOnce('cargo-full', 'Cargo full', 'Ore you can\'t carry stays on the floor until you leave the cave. Send your load home at an outpost and come back for it.');
  }
}
function drawDrops(X, Y, s) {
  const q = Math.max(3, s * 0.13);
  for (const d of drops) {
    if (Math.abs(d.y - P.y) > 14) continue;
    const x = X(d.x), y = Y(d.y) - s * 0.15 + Math.sin(time * 5 + d.x * 3) * s * 0.03;
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x - q / 2, Y(d.y) - s * 0.02, q, q * 0.4);
    g.fillStyle = C.BLOCKS[d.type].ore; g.fillRect(x - q / 2, y - q / 2, q, q);
    g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(x - q / 2, y - q / 2, q * 0.4, q * 0.4);
  }
  // the magnet's reach, shown faintly while pieces are being pulled
  if (drops.some(d => d.t > 0.35 && Math.hypot(P.x - d.x, P.y - d.y) < magnetRange())) {
    g.strokeStyle = 'rgba(134,207,220,.18)'; g.lineWidth = 1; g.setLineDash([4, 6]);
    g.beginPath(); g.arc(X(P.x), Y(P.y) - s * 0.2, magnetRange() * s, 0, 7); g.stroke(); g.setLineDash([]);
  }
}

// ---------- Flux upgrades (Computer car) ----------
const coreLevel = id => S.core[id] || 0;
const coreVal = id => coreLevel(id) * C.CORE[id].per;
const coreCost = id => (coreLevel(id) >= C.CORE[id].max ? 0 : C.CORE_COST[coreLevel(id)]);
function buyCore(id) {
  if (townSpot() !== 'computer' || coreLevel(id) >= C.CORE[id].max || S.flux < coreCost(id)) return;
  S.flux -= coreCost(id); S.core[id] = coreLevel(id) + 1; sfx('buy');
  if (id === 'plating') P.hull = hullMax();
  toast(null, C.CORE[id].name + ' is now level ' + S.core[id] + ': ' + C.CORE[id].unit(coreVal(id)) + '.');
  save();
}
