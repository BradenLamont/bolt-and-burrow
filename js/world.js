// Bolt & Burrow — the world: the town, the caves (generation, conveyor and outposts, chasms and
// bridges, caches, relic chambers), and moving between the town and the caves.
'use strict';

// ---------- Conveyor & outposts ----------
// Each cave has a free outpost at its entrance, plus one you build halfway in (25 m).
// The conveyor runs from the entrance to the halfway outpost.
const outpostCount = () => (inTown() ? 0 : CS().outposts);
const outpostRow = k => BASE_ROWS - 1 + C.CONVEYOR.step * k;
const beltEnd = () => (inTown() ? -1 : outpostRow(CS().outposts));
const onBelt = (c, r) => !inTown() && c === BELT && r >= 0 && r <= beltEnd();
function outpostAt(c, r) {
  if (inTown()) return 0;
  for (let k = 1; k <= CS().outposts; k++) { const row = outpostRow(k); if (Math.abs(c - BELT) <= 1 && Math.abs(r - row) <= 1) return k; }
  return 0;
}
const extendCost = () => Math.round(C.CONVEYOR.baseCost * Math.pow(C.CONVEYOR.costGrowth, Math.max(0, S.cave)));
const extendMaxed = () => inTown() || CS().outposts >= C.CONVEYOR.maxOutposts;
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
// A pad deploys the bridge in the two chasm cells beyond it (deeper into the cave), using one of
// this cave's bridge keys.
function deployBridge(c, r) {
  for (let rr = r + 1; rr <= r + 2; rr++) if (at(c, rr) === 'chasm') T[idx(c, rr)] = 'bridge';
}
const padReady = (c, r) => !inTown() && at(c, r) === 'pad' && at(c, r + 1) === 'chasm';

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
  if (inTown()) return null;
  for (let r = C.RELIC.row - 1; r <= C.RELIC.row + 1; r++) for (let c = 0; c < COLS; c++) if (T[idx(c, r)] === 'relic') return { c, r };
  return null;
}

// ---------- Cave generation ----------
// What plain rock looks like at a cell (also what hidden ore and caches look like before they're revealed)
function baseFor(c, r) {
  if (inTown()) return 'cliff';
  const rock = cave().rock;
  if (rock.length === 1) return rock[0];
  return hash(c, r, 7) < Math.min(0.75, (r - BASE_ROWS) / 40) ? rock[1] : rock[0];
}
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

