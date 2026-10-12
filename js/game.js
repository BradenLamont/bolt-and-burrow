// Bolt & Burrow v0.4 — game logic (top-down cave).
// Sections: state & saving · conveyor & outposts · world · player · hazards · pet · drawing · UI · input · main loop
(() => {
'use strict';
const C = CONFIG;
const { COLS, ROWS, BASE_ROWS } = C;
const BELT = C.CONVEYOR.col;
const SAVE_KEY = 'bolt-burrow-v4'; // v0.4 changed the world shape, so older saves start fresh
const $ = id => document.getElementById(id);

// ================= State & saving =================
const CODE = { d: 'dirt', c: 'clay', b: 'basalt', l: 'loose', r: 'rubble', o: 'copper', s: 'silver', g: 'gold', k: 'crystal', f: 'fossil', n: 'found', t: 'post', x: 'bedrock' };
const CHAR = Object.fromEntries(Object.entries(CODE).map(([k, v]) => [v, k]));
const ORES = new Set(['copper', 'silver', 'gold', 'crystal']);

const freshState = () => ({
  coins: 0,
  tiers: { head: 0, arms: 0, body: 0, legs: 0 },
  outposts: 0,                          // how many outposts the conveyor reaches
  pet: 0,                               // pet level (0 = not hatched)
  cargo: { n: 0, value: 0 },
  best: 0, biomesSeen: [], last: Date.now(),
  world: null, seen: null, pos: null,
});

let S = freshState();
let T = [];
let DMG = new Float32Array(COLS * ROWS);
let SEEN = new Uint8Array(COLS * ROWS);
let isNewGame = true;
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) { S = Object.assign(freshState(), JSON.parse(raw)); isNewGame = false; }
} catch (e) { /* storage unavailable: play without saving */ }

function save() {
  S.last = Date.now();
  S.world = T.map(t => (t ? CHAR[t] : '.')).join('');
  S.seen = SEEN.join('');
  S.pos = { x: P.x, y: P.y, battery: P.battery };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {}
}

// ================= Helpers =================
const idx = (c, r) => r * COLS + c;
const inBounds = (c, r) => c >= 0 && c < COLS && r >= 0 && r < ROWS;
const at = (c, r) => (inBounds(c, r) ? T[idx(c, r)] : 'bedrock');
const solidAt = (c, r) => !!at(c, r);
const biomeAt = r => C.BIOMES.find(b => r >= b.from && r <= b.to) || C.BIOMES[C.BIOMES.length - 1];
const part = slot => C.PARTS[slot].tiers[S.tiers[slot]];
const lightRadius = () => part('head').val.light;
const rockScan = () => part('head').val.scan;
const digPower = () => part('arms').val * (1 + C.PET.digBonusPerLevel * S.pet);
const batteryMax = () => part('body').val.battery;
const cargoMax = () => part('body').val.cargo;
const legs = () => part('legs').val;
const depthOf = r => Math.max(0, r - BASE_ROWS + 1);
function hash(a, b, c) { let h = (a * 374761393 + b * 668265263 + c * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function fmt(n) {
  n = Math.floor(n);
  if (n < 10000) return n.toLocaleString('en-CA');
  const u = ['K', 'M', 'B']; let i = -1;
  while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return n.toFixed(n < 100 ? 1 : 0) + u[i];
}

// ================= Conveyor & outposts =================
// Outpost k (1, 2, 3…) sits on the conveyor at depth 25k. The conveyor runs from the yard to the last outpost.
const outpostRow = k => BASE_ROWS - 1 + C.CONVEYOR.step * k;
const beltEnd = () => outpostRow(S.outposts);
const onBelt = (c, r) => c === BELT && r >= 0 && r <= beltEnd();
function outpostAt(c, r) {
  for (let k = 1; k <= S.outposts; k++) { const row = outpostRow(k); if (Math.abs(c - BELT) <= 1 && Math.abs(r - row) <= 1) return k; }
  return 0;
}
const extendCost = () => Math.round(C.CONVEYOR.baseCost * Math.pow(C.CONVEYOR.costGrowth, S.outposts));
const extendMaxed = () => outpostRow(S.outposts + 1) + 2 >= ROWS - 1;
function beltBlocked() {
  if (extendMaxed()) return [];
  const out = [];
  for (let r = beltEnd() + 1; r <= outpostRow(S.outposts + 1); r++) if (solidAt(BELT, r)) out.push(r);
  return out;
}
function buildOutpost(k) {
  const row = outpostRow(k);
  for (let r = row - 1; r <= row + 1; r++) for (let c = BELT - 1; c <= BELT + 1; c++) { T[idx(c, r)] = null; DMG[idx(c, r)] = 0; SEEN[idx(c, r)] = 1; }
  T[idx(BELT + 2, row)] = 'post';
  T[idx(BELT + 2, row - 1)] = 'post';
}

// ================= World =================
function genWorld() {
  T = new Array(COLS * ROWS).fill(null);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const i = idx(c, r);
    if (c === 0 || c === COLS - 1 || r === ROWS - 1) { T[i] = 'bedrock'; continue; }
    if (r < BASE_ROWS) continue; // the yard
    const x = Math.random();
    if (biomeAt(r).id === 'topsoil') {
      let t = hash(c, r, 7) < Math.min(0.75, (r - BASE_ROWS) / 55) ? 'clay' : 'dirt';
      if (x < 0.06) t = 'copper';
      else if (r > 18 && x < 0.085) t = 'silver';
      T[i] = t;
    } else {
      const crystal = r > 95 ? 0.025 : 0.012;
      let t = 'basalt';
      if (x < 0.05) t = null;                                    // small caves
      else if (x < 0.05 + C.ROCK.chance) t = 'loose';
      else if (x < 0.10 + C.ROCK.chance) t = 'gold';
      else if (x < 0.10 + C.ROCK.chance + crystal) t = 'crystal';
      else if (x < 0.13 + C.ROCK.chance + crystal) t = 'copper';
      T[i] = t;
    }
  }
  const B = C.BASE_BUILDING;
  for (let r = B.rows[0]; r <= B.rows[1]; r++) for (let c = B.cols[0]; c <= B.cols[1]; c++) T[idx(c, r)] = 'found';
  if (!S.pet) {
    const [a, b] = C.PET.fossilRows;
    let c; do { c = 1 + Math.floor(Math.random() * (COLS - 2)); } while (c === BELT);
    T[idx(c, a + Math.floor(Math.random() * (b - a)))] = 'fossil';
  }
  for (let k = 1; k <= S.outposts; k++) buildOutpost(k);
  SEEN = new Uint8Array(COLS * ROWS);
}
function loadWorld() {
  if (S.world && S.world.length === COLS * ROWS) {
    T = Array.from(S.world, ch => (ch === '.' ? null : CODE[ch] || null));
    SEEN = S.seen && S.seen.length === COLS * ROWS ? Uint8Array.from(S.seen, ch => (ch === '1' ? 1 : 0)) : new Uint8Array(COLS * ROWS);
  } else genWorld();
}
// What an ore block looks like before you've lit it up: the plain rock around it.
function baseFor(c, r) {
  if (biomeAt(r).id === 'basalt') return 'basalt';
  return hash(c, r, 7) < Math.min(0.75, (r - BASE_ROWS) / 55) ? 'clay' : 'dirt';
}

// ================= Player =================
// The robot moves freely in 8 directions. P.x, P.y is the centre of its hitbox, in blocks.
const HB = C.BODY / 2, EPS = 1e-4;
const P = { x: C.SPAWN.col + 0.5, y: C.SPAWN.row + 0.5, battery: 0, face: 1, dir: 'down', digging: null, shake: 0, riding: false };
const pCol = () => Math.floor(P.x);
const pRow = () => Math.floor(P.y);

function boxSolid(x, y) {
  for (let r = Math.floor(y - HB); r <= Math.floor(y + HB - EPS); r++)
    for (let c = Math.floor(x - HB); c <= Math.floor(x + HB - EPS); c++)
      if (solidAt(c, r)) return true;
  return false;
}
function placePlayerFromSave() {
  const p = S.pos;
  if (p && typeof p.x === 'number' && !boxSolid(p.x, p.y)) { P.x = p.x; P.y = p.y; P.battery = Math.min(p.battery, batteryMax()); }
  else { P.x = C.SPAWN.col + 0.5; P.y = C.SPAWN.row + 0.5; P.battery = batteryMax(); }
}

// Where is the robot standing? 'base' (the yard), 'outpost', or null.
function station() {
  if (pRow() < BASE_ROWS) return 'base';
  if (outpostAt(pCol(), pRow())) return 'outpost';
  return null;
}

// Returns true if the battery ran out (the robot gets recalled to base).
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
    msg = n ? 'A recovery drone hauled you back to base. Your ' + n + ' ore was lost.' : 'A recovery drone hauled you back to base.';
  } else {
    const keep = Math.floor(n * C.RECALL.keepCargo);
    S.cargo = { n: keep, value: n ? Math.floor(S.cargo.value * keep / n) : 0 };
    msg = n ? 'The drone dropped ' + (n - keep) + ' ore on the way. You kept ' + keep + '.' : 'A drone carried you back to base.';
  }
  P.x = C.SPAWN.col + 0.5; P.y = C.SPAWN.row + 0.5; P.battery = batteryMax(); P.digging = null;
  toast(kind === 'dead' ? 'Battery dead' : 'Recalled', msg);
}

