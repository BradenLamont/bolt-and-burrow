// Bolt & Burrow — hazards and reactive blocks.
// Every cave slopes down toward its entrance (lower rows), so loose things move that way:
//   unstable rock (Cave 3) shakes and collapses when dug around or passed by, setting off its neighbours
//   sand (Cave 1) slides into an open space toward the entrance
//   boulders (Cave 2) roll toward the entrance until something stops them; walk into one to push it
//   aquifers (Cave 2) are wet rock that floods your tunnels once you open them up
//   gas pockets (Cave 3) explode a moment after you dig next to them
//   magma pockets (Rustvale) spill lava into open floor when opened; lava burns your hull and cools to crust
//   steam vents (Rustvale) hiss, then burst on a timer: don't stand on one when it goes
// A support beam blocks sand and boulders and keeps nearby unstable rock still. The Shield skill
// blocks the next hit.
'use strict';

const wobble = new Map();   // cell index → seconds unstable rock has been shaking
const moveT = new Map();    // cell index → seconds a sand block or boulder has been waiting to move
const fuses = new Map();    // cell index → seconds until a gas pocket explodes
const rolling = new Set();  // boulders already rolling (they hit you; a boulder that just came loose rumbles first)
let floods = [];            // water (or lava) spreading out of opened pockets: { cells, left, t, kind }
const lavaAge = new Map();  // lava cell → seconds since it spilled (it cools to crust)
const ventOn = new Map();   // vent cell → bursting right now?
let burnT = 0;
let hurtCool = 0;

function exposed(c, r) {
  let n = 0;
  for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const t = at(c + a, r + b); if (isFloor(t) || t === 'chasm') n++; }
  return n;
}
const walkerIn = (c, r) => Math.abs(c + 0.5 - P.x) < 0.5 + HB && Math.abs(r + 0.5 - P.y) < 0.5 + HB;
function nearBeam(c, r, rad) {
  for (let rr = r - rad; rr <= r + rad; rr++) for (let cc = c - rad; cc <= c + rad; cc++) if (at(cc, rr) === 'beam') return true;
  return false;
}
function clearHazards() { wobble.clear(); moveT.clear(); fuses.clear(); rolling.clear(); floods = []; lavaAge.clear(); ventOn.clear(); }
// Where a steam vent is in its cycle: 'idle', 'warn' (hissing) or 'burst'
function ventPhase(c, r) {
  const X = C.REACT, ph = (time + hash(c, r, 5) * X.ventCycle) % X.ventCycle;
  return ph > X.ventCycle - X.ventBurst ? 'burst' : ph > X.ventCycle - X.ventBurst - X.ventWarn ? 'warn' : 'idle';
}

// Something hit the walker. Returns false if the Shield blocked it.
function hurt(kind, title, msg) {
  if (hurtCool > 0) return false;
  hurtCool = 0.8;
  P.shake = 0.35;
  if (P.shield) {
    P.shield = false; sfx('shield');
    toast(null, 'Your shield blocked the ' + kind + '!');
    return false;
  }
  const H = kind === 'cave-in' ? { battery: C.ROCK.batteryLoss, cargo: C.ROCK.cargoLoss } : C.REACT.hits[kind];
  const n = cargoCount(), lost = H.cargo ? cargoRemove(n - Math.floor(n * (1 - H.cargo))) : 0;
  sfx('hit');
  toast(title, msg + ' Lost ' + Math.round(H.battery * 100) + '% battery' + (lost ? ' and ' + lost + ' ore' : '') + '.');
  drain(batteryMax() * H.battery);
  return true;
}

