// Bolt & Burrow — combat: the weapon arm, enemies, bosses and the hull.
// The mech has two arms: the dig arm (player.js) and a weapon arm. Weapons fire the way you face (F / J),
// or toward a mouse click. They hurt enemies and chip at blocks (less than the dig arm does).
// Enemies live in the caves and reset each time you enter; bosses stay beaten.
'use strict';

// ---------- Hull (the mech's health) ----------
const hullMax = () => part('body').val.hull + coreVal('plating');
P.hull = 60; P.invuln = 0;
function repairHull(dt) { P.hull = Math.min(hullMax(), P.hull + C.HULL.repair * dt); }
// Something hit the mech. fromX/fromY: where the hit came from (a Gravity Bulwark halves hits from the front).
function hurtHull(dmg, fromX, fromY, what) {
  if (P.invuln > 0 || trip) return;
  if (P.shield) { P.shield = false; sfx('shield'); floatText(P.x, P.y + 0.8, 'Blocked', '#86cfdc'); P.invuln = C.HULL.invuln; return; }
  const W = weapon();
  if (W.guard && fromX != null) {
    const a = aimVec(), dx = fromX - P.x, dy = fromY - P.y, d = Math.hypot(dx, dy) || 1;
    if ((dx * a.x + dy * a.y) / d > 0.3) { dmg *= W.guard; floatText(P.x, P.y + 1, 'Guard', '#86cfdc'); }
  }
  dmg *= 1 - Math.min(0.3, coreVal('mitigate'));   // Flux upgrade: damage mitigation
  P.hull -= dmg; P.invuln = C.HULL.invuln; P.shake = Math.max(P.shake, 0.25); P.hitFlash = 0.25;
  sfx('hit'); floatText(P.x, P.y + 0.7, '-' + Math.round(dmg), '#e2705a');
  hintOnce('hull', 'Hull damage', 'Enemies damage your hull (the red bar). It repairs at any outpost. If it runs out, a drone recalls you.');
  if (P.hull <= 0) { P.hull = 0; recall('wrecked', what); }
}

