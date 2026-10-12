// Bolt & Burrow — the cave: generation, the conveyor and outposts, and the relic chamber.
'use strict';

// ---------- Conveyor & outposts ----------
// Outpost k (1, 2, 3…) sits on the conveyor at depth 25k. The conveyor runs from the yard to the last outpost.
const outpostRow = k => BASE_ROWS - 1 + C.CONVEYOR.step * k;
const beltEnd = () => outpostRow(S.outposts);
const onBelt = (c, r) => c === BELT && r >= 0 && r <= beltEnd();
function outpostAt(c, r) {
  for (let k = 1; k <= S.outposts; k++) { const row = outpostRow(k); if (Math.abs(c - BELT) <= 1 && Math.abs(r - row) <= 1) return k; }
  return 0;
}
const extendCost = () => Math.round(C.CONVEYOR.baseCost * Math.pow(C.CONVEYOR.costGrowth, S.outposts));
// The conveyor stops short of the relic chamber, so the last stretch is always on foot.
const extendMaxed = () => outpostRow(S.outposts + 1) + 2 >= C.RELIC.row - 1;
// Conveyor cells that still need digging before the next outpost can be built
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

// ---------- Relic chamber ----------
function placeRelic() {
  const r = C.RELIC.row;
  let c; do { c = 3 + Math.floor(Math.random() * (COLS - 6)); } while (Math.abs(c - BELT) < 2);
  for (let rr = r - 1; rr <= r + 1; rr++) for (let cc = c - 1; cc <= c + 1; cc++) T[idx(cc, rr)] = null;
  T[idx(c, r)] = 'relic';
  S.relicPlaced = true;
}
function relicCell() {
  const r = C.RELIC.row;
  for (let c = 0; c < COLS; c++) if (T[idx(c, r)] === 'relic') return { c, r };
  return null;
}

// ---------- Generation ----------
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
  if (!S.relics && !S.relicHeld) placeRelic();
  SEEN = new Uint8Array(COLS * ROWS);
}
function loadWorld() {
  if (S.world && S.world.length === COLS * ROWS) {
    T = Array.from(S.world, ch => (ch === '.' ? null : CODE[ch] || null));
    SEEN = S.seen && S.seen.length === COLS * ROWS ? Uint8Array.from(S.seen, ch => (ch === '1' ? 1 : 0)) : new Uint8Array(COLS * ROWS);
    if (!S.relicPlaced && !S.relics && !S.relicHeld) placeRelic(); // older saves get a relic too
  } else genWorld();
}
// What an ore block looks like before you've lit it up: the plain rock around it.
function baseFor(c, r) {
  if (biomeAt(r).id === 'basalt') return 'basalt';
  return hash(c, r, 7) < Math.min(0.75, (r - BASE_ROWS) / 55) ? 'clay' : 'dirt';
}