function updateRocks(dt) {
  hurtCool = Math.max(0, hurtCool - dt);
  if (inTown()) return;
  const R = C.ROCK, X = C.REACT;
  const r0 = Math.max(BASE_ROWS, pRow() - 14), r1 = Math.min(ROWS - 2, pRow() + 14);
  // Lower rows first, so a block that moves down isn't moved twice in one frame
  for (let r = r0; r <= r1; r++) for (let c = 1; c < COLS - 1; c++) {
    const i = idx(c, r), t = T[i];
    if (t === 'loose') {
      const open = exposed(c, r);
      const near = Math.hypot(c + 0.5 - P.x, r + 0.5 - P.y) <= R.triggerRadius;
      if (nearBeam(c, r, 1)) { wobble.delete(i); continue; }   // braced by a support beam
      if (wobble.has(i) || open >= R.exposedSides || (open >= 1 && near)) {
        const w = (wobble.get(i) || 0) + dt;
        if (w >= R.wobble) { wobble.delete(i); caveIn(c, r); } else wobble.set(i, w);
      }
      continue;
    }
    wobble.delete(i);
    if (t === 'sand' || t === 'boulder') {
      const tr = r - 1, j = idx(c, tr);
      if (tr < BASE_ROWS || T[j] !== null || outpostAt(c, tr)) { moveT.delete(i); rolling.delete(i); continue; }
      if (walkerIn(c, tr)) {   // you're in the way
        if (t === 'boulder') {
          if (rolling.has(i)) hurt('boulder', 'Boulder!', 'A rolling boulder slammed into you.');
          rolling.delete(i); moveT.delete(i);
        } else {
          const w = (moveT.get(i) || 0) + dt;
          if (w >= X.sandSlide * 2) { hurt('sand', 'Sand slide!', 'Sand poured down on you. Dig sand from the side, or brace it with a support beam.'); moveT.set(i, 0); }
          else moveT.set(i, w);
        }
        continue;
      }
      const w = (moveT.get(i) || 0) + dt;
      const need = t === 'sand' ? X.sandSlide : rolling.has(i) ? X.boulderRoll : X.boulderStart;
      moveT.delete(i);
      if (w >= need) {
        T[j] = t; T[i] = null; DMG[j] = DMG[i]; DMG[i] = 0;
        if (t === 'boulder') { rolling.delete(i); rolling.add(j); if (Math.random() < 0.3) sfx('roll'); }   // keeps rolling
        else { burst(c + 0.5, tr + 0.5, C.BLOCKS.sand.color, 3); if (Math.random() < 0.4) sfx('sand'); }
        hintOnce(t, t === 'sand' ? 'Sand' : 'Boulders', t === 'sand'
          ? 'Sand slides toward the entrance whenever there\'s open space below it. A support beam stops it.'
          : 'Boulders roll toward the entrance until something stops them. Walk into one to push it, or brace a tunnel with a support beam.');
      } else moveT.set(i, w);
      continue;
    }
    if (t === 'aquifer') {
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (at(c + a, r + b) === null) {
        T[i] = 'water'; floods.push({ cells: [i], left: X.floodVolume, t: 0, kind: 'water' }); sfx('splash');
        hintOnce('water', 'Water!', 'You opened a water pocket. Wading slows you down and drains your battery.');
        break;
      }
    }
    if (t === 'magma') {
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (at(c + a, r + b) === null) {
        T[i] = 'lava'; lavaAge.set(i, 0); floods.push({ cells: [i], left: X.lavaVolume, t: 0, kind: 'lava' }); sfx('hiss');
        burst(c + 0.5, r + 0.5, '#ff8c3c', 12); SEEN[i] = 1;
        hintOnce('lava', 'Lava!', 'You opened a lava pocket. Lava burns your hull while you stand in it, and cools into a walkable crust after a while.');
        break;
      }
    }
    if (t === 'lava') {   // spilled lava cools into crust
      const a = (lavaAge.get(i) || 0) + dt;
      if (a >= X.lavaCool) { T[i] = 'crust'; lavaAge.delete(i); burst(c + 0.5, r + 0.5, '#6a5a52', 4); } else lavaAge.set(i, a);
    }
    if (t === 'vent') {   // steam vents burst on a timer
      const ph = ventPhase(c, r), on = ph === 'burst', near = Math.hypot(c + 0.5 - P.x, r + 0.5 - P.y);
      if (on && !ventOn.get(i)) { if (near < 7) sfx('hiss'); burst(c + 0.5, r + 0.5, '#d8d0c8', 10); }
      ventOn.set(i, on);
      if (on && near < 0.85) { hurtHull(X.ventDmg, c + 0.5, r + 0.5, 'steam vent'); hintOnce('vent', 'Steam vent', 'Vents hiss for a moment before they burst. Step off them when you hear it.'); }
    }
  }
  updateFloods(dt);
  updateFuses(dt);
  // standing in lava burns your hull
  if (at(pCol(), pRow()) === 'lava') { burnT += dt; if (burnT >= 0.5) { burnT = 0; hurtHull(X.lavaBurn * 0.5, null, null, 'lava'); } } else burnT = 0;
}

