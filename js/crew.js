// Bolt & Burrow — the nano-bot crew (v0.14).
// Bots: Scout (joins after the tutorial, Scout job only), standard bots (from the Ember Idol, Core Heart and
// Foundry Heart) and unique bots with one fixed trait each (from the daily bot-cache). Four can be equipped;
// the rest wait in the dock in the Computer car. Each equipped bot has a job and rides its own coloured path
// on the job board (the nano-bot window). Every loop of its path is one "pulse" of work, boosted by every chip
// on the path. Flux and Refine are base jobs (they keep working while you're away); Repair, Scout, Haul and
// Guard are cave jobs (they work while you play, and you can see the bots doing them around your mech).
// Also here: chips (fusing, Overcharged), path presets, the daily bot-cache, the Bots tab in the pause menu,
// the "while you were away" report, crew contracts and the bots' chirps.
'use strict';

const CR = C.CREW;
const PATH_COLS = ['#86cfdc', '#ff8c3c', '#8fd18a', '#c9a2ff'];
const PATH_NAMES = ['Cyan', 'Orange', 'Green', 'Violet'];
const UNIQUES = Object.keys(C.BOTS).filter(t => C.BOTS[t].unique);
const JOB_IDS = Object.keys(C.JOBS);
const CHIP_IDS = Object.keys(C.CHIPS);
const MK = ['Mk I', 'Mk II', 'Overcharged'];

function freshCrew() {
  return { bots: [], paths: [[], [], [], []], sockets: Array(CR.sockets).fill(null), chips: {}, presets: [null, null, null],
    found: {}, pity: 0, daily: null, nextId: 1, pipDay: null, contract: null };
}
const crew = () => S.crew || (S.crew = freshCrew());
// Older saves: the bot count becomes that many standard bots
function initCrew() {
  const W = crew(), F = freshCrew();
  for (const k of Object.keys(F)) if (W[k] === undefined) W[k] = F[k];
  while (W.paths.length < CR.equipMax) W.paths.push([]);
  if (S.crewOld) { for (let k = 0; k < S.crewOld; k++) addBot('standard', true); delete S.crewOld; }
}
const crewCount = () => crew().bots.length;
const equipped = () => crew().bots.filter(b => b.slot >= 0).sort((a, b) => a.slot - b.slot);
const docked = () => crew().bots.filter(b => b.slot < 0);
const botBy = id => crew().bots.find(b => b.id === id);
const crewHas = type => equipped().some(b => b.type === type);
const crewOn = (type, job) => equipped().some(b => b.type === type && b.job === job);
const botName = b => b.name || C.BOTS[b.type].name;
const freeSlot = () => { for (let k = 0; k < CR.equipMax; k++) if (!crew().bots.some(b => b.slot === k)) return k; return -1; };