function sellAndCharge(dt) {
  const here = station();
  if (!here) return;
  if (S.cargo.n > 0) {
    const { n, value } = S.cargo;
    S.coins += value; S.cargo = { n: 0, value: 0 };
    floatText(P.x, P.y - 0.6, '+' + fmt(value), '#e8a160');
    toast(null, 'Sold ' + n + ' ore for ' + fmt(value) + ' coins' + (here === 'outpost' ? ' at the outpost. The conveyor carries it up.' : ' at base.'));
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
      const v = Math.round(B.value * (1 + (r - BASE_ROWS) / C.ORE_DEPTH_BONUS));
      S.cargo.n++; S.cargo.value += v;
      floatText(c + 0.5, r + 0.3, '+' + B.label, B.ore);
    } else floatText(c + 0.5, r + 0.3, 'Cargo full', '#e2705a');
  }
  if (t === 'fossil') {
    S.pet = 1; regenPet();
    toast('A fossil!', C.PET.name + ' the ' + C.PET.species + ' hatched and moved into your burrow.');
  }
}
function dig(c, r, dt) {
  const t = at(c, r);
  if (!t) return;
  if (C.BLOCKS[t].hp === Infinity) {
    if (t === 'bedrock') hintOnce('bedrock', null, 'Bedrock. You can\'t dig through the cave walls.');
    else hintOnce('build', null, 'Buildings can\'t be dug.');
    return;
  }
  const i = idx(c, r);
  DMG[i] += digPower() * C.DIG_RATE * dt;
  P.digging = { c, r };
  if (Math.random() < dt * 18) burst(c + 0.5, r + 0.5, C.BLOCKS[t].color || C.BLOCKS[baseFor(c, r)].color, 1);
  if (DMG[i] >= C.BLOCKS[t].hp) { breakBlock(c, r); drain(C.BATTERY.dig); }
}

