// Bolt & Burrow v0.3 — game logic.
// Sections: state & saving · world generation · player · hazards · pet · drawing · UI · input · main loop
(() => {
'use strict';
const C = CONFIG;
const { COLS, ROWS, SURFACE_ROW, GROUND_ROW } = C;
const SAVE_KEY = 'bolt-burrow-v2'; // v0.3 reads v0.2 saves and adds the shop foundation
const $ = id => document.getElementById(id);

// ================= State & saving =================
// World cells are stored as block-type strings (or null for open space).
const CODE = { d: 'dirt', c: 'clay', b: 'basalt', l: 'loose', o: 'copper', s: 'silver', g: 'gold', k: 'crystal', f: 'fossil', p: 'plat', n: 'found', x: 'bedrock' };
const CHAR = Object.fromEntries(Object.entries(CODE).map(([k, v]) => [v, k]));
const ORES = new Set(['copper', 'silver', 'gold', 'crystal']);

const freshState = () => ({
  coins: 0,
  tiers: { head: 0, arms: 0, body: 0, legs: 0 },
  liftRow: C.LIFT.startRow, liftExt: 0,
  pet: 0,                              // pet level (0 = not hatched)
  cargo: { n: 0, value: 0 },
  best: 0, biomesSeen: [], last: Date.now(),
  world: null, seen: null, pos: null,
});

let S = freshState();
let T = [];                // block types
let DMG = new Float32Array(COLS * ROWS); // dig damage per cell
let SEEN = new Uint8Array(COLS * ROWS);  // cells the robot has lit up
let isNewGame = true;

try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) { S = Object.assign(freshState(), JSON.parse(raw)); isNewGame = false; }
} catch (e) { /* storage unavailable: play without saving */ }

function save() {
  S.last = Date.now();
  S.world = T.map(t => (t ? CHAR[t] : '.')).join('');
  S.seen = SEEN.join('');
  S.pos = { x: P.x, y: P.y, battery: P.battery, plats: P.plats };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {}
}