function addBot(type, quiet) {
  const W = crew(), B = C.BOTS[type];
  const n = W.bots.filter(b => b.type === 'standard').length + 1;
  const bot = { id: W.nextId++, type, name: type === 'standard' ? 'Nano-bot ' + n : '', job: B.only || B.best || 'flux', slot: freeSlot() };
  W.bots.push(bot); W.found[type] = true;
  if (!quiet) chirp(type);
  return bot;
}
function equipBot(id) {
  const b = botBy(id); if (!b) return;
  if (b.slot >= 0) { b.slot = -1; sfx('click'); }
  else { const k = freeSlot(); if (k < 0) return toast(null, 'All ' + CR.equipMax + ' slots are full. Dock a bot first.'); b.slot = k; chirp(b.type); }
  save();
}
function setJob(id, job) {
  const b = botBy(id); if (!b || !C.JOBS[job]) return;
  const only = C.BOTS[b.type].only;
  if (only && job !== only) return toast(null, botName(b) + ' can only do the ' + C.JOBS[only].name + ' job.');
  b.job = job; chirp(b.type); save();
}
function renameBot(id, name) {
  const b = botBy(id); if (!b || b.type !== 'standard') return;
  name = String(name || '').replace(/[<>&"]/g, '').trim().slice(0, 14);
  if (!name) return;
  b.name = name; sfx('click'); save();
}

// ---------- Chips ----------
const chipKey = (t, mk) => t + ':' + mk;
const parseChip = k => { const [t, mk] = k.split(':'); return { t, mk: +mk }; };
const chipLabel = k => { const { t, mk } = parseChip(k); return C.CHIPS[t].name + ' ' + MK[mk - 1]; };
function giveChip(t, mk = 1) { const k = chipKey(t, mk), W = crew(); W.chips[k] = (W.chips[k] || 0) + 1; return chipLabel(k); }
const randomChip = () => CHIP_IDS[Math.floor(Math.random() * CHIP_IDS.length)];
function chipText(k) {
  const { t, mk } = parseChip(k), Ch = C.CHIPS[t];
  const bonus = t === 'bus' ? '+' + pct(CR.busBonus[mk - 1]) + ' bot speed' : '+' + pct(CR.chipBonus[mk - 1]) + ' ' + C.JOBS[Ch.job].name + ' work';
  return bonus + (mk === 3 ? ', but ' + Ch.over.text : '');
}
function fuseChips(t) {
  const W = crew(), k = chipKey(t, 1);
  if (townSpot() !== 'computer' || (W.chips[k] || 0) < CR.fuse) return;
  W.chips[k] -= CR.fuse; giveChip(t, 2); sfx('relic');
  toast('Chips fused', CR.fuse + ' ' + C.CHIPS[t].name + ' Mk I chips became one Mk II.');
  save();
}
// The chips on a bot's path (each socket once), and what they add up to
const pathOf = b => (b.slot >= 0 ? crew().paths[b.slot] : []);
const pathChips = b => pathOf(b).map(i => crew().sockets[i]).filter(Boolean).map(parseChip);
function botSpeed(b) {
  let v = 1;
  for (const ch of pathChips(b)) {
    if (ch.t === 'bus') v += CR.busBonus[ch.mk - 1];
    if (ch.mk === 3 && C.CHIPS[ch.t].over.kind === 'slow') v -= C.CHIPS[ch.t].over.v;
  }
  return Math.max(0.3, v);
}
function botStrength(b) {
  let v = 1, weak = 0;
  for (const ch of pathChips(b)) {
    if (C.CHIPS[ch.t].job === b.job) v += CR.chipBonus[ch.mk - 1];
    if (ch.mk === 3 && C.CHIPS[ch.t].over.kind === 'weak') weak += C.CHIPS[ch.t].over.v;
  }
  return Math.max(0.2, v * (1 - weak));
}
const overs = (b, kind) => pathChips(b).filter(ch => ch.mk === 3 && C.CHIPS[ch.t].over.kind === kind).reduce((a, ch) => a + C.CHIPS[ch.t].over.v, 0);
function loopTime(b) {
  const n = pathOf(b).length;
  if (!n) return CR.idleLoop;
  return Math.max(CR.minLoop, Math.max(CR.pathFloor, CR.loopBase + CR.loopPerSocket * n) / botSpeed(b));
}
// Flux a minute from one bot, for the panels
const fluxPerMin = b => (b.job === 'flux' ? CR.fluxPerLoop * botStrength(b) * 60 / loopTime(b) : 0);
const crewFluxPerMin = () => equipped().reduce((a, b) => a + fluxPerMin(b), 0);
const offlineCap = () => CR.offlineCapHours + (crewHas('tick') ? 4 : 0);

// ---------- Running the crew ----------
const botRun = {};   // per bot (not saved): loop progress, and the DVD bounce for bots with no path
function runOf(b) {
  if (!botRun[b.id]) botRun[b.id] = { ph: Math.random(), x: 0.2 + Math.random() * 0.6, y: 0.3 + Math.random() * 0.4, vx: (Math.random() < 0.5 ? -1 : 1) * 0.11, vy: (Math.random() < 0.5 ? -1 : 1) * 0.08, hue: 0 };
  return botRun[b.id];
}
const crewFx = [];   // effects in the cave: zaps, heals, scout rings, haul beams
const boxFx = [];    // "+2 Flux" pops in the nano-bot window
const MARKS = new Map();   // cell → 'hazard' (Scout) or 'pocket' (Dowser), drawn as little warnings
const caveWork = () => !inTown() && !paused() && !trip && !crawling();
let dowseT = 0;
function updateBots(dt) {
  const eq = equipped();
  for (const b of eq) {
    const r = runOf(b);
    if (!pathOf(b).length) {   // the DVD-logo bounce
      r.x += r.vx * dt; r.y += r.vy * dt;
      if (r.x < 0.06 || r.x > 0.94) { r.vx *= -1; r.x = Math.max(0.06, Math.min(0.94, r.x)); r.hue++; }
      if (r.y < 0.2 || r.y > 0.9) { r.vy *= -1; r.y = Math.max(0.2, Math.min(0.9, r.y)); r.hue++; }
    }
    r.ph += dt / loopTime(b);
    if (r.ph >= 1) { r.ph -= 1; loopDone(b); }
  }
  // traits that work all the time
  if (caveWork()) {
    if (crewOn('magpie', 'haul')) haulDrops(haulRange(eq.find(b => b.type === 'magpie')), true);
    dowseT -= dt;
    if (dowseT <= 0) { dowseT = 0.5; if (crewHas('dowser')) markAround(5, ['aquifer', 'magma'], 'pocket'); }
  }
  for (let k = crewFx.length - 1; k >= 0; k--) { crewFx[k].t += dt; if (crewFx[k].t > crewFx[k].life) crewFx.splice(k, 1); }
  for (let k = boxFx.length - 1; k >= 0; k--) { boxFx[k].t += dt; if (boxFx[k].t > 1) boxFx.splice(k, 1); }
}
// Where an equipped bot is drawn in the cave: circling your mech
function botWorldPos(b) {
  const eq = equipped().filter(x => !C.JOBS[x.job].base), k = eq.indexOf(b), n = Math.max(1, eq.length);
  const a = time * 0.9 + k * Math.PI * 2 / n;
  return { x: P.x + Math.cos(a) * 0.95, y: P.y + 0.25 + Math.sin(a) * 0.55 };
}
function loopDone(b) {
  const J = C.JOBS[b.job], str = botStrength(b), idle = !pathOf(b).length;
  const s1 = idle ? 1 : str;
  if (!J.base && !caveWork()) return;   // cave jobs rest in town
  contractEvent('loops');
  if (!paused() && !$('botBox').classList.contains('mini')) chirp(b.type, true);   // a quiet chirp each loop
  if (b.job === 'flux') {
    const amt = CR.fluxPerLoop * s1; S.flux += amt;
    boxFx.push({ id: b.id, text: '+' + (Math.round(amt * 10) / 10) + ' Flux', t: 0 });
  } else if (b.job === 'refine') {
    const made = refineLoop(b, s1);
    if (made) boxFx.push({ id: b.id, text: '+' + made + ' ' + C.MATERIALS[lastRefined].name.toLowerCase(), t: 0 });
  } else {
    const bat = overs(b, 'battery'); if (bat) P.battery = Math.max(1, P.battery - bat);
    const p = botWorldPos(b);
    if (b.job === 'repair') {
      if (P.hull < hullMax() - 0.05) {
        const heal = CR.repairPerLoop * s1 * (b.type === 'patch' ? 1.6 : 1);
        P.hull = Math.min(hullMax(), P.hull + heal); contractEvent('heals');
        floatText(P.x, P.y + 1, '+' + Math.round(heal) + ' hull', '#8fd18a');
        crewFx.push({ kind: 'heal', x: p.x, y: p.y, t: 0, life: 0.6 });
      }
    } else if (b.job === 'scout') {
      const rad = CR.scoutRadius + 1.5 * (s1 - 1) + (b.type === 'scout' ? 2 : 0);
      revealAround(P.x, P.y, rad, true);
      if (b.type === 'scout') markAround(rad, ['gas', 'vent', 'loose'], 'hazard');
      crewFx.push({ kind: 'ring', x: P.x, y: P.y, t: 0, life: 0.8, range: rad });
    } else if (b.job === 'haul') {
      const n = haulDrops(haulRange(b, s1));
      if (n) crewFx.push({ kind: 'ring', x: P.x, y: P.y, t: 0, life: 0.5, range: haulRange(b, s1), col: '159,179,232' });
    } else if (b.job === 'guard') guardZap(b, s1, p);
  }
}
let lastRefined = 'wire';
const bestRecipe = () => MAT_LIST.slice().reverse().find(id => canAfford(C.MATERIALS[id].needs));
// Refine: a batch of stored ore becomes the best material you can afford (Forge Accelerators add a chance of more)
function refineLoop(b, str) {
  const cost = overs(b, 'flux');
  if (cost) { if (S.flux < cost) return 0; S.flux -= cost; }
  let batches = CR.refinePerLoop * Math.floor(str) + (Math.random() < str % 1 ? 1 : 0), made = 0;
  while (batches-- > 0) {
    const id = bestRecipe(); if (!id) break;
    for (const [k, n] of Object.entries(C.MATERIALS[id].needs)) S.storage[k] -= n;
    const out = 1 + (b.type === 'smelt' && Math.random() < 0.35 ? 1 : 0);
    S.mats[id] += out; made += out; lastRefined = id; contractEvent('refine', out); contractEvent('botrefine', out);
  }
  return made;
}
const haulRange = (b, str) => CR.haulRadius + 1.5 * ((str || botStrength(b)) - 1);
function haulDrops(R, quiet) {
  let n = 0;
  for (const d of drops) if (d.t > 0.2 && Math.hypot(d.x - P.x, d.y - P.y) < R && cargoCount() + n < cargoMax()) {
    if (!quiet) crewFx.push({ kind: 'beam', x: d.x, y: d.y, x2: P.x, y2: P.y, t: 0, life: 0.35, col: '#9fb3e8' });
    d.x = P.x; d.y = P.y; d.vx = d.vy = 0; d.t = 1; n++;
  }
  return n;
}
function guardZap(b, str, p) {
  const live = foes.filter(f => !f.dead && f.hp > 0);
  const near = (x, y, R, not) => live.filter(f => f !== not && Math.hypot(f.x - x, f.y - y) < R && lineOfSight(x, y, f.x, f.y)).sort((a, c) => Math.hypot(a.x - x, a.y - y) - Math.hypot(c.x - x, c.y - y))[0];
  const f = near(P.x, P.y, CR.guardRange);
  if (!f) return;
  const dmg = CR.guardDmg * str * (1 + CR.guardTier * Math.max(0, S.cave));
  crewFx.push({ kind: 'zap', x: p.x, y: p.y, x2: f.x, y2: f.y, t: 0, life: 0.3 });
  sfx('shoot'); hurtFoe(f, dmg); contractEvent('zaps');
  if (b.type === 'sparky') {   // the chain
    const f2 = near(f.x, f.y, 3, f);
    if (f2) { crewFx.push({ kind: 'zap', x: f.x, y: f.y, x2: f2.x, y2: f2.y, t: 0, life: 0.3 }); hurtFoe(f2, dmg * 0.6); }
  }
}
function markAround(R, types, kind) {
  for (let r = Math.max(0, Math.floor(P.y - R)); r <= Math.min(ROWS - 1, Math.ceil(P.y + R)); r++)
    for (let c = Math.max(0, Math.floor(P.x - R)); c <= Math.min(COLS - 1, Math.ceil(P.x + R)); c++)
      if (types.includes(T[idx(c, r)]) && Math.hypot(c + 0.5 - P.x, r + 0.5 - P.y) <= R) MARKS.set(idx(c, r), kind);
}
const clearMarks = () => MARKS.clear();
// Patch: half the battery a cave-in cost you comes back
function crewAfterCaveIn() {
  if (!crewHas('patch')) return;
  P.battery = Math.min(batteryMax(), P.battery + batteryMax() * C.ROCK.batteryLoss / 2);
  floatText(P.x, P.y + 1.2, 'Patch: +battery', '#e2705a'); chirp('patch');
}

// ---------- While you were away ----------
// Base jobs keep looping while the game is closed (up to the offline cap). Returns lines for the report.
function crewAway(sec) {
  const lines = [], t = Math.min(sec, offlineCap() * 3600);
  if (t < 30) return lines;
  for (const b of equipped()) {
    const J = C.JOBS[b.job], loops = Math.floor(t / loopTime(b)), str = pathOf(b).length ? botStrength(b) : 1;
    if (!J.base) { lines.push([b, 'Rested (' + J.name + ' is a cave job).']); continue; }
    if (b.job === 'flux') { const amt = Math.floor(loops * CR.fluxPerLoop * str); S.flux += amt; lines.push([b, 'Made ' + fmt(amt) + ' Flux in ' + fmt(loops) + ' loops.']); }
    else {
      const got = {}; let n = 0;
      for (let k = 0; k < loops; k++) { const before = { ...S.mats }; const m = refineLoop(b, str); if (!m) break; n += m; for (const id of MAT_LIST) if (S.mats[id] > before[id]) got[id] = (got[id] || 0) + S.mats[id] - before[id]; }
      lines.push([b, n ? 'Refined ' + Object.entries(got).map(([id, c]) => c + ' ' + C.MATERIALS[id].name.toLowerCase()).join(', ') + '.' : 'Nothing to refine: storage had no ore for a recipe.']);
    }
  }
  return lines;
}
let awayReport = null;   // { hours, lines, forge }
PANEL.away = () => {
  const R = awayReport;
  let h = `<p class="note">You were away for <b>${R.hours}</b>. Base jobs (Flux and Refine) keep working for up to ${offlineCap()} h${crewHas('tick') ? ' (Tick adds 4)' : ''}.</p><div class="rows one">`;
  for (const [b, text] of R.lines) h += `<div class="row"><div class="botrow">${botPic(b.type, 40)}<div><small>${C.JOBS[b.job].name} · ${PATH_NAMES[b.slot]} path</small><strong>${botName(b)}</strong><span>${text}</span></div></div></div>`;
  if (R.forge) h += row('Forge car', 'Finished ' + R.forge + ' job' + (R.forge > 1 ? 's' : ''), 'Collect them from the Storage car.');
  return ['While you were away', fmt(S.flux) + ' Flux', h + '</div>'];
};
PANEL_NAME.away = () => 'report';

// ---------- The daily bot-cache ----------
function rollDaily() {
  const W = crew(), day = todayKey();
  if (!W.bots.length || (W.daily && W.daily.day === day)) return;
  const open = C.CAVES.map((c, k) => k).filter(k => caveOpen(k) && (caveTown(k) === 0 || lineIsOpen()));
  const rnd = seeded(day + '/botcache/' + (S.created || 'bolt'));
  W.daily = { day, cave: open[Math.floor(rnd() * open.length)] || 0, c: null, r: null, found: false };
}
const dailyHere = () => { const d = crew().daily; return d && !d.found && d.day === todayKey() && d.cave === S.cave ? d : null; };
// Called when a cave loads: old caches from other days crumble back into rock; today's is hidden in plain rock
function placeDailyCache() {
  if (inTown()) return;
  rollDaily();
  const d = dailyHere();
  for (let i = 0; i < T.length; i++) if (T[i] === 'botcache' && !(d && d.c != null && i === idx(d.c, d.r))) T[i] = baseFor(i % COLS, Math.floor(i / COLS));
  if (!d || d.c != null) return;
  for (let tries = 0; tries < 400; tries++) {
    const r = randInt(12, C.RELIC.row - 6), c = randInt(2, COLS - 3);
    if (Math.abs(c - BELT) < 3 || T[idx(c, r)] !== baseFor(c, r)) continue;
    T[idx(c, r)] = 'botcache'; d.c = c; d.r = r; return;
  }
}
// How strong the signal is from where you stand (null when today's cache isn't in this cave)
function dailySignal() {
  const d = dailyHere(); if (!d || d.c == null) return null;
  const dist = Math.hypot(d.c + 0.5 - P.x, d.r + 0.5 - P.y), D = CR.daily;
  return { dist, level: dist > D.faint ? 1 : dist > D.strong ? 2 : 3 };
}
const SIGNAL = ['', 'faint', 'stronger', 'strong'];
function signalTip() {
  const sg = dailySignal(); if (!sg) return null;
  const bars = '<span class="sig">' + [1, 2, 3].map(k => `<i class="${k <= sg.level ? 'on' : ''}"></i>`).join('') + '</span>';
  return tt('Bot-cache signal') + bars + ' ' + SIGNAL[sg.level] + (sg.level === 3 ? ' · it shows up on your minimap. Dig it out!' : sg.level === 2 ? ' · getting closer' : ' · somewhere in this cave');
}
let reward = null;   // what the last bot-cache held, for its pop-up
function openBotCache(c, r) {
  const W = crew(), D = CR.daily, d = W.daily;
  if (d) d.found = true;
  const coins = Math.round((D.coins[0] + Math.random() * (D.coins[1] - D.coins[0])) * cave().valueMult * (crewHas('lucky') ? 1.5 : 1));
  S.coins += coins; S.flux += D.flux;
  const over = Math.random() < D.overcharged, chip = giveChip(randomChip(), over ? 3 : 1);
  W.pity++;
  let bot = null, dup = null;
  if (Math.random() < D.uniqueChance || W.pity >= D.pity) {
    W.pity = 0;
    const type = UNIQUES[Math.floor(Math.random() * UNIQUES.length)];
    if (W.found[type] && W.bots.some(b => b.type === type)) dup = { type, chip: giveChip(randomChip(), 3) };
    else bot = addBot(type);
  }
  contractEvent('botcache');
  burst(c + 0.5, r + 0.5, '#86cfdc', 30); sfx('relic');
  reward = { coins, flux: D.flux, chip, bot, dup };
  setTimeout(() => openPopup('reward'), 250);
  save();
}
PANEL.reward = () => {
  const R = reward;
  let h = '<div class="reward">';
  if (R.bot) h += `<div class="newbot">${botPic(R.bot.type, 96)}<div><small>New unique bot!</small><strong>${C.BOTS[R.bot.type].name}</strong><span>${C.BOTS[R.bot.type].trait}</span><em>${R.bot.slot >= 0 ? 'Equipped on the ' + PATH_NAMES[R.bot.slot].toLowerCase() + ' path.' : 'Waiting in the dock in the Computer car.'}</em></div></div>`;
  if (R.dup) h += `<p class="note">${C.BOTS[R.dup.type].name} again! You already have one, so its core became an <b>${R.dup.chip}</b> chip.</p>`;
  h += '<div class="rows one">' + row('Coins', '+' + fmt(R.coins), crewHas('lucky') ? 'Lucky found extra.' : '') + row('Flux', '+' + R.flux) + row('Chip', R.chip, 'Place it on the job board in the Computer car.') + '</div>';
  if (!R.bot && !R.dup) h += `<p class="note">No unique bot this time. ${CR.daily.pity - crew().pity} more cache${CR.daily.pity - crew().pity > 1 ? 's' : ''} at most until one turns up. A new cache is hidden tomorrow.</p>`;
  return ['Bot-cache opened!', 'Daily', h + '</div>'];
};
PANEL_NAME.reward = () => 'reward';

// ---------- Other chip sources ----------
function bossChip() { const name = giveChip(randomChip(), 1); setTimeout(() => toast('Chip found', 'The boss dropped a ' + name + ' chip.'), 2500); }
function cacheChip() { if (caveTown(S.cave) === 1 && crewCount() && Math.random() < CR.rustOvercharged) { const n = giveChip(randomChip(), 3); floatText(P.x, P.y + 1.2, n, '#e2503c'); return n; } return null; }
const pipChipType = () => CHIP_IDS[Math.floor(seeded(todayKey() + '/pip')() * CHIP_IDS.length)];
function buyPipChip() {
  const W = crew();
  if (shopSpot() !== 'counter' || W.pipDay === todayKey() || S.flux < CR.pipChip) return;
  S.flux -= CR.pipChip; W.pipDay = todayKey(); giveChip(pipChipType(), 1); sfx('buy');
  toast(null, 'Pip: "A ' + C.CHIPS[pipChipType()].name + ', fresh off the bench. Pop it in your job board!"'); save();
}
function pipChipRow() {
  if (!crewCount()) return '';
  const k = chipKey(pipChipType(), 1), sold = crew().pipDay === todayKey();
  return `<small class="sub">Chip of the day</small><div class="rows one"><div class="row"><div class="botrow">${chipPic(k, 36)}<div><small>${sold ? 'Sold out · a new one tomorrow' : CR.pipChip + ' Flux'}</small><strong>${chipLabel(k)}</strong><span>${chipText(k)}</span></div></div>
    <button type="button" data-act="pipchip" ${sold || S.flux < CR.pipChip ? 'disabled' : ''}>${sold ? 'Sold' : 'Buy · ' + CR.pipChip + ' Flux'}</button></div></div>`;
}
{ const base = PANEL.counter; PANEL.counter = () => { const [a, b, h] = base(); return [a, b, h.replace('<small class="sub">Sell from storage</small>', pipChipRow() + '<small class="sub">Sell from storage</small>')]; }; }

// ---------- Crew contracts: one a day on the contracts board, paying a chip too ----------
function rollCrewContract() {
  const W = crew(), day = todayKey();
  if (!W.bots.length || (W.contract && W.contract.day === day)) return;
  const tier = contractTier(), rnd = seeded(day + '/crew/' + (S.created || 'bolt'));
  const pool = C.CONTRACTS.crew.filter(d => !d.needs || W.bots.some(b => !C.BOTS[b.type].only));   // Scout alone can't zap or repair
  const d = pool[Math.floor(rnd() * pool.length)];
  W.contract = { day, id: d.id, n: d.n[tier], have: 0, claimed: false, tier, chip: CHIP_IDS[Math.floor(rnd() * CHIP_IDS.length)] };
}
const crewCtDef = () => C.CONTRACTS.crew.find(d => d.id === crew().contract.id);
function crewContractEvent(kind, amount) {
  const ct = crew().contract;
  if (!ct || ct.day !== todayKey() || ct.claimed || ct.have >= ct.n || ct.id !== kind) return;
  ct.have = Math.min(ct.n, ct.have + amount);
  if (ct.have >= ct.n) { sfx('ding'); toast('Crew contract done', crewCtDef().text(ct.n) + '. Claim it at the board in town.'); }
}
function claimCrewContract() {
  const ct = crew().contract;
  if (townSpot() !== 'board' || !ct || ct.claimed || ct.have < ct.n) return;
  const d = crewCtDef(), coins = Math.round(d.coins * Math.pow(C.CONTRACTS.tierMult, ct.tier));
  ct.claimed = true; S.coins += coins; S.flux += d.flux; const chip = giveChip(ct.chip, 1); sfx('buy');
  toast(null, 'Crew contract claimed: +' + fmt(coins) + ' coins, +' + d.flux + ' Flux and a ' + chip + ' chip.'); save();
}
{
  const base = contractEvent;
  contractEvent = function (kind, amount = 1, extra) { base(kind, amount, extra); crewContractEvent(kind, amount); };
  const board = PANEL.board;
  PANEL.board = () => {
    const [a, b, h] = board();
    rollCrewContract(); rollDaily();
    const W = crew(); if (!W.bots.length) return [a, b, h];
    const ct = W.contract, d = crewCtDef(), coins = Math.round(d.coins * Math.pow(C.CONTRACTS.tierMult, ct.tier)), ready = !ct.claimed && ct.have >= ct.n;
    const btn = ct.claimed ? '<button type="button" disabled>Claimed</button>' : `<button type="button" data-act="crewclaim" ${ready ? '' : 'disabled'}>${ready ? 'Claim' : ct.have + '/' + ct.n}</button>`;
    let x = `<small class="sub">Crew contract</small><div class="rows one"><div class="row${ready ? ' here' : ''}"><div><small>${fmt(coins)} coins + ${d.flux} Flux + ${chipLabel(chipKey(ct.chip, 1))}</small><strong>${d.text(ct.n)}</strong><div class="pbar"><i style="width:${Math.round(ct.have / ct.n * 100)}%"></i></div></div>${btn}</div>`;
    const dl = W.daily;
    x += row('Daily bot-cache', dl.found ? 'Found today. A new one is hidden tomorrow.' : 'Hidden somewhere in ' + caveLabel(dl.cave) + ', ' + C.CAVES[dl.cave].name, dl.found ? '' : 'Follow its signal in the tip line. ' + Math.round(CR.daily.uniqueChance * 100) + '% chance of a unique bot · ' + (CR.daily.pity - W.pity) + ' cache' + (CR.daily.pity - W.pity === 1 ? '' : 's') + ' at most until one.') + '</div>';
    return [a, b, h + x];
  };
}

// ---------- Chirps: every bot has its own little two-note call ----------
function chirp(type, quiet) {
  if (muted || !actx || actx.state !== 'running') return;
  const [a, b] = C.BOTS[type].chirp || [1100, 1500], v = quiet ? 0.015 : 0.05;
  try { tone(a, 0.07, type === 'smelt' ? 'sawtooth' : 'square', v, b); tone(b, 0.07, 'triangle', v, a, 0.08); if (type === 'tick') tone(1200, 0.03, 'square', v, 1200, 0.2); } catch (e) {}
}

// ---------- Drawing the bots and chips (any 2D context) ----------
const TAU = Math.PI * 2, BOUT = '#17130F';
function circ(c, x, y, r, fill, stroke, lw = 2) { c.beginPath(); c.arc(x, y, r, 0, TAU); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); } }
function rrect(c, x, y, w, h, r, fill, stroke, lw = 2) { rr2(c, x, y, w, h, r); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); } }
function pline(c, pts, col, lw = 2) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let k = 2; k < pts.length; k += 2) c.lineTo(pts[k], pts[k + 1]); c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); }
function eye(c, x, y, r, col = '#86cfdc', look = 0) { circ(c, x, y, r, '#16110d'); circ(c, x + look * r * 0.25, y, r * 0.5, col); circ(c, x + look * r * 0.25 - r * 0.15, y - r * 0.18, r * 0.15, '#ffffff'); }
// A bot at (x, y), body radius R. Line widths scale with R so the little ones in the cave stay crisp.
function drawBot(c, type, x, y, R, t = time) {
  const L = Math.max(0.6, R / 14);   // line width scale
  c.save(); c.translate(x, y); c.lineJoin = 'round';
  c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(0, R * 1.45, R * 0.9, R * 0.22, 0, 0, TAU); c.fill();
  if (type === 'standard') {
    circ(c, 0, 0, R * 1.6, 'rgba(134,207,220,.12)');
    circ(c, 0, 0, R, '#c9d3d6', BOUT, 2 * L);
    c.beginPath(); c.arc(0, 0, R * 0.75, Math.PI * 0.15, Math.PI * 0.85); c.strokeStyle = '#d9813b'; c.lineWidth = R * 0.14; c.stroke();
    eye(c, 0, -R * 0.1, R * 0.42, '#86cfdc', Math.sin(t * 0.8));
  } else if (type === 'scout') {
    c.strokeStyle = 'rgba(200,210,215,.8)'; c.lineWidth = 3 * L; c.beginPath(); c.ellipse(0, -R * 1.05, R * 1.55, R * 0.32, 0, 0, TAU); c.stroke();
    const a = t * 30; pline(c, [Math.cos(a) * R * 1.4, -R * 1.05 + Math.sin(a) * R * 0.25, -Math.cos(a) * R * 1.4, -R * 1.05 - Math.sin(a) * R * 0.25], 'rgba(255,255,255,.6)', 2 * L);
    pline(c, [0, -R, 0, -R * 1.05], '#5D646E', 3 * L);
    circ(c, 0, 0, R, '#c9d3d6', BOUT, 2 * L);
    rrect(c, -R, R * 0.2, R * 2, R * 0.28, 2 * L, '#d9813b', null);
    eye(c, 0, -R * 0.1, R * 0.45, '#86cfdc', Math.sin(t * 0.7));
    pline(c, [R * 0.5, -R * 0.75, R * 0.8, -R * 1.5], '#5D646E', 2 * L); circ(c, R * 0.8, -R * 1.55, R * 0.13, Math.sin(t * 6) > 0 ? '#f2c94c' : '#7a6a30', BOUT, 1.5 * L);
  } else if (type === 'sparky') {
    for (let k = 0; k < 8; k++) { const a = k * TAU / 8 + 0.2; c.beginPath(); c.moveTo(Math.cos(a) * R * 0.8, Math.sin(a) * R * 0.8); c.lineTo(Math.cos(a + 0.2) * R * 1.35, Math.sin(a + 0.2) * R * 1.35); c.lineTo(Math.cos(a + 0.4) * R * 0.8, Math.sin(a + 0.4) * R * 0.8); c.fillStyle = '#c99a2a'; c.fill(); c.strokeStyle = BOUT; c.lineWidth = 1.5 * L; c.stroke(); }
    circ(c, 0, 0, R, '#f2c94c', BOUT, 2 * L);
    pline(c, [0, -R, 0, -R * 1.7], '#5D646E', 3 * L); for (let k = 0; k < 3; k++) rrect(c, -R * 0.25, -R * (1.2 + k * 0.17), R * 0.5, R * 0.08, 1, '#d9813b', null);
    circ(c, 0, -R * 1.78, R * 0.18, '#fff6c0', BOUT, 1.5 * L);
    if (Math.sin(t * 9) > -0.3) { pline(c, [-R * 0.3, -R * 1.85, -R * 0.55, -R * 2.1, -R * 0.35, -R * 2.2, -R * 0.65, -R * 2.5], '#fff2a0', 2 * L); pline(c, [R * 0.3, -R * 1.85, R * 0.6, -R * 2.05, R * 0.4, -R * 2.2, R * 0.7, -R * 2.45], '#fff2a0', 2 * L); }
    eye(c, 0, -R * 0.05, R * 0.42, '#fff2a0');
  } else if (type === 'patch') {
    rrect(c, -R, -R * 0.85, R * 2, R * 1.7, R * 0.55, '#efe3d3', BOUT, 2 * L);
    rrect(c, -R * 0.18, -R * 0.65, R * 0.36, R * 0.7, 2 * L, '#e2705a', null); rrect(c, -R * 0.45, -R * 0.48, R * 0.9, R * 0.36, 2 * L, '#e2705a', null);
    eye(c, 0, R * 0.35, R * 0.32);
    pline(c, [R * 0.95, R * 0.2, R * 1.45, -R * 0.2], '#8E96A0', 4 * L); circ(c, R * 1.5, -R * 0.28, R * 0.16, null, '#8E96A0', 3 * L);
    rrect(c, -R * 1.25, -R * 0.1, R * 0.4, R * 0.7, 2 * L, '#f2d27a', BOUT, 1.5 * L);
  } else if (type === 'smelt') {
    rrect(c, -R * 1.1, -R * 0.6, R * 2.2, R * 1.6, R * 0.4, '#5a4a3e', BOUT, 2 * L);
    rrect(c, -R * 0.65, -R * 0.15, R * 1.3, R * 0.85, R * 0.2, '#16110d', null);
    const heat = 0.7 + Math.sin(t * 6) * 0.2; rrect(c, -R * 0.55, -R * 0.05, R * 1.1, R * 0.65, R * 0.15, 'rgba(255,140,60,' + heat + ')', null);
    for (let k = 0; k < 4; k++) rrect(c, -R * 0.48 + k * R * 0.28, -R * 0.1, R * 0.07, R * 0.75, 1, '#ffd98a', null);
    rrect(c, R * 0.45, -R * 1.25, R * 0.35, R * 0.7, 2 * L, '#3B3F46', BOUT, 1.5 * L);
    for (let k = 0; k < 3; k++) { const ph = (t * 0.6 + k / 3) % 1; circ(c, R * 0.62 + ph * R * 0.4, -R * (1.4 + ph * 1.1), R * (0.15 + ph * 0.2), 'rgba(140,130,120,' + (0.5 * (1 - ph)) + ')'); }
    eye(c, -R * 0.3, -R * 0.35, R * 0.25, '#ffb347');
    circ(c, -R * 0.7, R * 1.05, R * 0.2, '#3B3F46', BOUT, 1.5 * L); circ(c, R * 0.7, R * 1.05, R * 0.2, '#3B3F46', BOUT, 1.5 * L);
  } else if (type === 'magpie') {
    const flap = Math.sin(t * 8) * R * 0.25;
    c.fillStyle = '#2B2A2E'; c.strokeStyle = BOUT; c.lineWidth = 2 * L;
    c.beginPath(); c.moveTo(-R * 0.6, -R * 0.2); c.lineTo(-R * 2.0, -R * 0.75 - flap); c.lineTo(-R * 1.5, R * 0.1); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(R * 0.6, -R * 0.2); c.lineTo(R * 2.0, -R * 0.75 - flap); c.lineTo(R * 1.5, R * 0.1); c.closePath(); c.fill(); c.stroke();
    circ(c, 0, 0, R * 0.9, '#efe3d3', BOUT, 2 * L); c.beginPath(); c.arc(0, 0, R * 0.9, Math.PI, TAU); c.fillStyle = '#2B2A2E'; c.fill(); c.strokeStyle = BOUT; c.stroke();
    eye(c, R * 0.15, -R * 0.15, R * 0.3, '#9fb3e8', 1);
    c.beginPath(); c.arc(0, R * 1.15, R * 0.42, 0, Math.PI); c.strokeStyle = '#e2705a'; c.lineWidth = R * 0.22; c.stroke();
    rrect(c, -R * 0.53, R * 0.95, R * 0.22, R * 0.25, 1, '#c9d3d6', null); rrect(c, R * 0.31, R * 0.95, R * 0.22, R * 0.25, 1, '#c9d3d6', null);
  } else if (type === 'tick') {
    circ(c, 0, 0, R * 1.05, '#8fd18a', BOUT, 2 * L); circ(c, 0, 0, R * 0.82, '#efe3d3', BOUT, 1.5 * L);
    for (let k = 0; k < 12; k++) { const a = k * TAU / 12; pline(c, [Math.cos(a) * R * 0.66, Math.sin(a) * R * 0.66, Math.cos(a) * R * 0.76, Math.sin(a) * R * 0.76], '#3B3F46', (k % 3 ? 1.5 : 3) * L); }
    const ha = Math.floor(t) * TAU / 12 - Math.PI / 2; pline(c, [0, 0, Math.cos(ha) * R * 0.55, Math.sin(ha) * R * 0.55], '#3B3F46', 3 * L); pline(c, [0, 0, R * 0.4, R * 0.15], '#3B3F46', 3 * L);
    circ(c, 0, 0, R * 0.22, '#16110d'); circ(c, 0, 0, R * 0.12, '#8fd18a');
    rrect(c, -R * 0.2, -R * 1.35, R * 0.4, R * 0.3, 2 * L, '#8fd18a', BOUT, 1.5 * L); circ(c, -R * 0.75, -R * 0.85, R * 0.22, '#8fd18a', BOUT, 1.5 * L); circ(c, R * 0.75, -R * 0.85, R * 0.22, '#8fd18a', BOUT, 1.5 * L);
    pline(c, [-R * 0.5, R * 1.0, -R * 0.6, R * 1.35], '#5D646E', 3 * L); pline(c, [R * 0.5, R * 1.0, R * 0.6, R * 1.35], '#5D646E', 3 * L);
  } else if (type === 'dowser') {
    c.beginPath(); c.moveTo(0, -R * 1.1); c.lineTo(R * 0.95, R * 0.6); c.lineTo(-R * 0.95, R * 0.6); c.closePath(); c.fillStyle = '#3d6f96'; c.fill(); c.strokeStyle = BOUT; c.lineWidth = 2 * L; c.stroke();
    c.beginPath(); c.moveTo(0, -R * 0.55); c.lineTo(R * 0.55, R * 0.45); c.lineTo(-R * 0.55, R * 0.45); c.closePath(); c.fillStyle = '#5aa9d6'; c.fill();
    eye(c, 0, R * 0.05, R * 0.3, '#9fe3f0');
    const tw = Math.sin(t * 7) * R * 0.08;
    pline(c, [0, -R * 1.1, -R * 0.55 - tw, -R * 1.9], '#c99a52', 3 * L); pline(c, [0, -R * 1.1, R * 0.55 + tw, -R * 1.9], '#c99a52', 3 * L);
    circ(c, -R * 0.55 - tw, -R * 1.95, R * 0.12, '#e2705a'); circ(c, R * 0.55 + tw, -R * 1.95, R * 0.12, '#5aa9d6');
    for (let k = 1; k <= 2; k++) { c.beginPath(); c.arc(0, -R * 1.9, R * 0.35 * k, Math.PI * 1.15, Math.PI * 1.85); c.strokeStyle = 'rgba(159,227,240,' + (0.6 - k * 0.2) + ')'; c.lineWidth = 2 * L; c.stroke(); }
  } else if (type === 'lucky') {
    c.save(); c.scale(0.55 + Math.abs(Math.cos(t * 2.5)) * 0.45, 1);
    circ(c, 0, 0, R * 1.05, '#f2c94c', BOUT, 2 * L); circ(c, 0, 0, R * 0.85, null, '#c99a2a', 2 * L);
    for (let k = 0; k < 16; k++) { const a = k * TAU / 16; pline(c, [Math.cos(a) * R * 0.92, Math.sin(a) * R * 0.92, Math.cos(a) * R * 1.0, Math.sin(a) * R * 1.0], '#c99a2a', 1.5 * L); }
    c.restore();
    eye(c, 0, -R * 0.05, R * 0.38, '#f2c94c');
    pline(c, [0, -R * 1.05, 0, -R * 1.5], '#5D646E', 2.5 * L);
    for (let k = 0; k < 4; k++) { const a = k * TAU / 4 + TAU / 8; circ(c, Math.cos(a) * R * 0.18, -R * 1.62 + Math.sin(a) * R * 0.18, R * 0.15, '#7fd17a', BOUT, L); }
  }
  c.restore();
}
// A chip seen from above: a dark package with pins, a coloured core, its icon and tier marks (S = size)
function drawChip(c, k, x, y, S) {
  const { t, mk } = parseChip(k), Ch = C.CHIPS[t], over = mk === 3, L = Math.max(0.6, S / 40);
  c.save(); c.translate(x, y);
  if (over) { const gr = c.createRadialGradient(0, 0, 0, 0, 0, S * 1.1); gr.addColorStop(0, 'rgba(226,80,60,' + (0.4 + Math.sin(time * 4) * 0.15) + ')'); gr.addColorStop(1, 'rgba(226,80,60,0)'); c.fillStyle = gr; c.fillRect(-S * 1.1, -S * 1.1, S * 2.2, S * 2.2); }
  c.fillStyle = '#8d9499'; const pw = Math.max(1, S * 0.06);
  for (let q = 0; q < 4; q++) { const o = -S * 0.36 + q * S * 0.24; c.fillRect(-S * 0.62, o - pw / 2, S * 0.14, pw); c.fillRect(S * 0.48, o - pw / 2, S * 0.14, pw); c.fillRect(o - pw / 2, -S * 0.62, pw, S * 0.14); c.fillRect(o - pw / 2, S * 0.48, pw, S * 0.14); }
  rrect(c, -S * 0.5, -S * 0.5, S, S, S * 0.08, over ? '#3a1d1a' : '#22262b', over ? '#e2503c' : BOUT, (over ? 2.5 : 1.5) * L);
  rrect(c, -S * 0.3, -S * 0.3, S * 0.6, S * 0.6, S * 0.06, Ch.col, null);
  c.fillStyle = '#16110d'; c.font = '700 ' + Math.max(6, Math.round(S * 0.36)) + 'px "Pixelify Sans", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(Ch.icon, 0, S * 0.02);
  if (over) { c.fillStyle = '#e2503c'; c.beginPath(); c.moveTo(S * 0.2, -S * 0.5); c.lineTo(S * 0.38, -S * 0.5); c.lineTo(S * 0.3, -S * 0.36); c.lineTo(S * 0.42, -S * 0.36); c.lineTo(S * 0.2, -S * 0.12); c.lineTo(S * 0.26, -S * 0.3); c.lineTo(S * 0.16, -S * 0.3); c.closePath(); c.fill(); }
  else for (let q = 0; q < mk; q++) circ(c, -S * 0.36 + q * S * 0.13, -S * 0.38, S * 0.045, '#efe3d3');
  c.textBaseline = 'alphabetic';
  c.restore();
}
// Little pictures for the panels (drawn once, then reused)
const picCache = new Map();
function picURL(key, w, h, fn) {
  if (picCache.has(key)) return picCache.get(key);
  const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2;
  const x = c.getContext('2d'); x.scale(2, 2); fn(x);
  const url = c.toDataURL(); picCache.set(key, url); return url;
}
function botPic(type, size, ghost) {
  const url = picURL('bot/' + type + '/' + size + (ghost ? '/g' : ''), size, size, x => {
    drawBot(x, type, size / 2, size * 0.56, size * 0.22, 0.4);
    if (ghost) { x.globalCompositeOperation = 'source-in'; x.fillStyle = '#3a3129'; x.fillRect(0, 0, size, size); }
  });
  return `<img class="botpic" src="${url}" width="${size}" height="${size}" alt="">`;
}
function chipPic(k, size) {
  const url = picURL('chip/' + k + '/' + size, size, size, x => drawChip(x, k, size / 2, size / 2, size * 0.62));
  return `<img class="chippic" src="${url}" width="${size}" height="${size}" alt="">`;
}

