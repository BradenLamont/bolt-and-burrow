// Bolt & Burrow — the Canopy Walker: an orange mining mech piloted by your mono-eye robot.
// Drawn on a 64×64 grid (the same grid as the concept art), facing front, back or side.
// Each part slot changes one piece of the drawing:
//   head → canopy (Glass Bubble, Armored Visor, Sensor Dome)
//   arms → both tools (Rock Claws, Drill Arms, Plasma Cutters)
//   body → back tank (Small Tank, Twin Tanks, Reactor Tank)
//   legs → legs (Piston Legs, Spring Struts, Hover Jets)
'use strict';

const W_OUT = '#17130F', W_ORANGE = '#E07A2E', W_ORANGE_DARK = '#A85620', W_ORANGE_LIGHT = '#F09A55';
const W_STEEL = '#4A5059', W_STEEL_LIGHT = '#8E96A0', W_STEEL_MID = '#5D646E', W_DARK = '#3B3F46';
const W_GLASS = 'rgba(134,207,220,0.28)', W_GLASS_TINT = 'rgba(134,207,220,0.45)', W_CYAN = '#9FE3F0';
const W_PILOT = '#8F8B85', W_PILOT_HEAD = '#6B8F9C', W_VISOR = '#1A2A30', W_COPPER = '#D9813B';

// ---------- Small drawing helpers (all in grid units) ----------
const wPaths = new Map();
function wPath(c, d, fill, stroke = W_OUT, alpha = 1) {
  let p = wPaths.get(d); if (!p) { p = new Path2D(d); wPaths.set(d, p); }
  c.globalAlpha = alpha;
  if (fill) { c.fillStyle = fill; c.fill(p); }
  c.globalAlpha = 1;
  if (stroke) { c.strokeStyle = stroke; c.stroke(p); }
}
function wRect(c, x, y, w, h, r, fill, stroke = W_OUT) {
  rr2(c, x, y, w, h, Math.min(r, w / 2, h / 2) || 0.01);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.stroke(); }
}
function wCirc(c, x, y, r, fill, stroke = null, alpha = 1) {
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
  c.globalAlpha = alpha; c.fillStyle = fill; c.fill(); c.globalAlpha = 1;
  if (stroke) { c.strokeStyle = stroke; c.stroke(); }
}
function wEll(c, x, y, rx, ry, fill, stroke = W_OUT, alpha = 1) {
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.globalAlpha = alpha; c.fillStyle = fill; c.fill(); c.globalAlpha = 1;
  if (stroke) { c.strokeStyle = stroke; c.stroke(); }
}
function wLine(c, d, color, width = 1) { c.lineWidth = width; wPath(c, d, null, color); c.lineWidth = 1; }
// Hazard stripes inside a box
function wStripes(c, x, y, w, h) {
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.strokeStyle = W_OUT; c.lineWidth = 1.6;
  for (let k = x - h; k < x + w; k += 4) { c.beginPath(); c.moveTo(k, y + h); c.lineTo(k + h, y); c.stroke(); }
  c.restore(); c.lineWidth = 1;
}

// ---------- Legs (drawn at a local origin; lift = how far the foot is raised) ----------
function wLeg(c, type, lx, lift, back, t) {
  c.save(); c.translate(lx, -lift);
  if (type === 'treads') {           // Piston Legs
    wRect(c, 0, 38, 7, 9, 1, back ? W_DARK : W_STEEL);
    wRect(c, 1.5, 46, 4, 7, 0, back ? W_STEEL_MID : W_STEEL_LIGHT);
    wEll(c, 3.5, 55, 8, 3.5, back ? W_ORANGE_DARK : W_ORANGE);
  } else if (type === 'springs') {   // Spring Struts
    wRect(c, 0, 38, 7, 7, 1, back ? W_DARK : W_STEEL);
    wLine(c, 'M3.5 45 L0 46.5 L7 48.2 L0 49.9 L7 51.6 L3.5 53', '#C99A52', 1.6);
    wRect(c, -4, 52, 15, 5, 2, back ? W_ORANGE_DARK : W_ORANGE);
    wRect(c, -3, 55, 13, 1.4, 0, W_DARK, null);
  } else {                           // Hover Jets
    wRect(c, 0, 38, 7, 9, 1, back ? W_DARK : W_STEEL);
    const flame = 6 + Math.sin(t * 40 + lx) * 1.2;
    wPath(c, 'M1 53 H6 L3.5 ' + (53 + flame).toFixed(1) + ' Z', W_CYAN, null, 0.9);
    wPath(c, 'M-2 46 H9 L7.5 53 H-0.5 Z', '#5E7C86');
  }
  c.restore();
}

