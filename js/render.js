// Bolt & Burrow — drawing. The cave is shown from above in 2.5D: every solid block is a
// raised wall with a top face and a shaded front face. Your base is at the bottom of the
// screen and deeper rows are drawn further up.
// Rows are drawn top of screen to bottom, so nearer walls overlap the walker and walls behind them.
// The walker itself is drawn by walker.js.
'use strict';

// ---------- Effects ----------
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
function updateEffects(dt) {
  particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; p.life -= dt; });
  particles = particles.filter(p => p.life > 0);
  floats.forEach(f => { f.y += 0.8 * dt; f.life -= dt; }); floats = floats.filter(f => f.life > 0);
  for (let i = petFloats.length - 1; i >= 0; i--) { petFloats[i].life -= dt; if (petFloats[i].life <= 0) petFloats.splice(i, 1); }
  if (P.shake > 0) P.shake -= dt;
}

// ---------- Canvas setup ----------
const stage = $('stage'), cv = $('world'), g = cv.getContext('2d');
const pcv = $('pet'), pg = pcv.getContext('2d');
let padTop = 0, padBot = 0, VW = 1, VH = 1, PW = 1, PH = 1, CELL = 40, camX = 0, camY = 0, time = 0;
function fit(canvas, ctx) {
  const r = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return [r.width, r.height];
}
function resize() {
  [VW, VH] = fit(cv, g); [PW, PH] = fit(pcv, pg);
  // the HUD (top) and controls (bottom) sit over the canvas; the town is fitted between them
  const sr = stage.getBoundingClientRect(), hud = document.querySelector('.hud').getBoundingClientRect();
  const ctl = document.querySelector('.controls').getBoundingClientRect();
  padTop = Math.max(0, hud.bottom - sr.top); padBot = Math.max(0, sr.bottom - ctl.top);
  // the town is shown whole; caves zoom in a little closer
  CELL = Math.max(22, Math.floor(Math.min(VW / 15, inTown() ? (VH - padTop - padBot) / (C.TOWN.rows + 0.4) : VH / 9.5)));
}
new ResizeObserver(resize).observe(stage);
new ResizeObserver(resize).observe($('burrowView'));