// ---------- Weapons ----------
const weapon = () => C.WEAPONS[S.weapon] || C.WEAPONS.wrench;
const weaponMk = id => S.weapons[id] || 0;
const wDmg = id => C.WEAPONS[id].dmg * C.WEAPON_MK.dmg[Math.max(0, weaponMk(id) - 1)] * (1 + coreVal('weapon'));
const wCd = id => C.WEAPONS[id].cd * C.WEAPON_MK.cd[Math.max(0, weaponMk(id) - 1)];
let attackCd = 0, attackHeld = false, aimUntil = 0;
const aimV = { x: 0, y: 1 };
// Which way the weapon points: a recent mouse aim, otherwise the way the walker faces
function aimVec() {
  if (time < aimUntil) return aimV;
  return { up: { x: 0, y: 1 }, down: { x: 0, y: -1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[P.dir] || { x: 0, y: 1 };
}
function aimAt(wx, wy) {
  const dx = wx - P.x, dy = wy - P.y, d = Math.hypot(dx, dy);
  if (d < 0.1) return;
  aimV.x = dx / d; aimV.y = dy / d; aimUntil = time + 0.6;
  if (Math.abs(dx) > Math.abs(dy)) { P.dir = dx > 0 ? 'right' : 'left'; P.face = dx > 0 ? 1 : -1; } else P.dir = dy > 0 ? 'up' : 'down';
}
const swings = [];   // visual effects: { kind, x, y, ax, ay, t, life, range, arc }
const shots = [];    // projectiles: { x, y, vx, vy, dmg, foe (fired by an enemy), life }
function attack() {
  if (inTown() || trip || attackCd > 0) return;
  const id = S.weapon, W = weapon(), a = aimVec(), dmg = wDmg(id);
  attackCd = wCd(id); P.attackT = 0.25;
  if (W.kind === 'melee') {
    swings.push({ kind: 'arc', x: P.x, y: P.y, ax: a.x, ay: a.y, t: 0, life: 0.2, range: W.range, arc: W.arc });
    let hit = 0;
    for (const f of foes) {
      const dx = f.x - P.x, dy = f.y - P.y, d = Math.hypot(dx, dy);
      if (d > W.range + f.r) continue;
      const ang = Math.acos(Math.max(-1, Math.min(1, (dx * a.x + dy * a.y) / (d || 1))));
      if (d > f.r + 0.2 && ang > W.arc * Math.PI / 360) continue;
      hurtFoe(f, dmg, { armorBreak: W.armorBreak, knock: 0.6, from: P }); hit++;
    }
    // blocks in the arc: the one ahead, plus the two beside it for wide swings
    const c0 = Math.floor(P.x + a.x * 0.95), r0 = Math.floor(P.y + a.y * 0.95);
    weaponBlock(c0, r0, dmg * W.blockHit, W.tier);
    if (W.arc >= 120) { const px = Math.round(-a.y), py = Math.round(a.x); weaponBlock(c0 + px, r0 + py, dmg * W.blockHit * 0.5, W.tier); weaponBlock(c0 - px, r0 - py, dmg * W.blockHit * 0.5, W.tier); }
    sfx(hit ? 'hit2' : 'swing');
  } else if (W.kind === 'shot') {
    shots.push({ x: P.x + a.x * 0.5, y: P.y + a.y * 0.5, vx: a.x * W.speed, vy: a.y * W.speed, dmg, life: W.range / W.speed, blockHit: W.blockHit, tier: W.tier });
    sfx('shoot');
  } else if (W.kind === 'pull') {
    // pull everything nearby to a point in front of you, then stun it
    const px = P.x + a.x * 1.4, py = P.y + a.y * 1.4;
    for (const f of foes) {
      if (Math.hypot(f.x - P.x, f.y - P.y) > W.range + f.r) continue;
      const k = f.boss ? 0.15 : 0.65;
      moveFoe(f, (px - f.x) * k, (py - f.y) * k);
      hurtFoe(f, dmg, { stun: W.stun * C.WEAPON_MK.cd[0], from: P });
    }
    swings.push({ kind: 'pull', x: px, y: py, t: 0, life: 0.35, range: W.range });
    sfx('pull');
  } else if (W.kind === 'pulse') {
    const mk = weaponMk(id);
    for (const f of foes) if (Math.hypot(f.x - P.x, f.y - P.y) <= W.range + f.r) hurtFoe(f, dmg, { stun: W.stun * (1 + 0.25 * (mk - 1)) * (f.boss ? 0.4 : 1), mark: W.mark, from: P });
    swings.push({ kind: 'ring', x: P.x, y: P.y, t: 0, life: 0.4, range: W.range });
    sfx('pulse');
  }
  hintOnce('attack', W.name, 'Your weapon arm fires the way you face. Weapons also chip at blocks, but the dig arm is much better at it.');
}
// A weapon chipping at a block (respects hardness like the dig arm)
function weaponBlock(c, r, amount, tier) {
  if (amount <= 0 || !inBounds(c, r)) return;
  const t = T[idx(c, r)];
  if (!t || isFloor(t) || C.BLOCKS[t].hp === Infinity) return;
  if ((C.BLOCKS[t].needs || 0) > tier) { if (Math.random() < 0.3) floatText(c + 0.5, r + 0.6, 'Too hard', '#e2705a'); return; }
  DMG[idx(c, r)] += amount; touchGas(c, r);
  burst(c + 0.5, r + 0.5, C.BLOCKS[t].color || C.BLOCKS[baseFor(c, r)].color, 3);
  if (DMG[idx(c, r)] >= C.BLOCKS[t].hp) breakBlock(c, r);
}
function buyWeapon(id) {
  const W = C.WEAPONS[id];
  if (shopSpot() !== 'stand-weapon' || weaponMk(id) || S.coins < W.cost) return;
  S.coins -= W.cost; S.weapons[id] = 1; S.weapon = id; sfx('buy');
  toast(W.name + ' fitted', W.text + ' Fire it with F or J (or click / tap ATTACK).'); save();
}
function equipWeapon(id) { if (shopSpot() !== 'stand-weapon' || !weaponMk(id)) return; S.weapon = id; sfx('click'); save(); }
const mkCost = id => C.WEAPON_MK.cost[weaponMk(id) - 1];
const mkAfford = id => { const c = mkCost(id); return c && S.coins >= c.coins && Object.entries(c).every(([k, n]) => k === 'coins' || owned(k) >= n); };
function upgradeWeapon(id) {
  if (shopSpot() !== 'stand-weapon' || weaponMk(id) < 1 || weaponMk(id) >= 3 || !mkAfford(id)) return;
  for (const [k, n] of Object.entries(mkCost(id))) { if (k === 'coins') S.coins -= n; else S.mats[k] -= n; }
  S.weapons[id]++; sfx('buy'); toast(null, C.WEAPONS[id].name + ' is now Mk ' + ['I', 'II', 'III'][S.weapons[id] - 1] + '.'); save();
}

// ---------- Enemies ----------
let foes = [];
// Can something of radius rad stand at (x, y)? Fliers can also cross chasms.
function foeFree(x, y, rad, fly) {
  for (let r = Math.floor(y - rad); r <= Math.floor(y + rad - 1e-4); r++)
    for (let c = Math.floor(x - rad); c <= Math.floor(x + rad - 1e-4); c++) {
      const t = at(c, r);
      if (r < BASE_ROWS + 2) return false;   // enemies stay out of the entrance hall
      if (!(isFloor(t) || (fly && t === 'chasm'))) return false;
    }
  return true;
}
function moveFoe(f, dx, dy) {
  const fly = C.FOES[f.type].fly;
  if (foeFree(f.x + dx, f.y, f.r, fly)) f.x += dx;
  if (foeFree(f.x, f.y + dy, f.r, fly)) f.y += dy;
}
function lineOfSight(x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 0.3);
  for (let k = 1; k < n; k++) { const t = at(Math.floor(x0 + (x1 - x0) * k / n), Math.floor(y0 + (y1 - y0) * k / n)); if (!isFloor(t) && t !== 'chasm') return false; }
  return true;
}
function makeFoe(type, x, y) {
  const F = C.FOES[type];
  return { type, x, y, hp: F.hp, max: F.hp, r: F.r, cd: 1 + Math.random(), stun: 0, mark: 0, flash: 0, wander: Math.random() * 6, wx: 0, wy: 0, state: 'idle', st: 0, boss: !!F.boss, sx: x, sy: y };
}
// Fill the cave with its enemies (called each time you enter). Bosses only until they're beaten.
function spawnFoes() {
  foes = []; shots.length = 0;
  if (inTown()) return;
  const cv = cave(), cs = CS(), open = [];
  for (let r = BASE_ROWS + 6; r < C.RELIC.row - 2; r++) for (let c = 1; c < COLS - 1; c++)
    if (T[idx(c, r)] === null && !onBelt(c, r) && !outpostAt(c, r)) open.push([c, r]);
  for (const [type, n] of Object.entries(cv.foes || {})) {
    const F = C.FOES[type];
    for (let k = 0; k < n && open.length; k++) {
      const [c, r] = open.splice(Math.floor(Math.random() * open.length), 1)[0];
      for (let g2 = 0; g2 < (F.group || 1); g2++) foes.push(makeFoe(type, c + 0.5 + (Math.random() - 0.5) * 0.3, r + 0.5 + (Math.random() - 0.5) * 0.3));
    }
  }
  if (cv.miniBoss && !cs.bossDone) { const H = C.BOSS_HALL; foes.push(makeFoe(cv.miniBoss, (H.cols[0] + H.cols[1] + 1) / 2, (H.rows[0] + H.rows[1] + 1) / 2)); }
  if (cv.boss && !cs.bossDone && S.relicHeld !== S.cave + 1) { const A = C.BOSS_ARENA; foes.push(makeFoe(cv.boss, (A.cols[0] + A.cols[1] + 1) / 2, (A.rows[0] + A.rows[1] + 1) / 2 + 1)); }
}
function hurtFoe(f, dmg, o = {}) {
  const F = C.FOES[f.type];
  if (f.mark > 0) dmg *= 1.5;
  if (F.armor && !o.armorBreak && f.mark <= 0 && f.stun <= 0) { dmg *= 1 - F.armor; if (Math.random() < 0.4) floatText(f.x, f.y + 0.9, 'Armoured', '#a8a39c'); }
  f.hp -= dmg; f.flash = 0.15;
  if (o.stun) f.stun = Math.max(f.stun, o.stun);
  if (o.mark) f.mark = Math.max(f.mark, o.mark);
  if (o.knock && o.from && !f.boss) { const dx = f.x - o.from.x, dy = f.y - o.from.y, d = Math.hypot(dx, dy) || 1; moveFoe(f, dx / d * o.knock, dy / d * o.knock); }
  floatText(f.x, f.y + 0.6, Math.round(dmg * 10) / 10 + '', f.mark > 0 ? '#c9a2ff' : '#efe3d3');
  if (f.hp <= 0) killFoe(f);
}
function killFoe(f) {
  const F = C.FOES[f.type];
  f.dead = true;
  burst(f.x, f.y, F.color, f.boss ? 40 : 14); sfx(f.boss ? 'boom' : 'pop');
  const coins = Math.round(F.coins * cave().coinMult);
  S.coins += coins; floatText(f.x, f.y + 0.9, '+' + coins, '#f2c94c');
  if (F.flux) S.flux += F.flux;
  if (!f.boss && Math.random() < 0.2) dropOre(Object.keys(cave().ores)[0], f.x, f.y, 1);
  if (f.boss) {
    CS().bossDone = true; P.shake = 0.6;
    if (F.boss === 'big') {
      S.relicHeld = S.cave + 1;   // the boss carried the relic
      toast(F.name + ' defeated!', 'It dropped the ' + cave().relic.name + '. Carry it home to claim it. (+' + fmt(coins) + ' coins, +' + F.flux + ' Flux)');
    } else toast(F.name + ' defeated!', 'The way to the relic is clear. (+' + fmt(coins) + ' coins, +' + F.flux + ' Flux)');
    save();
  }
}

function updateCombat(dt) {
  attackCd = Math.max(0, attackCd - dt); P.attackT = Math.max(0, (P.attackT || 0) - dt);
  P.invuln = Math.max(0, P.invuln - dt); P.hitFlash = Math.max(0, (P.hitFlash || 0) - dt);
  if (attackHeld) attack();
  if (!inTown() && !station() && P.hull > 0) P.hull = Math.min(hullMax(), P.hull + coreVal('repair') * dt);   // Flux upgrade: field repair
  for (let k = swings.length - 1; k >= 0; k--) { swings[k].t += dt; if (swings[k].t > swings[k].life) swings.splice(k, 1); }
  if (inTown()) { foes = []; shots.length = 0; return; }
  // projectiles
  for (let k = shots.length - 1; k >= 0; k--) {
    const b = shots[k];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let gone = b.life <= 0;
    const c = Math.floor(b.x), r = Math.floor(b.y), t = at(c, r);
    if (!gone && !isFloor(t) && t !== 'chasm') { if (!b.foe) weaponBlock(c, r, b.dmg * b.blockHit, b.tier); burst(b.x, b.y, b.foe ? '#9fd18a' : '#c9c0b0', 4); gone = true; }
    if (!gone && b.foe && Math.hypot(b.x - P.x, b.y - P.y) < HB + 0.15) { hurtHull(b.dmg, b.x - b.vx, b.y - b.vy, 'acid'); gone = true; }
    if (!gone && !b.foe) for (const f of foes) if (!f.dead && Math.hypot(b.x - f.x, b.y - f.y) < f.r + 0.12) { hurtFoe(f, b.dmg, { from: { x: b.x - b.vx, y: b.y - b.vy } }); gone = true; break; }
    if (gone) shots.splice(k, 1);
  }
  // enemies (only the ones near you are awake)
  for (const f of foes) {
    if (f.dead || Math.abs(f.y - P.y) > 16) continue;
    updateFoe(f, dt);
  }
  foes = foes.filter(f => !f.dead);
}

function updateFoe(f, dt) {
  const F = C.FOES[f.type];
  f.flash = Math.max(0, f.flash - dt); f.mark = Math.max(0, f.mark - dt); f.cd -= dt;
  if (f.stun > 0) { f.stun -= dt; return; }
  const dx = P.x - f.x, dy = P.y - f.y, d = Math.hypot(dx, dy) || 1;
  const sees = d < F.aggro && lineOfSight(f.x, f.y, P.x, P.y);
  const touching = d < f.r + HB + 0.08;
  if (sees) hintOnce(f.boss ? 'boss-' + f.type : 'foes', f.boss ? C.FOES[f.type].name : 'Enemies!', f.boss ? (C.FOES[f.type].boss === 'big' ? 'The Basalt Golem holds the Core Heart. Watch for its slam: back away when the red ring flashes.' : 'A guardian blocks the way to the relic. Beat it to clear the path.') : 'Press F or J to attack the way you face (or click to aim). Enemies damage your hull, which repairs at outposts.');
  if (touching && f.cd <= 0 && !trip) { hurtHull(F.dmg, f.x, f.y, F.name); f.cd = f.boss ? 1.2 : 1; if (f.type === 'bat') { f.state = 'retreat'; f.st = 0.9; } }
  let sp = F.speed;
  if (f.type === 'spitter') {
    if (sees && d < F.range && f.cd <= 0) {
      f.cd = F.fire;
      shots.push({ x: f.x, y: f.y, vx: dx / d * F.shot, vy: dy / d * F.shot, dmg: F.dmg, foe: true, life: F.range / F.shot + 0.3 });
      sfx('spit');
    }
    return;
  }
  if (f.type === 'warden') {   // charges in straight lines
    if (f.state === 'charge') { f.st -= dt; moveFoe(f, f.wx * 6 * dt, f.wy * 6 * dt); if (f.st <= 0) { f.state = 'idle'; f.cd2 = F.charge; } return; }
    f.cd2 = (f.cd2 == null ? F.charge : f.cd2) - dt;
    if (sees && f.cd2 <= 0) { f.state = 'charge'; f.st = 0.6; f.wx = dx / d; f.wy = dy / d; sfx('roll'); return; }
  }
  if (f.type === 'golem') {    // slams the ground: a warning ring, then a shockwave
    if (f.state === 'slam') {
      f.st -= dt;
      if (f.st <= 0) {
        f.state = 'idle'; f.cd2 = F.slam * (f.hp < f.max / 2 ? 0.7 : 1);
        swings.push({ kind: 'shock', x: f.x, y: f.y, t: 0, life: 0.4, range: F.slamRadius }); sfx('boom'); P.shake = 0.5;
        if (Math.hypot(P.x - f.x, P.y - f.y) < F.slamRadius) hurtHull(F.slamDmg, f.x, f.y, F.name);
      }
      return;
    }
    f.cd2 = (f.cd2 == null ? F.slam : f.cd2) - dt;
    if (sees && f.cd2 <= 0) { f.state = 'slam'; f.st = 0.9; sfx('crane'); return; }
    if (f.hp < f.max / 2) sp *= 1.5;
  }
  if (F.spawn) {   // bosses call for help
    f.cd3 = (f.cd3 == null ? F.every : f.cd3) - dt;
    const helpers = foes.filter(o => o.type === F.spawn && !o.dead && Math.hypot(o.x - f.x, o.y - f.y) < 8).length;
    if (sees && f.cd3 <= 0 && (f.type !== 'golem' || f.hp < f.max / 2) && helpers < 4) {
      f.cd3 = F.every;
      for (let k = 0; k < 2; k++) { const n = makeFoe(F.spawn, f.x + (k ? 0.8 : -0.8), f.y); if (foeFree(n.x, n.y, n.r, C.FOES[F.spawn].fly)) foes.push(n); }
      burst(f.x, f.y, F.color, 10);
    }
  }
  if (f.type === 'bat' && f.state === 'retreat') { f.st -= dt; moveFoe(f, -dx / d * sp * dt, -dy / d * sp * dt); if (f.st <= 0) f.state = 'idle'; return; }
  if (sees) { if (!touching) moveFoe(f, dx / d * sp * dt, dy / d * sp * dt); }
  else {   // wander near home
    f.wander -= dt;
    if (f.wander <= 0) { const a = Math.random() * 7; f.wx = Math.cos(a); f.wy = Math.sin(a); f.wander = 1.5 + Math.random() * 2; }
    const home = Math.hypot(f.x - f.sx, f.y - f.sy) > 3;
    const hx = home ? (f.sx - f.x) : f.wx, hy = home ? (f.sy - f.y) : f.wy, hd = Math.hypot(hx, hy) || 1;
    moveFoe(f, hx / hd * sp * 0.4 * dt, hy / hd * sp * 0.4 * dt);
  }
}
// The boss you're fighting (for the health bar), if one is close and awake
function activeBoss() { return foes.find(f => f.boss && !f.dead && Math.hypot(f.x - P.x, f.y - P.y) < 12) || null; }

// ---------- Drawing ----------
// Normal enemies are drawn under the darkness (you only see them in your light); bosses are drawn over it.
function drawFoes(X, Y, s, bosses) {
  for (const f of foes) {
    if (Math.abs(f.y - P.y) > 14 || f.boss !== !!bosses) continue;
    const F = C.FOES[f.type], x = X(f.x), y = Y(f.y), R = f.r * s;
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x, y + R * 0.6, R, R * 0.4, 0, 0, 7); g.fill();
    const bob = Math.sin(time * 6 + f.sx) * s * 0.03, col = f.flash > 0 ? '#ffffff' : F.color;
    g.save(); g.translate(x, y - R * 0.2 + bob);
    if (f.type === 'grub' || f.type === 'grubmother') {
      for (let k = 2; k >= 0; k--) { g.fillStyle = k ? shade(col, 0.85) : col; g.beginPath(); g.arc(-k * R * 0.55 * Math.sign(f.wx || 1), k * R * 0.1, R * (1 - k * 0.18), 0, 7); g.fill(); }
      g.fillStyle = '#16110d'; g.fillRect(-R * 0.35, -R * 0.25, R * 0.18, R * 0.18); g.fillRect(R * 0.15, -R * 0.25, R * 0.18, R * 0.18);
      if (f.type === 'grubmother') { g.strokeStyle = '#8a3b2a'; g.lineWidth = 2; g.beginPath(); g.arc(0, R * 0.2, R * 0.4, 0.2, Math.PI - 0.2); g.stroke(); }
    } else if (f.type === 'bat') {
      const flap = Math.sin(time * 18 + f.sx) * R * 0.6;
      g.fillStyle = col; g.beginPath(); g.moveTo(0, 0); g.lineTo(-R * 1.6, -flap); g.lineTo(-R * 0.6, R * 0.3); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(0, 0); g.lineTo(R * 1.6, -flap); g.lineTo(R * 0.6, R * 0.3); g.closePath(); g.fill();
      g.beginPath(); g.arc(0, 0, R * 0.6, 0, 7); g.fill(); g.fillStyle = '#ffd98a'; g.fillRect(-R * 0.3, -R * 0.2, R * 0.15, R * 0.15); g.fillRect(R * 0.15, -R * 0.2, R * 0.15, R * 0.15);
    } else if (f.type === 'spitter') {
      g.fillStyle = shade(col, 0.7); for (let k = 0; k < 5; k++) { const a = k * 1.26; g.beginPath(); g.ellipse(Math.cos(a) * R * 0.7, Math.sin(a) * R * 0.5, R * 0.45, R * 0.25, a, 0, 7); g.fill(); }
      g.fillStyle = col; g.beginPath(); g.arc(0, 0, R * 0.65, 0, 7); g.fill();
      g.fillStyle = f.cd < 0.5 ? '#d9f27a' : '#2a3a1a'; g.beginPath(); g.arc(0, 0, R * 0.3, 0, 7); g.fill();
    } else if (f.type === 'crab' || f.type === 'warden') {
      g.strokeStyle = shade(col, 0.6); g.lineWidth = Math.max(2, R * 0.18);
      for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(sd * R * 0.5, R * (k * 0.3 - 0.2)); g.lineTo(sd * R * 1.2, R * (k * 0.35 - 0.1)); g.stroke(); }
      g.fillStyle = col; g.beginPath(); g.ellipse(0, 0, R, R * 0.75, 0, 0, 7); g.fill();
      g.fillStyle = shade(col, 1.25); g.beginPath(); g.ellipse(0, -R * 0.15, R * 0.7, R * 0.4, 0, 0, 7); g.fill();
      for (const sd of [-1, 1]) { g.fillStyle = col; g.beginPath(); g.arc(sd * R * 0.9, -R * 0.75, R * 0.35, 0, 7); g.fill(); }
      if (f.type === 'warden') { g.fillStyle = '#efffff'; for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(k * R * 0.35, -R * 0.4); g.lineTo(k * R * 0.35 + R * 0.12, -R * 0.95); g.lineTo(k * R * 0.35 + R * 0.24, -R * 0.4); g.fill(); } }
    } else if (f.type === 'mite') {
      g.fillStyle = col; g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill(); g.fillStyle = '#ffb347'; g.beginPath(); g.arc(0, -R * 0.2, R * 0.45, 0, 7); g.fill();
    } else if (f.type === 'golem') {
      g.fillStyle = shade(col, 0.8); g.fillRect(-R * 1.1, -R * 0.2, R * 0.5, R * 0.9); g.fillRect(R * 0.6, -R * 0.2, R * 0.5, R * 0.9);   // fists
      g.fillStyle = col; rr2(g, -R * 0.75, -R * 0.8, R * 1.5, R * 1.5, R * 0.3); g.fill();
      g.strokeStyle = 'rgba(255,140,60,' + (0.5 + Math.sin(time * 5) * 0.3) + ')'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(-R * 0.5, -R * 0.4); g.lineTo(-R * 0.1, 0); g.lineTo(R * 0.4, -R * 0.3); g.moveTo(-R * 0.3, R * 0.4); g.lineTo(R * 0.2, R * 0.2); g.stroke();
      g.fillStyle = '#ff8c3c'; g.fillRect(-R * 0.35, -R * 0.55, R * 0.2, R * 0.12); g.fillRect(R * 0.15, -R * 0.55, R * 0.2, R * 0.12);
      if (f.state === 'slam') { g.strokeStyle = 'rgba(226,112,90,' + (0.5 + Math.sin(time * 30) * 0.4) + ')'; g.lineWidth = 3; g.beginPath(); g.arc(0, R * 0.2, C.FOES.golem.slamRadius * s, 0, 7); g.stroke(); }
    }
    g.restore();
    if (f.stun > 0) { g.fillStyle = '#f2c94c'; for (let k = 0; k < 3; k++) { const a = time * 6 + k * 2.1; g.fillRect(x + Math.cos(a) * R - 2, y - R * 1.2 + Math.sin(a) * R * 0.3 - 2, 4, 4); } }
    if (f.mark > 0) { g.strokeStyle = 'rgba(201,162,255,.8)'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y - R * 0.2, R * 1.3, 0, 7); g.stroke(); }
    if (f.hp < f.max && !f.boss) { g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x - s * 0.35, y - R - s * 0.3, s * 0.7, 4); g.fillStyle = '#e2705a'; g.fillRect(x - s * 0.35, y - R - s * 0.3, s * 0.7 * Math.max(0, f.hp / f.max), 4); }
  }
}
function drawCombatFx(X, Y, s) {
  for (const b of shots) {
    g.fillStyle = b.foe ? '#b6f27a' : '#e8e0d0';
    g.beginPath(); g.arc(X(b.x), Y(b.y) - s * 0.2, b.foe ? s * 0.1 : s * 0.06, 0, 7); g.fill();
    if (b.foe) { g.fillStyle = 'rgba(182,242,122,.25)'; g.beginPath(); g.arc(X(b.x), Y(b.y) - s * 0.2, s * 0.22, 0, 7); g.fill(); }
  }
  for (const w of swings) {
    const k = w.t / w.life, x = X(w.x), y = Y(w.y) - s * 0.2;
    g.globalAlpha = 1 - k;
    if (w.kind === 'arc') {
      const a = Math.atan2(-w.ay, w.ax), half = w.arc * Math.PI / 360;
      g.strokeStyle = '#efe3d3'; g.lineWidth = Math.max(3, s * 0.12);
      g.beginPath(); g.arc(x, y, w.range * s * (0.7 + k * 0.3), a - half, a + half); g.stroke();
    } else if (w.kind === 'ring') {
      g.strokeStyle = '#f2c94c'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, w.range * s * k, 0, 7); g.stroke();
    } else if (w.kind === 'pull') {
      g.strokeStyle = '#86cfdc'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, w.range * s * (1 - k), 0, 7); g.stroke();
    } else if (w.kind === 'shock') {
      g.strokeStyle = '#ff8c3c'; g.lineWidth = 5; g.beginPath(); g.arc(x, y, w.range * s * k, 0, 7); g.stroke();
    }
    g.globalAlpha = 1;
  }
}
// The weapon on the walker's weapon arm (drawn over the walker), swinging when it attacks
function drawWeaponArm(x, y, s) {
  const a = aimVec(), sw = (P.attackT || 0) / 0.25, ang = Math.atan2(-a.y, a.x) + (weapon().kind === 'melee' ? (sw - 0.5) * 1.6 : 0);
  const len = s * (0.45 + (weapon().kind === 'shot' ? 0.1 : 0)), bx = x + Math.cos(ang) * s * 0.25, by = y - s * 0.35 + Math.sin(ang) * s * 0.15;
  const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len * 0.8;
  g.strokeStyle = '#4A5059'; g.lineWidth = Math.max(2, s * 0.08); g.beginPath(); g.moveTo(bx, by); g.lineTo(ex, ey); g.stroke();
  const id = S.weapon;
  if (id === 'hammer') { g.fillStyle = '#8E96A0'; g.save(); g.translate(ex, ey); g.rotate(ang); g.fillRect(-s * 0.08, -s * 0.15, s * 0.16, s * 0.3); g.restore(); }
  else if (id === 'wrench') { g.strokeStyle = '#a8a39c'; g.lineWidth = 2; g.beginPath(); g.arc(ex, ey, s * 0.08, 0, 7); g.stroke(); }
  else if (id === 'rivet') { g.fillStyle = '#5D646E'; g.beginPath(); g.arc(ex, ey, s * 0.07, 0, 7); g.fill(); if (P.attackT > 0.15) { g.fillStyle = '#ffd98a'; g.beginPath(); g.arc(ex + Math.cos(ang) * s * 0.1, ey + Math.sin(ang) * s * 0.1, s * 0.06, 0, 7); g.fill(); } }
  else if (id === 'bulwark') { g.fillStyle = 'rgba(134,207,220,.7)'; g.save(); g.translate(ex, ey); g.rotate(ang); g.fillRect(-s * 0.05, -s * 0.2, s * 0.1, s * 0.4); g.restore(); }
  else if (id === 'stun') { g.fillStyle = '#f2c94c'; g.beginPath(); g.arc(ex, ey, s * 0.07 + Math.sin(time * 10) * s * 0.02, 0, 7); g.fill(); }
}