// ---------- Pilot and canopy ----------
function wCanopyFront(c, head) {
  if (head === 'quantum') { wLine(c, 'M27 11.5 L24.5 5.5 M37 11.5 L39.5 5.5', W_OUT, 1.2); wCirc(c, 24.5, 5.2, 1.2, W_CYAN, W_OUT); wCirc(c, 39.5, 5.2, 1.2, W_CYAN, W_OUT); }
  if (head === 'dome') {             // Armored Visor: steel plate with an eye slit
    wPath(c, 'M18 25 A14 15 0 0 1 46 25 Z', W_STEEL_MID);
    wLine(c, 'M20.5 24.5 A11.5 12 0 0 1 43.5 24.5', W_STEEL_LIGHT, 0.8);
    wRect(c, 22, 12.4, 20, 3.6, 1.8, W_VISOR);
    wCirc(c, 32, 14.2, 3, W_CYAN, null, 0.4); wCirc(c, 32, 14.2, 1.4, W_CYAN);
    [[22, 20], [42, 20], [26, 9.5], [38, 9.5]].forEach(([x, y]) => wCirc(c, x, y, 0.7, '#2D333D'));
  } else {
    wRect(c, 27, 16, 10, 8, 1.5, W_PILOT);
    wPath(c, 'M26.5 16.5 A5.5 5.5 0 0 1 37.5 16.5 Z', W_PILOT_HEAD);
    wRect(c, 28.2, 12.6, 7.6, 2.4, 1.2, W_VISOR, null);
    wCirc(c, 32, 13.8, head === 'quantum' ? 3.8 : 3.4, W_CYAN, null, 0.38);
    wCirc(c, 32, 13.8, 1.5, W_CYAN);
    wPath(c, 'M18 25 A14 15 0 0 1 46 25 Z', head === 'quantum' ? W_GLASS_TINT : W_GLASS);
    wLine(c, 'M22 20 Q25 14 31 12', 'rgba(255,255,255,0.55)', 1.4);
  }
  wRect(c, 17, 23.5, 30, 3, 1.5, head === 'quantum' ? W_DARK : W_STEEL_MID);
  if (head === 'quantum') for (const x of [21, 26.5, 32, 37.5, 43]) wCirc(c, x, 25, 0.9, W_CYAN);
}
function wCanopyBack(c, head) {
  if (head === 'quantum') { wLine(c, 'M27 11.5 L24.5 5.5 M37 11.5 L39.5 5.5', W_OUT, 1.2); wCirc(c, 24.5, 5.2, 1.2, W_CYAN, W_OUT); wCirc(c, 39.5, 5.2, 1.2, W_CYAN, W_OUT); }
  if (head === 'dome') { wPath(c, 'M21 22 A11 11 0 0 1 43 22 Z', W_STEEL_MID); return; }
  wPath(c, 'M27 19 A5 5 0 0 1 37 19 Z', W_PILOT_HEAD);
  wPath(c, 'M21 22 A11 11 0 0 1 43 22 Z', head === 'quantum' ? W_GLASS_TINT : W_GLASS);
}
function wCanopySide(c, head) {
  if (head === 'quantum') { wLine(c, 'M30 11 L28 5', W_OUT, 1.2); wCirc(c, 28, 4.7, 1.2, W_CYAN, W_OUT); }
  if (head === 'dome') {
    wPath(c, 'M19 25 A13 15 0 0 1 46 25 Z', W_STEEL_MID);
    wRect(c, 31, 12.4, 12, 3.4, 1.7, W_VISOR);
    wCirc(c, 37, 14.1, 2.6, W_CYAN, null, 0.4); wCirc(c, 37, 14.1, 1.3, W_CYAN);
  } else {
    wRect(c, 25, 16, 10, 8, 1.5, W_PILOT);
    wPath(c, 'M24.5 16.5 A5.5 5.5 0 0 1 35.5 16.5 Z', W_PILOT_HEAD);
    wRect(c, 31, 12.6, 5, 2.4, 1.2, W_VISOR, null);
    wCirc(c, 34.3, 13.8, 3.2, W_CYAN, null, 0.38); wCirc(c, 34.3, 13.8, 1.4, W_CYAN);
    wPath(c, 'M19 25 A13 15 0 0 1 46 25 Z', head === 'quantum' ? W_GLASS_TINT : W_GLASS);
    wLine(c, 'M36 13 Q41 15 43 20', 'rgba(255,255,255,0.55)', 1.4);
  }
  wRect(c, 18, 23.5, 29, 3, 1.5, head === 'quantum' ? W_DARK : W_STEEL_MID);
}