// Camera targets: keep the robot centred, but don't scroll past the yard at the bottom
function cameraTarget() {
  const s = CELL, worldW = COLS * s;
  const tx = worldW <= VW ? (worldW - VW) / 2 : Math.max(0, Math.min(worldW - VW, P.x * s - VW / 2));
  if (inTown()) return [tx, -(padTop + (VH - padTop - padBot - ROWS * s) / 2) + s * 0.25];   // the whole town fits between the HUD and controls
  let ty = (ROWS - P.y) * s - VH * 0.55;
  ty = Math.min(ty, ROWS * s - VH + s * 1.4);   // room under the bottom row for the controls
  ty = Math.max(ty, -s * 1.6);                  // room above the top row for the HUD
  return [tx, ty];
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(v * k)));
  return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')';
}
function rr2(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

// ---------- Floor, belt, walls ----------
function drawFloor(c, r, x, y, s) {
  const t = at(c, r);
  if (t === 'chasm') return drawChasm(c, r, x, y, s);
  if (t === 'bridge' || t === 'oldbridge') { drawChasm(c, r, x, y, s); return drawBridge(c, r, x, y, s, t === 'oldbridge'); }
  const town = inTown(), hall = !town && r < BASE_ROWS, path = town && DECO[idx(c, r)] === 2;
  if (town && DECO[idx(c, r)] === 3) return drawPlatform(c, r, x, y, s);
  g.fillStyle = town ? (path ? '#7a6248' : '#3c4a2c') : hall ? '#3a3128' : cave().floor;
  g.fillRect(x, y, s, s);
  g.fillStyle = town && !path ? 'rgba(120,150,80,.25)' : 'rgba(255,230,200,.05)';
  g.fillRect(x + s * (0.2 + hash(c, r, 3) * 0.5), y + s * (0.2 + hash(c, r, 4) * 0.5), s * 0.1, s * 0.1);
  if (t === 'exit') drawExit(x, y, s);
  if (t === 'gate') { g.fillStyle = '#120d0a'; g.fillRect(x + s * 0.12, y, s * 0.76, s); }
  if (!town && DECO[idx(c, r)] && hash(c, r, 11) < 0.35) drawStalagmite(c, r, x, y, s);
  if (t === 'pad') drawPad(c, r, x, y, s);
  if (outpostAt(c, r)) { // outpost landing pad
    g.fillStyle = 'rgba(217,129,59,.16)'; g.fillRect(x, y, s, s);
    g.strokeStyle = 'rgba(217,129,59,.35)'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
  }
  if (onBelt(c, r)) drawBelt(x, y, s);
}
// A chasm: a dark drop. Where solid ground lies beyond it (up the screen) you see the far wall.
function drawChasm(c, r, x, y, s) {
  const isGap = t => t === 'chasm' || t === 'bridge' || t === 'oldbridge';
  const depth = g.createLinearGradient(0, y, 0, y + s);
  depth.addColorStop(0, '#0a0809'); depth.addColorStop(1, '#030203');
  g.fillStyle = depth; g.fillRect(x, y, s, s);
  // far wall: where solid ground lies beyond the chasm (up the screen), you see its rock face
  if (!isGap(at(c, r + 1))) {
    const wall = g.createLinearGradient(0, y, 0, y + s * 0.75);
    wall.addColorStop(0, shade(C.BLOCKS[baseFor(c, r)].color, 0.7)); wall.addColorStop(1, 'rgba(3,2,3,0)');
    g.fillStyle = wall; g.fillRect(x, y, s, s * 0.75);
    g.fillStyle = 'rgba(0,0,0,.35)'; for (let k = 0; k < 3; k++) g.fillRect(x + s * (0.15 + hash(c, r, k + 40) * 0.7), y + s * 0.1, 2, s * (0.2 + hash(r, c, k + 40) * 0.3));
  }
  // near edge: a lit rim of ground where the drop begins
  if (!isGap(at(c, r - 1))) {
    g.fillStyle = shade(cave().floor, 1.9); g.fillRect(x, y + s - Math.max(3, s * 0.08), s, Math.max(3, s * 0.08));
    g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(x, y + s - Math.max(3, s * 0.08) - 2, s, 2);
  }
  // side edges
  g.fillStyle = 'rgba(255,230,200,.08)';
  if (!isGap(at(c - 1, r))) g.fillRect(x, y, 2, s);
  if (!isGap(at(c + 1, r))) g.fillRect(x + s - 2, y, 2, s);
}
// Bridges run up the screen, across the chasm. Old ones are weathered wood; deployed ones are steel.
function drawBridge(c, r, x, y, s, old) {
  const bx = x + s * 0.18, bw = s * 0.64;
  g.fillStyle = old ? '#4a3a2a' : '#3b3f46'; g.fillRect(bx, y, bw, s);
  g.fillStyle = old ? '#7a5f42' : '#5d646e';
  const n = 4;
  for (let k = 0; k < n; k++) {
    if (old && hash(c, r, k + 20) < 0.15) continue; // a missing plank
    g.fillRect(bx + 2, y + k * s / n + 2, bw - 4, s / n - 4);
  }
  g.fillStyle = old ? '#a28565' : '#d9813b';
  g.fillRect(x + s * 0.14, y, Math.max(2, s * 0.05), s); g.fillRect(x + s * 0.81, y, Math.max(2, s * 0.05), s);
}
// A bridge pad: steel plate with a lamp. Amber = ready to deploy, green = bridge deployed.
function drawPad(c, r, x, y, s) {
  const ready = padReady(c, r);
  g.fillStyle = '#3b3f46'; rr2(g, x + s * 0.1, y + s * 0.1, s * 0.8, s * 0.8, s * 0.1); g.fill();
  g.strokeStyle = '#e8b33a'; g.lineWidth = Math.max(2, s * 0.05); g.setLineDash([s * 0.1, s * 0.08]);
  g.strokeRect(x + s * 0.16, y + s * 0.16, s * 0.68, s * 0.68); g.setLineDash([]);
  g.fillStyle = '#5d646e';
  g.beginPath(); g.moveTo(x + s * 0.5, y + s * 0.28); g.lineTo(x + s * 0.68, y + s * 0.5); g.lineTo(x + s * 0.32, y + s * 0.5); g.closePath(); g.fill();
  const on = ready ? (Math.sin(time * 5) > 0 ? '#f2b84b' : '#8a6420') : '#7fd17a';
  g.fillStyle = on; g.beginPath(); g.arc(x + s * 0.5, y + s * 0.66, s * 0.08, 0, 7); g.fill();
}
// The door from a cave's entrance hall back to town
function drawExit(x, y, s) {
  g.fillStyle = '#16110d'; g.fillRect(x + s * 0.15, y + s * 0.1, s * 0.7, s * 0.9);
  g.strokeStyle = '#6a5038'; g.lineWidth = Math.max(2, s * 0.06); g.strokeRect(x + s * 0.15, y + s * 0.1, s * 0.7, s * 0.9);
  g.fillStyle = '#7fd17a';
  g.beginPath(); g.moveTo(x + s * 0.5, y + s * 0.8); g.lineTo(x + s * 0.68, y + s * 0.55); g.lineTo(x + s * 0.32, y + s * 0.55); g.closePath(); g.fill();
  g.fillStyle = '#efe3d3'; g.textAlign = 'center'; g.font = '600 ' + Math.max(8, Math.round(s * 0.16)) + 'px "IBM Plex Mono", monospace';
  g.fillText('TOWN', x + s * 0.5, y + s * 0.4);
}
// Cavern floors get stalagmites (and crystals in the Basalt Deeps). Decoration only.
function drawStalagmite(c, r, x, y, s) {
  const cx = x + s * (0.2 + hash(c, r, 12) * 0.6), by = y + s * (0.55 + hash(c, r, 13) * 0.35), h = s * (0.25 + hash(c, r, 14) * 0.25);
  const crystal = cave().id === 'deeps' && hash(c, r, 15) < 0.5;
  g.fillStyle = crystal ? 'rgba(159,227,240,.75)' : shade(C.BLOCKS[cave().rock[0]].color, 1.05);
  g.beginPath(); g.moveTo(cx - s * 0.08, by); g.lineTo(cx, by - h); g.lineTo(cx + s * 0.08, by); g.closePath(); g.fill();
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.moveTo(cx, by - h); g.lineTo(cx + s * 0.08, by); g.lineTo(cx, by); g.closePath(); g.fill();
}

// Chevrons run toward the base (down the screen): the belt carries ore home.
function drawBelt(x, y, s) {
  g.fillStyle = '#2b2622'; g.fillRect(x + s * 0.18, y, s * 0.64, s);
  g.fillStyle = '#6a5038'; g.fillRect(x + s * 0.14, y, s * 0.05, s); g.fillRect(x + s * 0.81, y, s * 0.05, s);
  g.strokeStyle = 'rgba(217,129,59,.5)'; g.lineWidth = Math.max(1, s * 0.04);
  const off = ((time * 1.5) % 1) * s * 0.5;
  for (let k = -1; k < 3; k++) {
    const yy = y + k * s * 0.5 + off;
    if (yy < y || yy > y + s - s * 0.14) continue;
    g.beginPath(); g.moveTo(x + s * 0.32, yy); g.lineTo(x + s * 0.5, yy + s * 0.14); g.lineTo(x + s * 0.68, yy); g.stroke();
  }
}

function drawWall(t, c, r, x, y, s, W) {
  const i = idx(c, r), seen = SEEN[i];
  if (t === 'tree') return drawTree(c, r, x, y, s, W);
  if (t === 'pedestal') return drawPedestal(c, r, x, y, s, W);
  if (t === 'rail') return drawRail(c, r, x, y, s);
  const hidden = t === 'cache' ? seen !== 2 : (ORES.has(t) || t === 'fossil' || t === 'relic' || t === 'keycache') && !seen;
  const look = hidden ? baseFor(c, r) : t;
  const base = C.BLOCKS[look].color || C.BLOCKS[baseFor(c, r)].color;
  const ty = y - W; // top face
  const front = at(c, r - 1);
  if (isFloor(front) || front === 'chasm') { // front face, where open floor lies in front (below on screen)
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
  } else if (look === 'relic') {
    g.fillStyle = '#2a2433'; g.fillRect(x, ty, s, s);
    g.fillStyle = '#c9a2ff'; g.shadowColor = '#c9a2ff'; g.shadowBlur = 12 + Math.sin(time * 3) * 4;
    g.beginPath(); g.moveTo(x + s * 0.5, ty + s * 0.12); g.lineTo(x + s * 0.82, ty + s * 0.5); g.lineTo(x + s * 0.5, ty + s * 0.88); g.lineTo(x + s * 0.18, ty + s * 0.5); g.closePath(); g.fill();
    g.shadowBlur = 0; g.fillStyle = '#efe6ff'; g.fillRect(x + s * 0.45, ty + s * 0.3, s * 0.1, s * 0.4);
  } else {
    g.fillStyle = base; g.fillRect(x, ty, s, s);
    const bev = Math.max(2, s * 0.07);
    g.fillStyle = 'rgba(255,240,220,.08)'; g.fillRect(x, ty, s, bev); g.fillRect(x, ty, bev, s);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + s - bev, ty, bev, s);
    if (look === 'basalt') { g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(x + s * (0.15 + hash(c, r, 1) * 0.4), ty + s * (0.25 + hash(c, r, 2) * 0.4), s * 0.3, s * 0.07); }
    if (look === 'bedrock') { g.fillStyle = '#211b20'; for (let k = 0; k < 3; k++) g.fillRect(x + s * 0.1, ty + s * (0.2 + k * 0.28), s * 0.8, s * 0.06); }
    if (look === 'stone') { g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x + s * (0.15 + hash(c, r, 1) * 0.5), ty + s * (0.3 + hash(c, r, 2) * 0.4), s * 0.25, s * 0.06); }
    if (look === 'granite') { // speckled, chunky: needs Drill Arms
      for (let k = 0; k < 7; k++) { g.fillStyle = k % 2 ? 'rgba(255,255,255,.55)' : 'rgba(40,30,36,.55)'; g.fillRect(x + s * (0.12 + hash(c, r, k + 30) * 0.72), ty + s * (0.12 + hash(r, c, k + 30) * 0.72), Math.max(2, s * 0.06), Math.max(2, s * 0.06)); }
      g.strokeStyle = 'rgba(40,30,36,.45)'; g.lineWidth = Math.max(1, s * 0.03); g.strokeRect(x + s * 0.06, ty + s * 0.06, s * 0.88, s * 0.88);
    }
    if (look === 'obsidian') { // glossy black glass with a purple sheen: needs Plasma Cutters
      g.fillStyle = 'rgba(160,120,220,.22)';
      g.beginPath(); g.moveTo(x + s * 0.15, ty + s * 0.85); g.lineTo(x + s * 0.55, ty + s * 0.15); g.lineTo(x + s * 0.7, ty + s * 0.15); g.lineTo(x + s * 0.3, ty + s * 0.85); g.closePath(); g.fill();
      g.fillStyle = 'rgba(220,200,255,.35)'; g.fillRect(x + s * 0.62, ty + s * 0.2, s * 0.06, s * 0.06);
    }
  }
  if (t === 'gatelocked') drawLockedGate(c, r, x, ty, s);
  if (!hidden && t === 'keycache') { // a marked crate holding a bridge key: visible once your light reaches it
    g.fillStyle = '#3b3f46'; rr2(g, x + s * 0.18, ty + s * 0.26, s * 0.64, s * 0.5, s * 0.06); g.fill();
    g.strokeStyle = '#9fe3f0'; g.lineWidth = Math.max(1.5, s * 0.04); g.strokeRect(x + s * 0.22, ty + s * 0.3, s * 0.56, s * 0.42);
    g.fillStyle = '#9fe3f0'; g.beginPath(); g.arc(x + s * 0.42, ty + s * 0.51, s * 0.08, 0, 7); g.fill();
    g.fillRect(x + s * 0.48, ty + s * 0.49, s * 0.2, s * 0.05); g.fillRect(x + s * 0.6, ty + s * 0.49, s * 0.04, s * 0.1);
  }
  if (!hidden && t === 'cache') { // a treasure cache the scanner has found
    g.fillStyle = '#5a3a1e'; rr2(g, x + s * 0.2, ty + s * 0.32, s * 0.6, s * 0.42, s * 0.05); g.fill();
    g.fillStyle = '#7a5230'; rr2(g, x + s * 0.2, ty + s * 0.24, s * 0.6, s * 0.16, s * 0.06); g.fill();
    g.fillStyle = '#f2c94c'; g.fillRect(x + s * 0.2, ty + s * 0.38, s * 0.6, s * 0.05); g.fillRect(x + s * 0.46, ty + s * 0.36, s * 0.08, s * 0.14);
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

// ---------- Buildings (drawn as one piece over their cells) ----------
// Y(y) converts a world y position to a screen y.
// Town decorations and features
function drawTree(c, r, x, y, s, W) {
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x + s * 0.5, y + s * 0.85, s * 0.4, s * 0.12, 0, 0, 7); g.fill();
  g.fillStyle = '#5a3d26'; g.fillRect(x + s * 0.42, y + s * 0.35, s * 0.16, s * 0.5);
  g.fillStyle = '#2f4a2a'; g.beginPath(); g.arc(x + s * 0.5, y + s * 0.15, s * 0.48, 0, 7); g.fill();
  g.fillStyle = '#3f6236'; g.beginPath(); g.arc(x + s * 0.4, y + s * 0.02, s * 0.3, 0, 7); g.fill();
}
function drawPedestal(c, r, x, y, s, W) {
  const k = C.TOWN.pedestals.indexOf(c), done = k >= 0 && S.caves[k].relicDone;
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x + s * 0.5, y + s * 0.88, s * 0.4, s * 0.1, 0, 0, 7); g.fill();
  g.fillStyle = '#5b5753'; g.fillRect(x + s * 0.2, y + s * 0.15 - W * 0.5, s * 0.6, s * 0.75);
  g.fillStyle = '#7a756f'; g.fillRect(x + s * 0.12, y + s * 0.05 - W * 0.5, s * 0.76, s * 0.18);
  if (done) {
    const cx = x + s * 0.5, cy = y - W * 0.5 - s * 0.12;
    g.fillStyle = 'rgba(201,162,255,' + (0.25 + Math.sin(time * 2.5) * 0.12) + ')'; g.beginPath(); g.arc(cx, cy, s * 0.42, 0, 7); g.fill();
    g.fillStyle = '#c9a2ff'; g.beginPath(); g.moveTo(cx, cy - s * 0.24); g.lineTo(cx + s * 0.17, cy); g.lineTo(cx, cy + s * 0.24); g.lineTo(cx - s * 0.17, cy); g.closePath(); g.fill();
  } else {
    g.fillStyle = '#2a2433'; g.fillRect(x + s * 0.38, y - W * 0.5 - s * 0.02, s * 0.24, s * 0.08);
  }
}
// Train station: stone platform, tracks and the parked train
function drawPlatform(c, r, x, y, s) {
  g.fillStyle = '#6d6862'; g.fillRect(x, y, s, s);
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x, y, 1, s); g.fillRect(x, y + s * 0.5, s, 1);   // paving joints
  g.fillStyle = '#d9b23b'; g.fillRect(x, y + s * 0.8, s, s * 0.06);                          // safety line by the edge
  g.fillStyle = '#4a4642'; g.fillRect(x, y + s * 0.9, s, s * 0.1);                           // platform edge
  if (c === C.TOWN.station.door) { // where you board
    g.strokeStyle = 'rgba(217,129,59,.55)'; g.lineWidth = Math.max(1, s * 0.04);
    g.strokeRect(x + s * 0.15, y + s * 0.15, s * 0.7, s * 0.55);
  }
}
function drawRail(c, r, x, y, s) {
  g.fillStyle = '#3d3630'; g.fillRect(x, y, s, s);                                           // gravel bed
  g.fillStyle = 'rgba(255,240,220,.06)';
  for (let k = 0; k < 6; k++) g.fillRect(x + s * hash(c, k, 50), y + s * hash(k, c, 51), 2, 2);
  g.fillStyle = '#5a3f2a'; for (let k = 0; k < 3; k++) g.fillRect(x + s * (0.08 + k * 0.33), y + s * 0.18, s * 0.14, s * 0.64); // sleepers
  g.fillStyle = '#9a948c'; g.fillRect(x, y + s * 0.28, s, s * 0.07); g.fillRect(x, y + s * 0.65, s, s * 0.07); // rails
}
function drawTrain(X, Y, s, W) {
  const ST = C.TOWN.station, [c0, c1] = ST.train, row = ST.railRow;
  const top = Y(row + 1) + s * 0.12 - W * 1.6, roofH = s * 0.5, bottom = Y(row + 1) + s * 0.85;
  const cars = [[c0, c0 + 2, true], [c0 + 3, c0 + 5, false], [c0 + 6, c1, false]];   // locomotive, then two coaches
  cars.forEach(([a, b, loco]) => {
    const x = X(a) + s * 0.06, w = (b - a + 1) * s - s * 0.12;
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x + s * 0.05, bottom - s * 0.02, w, s * 0.08);   // shadow
    g.fillStyle = loco ? '#5b3a24' : '#3f4a52'; rr2(g, x, top, w, roofH, s * 0.12); g.fill();    // roof
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x + s * 0.1, top + roofH * 0.35, w - s * 0.2, roofH * 0.12);
    g.fillStyle = loco ? '#c9692a' : '#2f3940'; g.fillRect(x, top + roofH, w, bottom - top - roofH); // side
    g.fillStyle = '#d9813b'; g.fillRect(x, bottom - s * 0.16, w, s * 0.05);                     // stripe
    const winY = top + roofH + s * 0.08, winH = Math.max(3, (bottom - top - roofH) * 0.35);
    if (loco) {
      g.fillStyle = '#16110d'; g.fillRect(x + w - s * 0.9, winY, s * 0.6, winH);                // cab window
      g.fillStyle = '#ffd98a'; g.beginPath(); g.arc(x + s * 0.12, top + roofH + s * 0.12, s * 0.07, 0, 7); g.fill(); // headlight
      g.fillStyle = '#3a2b20'; g.fillRect(x + s * 0.4, top - s * 0.12, s * 0.22, s * 0.2);      // stack
    } else {
      for (let k = 0; k < b - a + 1; k++) {
        const wx = x + k * s + s * 0.2;
        const door = a + k === ST.door;
        g.fillStyle = door ? '#1b1410' : 'rgba(255,217,138,.75)';
        g.fillRect(wx, door ? winY - s * 0.02 : winY, s * 0.5, door ? bottom - winY - s * 0.17 : winH);
      }
    }
  });
  // couplings
  g.fillStyle = '#2a1f17';
  for (const c of [c0 + 3, c0 + 6]) g.fillRect(X(c) - s * 0.08, bottom - s * 0.3, s * 0.16, s * 0.08);
  // station sign on the platform's left end
  const sx = X(2), sy = Y(ST.platformRow + 1) - s * 0.15;
  g.fillStyle = '#2a1f17'; g.fillRect(sx + s * 0.45, sy + s * 0.3, s * 0.1, s * 0.55);
  g.fillStyle = '#3a2b20'; rr2(g, sx - s * 0.6, sy - s * 0.1, s * 2.2, s * 0.48, 3); g.fill();
  g.textAlign = 'center'; g.fillStyle = '#efe3d3'; g.font = '700 ' + Math.round(s * 0.2) + 'px "Pixelify Sans", monospace';
  g.fillText('STATION', sx + s * 0.5, sy + s * 0.12);
  g.fillStyle = '#d9813b'; g.font = '500 ' + Math.round(s * 0.13) + 'px "IBM Plex Mono", monospace';
  g.fillText('NEXT TOWN SOON', sx + s * 0.5, sy + s * 0.3);
}
// A sealed cave gate: a heavy door with a relic-shaped slot
function drawLockedGate(c, r, x, ty, s) {
  g.fillStyle = '#4a372a'; g.fillRect(x + s * 0.1, ty + s * 0.1, s * 0.8, s * 0.9);
  g.fillStyle = '#2a1f17'; for (let k = 1; k < 4; k++) g.fillRect(x + s * 0.1 + k * s * 0.2, ty + s * 0.1, 2, s * 0.9);
  g.fillStyle = '#6a5038'; g.fillRect(x + s * 0.1, ty + s * 0.35, s * 0.8, s * 0.07); g.fillRect(x + s * 0.1, ty + s * 0.72, s * 0.8, s * 0.07);
  g.fillStyle = '#16110d'; const cx = x + s * 0.5, cy = ty + s * 0.55;
  g.beginPath(); g.moveTo(cx, cy - s * 0.14); g.lineTo(cx + s * 0.1, cy); g.lineTo(cx, cy + s * 0.14); g.lineTo(cx - s * 0.1, cy); g.closePath(); g.fill();
}
// Town gate arches and signs, drawn over the cliff
function drawGates(X, Y, s, W) {
  const TW = C.TOWN, r = TW.gateRow;
  TW.gates.forEach((gc, k) => {
    const x = X(gc), y = Y(r + 1) - W, open = k < S.unlocked;
    g.strokeStyle = '#6a5038'; g.lineWidth = Math.max(3, s * 0.1);
    g.beginPath(); g.moveTo(x + s * 0.08, y + s + W); g.lineTo(x + s * 0.08, y + s * 0.2); g.arc(x + s * 0.5, y + s * 0.2, s * 0.42, Math.PI, 0); g.lineTo(x + s * 0.92, y + s + W); g.stroke();
    const sx = x - s * 0.9, sy = y - s * 0.8, w = s * 2.8, h = s * 0.62;
    g.fillStyle = '#3a2b20'; rr2(g, sx, sy, w, h, 3); g.fill();
    g.textAlign = 'center';
    g.fillStyle = open ? '#efe3d3' : '#a8937c'; g.font = '700 ' + Math.round(s * 0.22) + 'px "Pixelify Sans", monospace';
    g.fillText('CAVE ' + (k + 1) + (S.caves[k].relicDone ? ' · CLEARED' : ''), sx + w / 2, sy + h * 0.42);
    g.fillStyle = open ? '#d9813b' : '#a8937c'; g.font = '500 ' + Math.round(s * 0.16) + 'px "IBM Plex Mono", monospace';
    g.fillText(open ? C.CAVES[k].name.toUpperCase() : 'SEALED', sx + w / 2, sy + h * 0.82);
  });
}
function drawBaseBuilding(X, Y, s, W, B = C.BASE_BUILDING, label = 'OUTPOST') {
  const x = X(B.cols[0]), w = (B.cols[1] - B.cols[0] + 1) * s, h = (B.rows[1] - B.rows[0] + 1) * s;
  const y = Y(B.rows[1] + 1) - W * 2.2;
  g.fillStyle = '#3a2b20'; g.fillRect(x, y, w, h);                                      // roof
  g.fillStyle = '#4a372a'; for (let k = 1; k < 6; k++) g.fillRect(x, y + k * h / 6, w, 2);
  g.fillStyle = '#2a1f17'; g.fillRect(x, y + h, w, W * 2.2);                            // front wall
  g.fillStyle = '#e8a160'; g.fillRect(x + s * 0.4, y + h + W * 0.5, s * 0.5, W * 0.9);   // window
  g.fillStyle = '#16110d'; g.fillRect(x + w - s * 1.1, y + h + W * 0.4, s * 0.6, W * 1.8); // door
  g.fillStyle = '#efe3d3'; g.font = '700 ' + Math.round(s * 0.42) + 'px "Pixelify Sans", monospace'; g.textAlign = 'center';
  g.fillText(label, x + w / 2, y + h / 2 + s * 0.15);
}
function drawOutpost(k, X, Y, s, W) {
  const row = outpostRow(k), x = X(BELT + 2), y = Y(row + 1) - W * 1.6;
  g.fillStyle = '#3a2b20'; g.fillRect(x, y, s, s * 2);
  g.fillStyle = '#4b4038'; g.fillRect(x + s * 0.1, y + s * 0.1, s * 0.8, s * 1.8);
  g.fillStyle = '#2a1f17'; g.fillRect(x, y + s * 2, s, W * 1.6);
  g.fillStyle = 'rgba(217,129,59,' + (0.7 + Math.sin(time * 4) * 0.3) + ')'; g.beginPath(); g.arc(x + s * 0.5, y + s * 0.5, s * 0.14, 0, 7); g.fill();
  g.fillStyle = '#efe3d3'; g.font = '700 ' + Math.round(s * 0.3) + 'px "Pixelify Sans", monospace'; g.textAlign = 'center';
  g.fillText('OP' + k, x + s * 0.5, y + s * 1.3);
}