// ================= Helpers =================
const idx = (c, r) => r * COLS + c;
const inBounds = (c, r) => c >= 0 && c < COLS && r >= 0 && r < ROWS;
const at = (c, r) => (inBounds(c, r) ? T[idx(c, r)] : 'bedrock');
const inLift = (c, r) => c === 0 && r >= SURFACE_ROW && r <= S.liftRow;
const biomeAt = r => C.BIOMES.find(b => r >= b.from && r <= b.to) || C.BIOMES[C.BIOMES.length - 1];
const part = slot => C.PARTS[slot].tiers[S.tiers[slot]];
const lightRadius = () => part('head').val;
const digPower = () => part('arms').val * (1 + C.PET.digBonusPerLevel * S.pet);
const batteryMax = () => part('body').val.battery;
const cargoMax = () => part('body').val.cargo;
const legs = () => part('legs').val;
function hash(a, b, c) { let h = (a * 374761393 + b * 668265263 + c * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function fmt(n) {
  n = Math.floor(n);
  if (n < 10000) return n.toLocaleString('en-CA');
  const u = ['K', 'M', 'B']; let i = -1;
  while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return n.toFixed(n < 100 ? 1 : 0) + u[i];
}
const depthOf = r => Math.max(0, r - SURFACE_ROW);

// ================= World generation =================
function genWorld() {
  T = new Array(COLS * ROWS).fill(null);
  for (let r = GROUND_ROW; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = idx(c, r);
      if (r === ROWS - 1) { T[i] = 'bedrock'; continue; }
      const x = Math.random();
      if (biomeAt(r).id === 'topsoil') {
        const clayChance = Math.min(0.75, (r - GROUND_ROW) / 55);
        let t = Math.random() < clayChance ? 'clay' : 'dirt';
        if (x < 0.09) t = 'copper';
        else if (r > 18 && x < 0.12) t = 'silver';
        T[i] = t;
      } else {
        const crystal = r > 95 ? 0.03 : 0.015;
        let t = 'basalt';
        if (x < 0.04) t = null;                                  // small caves
        else if (x < 0.04 + C.ROCK.chance) t = 'loose';
        else if (x < 0.10 + C.ROCK.chance) t = 'gold';
        else if (x < 0.10 + C.ROCK.chance + crystal) t = 'crystal';
        else if (x < 0.14 + C.ROCK.chance + crystal) t = 'copper';
        T[i] = t;
      }
    }
  }
  for (let r = GROUND_ROW; r <= S.liftRow; r++) T[idx(0, r)] = null; // the lift shaft
  layFoundation();
  if (!S.pet) {
    const [a, b] = C.PET.fossilRows;
    T[idx(2 + Math.floor(Math.random() * (COLS - 3)), a + Math.floor(Math.random() * (b - a)))] = 'fossil';
  }
  SEEN = new Uint8Array(COLS * ROWS);
}
// The shop stands on undiggable foundation so it can never be undermined.
function layFoundation() {
  const [a, b] = C.SHOP_COLS;
  for (let r = GROUND_ROW; r < GROUND_ROW + C.FOUNDATION_DEPTH; r++)
    for (let c = a; c <= b; c++) T[idx(c, r)] = 'found';
}
function loadWorld() {
  if (S.world && S.world.length === COLS * ROWS) {
    T = Array.from(S.world, ch => (ch === '.' ? null : CODE[ch] || null));
    SEEN = S.seen && S.seen.length === COLS * ROWS ? Uint8Array.from(S.seen, ch => (ch === '1' ? 1 : 0)) : new Uint8Array(COLS * ROWS);
    layFoundation(); // older saves had no foundation
  } else genWorld();
}
// What an ore block looks like before you've lit it up: the plain rock around it.
function baseFor(c, r) {
  if (biomeAt(r).id === 'basalt') return 'basalt';
  return hash(c, r, 7) < Math.min(0.75, (r - GROUND_ROW) / 55) ? 'clay' : 'dirt';
}

// ================= Player =================
// The robot moves freely (not cell by cell). P.x, P.y is the centre of its hitbox, in blocks.
const HW = C.BODY.w / 2, HH = C.BODY.h / 2, EPS = 1e-4;
const P = { x: C.SPAWN_COL + 0.5, y: SURFACE_ROW + 1 - HH, vx: 0, vy: 0, battery: 0, plats: C.PLATFORMS.carry,
            face: 1, dockHold: 0, grounded: false, onPlat: false, inLift: false, dropT: 0, digging: null, wantBuild: false, shake: 0 };
const pCol = () => Math.floor(P.x);
const pRow = () => Math.floor(P.y);
const bottom = () => P.y + HH;

// Solid = blocks you can't pass. Platforms are one-way and handled separately.
const solidAt = (c, r) => {
  if (c < 0 || c >= COLS || r >= ROWS) return true;
  if (r < 0) return false;
  const t = T[idx(c, r)];
  return !!t && t !== 'plat';
};
function boxSolid(x, y) {
  const l = x - HW, r = x + HW, t = y - HH, b = y + HH;
  for (let row = Math.floor(t); row <= Math.floor(b - EPS); row++)
    for (let col = Math.floor(l); col <= Math.floor(r - EPS); col++)
      if (solidAt(col, row)) return true;
  return false;
}
// Is there a platform whose top surface lies between the old and new feet position?
function platformLanding(x, oldB, newB) {
  if (P.dropT > 0) return null;
  const row = Math.floor(newB);
  if (row < 0 || oldB > row + 0.02) return null;
  for (let col = Math.floor(x - HW); col <= Math.floor(x + HW - EPS); col++)
    if (at(col, row) === 'plat') return row;
  return null;
}
function checkGround() {
  const b = bottom();
  P.onPlat = false;
  if (boxSolid(P.x, P.y + 0.03)) return true;
  const row = Math.floor(b + 0.03);
  if (P.dropT <= 0 && b <= row + 0.03)
    for (let col = Math.floor(P.x - HW); col <= Math.floor(P.x + HW - EPS); col++)
      if (at(col, row) === 'plat') { P.onPlat = true; return true; }
  return false;
}
const liftZone = () => P.x < 1 && pRow() >= SURFACE_ROW && pRow() <= S.liftRow;

function placePlayerFromSave() {
  const p = S.pos;
  P.vx = P.vy = 0;
  if (p && typeof p.x === 'number' && !boxSolid(p.x, p.y)) {
    P.x = p.x; P.y = p.y; P.battery = Math.min(p.battery, batteryMax()); P.plats = p.plats ?? C.PLATFORMS.carry;
  } else {
    P.x = C.SPAWN_COL + 0.5; P.y = SURFACE_ROW + 1 - HH; P.battery = batteryMax();
  }
}

// Returns true if the battery ran out (the robot gets recalled to the surface).
function drain(amount) {
  P.battery -= amount;
  if (P.battery <= 0) { recall('dead'); return true; }
  return false;
}
function recall(kind) {
  const n = S.cargo.n;
  let msg;
  if (kind === 'dead') {
    S.cargo = { n: 0, value: 0 };
    msg = n ? 'A recovery drone hauled you up. Your ' + n + ' ore was lost.' : 'A recovery drone hauled you back to the surface.';
  } else {
    const keep = Math.floor(n * C.RECALL.keepCargo);
    S.cargo = { n: keep, value: n ? Math.floor(S.cargo.value * keep / n) : 0 };
    msg = n ? 'The drone dropped ' + (n - keep) + ' ore on the way up. You kept ' + keep + '.' : 'A drone carried you back to the surface.';
  }
  P.x = C.SPAWN_COL + 0.5; P.y = SURFACE_ROW + 1 - HH; P.vx = P.vy = 0;
  P.battery = batteryMax(); P.digging = null;
  toast(kind === 'dead' ? 'Battery dead' : 'Recalled', msg);
}

function atSurface() { return pRow() <= SURFACE_ROW && (P.grounded || P.inLift); }
function atDock() { return P.inLift && pRow() === S.liftRow && Math.abs(P.vy) < 0.01; }

function sellAndCharge(dt) {
  const here = atSurface() ? 'surface' : atDock() ? 'dock' : null;
  if (!here) return;
  if (S.cargo.n > 0) {
    const { n, value } = S.cargo;
    S.coins += value; S.cargo = { n: 0, value: 0 };
    floatText(P.x, P.y - 0.6, '+' + fmt(value), '#e8a160');
    toast(null, 'Sold ' + n + ' ore for ' + fmt(value) + ' coins at the ' + here + '.');
  }
  if (P.plats < C.PLATFORMS.carry && S.coins >= C.PLATFORMS.restockCost) {
    const n = Math.min(C.PLATFORMS.carry - P.plats, Math.floor(S.coins / C.PLATFORMS.restockCost));
    P.plats += n; S.coins -= n * C.PLATFORMS.restockCost;
  }
  P.battery = Math.min(batteryMax(), P.battery + C.CHARGE_RATE * dt);
}

function breakBlock(c, r) {
  const i = idx(c, r), t = T[i];
  T[i] = null; DMG[i] = 0;
  const B = C.BLOCKS[t];
  burst(c + 0.5, r + 0.5, B.ore || B.color || C.BLOCKS[baseFor(c, r)].color, 10);
  if (B.value) {
    if (S.cargo.n < cargoMax()) {
      const v = Math.round(B.value * (1 + (r - GROUND_ROW) / C.ORE_DEPTH_BONUS));
      S.cargo.n++; S.cargo.value += v;
      floatText(c + 0.5, r + 0.3, '+' + B.label, B.ore);
    } else floatText(c + 0.5, r + 0.3, 'Cargo full', '#e2705a');
  }
  if (t === 'fossil') {
    S.pet = 1; regenPet();
    toast('A fossil!', C.PET.name + ' the ' + C.PET.species + ' hatched and moved into your burrow.');
  }
}

// Dig one block. `up` digging is slower and uses more battery.
function dig(c, r, dt, up) {
  const t = at(c, r);
  if (!t) return;
  if (t === 'bedrock') { hintOnce('bedrock', null, 'Bedrock. This is as deep as this version goes.'); return; }
  if (t === 'found') { hintOnce('found', null, "That's the shop's foundation. It can't be dug."); return; }
  const i = idx(c, r);
  DMG[i] += digPower() * C.DIG_RATE * (up ? C.DIG_UP.speed : 1) * dt;
  P.digging = { c, r };
  if (Math.random() < dt * 18) burst(c + 0.5, r + 0.5, C.BLOCKS[t].color || C.BLOCKS[baseFor(c, r)].color, 1);
  if (DMG[i] >= C.BLOCKS[t].hp) {
    breakBlock(c, r);
    drain(C.BATTERY.dig * (up ? C.DIG_UP.battery : 1));
  }
}
// Slide toward the middle of the current column (so you fit down or up a 1-wide hole).
function centre(dt) {
  const target = pCol() + 0.5, d = target - P.x, step = 6 * dt;
  P.x += Math.abs(d) < step ? d : Math.sign(d) * step;
}

function tryBuild() {
  if (P.inLift) return toast(null, 'The lift already carries you up and down.');
  if (P.grounded) return toast(null, 'Jump first, then drop a platform under yourself.');
  if (P.plats <= 0) return toast(null, 'Out of platforms. They restock at the surface and the lift dock.');
  const c = pCol(), r = Math.ceil(bottom() - 0.02);
  if (!inBounds(c, r) || at(c, r)) return;
  if (c === 0 && r <= S.liftRow) return;
  T[idx(c, r)] = 'plat';
  P.plats--;
  burst(c + 0.5, r + 0.1, '#a77d48', 6);
}

// Move horizontally, stopping at walls. Returns true if a wall blocked the move.
function moveX(dx) {
  if (!dx) return false;
  const nx = P.x + dx;
  if (!boxSolid(nx, P.y)) { P.x = nx; return false; }
  // step-up assist: hop small lips (e.g. after sinking slightly into a 1-wide gap)
  if (P.grounded && !boxSolid(nx, P.y - 0.3) && !boxSolid(P.x, P.y - 0.3)) {
    for (let lift = 0.05; lift <= 0.3; lift += 0.05) if (!boxSolid(nx, P.y - lift)) { P.y -= lift; P.x = nx; return false; }
  }
  if (dx > 0) P.x = Math.floor(nx + HW) - HW - EPS;
  else P.x = Math.floor(nx - HW) + 1 + HW + EPS;
  return true;
}
// Move vertically; lands on ground and one-way platforms, bumps heads on ceilings.
function moveY(dy) {
  if (!dy) return;
  const ny = P.y + dy;
  if (dy > 0) {
    const pr = platformLanding(P.x, bottom(), ny + HH);
    if (boxSolid(P.x, ny)) { P.y = Math.floor(ny + HH) - HH - EPS; P.vy = 0; return; }
    if (pr !== null) { P.y = pr - HH - EPS; P.vy = 0; return; }
    P.y = ny;
  } else {
    if (boxSolid(P.x, ny)) { P.y = Math.floor(ny - HH) + 1 + HH + EPS; if (P.vy < 0) P.vy = 0; return; } // head-bump
    P.y = ny;
  }
}

function updatePlayer(dt) {
  P.digging = null;
  if (P.dropT > 0) P.dropT -= dt;
  if (P.wantBuild) { P.wantBuild = false; tryBuild(); }

  const h = horizDir(), v = vertDir();
  P.grounded = checkGround();
  P.inLift = liftZone();
  const L = legs();

  // ---- Vertical intent ----
  let digV = false;
  if (P.inLift) {
    P.vy = 0;
    if (v === 'up') {
      if (pRow() > SURFACE_ROW || P.y > SURFACE_ROW + 1 - HH + 0.01) P.vy = -C.LIFT.speed;
    } else if (v === 'down') {
      const atBottom = pRow() === S.liftRow && P.y >= S.liftRow + 1 - HH - 0.02;
      if (atBottom && P.dockHold <= 0.4) P.dockHold += dt; // pause at the dock before digging or dropping below it
      else if (solidAt(0, pRow() + 1) && P.y >= pRow() + 1 - HH - 0.02) { if (!h) { dig(0, pRow() + 1, dt, false); digV = true; } }
      else P.vy = C.LIFT.speed;
    } else if (h) {
      // ease to the nearest floor height so you can walk out of the lift
      const target = Math.round(P.y + HH) - HH; P.y += Math.sign(target - P.y) * Math.min(Math.abs(target - P.y), 6 * dt);
    }
  } else {
    if (v === 'down' && P.grounded) {
      if (P.onPlat && !solidAt(pCol(), pRow() + 1)) { P.dropT = 0.25; P.grounded = false; }
      else if (!h && solidAt(pCol(), pRow() + 1)) { centre(dt); dig(pCol(), pRow() + 1, dt, false); digV = true; }
    } else if (v === 'up') {
      const above = pRow() - 1;
      if (P.grounded && !h && solidAt(pCol(), above) && P.y - HH - above - 1 < 0.25) {
        centre(dt); dig(pCol(), above, dt, true); digV = true;
      } else if (L.fly && !solidAt(pCol(), above)) {
        P.vy = Math.max(P.vy - C.GRAVITY * 2.2 * dt, -C.JET_SPEED);
        if (drain(C.BATTERY.jet * dt)) return;
      } else if (P.grounded) {
        if (drain(C.BATTERY.jump)) return;
        P.vy = -Math.sqrt(2 * C.GRAVITY * L.jump);
        P.grounded = false;
      }
    }
    if (!P.grounded || P.vy < 0) P.vy = Math.min(C.FALL_MAX, P.vy + C.GRAVITY * dt);
  }

  // ---- Horizontal intent ----
  P.vx = h ? (h === 'left' ? -1 : 1) * L.speed : 0;
  if (h) P.face = h === 'left' ? -1 : 1;
  if (P.inLift && !h) P.x += (0.5 - P.x) * Math.min(1, dt * 10);

  // ---- Integrate in small steps so fast falls never skip through a block ----
  const steps = 4;
  let blocked = false;
  const x0 = P.x;
  for (let k = 0; k < steps; k++) {
    if (!digV) blocked = moveX(P.vx * dt / steps) || blocked;
    moveY(P.vy * dt / steps);
  }
  if (P.inLift) {
    const top = SURFACE_ROW + 1 - HH, dock = S.liftRow + 1 - HH;
    if (P.y < top) P.y = top;
    if (P.y > dock && P.dockHold <= 0.4) { P.y = dock; P.vy = 0; } // the lift stops at the dock
  }
  if (v !== 'down') P.dockHold = 0;
  if (Math.abs(P.x - x0) > 0 && P.grounded) { if (drain(Math.abs(P.x - x0) * C.BATTERY.move)) return; }

  // ---- Dig sideways when you walk into a wall while standing ----
  if (blocked && h && (P.grounded || P.inLift) && v !== 'up') {
    const tc = pCol() + (h === 'left' ? -1 : 1);
    if (tc >= 0 && tc < COLS) dig(tc, pRow(), dt, false);
  }

  P.grounded = checkGround();
  P.inLift = liftZone();
  onArrive();
}

let lastBiome = null, lastCell = -1;
function onArrive() {
  const cell = idx(pCol(), Math.max(0, pRow()));
  if (cell === lastCell) return;
  lastCell = cell;
  markSeen();
  S.best = Math.max(S.best, depthOf(pRow()));
  if (pRow() >= GROUND_ROW) {
    const b = biomeAt(pRow());
    if (b.id !== lastBiome && !S.biomesSeen.includes(b.id)) {
      S.biomesSeen.push(b.id);
      toast(b.name, b.note);
    }
    lastBiome = b.id;
  }
}
function markSeen() {
  const R = lightRadius(), cx = P.x - 0.5, cy = P.y - 0.5;
  for (let r = Math.max(0, Math.floor(cy - R)); r <= Math.min(ROWS - 1, Math.ceil(cy + R)); r++)
    for (let c = 0; c < COLS; c++)
      if (Math.hypot(c - cx, r - cy) <= R) SEEN[idx(c, r)] = 1;
}

// ================= Hazards: loose rock =================
let rocks = [];
const wobble = new Map();
function updateRocks(dt) {
  const r0 = Math.max(GROUND_ROW, pRow() - 14), r1 = Math.min(ROWS - 2, pRow() + 14);
  for (let r = r0; r <= r1; r++) for (let c = 0; c < COLS; c++) {
    const i = idx(c, r);
    if (T[i] !== 'loose') continue;
    if (!T[idx(c, r + 1)]) {
      const w = (wobble.get(i) || 0) + dt;
      if (w >= C.ROCK.wobble) { wobble.delete(i); T[i] = null; DMG[i] = 0; rocks.push({ c, y: r, vy: 0 }); }
      else wobble.set(i, w);
    } else wobble.delete(i);
  }
  for (const k of rocks) {
    k.vy = Math.min(C.ROCK.maxSpeed, k.vy + C.ROCK.gravity * dt);
    k.y += k.vy * dt;
    if (Math.abs(k.c + 0.5 - P.x) < 0.45 + HW && k.y + 0.95 > P.y - HH && k.y < P.y + HH) { hitPlayer(); k.dead = true; burst(k.c + 0.5, k.y + 0.8, C.BLOCKS.loose.color, 14); continue; }
    const landRow = Math.floor(k.y);
    if (at(k.c, landRow + 1)) {
      if (!T[idx(k.c, landRow)]) T[idx(k.c, landRow)] = 'loose';
      k.dead = true; burst(k.c + 0.5, landRow + 1, C.BLOCKS.loose.color, 6);
    }
  }
  rocks = rocks.filter(k => !k.dead);
}
function hitPlayer() {
  P.shake = 0.35;
  const lostOre = S.cargo.n - Math.floor(S.cargo.n * (1 - C.ROCK.cargoLoss));
  S.cargo.n -= lostOre; S.cargo.value = Math.floor(S.cargo.value * (1 - C.ROCK.cargoLoss));
  toast('Rock fall!', 'Lost ' + Math.round(C.ROCK.batteryLoss * 100) + '% battery' + (lostOre ? ' and ' + lostOre + ' ore' : '') + '. Watch for wobbling rocks.');
  drain(batteryMax() * C.ROCK.batteryLoss);
}

// ================= Pet =================
const PET = { grid: [], c: 0, r: 0, prog: 0 };
const petDigTime = () => C.PET.baseDig / (1 + C.PET.speedPerLevel * (S.pet - 1));
const petCoins = () => C.PET.baseCoins * (1 + 0.5 * (S.pet - 1));
const petRate = () => (S.pet ? petCoins() * (1 + C.PET.oreChance * (C.PET.oreMult - 1)) / petDigTime() : 0);
const trainCost = () => Math.round(C.PET.trainBase * Math.pow(C.PET.trainGrowth, S.pet - 1));
function regenPet() {
  PET.grid = Array.from({ length: C.PET.cols * C.PET.rows }, () => (Math.random() < C.PET.oreChance ? 'ore' : 'dirt'));
  PET.c = 0; PET.r = 0; PET.prog = 0;
}
const petFloats = [];
function updatePet(dt) {
  if (!S.pet) return;
  PET.prog += dt;
  if (PET.prog < petDigTime()) return;
  PET.prog = 0;
  const i = PET.r * C.PET.cols + PET.c, t = PET.grid[i];
  PET.grid[i] = null;
  const v = Math.round(petCoins() * (t === 'ore' ? C.PET.oreMult : 1));
  S.coins += v;
  petFloats.push({ c: PET.c + 0.5, r: PET.r + 0.5, text: '+' + v, ore: t === 'ore', life: 1 });
  PET.r++;
  if (PET.r >= C.PET.rows) { PET.r = 0; PET.c++; if (PET.c >= C.PET.cols) regenPet(); }
}

// ================= Effects =================
let particles = [], floats = [];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
function burst(x, y, col, n) {
  if (reduceMotion) n = Math.ceil(n / 3);
  for (let k = 0; k < n && particles.length < 260; k++) {
    const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.5, life: 0.4 + Math.random() * 0.4, col });
  }
}
function floatText(x, y, text, col) { floats.push({ x, y, text, col, life: 1.1 }); }