function genCave() {
  const cv = cave(), cs = CS();
  T = new Array(COLS * ROWS).fill(null);
  DECO = new Uint8Array(COLS * ROWS);
  SEEN = new Uint8Array(COLS * ROWS);
  const lastRow = ROWS - 1, beltRows = outpostRow(1) + 1;
  const chasmRows = cv.chasms.map(ch => ch.row);

  // 1. Rock, ore, hard rock and unstable rock
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const i = idx(c, r);
    if (c === 0 || c === COLS - 1 || r === lastRow) { T[i] = 'bedrock'; continue; }
    if (r < BASE_ROWS) continue; // the entrance hall
    let t = baseFor(c, r), x = Math.random();
    for (const [ore, p] of Object.entries(cv.ores)) { if (x < p) { t = ore; break; } x -= p; }
    if (t === baseFor(c, r)) {
      const deep = (r - BASE_ROWS) / (lastRow - BASE_ROWS); // 0 at the mouth, 1 at the end
      const y = Math.random();
      if (y < cv.obsidian * (0.4 + deep)) t = 'obsidian';
      else if (y < (cv.obsidian + cv.granite) * (0.4 + deep)) t = 'granite';
      else if (cv.unstable && y > 1 - cv.unstable) t = 'loose';
      else if (cv.scrap && y > 1 - cv.unstable - cv.scrap) t = 'scrap';   // old machinery (Rustvale)
    }
    // keep the conveyor path to the outpost free of hard rock
    if (c === BELT && r <= beltRows && (t === 'granite' || t === 'obsidian' || t === 'loose' || t === 'scrap')) t = baseFor(c, r);
    T[i] = t;
  }

  // 2. Open caverns, decorated with stalagmites
  for (let n = 0; n < cv.caverns; n++) {
    const cr = randInt(9, C.RELIC.row - 8), cc = randInt(3, COLS - 4), rx = randInt(2, 3), ry = 2;
    if (chasmRows.some(h => Math.abs(h - cr) < 5)) continue;
    for (let r = cr - ry; r <= cr + ry; r++) for (let c = cc - rx; c <= cc + rx; c++) {
      if (c < 1 || c > COLS - 2) continue;
      if (((c - cc) / (rx + 0.5)) ** 2 + ((r - cr) / (ry + 0.5)) ** 2 <= 1) { T[idx(c, r)] = null; DECO[idx(c, r)] = 1; }
    }
  }

  // 3. Chasms: a band two rows thick from wall to wall. Some have an old bridge; each has bridge pads,
  //    and one marked key cache per pad is hidden somewhere before the chasm.
  for (const ch of cv.chasms) {
    const h = ch.row, cross = [];
    while (cross.length < ch.pads + (ch.oldBridge ? 1 : 0)) {
      const c = randInt(2, COLS - 3);
      if (cross.every(o => Math.abs(o - c) >= 5)) cross.push(c);
    }
    for (let c = 1; c < COLS - 1; c++) {
      T[idx(c, h)] = 'chasm'; T[idx(c, h + 1)] = 'chasm';
      const near = cross.some(o => Math.abs(c - o) <= 1);
      if (!near && Math.random() < 0.3) T[idx(c, h - 1)] = 'chasm';
      if (!near && Math.random() < 0.3) T[idx(c, h + 2)] = 'chasm';
    }
    cross.forEach((c, k) => {
      if (ch.oldBridge && k === 0) { T[idx(c, h)] = 'oldbridge'; T[idx(c, h + 1)] = 'oldbridge'; }
      else T[idx(c, h - 1)] = 'pad';
      for (const r of [h - 1, h + 2]) if (['chasm', 'granite', 'obsidian', 'loose'].includes(T[idx(c, r)])) T[idx(c, r)] = baseFor(c, r);
    });
    for (let n = 0, tries = 0; n < ch.pads && tries < 300; tries++) {
      const r = randInt(8, h - 4), c = randInt(1, COLS - 2);
      if (c === BELT || T[idx(c, r)] !== baseFor(c, r)) continue;
      T[idx(c, r)] = 'keycache'; n++;
    }
  }
  // 4. Small pits
  for (let n = 0; n < cv.pits; n++) {
    const pr = randInt(8, C.RELIC.row - 6), pc = randInt(2, COLS - 4);
    if (Math.abs(pc - BELT) < 3 || chasmRows.some(h => Math.abs(h - pr) < 4)) continue;
    for (let r = pr; r <= pr + 1; r++) for (let c = pc; c <= pc + 1; c++) if (T[idx(c, r)] !== 'keycache') T[idx(c, r)] = 'chasm';
  }
  // 5. Treasure caches hidden in plain rock
  for (let n = 0, tries = 0; n < C.CACHE.perCave && tries < 200; tries++) {
    const r = randInt(8, C.RELIC.row - 4), c = randInt(1, COLS - 2);
    if (c === BELT || T[idx(c, r)] !== baseFor(c, r)) continue;
    T[idx(c, r)] = 'cache'; n++;
  }
  // 5b. Reactive blocks: sand patches, boulders, water pockets and gas pockets (only in plain rock,
  //     away from the conveyor path, the chasm and the relic chamber)
  const plain = (c, r) => c > 0 && c < COLS - 1 && Math.abs(c - BELT) > 1 && r >= 7 && r < C.RELIC.row - 4 &&
    !chasmRows.some(h => r >= h - 2 && r <= h + 3) && T[idx(c, r)] === baseFor(c, r);
  for (let n = 0; n < (cv.sand || 0); n++) {
    const pr = randInt(7, C.RELIC.row - 6), pc = randInt(2, COLS - 3), rx = randInt(1, 2), ry = randInt(1, 2);
    for (let r = pr - ry; r <= pr + ry; r++) for (let c = pc - rx; c <= pc + rx; c++)
      if (plain(c, r) && ((c - pc) / (rx + 0.5)) ** 2 + ((r - pr) / (ry + 0.5)) ** 2 <= 1) T[idx(c, r)] = 'sand';
  }
  if (cv.boulders) for (let r = 7; r < C.RELIC.row - 4; r++) for (let c = 1; c < COLS - 1; c++)
    if (plain(c, r) && Math.random() < cv.boulders) T[idx(c, r)] = 'boulder';
  for (const [type, count] of [['aquifer', cv.aquifers || 0], ['gas', cv.gas || 0], ['magma', cv.magma || 0]])
    for (let n = 0, tries = 0; n < count && tries < 300; tries++) {
      const r = randInt(9, C.RELIC.row - 5), c = randInt(2, COLS - 3);
      if (!plain(c, r)) continue;
      T[idx(c, r)] = type; n++;
    }
  // 5c. Steam vents (Rustvale): about half on cavern floors, the rest hidden in the rock as little pockets
  const cavern = [];
  for (let r = 8; r < C.RELIC.row - 4; r++) for (let c = 1; c < COLS - 1; c++) if (DECO[idx(c, r)] === 1 && T[idx(c, r)] === null && Math.abs(c - BELT) > 1) cavern.push(idx(c, r));
  for (let n = 0, tries = 0; n < (cv.vents || 0) && tries < 300; tries++) {
    if (n % 2 === 0 && cavern.length) { T[cavern.splice(Math.floor(Math.random() * cavern.length), 1)[0]] = 'vent'; n++; continue; }
    const r = randInt(9, C.RELIC.row - 5), c = randInt(2, COLS - 3);
    if (!plain(c, r)) continue;
    T[idx(c, r)] = 'vent'; n++;
  }
  // 6. The entrance outpost and exit door, outposts and the relic
  const B = C.BASE_BUILDING;
  for (let r = B.rows[0]; r <= B.rows[1]; r++) for (let c = B.cols[0]; c <= B.cols[1]; c++) T[idx(c, r)] = 'found';
  T[idx(C.EXIT.col, C.EXIT.row)] = 'exit';
  for (let k = 1; k <= cs.outposts; k++) buildOutpost(k);
  // 7. Bosses: a hall before the relic chamber for a mini-boss, or (Cave 3) a boss room that replaces it.
  //    The big boss carries the relic, so it isn't placed in the rock.
  if (cv.boss) {
    const A = C.BOSS_ARENA;
    for (let r = A.rows[0] - 1; r <= A.rows[1] + 1; r++) for (let c = A.cols[0] - 1; c <= A.cols[1] + 1; c++) {
      if (!inBounds(c, r) || r >= ROWS - 1 || c < 1 || c > COLS - 2) continue;
      const wall = r < A.rows[0] || r > A.rows[1] || c < A.cols[0] || c > A.cols[1];
      T[idx(c, r)] = wall ? 'obsidian' : null; DECO[idx(c, r)] = wall ? 0 : 1;
    }
  } else {
    if (cv.miniBoss) {
      const H = C.BOSS_HALL;
      for (let r = H.rows[0]; r <= H.rows[1]; r++) for (let c = H.cols[0]; c <= H.cols[1]; c++) {
        const edge = (r === H.rows[0] || r === H.rows[1]) && (c === H.cols[0] || c === H.cols[1]);
        if (!edge) { T[idx(c, r)] = null; DECO[idx(c, r)] = 1; }
      }
    }
    if (!cs.relicDone && S.relicHeld !== S.cave + 1) placeRelic();
  }
}

