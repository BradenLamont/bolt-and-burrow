// Bolt & Burrow — the caves: generation, the conveyor and outposts, chasms and bridges,
// treasure caches, relic chambers, and switching between caves.
'use strict';

// ---------- Conveyor & outposts ----------
// Each cave has one outpost, halfway in (25 m). The conveyor runs from the yard to it.
const outpostRow = k => BASE_ROWS - 1 + C.CONVEYOR.step * k;
const beltEnd = () => outpostRow(CS().outposts);
const onBelt = (c, r) => c === BELT && r >= 0 && r <= beltEnd();
function outpostAt(c, r) {
  for (let k = 1; k <= CS().outposts; k++) { const row = outpostRow(k); if (Math.abs(c - BELT) <= 1 && Math.abs(r - row) <= 1) return k; }
  return 0;
}
const extendCost = () => Math.round(C.CONVEYOR.baseCost * Math.pow(C.CONVEYOR.costGrowth, S.cave));
const extendMaxed = () => CS().outposts >= C.CONVEYOR.maxOutposts;
// Conveyor cells that still need digging before the outpost can be built
function beltBlocked() {
  if (extendMaxed()) return [];
  const out = [];
  for (let r = beltEnd() + 1; r <= outpostRow(CS().outposts + 1); r++) if (solidAt(BELT, r)) out.push(r);
  return out;
}
function buildOutpost(k) {
  const row = outpostRow(k);
  for (let r = row - 1; r <= row + 1; r++) for (let c = BELT - 1; c <= BELT + 1; c++) { T[idx(c, r)] = null; DMG[idx(c, r)] = 0; SEEN[idx(c, r)] = 1; }
  T[idx(BELT + 2, row)] = 'post';
  T[idx(BELT + 2, row - 1)] = 'post';
}

// ---------- Bridges ----------
const bridgeCost = () => Math.round(C.BRIDGE.cost * Math.pow(C.BRIDGE.caveGrowth, S.cave));
// A pad deploys the bridge in the two chasm cells beyond it (deeper into the cave)
function deployBridge(c, r) {
  for (let rr = r + 1; rr <= r + 2; rr++) if (at(c, rr) === 'chasm') T[idx(c, rr)] = 'bridge';
}
const padReady = (c, r) => at(c, r) === 'pad' && at(c, r + 1) === 'chasm';

// ---------- Relic chamber ----------
function placeRelic() {
  const r = C.RELIC.row, wall = cave().relic.wall;
  let c; do { c = 4 + Math.floor(Math.random() * (COLS - 8)); } while (Math.abs(c - BELT) < 3);
  for (let rr = r - 2; rr <= r + 2; rr++) for (let cc = c - 2; cc <= c + 2; cc++) {
    const ring = Math.abs(rr - r) === 2 || Math.abs(cc - c) === 2;
    if (ring) { if (wall) T[idx(cc, rr)] = wall; }
    else T[idx(cc, rr)] = null;
  }
  T[idx(c, r)] = 'relic';
}
function relicCell() {
  for (let r = C.RELIC.row - 1; r <= C.RELIC.row + 1; r++) for (let c = 0; c < COLS; c++) if (T[idx(c, r)] === 'relic') return { c, r };
  return null;
}

// ---------- Generation ----------
// What plain rock looks like at a cell (also what hidden ore and caches look like before they're revealed)
function baseFor(c, r) {
  const rock = cave().rock;
  if (rock.length === 1) return rock[0];
  return hash(c, r, 7) < Math.min(0.75, (r - BASE_ROWS) / 40) ? rock[1] : rock[0];
}
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