// ================= Drawing =================
const stage = $('stage'), cv = $('world'), g = cv.getContext('2d');
const pcv = $('pet'), pg = pcv.getContext('2d');
let VW = 1, VH = 1, PW = 1, PH = 1, CELL = 40, cam = 0, time = 0;
function fit(canvas, ctx) {
  const r = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return [r.width, r.height];
}
function resize() {
  [VW, VH] = fit(cv, g); [PW, PH] = fit(pcv, pg);
  CELL = Math.max(18, Math.floor(Math.min(VW / (COLS + 1), VH / 9)));
}
new ResizeObserver(resize).observe(stage);
new ResizeObserver(resize).observe($('burrowView'));

function rr(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

function drawBlock(t, c, r, x, y, s) {
  const i = idx(c, r), seen = SEEN[i];
  const hidden = (ORES.has(t) || t === 'fossil') && !seen;
  const look = hidden ? baseFor(c, r) : t;
  const base = C.BLOCKS[look].color || C.BLOCKS[baseFor(c, r)].color;
  const bev = Math.max(2, s * 0.08);

  if (look === 'plat') {
    g.fillStyle = r >= 65 ? '#121014' : '#1c140e'; g.fillRect(x, y, s, s);
    g.fillStyle = '#a77d48'; g.fillRect(x + 1, y, s - 2, s * 0.22);
    g.fillStyle = '#6e5130'; g.fillRect(x + 1, y + s * 0.22, s - 2, s * 0.05);
    g.strokeStyle = '#6e5130'; g.lineWidth = Math.max(1, s * 0.05);
    g.beginPath(); g.moveTo(x + s * 0.2, y + s * 0.25); g.lineTo(x + s * 0.45, y + s * 0.6); g.moveTo(x + s * 0.8, y + s * 0.25); g.lineTo(x + s * 0.55, y + s * 0.6); g.stroke();
    return;
  }
  if (look === 'loose') {
    g.fillStyle = '#121014'; g.fillRect(x, y, s, s);
    g.fillStyle = base; rr(x + s * 0.1, y + s * 0.12, s * 0.8, s * 0.78, s * 0.3); g.fill();
    g.fillStyle = 'rgba(255,240,220,.12)'; rr(x + s * 0.2, y + s * 0.18, s * 0.4, s * 0.16, s * 0.08); g.fill();
    g.strokeStyle = 'rgba(10,6,3,.6)'; g.lineWidth = Math.max(1, s * 0.04);
    g.beginPath(); g.moveTo(x + s * 0.5, y + s * 0.2); g.lineTo(x + s * 0.42, y + s * 0.5); g.lineTo(x + s * 0.58, y + s * 0.7); g.stroke();
  } else {
    g.fillStyle = base; g.fillRect(x, y, s, s);
    g.fillStyle = 'rgba(255,240,220,.07)'; g.fillRect(x, y, s, bev); g.fillRect(x, y, bev, s);
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x, y + s - bev, s, bev); g.fillRect(x + s - bev, y, bev, s);
    if (look === 'found') { g.fillStyle = 'rgba(0,0,0,.3)'; const m = s / 2; g.fillRect(x, y + m - 1, s, 2); g.fillRect(x + (r % 2 ? m : s * 0.25), y, 2, m); g.fillRect(x + (r % 2 ? s * 0.25 : m), y + m, 2, m); }
    if (look === 'bedrock') { g.fillStyle = '#211b20'; for (let k = 0; k < 3; k++) g.fillRect(x + s * 0.1, y + s * (0.2 + k * 0.28), s * 0.8, s * 0.06); }
    if (look === 'basalt') { g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(x + s * (0.15 + hash(c, r, 1) * 0.4), y + s * (0.25 + hash(c, r, 2) * 0.4), s * 0.3, s * 0.07); }
  }
  if (!hidden && ORES.has(t)) {
    g.fillStyle = C.BLOCKS[t].ore;
    const q = Math.max(2, s * 0.12);
    for (let k = 0; k < 5; k++) g.fillRect(x + s * 0.15 + hash(c, r, k * 3) * (s * 0.7 - q), y + s * 0.15 + hash(r, c, k * 7) * (s * 0.7 - q), q, q);
  }
  if (!hidden && t === 'fossil') {
    g.strokeStyle = '#eadfc4'; g.lineWidth = Math.max(2, s * 0.1); g.lineCap = 'round';
    g.beginPath(); g.moveTo(x + s * 0.28, y + s * 0.72); g.lineTo(x + s * 0.72, y + s * 0.28); g.stroke();
    g.fillStyle = '#eadfc4';
    [[0.24, 0.7], [0.3, 0.78], [0.7, 0.22], [0.78, 0.3]].forEach(([a, b]) => { g.beginPath(); g.arc(x + s * a, y + s * b, s * 0.07, 0, 7); g.fill(); });
    g.lineCap = 'butt';
  }
  const hp = C.BLOCKS[t].hp, d = DMG[i] / hp;
  if (d > 0 && hp !== Infinity) {
    g.strokeStyle = 'rgba(10,6,3,' + (0.35 + d * 0.6) + ')'; g.lineWidth = Math.max(1.5, s * 0.05); g.beginPath();
    g.moveTo(x + s * 0.5, y + s * 0.1); g.lineTo(x + s * 0.36, y + s * 0.5); g.lineTo(x + s * 0.58, y + s * 0.6);
    if (d > 0.45) { g.lineTo(x + s * 0.46, y + s * 0.9); g.moveTo(x + s * 0.36, y + s * 0.5); g.lineTo(x + s * 0.12, y + s * 0.7); }
    g.stroke();
  }
}

