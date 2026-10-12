// Bolt & Burrow — shared state, saving and small helpers.
// Every other file reads and changes the values defined here.
// Load order (see index.html): config → state → world → player → hazards → pet → render → ui → input → main
'use strict';

const C = CONFIG;
const { COLS, ROWS, BASE_ROWS } = C;
const BELT = C.CONVEYOR.col;
const SAVE_KEY = 'bolt-burrow-v4';
const $ = id => document.getElementById(id);

// World cells are saved as one character each ('.' = open floor)
const CODE = { d: 'dirt', c: 'clay', b: 'basalt', l: 'loose', r: 'rubble', o: 'copper', s: 'silver', g: 'gold', k: 'crystal', f: 'fossil', q: 'relic', n: 'found', t: 'post', x: 'bedrock' };
const CHAR = Object.fromEntries(Object.entries(CODE).map(([k, v]) => [v, k]));
const ORES = new Set(['copper', 'silver', 'gold', 'crystal']);

const freshState = () => ({
  coins: 0,
  tiers: { head: 0, arms: 0, body: 0, legs: 0 },
  outposts: 0,                  // how many outposts the conveyor reaches
  pet: 0,                       // pet level (0 = not hatched)
  cargo: { items: {} },         // ore carried, by type: { copper: { n, value } }
  relicHeld: false, relics: 0, relicPlaced: false,
  best: 0, biomesSeen: [], last: Date.now(),
  world: null, seen: null, pos: null,
});

let S = freshState();
let T = [];                                  // block type per cell (null = open floor)
let DMG = new Float32Array(COLS * ROWS);     // dig damage per cell
let SEEN = new Uint8Array(COLS * ROWS);      // cells the robot has lit up
let isNewGame = true;

try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) { S = Object.assign(freshState(), JSON.parse(raw)); isNewGame = false; }
} catch (e) { /* storage unavailable: play without saving */ }
// v0.4 saves stored cargo as a single count
if (!S.cargo || !S.cargo.items) S.cargo = { items: S.cargo && S.cargo.n ? { mixed: { n: S.cargo.n, value: S.cargo.value } } : {} };

function save() {
  S.last = Date.now();
  S.world = T.map(t => (t ? CHAR[t] : '.')).join('');
  S.seen = SEEN.join('');
  S.pos = { x: P.x, y: P.y, battery: P.battery };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {}
}

// ---------- Grid helpers ----------
const idx = (c, r) => r * COLS + c;
const inBounds = (c, r) => c >= 0 && c < COLS && r >= 0 && r < ROWS;
const at = (c, r) => (inBounds(c, r) ? T[idx(c, r)] : 'bedrock');
const solidAt = (c, r) => !!at(c, r);
const biomeAt = r => C.BIOMES.find(b => r >= b.from && r <= b.to) || C.BIOMES[C.BIOMES.length - 1];
const depthOf = r => Math.max(0, r - BASE_ROWS + 1);
function hash(a, b, c) { let h = (a * 374761393 + b * 668265263 + c * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

// ---------- Robot stats from equipped parts ----------
const part = slot => C.PARTS[slot].tiers[S.tiers[slot]];
const lightRadius = () => part('head').val.light;
const rockScan = () => part('head').val.scan;
const digPower = () => part('arms').val * (1 + C.PET.digBonusPerLevel * S.pet);
const batteryMax = () => part('body').val.battery;
const cargoMax = () => part('body').val.cargo;
const legs = () => part('legs').val;

// ---------- Cargo ----------
const cargoCount = () => Object.values(S.cargo.items).reduce((a, i) => a + i.n, 0);
const cargoValue = () => Object.values(S.cargo.items).reduce((a, i) => a + i.value, 0);
function cargoAdd(type, value) {
  const it = S.cargo.items[type] || (S.cargo.items[type] = { n: 0, value: 0 });
  it.n++; it.value += value;
}
// Remove k random pieces of ore. Returns how many were removed.
function cargoRemove(k) {
  let removed = 0;
  while (removed < k) {
    const types = Object.keys(S.cargo.items).filter(t => S.cargo.items[t].n > 0);
    if (!types.length) break;
    const it = S.cargo.items[types[Math.floor(Math.random() * types.length)]];
    const each = it.value / it.n;
    it.n--; it.value -= each; removed++;
  }
  for (const t of Object.keys(S.cargo.items)) if (S.cargo.items[t].n <= 0) delete S.cargo.items[t];
  return removed;
}

function fmt(n) {
  n = Math.floor(n);
  if (n < 10000) return n.toLocaleString('en-CA');
  const u = ['K', 'M', 'B']; let i = -1;
  while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return n.toFixed(n < 100 ? 1 : 0) + u[i];
}