// Move along one axis; returns true if a block stopped the move.
function moveAxis(dx, dy) {
  const nx = P.x + dx, ny = P.y + dy;
  if (!boxSolid(nx, ny)) { P.x = nx; P.y = ny; return false; }
  if (dx > 0) P.x = Math.floor(nx + HB) - HB - EPS;
  else if (dx < 0) P.x = Math.floor(nx - HB) + 1 + HB + EPS;
  else if (dy > 0) P.y = Math.floor(ny + HB) - HB - EPS;
  else if (dy < 0) P.y = Math.floor(ny - HB) + 1 + HB + EPS;
  return true;
}
// Slide toward the middle of the current row or column so you line up with 1-block tunnels.
function align(axis, dt) {
  const target = Math.floor(P[axis]) + 0.5, d = target - P[axis], step = C.ALIGN_SPEED * dt;
  const nv = P[axis] + (Math.abs(d) < step ? d : Math.sign(d) * step);
  if (!(axis === 'x' ? boxSolid(nv, P.y) : boxSolid(P.x, nv))) P[axis] = nv;
}

function updatePlayer(dt) {
  P.digging = null;
  const h = horizDir(), v = vertDir();
  const dx = h === 'left' ? -1 : h === 'right' ? 1 : 0;
  const dy = v === 'up' ? -1 : v === 'down' ? 1 : 0;
  if (dx) P.face = dx;
  if (dx && !dy) P.dir = h; else if (dy && !dx) P.dir = v;

  // Riding the conveyor: stand on the belt and move along it with no battery cost
  P.riding = onBelt(pCol(), pRow()) && !dx && dy !== 0 && Math.abs(P.x - (BELT + 0.5)) < 0.3;
  if (P.riding) {
    align('x', dt);
    const ny = P.y + dy * C.CONVEYOR.speed * dt;
    if (ny >= 0.5 && ny <= beltEnd() + 0.5 && !boxSolid(P.x, ny)) { P.y = ny; finishMove(); return; }
    P.riding = false; // reached an end of the belt; carry on walking
  }
  if (!dx && !dy) { finishMove(); return; }

  const sp = legs().speed;
  const len = Math.hypot(dx, dy), vx = dx / len * sp, vy = dy / len * sp;
  // Line up with the lane you're moving along, so 1-wide tunnels are easy to enter
  if (dx && !dy) align('y', dt);
  if (dy && !dx) align('x', dt);

  const x0 = P.x, y0 = P.y;
  let hitX = false, hitY = false;
  const steps = 3;
  for (let k = 0; k < steps; k++) {
    if (vx) hitX = moveAxis(vx * dt / steps, 0) || hitX;
    if (vy) hitY = moveAxis(0, vy * dt / steps) || hitY;
  }
  const moved = Math.hypot(P.x - x0, P.y - y0);
  if (moved && drain(moved * C.BATTERY.move * legs().eff)) return;

  // Dig the block you're pushing against
  if (hitX && !dy) dig(pCol() + dx, pRow(), dt);
  else if (hitY && !dx) dig(pCol(), pRow() + dy, dt);
  else if (hitX && hitY) { // pushing into a corner: dig the side you were last facing
    if (P.dir === 'left' || P.dir === 'right') dig(pCol() + dx, pRow(), dt); else dig(pCol(), pRow() + dy, dt);
  }
  finishMove();
}

let lastBiome = null, lastCell = -1;
function finishMove() {
  const cell = idx(pCol(), pRow());
  if (cell === lastCell) return;
  lastCell = cell;
  markSeen();
  S.best = Math.max(S.best, depthOf(pRow()));
  if (pRow() >= BASE_ROWS) {
    const b = biomeAt(pRow());
    if (b.id !== lastBiome && !S.biomesSeen.includes(b.id)) { S.biomesSeen.push(b.id); toast(b.name, b.note); }
    lastBiome = b.id;
  }
}
function markSeen() {
  const R = lightRadius();
  for (let r = Math.max(0, Math.floor(P.y - R - 1)); r <= Math.min(ROWS - 1, Math.ceil(P.y + R)); r++)
    for (let c = Math.max(0, Math.floor(P.x - R - 1)); c <= Math.min(COLS - 1, Math.ceil(P.x + R)); c++)
      if (Math.hypot(c + 0.5 - P.x, r + 0.5 - P.y) <= R) SEEN[idx(c, r)] = 1;
}

// ================= Hazard: unstable rock =================
// Unstable rock caves in once enough of its sides are dug open: it shakes, then collapses,
// scattering rubble into nearby open cells and hurting the robot if it's close.
const wobble = new Map();
function exposed(c, r) {
  let n = 0;
  for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!at(c + a, r + b)) n++;
  return n;
}
function updateRocks(dt) {
  const r0 = Math.max(BASE_ROWS, pRow() - 12), r1 = Math.min(ROWS - 2, pRow() + 12);
  for (let r = r0; r <= r1; r++) for (let c = 1; c < COLS - 1; c++) {
    const i = idx(c, r);
    if (T[i] !== 'loose') { wobble.delete(i); continue; }
    if (exposed(c, r) >= C.ROCK.exposedSides) {
      const w = (wobble.get(i) || 0) + dt;
      if (w >= C.ROCK.wobble) { wobble.delete(i); caveIn(c, r); } else wobble.set(i, w);
    } else wobble.delete(i);
  }
}
function caveIn(c, r) {
  T[idx(c, r)] = null; DMG[idx(c, r)] = 0;
  burst(c + 0.5, r + 0.5, C.BLOCKS.loose.color, 18);
  const spots = [];
  for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
    const cc = c + a, rr = r + b;
    if ((a || b) && inBounds(cc, rr) && !at(cc, rr) && !onBelt(cc, rr) && !outpostAt(cc, rr)) spots.push([cc, rr]);
  }
  for (let k = 0; k < C.ROCK.rubble && spots.length; k++) {
    const [cc, rr] = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
    if (Math.abs(cc + 0.5 - P.x) < 0.5 + HB && Math.abs(rr + 0.5 - P.y) < 0.5 + HB) continue; // never bury the robot
    T[idx(cc, rr)] = 'rubble';
  }
  P.shake = 0.35;
  if (Math.hypot(c + 0.5 - P.x, r + 0.5 - P.y) < C.ROCK.hitRadius) {
    const lost = S.cargo.n - Math.floor(S.cargo.n * (1 - C.ROCK.cargoLoss));
    S.cargo.n -= lost; S.cargo.value = Math.floor(S.cargo.value * (1 - C.ROCK.cargoLoss));
    toast('Cave-in!', 'Lost ' + Math.round(C.ROCK.batteryLoss * 100) + '% battery' + (lost ? ' and ' + lost + ' ore' : '') + '. Watch for shaking rock.');
    drain(batteryMax() * C.ROCK.batteryLoss);
  }
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
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.35 + Math.random() * 0.35, col });
  }
}
function floatText(x, y, text, col) { floats.push({ x, y, text, col, life: 1.1 }); }