const partIds = () => ({ head: part('head').id, arms: part('arms').id, body: part('body').id, legs: part('legs').id });

// ---------- The cave ----------
let lastDrawX = 0, lastDrawY = 0;
function render(dt) {
  const s = CELL, W = Math.round(s * 0.32);
  const [tx, ty] = cameraTarget(), k = Math.min(1, dt * 8);
  camX += (tx - camX) * k; camY += (ty - camY) * k;
  const shake = P.shake > 0 ? (Math.random() - 0.5) * 6 : 0;
  const X = x => Math.round(x * s - camX + shake);           // world x → screen x
  const Y = y => Math.round((ROWS - y) * s - camY + shake);  // world y → screen y (deeper = higher up)

  g.fillStyle = '#0b0806'; g.fillRect(0, 0, VW, VH);
  const rTop = Math.min(ROWS - 1, Math.ceil(ROWS - camY / s) + 1);
  const rBot = Math.max(0, Math.floor(ROWS - (camY + VH) / s) - 2);
  const c0 = Math.max(0, Math.floor(camX / s)), c1 = Math.min(COLS - 1, Math.ceil((camX + VW) / s));
  const ids = partIds();
  const moving = !P.riding && Math.hypot(P.x - lastDrawX, P.y - lastDrawY) > 0.0005;
  lastDrawX = P.x; lastDrawY = P.y;
  const blocked = new Set(beltBlocked());

  // Pass 1: all floor tiles first, so floor never paints over the walker's feet
  for (let r = rTop; r >= rBot; r--) for (let c = c0; c <= c1; c++) { const t = at(c, r); if (isFloor(t) || t === 'chasm' || t === 'tree' || t === 'pedestal') drawFloor(c, r, X(c), Y(r + 1), s); }
  // Pass 2: walls, buildings and the walker, top of screen to bottom.
  // The walker is drawn with the row its feet stand in, so only walls in front of it overlap it.
  const walkerRow = Math.floor(P.y - HB + 0.01);
  for (let r = rTop; r >= rBot; r--) {
    const y = Y(r + 1); // top edge of this row's cells
    for (let c = c0; c <= c1; c++) {
      const t = at(c, r);
      if (isFloor(t) || t === 'chasm' || t === 'found' || t === 'post') continue;
      const w = wobble.get(idx(c, r));
      drawWall(t, c, r, X(c) + (w ? Math.sin(time * 60) * s * 0.06 : 0), y, s, W);
      if (c === BELT && blocked.has(r)) { // conveyor path still to dig
        g.setLineDash([4, 4]); g.strokeStyle = 'rgba(217,129,59,.6)'; g.lineWidth = 1.5;
        g.strokeRect(X(c) + 3, y - W + 3, s - 6, s - 6); g.setLineDash([]);
      }
    }
    // the block(s) you're digging get a thin outline
    P.digging.forEach(d => { if (d.r === r) { g.strokeStyle = 'rgba(239,227,211,.55)'; g.lineWidth = 1.5; g.strokeRect(X(d.c) + 1.5, y - W + 1.5, s - 3, s - 3); } });
    if (inTown()) {
      if (r === C.TOWN.shop.rows[0]) { drawBaseBuilding(X, Y, s, W, C.TOWN.shop, 'SHOP'); drawBaseBuilding(X, Y, s, W, C.TOWN.burrow, 'BURROW'); }
      if (r === C.TOWN.gateRow) drawGates(X, Y, s, W);
      if (r === C.TOWN.station.railRow) drawTrain(X, Y, s, W);
    } else {
      if (r === C.BASE_BUILDING.rows[0]) drawBaseBuilding(X, Y, s, W);
      if (r === BASE_ROWS - 1) drawCaveSign(X, Y, s);
    }
    for (let k2 = 1; k2 <= outpostCount(); k2++) if (r === outpostRow(k2) - 1) drawOutpost(k2, X, Y, s, W);
    if (r === walkerRow) {
      // The Canopy Walker: feet sit near the bottom of its block; it faces the way it last moved
      const view = P.dir === 'up' ? 'back' : P.dir === 'down' ? 'front' : 'side';
      // arms swing up over the shoulders while digging deeper into the cave
      const raiseTarget = view === 'back' && P.digging.length > 0 ? 1 : 0;
      P.armRaise = (P.armRaise || 0) + (raiseTarget - (P.armRaise || 0)) * Math.min(1, dt * 14);
      drawWalker(g, X(P.x), Y(P.y) + s * 0.4, s * 1.15 / 64, view, P.face, time, ids, { moving, digging: P.digging.length > 0, raise: P.armRaise });
    }
  }

  particles.forEach(p => { g.globalAlpha = Math.max(0, p.life * 2); g.fillStyle = p.col; const q = Math.max(2, s * 0.07); g.fillRect(X(p.x) - q / 2, Y(p.y) - W - q / 2, q, q); });
  g.globalAlpha = 1;

  // darkness inside the cave (everything above the yard), with light around the robot
  const caveEdge = inTown() ? -1 : Y(BASE_ROWS);
  if (caveEdge > 0) {
    const px = X(P.x), py = Y(P.y);
    g.save(); g.beginPath(); g.rect(0, 0, VW, Math.min(VH, caveEdge)); g.clip();
    const R = lightRadius() * s;
    const fog = g.createRadialGradient(px, py, R * 0.5, px, py, R * 1.1);
    fog.addColorStop(0, 'rgba(8,5,3,0)'); fog.addColorStop(1, 'rgba(8,5,3,.94)');
    g.fillStyle = fog; g.fillRect(0, 0, VW, VH);
    for (let k2 = 1; k2 <= outpostCount(); k2++) { // outposts keep a lamp lit
      const oy = Y(outpostRow(k2) + 0.5), ox2 = X(BELT + 1);
      if (oy < -s * 3 || oy > VH + s * 3) continue;
      const glow = g.createRadialGradient(ox2, oy, 0, ox2, oy, s * 2.2);
      glow.addColorStop(0, 'rgba(217,129,59,.18)'); glow.addColorStop(1, 'rgba(217,129,59,0)');
      g.fillStyle = glow; g.fillRect(ox2 - s * 3, oy - s * 3, s * 6, s * 6);
    }
    for (let r = rTop; r >= rBot; r--) for (let c = c0; c <= c1; c++) {
      const t = T[idx(c, r)], cx = X(c) + s / 2, cy = Y(r + 1) - W + s / 2;
      const dist = Math.hypot(c + 0.5 - P.x, r + 0.5 - P.y);
      if (t === 'loose' && rockScan() && dist <= lightRadius() + rockScan()) { // a scanning head outlines unstable rock
        g.strokeStyle = 'rgba(205,184,156,.4)'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, s * 0.36, 0, 7); g.stroke();
      }
      if (t === 'fossil' && !SEEN[idx(c, r)] && dist <= lightRadius() + 2.5) { // an unseen fossil glows faintly when close
        g.fillStyle = 'rgba(234,223,196,' + (0.12 + Math.sin(time * 3) * 0.08) + ')'; g.beginPath(); g.arc(cx, cy, s * 0.45, 0, 7); g.fill();
      }
      if (t === 'cache' && SEEN[idx(c, r)] === 2) { // scanned caches ping through the dark
        g.strokeStyle = 'rgba(242,201,76,' + (0.35 + Math.sin(time * 4) * 0.2) + ')'; g.lineWidth = 1.5;
        g.beginPath(); g.arc(cx, cy, s * (0.42 + (time % 1.2) * 0.15), 0, 7); g.stroke();
      }
      if (t === 'relic') { // the relic is a beacon you can always see
        const pulse = 0.5 + Math.sin(time * 2.5) * 0.25;
        const glow = g.createRadialGradient(cx, cy, 0, cx, cy, s * 2.5);
        glow.addColorStop(0, 'rgba(201,162,255,' + pulse + ')'); glow.addColorStop(1, 'rgba(201,162,255,0)');
        g.fillStyle = glow; g.fillRect(cx - s * 2.5, cy - s * 2.5, s * 5, s * 5);
      }
    }
    g.restore();
  }

  g.textAlign = 'center'; g.font = '600 ' + Math.max(11, Math.round(s * 0.28)) + 'px "IBM Plex Mono", monospace';
  floats.forEach(f => { g.globalAlpha = Math.min(1, f.life * 1.5); g.fillStyle = f.col; g.fillText(f.text, X(f.x), Y(f.y) - W); });
  g.globalAlpha = 1;
}