// Water pours out one block at a time into open floor next to it
function updateFloods(dt) {
  const X = C.REACT;
  for (const f of floods) {
    f.t += dt;
    const step = f.kind === 'lava' ? X.lavaStep : X.floodStep;
    while (f.t >= step && f.left > 0) {
      f.t -= step;
      let spot = -1;
      for (const i of f.cells) {
        const c = i % COLS, r = (i - c) / COLS;
        for (const [a, b] of [[0, -1], [1, 0], [-1, 0], [0, 1]]) {   // downhill first
          const cc = c + a, rr = r + b;
          if (rr >= BASE_ROWS && at(cc, rr) === null && !outpostAt(cc, rr)) { spot = idx(cc, rr); break; }
        }
        if (spot >= 0) break;
      }
      if (spot < 0) { f.left = 0; break; }
      T[spot] = f.kind || 'water'; f.cells.push(spot); f.left--;
      if (f.kind === 'lava') lavaAge.set(spot, 0);
    }
  }
  floods = floods.filter(f => f.left > 0);
}

// Gas: digging any block next to a pocket (or the pocket itself) lights it
function touchGas(c, r) {
  for (let rr = r - 1; rr <= r + 1; rr++) for (let cc = c - 1; cc <= c + 1; cc++) {
    const i = idx(cc, rr);
    if (inBounds(cc, rr) && T[i] === 'gas' && !fuses.has(i)) {
      fuses.set(i, C.REACT.gasFuse); SEEN[i] = 1; sfx('hiss');
      floatText(cc + 0.5, rr + 0.8, 'Hssss!', '#9fd18a');
      hintOnce('gas', 'Gas pocket!', 'Digging next to a gas pocket lights it. Back away fast, or use a Shield.');
    }
  }
}
function updateFuses(dt) {
  for (const [i, t] of [...fuses]) {
    if (T[i] !== 'gas') { fuses.delete(i); continue; }
    if (t - dt > 0) { fuses.set(i, t - dt); continue; }
    fuses.delete(i);
    const c = i % COLS, r = (i - c) / COLS;
    explode(c, r, C.REACT.gasRadius, true);
  }
}
// Clears a square around (c, r). Hard rock goes too; bedrock, buildings and the relic stay.
// From gas it's a hazard; from a blast charge you collect what breaks.
function explode(c, r, rad, isGas) {
  for (let rr = r - rad; rr <= r + rad; rr++) for (let cc = c - rad; cc <= c + rad; cc++) {
    if (!inBounds(cc, rr) || rr < BASE_ROWS) continue;
    const i = idx(cc, rr), t = T[i];
    if (!t || C.BLOCKS[t].hp === Infinity || t === 'relic') continue;
    if (t === 'gas' && !(cc === c && rr === r)) { fuses.set(i, 0.25); continue; }   // chain reaction
    if (isGas) { T[i] = null; DMG[i] = 0; } else breakBlock(cc, rr, true);
  }
  for (let k = 0; k < 3; k++) burst(c + 0.5, r + 0.5, isGas ? '#9fd18a' : '#f2c94c', 16);
  sfx('boom'); P.shake = 0.5;
  if (isGas && Math.hypot(c + 0.5 - P.x, r + 0.5 - P.y) < C.REACT.gasHit) hurt('gas', 'Gas explosion!', 'A gas pocket went off next to you.');
}

function caveIn(c, r) {
  const R = C.ROCK;
  T[idx(c, r)] = null; DMG[idx(c, r)] = 0;
  burst(c + 0.5, r + 0.5, C.BLOCKS.loose.color, 18);
  sfx('rumble');
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
    if (walkerIn(cc, rr)) continue; // never bury the walker
    T[idx(cc, rr)] = 'rubble';
  }
  P.shake = 0.35;
  if (Math.hypot(c + 0.5 - P.x, r + 0.5 - P.y) < R.hitRadius && hurt('cave-in', 'Cave-in!', 'Unstable rock collapsed on you.')) crewAfterCaveIn();
}

// Walking into a boulder pushes it one block if the space beyond is open
let pushT = 0;
function tryPush(c, r, dx, dy, dt) {
  const tc = c + dx, tr = r + dy, j = idx(tc, tr);
  if (!inBounds(tc, tr) || T[j] !== null || walkerIn(tc, tr) || outpostAt(tc, tr) || tr < BASE_ROWS) return false;
  pushT += dt;
  if (pushT >= C.REACT.pushTime) {
    pushT = 0; T[j] = 'boulder'; T[idx(c, r)] = null; DMG[j] = DMG[idx(c, r)]; DMG[idx(c, r)] = 0;
    moveT.delete(idx(c, r)); rolling.delete(idx(c, r)); sfx('roll');
  }
  return true;
}