// ================= Drawing =================
// 2.5D: every solid block is a raised wall. Its top face is drawn shifted up by W,
// and its front face shows wherever the cell below is open floor. Rows are drawn
// top to bottom so nearer walls overlap the robot and the walls behind them.
const stage = $('stage'), cv = $('world'), g = cv.getContext('2d');
const pcv = $('pet'), pg = pcv.getContext('2d');
let VW = 1, VH = 1, PW = 1, PH = 1, CELL = 40, camX = 0, camY = 0, time = 0;
function fit(canvas, ctx) {
  const r = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return [r.width, r.height];
}
function resize() {
  [VW, VH] = fit(cv, g); [PW, PH] = fit(pcv, pg);
  CELL = Math.max(22, Math.floor(Math.min(VW / 15, VH / 9.5)));
}
new ResizeObserver(resize).observe(stage);
new ResizeObserver(resize).observe($('burrowView'));

function shade(hex, k) { // k < 1 darkens
  const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(v * k)));
  return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')';
}
function rr2(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

function drawFloor(c, r, x, y, s) {
  const yard = r < BASE_ROWS, deep = !yard && biomeAt(r).id === 'basalt';
  g.fillStyle = yard ? '#3c4a2c' : deep ? '#1b1820' : '#2a1e15';
  g.fillRect(x, y, s, s);
  g.fillStyle = yard ? 'rgba(120,150,80,.25)' : 'rgba(255,230,200,.04)';
  g.fillRect(x + s * (0.2 + hash(c, r, 3) * 0.5), y + s * (0.2 + hash(c, r, 4) * 0.5), s * 0.1, s * 0.1);
  if (outpostAt(c, r)) { // outpost landing pad
    g.fillStyle = 'rgba(217,129,59,.16)'; g.fillRect(x, y, s, s);
    g.strokeStyle = 'rgba(217,129,59,.35)'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
  }
  if (onBelt(c, r)) drawBelt(x, y, s);
}
function drawBelt(x, y, s) {
  g.fillStyle = '#2b2622'; g.fillRect(x + s * 0.18, y, s * 0.64, s);
  g.fillStyle = '#6a5038'; g.fillRect(x + s * 0.14, y, s * 0.05, s); g.fillRect(x + s * 0.81, y, s * 0.05, s);
  g.strokeStyle = 'rgba(217,129,59,.5)'; g.lineWidth = Math.max(1, s * 0.04);
  const off = ((time * 1.5) % 1) * s * 0.5;
  for (let k = -1; k < 3; k++) {
    const yy = y + k * s * 0.5 + off;
    if (yy < y + s * 0.14 || yy > y + s) continue;
    g.beginPath(); g.moveTo(x + s * 0.32, yy); g.lineTo(x + s * 0.5, yy - s * 0.14); g.lineTo(x + s * 0.68, yy); g.stroke();
  }
}

function drawWall(t, c, r, x, y, s, W) {
  const i = idx(c, r), seen = SEEN[i];
  const hidden = (ORES.has(t) || t === 'fossil') && !seen;
  const look = hidden ? baseFor(c, r) : t;
  const base = C.BLOCKS[look].color || C.BLOCKS[baseFor(c, r)].color;
  const ty = y - W; // top face
  if (!at(c, r + 1)) { // front face, only where open floor lies in front
    g.fillStyle = shade(base, 0.62); g.fillRect(x, y + s - W, s, W);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x, y + s - W, s, Math.max(1, W * 0.18));
  }
  if (look === 'loose') {
    g.fillStyle = shade(C.BLOCKS.basalt.color, 0.9); g.fillRect(x, ty, s, s);
    g.fillStyle = base; rr2(g, x + s * 0.1, ty + s * 0.1, s * 0.8, s * 0.8, s * 0.3); g.fill();
    g.fillStyle = 'rgba(255,240,220,.12)'; rr2(g, x + s * 0.2, ty + s * 0.16, s * 0.4, s * 0.14, s * 0.07); g.fill();
    g.strokeStyle = 'rgba(10,6,3,.6)'; g.lineWidth = Math.max(1, s * 0.04);
    g.beginPath(); g.moveTo(x + s * 0.5, ty + s * 0.2); g.lineTo(x + s * 0.42, ty + s * 0.5); g.lineTo(x + s * 0.58, ty + s * 0.72); g.stroke();
  } else if (look === 'rubble') {
    g.fillStyle = shade(base, 0.8); g.fillRect(x, ty, s, s);
    g.fillStyle = base;
    for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + s * (0.25 + hash(c, r, k) * 0.5), ty + s * (0.25 + hash(r, c, k) * 0.5), s * 0.2, 0, 7); g.fill(); }
  } else {
    g.fillStyle = base; g.fillRect(x, ty, s, s);
    const bev = Math.max(2, s * 0.07);
    g.fillStyle = 'rgba(255,240,220,.08)'; g.fillRect(x, ty, s, bev); g.fillRect(x, ty, bev, s);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + s - bev, ty, bev, s);
    if (look === 'basalt') { g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(x + s * (0.15 + hash(c, r, 1) * 0.4), ty + s * (0.25 + hash(c, r, 2) * 0.4), s * 0.3, s * 0.07); }
    if (look === 'bedrock') { g.fillStyle = '#211b20'; for (let k = 0; k < 3; k++) g.fillRect(x + s * 0.1, ty + s * (0.2 + k * 0.28), s * 0.8, s * 0.06); }
  }
  if (!hidden && ORES.has(t)) {
    g.fillStyle = C.BLOCKS[t].ore;
    const q = Math.max(2, s * 0.12);
    for (let k = 0; k < 5; k++) g.fillRect(x + s * 0.15 + hash(c, r, k * 3) * (s * 0.7 - q), ty + s * 0.15 + hash(r, c, k * 7) * (s * 0.7 - q), q, q);
  }
  if (!hidden && t === 'fossil') {
    g.strokeStyle = '#eadfc4'; g.lineWidth = Math.max(2, s * 0.1); g.lineCap = 'round';
    g.beginPath(); g.moveTo(x + s * 0.28, ty + s * 0.72); g.lineTo(x + s * 0.72, ty + s * 0.28); g.stroke();
    g.fillStyle = '#eadfc4';
    [[0.24, 0.7], [0.3, 0.78], [0.7, 0.22], [0.78, 0.3]].forEach(([a, b]) => { g.beginPath(); g.arc(x + s * a, ty + s * b, s * 0.07, 0, 7); g.fill(); });
    g.lineCap = 'butt';
  }
  const hp = C.BLOCKS[t].hp, d = DMG[i] / hp;
  if (d > 0 && hp !== Infinity) {
    g.strokeStyle = 'rgba(10,6,3,' + (0.35 + d * 0.6) + ')'; g.lineWidth = Math.max(1.5, s * 0.05); g.beginPath();
    g.moveTo(x + s * 0.5, ty + s * 0.1); g.lineTo(x + s * 0.36, ty + s * 0.5); g.lineTo(x + s * 0.58, ty + s * 0.6);
    if (d > 0.45) { g.lineTo(x + s * 0.46, ty + s * 0.9); g.moveTo(x + s * 0.36, ty + s * 0.5); g.lineTo(x + s * 0.12, ty + s * 0.7); }
    g.stroke();
  }
}