// ---------- Body: chest (front), back tank, side tank ----------
function wChest(c, body) {
  if (body === 'reactor') {
    wCirc(c, 32, 35, 6.5, '#F2A65A', null, 0.35); wCirc(c, 32, 35, 3.8, '#E08A42', W_OUT); wCirc(c, 32, 35, 1.6, '#FFE2B0');
    wCirc(c, 22.5, 35, 1.8, '#F2D27A', W_OUT); wCirc(c, 41.5, 35, 1.8, '#F2D27A', W_OUT);
    return;
  }
  wCirc(c, 24, 35, 2.6, '#F2D27A', W_OUT); wCirc(c, 40, 35, 2.6, '#F2D27A', W_OUT);
  wRect(c, 29, 32, 6, 7, 1, W_DARK, null);
  wLine(c, 'M30.5 33.5 V37.5 M33.5 33.5 V37.5', W_STEEL_MID);
  if (body === 'iron') wRect(c, 19, 39.4, 26, 1.6, 0, W_COPPER, null);
}
function wTankBack(c, body, t) {
  if (body === 'tin') {
    wRect(c, 22, 21, 20, 19, 6, W_DARK); wRect(c, 22, 26, 20, 2, 0, W_COPPER, null); wCirc(c, 32, 32, 2.4, W_CYAN, W_OUT);
  } else if (body === 'iron') {
    wRect(c, 19, 21, 12, 19, 5, W_DARK); wRect(c, 33, 21, 12, 19, 5, W_DARK);
    wRect(c, 19, 26, 12, 2, 0, W_COPPER, null); wRect(c, 33, 26, 12, 2, 0, W_COPPER, null);
    wCirc(c, 25, 32, 2, W_CYAN, W_OUT); wCirc(c, 39, 32, 2, W_CYAN, W_OUT);
    wRect(c, 30, 27, 4, 3, 0, W_STEEL_MID);
  } else {
    wRect(c, 15.5, 8, 4, 16, 1, W_STEEL_MID); wRect(c, 15.5, 8, 4, 2, 0, W_CYAN, null);
    wRect(c, 44.5, 8, 4, 16, 1, W_STEEL_MID); wRect(c, 44.5, 8, 4, 2, 0, W_CYAN, null);
    wRect(c, 20, 19, 24, 21, 6, '#2D333D');
    wCirc(c, 32, 29.5, 7 + Math.sin(t * 5) * 0.6, '#F2A65A', null, 0.35);
    wCirc(c, 32, 29.5, 4.6, '#E08A42', W_OUT); wCirc(c, 32, 29.5, 2, '#FFE2B0');
    wLine(c, 'M21.5 23 H26 M38 23 H42.5 M21.5 36 H26 M38 36 H42.5', W_CYAN, 1.2);
  }
}
function wTankSide(c, body, t) {
  if (body === 'reactor') {
    wRect(c, 8.5, 9, 3.5, 13, 1, W_STEEL_MID); wRect(c, 8.5, 9, 3.5, 2, 0, W_CYAN, null);
    wRect(c, 5, 20, 12, 22, 4, '#2D333D');
    wCirc(c, 11, 31, 4.6 + Math.sin(t * 5) * 0.4, '#F2A65A', null, 0.35); wCirc(c, 11, 31, 3, '#E08A42', W_OUT);
  } else if (body === 'iron') {
    wRect(c, 8.5, 12, 3.5, 10, 1, W_STEEL_MID);
    wRect(c, 4, 20, 13, 22, 3, W_DARK); wRect(c, 4, 26, 13, 2, 0, W_COPPER, null); wRect(c, 4, 34, 13, 2, 0, W_COPPER, null);
  } else {
    wRect(c, 8.5, 11, 3.5, 11, 1, W_STEEL_MID);
    wRect(c, 6, 21, 11, 20, 3, W_DARK); wRect(c, 6, 28, 11, 2, 0, W_COPPER, null);
  }
}

