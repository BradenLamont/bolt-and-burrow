// Bolt & Burrow — the tool belt (single-use tools bought from Pip) and active skills
// (the computer's bottom row, recharged by your nano-bot).
'use strict';

// ---------- Tool belt ----------
const TOOL_IDS = Object.keys(C.TOOLS);
const beltSlots = () => C.BELT_SLOTS + S.tiers.body;
const beltTypes = () => TOOL_IDS.filter(id => (S.tools[id] || 0) > 0);
function buyTool(id) {
  const t = C.TOOLS[id], n = S.tools[id] || 0;
  if (shopSpot() !== 'counter') return;
  if (n >= t.max) return toast(null, 'Pip: "That slot\'s full. You can carry ' + t.max + ' at most."');
  if (!n && beltTypes().length >= beltSlots()) return toast(null, 'Pip: "Your belt has no free slot. Put a tool back first, or get a bigger Tank."');
  if (S.coins < t.cost) return;
  S.coins -= t.cost; S.tools[id] = n + 1; sfx('buy');
  hintOnce('belt', 'Tool belt', 'Use tools in a cave with the number keys (1–4) or the buttons by the Recall button.');
  save();
}
function returnTool(id) {   // Pip buys tools back at full price, so you can change your loadout
  if (shopSpot() !== 'counter' || !(S.tools[id] > 0)) return;
  S.tools[id]--; S.coins += C.TOOLS[id].cost; sfx('sell'); save();
}
// The cell in front of the walker, and the direction it faces
function facing() {
  const d = { up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0] }[P.dir] || [0, 1];
  return { dx: d[0], dy: d[1], c: pCol() + d[0], r: pRow() + d[1] };
}
const flares = [];   // { x, y, t } lights placed in the cave
function useTool(id) {
  if (inTown() || !(S.tools[id] > 0)) return;
  const f = facing();
  if (id === 'blast') {
    explode(f.c, f.r, 1, false);
  } else if (id === 'beam') {
    const i = idx(pCol(), pRow());
    if (T[i] !== null || onBelt(pCol(), pRow()) || pRow() < BASE_ROWS) return toast(null, 'A support beam needs open ground to stand on.');
    T[i] = 'beam'; sfx('tool');
  } else if (id === 'flare') {
    const F = C.TOOLS.flare;
    flares.push({ x: P.x, y: P.y, t: F.time });
    revealAround(P.x, P.y, F.radius, false); sfx('tool');
  } else if (id === 'grapple') {
    if (!['chasm'].includes(at(f.c, f.r))) return toast(null, 'Face a chasm to use the grapple.');
    let k = 1;
    while (k <= 4 && at(pCol() + f.dx * k, pRow() + f.dy * k) === 'chasm') k++;
    const lc = pCol() + f.dx * k, lr = pRow() + f.dy * k, lt = at(lc, lr);
    if (k > 4 || (lt && !isFloor(lt) && C.BLOCKS[lt].hp === Infinity)) return toast(null, 'Too far, or nothing to hook onto over there.');
    if (lt && !isFloor(lt)) breakBlock(lc, lr);
    P.x = lc + 0.5; P.y = lr + 0.5; P.digging = []; lastCell = -1; finishMove();
    burst(P.x, P.y, '#a8a39c', 12); sfx('dash');
  }
  S.tools[id]--;
  save();
}
function updateFlares(dt) {
  for (let k = flares.length - 1; k >= 0; k--) { flares[k].t -= dt; if (flares[k].t <= 0) flares.splice(k, 1); }
}
// Mark cells as seen within a radius. With `scan`, also ping caches and show hidden hazards.
function revealAround(x, y, rad, scan) {
  for (let r = Math.max(0, Math.floor(y - rad)); r <= Math.min(ROWS - 1, Math.ceil(y + rad)); r++)
    for (let c = Math.max(0, Math.floor(x - rad)); c <= Math.min(COLS - 1, Math.ceil(x + rad)); c++) {
      if (Math.hypot(c + 0.5 - x, r + 0.5 - y) > rad) continue;
      const i = idx(c, r);
      if (scan && T[i] === 'cache') SEEN[i] = 2;
      else if (!SEEN[i]) SEEN[i] = 1;
    }
}

// ---------- Active skills ----------
const activeSkill = () => { const p = S.grid.find(g => C.MODS[g.id].active); return p ? p.id : null; };
const skillTime = id => C.MODS[id].eff[modLevel(id) - 1];
const pulses = [];   // scan pulse rings to draw
function updateSkills(dt) {
  P.burstT = Math.max(0, (P.burstT || 0) - dt);
  updateFlares(dt);
  for (let k = pulses.length - 1; k >= 0; k--) { pulses[k].t += dt; if (pulses[k].t > 1) pulses.splice(k, 1); }
  const id = activeSkill();
  if (!id || !S.bots) return;
  const was = S.skillCharge;
  S.skillCharge = Math.min(1, S.skillCharge + dt / skillTime(id));
  if (was < 1 && S.skillCharge >= 1) { sfx('ready'); hintOnce('skill-ready', C.MODS[id].name + ' ready', 'Press Space or Q, or tap the skill button, to use it. Your nano-bot recharges it.'); }
}
function useSkill() {
  const id = activeSkill();
  if (!id) return;
  if (inTown()) return toast(null, 'Skills work in the caves.');
  if (S.skillCharge < 1) return toast(null, C.MODS[id].name + ' is still charging.');
  const m = C.MODS[id];
  if (m.battery && drain(m.battery)) return;
  S.skillCharge = 0;
  if (id === 'dash') {
    const f = facing();
    let moved = 0;
    for (let k = 0; k < 30; k++) {   // up to 3 blocks, stopping at anything solid
      const nx = P.x + f.dx * 0.1, ny = P.y + f.dy * 0.1;
      if (boxSolid(nx, ny)) break;
      P.x = nx; P.y = ny; moved++;
    }
    burst(P.x, P.y, '#86cfdc', 14); lastCell = -1; finishMove(); sfx('dash');
    if (!moved) toast(null, 'Something\'s in the way.');
  }
  if (id === 'burst') { P.burstT = 4; sfx('skill'); floatText(P.x, P.y + 0.8, 'Drill Burst!', '#f2c94c'); }
  if (id === 'pulse') {
    revealAround(P.x, P.y, 8, true);
    pulses.push({ x: P.x, y: P.y, t: 0 }); sfx('pulse');
  }
  if (id === 'shield') { P.shield = true; sfx('shield'); floatText(P.x, P.y + 0.8, 'Shield up', '#86cfdc'); }
}