// The cave's name, on a sign at the mouth of the cave
function drawCaveSign(X, Y, s) {
  const x = X(BELT - 3.5), y = Y(BASE_ROWS) + s * 0.12, w = s * 3, h = s * 0.62;
  g.fillStyle = '#3a2b20'; rr2(g, x, y, w, h, 3); g.fill();
  g.fillStyle = '#6a5038'; g.fillRect(x + w * 0.2, y + h, 3, s * 0.3); g.fillRect(x + w * 0.8 - 3, y + h, 3, s * 0.3);
  g.fillStyle = '#efe3d3'; g.textAlign = 'center'; g.font = '700 ' + Math.round(s * 0.24) + 'px "Pixelify Sans", monospace';
  g.fillText('CAVE ' + (S.cave + 1), x + w / 2, y + h * 0.42);
  g.font = '500 ' + Math.round(s * 0.18) + 'px "IBM Plex Mono", monospace'; g.fillStyle = '#d9813b';
  g.fillText(cave().name.toUpperCase(), x + w / 2, y + h * 0.82);
}

// ---------- Minimap: everything you've seen in this cave ----------
const mcv = $('minimap'), mg = mcv.getContext('2d');
const MM = 3; // pixels per block
function resizeMinimap() { mcv.width = COLS * MM; mcv.height = (ROWS - 1) * MM; mcv.hidden = inTown(); }
resizeMinimap();
let mmT = 0;
function renderMinimap(dt) {
  if (inTown()) return;
  mmT += dt; if (mmT < 0.2) return; mmT = 0;
  mg.clearRect(0, 0, mcv.width, mcv.height);
  for (let r = 0; r < ROWS - 1; r++) for (let c = 0; c < COLS; c++) {
    const i = idx(c, r); if (!SEEN[i] && r >= BASE_ROWS) continue;
    const t = T[i], y = (ROWS - 2 - r) * MM, x = c * MM;
    let col = '#4a3a2c';
    if (r < BASE_ROWS) col = isFloor(t) ? '#3c4a2c' : '#4b4038';
    else if (t === 'chasm') col = '#000';
    else if (t === 'bridge' || t === 'oldbridge') col = '#a77d48';
    else if (isFloor(t)) col = '#9a7a58';
    else if (t === 'granite') col = '#8c8286';
    else if (t === 'obsidian') col = '#3a2d48';
    else if (t === 'relic') col = '#c9a2ff';
    else if (t === 'cache' && SEEN[i] === 2) col = '#f2c94c';
    else if (t === 'keycache') col = '#9fe3f0';
    else if (ORES.has(t)) col = C.BLOCKS[t].ore;
    mg.fillStyle = col; mg.fillRect(x, y, MM, MM);
  }
  mg.fillStyle = '#d9813b';
  for (let r = BASE_ROWS; r <= beltEnd(); r++) mg.fillRect(BELT * MM + 1, (ROWS - 2 - r) * MM, 1, MM);
  for (let k = 1; k <= outpostCount(); k++) mg.fillRect((BELT - 1) * MM, (ROWS - 2 - outpostRow(k)) * MM - 1, MM * 3, MM + 1);
  if (Math.sin(time * 8) > -0.4) { mg.fillStyle = '#9fe3f0'; mg.fillRect(P.x * MM - 2, (ROWS - 1 - P.y) * MM - 2, 4, 4); }
}

// ---------- Pet burrow (side view, in its own panel) ----------
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