function genWorld() {
  const cv = cave(), cs = CS();
  T = new Array(COLS * ROWS).fill(null);
  DECO = new Uint8Array(COLS * ROWS);
  SEEN = new Uint8Array(COLS * ROWS);
  const lastRow = ROWS - 1, beltRows = outpostRow(1) + 1;

  // 1. Rock, ore, hard rock and unstable rock
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const i = idx(c, r);
    if (c === 0 || c === COLS - 1 || r === lastRow) { T[i] = 'bedrock'; continue; }
    if (r < BASE_ROWS) continue; // the yard
    let t = baseFor(c, r), x = Math.random();
    for (const [ore, p] of Object.entries(cv.ores)) { if (x < p) { t = ore; break; } x -= p; }
    if (t === baseFor(c, r)) {
      const deep = (r - BASE_ROWS) / (lastRow - BASE_ROWS); // 0 at the mouth, 1 at the end
      const y = Math.random();
      if (y < cv.obsidian * (0.4 + deep)) t = 'obsidian';
      else if (y < (cv.obsidian + cv.granite) * (0.4 + deep)) t = 'granite';
      else if (cv.unstable && y > 1 - cv.unstable) t = 'loose';
    }
    // keep the conveyor path to the outpost free of hard rock
    if (c === BELT && r <= beltRows && (t === 'granite' || t === 'obsidian' || t === 'loose')) t = baseFor(c, r);
    T[i] = t;
  }

  // 2. Open caverns, decorated with stalagmites
  for (let n = 0; n < cv.caverns; n++) {
    const cr = randInt(9, C.RELIC.row - 8), cc = randInt(3, COLS - 4), rx = randInt(2, 3), ry = 2;
    if (cv.chasmRows.some(h => Math.abs(h - cr) < 5)) continue;
    for (let r = cr - ry; r <= cr + ry; r++) for (let c = cc - rx; c <= cc + rx; c++) {
      if (c < 1 || c > COLS - 2) continue;
      if (((c - cc) / (rx + 0.5)) ** 2 + ((r - cr) / (ry + 0.5)) ** 2 <= 1) { T[idx(c, r)] = null; DECO[idx(c, r)] = 1; }
    }
  }

  // 3. Chasms: a band two rows thick from wall to wall, with an old bridge and a bridge pad
  for (const h of cv.chasmRows) {
    let a, b; do { a = randInt(2, COLS - 3); b = randInt(2, COLS - 3); } while (Math.abs(a - b) < 7);
    for (let c = 1; c < COLS - 1; c++) {
      T[idx(c, h)] = 'chasm'; T[idx(c, h + 1)] = 'chasm';
      const nearCross = Math.abs(c - a) <= 1 || Math.abs(c - b) <= 1;
      if (!nearCross && Math.random() < 0.3) T[idx(c, h - 1)] = 'chasm';
      if (!nearCross && Math.random() < 0.3) T[idx(c, h + 2)] = 'chasm';
    }
    T[idx(a, h)] = 'oldbridge'; T[idx(a, h + 1)] = 'oldbridge';
    T[idx(b, h - 1)] = 'pad';
    for (const c of [a, b]) for (const r of [h - 1, h + 2]) if (T[idx(c, r)] === 'chasm' || T[idx(c, r)] === 'granite' || T[idx(c, r)] === 'obsidian') T[idx(c, r)] = baseFor(c, r);
  }
  // 4. Small pits
  for (let n = 0; n < cv.pits; n++) {
    const pr = randInt(8, C.RELIC.row - 6), pc = randInt(2, COLS - 4);
    if (Math.abs(pc - BELT) < 3 || cv.chasmRows.some(h => Math.abs(h - pr) < 4)) continue;
    for (let r = pr; r <= pr + 1; r++) for (let c = pc; c <= pc + 1; c++) T[idx(c, r)] = 'chasm';
  }
  // 5. Treasure caches hidden in plain rock
  for (let n = 0, tries = 0; n < C.CACHE.perCave && tries < 200; tries++) {
    const r = randInt(8, C.RELIC.row - 4), c = randInt(1, COLS - 2);
    if (c === BELT || T[idx(c, r)] !== baseFor(c, r)) continue;
    T[idx(c, r)] = 'cache'; n++;
  }
  // 6. The base building, the fossil (first cave only), outposts and the relic
  const B = C.BASE_BUILDING;
  for (let r = B.rows[0]; r <= B.rows[1]; r++) for (let c = B.cols[0]; c <= B.cols[1]; c++) T[idx(c, r)] = 'found';
  if (cv.fossil && !S.pet) {
    const [a, b] = C.PET.fossilRows;
    let c; do { c = 1 + Math.floor(Math.random() * (COLS - 2)); } while (c === BELT);
    T[idx(c, a + Math.floor(Math.random() * (b - a)))] = 'fossil';
  }
  for (let k = 1; k <= cs.outposts; k++) buildOutpost(k);
  if (!cs.relicDone && S.relicHeld !== S.cave + 1) placeRelic();
}
function loadCave() {
  const cs = CS(), n = COLS * ROWS;
  DMG = new Float32Array(n);
  if (cs.world && cs.world.length === n) {
    T = Array.from(cs.world, ch => (ch === '.' ? null : CODE[ch] || null));
    SEEN = cs.seen && cs.seen.length === n ? Uint8Array.from(cs.seen, ch => Number(ch) || 0) : new Uint8Array(n);
    DECO = cs.deco && cs.deco.length === n ? Uint8Array.from(cs.deco, ch => Number(ch) || 0) : new Uint8Array(n);
  } else genWorld();
}
// Travel to another cave (from base). Upgrades, coins and cargo come with you.
function switchCave(k) {
  if (k === S.cave || k >= S.unlocked || station() !== 'base') return;
  stashCave();
  S.cave = k;
  loadCave();
  P.x = C.SPAWN.col + 0.5; P.y = C.SPAWN.row + 0.5; P.digging = [];
  wobble.clear(); lastCell = -1; markSeen();
  [camX, camY] = cameraTarget();
  caveIntro();
  save(); updateUI();
}
function caveIntro() {
  const cv = cave();
  if (!S.seenNotes.includes(cv.id)) { S.seenNotes.push(cv.id); toast('Cave ' + (S.cave + 1) + ': ' + cv.name, cv.note); }
  else toast(null, 'Cave ' + (S.cave + 1) + ': ' + cv.name);
}
