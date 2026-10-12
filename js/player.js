// Bolt & Burrow — the robot: movement, digging, battery, stations, recall and fast travel.
// World coordinates: P.x, P.y is the centre of the robot's hitbox in blocks.
// Higher y = deeper into the cave (drawn further UP the screen).
'use strict';

const HB = C.BODY / 2, EPS = 1e-4;
const P = { x: C.SPAWN.col + 0.5, y: C.SPAWN.row + 0.5, battery: 0, face: 1, dir: 'up', digging: [], shake: 0, riding: false, warned: false };
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

// ---------- Stations: the base yard and outpost pads ----------
function station() {
  if (pRow() < BASE_ROWS) return 'base';
  if (outpostAt(pCol(), pRow())) return 'outpost';
  return null;
}
// Fast travel: 0 = base, k = outpost k
function travelTo(k) {
  if (!station()) return;
  if (k === 0) { P.x = C.SPAWN.col + 0.5; P.y = C.SPAWN.row + 0.5; }
  else { P.x = BELT - 0.5; P.y = outpostRow(k) + 0.5; }
  P.digging = []; lastCell = -1; finishMove();
  toast(null, 'Travelled to ' + (k ? 'Outpost ' + k : 'base') + '.');
}

// ---------- Battery ----------
// Returns true if the battery ran out (the robot gets recalled to base).
function drain(amount) {
  P.battery -= amount;
  if (P.battery <= 0) { recall('dead'); return true; }
  return false;
}
// Roughly how much power the trip back needs: walk to the conveyor, walk along it to
// where it ends (if you're past it), then ride it for free. Assumes the way is already dug.
function returnCost() {
  if (station()) return 0;
  const end = beltEnd() + 0.5;
  const walk = Math.abs(P.x - (BELT + 0.5)) + Math.max(0, P.y - end);
  return walk * C.BATTERY.move * legs().eff * C.LOW_BATTERY.safety;
}
const lowBattery = () => !station() && P.battery < returnCost() + C.LOW_BATTERY.buffer;

function recall(kind) {
  const n = cargoCount();
  let msg;
  if (kind === 'dead') {
    S.cargo.items = {};
    msg = n ? 'A recovery drone hauled you back to base. Your ' + n + ' ore was lost.' : 'A recovery drone hauled you back to base.';
  } else {
    const lost = cargoRemove(n - Math.floor(n * C.RECALL.keepCargo));
    msg = n ? 'The drone dropped ' + lost + ' ore on the way. You kept ' + (n - lost) + '.' : 'A drone carried you back to base.';
  }
  if (S.relicHeld) msg += ' The relic made it back safely.';
  P.x = C.SPAWN.col + 0.5; P.y = C.SPAWN.row + 0.5; P.battery = batteryMax(); P.digging = [];
  toast(kind === 'dead' ? 'Battery dead' : 'Recalled', msg);
}

// At a station: sell ore, claim the relic, recharge
function sellAndCharge(dt) {
  const here = station();
  if (!here) return;
  P.warned = false;
  const n = cargoCount();
  if (n > 0) {
    const value = Math.floor(cargoValue());
    S.coins += value; S.cargo.items = {};
    floatText(P.x, P.y + 0.6, '+' + fmt(value), '#e8a160');
    toast(null, 'Sold ' + n + ' ore for ' + fmt(value) + ' coins' + (here === 'outpost' ? ' at the outpost. The conveyor carries it up.' : ' at base.'));
  }
  if (S.relicHeld) {
    S.relicHeld = false; S.relics++; S.coins += C.RELIC.reward;
    toast(C.RELIC.name + ' recovered!', 'You claimed ' + fmt(C.RELIC.reward) + ' coins. That\'s the end of this version. More caves are coming.');
    save();
  }
  P.battery = Math.min(batteryMax(), P.battery + C.CHARGE_RATE * dt);
}