// ---------- The town ----------
// Built fresh every time from the config: grass, a path, cliffs with three gates, buildings,
// trees and relic pedestals. Gates open once the previous cave's relic is home.
// Which cave is behind gate k of the current town (null = a sealed "coming soon" gate), and is it open?
const gateCave = k => TOWN().gates[k];
// Each town's caves open one relic at a time: its first cave is open, then each relic opens the next
function caveOpen(cv) {
  const first = C.CAVES.findIndex(c => (c.town || 0) === caveTown(cv));
  return cv === first || cv < S.unlocked || !!(S.caves[cv - 1] && S.caves[cv - 1].relicDone);
}
function gateOpen(k) {
  const cv = gateCave(k);
  return cv != null && caveOpen(cv);
}
function genTown() {
  const TW = C.TOWN, TN = TOWN();
  T = new Array(COLS * ROWS).fill(null);
  DECO = new Uint8Array(COLS * ROWS);
  SEEN = new Uint8Array(COLS * ROWS).fill(1);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (c === 0 || c === COLS - 1 || r >= TW.gateRow) T[idx(c, r)] = 'cliff';
  }
  TW.gates.forEach((g, k) => { T[idx(g, TW.gateRow)] = gateOpen(k) ? 'gate' : 'gatelocked'; });
  const b = TW.shop;
  for (let r = b.rows[0]; r <= b.rows[1]; r++) for (let c = b.cols[0]; c <= b.cols[1]; c++) T[idx(c, r)] = 'found';
  if (TN.shop) for (let k = 0; k < b.doorW; k++) T[idx(b.door + k, b.rows[0])] = 'shopdoor';   // the shop's wide door
  TW.trees.forEach(([c, r]) => { T[idx(c, r)] = 'tree'; });
  if (TN.pedestals) TW.pedestals.forEach(c => { T[idx(c, TW.pedestalRow)] = 'pedestal'; });
  T[idx(C.BOARD.col, C.BOARD.row)] = 'board';   // the contracts board
  // train station: tracks across the bottom row, a stone platform above them (DECO 3)
  const ST = TW.station;
  for (let c = 0; c < COLS; c++) T[idx(c, ST.railRow)] = 'rail';
  for (let c = 1; c < COLS - 1; c++) DECO[idx(c, ST.platformRow)] = 3;
  // a dirt path from the platform up to each gate (decoration)
  for (let r = ST.platformRow + 1; r < TW.gateRow; r++) DECO[idx(TW.spawn.col, r)] = 2;
  const pathRow = TW.gateRow - 2;
  for (let c = TW.gates[0]; c <= TW.gates[2]; c++) DECO[idx(c, pathRow)] = 2;
  TW.gates.forEach(g => { for (let r = pathRow; r < TW.gateRow; r++) DECO[idx(g, r)] = 2; });
  for (let k = 0; k < b.doorW; k++) DECO[idx(b.door + k, b.rows[0] - 1)] = 2;   // a doorstep in front of the shop
}