// ---------- Arms (one arm; ox = arm's left edge, jab = dig thrust) ----------
function wArmDown(c, tool, ox, jab, t) {
  c.save(); c.translate(ox, jab);
  wRect(c, 0, 31, 8, 9, 1.5, W_STEEL);
  if (tool === 'pincers') {
    const open = Math.max(0, Math.sin(t * 16)) * (jab ? 1.2 : 0);
    wRect(c, -1.5, 39.5, 11, 3, 1, W_STEEL_LIGHT);
    wPath(c, 'M-1 42.5 L' + (-2.5 - open).toFixed(2) + ' 49 L1 48 Z M4 42.5 L4 50 L6 48.5 Z M9 42.5 L' + (10.5 + open).toFixed(2) + ' 49 L7 48 Z', '#AAA39A');
  } else if (tool === 'drills') {
    wPath(c, 'M-1.5 40 H9.5 L4 52 Z', '#D9A54A');
    const ph = jab ? (t * 30) % 3 : 0;
    wLine(c, 'M0.5 ' + (43 + ph).toFixed(2) + ' L7.5 ' + (44.5 + ph).toFixed(2) + ' M1.5 ' + (46.5 + ph).toFixed(2) + ' L6.5 ' + (47.6 + ph).toFixed(2), '#8A6420');
  } else {
    wRect(c, -1, 39.5, 10, 3, 1, W_DARK);
    const len = 53 + (jab ? Math.sin(t * 50) * 1.5 : 0);
    wPath(c, 'M0 42.5 H8 L4 ' + len.toFixed(1) + ' Z', W_CYAN, null, 0.85);
    wPath(c, 'M2 42.5 H6 L4 ' + (len - 4).toFixed(1) + ' Z', '#FFFFFF', null, 0.7);
  }
  c.restore();
}
function wArmSide(c, tool, jab, t) {
  c.save(); c.translate(jab, 0);
  wRect(c, 38, 30, 11, 6, 1.5, W_STEEL);
  if (tool === 'pincers') {
    const open = Math.max(0, Math.sin(t * 16)) * (jab ? 1.2 : 0);
    wRect(c, 48, 29, 3, 8, 1, W_STEEL_LIGHT);
    wPath(c, 'M51 29.5 L58 ' + (28 - open).toFixed(2) + ' L57 31 Z M51 33 L59 33 L57.5 35 Z M51 36.5 L58 ' + (38 + open).toFixed(2) + ' L57 35.5 Z', '#AAA39A');
  } else if (tool === 'drills') {
    wPath(c, 'M49 28.5 V37.5 L60 33 Z', '#D9A54A');
    const ph = jab ? (t * 30) % 3 : 0;
    wLine(c, 'M' + (52 + ph).toFixed(2) + ' 30 L' + (53 + ph).toFixed(2) + ' 36 M' + (55.5 + ph).toFixed(2) + ' 31.5 L' + (56 + ph).toFixed(2) + ' 34.5', '#8A6420');
  } else {
    wRect(c, 48, 29, 3, 8, 1, W_DARK);
    const len = 62 + (jab ? Math.sin(t * 50) * 1.5 : 0);
    wPath(c, 'M51 30 V36 L' + len.toFixed(1) + ' 33 Z', W_CYAN, null, 0.85);
    wPath(c, 'M51 31.5 V34.5 L' + (len - 5).toFixed(1) + ' 33 Z', '#FFFFFF', null, 0.7);
  }
  c.restore();
}
function wPauldrons(c) {
  wRect(c, 4, 22, 13, 9, 2, W_ORANGE); wStripes(c, 5, 27, 11, 3);
  wRect(c, 47, 22, 13, 9, 2, W_ORANGE); wStripes(c, 48, 27, 11, 3);
}