// The robot, built from its four equipped parts. Drawn around (0,0) at roughly 36 units tall.
function drawBot(ctx, x, y, s, face, t, ids) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s * face, s);
  const L = ids.legs, B = ids.body, A = ids.arms, H = ids.head;
  if (L === 'treads') {
    ctx.fillStyle = '#4a3f36'; rr2(ctx, -10, 6, 20, 7, 3); ctx.fill();
    ctx.fillStyle = '#8a7a6a'; [-6, 0, 6].forEach((wx, k) => { ctx.beginPath(); ctx.arc(wx, 9.5, 2 + (Math.sin(t * 18 + k) > 0 ? 0.3 : 0), 0, 7); ctx.fill(); });
  } else if (L === 'springs') {
    const b = Math.sin(t * 22) * 1.2;
    ctx.strokeStyle = '#c99a52'; ctx.lineWidth = 1.6; ctx.beginPath();
    [-5, 5].forEach(lx => { ctx.moveTo(lx, 6); ctx.lineTo(lx - 2, 8 + b / 2); ctx.lineTo(lx + 2, 10 + b / 2); ctx.lineTo(lx, 12 + b); });
    ctx.stroke(); ctx.fillStyle = '#7a5f36'; ctx.fillRect(-8, 12 + b, 6, 2); ctx.fillRect(2, 12 + b, 6, 2);
  } else {
    ctx.fillStyle = '#5e7c86'; rr2(ctx, -8, 6, 16, 4, 2); ctx.fill();
    ctx.fillStyle = '#9fe3f0'; ctx.beginPath(); ctx.moveTo(-5, 10); ctx.lineTo(5, 10); ctx.lineTo(0, 15 + Math.sin(t * 40) * 2); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#6e665e'; ctx.fillRect(-12, -1, 3, 5);
  ctx.fillStyle = B === 'tin' ? '#8f8b85' : B === 'iron' ? '#56616b' : '#3a3f4b';
  rr2(ctx, -9, -4, 18, 11, 2); ctx.fill();
  if (B === 'iron') { ctx.fillStyle = '#9aa5ad'; [[-7, -2], [7, -2], [-7, 5], [7, 5]].forEach(([a, b]) => ctx.fillRect(a - 0.6, b - 0.6, 1.2, 1.2)); }
  if (B === 'reactor') { ctx.fillStyle = 'rgba(224,138,66,' + (0.7 + Math.sin(t * 6) * 0.3) + ')'; ctx.beginPath(); ctx.arc(0, 1.5, 3, 0, 7); ctx.fill(); }
  if (B === 'tin') { ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(-9, 1, 18, 1); }
  if (A === 'pincers') {
    ctx.strokeStyle = '#aaa39a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(8, 1); ctx.lineTo(13, 1); ctx.lineTo(16, -1); ctx.moveTo(13, 1); ctx.lineTo(16, 3); ctx.stroke();
  } else if (A === 'drills') {
    ctx.fillStyle = '#6e665e'; ctx.fillRect(8, -1, 4, 4);
    ctx.fillStyle = '#d9a54a'; ctx.beginPath(); ctx.moveTo(12, -3); ctx.lineTo(19, 1); ctx.lineTo(12, 5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 0.8; const ph = (t * 30) % 2;
    ctx.beginPath(); ctx.moveTo(13 + ph, -2); ctx.lineTo(14 + ph, 4); ctx.moveTo(15.5 + ph, -0.5); ctx.lineTo(16 + ph, 2.5); ctx.stroke();
  } else {
    ctx.fillStyle = '#4a5560'; ctx.fillRect(8, -1, 7, 4);
    ctx.fillStyle = '#9fe3f0'; ctx.shadowColor = '#9fe3f0'; ctx.shadowBlur = 6; ctx.fillRect(15, -0.5, 4 + Math.sin(t * 30), 3); ctx.shadowBlur = 0;
  }
  ctx.strokeStyle = '#8a7a6a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-2, -12); ctx.lineTo(-3, -16); ctx.stroke();
  ctx.fillStyle = '#e08a42'; ctx.fillRect(-4, -17, 2, 2);
  if (H === 'bulb') {
    ctx.fillStyle = '#9a948c'; rr2(ctx, -6, -12, 12, 8, 2); ctx.fill();
    ctx.fillStyle = '#f2d27a'; ctx.beginPath(); ctx.arc(3, -8, 2, 0, 7); ctx.fill();
  } else if (H === 'dome') {
    ctx.fillStyle = '#6b8f9c'; ctx.beginPath(); ctx.arc(0, -4, 7, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#1a2a30'; ctx.fillRect(0, -8, 6, 2.5);
    ctx.fillStyle = '#9fe3f0'; ctx.fillRect(2 + Math.sin(t * 3) * 1.5, -8, 2, 2.5);
  } else {
    ctx.fillStyle = '#2d333d'; rr2(ctx, -7, -13, 14, 9, 3); ctx.fill();
    ctx.fillStyle = '#9fe3f0'; ctx.shadowColor = '#9fe3f0'; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(2, -8.5, 3, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#0e1418'; ctx.beginPath(); ctx.arc(2.6, -8.5, 1.2, 0, 7); ctx.fill();
  }
  ctx.restore();
}
function rr2(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
const partIds = () => ({ head: part('head').id, arms: part('arms').id, body: part('body').id, legs: part('legs').id });

function render(dt) {
  const s = CELL, ox = Math.round((VW - COLS * s) / 2);
  const target = P.y * s - VH * 0.55;
  cam += (target - cam) * Math.min(1, dt * 8);
  if (cam < -s * 2) cam = -s * 2;
  const shake = P.shake > 0 ? (Math.random() - 0.5) * 6 : 0;
  const sy = r => Math.round(r * s - cam + shake);
  const sx = c => ox + c * s;
  const groundY = sy(GROUND_ROW);

  // sky and side walls
  g.fillStyle = '#0b0806'; g.fillRect(0, 0, VW, VH);
  if (groundY > 0) {
    const sky = g.createLinearGradient(0, groundY - s * 4, 0, groundY);
    sky.addColorStop(0, '#1f2638'); sky.addColorStop(1, '#8a5136');
    g.fillStyle = sky; g.fillRect(0, 0, VW, groundY);
  }
  g.fillStyle = '#140e0a'; g.fillRect(0, Math.max(0, groundY), ox, VH); g.fillRect(ox + COLS * s, Math.max(0, groundY), VW, VH);

  // surface buildings: lift tower and shop
  if (groundY > 0) {
    const tx = sx(0);
    g.strokeStyle = '#6a5038'; g.lineWidth = Math.max(2, s * 0.06);
    g.beginPath(); g.moveTo(tx + s * 0.12, groundY); g.lineTo(tx + s * 0.12, sy(0.4)); g.moveTo(tx + s * 0.88, groundY); g.lineTo(tx + s * 0.88, sy(0.4));
    g.moveTo(tx + s * 0.12, sy(0.4)); g.lineTo(tx + s * 0.88, sy(0.4)); g.stroke();
    g.fillStyle = '#d9813b'; g.beginPath(); g.arc(tx + s * 0.5, sy(0.4), s * 0.12, 0, 7); g.fill();
    const hx = sx(C.SHOP_COLS[0]), hy = sy(1.1), hw = s * (C.SHOP_COLS[1] - C.SHOP_COLS[0] + 1), hh = groundY - hy;
    g.fillStyle = '#3a2b20'; g.fillRect(hx, hy, hw, hh);
    g.fillStyle = '#2a1f17'; g.beginPath(); g.moveTo(hx - s * 0.2, hy); g.lineTo(hx + hw / 2, hy - s * 0.6); g.lineTo(hx + hw + s * 0.2, hy); g.closePath(); g.fill();
    g.fillStyle = '#e8a160'; g.fillRect(hx + s * 0.3, hy + s * 0.35, s * 0.5, s * 0.4);
    g.fillStyle = '#16110d'; g.fillRect(hx + hw - s * 1, hy + hh - s * 1.1, s * 0.6, s * 1.1);
    g.fillStyle = '#efe3d3'; g.font = '700 ' + Math.round(s * 0.36) + 'px "Pixelify Sans", monospace'; g.textAlign = 'center';
    g.fillText('SHOP', hx + hw / 2 + s * 0.1, hy + s * 0.68);
  }

  // cells
  const r0 = Math.max(GROUND_ROW, Math.floor(cam / s) - 1), r1 = Math.min(ROWS - 1, r0 + Math.ceil(VH / s) + 2);
  for (let r = r0; r <= r1; r++) {
    const y = sy(r), deep = biomeAt(r).id === 'basalt';
    for (let c = 0; c < COLS; c++) {
      const x = sx(c), t = T[idx(c, r)];
      if (!t) {
        g.fillStyle = deep ? '#121014' : '#1c140e'; g.fillRect(x, y, s, s);
        if (inLift(c, r)) drawShaft(x, y, s, r);
        continue;
      }
      const w = wobble.get(idx(c, r));
      drawBlock(t, c, r, x + (w ? Math.sin(time * 60) * s * 0.06 : 0), y, s);
    }
    if (r === GROUND_ROW) for (let c = 0; c < COLS; c++) if (T[idx(c, r)] && T[idx(c, r)] !== 'plat' && T[idx(c, r)] !== 'found') { g.fillStyle = '#5f7a3c'; g.fillRect(sx(c), y, s, Math.max(2, s * 0.12)); }
  }

  // the next lift extension: dashed outline of cells that must be dug out
  const nextBlocked = liftBlockedRows();
  if (nextBlocked.length) {
    g.setLineDash([4, 4]); g.strokeStyle = 'rgba(217,129,59,.55)'; g.lineWidth = 1.5;
    nextBlocked.forEach(r => g.strokeRect(sx(0) + 3, sy(r) + 3, s - 6, s - 6));
    g.setLineDash([]);
  }

  // falling rocks
  rocks.forEach(k => drawBlock('loose', k.c, Math.floor(k.y), sx(k.c), sy(k.y), s));

  // robot
  const px = ox + P.x * s, py = sy(P.y);
  if (P.inLift) { g.fillStyle = '#d9813b'; g.fillRect(sx(0) + s * 0.1, py + HH * s, s * 0.8, s * 0.08); } // the lift car
  let nudge = 0;
  if (P.digging) nudge = Math.sin(time * 40) * s * 0.04;
  const dx = P.digging ? (P.digging.c - pCol()) * nudge : 0, dyy = P.digging ? (P.digging.r - pRow()) * nudge : 0;
  drawBot(g, px + dx, py + dyy + s * 0.02, s / 36, P.face, time, partIds());

  // particles
  particles.forEach(p => { g.globalAlpha = Math.max(0, p.life * 1.8); g.fillStyle = p.col; const q = Math.max(2, s * 0.07); g.fillRect(sx(p.x) - q / 2, sy(p.y) - q / 2, q, q); });
  g.globalAlpha = 1;

  // darkness: light radius around the robot, only below ground
  if (groundY < VH) {
    g.save(); g.beginPath(); g.rect(0, Math.max(0, groundY), VW, VH); g.clip();
    const R = lightRadius() * s;
    const fog = g.createRadialGradient(px, py, R * 0.5, px, py, R * 1.1);
    fog.addColorStop(0, 'rgba(8,5,3,0)'); fog.addColorStop(1, 'rgba(8,5,3,.94)');
    g.fillStyle = fog; g.fillRect(0, 0, VW, VH);
    // loose rock stays outlined in the dark so you can plan around it
    g.strokeStyle = 'rgba(205,184,156,.35)'; g.lineWidth = 1;
    for (let r = r0; r <= r1; r++) for (let c = 0; c < COLS; c++) {
      if (T[idx(c, r)] !== 'loose') continue;
      if (Math.hypot(c + 0.5 - P.x, r + 0.5 - P.y) > lightRadius() + 4) continue;
      g.beginPath(); g.arc(sx(c) + s / 2, sy(r) + s / 2, s * 0.36, 0, 7); g.stroke();
    }
    // an unseen fossil glows faintly when you are close
    for (let r = r0; r <= r1; r++) for (let c = 0; c < COLS; c++) {
      if (T[idx(c, r)] !== 'fossil' || SEEN[idx(c, r)]) continue;
      if (Math.hypot(c + 0.5 - P.x, r + 0.5 - P.y) > lightRadius() + 2.5) continue;
      g.fillStyle = 'rgba(234,223,196,' + (0.12 + Math.sin(time * 3) * 0.08) + ')';
      g.beginPath(); g.arc(sx(c) + s / 2, sy(r) + s / 2, s * 0.45, 0, 7); g.fill();
    }
    g.restore();
  }

  // floating text
  g.textAlign = 'center'; g.font = '600 ' + Math.max(11, Math.round(s * 0.28)) + 'px "IBM Plex Mono", monospace';
  floats.forEach(f => { g.globalAlpha = Math.min(1, f.life * 1.5); g.fillStyle = f.col; g.fillText(f.text, sx(f.x), sy(f.y)); });
  g.globalAlpha = 1;
}
function drawShaft(x, y, s, r) {
  g.fillStyle = '#0f0b09'; g.fillRect(x, y, s, s);
  g.strokeStyle = '#5a4632'; g.lineWidth = Math.max(2, s * 0.06);
  g.beginPath(); g.moveTo(x + s * 0.14, y); g.lineTo(x + s * 0.14, y + s); g.moveTo(x + s * 0.86, y); g.lineTo(x + s * 0.86, y + s);
  g.moveTo(x + s * 0.14, y + s * 0.5); g.lineTo(x + s * 0.86, y + s * 0.5); g.stroke();
  g.strokeStyle = '#2e241b'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + s * 0.5, y); g.lineTo(x + s * 0.5, y + s); g.stroke();
  if (r === S.liftRow) {
    g.fillStyle = '#3a2b20'; g.fillRect(x + 2, y + s * 0.82, s - 4, s * 0.18);
    g.fillStyle = '#d9813b';
    g.beginPath(); g.moveTo(x + s * 0.55, y + s * 0.2); g.lineTo(x + s * 0.38, y + s * 0.5); g.lineTo(x + s * 0.52, y + s * 0.5); g.lineTo(x + s * 0.44, y + s * 0.76); g.lineTo(x + s * 0.64, y + s * 0.42); g.lineTo(x + s * 0.5, y + s * 0.42); g.closePath(); g.fill();
  }
}

function renderPet() {
  const cols = C.PET.cols, rows = C.PET.rows;
  const s = Math.max(6, Math.floor(Math.min(PW / cols, PH / (rows + 1))));
  const ox = Math.round((PW - cols * s) / 2), oy = Math.round((PH - (rows + 1) * s) / 2);
  pg.fillStyle = '#0b0806'; pg.fillRect(0, 0, PW, PH);
  const sky = pg.createLinearGradient(0, oy, 0, oy + s); sky.addColorStop(0, '#1f2638'); sky.addColorStop(1, '#6a4330');
  pg.fillStyle = sky; pg.fillRect(ox, oy, cols * s, s);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = ox + c * s, y = oy + (r + 1) * s, t = PET.grid[r * cols + c];
    if (!t) { pg.fillStyle = '#1c140e'; pg.fillRect(x, y, s, s); continue; }
    pg.fillStyle = r > 2 ? '#86563a' : '#6b4a32'; pg.fillRect(x, y, s, s);
    pg.fillStyle = 'rgba(0,0,0,.25)'; pg.fillRect(x, y + s - 2, s, 2); pg.fillRect(x + s - 2, y, 2, s);
    if (t === 'ore') { pg.fillStyle = '#e08a42'; const q = Math.max(2, s * 0.14); for (let k = 0; k < 3; k++) pg.fillRect(x + s * 0.2 + hash(c, r, k) * s * 0.5, y + s * 0.2 + hash(r, c, k) * s * 0.5, q, q); }
    if (r === 0) { pg.fillStyle = '#5f7a3c'; pg.fillRect(x, y, s, Math.max(2, s * 0.12)); }
  }
  if (!S.pet) {
    pg.fillStyle = 'rgba(11,8,6,.72)'; pg.fillRect(0, 0, PW, PH);
    pg.fillStyle = '#a8937c'; pg.textAlign = 'center'; pg.font = '500 16px "Pixelify Sans", monospace';
    pg.fillText('Empty burrow', PW / 2, PH / 2 - 4);
    pg.font = '400 11px "IBM Plex Mono", monospace';
    pg.fillText('Find the fossil hidden ' + (C.PET.fossilRows[0] - SURFACE_ROW) + '–' + (C.PET.fossilRows[1] - SURFACE_ROW) + ' m down', PW / 2, PH / 2 + 14);
    return;
  }
  // Pip the mole, digging the block under him
  const k = Math.min(1, PET.prog / petDigTime());
  const mx = ox + (PET.c + 0.5) * s, my = oy + (PET.r + 0.5) * s + Math.sin(time * 14) * s * 0.04;
  pg.save(); pg.translate(mx, my);
  pg.fillStyle = '#5a463a'; pg.beginPath(); pg.ellipse(0, 0, s * 0.34, s * 0.4, 0, 0, 7); pg.fill();
  pg.fillStyle = '#e9a0a0'; pg.beginPath(); pg.arc(0, s * 0.38, s * 0.08, 0, 7); pg.fill();
  pg.fillStyle = '#d9c7b0'; const claw = Math.sin(time * 24) * s * 0.06;
  pg.fillRect(-s * 0.32, s * 0.24 + claw, s * 0.14, s * 0.1); pg.fillRect(s * 0.18, s * 0.24 - claw, s * 0.14, s * 0.1);
  pg.fillStyle = '#16110d'; pg.fillRect(-s * 0.12, s * 0.12, s * 0.05, s * 0.05); pg.fillRect(s * 0.07, s * 0.12, s * 0.05, s * 0.05);
  pg.restore();
  // dig progress crack on the target block
  const tx = ox + PET.c * s, ty = oy + (PET.r + 1) * s;
  pg.strokeStyle = 'rgba(10,6,3,' + (0.2 + k * 0.7) + ')'; pg.lineWidth = 1.5; pg.beginPath();
  pg.moveTo(tx + s * 0.5, ty + s * 0.1); pg.lineTo(tx + s * 0.38, ty + s * 0.5 * (0.4 + k)); pg.stroke();
  pg.textAlign = 'center'; pg.font = '600 11px "IBM Plex Mono", monospace';
  petFloats.forEach(f => { pg.globalAlpha = Math.min(1, f.life * 1.5); pg.fillStyle = f.ore ? '#e8a160' : '#efe3d3'; pg.fillText(f.text, ox + f.c * s, oy + (f.r + 1 - (1 - f.life) * 0.8) * s); });
  pg.globalAlpha = 1;
}

// ================= Lift =================
const liftCost = () => Math.round(C.LIFT.baseCost * Math.pow(C.LIFT.costGrowth, S.liftExt));
const liftMaxed = () => S.liftRow + C.LIFT.step > ROWS - 2;
function liftBlockedRows() {
  if (liftMaxed()) return [];
  const out = [];
  for (let r = S.liftRow + 1; r <= S.liftRow + C.LIFT.step; r++) if (T[idx(0, r)] && T[idx(0, r)] !== 'plat') out.push(r); // platforms don't count
  return out;
}

// ================= UI =================
const SLOTS = ['head', 'arms', 'body', 'legs'];
$('parts').innerHTML = SLOTS.map(s => `
  <div class="row">
    <div><small>${C.PARTS[s].label} · ${C.PARTS[s].stat}</small><strong id="cur-${s}"></strong><span id="stat-${s}"></span></div>
    <button id="up-${s}" data-slot="${s}" type="button"></button>
  </div>`).join('');

$('parts').addEventListener('click', e => {
  const s = e.target.closest('button')?.dataset.slot; if (!s || !atSurface()) return;
  const next = C.PARTS[s].tiers[S.tiers[s] + 1]; if (!next || S.coins < next.cost) return;
  S.coins -= next.cost; S.tiers[s]++;
  if (s === 'body') P.battery = batteryMax();
  toast(null, next.name + ' installed.'); save(); updateUI();
});
$('extend').addEventListener('click', () => {
  if (!(atSurface() || atDock()) || liftMaxed() || liftBlockedRows().length || S.coins < liftCost()) return;
  S.coins -= liftCost(); S.liftExt++;
  for (let r = S.liftRow + 1; r <= S.liftRow + C.LIFT.step; r++) T[idx(0, r)] = null; // the lift clears any platforms in its way
  S.liftRow += C.LIFT.step;
  toast(null, 'Lift extended to ' + depthOf(S.liftRow) + ' m.'); save(); updateUI();
});
$('train').addEventListener('click', () => {
  if (!atSurface() || !S.pet || S.pet >= C.PET.maxLevel || S.coins < trainCost()) return;
  S.coins -= trainCost(); S.pet++;
  toast(null, C.PET.name + ' is now level ' + S.pet + '.'); save(); updateUI();
});
let armed = 0;
$('reset').addEventListener('click', () => {
  const b = $('reset');
  if (!armed) { b.textContent = 'Click again to reset'; b.classList.add('armed'); armed = setTimeout(() => { armed = 0; b.textContent = 'Reset progress'; b.classList.remove('armed'); }, 3000); return; }
  clearTimeout(armed); armed = 0; b.textContent = 'Reset progress'; b.classList.remove('armed');
  S = freshState(); genWorld(); regenPet(); placePlayerFromSave(); P.plats = C.PLATFORMS.carry;
  rocks = []; wobble.clear(); lastBiome = null; lastCell = -1; markSeen(); save(); updateUI();
  toast('New dig', 'Head down and find some ore. Sell it at the surface or the lift dock.');
});

function updateUI() {
  const shop = atSurface(), dock = atDock();
  $('depth').textContent = depthOf(pRow()) + ' m';
  $('biome').textContent = pRow() < GROUND_ROW ? 'Surface' : biomeAt(pRow()).name;
  $('coins').textContent = fmt(S.coins);
  const bm = batteryMax(), bp = Math.max(0, P.battery / bm);
  $('batBar').style.width = (bp * 100) + '%';
  $('batBar').parentElement.classList.toggle('low', bp < 0.25);
  $('batTxt').textContent = Math.ceil(Math.max(0, P.battery));
  $('cargoBar').style.width = (S.cargo.n / cargoMax() * 100) + '%';
  $('cargoTxt').textContent = S.cargo.n + '/' + cargoMax();
  $('platCount').textContent = P.plats;

  const chip = $('shopState');
  chip.textContent = shop ? 'Shop open' : dock ? 'At the dock · lift extensions only' : 'Shop opens at the surface';
  chip.classList.toggle('open', shop || dock);
  const rc = $('recall'); rc.hidden = shop; if (!recallArmed) rc.textContent = 'Recall';
  SLOTS.forEach(s => {
    const cur = part(s), next = C.PARTS[s].tiers[S.tiers[s] + 1], btn = $('up-' + s);
    $('cur-' + s).textContent = cur.name;
    $('stat-' + s).textContent = C.PARTS[s].fmt(cur.val);
    if (!next) { btn.textContent = 'Maxed'; btn.disabled = true; }
    else { btn.textContent = next.name + ' · ' + fmt(next.cost); btn.disabled = !shop || S.coins < next.cost; }
  });

  $('liftDepth').textContent = 'Reaches ' + depthOf(S.liftRow) + ' m';
  const blocked = liftBlockedRows();
  const ext = $('extend');
  if (liftMaxed()) { ext.textContent = 'Max depth'; ext.disabled = true; $('liftNote').textContent = 'The lift reaches as deep as it can go.'; }
  else {
    ext.textContent = 'Extend ' + C.LIFT.step + ' m · ' + fmt(liftCost());
    ext.disabled = !(shop || dock) || blocked.length > 0 || S.coins < liftCost();
    $('liftNote').textContent = blocked.length
      ? 'Dig out the far-left column to ' + depthOf(S.liftRow + C.LIFT.step) + ' m first (' + blocked.length + ' blocks left).'
      : 'The shaft is clear. Buy the extension here or at the dock.';
  }

  if (S.pet) {
    $('petTag').textContent = C.PET.name + ' · level ' + S.pet;
    $('petTag').classList.add('open');
    $('petInfo').innerHTML = '<b>' + C.PET.name + ' the ' + C.PET.species + '.</b> ' + C.PET.pattern + ' Earns about ' + fmt(petRate() * 60) + ' coins a minute, even while you are away. Gives you +' + Math.round(C.PET.digBonusPerLevel * S.pet * 100) + '% dig power.';
    const tb = $('train'); tb.hidden = false;
    if (S.pet >= C.PET.maxLevel) { tb.textContent = 'Max level'; tb.disabled = true; }
    else { tb.textContent = 'Train · ' + fmt(trainCost()); tb.disabled = !shop || S.coins < trainCost(); }
  }
}

// Recall: tap once to arm, again within 3 seconds to confirm.
let recallArmed = 0;
$('recall').addEventListener('click', () => {
  const b = $('recall');
  if (atSurface()) return;
  if (!recallArmed) { b.textContent = 'Tap again · keep ' + Math.round(C.RECALL.keepCargo * 100) + '% ore'; b.classList.add('armed'); recallArmed = setTimeout(() => { recallArmed = 0; b.textContent = 'Recall'; b.classList.remove('armed'); }, 3000); return; }
  clearTimeout(recallArmed); recallArmed = 0; b.textContent = 'Recall'; b.classList.remove('armed');
  recall('manual');
});

let toastTimer;
const hinted = new Set();
function toast(title, msg) {
  const t = $('toast');
  t.innerHTML = (title ? '<b>' + title + '</b>' : '') + msg;
  t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), title ? 4200 : 2600);
}
function hintOnce(key, title, msg) { if (hinted.has(key)) return; hinted.add(key); toast(title, msg); }

