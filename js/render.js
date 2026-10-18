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
function floatText(x, y, text, col) { const f = { x, y, text, col, life: 1.1 }; floats.push(f); return f; }
// Chunks: bigger pieces of rock (or enemy) that pop up, tumble and bounce on the floor before fading
function chunks(x, y, col, n, power = 1) {
  if (reduceMotion) n = Math.ceil(n / 3);
  for (let k = 0; k < n && particles.length < 300; k++) {
    const a = Math.random() * Math.PI * 2, sp = (1 + Math.random() * 2.2) * power;
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, z: 0.1, vz: 2 + Math.random() * 3 * power, life: 0.7 + Math.random() * 0.5,
      col: Math.random() < 0.35 ? shade(col.startsWith('#') ? col : '#888888', 0.7) : col, size: 0.09 + Math.random() * 0.12, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14, chunk: true });
  }
}
function updateEffects(dt) {
  particles.forEach(p => {
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    if (p.chunk) {
      p.vz -= 14 * dt; p.z += p.vz * dt; p.rot += p.vr * dt;
      if (p.z < 0) { p.z = 0; p.vz = -p.vz * 0.35; p.vx *= 0.6; p.vy *= 0.6; p.vr *= 0.6; }
      p.vx *= 0.97; p.vy *= 0.97;
    } else { p.vx *= 0.92; p.vy *= 0.92; }
  });
  particles = particles.filter(p => p.life > 0);
  floats.forEach(f => { f.y += 0.8 * dt; f.life -= dt; }); floats = floats.filter(f => f.life > 0);
  if (P.shake > 0) P.shake -= dt;
}

// ---------- Canvas setup ----------
const stage = $('stage'), cv = $('world'), g = cv.getContext('2d');
const pcv = $('bots'), pg = pcv.getContext('2d');
let padTop = 0, padBot = 0, VW = 1, VH = 1, PW = 1, PH = 1, CELL = 40, camX = 0, camY = 0, time = 0;
function fit(canvas, ctx) {
  const r = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return [r.width, r.height];
}
// Zoom (Settings): how many rows of a cave fit on screen. Remembered in this browser.
const ZOOMS = { close: 8, normal: 10, far: 13, farther: 16 };
let zoom = 'normal';
try { zoom = localStorage.getItem('bolt-burrow-zoom') || 'normal'; if (!ZOOMS[zoom]) zoom = 'normal'; } catch (e) {}
let gameReady = false;   // set by main.js once the world is loaded
let lastSize = '';
function resize() {
  // Resizing a canvas wipes it, so only do it when the size really changed, then redraw straight away
  // (otherwise the browser shows one blank frame: a flash)
  const sr = cv.getBoundingClientRect(), br = pcv.getBoundingClientRect();
  const sig = [sr.width, sr.height, br.width, br.height, S.cave, S.town, ROWS, zoom].join();
  if (sig === lastSize) return;
  lastSize = sig;
  [VW, VH] = fit(cv, g); [PW, PH] = fit(pcv, pg);
  // the HUD and controls now have their own strips above and below the game, so nothing covers it
  padTop = 4; padBot = 4;
  // the town and shop fit the screen's height (on a phone held upright the town scrolls sideways); caves use the zoom setting
  const rows = ZOOMS[zoom];
  CELL = Math.max(18, Math.floor(inTown() ? Math.min(VW / (VW < VH ? 9 : 15), (VH - padTop - padBot) / (ROWS + 0.4)) : Math.min(VW / (rows * 1.5), VH / rows)));
  if (gameReady) { render(0); renderBots(); }
}
new ResizeObserver(resize).observe(stage);
new ResizeObserver(resize).observe($('botView'));