// ---------- Digging ----------
function breakBlock(c, r) {
  const i = idx(c, r), t = T[i];
  T[i] = null; DMG[i] = 0;
  const B = C.BLOCKS[t];
  burst(c + 0.5, r + 0.5, B.ore || B.color || (t === 'relic' ? '#c9a2ff' : C.BLOCKS[baseFor(c, r)].color), t === 'relic' ? 30 : 10);
  if (B.value) {
    if (cargoCount() < cargoMax()) {
      cargoAdd(t, Math.round(B.value * (1 + (r - BASE_ROWS) / C.ORE_DEPTH_BONUS)));
      floatText(c + 0.5, r + 0.7, '+' + B.label, B.ore);
    } else floatText(c + 0.5, r + 0.7, 'Cargo full', '#e2705a');
  }
  if (t === 'fossil') {
    S.pet = 1; regenPet();
    toast('A fossil!', C.PET.name + ' the ' + C.PET.species + ' hatched and moved into your burrow.');
  }
  if (t === 'relic') {
    S.relicHeld = true;
    toast('You found the ' + C.RELIC.name + '!', 'Carry it back to base or any outpost to claim it. It won\'t take up cargo space.');
    save();
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
  P.digging.push({ c, r });
  if (Math.random() < dt * 18) burst(c + 0.5, r + 0.5, C.BLOCKS[t].color || C.BLOCKS[baseFor(c, r)].color, 1);
  if (DMG[i] >= C.BLOCKS[t].hp) { breakBlock(c, r); drain(C.BATTERY.dig); }
}
// Dig every block along the robot's leading edge. Standing between two blocks digs both.
function digEdge(axis, dir, dt) {
  if (axis === 'x') {
    const c = Math.floor(dir > 0 ? P.x + HB + 0.02 : P.x - HB - 0.02);
    for (let r = Math.floor(P.y - HB + EPS); r <= Math.floor(P.y + HB - EPS); r++) if (solidAt(c, r)) dig(c, r, dt);
  } else {
    const r = Math.floor(dir > 0 ? P.y + HB + 0.02 : P.y - HB - 0.02);
    for (let c = Math.floor(P.x - HB + EPS); c <= Math.floor(P.x + HB - EPS); c++) if (solidAt(c, r)) dig(c, r, dt);
  }
}

// ---------- Movement ----------
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
// Ease toward the middle of a lane when you're already close to it (helps with 1-wide tunnels).
function align(axis, dt) {
  const target = Math.floor(P[axis]) + 0.5, d = target - P[axis];
  if (Math.abs(d) > C.ALIGN_SNAP) return;
  const step = C.ALIGN_SPEED * dt;
  const nv = P[axis] + (Math.abs(d) < step ? d : Math.sign(d) * step);
  if (!(axis === 'x' ? boxSolid(nv, P.y) : boxSolid(P.x, nv))) P[axis] = nv;
}

function updatePlayer(dt) {
  P.digging = [];
  const h = horizDir(), v = vertDir();
  const dx = h === 'left' ? -1 : h === 'right' ? 1 : 0;
  const dy = v === 'up' ? 1 : v === 'down' ? -1 : 0;   // up the screen = deeper
  if (dx) P.face = dx;
  if (dx && !dy) P.dir = h; else if (dy && !dx) P.dir = v;

  // Riding the conveyor: stand on the belt and move along it with no battery cost
  P.riding = onBelt(pCol(), pRow()) && !dx && dy !== 0 && Math.abs(P.x - (BELT + 0.5)) < 0.3;
  if (P.riding) {
    const d = BELT + 0.5 - P.x; P.x += Math.sign(d) * Math.min(Math.abs(d), C.ALIGN_SPEED * dt);
    const ny = P.y + dy * C.CONVEYOR.speed * dt;
    if (ny >= 0.5 && ny <= beltEnd() + 0.5 && !boxSolid(P.x, ny)) { P.y = ny; finishMove(); return; }
    P.riding = false; // reached an end of the belt; carry on walking
  }
  if (!dx && !dy) { finishMove(); return; }

  const sp = legs().speed;
  const len = Math.hypot(dx, dy), vx = dx / len * sp, vy = dy / len * sp;
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

  if (hitX) digEdge('x', dx, dt);
  if (hitY) digEdge('y', dy, dt);
  finishMove();
}

let lastBiome = null, lastCell = -1;
function finishMove() {
  if (lowBattery() && !P.warned) { P.warned = true; toast('Low battery', 'Head back to the conveyor or an outpost. The mark on the battery bar is roughly what the trip needs.'); }
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