// ---------- The job board (nano-bot window, bottom right) ----------
// 8 sockets in two rows; each equipped bot rides its coloured path; a bot with no path does the DVD bounce.
const SOCK = k => [0.14 + (k % 4) * 0.24, 0.38 + Math.floor(k / 4) * 0.38];
const pathOff = slot => (slot - 1.5) * 3;
// Where on its path a bot is (0–1 of the way round), in board coordinates (0–1)
function riderPos(b) {
  const p = pathOf(b), r = runOf(b);
  if (!p.length) return { x: r.x, y: r.y };
  if (p.length === 1) { const [x, y] = SOCK(p[0]), a = r.ph * TAU; return { x: x + Math.cos(a) * 0.07, y: y + Math.sin(a) * 0.1 }; }
  const n = p.length, seg = r.ph * n, a = Math.floor(seg) % n, u = seg - Math.floor(seg);
  const [x1, y1] = SOCK(p[a]), [x2, y2] = SOCK(p[(a + 1) % n]);
  return { x: x1 + (x2 - x1) * u, y: y1 + (y2 - y1) * u };
}
function renderBots() {
  const cw = pcv.clientWidth, ch = pcv.clientHeight;
  if (cw && ch && (Math.abs(cw - PW) > 0.5 || Math.abs(ch - PH) > 0.5)) [PW, PH] = fit(pcv, pg);
  if (!cw || !ch) return;
  const w = PW, h = PH, W = crew(), cs = Math.max(12, Math.min(w * 0.13, h * 0.24));
  pg.fillStyle = '#0d1714'; pg.fillRect(0, 0, w, h);
  pg.fillStyle = '#16302a'; for (let x = 8; x < w; x += 16) for (let y = 8; y < h; y += 16) pg.fillRect(x, y, 1, 1);
  // coloured paths under the chips (offset a little so a shared socket shows both)
  W.paths.forEach((p, i) => {
    if (!p.length || !W.bots.some(b => b.slot === i)) return;
    const o = pathOff(i);
    pg.strokeStyle = PATH_COLS[i]; pg.globalAlpha = 0.8; pg.lineWidth = 2.5; pg.lineJoin = 'round';
    pg.beginPath(); p.forEach((sk, k) => { const [x, y] = SOCK(sk); k ? pg.lineTo(x * w + o, y * h + o) : pg.moveTo(x * w + o, y * h + o); });
    if (p.length > 2) pg.closePath();
    if (p.length === 1) { const [x, y] = SOCK(p[0]); pg.ellipse(x * w, y * h, w * 0.07, h * 0.1, 0, 0, TAU); }
    pg.stroke(); pg.globalAlpha = 1;
  });
  for (let k = 0; k < CR.sockets; k++) {
    const [x, y] = SOCK(k), sk = W.sockets[k];
    pg.strokeStyle = '#2c5246'; pg.lineWidth = 1; rr2(pg, x * w - cs * 0.62, y * h - cs * 0.62, cs * 1.24, cs * 1.24, 4); pg.stroke();
    if (sk) drawChip(pg, sk, x * w, y * h, cs);
  }
  for (const b of equipped()) {
    const p = riderPos(b), x = p.x * w + (pathOf(b).length ? pathOff(b.slot) : 0), y = p.y * h + (pathOf(b).length ? pathOff(b.slot) : 0);
    pg.globalAlpha = 0.25; circ(pg, x, y, cs * 0.55, PATH_COLS[b.slot]); pg.globalAlpha = 1;
    drawBot(pg, b.type, x, y - cs * 0.05, cs * 0.3);
    const fx = boxFx.find(f => f.id === b.id);
    if (fx) { pg.globalAlpha = 1 - fx.t; pg.fillStyle = PATH_COLS[b.slot]; pg.font = '600 10px "IBM Plex Mono", monospace'; pg.textAlign = 'center'; pg.fillText(fx.text, x, y - cs * 0.7 - fx.t * 14); pg.globalAlpha = 1; }
  }
  pg.textAlign = 'left'; pg.fillStyle = '#86cfdc'; pg.font = '500 13px "Pixelify Sans", monospace';
  pg.fillText('FLUX ' + fmt(S.flux), 8, 16);
  pg.textAlign = 'right'; pg.fillStyle = '#5f8f80'; pg.font = '400 10px "IBM Plex Mono", monospace';
  pg.fillText(fmt(crewFluxPerMin()) + '/min', w - 8, 15);
  if (!W.bots.length) {
    pg.fillStyle = 'rgba(11,8,6,.72)'; pg.fillRect(0, 0, w, h);
    pg.fillStyle = '#a8937c'; pg.textAlign = 'center'; pg.font = '500 15px "Pixelify Sans", monospace';
    pg.fillText('No nano-bots yet', w / 2, h / 2 - 4);
    pg.font = '400 10px "IBM Plex Mono", monospace';
    pg.fillText(S.tut === 'done' ? 'One is sealed in the Ember Idol, Cave 1' : 'Scout joins after the Cave 1 tutorial', w / 2, h / 2 + 12);
  }
}