// Camera targets: keep the robot centred, but don't scroll past the yard at the bottom
let camFocus = null;   // { x, y } while a cutscene (the halfway crawler driving out) holds the camera
function cameraTarget() {
  const s = CELL, worldW = COLS * s, F = camFocus || P;
  const tx = worldW <= VW ? (worldW - VW) / 2 : Math.max(0, Math.min(worldW - VW, F.x * s - VW / 2));
  if (inShop()) return [(C.SHOP.door + C.SHOP.doorW / 2) * s - VW / 2, -(padTop + (VH - padTop - padBot - ROWS * s) / 2) + s * 0.25];
  if (inTown()) return [tx, -(padTop + (VH - padTop - padBot - ROWS * s) / 2) + s * 0.25];   // the whole town fits between the HUD and controls
  let ty = (ROWS - F.y) * s - VH * 0.5;
  ty = Math.min(ty, ROWS * s - VH + s * 2.2);   // at the cave mouth, leave a little room below so the mech isn't on the bottom edge
  ty = Math.max(ty, -s * 0.6);                  // or the top row
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
  if (inShop()) return drawShopFloor(c, r, x, y, s);
  const town = inTown(), hall = !town && r < BASE_ROWS, path = town && DECO[idx(c, r)] === 2;
  if (town && DECO[idx(c, r)] === 3) return drawPlatform(c, r, x, y, s);
  const TL = town ? TOWN().look : null;
  g.fillStyle = town ? (path ? TL.path : TL.grass) : hall ? '#3a3128' : cave().floor;
  g.fillRect(x, y, s, s);
  g.fillStyle = town && !path ? TL.grassDot : 'rgba(255,230,200,.05)';
  g.fillRect(x + s * (0.2 + hash(c, r, 3) * 0.5), y + s * (0.2 + hash(c, r, 4) * 0.5), s * 0.1, s * 0.1);
  if (town && TOWN().style === 'rust') {
    if (path) {   // steel deck plates with rivets
      g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x, y, s, 1); g.fillRect(x, y, 1, s);
      g.fillStyle = 'rgba(255,240,220,.08)'; g.fillRect(x + 1, y + 1, s - 2, 1);
      g.fillStyle = '#8a7a6a'; for (const [a, b] of [[0.15, 0.15], [0.85, 0.15], [0.15, 0.85], [0.85, 0.85]]) g.fillRect(x + s * a - 1, y + s * b - 1, 2, 2);
      if (hash(c, r, 150) < 0.3) { g.fillStyle = 'rgba(190,100,50,.25)'; g.beginPath(); g.arc(x + s * (0.3 + hash(c, r, 151) * 0.4), y + s * 0.5, s * 0.15, 0, 7); g.fill(); }
    } else {      // gravel and oil stains
      g.fillStyle = 'rgba(255,230,200,.07)'; for (let k = 0; k < 5; k++) g.fillRect(x + s * hash(c, r, 160 + k), y + s * hash(r, c, 160 + k), 2, 2);
      if (hash(c, r, 170) < 0.12) { g.fillStyle = 'rgba(10,8,8,.35)'; g.beginPath(); g.ellipse(x + s * 0.5, y + s * 0.5, s * 0.3, s * 0.18, 0, 0, 7); g.fill(); }
    }
  }
  if (t === 'lava') drawLava(c, r, x, y, s, true);
  if (t === 'crust') drawCrust(c, r, x, y, s);
  if (t === 'vent') drawVent(c, r, x, y, s);
  if (t === 'exit') drawExit(x, y, s);
  if (t === 'water') drawWater(c, r, x, y, s);
  if (t === 'beam') drawBeam(x, y, s);
  if (t === 'gate') { g.fillStyle = '#120d0a'; g.fillRect(x + s * 0.12, y, s * 0.76, s); }
  if (!town && DECO[idx(c, r)] && hash(c, r, 11) < 0.35) drawStalagmite(c, r, x, y, s);
  if (t === 'pad') drawPad(c, r, x, y, s);
  if (outpostAt(c, r) && c !== BELT) { // the outpost's plank decking
    g.fillStyle = '#6a4a30'; g.fillRect(x + 1, y + 1, s - 2, s - 2);
    g.fillStyle = 'rgba(0,0,0,.3)'; for (let q = 1; q < 4; q++) g.fillRect(x + 1, y + q * s / 4, s - 2, 1);
    g.fillStyle = '#8a6a44'; g.fillRect(x + s * 0.1, y + s * 0.1, 2, 2); g.fillRect(x + s * 0.85, y + s * 0.85, 2, 2);
  }
  if (onBelt(c, r)) drawBelt(x, y, s);
}
// A chasm: a dark drop. Where solid ground lies beyond it (up the screen) you see the far wall.
function drawChasm(c, r, x, y, s) {
  const isGap = t => t === 'chasm' || t === 'bridge' || t === 'oldbridge';
  if (!inTown() && cave().lava) {   // the Crucible: its chasms are rivers of lava
    drawLava(c, r, x, y, s, false);
    if (!isGap(at(c, r - 1))) { g.fillStyle = '#1a1210'; g.fillRect(x, y + s - Math.max(3, s * 0.1), s, Math.max(3, s * 0.1)); }
    if (!isGap(at(c, r + 1))) { g.fillStyle = 'rgba(20,12,10,.8)'; g.fillRect(x, y, s, Math.max(3, s * 0.12)); }
    return;
  }
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
  if (caveTown(S.cave) === 1) {   // Rustvale caverns: rusted pipes, girders and old rails instead of stalagmites
    const kind = hash(c, r, 16);
    if (kind < 0.4) { g.fillStyle = '#6a4632'; g.fillRect(cx - s * 0.06, by - h, s * 0.12, h); g.fillStyle = '#8a5a3a'; g.fillRect(cx - s * 0.09, by - h, s * 0.18, s * 0.06); }
    else if (kind < 0.75) { g.strokeStyle = '#5D646E'; g.lineWidth = Math.max(2, s * 0.06); g.beginPath(); g.moveTo(cx - s * 0.2, by); g.lineTo(cx + s * 0.05, by - h); g.lineTo(cx + s * 0.2, by); g.stroke(); g.fillStyle = '#c86a3a'; g.fillRect(cx, by - h * 0.6, 2, 2); }
    else { g.fillStyle = '#3B3F46'; g.fillRect(cx - s * 0.22, by - s * 0.05, s * 0.44, s * 0.04); g.fillRect(cx - s * 0.22, by - s * 0.15, s * 0.44, s * 0.04); g.fillStyle = '#5a3f2a'; g.fillRect(cx - s * 0.15, by - s * 0.18, s * 0.05, s * 0.18); g.fillRect(cx + s * 0.1, by - s * 0.18, s * 0.05, s * 0.18); }
    return;
  }
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

// A boulder: a big round rock sitting on the floor (rolls toward the entrance)
function drawBoulder(c, r, x, y, s, W) {
  const cx = x + s * 0.5, cy = y + s * 0.5 - W * 0.6, rad = s * 0.46;
  g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(cx, y + s * 0.82, rad * 0.95, rad * 0.35, 0, 0, 7); g.fill();
  g.fillStyle = C.BLOCKS.boulder.color; g.beginPath(); g.arc(cx, cy, rad, 0, 7); g.fill();
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(cx + rad * 0.15, cy + rad * 0.2, rad * 0.8, 0, 7); g.fill();
  g.fillStyle = C.BLOCKS.boulder.color; g.beginPath(); g.arc(cx - rad * 0.08, cy - rad * 0.08, rad * 0.78, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,240,220,.18)'; g.beginPath(); g.arc(cx - rad * 0.35, cy - rad * 0.35, rad * 0.22, 0, 7); g.fill();
  g.strokeStyle = 'rgba(40,30,25,.5)'; g.lineWidth = Math.max(1, s * 0.03);
  g.beginPath(); g.moveTo(cx - rad * 0.1, cy - rad * 0.5); g.lineTo(cx + rad * 0.05, cy); g.lineTo(cx + rad * 0.4, cy + rad * 0.2); g.stroke();
  const d = DMG[idx(c, r)] / C.BLOCKS.boulder.hp;
  if (d > 0) { g.strokeStyle = 'rgba(10,6,3,' + (0.3 + d * 0.6) + ')'; g.beginPath(); g.moveTo(cx - rad * 0.5, cy + rad * 0.1); g.lineTo(cx - rad * 0.1, cy + rad * 0.3); g.lineTo(cx + rad * 0.1, cy + rad * 0.7); g.stroke(); }
}
// Flood water and support beams (both walkable)
function drawWater(c, r, x, y, s) {
  g.fillStyle = 'rgba(40,90,130,.78)'; g.fillRect(x, y, s, s);
  g.strokeStyle = 'rgba(170,220,250,.35)'; g.lineWidth = 1;
  for (let k = 0; k < 2; k++) {
    const yy = y + s * (0.3 + k * 0.4) + Math.sin(time * 2 + c + k) * s * 0.05;
    g.beginPath(); g.moveTo(x + s * 0.1, yy); g.quadraticCurveTo(x + s * 0.5, yy - s * 0.08, x + s * 0.9, yy); g.stroke();
  }
}
// ---------- Rustvale ----------
// Rock faces: rust-stained stone, slag with glowing flecks, burnt cinder with hot seams, old machinery, and
// (once seen) magma pockets with a cracked crust
function drawRustRock(look, c, r, x, ty, s) {
  if (look === 'rust') {
    g.fillStyle = 'rgba(200,110,50,.28)';
    for (let k = 0; k < 2; k++) { const sx = x + s * (0.15 + hash(c, r, 200 + k) * 0.6); g.fillRect(sx, ty + s * 0.1, s * 0.06, s * (0.4 + hash(r, c, 200 + k) * 0.45)); }
    g.fillStyle = 'rgba(40,20,10,.25)'; g.beginPath(); g.arc(x + s * (0.3 + hash(c, r, 203) * 0.4), ty + s * (0.3 + hash(r, c, 204) * 0.4), s * 0.12, 0, 7); g.fill();
  } else if (look === 'slag') {
    const glow = 0.45 + Math.sin(time * 2 + c * 1.7 + r) * 0.2;
    for (let k = 0; k < 4; k++) { g.fillStyle = k % 2 ? 'rgba(255,140,60,' + glow + ')' : 'rgba(255,200,120,' + (glow * 0.6) + ')'; g.fillRect(x + s * (0.12 + hash(c, r, 210 + k) * 0.72), ty + s * (0.12 + hash(r, c, 210 + k) * 0.72), Math.max(2, s * 0.05), Math.max(2, s * 0.05)); }
    g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(x + s * 0.1, ty + s * (0.4 + hash(c, r, 215) * 0.3), s * 0.8, Math.max(1, s * 0.04));
  } else if (look === 'cinder') {
    g.strokeStyle = 'rgba(255,90,40,' + (0.3 + Math.sin(time * 1.5 + c + r * 2) * 0.15) + ')'; g.lineWidth = Math.max(1, s * 0.035);
    g.beginPath(); g.moveTo(x + s * 0.1, ty + s * (0.3 + hash(c, r, 220) * 0.4)); g.lineTo(x + s * 0.5, ty + s * (0.35 + hash(c, r, 221) * 0.3)); g.lineTo(x + s * 0.9, ty + s * (0.2 + hash(c, r, 222) * 0.5)); g.stroke();
  } else if (look === 'scrap') {   // a rusty machine panel: plates, rivets, a pipe and a gear
    g.fillStyle = '#4A5059'; g.fillRect(x + s * 0.08, ty + s * 0.08, s * 0.84, s * 0.84);
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x + s * 0.08, ty + s * 0.5, s * 0.84, 2);
    g.fillStyle = '#8E96A0'; for (const [a, b] of [[0.15, 0.15], [0.85, 0.15], [0.15, 0.85], [0.85, 0.85], [0.15, 0.55], [0.85, 0.55]]) g.fillRect(x + s * a - 1.5, ty + s * b - 1.5, 3, 3);
    const kind = hash(c, r, 230);
    if (kind < 0.5) { g.fillStyle = '#6a4632'; g.fillRect(x + s * 0.2, ty + s * 0.26, s * 0.6, s * 0.12); g.fillStyle = '#8a5a3a'; g.fillRect(x + s * 0.2, ty + s * 0.24, s * 0.08, s * 0.16); g.fillRect(x + s * 0.72, ty + s * 0.24, s * 0.08, s * 0.16); }
    else { g.strokeStyle = '#8E96A0'; g.lineWidth = Math.max(2, s * 0.07); g.beginPath(); g.arc(x + s * 0.5, ty + s * 0.3, s * 0.13, 0, 7); g.stroke(); g.fillStyle = '#8E96A0'; for (let k = 0; k < 6; k++) { const a = k * 1.05; g.fillRect(x + s * 0.5 + Math.cos(a) * s * 0.2 - 1.5, ty + s * 0.3 + Math.sin(a) * s * 0.2 - 1.5, 3, 3); } }
    g.fillStyle = 'rgba(200,110,50,.35)'; g.beginPath(); g.arc(x + s * (0.3 + hash(c, r, 231) * 0.4), ty + s * 0.72, s * 0.12, 0, 7); g.fill();
  } else if (look === 'magma') {
    const glow = 0.6 + Math.sin(time * 3 + c) * 0.25;
    g.fillStyle = '#2a1410'; g.fillRect(x + s * 0.1, ty + s * 0.1, s * 0.8, s * 0.8);
    g.strokeStyle = 'rgba(255,120,40,' + glow + ')'; g.lineWidth = Math.max(2, s * 0.06);
    g.beginPath(); g.moveTo(x + s * 0.2, ty + s * 0.3); g.lineTo(x + s * 0.45, ty + s * 0.5); g.lineTo(x + s * 0.35, ty + s * 0.8); g.moveTo(x + s * 0.45, ty + s * 0.5); g.lineTo(x + s * 0.8, ty + s * 0.4); g.stroke();
  }
}
// Lava: a bright, slowly churning surface with dark crust drifting on it. Spilled lava dims as it cools.
function drawLava(c, r, x, y, s, spilled) {
  const age = spilled ? (lavaAge.get(idx(c, r)) || 0) / C.REACT.lavaCool : 0;
  const gr = g.createLinearGradient(x, y, x + s, y + s);
  gr.addColorStop(0, shade('#ff7a2a', 1 - age * 0.45)); gr.addColorStop(1, shade('#c23a14', 1 - age * 0.45));
  g.fillStyle = gr; g.fillRect(x, y, s, s);
  for (let k = 0; k < 3; k++) {
    const ph = (time * 0.15 + hash(c, r, 240 + k)) % 1;
    g.fillStyle = 'rgba(60,20,10,' + (0.35 + age * 0.4) + ')'; g.beginPath();
    g.ellipse(x + s * ((hash(c, k, 241) + ph) % 1), y + s * (0.2 + hash(r, k, 242) * 0.6), s * 0.16, s * 0.08, 0, 0, 7); g.fill();
  }
  const b = (time * 0.8 + hash(c, r, 243)) % 1;   // a bubble
  g.strokeStyle = 'rgba(255,220,140,' + (0.6 * (1 - b)) + ')'; g.lineWidth = 1; g.beginPath(); g.arc(x + s * (0.3 + hash(c, r, 244) * 0.4), y + s * 0.5, s * 0.05 + b * s * 0.12, 0, 7); g.stroke();
}
function drawCrust(c, r, x, y, s) {
  g.fillStyle = '#2a2220'; g.fillRect(x, y, s, s);
  g.strokeStyle = 'rgba(150,60,30,.35)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(x + s * 0.1, y + s * (0.3 + hash(c, r, 250) * 0.4)); g.lineTo(x + s * 0.5, y + s * 0.5); g.lineTo(x + s * 0.9, y + s * (0.3 + hash(c, r, 251) * 0.4)); g.stroke();
}
// A steam vent: an iron grate in the floor. It wisps while it's about to burst, then blasts a column of steam.
function drawVent(c, r, x, y, s) {
  const ph = ventPhase(c, r), cx = x + s * 0.5, cy = y + s * 0.5;
  g.fillStyle = '#2B2A2E'; g.beginPath(); g.arc(cx, cy, s * 0.36, 0, 7); g.fill();
  g.strokeStyle = ph === 'warn' ? '#e8b33a' : '#5D646E'; g.lineWidth = Math.max(2, s * 0.05); g.stroke();
  g.fillStyle = '#5D646E'; for (let k = -1; k <= 1; k++) g.fillRect(cx - s * 0.26, cy + k * s * 0.12 - 1, s * 0.52, 2);
  if (ph === 'warn') for (let k = 0; k < 3; k++) { const p = (time * 1.5 + k / 3) % 1; g.fillStyle = 'rgba(230,225,215,' + (0.4 * (1 - p)) + ')'; g.beginPath(); g.arc(cx + Math.sin(p * 6 + k) * s * 0.1, cy - p * s * 0.5, s * (0.05 + p * 0.08), 0, 7); g.fill(); }
  if (ph === 'burst') for (let k = 0; k < 6; k++) { const p = (time * 3 + k / 6) % 1; g.fillStyle = 'rgba(240,236,230,' + (0.55 * (1 - p)) + ')'; g.beginPath(); g.arc(cx + Math.sin(p * 9 + k) * s * 0.15, cy - p * s * 1.4, s * (0.12 + p * 0.25), 0, 7); g.fill(); }
}
// The contracts board in town: a notice board on two posts, with a note for each contract (a gold pin = ready to claim)
function drawBoard(c, r, x, y, s, W) {
  const rust = TOWN().style === 'rust', ty = y - W;
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x + s * 0.5, y + s * 0.9, s * 0.5, s * 0.1, 0, 0, 7); g.fill();
  g.fillStyle = rust ? '#3B3F46' : '#5a3d26'; g.fillRect(x + s * 0.12, ty + s * 0.4, s * 0.08, s * 0.6 + W); g.fillRect(x + s * 0.8, ty + s * 0.4, s * 0.08, s * 0.6 + W);
  g.fillStyle = rust ? '#4A5059' : '#7a5230'; rr2(g, x - s * 0.05, ty - s * 0.15, s * 1.1, s * 0.75, 3); g.fill();
  g.strokeStyle = rust ? '#E8B33A' : '#3a2b20'; g.lineWidth = 2; rr2(g, x - s * 0.05, ty - s * 0.15, s * 1.1, s * 0.75, 3); g.stroke();
  const list = (S.contracts && S.contracts.list) || [];
  for (let k = 0; k < 3; k++) {
    const ct = list[k], nx = x + s * (0.06 + k * 0.32), ny = ty - s * 0.05 + (k % 2) * s * 0.06;
    g.fillStyle = ct && ct.claimed ? '#8a8070' : '#efe3d3'; g.fillRect(nx, ny, s * 0.26, s * 0.4);
    g.fillStyle = 'rgba(60,40,30,.6)'; for (let l = 0; l < 3; l++) g.fillRect(nx + s * 0.04, ny + s * (0.1 + l * 0.09), s * 0.18, 1);
    const ready = ct && !ct.claimed && ct.have >= ct.n;
    g.fillStyle = ready ? '#f2c94c' : ct && ct.claimed ? '#7fd17a' : '#e2705a'; g.beginPath(); g.arc(nx + s * 0.13, ny + s * 0.03, s * 0.04, 0, 7); g.fill();
  }
  if (contractsReady()) { g.fillStyle = '#f2c94c'; g.font = '700 ' + Math.round(s * 0.4) + 'px "Pixelify Sans", monospace'; g.textAlign = 'center'; g.fillText('!', x + s * 0.5, ty - s * 0.25 + Math.sin(time * 5) * s * 0.05); }
}
function drawBeam(x, y, s) {
  g.strokeStyle = '#8a6a44'; g.lineWidth = Math.max(3, s * 0.12); g.lineCap = 'round';
  g.beginPath(); g.moveTo(x + s * 0.15, y + s * 0.15); g.lineTo(x + s * 0.85, y + s * 0.85); g.moveTo(x + s * 0.85, y + s * 0.15); g.lineTo(x + s * 0.15, y + s * 0.85); g.stroke();
  g.lineCap = 'butt'; g.strokeStyle = '#5a3f2a'; g.lineWidth = Math.max(2, s * 0.06); g.strokeRect(x + s * 0.1, y + s * 0.1, s * 0.8, s * 0.8);
}
function drawWall(t, c, r, x, y, s, W) {
  const i = idx(c, r), seen = SEEN[i];
  if (t === 'tree') return drawTree(c, r, x, y, s, W);
  if (t === 'pedestal') return drawPedestal(c, r, x, y, s, W);
  if (t === 'rail') return drawRail(c, r, x, y, s);
  if (t === 'void') return;
  if (t === 'stand') return drawStand(c, r, x, y, s, W);
  if (t === 'counter') return drawCounter(c, r, x, y, s, W);
  if (t === 'boulder') return drawBoulder(c, r, x, y, s, W);
  if (t === 'board') return drawBoard(c, r, x, y, s, W);
  const hidden = t === 'botcache' ? !botCacheShown(c, r) : t === 'cache' ? seen !== 2 : (ORES.has(t) || t === 'fossil' || t === 'relic' || t === 'keycache' || t === 'gas' || t === 'aquifer' || t === 'magma') && !seen;
  const look = hidden || t === 'botcache' ? baseFor(c, r) : t;
  const base = look === 'shopwall' ? (garageShop() ? '#3B3F46' : '#3d2b1f') : look === 'cliff' && inTown() ? TOWN().look.cliff : C.BLOCKS[look].color || C.BLOCKS[baseFor(c, r)].color;
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
    if (look === 'rust' || look === 'slag' || look === 'cinder' || look === 'scrap' || look === 'magma') drawRustRock(look, c, r, x, ty, s);
    if (look === 'cliff' && inTown() && TOWN().style === 'rust') {   // Rustvale's cliffs: steel girders bolted to the rock
      g.fillStyle = 'rgba(30,22,18,.5)'; g.fillRect(x, ty + s * 0.42, s, s * 0.14);
      g.fillStyle = '#7a5a44'; g.fillRect(x, ty + s * 0.4, s, s * 0.08);
      g.fillStyle = '#c8a070'; g.fillRect(x + s * 0.2, ty + s * 0.42, 2, 2); g.fillRect(x + s * 0.7, ty + s * 0.42, 2, 2);
      if (hash(c, r, 140) < 0.25) { g.fillStyle = 'rgba(200,110,50,.35)'; g.fillRect(x + s * (0.2 + hash(c, r, 141) * 0.5), ty + s * 0.5, s * 0.08, s * 0.4); }   // rust streak
    }
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
  if (!hidden && t === 'botcache') drawBotCache(c, r, x, ty, s);
  if (!hidden && t === 'cache') { // a treasure cache the scanner has found
    g.fillStyle = '#5a3a1e'; rr2(g, x + s * 0.2, ty + s * 0.32, s * 0.6, s * 0.42, s * 0.05); g.fill();
    g.fillStyle = '#7a5230'; rr2(g, x + s * 0.2, ty + s * 0.24, s * 0.6, s * 0.16, s * 0.06); g.fill();
    g.fillStyle = '#f2c94c'; g.fillRect(x + s * 0.2, ty + s * 0.38, s * 0.6, s * 0.05); g.fillRect(x + s * 0.46, ty + s * 0.36, s * 0.08, s * 0.14);
  }
  if (!hidden && ORES.has(t)) {
    g.fillStyle = C.BLOCKS[t].ore;
    // one pixel per piece of ore inside (1–4), each one drops when the block breaks
    const q = Math.max(3, s * 0.14);
    for (let k = 0, n = orePieces(c, r); k < n; k++) { const p = pixelAt(c, r, k); g.fillRect(x + s * p.x, ty + s * p.y, q, q); }
  }
  if (look === 'sand') {   // fine grains and ripples
    g.fillStyle = 'rgba(90,70,40,.25)';
    for (let k = 0; k < 6; k++) g.fillRect(x + s * (0.1 + hash(c, r, k + 60) * 0.8), ty + s * (0.1 + hash(r, c, k + 60) * 0.8), 2, 2);
    g.strokeStyle = 'rgba(255,245,220,.25)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x + s * 0.15, ty + s * 0.4); g.quadraticCurveTo(x + s * 0.5, ty + s * 0.3, x + s * 0.85, ty + s * 0.42); g.stroke();
  }
  if (look === 'aquifer') {   // wet rock with water seeping out
    g.fillStyle = 'rgba(120,180,220,.35)';
    for (let k = 0; k < 3; k++) { const dx = x + s * (0.2 + hash(c, r, k + 70) * 0.6), ph = (time * 0.7 + hash(c, k, 71)) % 1; g.beginPath(); g.arc(dx, ty + s * (0.25 + ph * 0.55), s * 0.05, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(160,210,240,.4)'; g.lineWidth = Math.max(1, s * 0.03); g.strokeRect(x + s * 0.08, ty + s * 0.08, s * 0.84, s * 0.84);
  }
  if (look === 'gas') {   // greenish rock with bubbles; flashes once lit
    const lit = fuses.has(i);
    g.fillStyle = lit && Math.sin(time * 40) > 0 ? 'rgba(220,255,160,.6)' : 'rgba(160,210,110,.35)';
    for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + s * (0.2 + hash(c, r, k + 80) * 0.6), ty + s * (0.2 + hash(r, c, k + 80) * 0.6), s * (0.05 + hash(k, c, 81) * 0.06), 0, 7); g.fill(); }
  }
  if (!hidden && t === 'fossil') {
    g.strokeStyle = '#eadfc4'; g.lineWidth = Math.max(2, s * 0.1); g.lineCap = 'round';
    g.beginPath(); g.moveTo(x + s * 0.28, ty + s * 0.72); g.lineTo(x + s * 0.72, ty + s * 0.28); g.stroke();
    g.fillStyle = '#eadfc4';
    [[0.24, 0.7], [0.3, 0.78], [0.7, 0.22], [0.78, 0.3]].forEach(([a, b]) => { g.beginPath(); g.arc(x + s * a, ty + s * b, s * 0.07, 0, 7); g.fill(); });
    g.lineCap = 'butt';
  }
  const hp = C.BLOCKS[t].hp, d = DMG[i] / hp;
  if (d > 0 && hp !== Infinity) drawCracks(c, r, x, ty, s, Math.min(1, d));
}
// Cracks spread across a block as it takes damage: branches grow out from a weak point, then chips fall out
function drawCracks(c, r, x, ty, s, d) {
  const ox = x + s * (0.3 + hash(c, r, 91) * 0.4), oy = ty + s * (0.3 + hash(r, c, 92) * 0.4);
  const n = 2 + Math.floor(d * 3), len = s * (0.12 + d * 0.5);
  const clampX = v => Math.max(x + 2, Math.min(x + s - 2, v)), clampY = v => Math.max(ty + 2, Math.min(ty + s - 2, v));
  g.fillStyle = 'rgba(0,0,0,' + (d * 0.22) + ')'; g.fillRect(x, ty, s, s);   // the block darkens as it weakens
  g.lineCap = 'round';
  for (const pass of [0, 1]) {   // a dark crack, then a thin light edge beside it for depth
    g.strokeStyle = pass ? 'rgba(255,240,220,.14)' : 'rgba(10,6,3,' + (0.5 + d * 0.45) + ')';
    g.lineWidth = pass ? 1 : Math.max(1.2, s * (0.025 + d * 0.035));
    for (let b = 0; b < n; b++) {
      let ang = hash(c, r, 100 + b) * 6.283, px = ox + pass, py = oy + pass;
      g.beginPath(); g.moveTo(px, py);
      for (let k = 0; k < 3; k++) {
        ang += (hash(c + k, r + b, 110) - 0.5) * 1.3;
        px = clampX(px + Math.cos(ang) * len / 3); py = clampY(py + Math.sin(ang) * len / 3);
        g.lineTo(px, py);
      }
      g.stroke();
    }
  }
  g.lineCap = 'butt';
  if (d > 0.55) {   // chips knocked out of the surface
    g.fillStyle = 'rgba(8,5,3,.55)';
    for (let k = 0; k < Math.floor((d - 0.5) * 10); k++) g.fillRect(x + s * (0.12 + hash(c, r, 120 + k) * 0.7), ty + s * (0.12 + hash(r, c, 130 + k) * 0.7), Math.max(2, s * 0.07), Math.max(2, s * 0.07));
  }
}