// Buildings are drawn as one piece over their cells.
function drawBaseBuilding(sx, sy, s, W) {
  const B = C.BASE_BUILDING, x = sx(B.cols[0]), w = (B.cols[1] - B.cols[0] + 1) * s, h = (B.rows[1] - B.rows[0] + 1) * s;
  const y = sy(B.rows[0]) - W * 2.2;
  g.fillStyle = '#2a1f17'; g.fillRect(x, y + h, w, W * 2.2);                           // front wall
  g.fillStyle = '#3a2b20'; g.fillRect(x, y, w, h);                                      // roof
  g.fillStyle = '#4a372a'; for (let k = 1; k < 6; k++) g.fillRect(x, y + k * h / 6, w, 2);
  g.fillStyle = '#e8a160'; g.fillRect(x + s * 0.4, y + h + W * 0.5, s * 0.5, W * 0.9);   // window
  g.fillStyle = '#16110d'; g.fillRect(x + w - s * 1.1, y + h + W * 0.4, s * 0.6, W * 1.8); // door
  g.fillStyle = '#efe3d3'; g.font = '700 ' + Math.round(s * 0.42) + 'px "Pixelify Sans", monospace'; g.textAlign = 'center';
  g.fillText('BASE', x + w / 2, y + h / 2 + s * 0.15);
}
function drawOutpost(k, sx, sy, s, W) {
  const row = outpostRow(k), x = sx(BELT + 2), y = sy(row - 1) - W * 1.6;
  g.fillStyle = '#2a1f17'; g.fillRect(x, y + s * 2, s, W * 1.6);
  g.fillStyle = '#3a2b20'; g.fillRect(x, y, s, s * 2);
  g.fillStyle = '#4b4038'; g.fillRect(x + s * 0.1, y + s * 0.1, s * 0.8, s * 1.8);
  g.fillStyle = 'rgba(217,129,59,' + (0.7 + Math.sin(time * 4) * 0.3) + ')'; g.beginPath(); g.arc(x + s * 0.5, y + s * 0.5, s * 0.14, 0, 7); g.fill();
  g.fillStyle = '#efe3d3'; g.font = '700 ' + Math.round(s * 0.3) + 'px "Pixelify Sans", monospace'; g.textAlign = 'center';
  g.fillText('OP' + k, x + s * 0.5, y + s * 1.3);
}

// The robot, built from its four equipped parts. Drawn around (0,0), roughly 36 units tall.
function drawBot(ctx, x, y, s, face, t, ids) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s * face, s);
  const L = ids.legs, B = ids.body, A = ids.arms, H = ids.head;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0, 14, 11, 3, 0, 0, 7); ctx.fill(); // shadow
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
    ctx.fillStyle = '#9fe3f0'; ctx.beginPath(); ctx.moveTo(-5, 10); ctx.lineTo(5, 10); ctx.lineTo(0, 14 + Math.sin(t * 40) * 1.5); ctx.closePath(); ctx.fill();
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
const partIds = () => ({ head: part('head').id, arms: part('arms').id, body: part('body').id, legs: part('legs').id });