// ---------- The whole walker ----------
// view: 'front' (toward base), 'back' (deeper into the cave) or 'side'; flip = -1 faces left.
// anim: { moving, digging }
function drawWalker(c, x, y, k, view, flip, t, ids, anim) {
  const jets = ids.legs === 'jets';
  const step = anim.moving && !jets ? Math.sin(t * 11) : 0;
  const liftA = Math.max(0, step) * 2.2, liftB = Math.max(0, -step) * 2.2;
  const bob = jets ? Math.sin(t * 4) * 0.8 : Math.abs(step) * 0.7;
  const jab = anim.digging ? Math.sin(t * 28) * 1.6 : 0;

  c.save();
  c.translate(x, y); c.scale(k * (view === 'side' ? flip : 1), k); c.translate(-32, -58);
  c.lineWidth = 1; c.lineJoin = 'round'; c.lineCap = 'round';

  if (jets) wEll(c, 32, 60.5, 18, 2, W_CYAN, null, 0.18); else wEll(c, 32, 59.5, 22, 3, '#000', null, 0.35);

  if (view === 'side') {
    wLeg(c, ids.legs, 23, liftB, true, t);
    c.save(); c.translate(0, -bob);
    wTankSide(c, ids.body, t);
    wPath(c, 'M15 27 Q15 23 19 23 H44 Q49 23 49 28 L46 41 Q45 43 43 43 H20 Q17 43 16 41 Z', W_ORANGE);
    wRect(c, 17, 23.6, 29, 4, 2, W_ORANGE_LIGHT, null);
    if (ids.body === 'reactor') { wCirc(c, 45, 34, 3.4, '#F2A65A', null, 0.35); wCirc(c, 45, 34, 2, '#E08A42', W_OUT); }
    else wCirc(c, 45, 34, 2.4, '#F2D27A', W_OUT);
    wCanopySide(c, ids.head);
    c.restore();
    wLeg(c, ids.legs, 31, liftA, false, t);
    c.save(); c.translate(0, -bob);
    wRect(c, 26, 24, 14, 9, 2, W_ORANGE); wStripes(c, 27, 29, 12, 3);
    wArmSide(c, ids.arms, jab, t);
    c.restore();
  } else {
    const back = view === 'back';
    wLeg(c, ids.legs, 19, liftA, back, t);
    wLeg(c, ids.legs, 38, liftB, back, t);
    c.save(); c.translate(0, -bob);
    wPath(c, 'M14 27 Q14 23 18 23 H46 Q50 23 50 27 L47 41 Q46 43 44 43 H20 Q18 43 17 41 Z', W_ORANGE);
    if (back) {
      wCanopyBack(c, ids.head);
      wTankBack(c, ids.body, t);
    } else {
      wRect(c, 16, 23.6, 32, 4, 2, W_ORANGE_LIGHT, null);
      wChest(c, ids.body);
      wCanopyFront(c, ids.head);
    }
    wPauldrons(c);
    // digging toward the camera (front) pushes the arms down the screen; digging deeper pushes them up
    const j = back ? -jab : jab;
    wArmDown(c, ids.arms, 6.5, anim.digging ? j : 0, t);
    wArmDown(c, ids.arms, 49.5, anim.digging ? -j : 0, t);
    c.restore();
  }
  c.restore();
}