// ---------- Buildings (drawn as one piece over their cells) ----------
// Y(y) converts a world y position to a screen y.
// Town decorations and features
function drawTree(c, r, x, y, s, W) {
  if (TOWN().style === 'rust') {   // Rustvale: scrap heaps and lamp posts instead of trees
    if (hash(c, r, 260) < 0.5) {
      g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x + s * 0.5, y + s * 0.85, s * 0.45, s * 0.12, 0, 0, 7); g.fill();
      g.fillStyle = '#4A5059'; g.beginPath(); g.moveTo(x, y + s * 0.85); g.lineTo(x + s * 0.35, y + s * 0.1); g.lineTo(x + s * 0.7, y + s * 0.3); g.lineTo(x + s, y + s * 0.85); g.closePath(); g.fill();
      g.fillStyle = '#6a4632'; g.fillRect(x + s * 0.25, y + s * 0.45, s * 0.3, s * 0.12); g.fillStyle = '#8E96A0'; g.fillRect(x + s * 0.5, y + s * 0.25, s * 0.25, s * 0.08);
      g.fillStyle = '#2B2A2E'; g.beginPath(); g.arc(x + s * 0.7, y + s * 0.62, s * 0.15, 0, 7); g.fill(); g.fillStyle = '#5D646E'; g.beginPath(); g.arc(x + s * 0.7, y + s * 0.62, s * 0.05, 0, 7); g.fill();
    } else {
      g.fillStyle = 'rgba(255,179,71,.12)'; g.beginPath(); g.ellipse(x + s * 0.5, y + s * 0.8, s * 0.7, s * 0.3, 0, 0, 7); g.fill();
      g.fillStyle = '#3B3F46'; g.fillRect(x + s * 0.46, y - s * 0.4, s * 0.08, s * 1.2);
      g.fillRect(x + s * 0.46, y - s * 0.4, s * 0.3, s * 0.06);
      g.fillStyle = 'rgba(255,200,120,.3)'; g.beginPath(); g.arc(x + s * 0.74, y - s * 0.28, s * 0.25, 0, 7); g.fill();
      g.fillStyle = '#ffd98a'; g.beginPath(); g.arc(x + s * 0.74, y - s * 0.3, s * 0.07, 0, 7); g.fill();
    }
    return;
  }
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x + s * 0.5, y + s * 0.85, s * 0.4, s * 0.12, 0, 0, 7); g.fill();
  g.fillStyle = '#5a3d26'; g.fillRect(x + s * 0.42, y + s * 0.35, s * 0.16, s * 0.5);
  g.fillStyle = '#2f4a2a'; g.beginPath(); g.arc(x + s * 0.5, y + s * 0.15, s * 0.48, 0, 7); g.fill();
  g.fillStyle = '#3f6236'; g.beginPath(); g.arc(x + s * 0.4, y + s * 0.02, s * 0.3, 0, 7); g.fill();
}
function drawPedestal(c, r, x, y, s, W) {
  const k = C.TOWN.pedestals.indexOf(c), cvk = k >= 0 ? gateCave(k) : null, done = cvk != null && S.caves[cvk].relicDone;
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
  const car = C.TOWN.station.cars.find(k => carDoor(k.id) === c);
  if (car) { // a car's door: stand here to use it
    const here = townSpot() === car.id;
    g.strokeStyle = here ? 'rgba(239,227,211,.8)' : 'rgba(217,129,59,.55)'; g.lineWidth = Math.max(1, s * 0.04);
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
// The train: your home base, the Drill Liner. From left to right: the engine (drill head, cab, mech hold
// with roof doors and a side window, and a small rear deck with the crane), then the forge, lab and storage cars.
const CAR_LOOK = {
  engine:  { roof: '#3B3F46', side: '#2f3238' },
  forge:   { roof: '#463630', side: '#4a3a32', label: 'FORGE' },
  lab:     { roof: '#2d3d48', side: '#2f4d5c', label: 'LAB' },
  storage: { roof: '#4a4636', side: '#5d5438', label: 'STORAGE' },
  computer: { roof: '#262c36', side: '#1f2a33', label: 'COMPUTER' },
};
// A small side view of the mech, for the hold window (pilot shown only while it's inside)
function drawMechSide(cx, by, u, pilot) {
  g.fillStyle = '#4A5059'; g.fillRect(cx - u * 0.35, by - u * 0.55, u * 0.22, u * 0.5); g.fillRect(cx + u * 0.1, by - u * 0.55, u * 0.22, u * 0.5);
  g.fillStyle = '#D9813B'; rr2(g, cx - u * 0.6, by - u * 1.15, u * 1.2, u * 0.65, u * 0.15); g.fill();
  g.fillStyle = 'rgba(159,201,214,.55)'; g.beginPath(); g.arc(cx, by - u * 1.1, u * 0.4, Math.PI, 0); g.fill();
  if (pilot) { g.fillStyle = '#5D646E'; g.beginPath(); g.arc(cx, by - u * 1.25, u * 0.16, 0, 7); g.fill(); g.fillStyle = '#9FE3F0'; g.fillRect(cx, by - u * 1.28, u * 0.07, u * 0.07); }
}
function drawTrain(X, Y, s, W) {
  const ST = C.TOWN.station, row = ST.railRow;
  const top = Y(row + 1) + s * 0.12 - W * 1.6, roofH = s * 0.5, bottom = Y(row + 1) + s * 0.85;
  const sideTop = top + roofH, sideH = bottom - sideTop;
  const busy = S.forge.queue.length > 0;
  const winY = sideTop + s * 0.08, winH = Math.max(3, sideH * 0.42);
  ST.cars.forEach((car, i) => {
    const [a, b] = car.cols, look = CAR_LOOK[car.id];
    const x = X(a) + s * 0.06, w = (b - a + 1) * s - s * 0.12, door = carDoor(car.id);
    if (i) { g.fillStyle = '#17130F'; g.fillRect(X(a) - s * 1.02, bottom - s * 0.3, s * 1.1, s * 0.08); }   // coupling
    g.fillStyle = 'rgba(134,207,220,.35)'; g.fillRect(x + s * 0.1, bottom - s * 0.01, w - s * 0.2, s * 0.05);   // maglev glow
    g.fillStyle = look.roof; rr2(g, x, top, w, roofH, s * 0.1); g.fill();
    g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(x + s * 0.1, top + roofH * 0.7, w - s * 0.2, roofH * 0.08);
    g.fillStyle = look.side; g.fillRect(x, sideTop, w, sideH);
    g.fillStyle = '#d9813b'; g.fillRect(x, bottom - s * 0.16, w, s * 0.05);                      // stripe
    if (look.label) {
      g.fillStyle = 'rgba(239,227,211,.8)'; g.textAlign = 'center';
      g.font = '700 ' + Math.round(s * 0.17) + 'px "Pixelify Sans", monospace';
      g.fillText(look.label, x + w / 2, sideTop + sideH - s * 0.2);
    }
    if (car.id === 'engine') {
      // drill head on the nose, spinning (faster while travelling)
      const tipX = x - s * 0.62, midY = (top + bottom) / 2;
      g.fillStyle = '#8E96A0'; g.strokeStyle = '#17130F'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x + 1, top + 2); g.lineTo(x + 1, bottom - 2); g.lineTo(tipX, midY); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = '#5D646E'; g.lineWidth = Math.max(1.5, s * 0.04);
      const spin = (time * (trip ? 3 : 0.4)) % 1;
      for (let k = 0; k < 4; k++) {
        const f = (k + spin) / 4, yy = top + (bottom - top) * f;
        g.beginPath(); g.moveTo(x, yy); g.lineTo(x + (tipX - x) * 0.7, midY + (yy - midY) * 0.3); g.stroke();
      }
      g.fillStyle = '#D9813B'; g.beginPath(); g.arc(tipX + s * 0.04, midY, s * 0.06, 0, 7); g.fill();
      g.fillStyle = '#5D646E'; g.fillRect(x - s * 0.02, top, s * 0.08, bottom - top);
      // cab window, lit with the pilot inside while you ride
      const p = pilotState(), cabX = x + s * 0.2;
      g.fillStyle = '#0d2a33'; g.fillRect(cabX, winY, s * 0.48, winH);
      if (p.where === 'cab') { g.fillStyle = 'rgba(255,217,138,.35)'; g.fillRect(cabX, winY, s * 0.48, winH); g.fillStyle = '#5D646E'; g.beginPath(); g.arc(cabX + s * 0.24, winY + winH * 0.6, s * 0.1, 0, 7); g.fill(); g.fillStyle = '#9FE3F0'; g.fillRect(cabX + s * 0.22, winY + winH * 0.55, s * 0.05, s * 0.05); }
      // mech hold: side window
      const hx = x + s * 0.85, hw = s * 1.45;
      g.fillStyle = '#0f0b08'; g.fillRect(hx, winY - s * 0.02, hw, winH + s * 0.06);
      g.fillStyle = 'rgba(134,207,220,.35)'; g.fillRect(hx, winY - s * 0.02, hw, 2);
      if (mechState().where === 'hold') { g.save(); g.beginPath(); g.rect(hx, winY - s * 0.02, hw, winH + s * 0.06); g.clip(); drawMechSide(hx + hw / 2, winY + winH + s * 0.04, s * 0.42, p.where === 'mech'); g.restore(); }
      if (p.where === 'walk') { // the pilot walking through to the cab: a little light moving along
        const px = hx + hw * 0.4 + (cabX + s * 0.24 - (hx + hw * 0.4)) * p.k;
        g.fillStyle = '#9FE3F0'; g.beginPath(); g.arc(px, winY - s * 0.06, s * 0.05, 0, 7); g.fill();
      }
      g.fillStyle = 'rgba(134,207,220,.08)'; g.fillRect(hx, winY - s * 0.02, hw, winH + s * 0.06);
      g.strokeStyle = '#8E96A0'; g.lineWidth = 2; g.strokeRect(hx, winY - s * 0.02, hw, winH + s * 0.06);
      // roof doors over the hold: they slide apart to open
      const o = doorsOpen(), half = hw / 2;
      g.fillStyle = '#0f0b08'; g.fillRect(hx, top + roofH * 0.15, hw, roofH * 0.7);
      g.fillStyle = '#4A5059'; g.strokeStyle = '#17130F'; g.lineWidth = 1;
      g.fillRect(hx - half * o * 0.9, top + roofH * 0.12, half, roofH * 0.76); g.strokeRect(hx - half * o * 0.9, top + roofH * 0.12, half, roofH * 0.76);
      g.fillRect(hx + half + half * o * 0.9, top + roofH * 0.12, half, roofH * 0.76); g.strokeRect(hx + half + half * o * 0.9, top + roofH * 0.12, half, roofH * 0.76);
      // small rear deck with the crane
      const dx = x + w - s * 0.5;
      g.fillStyle = '#4A5059'; g.fillRect(dx, top + roofH * 0.1, s * 0.48, roofH * 0.8);
      g.strokeStyle = '#E8B33A'; g.lineWidth = 2; g.setLineDash([4, 3]); g.strokeRect(dx + 2, top + roofH * 0.1 + 2, s * 0.44, roofH * 0.8 - 4); g.setLineDash([]);
      const mx = dx + s * 0.24, my = top + roofH * 0.45, mastTop = my - s * 0.5;
      g.fillStyle = '#E8B33A'; g.fillRect(mx - s * 0.05, mastTop, s * 0.1, my - mastTop);
      const hook = craneTarget();
      let bx, by;
      if (hook) { bx = X(hook.x); by = Y(hook.y) - hook.h * s - s * 1.1; }
      else { bx = hx + hw * 0.55; by = top - s * 0.05; }   // folded along the roof
      g.strokeStyle = '#E8B33A'; g.lineWidth = Math.max(3, s * 0.1); g.lineCap = 'round';
      g.beginPath(); g.moveTo(mx, mastTop); g.lineTo(bx, by); g.stroke(); g.lineCap = 'butt';
      g.strokeStyle = 'rgba(23,19,15,.5)'; g.setLineDash([3, 6]); g.beginPath(); g.moveTo(mx, mastTop); g.lineTo(bx, by); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#2B2A2E'; g.beginPath(); g.arc(mx, mastTop, s * 0.07, 0, 7); g.fill();
      if (hook) { g.strokeStyle = '#2B2A2E'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx, by + s * 0.3); g.stroke(); }
    }
    if (car.id === 'forge') {
      // two chimneys (smoking while a job runs), a roof hopper of ore, and a grated furnace window
      for (const [cxk, r] of [[0.35, 0.13], [0.7, 0.1]]) {
        const cx = x + s * cxk, cy = top + roofH * 0.45;
        g.fillStyle = '#2a1f17'; g.beginPath(); g.arc(cx, cy, s * r, 0, 7); g.fill();
        if (busy) for (let k = 0; k < 3; k++) {
          const ph = (time * 0.6 + k / 3 + cxk) % 1;
          g.fillStyle = 'rgba(160,150,140,' + (0.35 * (1 - ph)) + ')';
          g.beginPath(); g.arc(cx + Math.sin(ph * 6 + k) * s * 0.08, cy - ph * s * 0.7, s * (0.08 + ph * 0.1), 0, 7); g.fill();
        }
      }
      g.fillStyle = '#5D646E'; g.fillRect(x + w - s * 1.4, top + roofH * 0.15, s * 1.2, roofH * 0.7);
      for (let k = 0; k < 5; k++) { g.fillStyle = ['#e08a42', '#e2e6ea', '#f2c94c'][k % 3]; g.beginPath(); g.arc(x + w - s * 1.25 + k * s * 0.22, top + roofH * (0.4 + (k % 2) * 0.2), s * 0.06, 0, 7); g.fill(); }
      const glow = busy ? 0.8 + Math.sin(time * 9) * 0.2 : 0.3;
      g.fillStyle = 'rgba(255,140,60,' + glow + ')'; g.fillRect(x + s * 0.15, winY, s * 0.6, winH);
      g.strokeStyle = 'rgba(138,59,26,.9)'; g.lineWidth = 1.5;
      for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(x + s * 0.15 + k * s * 0.12, winY); g.lineTo(x + s * 0.15 + k * s * 0.12, winY + winH); g.stroke(); }
      g.fillStyle = '#2a1f17'; g.beginPath(); g.arc(x + w - s * 0.45, winY + winH / 2, s * 0.17, 0, 7); g.fill();
      g.fillStyle = busy ? '#FFB347' : '#7a4a2a'; g.beginPath(); g.arc(x + w - s * 0.45, winY + winH / 2, s * 0.1, 0, 7); g.fill();
    }
    if (car.id === 'lab') {
      // glass dome on the roof with a hologram of your computer grid; the nano-bot buzzes around inside
      const cx = x + w / 2, cy = top + roofH * 0.5, rx = w * 0.42, ry = roofH * 0.62;
      g.fillStyle = 'rgba(134,207,220,.16)'; g.strokeStyle = 'rgba(134,207,220,.8)'; g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 7); g.fill(); g.stroke();
      const CPc = C.COMPUTER, cw = s * 0.2, ch = roofH * 0.26;
      for (let yy = 0; yy < CPc.rows; yy++) for (let xx = 0; xx < CPc.cols; xx++) {
        const m = modAt(xx, yy), gx = cx - CPc.cols * cw / 2 + xx * cw, gy = cy - CPc.rows * ch / 2 + yy * ch;
        g.fillStyle = m ? modColor(m.id) : 'rgba(134,207,220,.12)'; g.fillRect(gx + 1, gy + 1, cw - 2, ch - 2);
      }
      if (crewCount()) { const a = time * 1.6; g.fillStyle = '#c9d3d6'; g.beginPath(); g.arc(cx + Math.cos(a) * rx * 0.75, cy + Math.sin(a) * ry * 0.7, s * 0.05, 0, 7); g.fill(); }
      for (const wx of [x + s * 0.15, x + w - s * 0.75]) {
        g.fillStyle = '#0d2a33'; g.fillRect(wx, winY, s * 0.6, winH);
        g.fillStyle = 'rgba(134,207,220,' + (0.5 + Math.sin(time * 3 + wx) * 0.2) + ')';
        for (let k = 0; k < 3; k++) g.fillRect(wx + s * 0.06, winY + 2 + k * winH / 3.2, s * (0.15 + hash(k, wx | 0, 9) * 0.3), 2);
      }
    }
    if (car.id === 'storage') {
      // open hopper: the ore pile grows with what you've stored
      const total = ORE_LIST.reduce((n, o) => n + S.storage[o], 0), n = Math.min(40, Math.ceil(total / 2));
      g.fillStyle = '#6b5a44'; g.fillRect(x + s * 0.1, top + roofH * 0.15, w - s * 0.2, roofH * 0.7);
      const cols = ORE_LIST.filter(o => S.storage[o] > 0).map(o => C.BLOCKS[o].ore);
      for (let k = 0; k < n && cols.length; k++) {
        g.fillStyle = cols[k % cols.length];
        g.beginPath(); g.arc(x + s * 0.2 + hash(k, 3, 77) * (w - s * 0.4), top + roofH * (0.25 + hash(k, 4, 78) * 0.5), s * 0.05, 0, 7); g.fill();
      }
      g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1;
      for (let k = 1; k < 9; k++) { g.beginPath(); g.moveTo(x + k * w / 9, sideTop + 2); g.lineTo(x + k * w / 9, bottom - s * 0.18); g.stroke(); }
    }
    if (car.id === 'computer') {
      // a roof full of server vents and a big screen showing your Flux upgrades as bars
      for (let k = 0; k < 6; k++) { g.fillStyle = '#1a1f27'; g.fillRect(x + s * 0.15 + k * (w - s * 0.3) / 6, top + roofH * 0.2, (w - s * 0.3) / 6 - 3, roofH * 0.6); g.fillStyle = Math.sin(time * 3 + k * 1.7) > 0.3 ? '#86cfdc' : '#3a5a66'; g.fillRect(x + s * 0.2 + k * (w - s * 0.3) / 6, top + roofH * 0.3, 3, 3); }
      const sx2 = x + s * 0.15, sw = s * 0.75;
      g.fillStyle = '#0d2a33'; g.fillRect(sx2, winY, sw, winH);
      { const ids = Object.keys(C.CORE), n = ids.length, bh = (winH - 6) / n; ids.forEach((id, k) => { g.fillStyle = 'rgba(134,207,220,.25)'; g.fillRect(sx2 + 3, winY + 3 + k * bh, sw - 6, Math.max(1, bh - 1)); g.fillStyle = '#86cfdc'; g.fillRect(sx2 + 3, winY + 3 + k * bh, (sw - 6) * coreLevel(id) / C.CORE[id].max, Math.max(1, bh - 1)); }); }
      g.fillStyle = '#0d2a33'; g.fillRect(x + w - s * 0.75, winY, s * 0.6, winH);
      // the right window: docked nano-bots idling inside, or your Flux when the dock is empty
      if (!drawDockWindow(x + w - s * 0.75, winY, s * 0.6, winH, s)) { g.fillStyle = 'rgba(134,207,220,.7)'; g.font = '700 ' + Math.round(s * 0.16) + 'px "Pixelify Sans", monospace'; g.textAlign = 'center'; g.fillText(fmt(S.flux), x + w - s * 0.45, winY + winH * 0.7); }
    }
    if (car.id !== 'engine') { // the door you stand in front of
      const dx = X(door) + s * 0.2;
      g.fillStyle = '#1b1410'; g.fillRect(dx, winY - s * 0.02, s * 0.6, bottom - winY - s * 0.17);
      if (townSpot() === car.id) { g.strokeStyle = '#efe3d3'; g.lineWidth = 1.5; g.strokeRect(dx - 1, winY - s * 0.02 - 1, s * 0.6 + 2, bottom - winY - s * 0.17 + 2); }
    }
  });
  // the town's name sign on the platform's right end
  const sx = X(22.2), sy = Y(ST.platformRow + 1) - s * 0.15;
  g.fillStyle = '#2a1f17'; g.fillRect(sx + s * 0.45, sy + s * 0.3, s * 0.1, s * 0.55);
  g.fillStyle = '#3a2b20'; rr2(g, sx - s * 0.9, sy - s * 0.16, s * 2.8, s * 0.56, 3); g.fill();
  g.strokeStyle = '#d9813b'; g.lineWidth = 1; rr2(g, sx - s * 0.9, sy - s * 0.16, s * 2.8, s * 0.56, 3); g.stroke();
  g.textAlign = 'center'; g.fillStyle = '#efe3d3'; g.font = '700 ' + Math.round(s * 0.24) + 'px "Pixelify Sans", monospace';
  g.fillText(TOWN().name.toUpperCase(), sx + s * 0.5, sy + s * 0.1);
  g.fillStyle = '#d9813b'; g.font = '500 ' + Math.round(s * 0.13) + 'px "IBM Plex Mono", monospace';
  g.fillText('TOWN ' + (S.town + 1) + ' · TRAIN HOME BASE', sx + s * 0.5, sy + s * 0.3);
}
// The mech on the crane hook, drawn above the train while it's lifted in or out
function drawTripMech(X, Y, s) {
  const m = mechState();
  if (m.where !== 'hook') return;
  const sx = X(m.x), groundY = Y(m.y) + s * 0.2;
  g.fillStyle = 'rgba(0,0,0,' + (0.3 - m.h * 0.1) + ')'; g.beginPath(); g.ellipse(sx, groundY, s * 0.35, s * 0.12, 0, 0, 7); g.fill();
  drawWalker(g, sx, Y(m.y) + s * 0.4 - m.h * s, s * 1.15 / 64 * (1 + m.h * 0.12), 'front', 1, time, partIds(), { moving: false, weapon: { id: S.weapon, mk: weaponMk(S.weapon), k: 0 } });
}
// The drilling scene between towns (fills the whole cave view)
function drawTravel() {
  const k = tripK(), u = Math.min(VW / 15, VH / 7.5), cy = VH * 0.56;
  const sky = g.createLinearGradient(0, 0, 0, VH); sky.addColorStop(0, '#2a1f17'); sky.addColorStop(1, '#0b0806');
  g.fillStyle = sky; g.fillRect(0, 0, VW, VH);
  // rock layers scrolling past (the train drills to the left)
  [[0.6, '#3a2d22', 0.2], [1, '#4a3a2c', 0.35], [1.6, '#5a4634', 0.5]].forEach(([sp, col, hh], li) => {
    const off = (time * u * 3 * sp) % (u * 2);
    g.fillStyle = col;
    for (let x = -u * 2; x < VW + u * 2; x += u * 2) {
      const xx = x + off, j = Math.floor((x - off) / (u * 2));
      g.fillRect(xx, VH * (0.08 + li * 0.05) + hash(j, li, 5) * u * 0.4, u * 2.02, VH * hh * 0.5);
      g.fillRect(xx, cy + u * 1.4 - hash(j, li, 6) * u * 0.3, u * 2.02, VH);
    }
    for (let n = 0; n < 6; n++) {   // ore specks in the rock
      const ox = ((hash(n, li, 9) * VW + time * u * 3 * sp) % (VW + u)) - u * 0.5;
      g.fillStyle = ['#e08a42', '#e2e6ea', '#f2c94c', '#9fe3f0'][n % 4];
      g.fillRect(ox, VH * (0.12 + hash(li, n, 3) * 0.2), 4, 4);
    }
  });
  // the bored tunnel
  g.fillStyle = '#120d0a'; g.fillRect(0, cy - u * 1.4, VW, u * 2.8);
  g.fillStyle = 'rgba(134,207,220,.25)'; g.fillRect(0, cy + u * 1.12, VW, 3);
  // the train, side view
  const x0 = VW / 2 - u * 6.2, top = cy - u * 0.9, h = u * 1.7;
  const car = (x, w, col) => { g.fillStyle = col; rr2(g, x, top, w, h, u * 0.15); g.fill(); g.fillStyle = '#d9813b'; g.fillRect(x, top + h * 0.75, w, u * 0.12); g.fillStyle = 'rgba(134,207,220,.6)'; g.fillRect(x + u * 0.1, top + h + u * 0.08, w - u * 0.2, u * 0.06); };
  car(x0, u * 3.6, '#3B3F46'); car(x0 + u * 3.8, u * 2.6, '#4a3a32'); car(x0 + u * 6.6, u * 2.6, '#2f4d5c'); car(x0 + u * 9.4, u * 2.6, '#5d5438');
  // drill head, spinning, with sparks
  const tipX = x0 - u * 1.3;
  g.fillStyle = '#8E96A0'; g.beginPath(); g.moveTo(x0 + 2, top); g.lineTo(x0 + 2, top + h); g.lineTo(tipX, top + h / 2); g.closePath(); g.fill();
  g.strokeStyle = '#5D646E'; g.lineWidth = 3;
  for (let n = 0; n < 5; n++) { const f = (n + (time * 4) % 1) / 5, yy = top + h * f; g.beginPath(); g.moveTo(x0, yy); g.lineTo(x0 + (tipX - x0) * 0.75, top + h / 2 + (yy - top - h / 2) * 0.25); g.stroke(); }
  for (let n = 0; n < 14; n++) {
    const ph = (time * 2 + hash(n, 1, 2)) % 1, a = Math.PI * (0.6 + hash(n, 2, 3) * 0.8);
    g.fillStyle = 'rgba(255,' + (160 + n * 6) + ',80,' + (1 - ph) + ')';
    g.fillRect(tipX + Math.cos(a) * ph * u * 1.4, top + h / 2 - Math.sin(a) * ph * u * 1.2 * (n % 2 ? 1 : -1), 3, 3);
  }
  // cab with the pilot, hold window with the mech, forge glow, lab dome, ore pile
  g.fillStyle = 'rgba(255,217,138,.4)'; g.fillRect(x0 + u * 0.3, top + h * 0.15, u * 0.7, h * 0.4);
  g.fillStyle = '#5D646E'; g.beginPath(); g.arc(x0 + u * 0.65, top + h * 0.4, u * 0.14, 0, 7); g.fill();
  g.fillStyle = '#0f0b08'; g.fillRect(x0 + u * 1.3, top + h * 0.1, u * 2, h * 0.58);
  g.save(); g.beginPath(); g.rect(x0 + u * 1.3, top + h * 0.1, u * 2, h * 0.58); g.clip(); drawMechSide(x0 + u * 2.3, top + h * 0.68, u * 0.75, false); g.restore();
  g.strokeStyle = '#8E96A0'; g.lineWidth = 2; g.strokeRect(x0 + u * 1.3, top + h * 0.1, u * 2, h * 0.58);
  g.fillStyle = 'rgba(255,140,60,' + (0.7 + Math.sin(time * 9) * 0.2) + ')'; g.fillRect(x0 + u * 4.1, top + h * 0.2, u * 1.1, h * 0.4);
  g.fillStyle = 'rgba(134,207,220,.25)'; g.beginPath(); g.ellipse(x0 + u * 7.9, top, u * 1.1, u * 0.5, 0, Math.PI, 0); g.fill();
  g.fillStyle = '#6b5a44'; g.beginPath(); g.ellipse(x0 + u * 10.7, top, u * 1.2, u * 0.3, 0, Math.PI, 0); g.fill();
  // captions
  g.textAlign = 'center'; g.fillStyle = '#efe3d3'; g.font = '700 ' + Math.round(u * 0.42) + 'px "Pixelify Sans", monospace';
  g.fillText(TOWN().name + '  →  ' + C.TOWNS[trip.dest].name, VW / 2, VH * 0.2);
  g.fillStyle = '#a8937c'; g.font = '500 ' + Math.round(Math.max(11, u * 0.2)) + 'px "IBM Plex Mono", monospace';
  g.fillText('Press any key or tap to skip', VW / 2, VH * 0.2 + u * 0.45);
  g.fillStyle = '#3a2b20'; g.fillRect(VW * 0.3, VH * 0.2 + u * 0.7, VW * 0.4, 4);
  g.fillStyle = '#d9813b'; g.fillRect(VW * 0.3, VH * 0.2 + u * 0.7, VW * 0.4 * k, 4);
  const fade = k < 0.1 ? 1 - k / 0.1 : k > 0.9 ? (k - 0.9) / 0.1 : 0;
  if (fade > 0) { g.fillStyle = 'rgba(0,0,0,' + fade + ')'; g.fillRect(0, 0, VW, VH); }
}
const fogCv = document.createElement('canvas');
// ---------- Pip's shop ----------
// Pip runs a different shop in each town: the Burrow Workshop (dirt floor, lanterns) in Hollowmouth,
// and the Salvage Garage (steel floor, a mech lift) in Rustvale.
const garageShop = () => TOWN().shop === 'garage';
function drawShopFloor(c, r, x, y, s) {
  const t = at(c, r), SH = C.SHOP, gar = garageShop();
  if (gar) {
    g.fillStyle = (c + r) % 2 ? '#4A5059' : '#4f555e'; g.fillRect(x, y, s, s);                          // steel floor plates
    g.fillStyle = '#6d737c'; g.fillRect(x + 3, y + 3, 2, 2); g.fillRect(x + s - 5, y + s - 5, 2, 2);
    // the mech lift in the middle of the floor, with a hazard border
    const L = c >= SH.door && c < SH.door + SH.doorW && r >= 2 && r <= 4;
    if (L) {
      g.fillStyle = '#3B3F46'; g.fillRect(x, y, s, s);
      g.strokeStyle = '#E8B33A'; g.lineWidth = Math.max(2, s * 0.08); g.setLineDash([6, 5]); g.beginPath();
      if (c === SH.door) { g.moveTo(x + 2, y); g.lineTo(x + 2, y + s); }
      if (c === SH.door + SH.doorW - 1) { g.moveTo(x + s - 2, y); g.lineTo(x + s - 2, y + s); }
      if (r === 4) { g.moveTo(x, y + 2); g.lineTo(x + s, y + 2); }
      if (r === 2) { g.moveTo(x, y + s - 2); g.lineTo(x + s, y + s - 2); }
      g.stroke(); g.setLineDash([]);
    }
  } else {
    g.fillStyle = '#5a4232'; g.fillRect(x, y, s, s);                                                      // packed dirt
    g.fillStyle = '#6e5440'; for (let k = 0; k < 3; k++) g.fillRect(x + s * hash(c, r, k + 20), y + s * hash(r, c, k + 21), 3, 3);
  }
  if (r >= SH.pipRow) { g.fillStyle = gar ? '#2f3238' : '#3e2e23'; g.fillRect(x, y, s, s); }             // behind the counter
  if (t === 'shopdoor') {
    if (gar) { g.fillStyle = '#8E96A0'; g.fillRect(x, y + s * 0.5, s, s * 0.5); g.fillStyle = '#5D646E'; for (let k = 0; k < 3; k++) g.fillRect(x, y + s * (0.58 + k * 0.13), s, 2); g.fillStyle = '#E8B33A'; g.fillRect(x, y + s * 0.44, s, s * 0.06); }
    else { g.fillStyle = '#0b0806'; g.beginPath(); g.ellipse(x + (c === SH.door ? s : 0), y + s, s * 0.95, s * 0.5, 0, Math.PI, 0); g.fill(); }
    if (c === SH.door + SH.doorW - 1) { g.fillStyle = '#efe3d3'; g.font = '700 ' + Math.round(s * 0.2) + 'px "Pixelify Sans", monospace'; g.textAlign = 'center'; g.fillText('TOWN', x + s - SH.doorW * s / 2, y + s * 0.35); }   // drawn on the last door tile so nothing paints over it
  }
  const st = C.SHOP.stands.find(k => k.row === r && Math.abs(k.col - c) === 1);
  if (st && shopSpot() === 'stand-' + st.slot) { g.strokeStyle = 'rgba(239,227,211,.6)'; g.lineWidth = 1.5; g.strokeRect(x + 3, y + 3, s - 6, s - 6); }
}
// The weapon rack: a hammer, a rivet gun and a little shield on hooks
function drawWeaponRack(x, y, s, W) {
  const ty = y - W, gar = garageShop();
  g.fillStyle = gar ? '#2f3238' : '#2a1f17'; g.fillRect(x + s * 0.08, y + s - W, s * 0.84, W);
  g.fillStyle = gar ? '#5D646E' : '#7a5538'; g.fillRect(x + s * 0.08, ty + s * 0.1, s * 0.84, s * 0.8);
  g.fillStyle = '#8E96A0'; g.fillRect(x + s * 0.2, ty + s * 0.2, s * 0.06, s * 0.45); g.fillRect(x + s * 0.13, ty + s * 0.2, s * 0.2, s * 0.12);   // hammer
  g.fillStyle = '#5D646E'; g.fillRect(x + s * 0.42, ty + s * 0.3, s * 0.2, s * 0.08); g.fillRect(x + s * 0.42, ty + s * 0.3, s * 0.06, s * 0.22);   // rivet gun
  g.fillStyle = 'rgba(134,207,220,.8)'; g.beginPath(); g.ellipse(x + s * 0.76, ty + s * 0.42, s * 0.1, s * 0.18, 0, 0, 7); g.fill();               // shield
  g.fillStyle = '#efe3d3'; g.font = '700 ' + Math.round(s * 0.15) + 'px "Pixelify Sans", monospace'; g.textAlign = 'center';
  g.fillText('WEAPONS', x + s * 0.5, ty + s * 0.86);
}
// A display stand with its part on top
const STAND_ICON = { head: '#86cfdc', arms: '#a8a39c', body: '#d9813b', legs: '#7a756f' };
function drawStand(c, r, x, y, s, W) {
  const st = C.SHOP.stands.find(k => k.col === c && k.row === r), slot = st.slot, ty = y - W;
  if (slot === 'weapon') return drawWeaponRack(x, y, s, W);
  const gar = garageShop();
  g.fillStyle = gar ? '#2f3238' : '#2a1f17'; g.fillRect(x + s * 0.08, y + s - W, s * 0.84, W);            // front
  g.fillStyle = gar ? '#5D646E' : '#7a5538'; g.fillRect(x + s * 0.08, ty + s * 0.1, s * 0.84, s * 0.8);   // steel shelf or pegboard
  if (gar) { g.fillStyle = '#E8B33A'; g.fillRect(x + s * 0.08, ty + s * 0.1, s * 0.84, s * 0.05); }
  else { g.fillStyle = 'rgba(0,0,0,.25)'; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) g.fillRect(x + s * (0.22 + a * 0.28), ty + s * (0.2 + b * 0.25), 2, 2); }
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x + s * 0.5, ty + s * 0.62, s * 0.3, s * 0.1, 0, 0, 7); g.fill();
  const cx = x + s * 0.5, cy = ty + s * 0.42, k = s * 0.22, col = STAND_ICON[slot];
  g.fillStyle = col; g.strokeStyle = '#16110d'; g.lineWidth = 1.5;
  if (slot === 'head') { g.beginPath(); g.arc(cx, cy + k * 0.3, k, Math.PI, 0); g.closePath(); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(cx - k * 0.5, cy - k * 0.3, k * 0.3, k * 0.3); }
  if (slot === 'arms') { g.fillRect(cx - k * 0.25, cy - k, k * 0.5, k * 1.4); g.strokeRect(cx - k * 0.25, cy - k, k * 0.5, k * 1.4); g.beginPath(); g.moveTo(cx - k * 0.6, cy + k * 0.4); g.lineTo(cx, cy + k * 1.1); g.lineTo(cx + k * 0.6, cy + k * 0.4); g.closePath(); g.fill(); g.stroke(); }
  if (slot === 'body') { rr2(g, cx - k * 0.7, cy - k * 0.9, k * 1.4, k * 1.8, k * 0.4); g.fill(); g.stroke(); g.fillStyle = '#16110d'; g.fillRect(cx - k * 0.7, cy - k * 0.1, k * 1.4, k * 0.2); }
  if (slot === 'legs') { g.fillRect(cx - k * 0.7, cy - k, k * 0.45, k * 1.6); g.fillRect(cx + k * 0.25, cy - k, k * 0.45, k * 1.6); g.strokeRect(cx - k * 0.7, cy - k, k * 0.45, k * 1.6); g.strokeRect(cx + k * 0.25, cy - k, k * 0.45, k * 1.6); }
  const next = C.PARTS[slot].tiers[S.tiers[slot] + 1];
  g.fillStyle = '#efe3d3'; g.font = '700 ' + Math.round(s * 0.15) + 'px "Pixelify Sans", monospace'; g.textAlign = 'center';
  g.fillText(C.PARTS[slot].label.toUpperCase(), cx, ty + s * 0.86);
  if (next) { g.fillStyle = '#d9813b'; g.fillText(fmt(next.cost), cx, ty + s * 0.08); }
}
function drawCounter(c, r, x, y, s, W) {
  const ty = y - W;
  if (garageShop()) {   // a steel workbench with hazard stripes
    g.fillStyle = '#3B3F46'; g.fillRect(x, y + s - W, s, W);
    g.fillStyle = '#E8B33A'; for (let k = 0; k < 3; k++) g.fillRect(x + k * s / 3, y + s - W * 0.6, s / 6, W * 0.4);
    g.fillStyle = '#6d737c'; g.fillRect(x, ty, s, s);
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x, ty + s * 0.2, s, 2);
    if (c === C.SHOP.door + 4) { g.fillStyle = '#0d2a33'; g.fillRect(x + s * 0.15, ty + s * 0.15, s * 0.7, s * 0.45); g.fillStyle = 'rgba(134,207,220,.7)'; g.fillRect(x + s * 0.22, ty + s * 0.25, s * 0.4, 2); g.fillRect(x + s * 0.22, ty + s * 0.35, s * 0.3, 2); }
  } else {   // a big tree-stump counter: wood with growth rings
    g.fillStyle = '#6a4a30'; g.fillRect(x, y + s - W, s, W);
    g.fillStyle = '#8a6440'; g.fillRect(x, ty, s, s);
    g.strokeStyle = '#6a4a30'; g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(x + s * 0.5, ty + s * 0.5, s * 0.36, s * 0.22, 0, 0, 7); g.stroke();
    g.beginPath(); g.ellipse(x + s * 0.5, ty + s * 0.5, s * 0.16, s * 0.1, 0, 0, 7); g.stroke();
  }
  if (c === C.SHOP.door - 1) { g.fillStyle = '#f2c94c'; for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(x + s * 0.5, ty + s * (0.6 - k * 0.09), s * 0.16, s * 0.07, 0, 0, 7); g.fill(); } } // a stack of coins
  if (c === C.SHOP.door + 3) { g.fillStyle = '#5b5753'; g.fillRect(x + s * 0.25, ty + s * 0.35, s * 0.5, s * 0.35); g.fillStyle = '#e08a42'; g.fillRect(x + s * 0.3, ty + s * 0.4, s * 0.12, s * 0.1); } // a scale with ore
}
// Pip the Mole, the shopkeeper, behind the counter
function drawPip(x, y, s, W) {
  const cx = x + s * 0.5, cy = y + s * 0.55 - W + Math.sin(time * 2) * s * 0.02;
  g.fillStyle = '#5a463a'; g.beginPath(); g.ellipse(cx, cy, s * 0.42, s * 0.5, 0, 0, 7); g.fill();           // body
  const gar = garageShop();
  g.fillStyle = gar ? '#86CFDC' : '#d9813b'; g.beginPath(); g.ellipse(cx, cy + s * 0.18, s * 0.28, s * 0.28, 0, 0, Math.PI); g.fill(); // apron
  if (gar) { g.fillStyle = '#E8B33A'; g.beginPath(); g.ellipse(cx, cy - s * 0.34, s * 0.3, s * 0.16, 0, Math.PI, 0); g.fill(); g.fillRect(cx - s * 0.36, cy - s * 0.36, s * 0.72, s * 0.06); }   // hard hat
  g.fillStyle = '#e9a0a0'; g.beginPath(); g.arc(cx, cy - s * 0.02, s * 0.09, 0, 7); g.fill();                // nose
  g.fillStyle = '#16110d'; g.fillRect(cx - s * 0.17, cy - s * 0.2, s * 0.06, s * 0.06); g.fillRect(cx + s * 0.11, cy - s * 0.2, s * 0.06, s * 0.06);
  g.fillStyle = '#d9c7b0'; const wave = Math.max(0, Math.sin(time * 1.3)) * s * 0.12;                        // a waving claw
  g.fillRect(cx + s * 0.34, cy - s * 0.05 - wave, s * 0.16, s * 0.1); g.fillRect(cx - s * 0.5, cy + s * 0.05, s * 0.16, s * 0.1);
  g.fillStyle = '#3a2b20'; rr2(g, cx - s * 0.7, cy - s * 1.15, s * 1.4, s * 0.36, 3); g.fill();              // name sign
  g.fillStyle = '#efe3d3'; g.font = '700 ' + Math.round(s * 0.2) + 'px "Pixelify Sans", monospace'; g.textAlign = 'center';
  g.fillText(gar ? 'PIP\'S SALVAGE' : 'PIP\'S PARTS', cx, cy - s * 0.9);
}
// Extra details in each shop: lanterns and a rug in the burrow; tyres, a toolbox and lift arms in the garage
function drawShopDecor(X, Y, s) {
  const SH = C.SHOP, [c0, c1] = SH.cols;
  if (garageShop()) {
    for (const side of [-1, 1]) {   // robot arms beside the lift
      const bx = side < 0 ? X(SH.door) - s * 0.15 : X(SH.door + SH.doorW) + s * 0.15, by = Y(3.5);
      g.strokeStyle = '#E8B33A'; g.lineWidth = Math.max(3, s * 0.1); g.lineCap = 'round';
      g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + side * s * 0.4, by - s * 0.3); g.lineTo(bx + side * s * 0.15, by - s * 0.6); g.stroke(); g.lineCap = 'butt';
      g.fillStyle = '#5D646E'; g.beginPath(); g.arc(bx, by, s * 0.1, 0, 7); g.fill();
    }
    for (const [tx, ty] of [[c0 + 0.5, 1.5], [c0 + 0.9, 1.3]]) { g.fillStyle = '#2B2A2E'; g.beginPath(); g.arc(X(tx), Y(ty), s * 0.28, 0, 7); g.fill(); g.fillStyle = '#4A5059'; g.beginPath(); g.arc(X(tx), Y(ty), s * 0.11, 0, 7); g.fill(); }
    g.fillStyle = '#c0392b'; g.fillRect(X(c1) + s * 0.15, Y(2) + s * 0.25, s * 0.7, s * 0.4); g.fillStyle = '#2B2A2E'; g.fillRect(X(c1) + s * 0.15, Y(2) + s * 0.38, s * 0.7, 2);
  } else {
    g.fillStyle = 'rgba(138,59,42,.85)'; g.beginPath(); g.ellipse(X(SH.door + 1), Y(3), s * 1.6, s * 0.95, 0, 0, 7); g.fill();   // round rug
    g.strokeStyle = 'rgba(217,129,59,.8)'; g.lineWidth = 2; g.setLineDash([8, 5]); g.beginPath(); g.ellipse(X(SH.door + 1), Y(3), s * 1.35, s * 0.75, 0, 0, 7); g.stroke(); g.setLineDash([]);
    for (const [lx, ly] of [[c0 + 0.5, SH.rows - 1.5], [c1 + 0.5, SH.rows - 1.5], [c0 + 0.5, 1.5], [c1 + 0.5, 1.5]]) {
      const gl = g.createRadialGradient(X(lx), Y(ly), 0, X(lx), Y(ly), s * 1.4);
      gl.addColorStop(0, 'rgba(255,179,71,.25)'); gl.addColorStop(1, 'rgba(255,179,71,0)');
      g.fillStyle = gl; g.fillRect(X(lx) - s * 1.4, Y(ly) - s * 1.4, s * 2.8, s * 2.8);
      g.fillStyle = '#ffd98a'; g.beginPath(); g.arc(X(lx), Y(ly), s * 0.09, 0, 7); g.fill();
    }
  }
}
// ---------- Pip's shop, seen from town ----------
// Burrow Workshop (Hollowmouth): a grassy mound with a round 2-block double door, chimney, window and lanterns
function drawBurrowOutside(X, Y, s, W) {
  const B = C.TOWN.shop, x0 = X(B.cols[0]), w = (B.cols[1] - B.cols[0] + 1) * s, h = (B.rows[1] - B.rows[0] + 1) * s;
  const yR = Y(B.rows[1] + 1) - W * 2.2, yF = yR + h, fh = W * 2.2, cx = x0 + w / 2;
  g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(cx, yF + fh, w * 0.55, s * 0.25, 0, 0, 7); g.fill();
  g.fillStyle = '#2f3b22'; g.beginPath(); g.ellipse(cx, yR + h * 0.6, w * 0.56, h * 0.7, 0, 0, 7); g.fill();
  g.fillStyle = '#4a5b33'; g.beginPath(); g.ellipse(cx, yR + h * 0.55, w * 0.5, h * 0.6, 0, 0, 7); g.fill();
  g.fillStyle = '#56693b'; g.beginPath(); g.ellipse(cx, yR + h * 0.45, w * 0.38, h * 0.42, 0, 0, 7); g.fill();
  g.fillStyle = '#7d9a4f'; for (let k = 0; k < 8; k++) g.fillRect(x0 + w * (0.2 + hash(k, 1, 30) * 0.6), yR + h * (0.15 + hash(k, 2, 31) * 0.5), 3, 3);
  g.fillStyle = '#5a4232'; rr2(g, x0 + s * 0.1, yF - s * 0.15, w - s * 0.2, fh + s * 0.15, s * 0.3); g.fill();   // dirt front
  g.strokeStyle = '#2a1f17'; g.lineWidth = 2; rr2(g, x0 + s * 0.1, yF - s * 0.15, w - s * 0.2, fh + s * 0.15, s * 0.3); g.stroke();
  // chimney pipe with smoke, round window
  const px = x0 + w - s * 1.2;
  g.fillStyle = '#5D646E'; g.fillRect(px, yR - s * 0.1, s * 0.22, s * 0.6);
  for (let k = 0; k < 3; k++) { const ph = (time * 0.5 + k / 3) % 1; g.fillStyle = 'rgba(160,150,140,' + (0.3 * (1 - ph)) + ')'; g.beginPath(); g.arc(px + s * 0.11 + Math.sin(ph * 5) * s * 0.1, yR - s * 0.2 - ph * s * 0.8, s * (0.08 + ph * 0.12), 0, 7); g.fill(); }
  g.fillStyle = 'rgba(134,207,220,.35)'; g.strokeStyle = '#5a4232'; g.lineWidth = 3; g.beginPath(); g.arc(x0 + s * 1.1, yR + h * 0.45, s * 0.28, 0, 7); g.fill(); g.stroke();
  // round double door across the two door blocks
  const dl = X(B.door) + s * 0.08, dr = X(B.door + B.doorW) - s * 0.08, dw = dr - dl, bot = yF + fh, arcY = yF + fh * 0.2;
  g.fillStyle = 'rgba(255,179,71,.25)'; g.beginPath(); g.ellipse((dl + dr) / 2, bot, dw * 0.7, s * 0.3, 0, 0, 7); g.fill();
  g.fillStyle = '#8a6440'; g.strokeStyle = '#2a1f17'; g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(dl, bot); g.lineTo(dl, arcY); g.arc((dl + dr) / 2, arcY, dw / 2, Math.PI, 0); g.lineTo(dr, bot); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo((dl + dr) / 2, arcY - dw / 2); g.lineTo((dl + dr) / 2, bot); g.stroke();
  g.fillStyle = '#f2c94c'; g.beginPath(); g.arc((dl + dr) / 2 - s * 0.12, bot - fh * 0.4, s * 0.05, 0, 7); g.arc((dl + dr) / 2 + s * 0.12, bot - fh * 0.4, s * 0.05, 0, 7); g.fill();
  // sign above the door, lanterns on each side
  g.fillStyle = '#3a2b20'; rr2(g, (dl + dr) / 2 - s * 0.95, arcY - dw / 2 - s * 0.48, s * 1.9, s * 0.38, 3); g.fill();
  g.strokeStyle = '#d9813b'; g.lineWidth = 1; rr2(g, (dl + dr) / 2 - s * 0.95, arcY - dw / 2 - s * 0.48, s * 1.9, s * 0.38, 3); g.stroke();
  g.fillStyle = '#efe3d3'; g.font = '700 ' + Math.round(s * 0.22) + 'px "Pixelify Sans", monospace'; g.textAlign = 'center';
  g.fillText('PIP\'S PARTS', (dl + dr) / 2, arcY - dw / 2 - s * 0.22);
  for (const lx of [dl - s * 0.3, dr + s * 0.3]) {
    g.fillStyle = '#2a1f17'; g.fillRect(lx - 1.5, bot - s * 0.55, 3, s * 0.55);
    g.fillStyle = 'rgba(255,179,71,.25)'; g.beginPath(); g.arc(lx, bot - s * 0.6, s * 0.3, 0, 7); g.fill();
    g.fillStyle = '#ffd98a'; g.beginPath(); g.arc(lx, bot - s * 0.6, s * 0.08, 0, 7); g.fill();
  }
}
// Salvage Garage (Rustvale): corrugated metal with a 2-block roller door, a glowing sign and a roof gantry
function drawGarageOutside(X, Y, s, W) {
  const B = C.TOWN.shop, x0 = X(B.cols[0]), w = (B.cols[1] - B.cols[0] + 1) * s, h = (B.rows[1] - B.rows[0] + 1) * s;
  const yR = Y(B.rows[1] + 1) - W * 2.2, yF = yR + h, fh = W * 2.2;
  g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x0 + s * 0.1, yF + fh, w, s * 0.15);
  g.fillStyle = '#5D646E'; g.fillRect(x0, yR, w, h);
  g.fillStyle = '#4A5059'; for (let k = 0; k < 12; k++) g.fillRect(x0 + s * 0.15 + k * w / 12, yR + 2, 3, h - 4);
  g.fillStyle = '#3B3F46'; g.fillRect(x0, yF, w, fh);
  g.fillStyle = '#E8B33A'; g.fillRect(x0, yF + fh - s * 0.12, w, s * 0.12);
  g.fillStyle = '#17130F'; for (let k = 0; k < w; k += s * 0.3) g.fillRect(x0 + k, yF + fh - s * 0.12, s * 0.12, s * 0.12);
  // roller door across the two door blocks, with warning lights
  const dl = X(B.door) + s * 0.06, dw = B.doorW * s - s * 0.12;
  g.fillStyle = '#8E96A0'; g.fillRect(dl, yF + fh * 0.18, dw, fh * 0.82 - s * 0.12);
  g.fillStyle = '#5D646E'; for (let k = 1; k < 6; k++) g.fillRect(dl, yF + fh * 0.18 + k * fh * 0.13, dw, 2);
  g.fillStyle = '#E8B33A'; g.fillRect(dl, yF + fh * 0.1, dw, fh * 0.1);
  const blink = Math.sin(time * 4) > 0 ? '#ffb347' : '#7a4a2a';
  g.fillStyle = blink; g.beginPath(); g.arc(dl - s * 0.12, yF + fh * 0.3, s * 0.06, 0, 7); g.arc(dl + dw + s * 0.12, yF + fh * 0.3, s * 0.06, 0, 7); g.fill();
  // glowing sign on the roof and a little gantry crane
  g.fillStyle = '#16110d'; rr2(g, x0 + w / 2 - s * 1.2, yR + h * 0.18, s * 2.4, s * 0.5, 4); g.fill();
  g.strokeStyle = 'rgba(134,207,220,' + (0.7 + Math.sin(time * 3) * 0.2) + ')'; g.lineWidth = 2; rr2(g, x0 + w / 2 - s * 1.2, yR + h * 0.18, s * 2.4, s * 0.5, 4); g.stroke();
  g.fillStyle = '#9fe3f0'; g.font = '700 ' + Math.round(s * 0.24) + 'px "Pixelify Sans", monospace'; g.textAlign = 'center';
  g.fillText('PIP\'S SALVAGE', x0 + w / 2, yR + h * 0.18 + s * 0.33);
  g.strokeStyle = '#E8B33A'; g.lineWidth = Math.max(2, s * 0.08);
  g.beginPath(); g.moveTo(x0 + w - s * 0.5, yR + h * 0.9); g.lineTo(x0 + w - s * 0.5, yR - s * 0.3); g.lineTo(x0 + w - s * 1.4, yR - s * 0.3); g.stroke();
  g.strokeStyle = '#2B2A2E'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x0 + w - s * 1.3, yR - s * 0.3); g.lineTo(x0 + w - s * 1.3, yR + s * 0.1); g.stroke();
  // tyre stack by the wall
  for (let k = 0; k < 2; k++) { g.fillStyle = '#2B2A2E'; g.beginPath(); g.arc(x0 + s * (0.45 + k * 0.4), yF + fh * 0.55, s * 0.2, 0, 7); g.fill(); g.fillStyle = '#4A5059'; g.beginPath(); g.arc(x0 + s * (0.45 + k * 0.4), yF + fh * 0.55, s * 0.08, 0, 7); g.fill(); }
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
    const x = X(gc), y = Y(r + 1) - W, open = gateOpen(k), cv = gateCave(k), rust = TOWN().style === 'rust';
    if (rust) {   // a steel mine-head frame with a hazard-striped beam
      g.fillStyle = '#4A5059'; g.fillRect(x - s * 0.02, y - s * 0.1, s * 0.14, s + W + s * 0.1); g.fillRect(x + s * 0.88, y - s * 0.1, s * 0.14, s + W + s * 0.1);
      for (let k2 = 0; k2 < 5; k2++) { g.fillStyle = k2 % 2 ? '#17130F' : '#E8B33A'; g.fillRect(x - s * 0.05 + k2 * s * 0.22, y - s * 0.18, s * 0.22, s * 0.12); }
      g.strokeStyle = '#5D646E'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + s * 0.05, y + s * 0.6); g.lineTo(x + s * 0.5, y - s * 0.06); g.lineTo(x + s * 0.95, y + s * 0.6); g.stroke();
      if (open) { g.fillStyle = 'rgba(255,179,71,' + (0.5 + Math.sin(time * 3 + k) * 0.3) + ')'; g.beginPath(); g.arc(x + s * 0.5, y + s * 0.15, s * 0.06, 0, 7); g.fill(); }
    } else {
      g.strokeStyle = '#6a5038'; g.lineWidth = Math.max(3, s * 0.1);
      g.beginPath(); g.moveTo(x + s * 0.08, y + s + W); g.lineTo(x + s * 0.08, y + s * 0.2); g.arc(x + s * 0.5, y + s * 0.2, s * 0.42, Math.PI, 0); g.lineTo(x + s * 0.92, y + s + W); g.stroke();
    }
    const sx = x - s * 0.9, sy = y - s * 0.8, w = s * 2.8, h = s * 0.62;
    g.fillStyle = rust ? '#2f3238' : '#3a2b20'; rr2(g, sx, sy, w, h, 3); g.fill();
    if (rust) { g.strokeStyle = '#5D646E'; g.lineWidth = 1; rr2(g, sx, sy, w, h, 3); g.stroke(); }
    g.textAlign = 'center';
    g.fillStyle = open ? '#efe3d3' : '#a8937c'; g.font = '700 ' + Math.round(s * 0.22) + 'px "Pixelify Sans", monospace';
    g.fillText(cv == null ? 'CAVE ?' : caveLabel(cv).toUpperCase() + (S.caves[cv].relicDone ? ' · CLEARED' : ''), sx + w / 2, sy + h * 0.42);
    g.fillStyle = open ? '#d9813b' : '#a8937c'; g.font = '500 ' + Math.round(s * 0.16) + 'px "IBM Plex Mono", monospace';
    g.fillText(cv == null ? 'COMING SOON' : open ? C.CAVES[cv].name.toUpperCase() : 'SEALED', sx + w / 2, sy + h * 0.82);
  });
}
// ---------- Outposts: the Miner's Waystation look (v0.13.2) ----------
// Helpers: a soft glow (rgb as "r,g,b"), centred text, the floor under a building's footprint (its cells are never
// drawn as floor), and how full your battery is (the charge lamp fills as you recharge)
function opGlow(x, y, r, rgb, a) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + rgb + ',0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
function opText(t, x, y, size, col) { g.fillStyle = col; g.font = '700 ' + Math.round(size) + 'px "Pixelify Sans", monospace'; g.textAlign = 'center'; g.fillText(t, x, y); }
function opFloor(x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); g.fillStyle = 'rgba(255,230,200,.05)'; for (let q = 0; q < 6; q++) g.fillRect(x + (q * 37 % w), y + (q * 53 % h), 3, 3); }
const opCharge = () => Math.max(0, Math.min(1, P.battery / batteryMax()));
// The entrance outpost: a timber hut on a stone footing, a pitched plank roof with a smoking chimney, a warm-lit
// door, a lantern post that doubles as the charger (its amber ring fills as you charge) and an ore cart by the wall
function drawBaseBuilding(X, Y, s, W) {
  const B = C.BASE_BUILDING, x = X(B.cols[0]), w = (B.cols[1] - B.cols[0] + 1) * s, h = 2 * s;
  const y = Y(B.rows[1] + 1) - W * 2.2, fh = W * 2.2;
  opFloor(x, Y(B.rows[1] + 1), w, 2 * s, '#3a3128');
  g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x + s * 0.15, y + h + fh, w, s * 0.15);
  // stone footing and plank walls
  g.fillStyle = '#5b5753'; g.fillRect(x, y + h + fh * 0.72, w, fh * 0.28);
  for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#6a655f' : '#4f4b47'; g.fillRect(x + k * w / 8 + 1, y + h + fh * 0.75, w / 8 - 2, fh * 0.22); }
  g.fillStyle = '#6a4a30'; g.fillRect(x, y + h, w, fh * 0.72);
  g.fillStyle = 'rgba(0,0,0,.25)'; for (let k = 1; k < 4; k++) g.fillRect(x, y + h + k * fh * 0.18, w, 1);
  // pitched plank roof, seen from above: two slopes and a ridge
  g.fillStyle = '#7a5230'; g.fillRect(x - s * 0.1, y, w + s * 0.2, h / 2);
  g.fillStyle = '#5e3f26'; g.fillRect(x - s * 0.1, y + h / 2, w + s * 0.2, h / 2);
  g.fillStyle = 'rgba(0,0,0,.25)'; for (let k = 0; k < 12; k++) { g.fillRect(x - s * 0.1 + k * (w + s * 0.2) / 12, y, 1, h); }
  g.fillStyle = '#3a2b20'; g.fillRect(x - s * 0.1, y + h / 2 - 2, w + s * 0.2, 4);
  // chimney with smoke
  const cx = x + w * 0.78;
  g.fillStyle = '#5b5753'; g.fillRect(cx, y - s * 0.25, s * 0.35, s * 0.6); g.fillStyle = '#2a2420'; g.fillRect(cx + 3, y - s * 0.22, s * 0.35 - 6, s * 0.12);
  for (let k = 0; k < 3; k++) { const ph = (time * 0.5 + k / 3) % 1; g.fillStyle = 'rgba(160,150,140,' + (0.3 * (1 - ph)) + ')'; g.beginPath(); g.arc(cx + s * 0.17 + Math.sin(ph * 5) * s * 0.1, y - s * 0.3 - ph * s * 0.9, s * (0.1 + ph * 0.14), 0, 7); g.fill(); }
  // door with warm light, window, hanging sign
  const dx = x + w * 0.62, dy = y + h + fh * 0.12;
  opGlow(dx + s * 0.3, y + h + fh, s * 1.2, '255,179,71', 0.25);
  g.fillStyle = '#2a1f17'; g.fillRect(dx, dy, s * 0.6, fh * 0.62);
  g.fillStyle = 'rgba(255,190,110,.55)'; g.fillRect(dx + 3, dy + 3, s * 0.6 - 6, fh * 0.62 - 3);
  g.fillStyle = '#ffd98a'; g.fillRect(x + s * 0.4, dy + 2, s * 0.55, fh * 0.32);
  g.strokeStyle = '#3a2b20'; g.lineWidth = 2; g.strokeRect(x + s * 0.4, dy + 2, s * 0.55, fh * 0.32);
  g.beginPath(); g.moveTo(x + s * 0.675, dy + 2); g.lineTo(x + s * 0.675, dy + 2 + fh * 0.32); g.stroke();
  g.fillStyle = '#3a2b20'; g.fillRect(x + w * 0.2, y + h * 0.18, w * 0.6, s * 0.5);
  g.strokeStyle = '#d9813b'; g.lineWidth = 1.5; g.strokeRect(x + w * 0.2, y + h * 0.18, w * 0.6, s * 0.5);
  opText('OUTPOST', x + w / 2, y + h * 0.18 + s * 0.36, s * 0.3, '#efe3d3');
  // charging post with a cable reel, and an amber charge lamp that fills up
  const px = x + w + s * 0.2, py = y + h + fh * 0.1;
  g.fillStyle = '#3a2b20'; g.fillRect(px, py - s * 0.6, s * 0.3, s * 0.6 + fh * 0.9);
  g.fillStyle = '#2B2A2E'; g.beginPath(); g.arc(px + s * 0.15, py, s * 0.2, 0, 7); g.fill();
  g.strokeStyle = '#E8B33A'; g.lineWidth = 2; g.beginPath(); g.arc(px + s * 0.15, py, s * 0.13, 0, 7 * opCharge()); g.stroke();
  g.fillStyle = '#ffd98a'; g.beginPath(); g.arc(px + s * 0.15, py - s * 0.62, s * 0.08, 0, 7); g.fill();
  opGlow(px + s * 0.15, py - s * 0.62, s * 0.6, '255,200,110', 0.4);
  // an ore cart by the wall
  const ox = x - s * 0.8, oy = y + h + fh * 0.35;
  g.fillStyle = '#4A5059'; g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + s * 0.7, oy); g.lineTo(ox + s * 0.6, oy + s * 0.4); g.lineTo(ox + s * 0.1, oy + s * 0.4); g.closePath(); g.fill();
  g.fillStyle = '#e08a42'; g.beginPath(); g.ellipse(ox + s * 0.35, oy, s * 0.3, s * 0.1, 0, 0, 7); g.fill();
  g.fillStyle = '#2B2A2E'; g.beginPath(); g.arc(ox + s * 0.18, oy + s * 0.45, s * 0.08, 0, 7); g.arc(ox + s * 0.52, oy + s * 0.45, s * 0.08, 0, 7); g.fill();
}
// The halfway outpost: a timber shack with a lantern, beside plank decking (the pad, drawn in drawFloor)
function drawOutpost(k, X, Y, s, W) {
  const row = outpostRow(k), x = X(BELT + 2), y = Y(row + 1) - W * 1.6;
  opFloor(x, Y(row + 1), s, 2 * s, cave().floor);
  // a timber lean-to shack with a lantern on a pole
  g.fillStyle = '#5e3f26'; g.fillRect(x - s * 0.05, y, s * 1.1, s * 2);
  g.fillStyle = 'rgba(0,0,0,.25)'; for (let q = 1; q < 6; q++) g.fillRect(x - s * 0.05, y + q * s * 0.33, s * 1.1, 1);
  g.fillStyle = '#6a4a30'; g.fillRect(x, y + s * 2, s, W * 1.6);
  g.fillStyle = 'rgba(255,190,110,.55)'; g.fillRect(x + s * 0.3, y + s * 2 + W * 0.3, s * 0.4, W * 1.1);
  g.fillStyle = '#3a2b20'; g.fillRect(x + s * 0.15, y + s * 0.6, s * 0.7, s * 0.4); opText('OP' + k, x + s * 0.5, y + s * 0.9, s * 0.26, '#efe3d3');
  const lx = x - s * 0.18, ly = y + s * 0.4;
  g.fillStyle = '#3a2b20'; g.fillRect(lx, ly, 3, s * 1.8);
  opGlow(lx + 1, ly, s * 1.6, '255,179,71', 0.35);
  g.fillStyle = '#ffd98a'; g.beginPath(); g.arc(lx + 1, ly, s * 0.1, 0, 7); g.fill();
}

