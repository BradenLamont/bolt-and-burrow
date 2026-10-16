// Bolt & Burrow — shared state, saving and small helpers.
// Every other file reads and changes the values defined here.
// Load order (see index.html): config → state → world → player → hazards → pet → walker → render → ui → input → main
'use strict';

const C = CONFIG;
const { COLS, BASE_ROWS } = C;
let ROWS = C.ROWS;                       // rows in the current area (the town is shorter than a cave)
const BELT = C.CONVEYOR.col;
const SAVE_KEY = 'bolt-burrow-v8';   // v0.8 starts fresh: older saves aren't carried over
const $ = id => document.getElementById(id);

// World cells are saved as one character each ('.' = open floor)
const CODE = { d: 'dirt', c: 'clay', e: 'stone', b: 'basalt', l: 'loose', r: 'rubble', o: 'copper', s: 'silver', g: 'gold', k: 'crystal',
  f: 'fossil', q: 'relic', n: 'found', t: 'post', x: 'bedrock', G: 'granite', O: 'obsidian', h: 'cache', K: 'keycache', v: 'chasm', B: 'bridge', w: 'oldbridge', p: 'pad',
  E: 'exit', A: 'gate', L: 'gatelocked', Q: 'cliff', Y: 'tree', D: 'pedestal', R: 'rail',
  z: 'sand', U: 'boulder', a: 'aquifer', W: 'water', y: 'gas', m: 'beam' };
const CHAR = Object.fromEntries(Object.entries(CODE).map(([k, v]) => [v, k]));
const ORES = new Set(['copper', 'silver', 'gold', 'crystal']);
// Tiles you can walk on even though they aren't empty
const WALKABLE = new Set(['bridge', 'oldbridge', 'pad', 'exit', 'gate', 'shopdoor', 'water', 'beam']);

const freshCave = () => ({ world: null, seen: null, deco: null, outposts: 0, relicDone: false, bossDone: false });
const ORE_LIST = ['copper', 'silver', 'gold', 'crystal'];
const MAT_LIST = Object.keys(C.MATERIALS);
const freshState = () => ({
  coins: 0,
  tiers: { head: 0, arms: 0, body: 0, legs: 0 },
  cargo: { items: {} },         // ore carried, by type: { copper: 3 }
  storage: Object.fromEntries(ORE_LIST.map(o => [o, 0])),   // ore in the train's storage car
  mats: Object.fromEntries(MAT_LIST.map(m => [m, 0])),      // refined materials
  forge: { queue: [], start: 0 },                           // recipe ids waiting; start = when the first began (ms)
  mods: {},                     // mods you've built: { drill: level }
  grid: [],                     // mods placed in the computer: [{ id, x, y }]
  flux: 0,
  bots: 0,                      // nano-bots (the first comes with the Ember Idol)
  tools: {},                    // tools on your belt: { blast: 2 }
  weapon: 'wrench',             // the weapon on your weapon arm
  weapons: { wrench: 1 },       // weapons you own and their Mk (1–3)
  skillCharge: 0,               // 0–1: how charged your active skill is
  hints: [],                    // first-time hints already shown
  ver: 11,                      // save layout version
  cave: -1,                     // where you are: -1 = town, -2 = inside Pip's shop, 0+ = a cave
  town: 0,                      // which town on the train line you're in (or whose cave you're in)
  lineOpen: false,              // the test unlock for the train line (it also opens with the Core Heart)
  unlocked: 1,                  // how many cave gates are open
  keys: C.CAVES.map(() => 0),   // bridge keys held for each cave (they only work in their own cave)
  caves: C.CAVES.map(freshCave),
  relicHeld: 0,                 // cave number + 1 of the relic you're carrying (0 = none)
  relics: 0,
  best: 0, last: Date.now(), pos: null, seenNotes: [],
});

let S = freshState();
let T = [];                                  // block type per cell (null = open floor)
let DMG = new Float32Array(COLS * ROWS);     // dig damage per cell
let SEEN = new Uint8Array(COLS * ROWS);      // 1 = lit up, 2 = a cache the scanner has revealed
let DECO = new Uint8Array(COLS * ROWS);      // 1 = cavern floor (gets stalagmites)
let isNewGame = true, migrated = false;