// ---------- Bots in the cave: circling your mech, doing their jobs ----------
function drawCrewWorld(X, Y, s, W) {
  if (inTown() || crawling()) return;
  // Scout's and Dowser's marks on hidden hazards
  for (const [i, kind] of MARKS) {
    const t = T[i], c = i % COLS, r = Math.floor(i / COLS);
    if (!(kind === 'hazard' ? ['gas', 'vent', 'loose'] : ['aquifer', 'magma']).includes(t)) { MARKS.delete(i); continue; }
    const x = X(c) + s / 2, y = Y(r + 1) - W + s / 2;
    if (y < -s || y > VH + s) continue;
    const col = kind === 'pocket' ? (t === 'magma' ? '#ff8c3c' : '#5aa9d6') : '#f2c94c';
    g.strokeStyle = col; g.globalAlpha = 0.55 + Math.sin(time * 4 + i) * 0.25; g.lineWidth = 1.5;
    if (kind === 'pocket') { g.setLineDash([3, 3]); g.strokeRect(X(c) + 3, Y(r + 1) - W + 3, s - 6, s - 6); g.setLineDash([]); }
    else { g.beginPath(); g.moveTo(x, y - s * 0.22); g.lineTo(x + s * 0.2, y + s * 0.15); g.lineTo(x - s * 0.2, y + s * 0.15); g.closePath(); g.stroke(); g.fillStyle = col; g.fillRect(x - 1, y - s * 0.08, 2, s * 0.12); }
    g.globalAlpha = 1;
  }
  for (const f of crewFx) {
    const k = f.t / f.life;
    g.globalAlpha = Math.max(0, 1 - k);
    if (f.kind === 'zap') {
      g.strokeStyle = '#fff2a0'; g.lineWidth = 2; g.beginPath(); g.moveTo(X(f.x), Y(f.y) - s * 0.3);
      for (let q = 1; q < 5; q++) { const u = q / 5; g.lineTo(X(f.x + (f.x2 - f.x) * u) + (Math.random() - 0.5) * s * 0.3, Y(f.y + (f.y2 - f.y) * u) - s * 0.3 + (Math.random() - 0.5) * s * 0.3); }
      g.lineTo(X(f.x2), Y(f.y2) - s * 0.3); g.stroke();
    } else if (f.kind === 'beam') {
      g.strokeStyle = f.col; g.lineWidth = 1.5; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(X(f.x), Y(f.y) - s * 0.2); g.lineTo(X(f.x2), Y(f.y2) - s * 0.3); g.stroke(); g.setLineDash([]);
    } else if (f.kind === 'ring') {
      g.strokeStyle = 'rgba(' + (f.col || '159,227,240') + ',.7)'; g.lineWidth = 2; g.beginPath(); g.arc(X(f.x), Y(f.y) - s * 0.2, f.range * s * k, 0, TAU); g.stroke();
    } else if (f.kind === 'heal') {
      g.fillStyle = '#8fd18a'; for (let q = 0; q < 3; q++) { const px = X(P.x) + (q - 1) * s * 0.3, py = Y(P.y) - s * (0.6 + k * 0.8 + q * 0.1); g.fillRect(px - s * 0.06, py - s * 0.02, s * 0.12, s * 0.04); g.fillRect(px - s * 0.02, py - s * 0.06, s * 0.04, s * 0.12); }
    }
    g.globalAlpha = 1;
  }
  // cave-job bots fly with you (base-job bots stay on the train)
  for (const b of equipped()) {
    if (C.JOBS[b.job].base) continue;
    const p = botWorldPos(b), x = X(p.x), y = Y(p.y) - s * 0.75 + Math.sin(time * 4 + b.id) * s * 0.05;
    g.globalAlpha = 0.3; circ(g, x, y, s * 0.2, C.JOBS[b.job].col); g.globalAlpha = 1;
    drawBot(g, b.type, x, y, s * 0.15);
  }
}
// The daily bot-cache: a crate with a blinking antenna, hidden until you're close or a scan finds it
function drawBotCache(c, r, x, ty, s) {
  g.fillStyle = '#2b3440'; rr2(g, x + s * 0.18, ty + s * 0.3, s * 0.64, s * 0.46, s * 0.06); g.fill();
  g.strokeStyle = '#86cfdc'; g.lineWidth = Math.max(1.5, s * 0.04); rr2(g, x + s * 0.18, ty + s * 0.3, s * 0.64, s * 0.46, s * 0.06); g.stroke();
  g.fillStyle = '#86cfdc'; g.beginPath(); g.arc(x + s * 0.5, ty + s * 0.53, s * 0.1, 0, TAU); g.fill();
  g.fillStyle = '#16110d'; g.beginPath(); g.arc(x + s * 0.5, ty + s * 0.53, s * 0.05, 0, TAU); g.fill();
  g.strokeStyle = '#5D646E'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + s * 0.7, ty + s * 0.3); g.lineTo(x + s * 0.78, ty + s * 0.1); g.stroke();
  g.fillStyle = Math.sin(time * 6) > 0 ? '#9fe3f0' : '#2c5246'; g.beginPath(); g.arc(x + s * 0.78, ty + s * 0.1, s * 0.05, 0, TAU); g.fill();
}
const botCacheShown = (c, r) => SEEN[idx(c, r)] === 2 || Math.hypot(c + 0.5 - P.x, r + 0.5 - P.y) < 2.6;
// The Computer car's right window: docked bots idling inside (or your Flux when the dock is empty)
function drawDockWindow(x, y, w, h, s) {
  const d = docked();
  if (!d.length) return false;
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = 'rgba(134,207,220,.12)'; g.fillRect(x, y, w, h);
  d.slice(0, 4).forEach((b, k) => {
    const n = Math.min(4, d.length), bx = x + w * (k + 0.5) / n, by = y + h * 0.6 + Math.sin(time * 2 + k * 1.7) * h * 0.08;
    drawBot(g, b.type, bx, by, Math.min(h * 0.3, w / n * 0.36));
  });
  g.restore();
  return true;
}