const partIds = () => ({ head: part('head').id, arms: part('arms').id, body: part('body').id, legs: part('legs').id });

// ---------- The cave ----------
let lastDrawX = 0, lastDrawY = 0;
function render(dt) {
  const s = CELL, W = Math.round(s * 0.32);
  const [tx, ty] = cameraTarget(), k = Math.min(1, dt * 8);
  camX += (tx - camX) * k; camY += (ty - camY) * k;
  const shake = P.shake > 0 ? (Math.random() - 0.5) * (P.shake > 0.15 ? 6 : 2.5) : 0;   // small shakes (hard rock) are gentler
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
  for (let r = rTop; r >= rBot; r--) for (let c = c0; c <= c1; c++) { const t = at(c, r); if (isFloor(t) || t === 'chasm' || t === 'tree' || t === 'pedestal' || t === 'boulder' || t === 'board') drawFloor(c, r, X(c), Y(r + 1), s); }
  // Pass 2: walls, buildings and the walker, top of screen to bottom.
  // The walker is drawn with the row its feet stand in, so only walls in front of it overlap it.
  const walkerRow = Math.floor(P.y - HB + 0.01);
  for (let r = rTop; r >= rBot; r--) {
    const y = Y(r + 1); // top edge of this row's cells
    for (let c = c0; c <= c1; c++) {
      const t = at(c, r);
      if (isFloor(t) || t === 'chasm' || t === 'found' || t === 'post') continue;
      const w = wobble.get(idx(c, r)) || (t === 'boulder' && moveT.get(idx(c, r)) > 0 && !rolling.has(idx(c, r)));
      drawWall(t, c, r, X(c) + (w ? Math.sin(time * 60) * s * 0.06 : 0), y, s, W);
      if (c === BELT && blocked.has(r)) { // conveyor path still to dig
        g.setLineDash([4, 4]); g.strokeStyle = 'rgba(217,129,59,.6)'; g.lineWidth = 1.5;
        g.strokeRect(X(c) + 3, y - W + 3, s - 6, s - 6); g.setLineDash([]);
      }
    }
    // the block(s) you're digging get a thin outline
    P.digging.forEach(d => { if (d.r === r) { g.strokeStyle = d.cone ? 'rgba(239,227,211,.25)' : 'rgba(239,227,211,.55)'; g.lineWidth = 1.5; g.strokeRect(X(d.c) + 1.5, y - W + 1.5, s - 3, s - 3); } });
    if (inShop()) {
      if (r === C.SHOP.pipRow) { drawPip(X(C.SHOP.door) + s * 0.5, Y(r + 1), s, W); drawShopDecor(X, Y, s); }
    } else if (inTown()) {
      if (r === C.TOWN.shop.rows[0]) { TOWN().shop === 'garage' ? drawGarageOutside(X, Y, s, W) : drawBurrowOutside(X, Y, s, W); }
      if (r === C.TOWN.gateRow) drawGates(X, Y, s, W);
      if (r === C.TOWN.station.railRow) { drawTrain(X, Y, s, W); drawTripMech(X, Y, s); }
    } else {
      if (r === C.BASE_BUILDING.rows[1]) drawCaveCrawler(X, Y, s, W);   // the big crawler (the entrance outpost)
      if (r === BASE_ROWS - 1) drawCaveSign(X, Y, s);
    }
    for (let k2 = 1; k2 <= outpostCount(); k2++) if (r === outpostRow(k2) - 1) drawHalfwayCrawler(k2, X, Y, s, W);
    if (r === walkerRow && !walkerHidden()) {
      // The Canopy Walker: feet sit near the bottom of its block; it faces the way it last moved
      const view = P.dir === 'up' ? 'back' : P.dir === 'down' ? 'front' : 'side';
      // arms swing up over the shoulders while digging deeper into the cave
      const raiseTarget = view === 'back' && P.digging.length > 0 ? 1 : 0;
      P.armRaise = (P.armRaise || 0) + (raiseTarget - (P.armRaise || 0)) * Math.min(1, dt * 14);
      if (P.hitFlash > 0 && Math.sin(time * 60) > 0) g.globalAlpha = 0.5;
      drawWalker(g, X(P.x), Y(P.y) + s * 0.4, s * 1.15 / 64, view, P.face, time, ids, { moving, digging: P.digging.length > 0, raise: P.armRaise, weapon: { id: S.weapon, mk: weaponMk(S.weapon), k: (P.attackT || 0) / 0.25 } });
      g.globalAlpha = 1;
    }
  }

  if (!inTown()) { drawDrops(X, Y, s); drawFoes(X, Y, s, false); }
  particles.forEach(p => {
    g.globalAlpha = Math.max(0, Math.min(1, p.life * 2)); g.fillStyle = p.col;
    if (p.chunk) {   // a tumbling chunk with a little shadow under it
      const q = Math.max(3, s * p.size), px = X(p.x), py = Y(p.y) - W * 0.4;
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(px - q / 2, py + q * 0.3, q, q * 0.35);
      g.save(); g.translate(px, py - p.z * s * 0.35); g.rotate(p.rot); g.fillStyle = p.col; g.fillRect(-q / 2, -q / 2, q, q);
      g.fillStyle = 'rgba(255,240,220,.18)'; g.fillRect(-q / 2, -q / 2, q, q * 0.3); g.restore();
    } else { const q = Math.max(2, s * 0.07); g.fillRect(X(p.x) - q / 2, Y(p.y) - W - q / 2, q, q); }
  });
  g.globalAlpha = 1;

  // darkness inside the cave (everything above the yard), with light around the robot
  const caveEdge = inTown() ? -1 : Y(BASE_ROWS);
  if (caveEdge > 0) {
    const px = X(P.x), py = Y(P.y);
    g.save(); g.beginPath(); g.rect(0, 0, VW, Math.min(VH, caveEdge)); g.clip();
    // the dark is drawn on its own layer, with holes cut out for your light and any flares
    if (fogCv.width !== cv.width || fogCv.height !== cv.height) { fogCv.width = cv.width; fogCv.height = cv.height; }
    const f = fogCv.getContext('2d'), dpr = cv.width / VW;
    f.setTransform(dpr, 0, 0, dpr, 0, 0); f.globalCompositeOperation = 'source-over';
    f.clearRect(0, 0, VW, VH); f.fillStyle = 'rgba(8,5,3,.94)'; f.fillRect(0, 0, VW, VH);
    f.globalCompositeOperation = 'destination-out';
    const hole = (hx, hy, R) => {
      const gr = f.createRadialGradient(hx, hy, R * 0.5, hx, hy, R * 1.1);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      f.fillStyle = gr; f.fillRect(hx - R * 1.2, hy - R * 1.2, R * 2.4, R * 2.4);
    };
    hole(px, py, lightRadius() * s);
    flares.forEach(fl => hole(X(fl.x), Y(fl.y), C.TOOLS.flare.radius * s * Math.min(1, fl.t / 3)));
    crawlerLights(hole, X, Y, s);   // crawler headlights and lanterns light the dark
    g.drawImage(fogCv, 0, 0, VW, VH);
    flares.forEach(fl => { // the flare itself
      g.fillStyle = 'rgba(255,120,80,' + (0.6 + Math.sin(time * 20) * 0.3) + ')'; g.beginPath(); g.arc(X(fl.x), Y(fl.y), s * 0.12, 0, 7); g.fill();
    });
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
      if (t === 'botcache' && botCacheShown(c, r)) { // the bot-cache's antenna blinks through the dark
        g.strokeStyle = 'rgba(134,207,220,' + (0.35 + Math.sin(time * 6) * 0.25) + ')'; g.lineWidth = 1.5;
        g.beginPath(); g.arc(cx, cy, s * (0.42 + (time % 1) * 0.2), 0, 7); g.stroke();
      }
      if (t === 'cache' && SEEN[idx(c, r)] === 2) { // scanned caches ping through the dark
        g.strokeStyle = 'rgba(242,201,76,' + (0.35 + Math.sin(time * 4) * 0.2) + ')'; g.lineWidth = 1.5;
        g.beginPath(); g.arc(cx, cy, s * (0.42 + (time % 1.2) * 0.15), 0, 7); g.stroke();
      }
      if (t === 'magma' && !SEEN[idx(c, r)] && dist <= lightRadius() + 3) {   // rock near a hidden lava pocket glows
        g.fillStyle = 'rgba(255,110,40,' + (0.1 + Math.sin(time * 2.5 + c) * 0.06) + ')'; g.beginPath(); g.arc(cx, cy, s * 0.9, 0, 7); g.fill();
      }
      if (t === 'lava' || (t === 'chasm' && cave().lava)) {   // lava lights up the dark around it
        const gl = g.createRadialGradient(cx, cy + W, 0, cx, cy + W, s * 1.3);
        gl.addColorStop(0, 'rgba(255,120,40,.22)'); gl.addColorStop(1, 'rgba(255,120,40,0)');
        g.fillStyle = gl; g.fillRect(cx - s * 1.3, cy + W - s * 1.3, s * 2.6, s * 2.6);
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

  if (!inTown()) { drawFoes(X, Y, s, true); drawCombatFx(X, Y, s); }
  drawCrewWorld(X, Y, s, W);
  drawCrawlers(X, Y, s, W, 'over');
  // skill effects: scan pulse rings, the shield bubble and the drill-burst glow
  pulses.forEach(pl => {
    g.strokeStyle = 'rgba(134,207,220,' + (1 - pl.t) + ')'; g.lineWidth = 3;
    g.beginPath(); g.arc(X(pl.x), Y(pl.y), pl.t * 8 * s, 0, 7); g.stroke();
  });
  if (P.shield) {
    g.strokeStyle = 'rgba(134,207,220,' + (0.5 + Math.sin(time * 5) * 0.2) + ')'; g.lineWidth = 2;
    g.fillStyle = 'rgba(134,207,220,.08)'; g.beginPath(); g.arc(X(P.x), Y(P.y) - s * 0.1, s * 0.75, 0, 7); g.fill(); g.stroke();
  }
  if (P.burstT > 0) {
    g.fillStyle = 'rgba(242,201,76,' + (0.15 + Math.sin(time * 30) * 0.08) + ')'; g.beginPath(); g.arc(X(P.x), Y(P.y), s * 0.85, 0, 7); g.fill();
  }

  g.textAlign = 'center'; g.font = '600 ' + Math.max(11, Math.round(s * 0.28)) + 'px "IBM Plex Mono", monospace';
  floats.forEach(f => { g.globalAlpha = Math.min(1, f.life * 1.5); g.fillStyle = f.col; g.fillText(f.text, X(f.x), Y(f.y) - W); });
  g.globalAlpha = 1;
  if (!inTown()) { drawTutorial(X, Y, s, W); drawBossCard(); }
  if (tripStage() === 'travel') drawTravel();
}

// The cave's name, on a sign at the mouth of the cave
function drawCaveSign(X, Y, s) {
  const x = X(BELT - 3.5), y = Y(BASE_ROWS) + s * 0.12, w = s * 3, h = s * 0.62;
  g.fillStyle = '#3a2b20'; rr2(g, x, y, w, h, 3); g.fill();
  g.fillStyle = '#6a5038'; g.fillRect(x + w * 0.2, y + h, 3, s * 0.3); g.fillRect(x + w * 0.8 - 3, y + h, 3, s * 0.3);
  g.fillStyle = '#efe3d3'; g.textAlign = 'center'; g.font = '700 ' + Math.round(s * 0.24) + 'px "Pixelify Sans", monospace';
  g.fillText(caveLabel(S.cave).toUpperCase(), x + w / 2, y + h * 0.42);
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
  drawCaveMap(mg, MM, mcv);
}
// Draws the explored cave on any canvas, MM pixels per block (the minimap, and the pause menu's big map)
function drawCaveMap(mg, MM, mcv) {
  mg.clearRect(0, 0, mcv.width, mcv.height);
  const sg = dailySignal(), ping = sg && sg.dist < C.CREW.daily.ping;   // the bot-cache pings once you're close
  for (let r = 0; r < ROWS - 1; r++) for (let c = 0; c < COLS; c++) {
    const i = idx(c, r); if (!SEEN[i] && r >= BASE_ROWS && !(ping && T[i] === 'botcache')) continue;
    const t = T[i], y = (ROWS - 2 - r) * MM, x = c * MM;
    let col = '#4a3a2c';
    if (r < BASE_ROWS) col = isFloor(t) ? '#3c4a2c' : '#4b4038';
    else if (t === 'chasm') col = '#000';
    else if (t === 'bridge' || t === 'oldbridge') col = '#a77d48';
    else if (t === 'water') col = '#3d6f96';
    else if (isFloor(t)) col = '#9a7a58';
    else if (t === 'granite') col = '#8c8286';
    else if (t === 'obsidian') col = '#3a2d48';
    else if (t === 'relic') col = '#c9a2ff';
    else if (t === 'cache' && SEEN[i] === 2) col = '#f2c94c';
    else if (t === 'keycache') col = '#9fe3f0';
    else if (t === 'botcache' && (SEEN[i] === 2 || ping)) col = Math.sin(time * 4) > 0 ? '#9fe3f0' : '#4a7a70';
    else if (ORES.has(t)) col = C.BLOCKS[t].ore;
    mg.fillStyle = col; mg.fillRect(x, y, MM, MM);
  }
  mg.fillStyle = '#d9813b';
  for (let r = BASE_ROWS; r <= beltEnd(); r++) mg.fillRect(BELT * MM + 1, (ROWS - 2 - r) * MM, 1, MM);
  for (let k = 1; k <= outpostCount(); k++) mg.fillRect((BELT - 1) * MM, (ROWS - 2 - outpostRow(k)) * MM - 1, MM * 3, MM + 1);
  const pd = Math.max(4, MM * 1.4);
  if (MM > 3 || Math.sin(time * 8) > -0.4) { mg.fillStyle = '#9fe3f0'; mg.fillRect(P.x * MM - pd / 2, (ROWS - 1 - P.y) * MM - pd / 2, pd, pd); }
}

// (The nano-bot window, the job board, is drawn in crew.js)