// ================= Input =================
const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowDown: 'down', KeyS: 'down', ArrowUp: 'up', KeyW: 'up' };
const held = [];
let swipeH = null, swipeV = null;
// Horizontal and vertical input are tracked separately so you can jump while moving.
const lastOf = (a, b) => { for (let i = held.length - 1; i >= 0; i--) if (held[i] === a || held[i] === b) return held[i]; return null; };
const horizDir = () => swipeH || lastOf('left', 'right');
const vertDir = () => swipeV || lastOf('up', 'down');
addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('button') && e.code === 'Space') return;
  const d = KEYMAP[e.code];
  if (d) { e.preventDefault(); if (!held.includes(d)) held.push(d); }
  if (e.code === 'Space' || e.code === 'KeyB') { e.preventDefault(); if (!e.repeat) P.wantBuild = true; }
});
addEventListener('keyup', e => { const d = KEYMAP[e.code]; if (d) { const i = held.indexOf(d); if (i >= 0) held.splice(i, 1); } });
addEventListener('blur', () => { held.length = 0; swipeH = swipeV = null; });

// Swipe: drag and hold to move or dig; drag diagonally to jump sideways; a quick tap drops a platform.
let touch = null;
cv.addEventListener('pointerdown', e => { touch = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId, type: e.pointerType }; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', e => {
  if (!touch || e.pointerId !== touch.id) return;
  const dx = e.clientX - touch.x, dy = e.clientY - touch.y, ax = Math.abs(dx), ay = Math.abs(dy);
  if (Math.hypot(dx, dy) < 22) return;
  swipeH = ax > ay * 0.5 ? (dx > 0 ? 'right' : 'left') : null;
  swipeV = ay > ax * 0.5 ? (dy > 0 ? 'down' : 'up') : null;
  touch.moved = true; touch.x = e.clientX; touch.y = e.clientY;
});
const endTouch = e => {
  if (!touch || e.pointerId !== touch.id) return;
  if (!touch.moved && touch.type !== 'mouse') P.wantBuild = true;
  touch = null; swipeH = swipeV = null;
};
cv.addEventListener('pointerup', endTouch);
cv.addEventListener('pointercancel', () => { touch = null; swipeH = swipeV = null; });
$('build').addEventListener('click', () => { P.wantBuild = true; });