// ---------- The Computer car: Crew, Job board and Upgrades tabs ----------
let compTab = 'crew', boardSel = null;   // boardSel: { path: slot } or { chip: key }
{
  const upgrades = PANEL.computer;
  PANEL.computer = () => {
    const live = townSpot() === 'computer';
    if (!crewCount() && compTab !== 'upgrades') compTab = 'upgrades';
    const tabs = '<div class="subtabs">' + [['crew', 'Crew · ' + crewCount()], ['board', 'Job board'], ['upgrades', 'Flux upgrades']].map(([id, l]) => `<button type="button" data-act="ctab" data-id="${id}" class="${compTab === id ? 'on' : ''}" ${id !== 'upgrades' && !crewCount() ? 'disabled' : ''}>${l}</button>`).join('') + '</div>';
    const body = compTab === 'crew' ? crewView(live) : compTab === 'board' ? boardView(live) : upgrades()[2];
    if (live && crewCount()) hintOnce('scout-board', 'Scout', 'Welcome to the job board! Each bot on your crew rides its own coloured path through the chip sockets. Draw a path through chips that match its job and it works harder; a longer loop is slower. A bot with no path just bounces around.');
    return ['Computer car', '<span data-live="flux"></span>', tabs + body];
  };
}
function crewView(live) {
  const W = crew(), eq = equipped();
  let h = `<p class="note">Up to ${CR.equipMax} bots work at once; the rest wait in the dock. <b>Flux</b> and <b>Refine</b> are base jobs (they work while you're away). <b>Repair</b>, <b>Scout</b>, <b>Haul</b> and <b>Guard</b> are cave jobs: those bots fly with you. ${eq.length}/${CR.equipMax} equipped · ${fmt(crewFluxPerMin())} Flux a minute.</p><div class="rows one">`;
  for (const b of eq.concat(docked())) {
    const B = C.BOTS[b.type], on = b.slot >= 0;
    const jobs = B.only ? `<span class="tag">${C.JOBS[B.only].name} only</span>` : '<div class="seg jobs">' + JOB_IDS.map(j => `<button type="button" data-act="job" data-id="${b.id}" data-x="${j}" class="${b.job === j ? 'on' : ''}" ${live ? '' : 'disabled'}>${C.JOBS[j].name}</button>`).join('') + '</div>';
    const stat = on ? PATH_NAMES[b.slot] + ' path · loop ' + loopTime(b).toFixed(1) + ' s' + (pathOf(b).length ? '' : ' (no path: bouncing)') + (b.job === 'flux' ? ' · ' + fmt(fluxPerMin(b)) + ' Flux/min' : '') : 'In the dock';
    h += `<div class="row${on ? ' here' : ''}"><div class="botrow">${botPic(b.type, 48)}<div><small>${B.unique ? 'Unique' : 'Standard'} · ${stat}</small><strong>${on ? `<i class="pdot" style="background:${PATH_COLS[b.slot]}"></i>` : ''}${botName(b)}</strong><span>${B.trait} ${C.JOBS[b.job].text}</span>${jobs}</div></div>
      <button type="button" data-act="equip" data-id="${b.id}" ${live && (on || freeSlot() >= 0) ? '' : 'disabled'}>${on ? 'Dock' : 'Equip'}</button></div>`;
  }
  return h + '</div>';
}
function boardView(live) {
  const W = crew(), eq = equipped();
  // the board: an SVG for the paths, a button for each socket
  let svg = '<svg class="jbpaths" viewBox="0 0 100 100" preserveAspectRatio="none">';
  W.paths.forEach((p, i) => {
    if (!p.length || !eq.some(b => b.slot === i)) return;
    const o = pathOff(i) * 0.5, pts = p.map(k => { const [x, y] = SOCK(k); return (x * 100 + o) + ',' + (y * 100 + o); }).join(' ');
    svg += p.length === 1 ? `<ellipse cx="${SOCK(p[0])[0] * 100}" cy="${SOCK(p[0])[1] * 100}" rx="7" ry="10" fill="none" stroke="${PATH_COLS[i]}" stroke-width="1.6" vector-effect="non-scaling-stroke" style="stroke-width:3px"/>`
      : `<polygon points="${pts}" fill="none" stroke="${PATH_COLS[i]}" stroke-linejoin="round" vector-effect="non-scaling-stroke" style="stroke-width:${boardSel && boardSel.path === i ? 5 : 3}px;opacity:.9"/>`;
  });
  svg += '</svg>';
  let socks = '';
  for (let k = 0; k < CR.sockets; k++) {
    const [x, y] = SOCK(k), sk = W.sockets[k], on = boardSel && boardSel.path != null && W.paths[boardSel.path].includes(k);
    const order = on ? W.paths[boardSel.path].indexOf(k) + 1 : '';
    socks += `<button type="button" class="sock${sk ? ' full' : ''}${on ? ' inpath' : ''}" style="left:${x * 100}%;top:${y * 100}%;${on ? '--pc:' + PATH_COLS[boardSel.path] : ''}" data-act="sock" data-id="${k}" ${live ? '' : 'disabled'} title="${sk ? chipLabel(sk) + ': ' + chipText(sk) : 'Empty socket'}">${sk ? chipPic(sk, 40) : ''}${order ? `<b>${order}</b>` : ''}</button>`;
  }
  let h = `<div class="jb">${svg}${socks}</div>`;
  // which path you're drawing
  const help = boardSel && boardSel.path != null ? `Tap sockets in order to draw the <b style="color:${PATH_COLS[boardSel.path]}">${PATH_NAMES[boardSel.path].toLowerCase()}</b> path. Tap its last socket again to undo. Hold the bot's button (or tap Clear) to clear it.`
    : boardSel && boardSel.chip ? 'Tap a socket to put the <b>' + chipLabel(boardSel.chip) + '</b> chip there.'
    : 'Pick a bot to draw its path, or a chip to place it. Tap a chip on the board to take it back.';
  h += `<p class="note">${help}</p><div class="pathbtns">`;
  for (const b of eq) {
    const sel = boardSel && boardSel.path === b.slot;
    h += `<button type="button" class="pathbtn${sel ? ' on' : ''}" style="--pc:${PATH_COLS[b.slot]}" data-act="pathsel" data-id="${b.slot}" ${live ? '' : 'disabled'}>${botPic(b.type, 28)}<span>${botName(b)}<small>${C.JOBS[b.job].name} · ${pathOf(b).length ? pathOf(b).length + ' sockets · ' + loopTime(b).toFixed(1) + ' s · ×' + botStrength(b).toFixed(2) : 'no path'}</small></span></button>`;
  }
  if (boardSel && boardSel.path != null) h += `<button type="button" data-act="pathclr" data-id="${boardSel.path}">Clear path</button>`;
  h += '</div>';
  // chips
  const inv = Object.entries(W.chips).filter(([, n]) => n > 0).sort();
  h += '<small class="sub">Chips · ' + inv.reduce((a, [, n]) => a + n, 0) + ' spare</small>';
  h += inv.length ? '<div class="rows one">' + inv.map(([k, n]) => {
    const { t, mk } = parseChip(k), sel = boardSel && boardSel.chip === k;
    return `<div class="row${sel ? ' here' : ''}"><div class="botrow">${chipPic(k, 36)}<div><small>×${n}${mk === 3 ? ' · Overcharged' : ''}</small><strong>${chipLabel(k)}</strong><span>${chipText(k)}</span></div></div>
      <div class="mod-btns"><button type="button" data-act="chipsel" data-id="${k}" ${live ? '' : 'disabled'}>${sel ? 'Picked' : 'Place'}</button>${mk === 1 ? `<button type="button" data-act="fuse" data-id="${t}" ${live && n >= CR.fuse ? '' : 'disabled'}>Fuse ${CR.fuse} → Mk II</button>` : ''}</div></div>`;
  }).join('') + '</div>' : '<p class="note">No spare chips. Chips come from the daily bot-cache, crew contracts, first boss kills and Pip\'s chip of the day.</p>';
  // presets
  h += '<small class="sub">Saved layouts</small><div class="rows one">' + W.presets.map((p, k) => `<div class="row"><div><small>Layout ${'ABC'[k]}</small><span>${p ? p.sockets.filter(Boolean).length + ' chips · ' + p.paths.filter(x => x.length).length + ' paths' : 'Empty'}</span></div><div class="mod-btns"><button type="button" data-act="psave" data-id="${k}" ${live ? '' : 'disabled'}>Save here</button><button type="button" data-act="pload" data-id="${k}" ${live && p ? '' : 'disabled'}>Load</button></div></div>`).join('') + '</div>';
  return h;
}
// Board actions
function tapSocket(k) {
  const W = crew();
  if (boardSel && boardSel.path != null) {
    const p = W.paths[boardSel.path], at_ = p.indexOf(k);
    if (at_ >= 0 && at_ === p.length - 1) p.pop();
    else if (at_ >= 0) p.splice(at_, 1);
    else if (p.length < CR.maxPath) p.push(k);
    runOf(equipped().find(b => b.slot === boardSel.path) || { id: -1 }).ph = 0;
    sfx('click');
  } else if (boardSel && boardSel.chip) {
    const key = boardSel.chip;
    if (!W.chips[key]) { boardSel = null; return; }
    if (W.sockets[k]) W.chips[W.sockets[k]] = (W.chips[W.sockets[k]] || 0) + 1;
    W.sockets[k] = key; W.chips[key]--; sfx('tool');
    if (!W.chips[key]) boardSel = null;
  } else if (W.sockets[k]) {
    W.chips[W.sockets[k]] = (W.chips[W.sockets[k]] || 0) + 1; W.sockets[k] = null; sfx('click');
  }
  save();
}
function savePreset(k) { const W = crew(); W.presets[k] = { sockets: W.sockets.slice(), paths: W.paths.map(p => p.slice()) }; sfx('buy'); toast(null, 'Layout ' + 'ABC'[k] + ' saved.'); save(); }
function loadPreset(k) {
  const W = crew(), p = W.presets[k]; if (!p) return;
  for (let q = 0; q < CR.sockets; q++) if (W.sockets[q]) { W.chips[W.sockets[q]] = (W.chips[W.sockets[q]] || 0) + 1; W.sockets[q] = null; }
  let missing = 0;
  p.sockets.forEach((key, q) => { if (!key) return; if (W.chips[key] > 0) { W.chips[key]--; W.sockets[q] = key; } else missing++; });
  W.paths = p.paths.map(x => x.slice());
  sfx('tool'); toast(null, 'Layout ' + 'ABC'[k] + ' loaded.' + (missing ? ' ' + missing + ' chip' + (missing > 1 ? 's' : '') + ' missing (fused or not owned any more).' : ''));
  save();
}
$('popBody').addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  const act = b.dataset.act, id = b.dataset.id;
  if (act === 'ctab') { compTab = id; boardSel = null; }
  else if (act === 'pipchip') buyPipChip();
  else if (act === 'crewclaim') claimCrewContract();
  else if (townSpot() !== 'computer') return;
  else if (act === 'equip') { equipBot(+id); boardSel = null; }
  else if (act === 'job') setJob(+id, b.dataset.x);
  else if (act === 'sock') tapSocket(+id);
  else if (act === 'pathsel') { if (longPressed) { longPressed = false; return; } boardSel = boardSel && boardSel.path === +id ? null : { path: +id }; sfx('click'); }
  else if (act === 'pathclr') { crew().paths[+id] = []; sfx('click'); save(); }
  else if (act === 'chipsel') { boardSel = boardSel && boardSel.chip === id ? null : { chip: id }; sfx('click'); }
  else if (act === 'fuse') fuseChips(id);
  else if (act === 'psave') savePreset(+id);
  else if (act === 'pload') loadPreset(+id);
  else return;
  updateUI();
});
// Hold a bot's path button to clear its path
let pressT = 0, longPressed = false;
$('popBody').addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-act="pathsel"]'); if (!b || b.disabled) return;
  clearTimeout(pressT); longPressed = false;
  pressT = setTimeout(() => { longPressed = true; crew().paths[+b.dataset.id] = []; boardSel = { path: +b.dataset.id }; sfx('pop'); save(); updateUI(); }, 600);
});
for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) $('popBody').addEventListener(ev, () => clearTimeout(pressT));