// ---------- Pip's shop (inside the SHOP building) ----------
// One room: the door at the bottom, display stands along the side walls, Pip's counter at the back.
function genShop() {
  const SH = C.SHOP, [c0, c1] = SH.cols;
  T = new Array(COLS * ROWS).fill('void');
  DECO = new Uint8Array(COLS * ROWS);
  SEEN = new Uint8Array(COLS * ROWS).fill(1);
  for (let r = 0; r < ROWS; r++) for (let c = c0 - 1; c <= c1 + 1; c++) {
    const edge = c === c0 - 1 || c === c1 + 1 || r === 0 || r === ROWS - 1;
    T[idx(c, r)] = edge ? 'shopwall' : null;
  }
  for (let k = 0; k < SH.doorW; k++) T[idx(SH.door + k, 0)] = 'shopdoor';
  for (let c = c0; c <= c1; c++) T[idx(c, SH.counterRow)] = 'counter';
  SH.stands.forEach(st => { T[idx(st.col, st.row)] = 'stand'; });
}
// ---------- Loading areas and moving between them ----------
function loadArea() {
  ROWS = inShop() ? C.SHOP.rows : inTown() ? C.TOWN.rows : C.ROWS;
  const n = COLS * ROWS;
  DMG = new Float32Array(n);
  if (inShop()) return genShop();
  if (inTown()) return genTown();
  const cs = CS();
  if (cs.world && cs.world.length === n) {
    T = Array.from(cs.world, ch => (ch === '.' ? null : CODE[ch] || null));
    SEEN = cs.seen && cs.seen.length === n ? Uint8Array.from(cs.seen, ch => Number(ch) || 0) : new Uint8Array(n);
    DECO = cs.deco && cs.deco.length === n ? Uint8Array.from(cs.deco, ch => Number(ch) || 0) : new Uint8Array(n);
  } else genCave();
}
function arrive(x, y, dir) {
  P.x = x; P.y = y; P.dir = dir; P.digging = [];
  clearHazards(); flares.length = 0; clearDrops(); lastCell = -1; markSeen(); spawnFoes();
  resizeMinimap(); resize();
  [camX, camY] = cameraTarget();
  save(); updateUI();
}
// Walk through an open gate in town
function enterCave(k) {
  if (k == null) return;
  sfx('door');
  S.cave = k;
  loadArea();
  arrive(C.SPAWN.col + 0.5, C.SPAWN.row + 0.5, 'up');
  const cv = cave();
  if (!S.seenNotes.includes(cv.id)) { S.seenNotes.push(cv.id); toast(caveLabel(k) + ': ' + cv.name, cv.note); }
  else toast(null, caveLabel(k) + ': ' + cv.name);
}
// Walk out of a cave's exit door
function goToTown() {
  sfx('door');
  const from = S.cave;
  stashCave();
  S.cave = -1;
  loadArea();
  const gk = Math.max(0, TOWN().gates.indexOf(from));
  arrive(C.TOWN.gates[gk] + 0.5, C.TOWN.gateRow - 1.5, 'down');
  toast(null, 'Back in town.');
}
// Walk through the SHOP door in town, and back out again
function enterShop() {
  sfx('door');
  S.cave = -2;
  loadArea();
  arrive(C.SHOP.door + C.SHOP.doorW / 2, 1.5, 'up');
  hintOnce('shop', TOWN().shop === 'garage' ? 'Pip\'s Salvage Garage' : 'Pip\'s Burrow Workshop', 'Walk up to a display stand to look at parts, or to Pip at the counter to sell ore and materials.');
}
function leaveShop() {
  sfx('door');
  S.cave = -1;
  loadArea();
  arrive(C.TOWN.shop.door + C.TOWN.shop.doorW / 2, C.TOWN.shop.rows[0] - 0.5, 'down');
}