// ================= Main loop =================
let prev = performance.now(), uiT = 0, saveT = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - prev) / 1000); prev = now; time += dt;
  sellAndCharge(dt);
  updatePlayer(dt);
  updateRocks(dt);
  updatePet(dt);
  if (P.shake > 0) P.shake -= dt;
  particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 9 * dt; p.life -= dt; });
  particles = particles.filter(p => p.life > 0);
  floats.forEach(f => { f.y -= 0.8 * dt; f.life -= dt; }); floats = floats.filter(f => f.life > 0);
  petFloats.forEach(f => (f.life -= dt)); for (let i = petFloats.length - 1; i >= 0; i--) if (petFloats[i].life <= 0) petFloats.splice(i, 1);
  render(dt);
  renderPet();
  uiT += dt; if (uiT > 0.15) { uiT = 0; updateUI(); }
  saveT += dt; if (saveT > 5) { saveT = 0; save(); }
  requestAnimationFrame(frame);
}

// ================= Start =================
loadWorld();
placePlayerFromSave();
regenPet();
markSeen();
lastBiome = pRow() >= GROUND_ROW ? biomeAt(pRow()).id : null;
resize();
cam = P.y * CELL - VH * 0.55;

if (isNewGame) {
  setTimeout(() => toast('Bolt & Burrow', 'Dig down for ore. Sell it at the surface or the lift dock, then upgrade your robot.'), 300);
} else if (S.pet) {
  const away = Math.min((Date.now() - S.last) / 1000, C.PET.offlineCapHours * 3600);
  const gain = Math.floor(away * petRate());
  if (away > 30 && gain > 0) { S.coins += gain; setTimeout(() => toast('Welcome back', C.PET.name + ' dug up ' + fmt(gain) + ' coins while you were away.'), 300); }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
updateUI();
requestAnimationFrame(frame);
})();