// ---------- The pause menu's Bots tab: the collection log and renaming ----------
function botsTab() {
  const W = crew();
  let h = '<small class="sub">Collection · ' + Object.keys(C.BOTS).filter(t => W.found[t]).length + '/' + Object.keys(C.BOTS).length + '</small><div class="botlog">';
  for (const t of Object.keys(C.BOTS)) {
    const B = C.BOTS[t], got = W.found[t];
    h += `<div class="botcard${got ? '' : ' unknown'}">${botPic(t, 64, !got)}<strong>${got ? B.name : '???'}</strong><span>${got ? B.trait : t === 'standard' ? 'From the Ember Idol, Core Heart and Foundry Heart.' : t === 'scout' ? 'Joins when you finish the Cave 1 tutorial, or from a bot-cache.' : 'Not found yet. Unique bots come from the daily bot-cache.'}</span>${got ? `<em>${B.move}</em>` : ''}</div>`;
  }
  h += '</div>';
  const std = W.bots.filter(b => b.type === 'standard');
  if (std.length) h += '<small class="sub">Name your standard bots</small><div class="rows one">' + std.map(b => `<div class="row"><div class="botrow">${botPic('standard', 36)}<div><small>${b.slot >= 0 ? PATH_NAMES[b.slot] + ' path · ' + C.JOBS[b.job].name : 'In the dock'}</small><input class="rename" id="rn${b.id}" maxlength="14" value="${botName(b)}" aria-label="Name"></div></div><button type="button" data-act="rename" data-id="${b.id}">Rename</button></div>`).join('') + '</div>';
  if (W.bots.length) {
    rollDaily();
    const d = W.daily;
    h += '<small class="sub">Daily bot-cache</small><div class="rows one">' + row(d.found ? 'Found today' : caveLabel(d.cave) + ' · ' + C.CAVES[d.cave].name, d.found ? 'A new cache is hidden tomorrow.' : 'Today\'s cache is hidden in this cave. Follow its signal in the tip line.',
      Math.round(CR.daily.uniqueChance * 100) + '% chance of a unique bot each cache · at most ' + (CR.daily.pity - W.pity) + ' more until one. A unique you already have becomes an Overcharged chip.') + '</div>';
  }
  return h;
}
TABS.bots = botsTab;
$('menuBody').addEventListener('click', e => {   // capture: read the name before the menu redraws
  const b = e.target.closest('[data-act="rename"]'); if (!b) return;
  renameBot(+b.dataset.id, ($('rn' + b.dataset.id) || {}).value);
}, true);
$('menuBody').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList.contains('rename')) { renameBot(+e.target.id.slice(2), e.target.value); renderMenu(); } });

initCrew();