function render(dt) {
  const s = CELL, W = Math.round(s * 0.32);
  const worldW = COLS * s;
  const tx = worldW <= VW ? (worldW - VW) / 2 : Math.max(0, Math.min(worldW - VW, P.x * s - VW / 2));
  const ty = Math.max(-s * 1.6, P.y * s - VH * 0.5); // leave room above the yard for the HUD
  const k = Math.min(1, dt * 8);
  camX += (tx - camX) * k; camY += (ty - camY) * k;
  const shake = P.shake > 0 ? (Math.random() - 0.5) * 6 : 0;
  const sx = c => Math.round(c * s - camX + shake);
  const sy = r => Math.round(r * s - camY + shake);

  g.fillStyle = '#0b0806'; g.fillRect(0, 0, VW, VH);
  const r0 = Math.max(0, Math.floor((camY - W) / s)), r1 = Math.min(ROWS - 1, Math.ceil((camY + VH + W) / s));
  const c0 = Math.max(0, Math.floor(camX / s)), c1 = Math.min(COLS - 1, Math.ceil((camX + VW) / s));
  const robotRow = pRow();
  const ids = partIds();
  const blocked = new Set(beltBlocked());

  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) if (!at(c, r)) drawFloor(c, r, sx(c), sy(r), s);
    for (let c = c0; c <= c1; c++) {
      const t = at(c, r);
      if (!t || t === 'found' || t === 'post') continue;
      const w = wobble.get(idx(c, r));
      drawWall(t, c, r, sx(c) + (w ? Math.sin(time * 60) * s * 0.06 : 0), sy(r), s, W);
      if (c === BELT && blocked.has(r)) { // conveyor path still to dig
        g.setLineDash([4, 4]); g.strokeStyle = 'rgba(217,129,59,.6)'; g.lineWidth = 1.5;
        g.strokeRect(sx(c) + 3, sy(r) - W + 3, s - 6, s - 6); g.setLineDash([]);
      }
    }
    if (r === C.BASE_BUILDING.rows[1]) drawBaseBuilding(sx, sy, s, W);
    for (let k2 = 1; k2 <= S.outposts; k2++) if (r === outpostRow(k2)) drawOutpost(k2, sx, sy, s, W);
    if (r === robotRow) {
      const nudge = P.digging ? Math.sin(time * 40) * s * 0.04 : 0;
      const ndx = P.digging ? (P.digging.c - pCol()) * nudge : 0, ndy = P.digging ? (P.digging.r - pRow()) * nudge : 0;
      drawBot(g, sx(P.x) + ndx, sy(P.y) - s * 0.12 + ndy, s / 40, P.face, time, ids);
    }
  }

  particles.forEach(p => { g.globalAlpha = Math.max(0, p.life * 2); g.fillStyle = p.col; const q = Math.max(2, s * 0.07); g.fillRect(sx(p.x) - q / 2, sy(p.y) - W - q / 2, q, q); });
  g.globalAlpha = 1;

  // darkness inside the cave, with a pool of light around the robot
  const caveTop = sy(BASE_ROWS) - W;
  if (caveTop < VH) {
    const px = sx(P.x), py = sy(P.y);
    g.save(); g.beginPath(); g.rect(0, Math.max(0, caveTop), VW, VH); g.clip();
    const R = lightRadius() * s;
    const fog = g.createRadialGradient(px, py, R * 0.5, px, py, R * 1.1);
    fog.addColorStop(0, 'rgba(8,5,3,0)'); fog.addColorStop(1, 'rgba(8,5,3,.94)');
    g.fillStyle = fog; g.fillRect(0, 0, VW, VH);
    for (let k2 = 1; k2 <= S.outposts; k2++) { // outposts keep a lamp lit
      const oy = sy(outpostRow(k2)), ox2 = sx(BELT + 1);
      if (oy < -s * 3 || oy > VH + s * 3) continue;
      const glow = g.createRadialGradient(ox2, oy, 0, ox2, oy, s * 2.2);
      glow.addColorStop(0, 'rgba(217,129,59,.18)'); glow.addColorStop(1, 'rgba(217,129,59,0)');
      g.fillStyle = glow; g.fillRect(ox2 - s * 3, oy - s * 3, s * 6, s * 6);
    }
    if (rockScan()) { // a scanning head outlines unstable rock in the dark
      g.strokeStyle = 'rgba(205,184,156,.4)'; g.lineWidth = 1;
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        if (T[idx(c, r)] !== 'loose') continue;
        if (Math.hypot(c + 0.5 - P.x, r + 0.5 - P.y) > lightRadius() + rockScan()) continue;
        g.beginPath(); g.arc(sx(c) + s / 2, sy(r) - W + s / 2, s * 0.36, 0, 7); g.stroke();
      }
    }
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { // an unseen fossil glows faintly when you're close
      if (T[idx(c, r)] !== 'fossil' || SEEN[idx(c, r)]) continue;
      if (Math.hypot(c + 0.5 - P.x, r + 0.5 - P.y) > lightRadius() + 2.5) continue;
      g.fillStyle = 'rgba(234,223,196,' + (0.12 + Math.sin(time * 3) * 0.08) + ')';
      g.beginPath(); g.arc(sx(c) + s / 2, sy(r) - W + s / 2, s * 0.45, 0, 7); g.fill();
    }
    g.restore();
  }

  g.textAlign = 'center'; g.font = '600 ' + Math.max(11, Math.round(s * 0.28)) + 'px "IBM Plex Mono", monospace';
  floats.forEach(f => { g.globalAlpha = Math.min(1, f.life * 1.5); g.fillStyle = f.col; g.fillText(f.text, sx(f.x), sy(f.y) - W); });
  g.globalAlpha = 1;
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
    pg.fillText('Find the fossil hidden ' + depthOf(C.PET.fossilRows[0]) + '–' + depthOf(C.PET.fossilRows[1]) + ' m into the cave', PW / 2, PH / 2 + 14);
    return;
  }
  const k = Math.min(1, PET.prog / petDigTime());
  const mx = ox + (PET.c + 0.5) * s, my = oy + (PET.r + 0.5) * s + Math.sin(time * 14) * s * 0.04;
  pg.save(); pg.translate(mx, my);
  pg.fillStyle = '#5a463a'; pg.beginPath(); pg.ellipse(0, 0, s * 0.34, s * 0.4, 0, 0, 7); pg.fill();
  pg.fillStyle = '#e9a0a0'; pg.beginPath(); pg.arc(0, s * 0.38, s * 0.08, 0, 7); pg.fill();
  pg.fillStyle = '#d9c7b0'; const claw = Math.sin(time * 24) * s * 0.06;
  pg.fillRect(-s * 0.32, s * 0.24 + claw, s * 0.14, s * 0.1); pg.fillRect(s * 0.18, s * 0.24 - claw, s * 0.14, s * 0.1);
  pg.fillStyle = '#16110d'; pg.fillRect(-s * 0.12, s * 0.12, s * 0.05, s * 0.05); pg.fillRect(s * 0.07, s * 0.12, s * 0.05, s * 0.05);
  pg.restore();
  const tx = ox + PET.c * s, ty = oy + (PET.r + 1) * s;
  pg.strokeStyle = 'rgba(10,6,3,' + (0.2 + k * 0.7) + ')'; pg.lineWidth = 1.5; pg.beginPath();
  pg.moveTo(tx + s * 0.5, ty + s * 0.1); pg.lineTo(tx + s * 0.38, ty + s * 0.5 * (0.4 + k)); pg.stroke();
  pg.textAlign = 'center'; pg.font = '600 11px "IBM Plex Mono", monospace';
  petFloats.forEach(f => { pg.globalAlpha = Math.min(1, f.life * 1.5); pg.fillStyle = f.ore ? '#e8a160' : '#efe3d3'; pg.fillText(f.text, ox + f.c * s, oy + (f.r + 1 - (1 - f.life) * 0.8) * s); });
  pg.globalAlpha = 1;
}