try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) {
    S = Object.assign(freshState(), JSON.parse(raw)); isNewGame = false;
    // v0.9 added sand, boulders, water and gas: rebuild cave layouts once (progress is kept)
    if ((S.ver || 8) < 9) { S.caves.forEach(c => { c.world = c.seen = c.deco = null; }); S.ver = 9; S.pos = null; }
    // v0.11 added boss halls and Cave 3's boss room: rebuild cave layouts once more (progress is kept)
    if (S.ver < 11) { S.caves.forEach(c => { c.world = c.seen = c.deco = null; if (c.relicDone) c.bossDone = true; }); S.ver = 11; S.pos = null; }
  }
} catch (e) { /* storage unavailable: play without saving */ }
while (S.caves.length < C.CAVES.length) S.caves.push(freshCave());
while (S.keys.length < C.CAVES.length) S.keys.push(0);

const inTown = () => S.cave < 0;            // above ground: the town or inside the shop
const inShop = () => S.cave === -2;
const onTownMap = () => S.cave === -1;
const TOWN = () => C.TOWNS[S.town];           // the current town's settings
const CORE = C.CAVES.findIndex(c => c.id === 'deeps');   // the Core Heart's cave (end of Town 1)
const lineIsOpen = () => S.lineOpen || S.caves[CORE].relicDone;
const caveTown = k => C.CAVES[k].town || 0;
const caveLabel = k => C.CAVES[k].label || 'Cave ' + (k + 1);
const cave = () => C.CAVES[S.cave];        // the current cave's settings (undefined in town)
const CS = () => S.caves[S.cave];          // the current cave's saved progress (undefined in town)

function stashCave() {
  if (inTown()) return;
  const cs = CS();
  cs.world = T.map(t => (t ? CHAR[t] : '.')).join('');
  cs.seen = SEEN.join('');
  cs.deco = DECO.join('');
}
let noSave = false;   // set while loading a backup, so the old game doesn't overwrite it
function save() {
  if (noSave) return;
  S.last = Date.now();
  stashCave();
  S.pos = { x: P.x, y: P.y, battery: P.battery, hull: P.hull };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {}
}

// ---------- Grid helpers ----------
const idx = (c, r) => r * COLS + c;
const inBounds = (c, r) => c >= 0 && c < COLS && r >= 0 && r < ROWS;
const at = (c, r) => (inBounds(c, r) ? T[idx(c, r)] : 'bedrock');
const isFloor = t => !t || WALKABLE.has(t);
const solidAt = (c, r) => !isFloor(at(c, r));            // blocks movement (rock, chasm, buildings)
const depthOf = r => Math.max(0, r - BASE_ROWS + 1);
function hash(a, b, c) { let h = (a * 374761393 + b * 668265263 + c * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

// ---------- Walker stats from equipped parts ----------
const part = slot => C.PARTS[slot].tiers[S.tiers[slot]];
// modVal(id) is a mod's effect if it's placed in the computer, otherwise 0 (see base.js)
const lightRadius = () => part('head').val.light + modVal('lamp');
const rockScan = () => part('head').val.scan;
const digPower = () => part('arms').val * (1 + modVal('drill') + modVal('overclock'));
const batteryMax = () => Math.round(part('body').val.battery * (1 + modVal('coolant')));
const drainMult = () => (modVal('overclock') ? 1.1 : 1);   // Overclock costs 10% more battery
const cargoMax = () => part('body').val.cargo;
const legs = () => part('legs').val;
const keyName = k => C.CAVES[k].keyName;

// ---------- Cargo ----------
const cargoCount = () => Object.values(S.cargo.items).reduce((a, n) => a + n, 0);
function cargoAdd(type) { S.cargo.items[type] = (S.cargo.items[type] || 0) + 1; }
// Remove k random pieces of ore. Returns how many were removed.
function cargoRemove(k) {
  let removed = 0;
  while (removed < k) {
    const types = Object.keys(S.cargo.items).filter(t => S.cargo.items[t] > 0);
    if (!types.length) break;
    S.cargo.items[types[Math.floor(Math.random() * types.length)]]--; removed++;
  }
  for (const t of Object.keys(S.cargo.items)) if (S.cargo.items[t] <= 0) delete S.cargo.items[t];
  return removed;
}

function fmt(n) {
  n = Math.floor(n);
  if (n < 10000) return n.toLocaleString('en-CA');
  const u = ['K', 'M', 'B']; let i = -1;
  while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return n.toFixed(n < 100 ? 1 : 0) + u[i];
}