// ================= UI =================
const SLOTS = ['head', 'arms', 'body', 'legs'];
$('parts').innerHTML = SLOTS.map(s => `
  <div class="row">
    <div><small>${C.PARTS[s].label} · ${C.PARTS[s].stat}</small><strong id="cur-${s}"></strong><span id="stat-${s}"></span></div>
    <button id="up-${s}" data-slot="${s}" type="button"></button>
  </div>`).join('');

$('parts').addEventListener('click', e => {
  const s = e.target.closest('button')?.dataset.slot; if (!s || !station()) return;
  const next = C.PARTS[s].tiers[S.tiers[s] + 1]; if (!next || S.coins < next.cost) return;
  S.coins -= next.cost; S.tiers[s]++;
  if (s === 'body') P.battery = batteryMax();
  toast(null, next.name + ' installed.'); save(); updateUI();
});
$('extend').addEventListener('click', () => {
  if (!station() || extendMaxed() || beltBlocked().length || S.coins < extendCost()) return;
  S.coins -= extendCost(); S.outposts++; buildOutpost(S.outposts);
  toast('Outpost ' + S.outposts + ' built', 'The conveyor now reaches ' + depthOf(beltEnd()) + ' m. Sell, recharge and shop there.');
  save(); updateUI();
});
$('train').addEventListener('click', () => {
  if (!station() || !S.pet || S.pet >= C.PET.maxLevel || S.coins < trainCost()) return;
  S.coins -= trainCost(); S.pet++;
  toast(null, C.PET.name + ' is now level ' + S.pet + '.'); save(); updateUI();
});
let armed = 0;
$('reset').addEventListener('click', () => {
  const b = $('reset');
  if (!armed) { b.textContent = 'Click again to reset'; b.classList.add('armed'); armed = setTimeout(() => { armed = 0; b.textContent = 'Reset progress'; b.classList.remove('armed'); }, 3000); return; }
  clearTimeout(armed); armed = 0; b.textContent = 'Reset progress'; b.classList.remove('armed');
  S = freshState(); genWorld(); regenPet(); placePlayerFromSave();
  wobble.clear(); lastBiome = null; lastCell = -1; markSeen(); save(); updateUI();
  toast('New dig', 'Head into the cave for ore. Sell it at base or an outpost, then upgrade your robot.');
});
let recallArmed = 0;
$('recall').addEventListener('click', () => {
  const b = $('recall');
  if (station() === 'base') return;
  if (!recallArmed) { b.textContent = 'Tap again · keep ' + Math.round(C.RECALL.keepCargo * 100) + '% ore'; b.classList.add('armed'); recallArmed = setTimeout(() => { recallArmed = 0; b.textContent = 'Recall'; b.classList.remove('armed'); }, 3000); return; }
  clearTimeout(recallArmed); recallArmed = 0; b.textContent = 'Recall'; b.classList.remove('armed');
  recall('manual');
});

function updateUI() {
  const st = station();
  $('depth').textContent = depthOf(pRow()) + ' m';
  $('biome').textContent = st === 'base' ? 'Base' : st === 'outpost' ? 'Outpost ' + outpostAt(pCol(), pRow()) : biomeAt(pRow()).name;
  $('coins').textContent = fmt(S.coins);
  const bp = Math.max(0, P.battery / batteryMax());
  $('batBar').style.width = (bp * 100) + '%';
  $('batBar').parentElement.classList.toggle('low', bp < 0.25);
  $('batTxt').textContent = Math.ceil(Math.max(0, P.battery));
  $('cargoBar').style.width = (S.cargo.n / cargoMax() * 100) + '%';
  $('cargoTxt').textContent = S.cargo.n + '/' + cargoMax();

  const chip = $('shopState');
  chip.textContent = st === 'base' ? 'Shop open · base' : st === 'outpost' ? 'Shop open · outpost' : 'Opens at base or an outpost';
  chip.classList.toggle('open', !!st);
  $('recall').hidden = st === 'base';
  SLOTS.forEach(s => {
    const cur = part(s), next = C.PARTS[s].tiers[S.tiers[s] + 1], btn = $('up-' + s);
    $('cur-' + s).textContent = cur.name;
    $('stat-' + s).textContent = C.PARTS[s].fmt(cur.val);
    if (!next) { btn.textContent = 'Maxed'; btn.disabled = true; }
    else { btn.textContent = next.name + ' · ' + fmt(next.cost); btn.disabled = !st || S.coins < next.cost; }
  });

  $('liftDepth').textContent = S.outposts ? 'Reaches ' + depthOf(beltEnd()) + ' m · ' + S.outposts + ' outpost' + (S.outposts > 1 ? 's' : '') : 'No outposts yet';
  const blocked = beltBlocked(), ext = $('extend');
  if (extendMaxed()) { ext.textContent = 'Max length'; ext.disabled = true; $('liftNote').textContent = 'The conveyor reaches as deep as it can go.'; }
  else {
    ext.textContent = 'Build outpost ' + (S.outposts + 1) + ' · ' + fmt(extendCost());
    ext.disabled = !st || blocked.length > 0 || S.coins < extendCost();
    $('liftNote').textContent = blocked.length
      ? 'Dig the conveyor path (the dashed middle column) to ' + depthOf(outpostRow(S.outposts + 1)) + ' m first: ' + blocked.length + ' blocks left.'
      : 'The path is clear. Build the next outpost at ' + depthOf(outpostRow(S.outposts + 1)) + ' m.';
  }

  if (S.pet) {
    $('petTag').textContent = C.PET.name + ' · level ' + S.pet;
    $('petTag').classList.add('open');
    $('petInfo').innerHTML = '<b>' + C.PET.name + ' the ' + C.PET.species + '.</b> ' + C.PET.pattern + ' Earns about ' + fmt(petRate() * 60) + ' coins a minute, even while you are away. Gives you +' + Math.round(C.PET.digBonusPerLevel * S.pet * 100) + '% dig power.';
    const tb = $('train'); tb.hidden = false;
    if (S.pet >= C.PET.maxLevel) { tb.textContent = 'Max level'; tb.disabled = true; }
    else { tb.textContent = 'Train · ' + fmt(trainCost()); tb.disabled = !st || S.coins < trainCost(); }
  }
}

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
const lastOf = (a, b) => { for (let i = held.length - 1; i >= 0; i--) if (held[i] === a || held[i] === b) return held[i]; return null; };
const horizDir = () => swipeH || lastOf('left', 'right');
const vertDir = () => swipeV || lastOf('up', 'down');
addEventListener('keydown', e => { const d = KEYMAP[e.code]; if (d) { e.preventDefault(); if (!held.includes(d)) held.push(d); } });
addEventListener('keyup', e => { const d = KEYMAP[e.code]; if (d) { const i = held.indexOf(d); if (i >= 0) held.splice(i, 1); } });
addEventListener('blur', () => { held.length = 0; swipeH = swipeV = null; });

// Swipe: drag and hold to move or dig in that direction (diagonals work too).
let touch = null;
cv.addEventListener('pointerdown', e => { touch = { x: e.clientX, y: e.clientY, id: e.pointerId }; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', e => {
  if (!touch || e.pointerId !== touch.id) return;
  const dx = e.clientX - touch.x, dy = e.clientY - touch.y, ax = Math.abs(dx), ay = Math.abs(dy);
  if (Math.hypot(dx, dy) < 22) return;
  swipeH = ax > ay * 0.5 ? (dx > 0 ? 'right' : 'left') : null;
  swipeV = ay > ax * 0.5 ? (dy > 0 ? 'down' : 'up') : null;
  touch.x = e.clientX; touch.y = e.clientY;
});
const endTouch = e => { if (!touch || e.pointerId !== touch.id) return; touch = null; swipeH = swipeV = null; };
cv.addEventListener('pointerup', endTouch);
cv.addEventListener('pointercancel', endTouch);

// ================= Main loop =================
let prev = performance.now(), uiT = 0, saveT = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - prev) / 1000); prev = now; time += dt;
  sellAndCharge(dt);
  updatePlayer(dt);
  updateRocks(dt);
  updatePet(dt);
  if (P.shake > 0) P.shake -= dt;
  particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; p.life -= dt; });
  particles = particles.filter(p => p.life > 0);
  floats.forEach(f => { f.y -= 0.8 * dt; f.life -= dt; }); floats = floats.filter(f => f.life > 0);
  for (let i = petFloats.length - 1; i >= 0; i--) { petFloats[i].life -= dt; if (petFloats[i].life <= 0) petFloats.splice(i, 1); }
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
lastBiome = pRow() >= BASE_ROWS ? biomeAt(pRow()).id : null;
resize();
camX = Math.max(0, P.x * CELL - VW / 2); camY = P.y * CELL - VH * 0.5;

if (isNewGame) {
  setTimeout(() => toast('Bolt & Burrow', 'Dig into the cave for ore and bring it back to base. Clear the middle column to build your first outpost at 25 m.'), 300);
} else if (S.pet) {
  const away = Math.min((Date.now() - S.last) / 1000, C.PET.offlineCapHours * 3600);
  const gain = Math.floor(away * petRate());
  if (away > 30 && gain > 0) { S.coins += gain; setTimeout(() => toast('Welcome back', C.PET.name + ' dug up ' + fmt(gain) + ' coins while you were away.'), 300); }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
updateUI();
requestAnimationFrame(frame);
})();
