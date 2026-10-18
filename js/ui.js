// Bolt & Burrow — the HUD, the tip line, the key cues and the station pop-ups.
// Stand at a train car, a shop stand, Pip's counter or an outpost and press E (or tap the button):
// that place's panel opens as a pop-up over the game, and the game pauses until you close it.
// The pause menu (menu.js) has everything else.
'use strict';

const SLOTS = ['head', 'arms', 'body', 'legs'];
const ORE_NAMES = { copper: 'Copper', silver: 'Silver', gold: 'Gold', crystal: 'Crystal' };
const dot = col => `<i style="background:${col}"></i>`;
const itemColor = id => (C.MATERIALS[id] ? C.MATERIALS[id].color : C.BLOCKS[id].ore);
const needsText = needs => Object.entries(needs).map(([k, n]) => n + ' ' + itemName(k).toLowerCase()).join(' + ');
const haveText = needs => Object.entries(needs).map(([k, n]) => `<span class="${owned(k) >= n ? '' : 'short'}">${owned(k)}/${n} ${itemName(k).toLowerCase()}</span>`).join(' · ');

let selMod = null, dragging = false;

// Which pop-up this spot opens (null = nothing to open here)
function spotPanel() {
  if (inShop()) { const sp = shopSpot(); return sp ? (sp === 'counter' ? 'counter' : 'stand') : null; }
  if (onTownMap()) { const t = townSpot(); return t && t !== 'engine' ? t : null; }
  if (!inTown() && station()) return 'outpost';
  return null;
}
// The game pauses while a pop-up or the pause menu is open
let popup = null, menuOpen = false;
const paused = () => !!(popup || menuOpen);
function openPopup(k) {
  popup = k; held.length = 0; joyH = joyV = null; attackHeld = false;
  $('popup').hidden = false; panelHTML = ''; titleSig = ''; popSel = null; sfx('click');
  renderPanel();
  $('popup').querySelector('.sheet').focus({ preventScroll: true });
}
function closePopup() {
  if (!popup) return;
  popup = null; selMod = null; $('popup').hidden = true; sfx('click');
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  updateUI();
}
// Keyboard in pop-ups: W/S or the arrows pick a button, E (or Enter/Space) presses it; E with nothing picked closes
let popSel = null;   // { act, id, x, y } of the picked button, so it stays picked when the panel redraws
const popButtons = () => [...$('popBody').querySelectorAll('button:not([disabled])')];
const selKey = b => ({ act: b.dataset.act, id: b.dataset.id, x: b.dataset.x, y: b.dataset.y });
const sameSel = (b, k) => k && b.dataset.act === k.act && b.dataset.id === k.id && b.dataset.x === k.x && b.dataset.y === k.y;
let popIdx = -1;
function markSel() {
  const bs = popButtons();
  if (popSel) { const i = bs.findIndex(b => sameSel(b, popSel)); if (i >= 0) popIdx = i; else popIdx = Math.min(popIdx, bs.length - 1); }
  bs.forEach((b, i) => b.classList.toggle('kbsel', !!popSel && i === popIdx));
  if (popSel && bs[popIdx]) { popSel = selKey(bs[popIdx]); bs[popIdx].scrollIntoView({ block: 'nearest' }); }
}
function popupKey(e) {
  const nav = { ArrowDown: 1, KeyS: 1, ArrowRight: 1, KeyD: 1, ArrowUp: -1, KeyW: -1, ArrowLeft: -1, KeyA: -1 }[e.code];
  const bs = popButtons();
  if (nav) {
    if (bs.length) { popIdx = !popSel ? (nav > 0 ? 0 : bs.length - 1) : (popIdx + nav + bs.length) % bs.length; popSel = selKey(bs[popIdx]); markSel(); sfx('click'); }
    return true;
  }
  if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') {
    if (!e.repeat) { if (popSel && bs[popIdx]) bs[popIdx].click(); else if (e.code === 'KeyE') closePopup(); }
    return true;
  }
  return false;
}
$('popup').addEventListener('click', e => { if (e.target === $('popup') || e.target.closest('[data-close]')) closePopup(); });

// ---------- Panel contents ----------
function itemList(ids, opts = {}) {
  const rows = ids.filter(id => owned(id) > 0).map(id => {
    const n = owned(id), v = itemValue(id);
    const sell = opts.sell ? `<span class="btns2"><button type="button" data-act="sell" data-id="${id}">Sell 1 · ${fmt(v)}</button><button type="button" data-act="sellall" data-id="${id}">All · ${fmt(v * n)}</button></span>` : `<em>${fmt(v)} each</em>`;
    return `<li>${dot(itemColor(id))}<span>${itemName(id)}</span><b>×${n}</b>${sell}</li>`;
  });
  return rows.length ? `<ul class="inv">${rows.join('')}</ul>` : `<p class="note">${opts.empty || 'Nothing here yet.'}</p>`;
}
function cargoList() {
  let html = '';
  if (S.relicHeld) html += `<li class="relic">${dot('#c9a2ff')}<span>${C.CAVES[S.relicHeld - 1].relic.name}</span><b>1</b><em>relic</em></li>`;
  S.keys.forEach((n, k) => { if (n > 0) html += `<li class="key">${dot('#9fe3f0')}<span>${keyName(k)}</span><b>×${n}</b><em>Cave ${k + 1}</em></li>`; });
  for (const t of ORE_LIST) if (S.cargo.items[t]) html += `<li>${dot(C.BLOCKS[t].ore)}<span>${ORE_NAMES[t]}</span><b>×${S.cargo.items[t]}</b><em>${fmt(C.BLOCKS[t].value)} each</em></li>`;
  return html ? `<ul class="inv">${html}</ul>` : '<p class="note">Nothing yet. Ore you dig up shows here.</p>';
}
// One display stand: every tier of that part, with the next one for sale
function standRows(slot) {
  const P_ = C.PARTS[slot];
  return '<div class="rows">' + P_.tiers.map((t, k) => {
    const have = k <= S.tiers[slot], next = k === S.tiers[slot] + 1;
    const btn = k === S.tiers[slot] ? '<button type="button" disabled>Equipped</button>'
      : have ? '<button type="button" disabled>Owned</button>'
      : next ? `<button type="button" data-act="buy" data-id="${slot}" ${S.coins < t.cost ? 'disabled' : ''}>Buy · ${fmt(t.cost)}</button>`
      : `<button type="button" disabled>${fmt(t.cost)}</button>`;
    return `<div class="row${k === S.tiers[slot] ? ' here' : ''}"><div><small>Tier ${k + 1}${next ? ' · next' : ''}</small><strong>${t.name}</strong><span>${P_.fmt(t.val)}</span></div>${btn}</div>`;
  }).join('') + '</div>';
}
// The weapon rack: buy, fit and upgrade weapons for the weapon arm
function weaponRows() {
  const roman = ['I', 'II', 'III'];
  return '<p class="note">Your weapon arm fires with <b>F</b> or <b>J</b> the way you face (or click to aim, or tap ATTACK). Weapons also chip at blocks.</p><div class="rows one">' + Object.keys(C.WEAPONS).map(id => {
    const W = C.WEAPONS[id], mk = weaponMk(id), on = S.weapon === id;
    let btn;
    if (!mk) btn = `<button type="button" data-act="wbuy" data-id="${id}" ${S.coins < W.cost ? 'disabled' : ''}>Buy · ${fmt(W.cost)}</button>`;
    else {
      btn = on ? '<button type="button" disabled>Fitted</button>' : `<button type="button" data-act="wequip" data-id="${id}">Fit</button>`;
      const c = mkCost(id);
      btn += mk < 3 ? `<button type="button" data-act="wup" data-id="${id}" ${mkAfford(id) ? '' : 'disabled'}>Mk ${roman[mk]} · ${Object.entries(c).map(([k, n]) => (k === 'coins' ? fmt(n) : n + ' ' + k)).join(' + ')}</button>` : '<button type="button" disabled>Mk III</button>';
    }
    const stats = W.kind === 'pulse' ? 'stuns ' + W.stun + ' s, marks for ' + W.mark + ' s' : W.kind === 'pull' ? 'pulls and stuns, halves frontal damage' : Math.round(wDmg(id) * 10) / 10 + ' damage every ' + Math.round(wCd(id) * 100) / 100 + ' s';
    return `<div class="row${on ? ' here' : ''}"><div><small>${W.cls}${mk ? ' · Mk ' + roman[mk - 1] : ''}</small><strong>${W.name}</strong><span>${W.text} (${stats})</span></div><div class="mod-btns">${btn}</div></div>`;
  }).join('') + '</div>';
}
// What's on each stand at a glance (shown when you're inside but not at a stand)
function partsSummary() {
  return '<div class="rows">' + SLOTS.map(s => {
    const cur = part(s), next = C.PARTS[s].tiers[S.tiers[s] + 1];
    return `<div class="row"><div><small>${C.PARTS[s].label} · ${C.PARTS[s].stat}</small><strong>${cur.name}</strong><span>${next ? 'Next: ' + next.name + ' · ' + fmt(next.cost) + ' coins' : 'Maxed'}</span></div></div>`;
  }).join('') + '</div>';
}
function outpostRows() {
  let html = '';
  const blocked = beltBlocked();
  let btn, note;
  if (extendMaxed()) { btn = '<button type="button" disabled>Built</button>'; note = 'The relic lies at the end of the cave, about ' + depthOf(C.RELIC.row) + ' m in.'; }
  else {
    btn = `<button type="button" data-act="extend" ${blocked.length || S.coins < extendCost() ? 'disabled' : ''}>Build outpost · ${fmt(extendCost())}</button>`;
    note = blocked.length ? 'Dig the conveyor path (the dashed middle column) to ' + depthOf(outpostRow(1)) + ' m first: ' + blocked.length + ' blocks left.'
      : 'The path is clear. Build the outpost at ' + depthOf(outpostRow(1)) + ' m.';
  }
  html += `<div class="row"><div><small>Conveyor · halfway outpost</small><strong>${CS().outposts ? 'Reaches the outpost at ' + depthOf(beltEnd()) + ' m' : 'No outpost in this cave yet'}</strong><span>${note}</span></div>${btn}</div>`;
  if (outpostCount()) {
    const here = station() === 'outpost' ? 1 : 0;
    let b = '';
    for (let k = 0; k <= outpostCount(); k++) b += `<button type="button" data-act="travel" data-id="${k}" ${k === here ? 'disabled' : ''}>${k ? 'Halfway outpost · ' + depthOf(outpostRow(k)) + ' m' : 'Entrance outpost'}</button>`;
    html += `<div class="row"><div><small>Fast travel</small><span>Jump between this cave's outposts.</span></div><div class="travel-btns">${b}</div></div>`;
  }
  return html;
}
function forgeRows() {
  const q = S.forge.queue;
  let html = `<div class="row"><div><small>Forge queue · ${q.length}/${C.FORGE.queueMax}</small>` +
    (q.length ? `<strong>Refining ${C.MATERIALS[q[0]].name}</strong><div class="pbar"><i data-live="forge"></i></div><span>${q.length > 1 ? 'Next: ' + q.slice(1).map(id => C.MATERIALS[id].name).join(', ') + '.' : 'Nothing else queued.'} Jobs keep running while you're away.</span>`
      : '<span>Idle. Queue a recipe; it keeps working while you dig.</span>') + '</div></div>';
  html += '<div class="rows">';
  for (const id of MAT_LIST) {
    const m = C.MATERIALS[id], ok = canAfford(m.needs) && S.forge.queue.length < C.FORGE.queueMax;
    html += `<div class="row"><div><small>${needsText(m.needs)} · ${m.time} s</small><strong>${dot(m.color)} ${m.name} <b class="count">×${S.mats[id]}</b></strong><span>${haveText(m.needs)}</span></div>
      <button type="button" data-act="refine" data-id="${id}" ${ok ? '' : 'disabled'}>Refine</button></div>`;
  }
  html += '</div>';
  return html;
}
function computerGrid() {
  const CPc = C.COMPUTER;
  let cells = '';
  for (let y = 0; y < CPc.rows; y++) for (let x = 0; x < CPc.cols; x++) {
    const m = modAt(x, y), open = cellOpen(x, y);
    const fit = selMod && open && fits(selMod, x, y);
    const cls = ['cell', open ? 'open' : 'locked', m ? 'filled' : '', fit ? 'fit' : '', m && m.id === selMod ? 'sel' : ''].join(' ');
    const style = m ? `style="--mc:${modColor(m.id)}"` : '';
    const label = m && m.x === x && m.y === y ? C.MODS[m.id].name.split(' ')[0] : '';
    cells += `<button type="button" class="${cls}" ${style} data-act="cell" data-x="${x}" data-y="${y}" ${m ? `draggable="true" data-mod="${m.id}"` : ''} ${open ? '' : 'disabled'}>${label}</button>`;
  }
  return `<div class="computer">
    <div class="grid" style="grid-template-columns:repeat(${CPc.cols},1fr)">${cells}</div>
    <div class="legend"><span><i class="lg open"></i>Passive mods (top row)</span><span><i class="lg ${activeOpen() ? 'open' : 'locked'}"></i>${activeOpen() ? 'Active skill (bottom row, one at a time)' : 'Active skill · opens with the Core Heart'}</span>
    <p>${selMod ? 'Now tap a cell for <b>' + C.MODS[selMod].name + '</b> (its top-left corner goes there).' : 'Tap a mod, then a cell. On a computer you can also drag it.'}</p></div>
  </div>`;
}
const MOD_COLORS = ['#d9813b', '#86cfdc', '#8fd18a', '#f2c94c', '#c9a2ff', '#e2705a', '#9fb3e8', '#e8a0c8', '#c9c0b0'];
const modColor = id => MOD_COLORS[Object.keys(C.MODS).indexOf(id) % MOD_COLORS.length];
function shapeMini(id) {
  const sh = C.MODS[id].shape, w = Math.max(...sh.map(c => c[0])) + 1, h = Math.max(...sh.map(c => c[1])) + 1;
  let c = '';
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) c += sh.some(([a, b]) => a === x && b === y) ? `<i style="background:${modColor(id)}"></i>` : '<i></i>';
  return `<span class="shape" style="grid-template-columns:repeat(${w},8px)">${c}</span>`;
}
function modRows() {
  return '<div class="mods">' + Object.keys(C.MODS).map(id => {
    const m = C.MODS[id], lv = modLevel(id), placed = placedMod(id);
    const eff = m.text(m.eff[Math.max(0, lv - 1)]);
    let status, btns = '';
    if (!lv) {
      status = 'Build: ' + haveText(m.cost) + ' · ' + fmt(m.coins) + ' coins';
      btns = `<button type="button" data-act="build" data-id="${id}" ${modCostOk(id) ? '' : 'disabled'}>Build</button>`;
    } else {
      status = placed ? 'Installed' : m.active && !activeOpen() ? 'Skill · the active row opens with the Core Heart' : !fitsEmpty(id) ? 'Too big for your computer for now' : fitsAnywhere(id) ? 'Not installed · tap to pick it up' : 'No room · remove a mod to make space';
      btns = lv >= 3 ? '<button type="button" disabled>Max level</button>'
        : `<button type="button" data-act="upgrade" data-id="${id}" ${S.flux >= upgradeCost(id) ? '' : 'disabled'}>Lv ${lv + 1} · ${upgradeCost(id)} Flux</button>`;
      if (placed) btns += `<button type="button" data-act="remove" data-id="${id}">Remove</button>`;
    }
    const cls = ['mod', lv ? 'owned' : '', id === selMod ? 'sel' : '', placed ? 'placed' : ''].join(' ');
    return `<div class="${cls}" ${lv ? `data-act="select" data-id="${id}" draggable="true" data-mod="${id}"` : ''}>
      ${shapeMini(id)}<div><strong>${m.name}${lv ? ' · Lv ' + lv : ''}${m.active ? ' <em class="tag">skill</em>' : ''}</strong><span>${eff}</span><small>${status}</small></div><div class="mod-btns">${btns}</div></div>`;
  }).join('') + '</div>';
}

function toolRows() {
  return '<div class="rows">' + TOOL_IDS.map(id => {
    const t = C.TOOLS[id], n = S.tools[id] || 0, full = !n && beltTypes().length >= beltSlots();
    return `<div class="row"><div><small>Key ${t.key} · ${fmt(t.cost)} coins · ${n}/${t.max} on belt</small><strong>${t.name}</strong><span>${t.text}.</span></div>
      <div class="mod-btns"><button type="button" data-act="tool" data-id="${id}" ${n >= t.max || full || S.coins < t.cost ? 'disabled' : ''}>${full ? 'Belt full' : 'Buy'}</button>${n ? `<button type="button" data-act="untool" data-id="${id}">Put back</button>` : ''}</div></div>`;
  }).join('') + '</div>';
}
// Save backup: a code you can copy somewhere safe, or a file (shown in the pause menu's Settings tab)
let backupCode = '';
const encodeSave = () => btoa(unescape(encodeURIComponent(JSON.stringify(S))));
function backupView() {
  return `<p class="note">Your progress lives in this browser. Make a backup code and keep it somewhere safe (a note, an email to yourself), or download it as a file. To restore, paste a code or choose a file.</p>
    <div class="row"><div><small>Back up</small><span>${backupCode ? 'Code made. Copy all of it.' : 'Makes a code from your current progress.'}</span></div><div class="mod-btns"><button type="button" data-act="mkcode">Make code</button><button type="button" data-act="dlsave">Download file</button></div></div>
    ${backupCode ? `<textarea class="code" readonly>${backupCode}</textarea>` : ''}
    <div class="row"><div><small>Restore</small><span>Paste a backup code below, or choose a backup file. This replaces your current progress.</span></div><div class="mod-btns"><button type="button" data-act="loadsave">Load code</button><label class="filebtn">Choose file<input type="file" id="saveFile" accept=".json,.txt,application/json,text/plain" hidden></label></div></div>
    <textarea class="code" id="importCode" placeholder="Paste a backup code here"></textarea>`;
}
function loadSaveText(text) {
  let o;
  try { const t = text.trim(); o = JSON.parse(t.startsWith('{') ? t : decodeURIComponent(escape(atob(t)))); } catch (e) { return toast(null, 'That doesn\'t look like a Bolt & Burrow backup.'); }
  if (!o || !o.tiers || !Array.isArray(o.caves)) return toast(null, 'That doesn\'t look like a Bolt & Burrow backup.');
  try { noSave = true; localStorage.setItem(SAVE_KEY, JSON.stringify(o)); } catch (e) { noSave = false; return toast(null, 'Couldn\'t save in this browser.'); }
  location.reload();
}

const PANEL = {
  stand: () => { const slot = shopSpot().slice(6); if (slot === 'weapon') return ['Weapon rack', 'Weapon arm', weaponRows()]; return [C.PARTS[slot].label + ' stand', C.PARTS[slot].stat, standRows(slot)]; },
  counter: () => ['Pip\'s counter', 'Tools and trading', '<p class="note pip">Pip: "Tools for the road, and I\'ll buy whatever you dug up!"</p>' +
    '<small class="sub">Tool belt · ' + beltTypes().length + '/' + beltSlots() + ' slots</small>' + toolRows() +
    '<small class="sub">Sell from storage</small>' +
    itemList([...ORE_LIST, ...MAT_LIST], { sell: true, empty: 'Nothing to sell. Ore you bring home is kept in the storage car until you sell or refine it.' })],
  forge: () => ['Forge car', 'Queue ' + S.forge.queue.length + '/' + C.FORGE.queueMax, forgeRows()],
  lab: () => ['Lab car', '<span data-live="flux"></span>', computerGrid() + modRows()],
  computer: () => ['Computer car', '<span data-live="flux"></span>', '<p class="note">Permanent upgrades for your mech, paid for with Flux from your nano-bot.</p><div class="rows one">' + Object.keys(C.CORE).map(id => {
    const U = C.CORE[id], lv = coreLevel(id), max = lv >= U.max;
    const pips = Array.from({ length: U.max }, (_, k) => `<i class="pip${k < lv ? ' on' : ''}"></i>`).join('');
    const now = lv ? U.unit(coreVal(id)) : 'not upgraded', next = max ? '' : ' → ' + U.unit((lv + 1) * U.per);
    return `<div class="row"><div><small>${U.name} <span class="pips">${pips}</span></small><strong>${now}${next}</strong><span>${U.text}</span></div>${max ? '<button type="button" disabled>Max</button>' : `<button type="button" data-act="core" data-id="${id}" ${S.flux >= coreCost(id) ? '' : 'disabled'}>Level ${lv + 1} · ${coreCost(id)} Flux</button>`}</div>`;
  }).join('') + '</div>'],
  storage: () => ['Storage car', 'Unlimited for now', '<small class="sub">Ore</small>' + itemList(ORE_LIST, { empty: 'No ore stored.' }) +
    '<small class="sub">Materials</small>' + itemList(MAT_LIST, { empty: 'No materials yet. Refine ore in the Forge car.' })],
  outpost: () => [station() === 'outpost' ? 'Halfway outpost' : 'Entrance outpost', 'Recharging',
    outpostRows() + '<p class="note">Your battery recharges here, and ore rides the conveyor home to the train\'s storage car.</p>' + cargoList()],
};
const PANEL_NAME = { stand: () => PANEL.stand()[0], counter: () => 'Pip\'s counter', forge: () => 'Forge car', lab: () => 'Lab car', computer: () => 'Computer car', storage: () => 'Storage car', outpost: () => 'outpost' };
// (the button reads "Open outpost")

let panelHTML = '', titleSig = '';
function renderPanel() {
  if (popup) {
    const [title, chip, body] = PANEL[popup]();
    if (title + chip !== titleSig) { titleSig = title + chip; $('popTitle').textContent = title; $('popChip').innerHTML = chip; }
    if (body !== panelHTML && !dragging) { panelHTML = body; $('popBody').innerHTML = body; markSel(); }
  }
  // numbers that change every frame are written straight in, so the buttons aren't rebuilt
  document.querySelectorAll('[data-live="flux"]').forEach(e => (e.textContent = fmt(S.flux) + ' Flux'));
  document.querySelectorAll('[data-live="forge"]').forEach(e => (e.style.width = (forgeProgress() * 100) + '%'));
}

// ---------- Pop-up buttons (one handler for everything) ----------
$('popBody').addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  const id = b.dataset.id, act = b.dataset.act;
  if (act === 'buy') buyPart(id);
  if (act === 'core') buyCore(id);
  if (act === 'wbuy') buyWeapon(id);
  if (act === 'wequip') equipWeapon(id);
  if (act === 'wup') upgradeWeapon(id);
  if (act === 'tool') buyTool(id);
  if (act === 'untool') returnTool(id);
  if (act === 'sell' || act === 'sellall') sellItem(id, act === 'sellall');
  if (act === 'refine') queueRecipe(id);
  if (act === 'build') buildMod(id);
  if (act === 'upgrade') upgradeMod(id);
  if (act === 'remove') { removeMod(id); if (selMod === id) selMod = null; }
  if (act === 'select') selMod = selMod === id ? null : id;
  if (act === 'cell') {
    const x = +b.dataset.x, y = +b.dataset.y, m = modAt(x, y);
    if (selMod) { if (placeMod(selMod, x, y)) selMod = null; }
    else if (m) selMod = m.id;   // tap a placed mod to pick it up, then tap where it should go
  }
  if (act === 'extend') {
    if (!station() || extendMaxed() || beltBlocked().length || S.coins < extendCost()) return;
    S.coins -= extendCost(); CS().outposts++; buildOutpost(CS().outposts);
    toast('Outpost built', 'The conveyor now reaches ' + depthOf(beltEnd()) + ' m. Recharge and send ore home from there.');
    save();
  }
  if (act === 'travel') travelTo(Number(id));
  updateUI();
});
$('skill').addEventListener('click', () => { useSkill(); updateUI(); });
// ATTACK button (phones): hold to keep attacking
$('attack').addEventListener('pointerdown', e => { e.preventDefault(); attackHeld = true; attack(); });
for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) $('attack').addEventListener(ev, () => { attackHeld = false; });
$('belt').addEventListener('click', e => { const b = e.target.closest('[data-tool]'); if (b) { useTool(b.dataset.tool); updateUI(); } });

// Drag and drop (mouse): drag a mod onto a cell
$('popBody').addEventListener('dragstart', e => {
  const m = e.target.closest('[data-mod]'); if (!m) return;
  dragging = true; selMod = m.dataset.mod;
  e.dataTransfer.setData('text/plain', m.dataset.mod); e.dataTransfer.effectAllowed = 'move';
});
$('popBody').addEventListener('dragend', () => { dragging = false; updateUI(); });
$('popBody').addEventListener('dragover', e => { if (e.target.closest('.cell.open')) e.preventDefault(); });
$('popBody').addEventListener('drop', e => {
  const c = e.target.closest('.cell.open'); if (!c) return;
  e.preventDefault(); dragging = false;
  if (placeMod(e.dataTransfer.getData('text/plain'), +c.dataset.x, +c.dataset.y)) selMod = null;
  updateUI();
});

// ---------- Context action ----------
function runAction() { const a = actionHere(); if (a) { a.run(); updateUI(); } }
$('action').addEventListener('click', runAction);

// ---------- Buttons: recall and reset (tap twice to confirm) ----------
function confirmButton(id, label, armedLabel, onConfirm) {
  let armed = 0;
  $(id).addEventListener('click', () => {
    const b = $(id);
    if (!armed) { b.textContent = armedLabel(); b.classList.add('armed'); armed = setTimeout(() => { armed = 0; b.textContent = label; b.classList.remove('armed'); }, 3000); return; }
    clearTimeout(armed); armed = 0; b.textContent = label; b.classList.remove('armed');
    onConfirm();
  });
}
confirmButton('recall', 'Recall', () => 'Tap again · keep ' + Math.round(C.RECALL.keepCargo * 100) + '% ore', () => { if (!inTown() && station() !== 'entrance') recall('manual'); });
function resetProgress() {
  S = freshState(); selMod = null; loadArea(); placePlayerFromSave();
  arrive(P.x, P.y, 'up');
  toast('New dig', 'Walk up to the Cave 1 gate to start digging.');
}

// ---------- Refresh everything that shows numbers ----------
function updateUI() {
  const st = station();
  $('depth').textContent = (inTown() ? 0 : depthOf(pRow())) + ' m';
  $('biome').textContent = inShop() ? 'Pip\'s shop' : inTown() ? 'Town ' + (S.town + 1) + ' · ' + TOWN().name : caveLabel(S.cave) + ' · ' + (st === 'entrance' ? 'entrance' : st === 'outpost' ? 'halfway outpost' : cave().name);
  $('coins').textContent = fmt(S.coins);
  $('flux').hidden = !S.bots && S.flux < 1;
  $('flux').textContent = fmt(S.flux) + ' Flux';

  // battery bar with a "trip back" marker
  const bm = batteryMax(), bp = Math.max(0, P.battery / bm), need = Math.min(1, returnCost() / bm);
  $('batBar').style.width = (bp * 100) + '%';
  const bar = $('batBar').parentElement, low = lowBattery();
  bar.classList.toggle('low', low);
  $('batMark').hidden = !!st || need <= 0;
  $('batMark').style.left = (need * 100) + '%';
  $('batTxt').textContent = Math.ceil(Math.max(0, P.battery));
  const cn = cargoCount();
  $('cargoBar').style.width = (cn / cargoMax() * 100) + '%';
  $('hullBar').style.width = (Math.max(0, P.hull) / hullMax() * 100) + '%';
  $('hullTxt').textContent = Math.ceil(Math.max(0, P.hull));
  $('attack').hidden = inTown();
  const boss = activeBoss();
  $('bossBar').hidden = !boss;
  if (boss) { $('bossName').textContent = C.FOES[boss.type].name; $('bossHp').style.width = (Math.max(0, boss.hp) / boss.max * 100) + '%'; }
  $('cargoTxt').textContent = cn + '/' + cargoMax();
  $('recall').hidden = st === 'town' || st === 'entrance';
  $('app').classList.toggle('tripping', !!trip);   // hide the key cues during the train ride

  if (popup !== 'lab') selMod = null;
  renderPanel();
  // first visits to each part of the base
  const spot = spotPanel() || (townSpot() === 'engine' ? 'engine' : null);
  const FIRST = {
    forge: ['Forge car', 'Refine ore from storage into materials. Mixed recipes need more than one kind of ore.'],
    lab: ['Lab car', 'Build mods with materials and coins, then place them in the computer. Each mod has a fixed shape.'],
    computer: ['Computer car', 'Spend Flux on permanent upgrades: magnet range, hull plating, damage mitigation, field repair, weapon power, prospector\'s luck and scanner range.'],
    storage: ['Storage car', 'Everything you send home ends up here. Sell it at Pip\'s counter or refine it in the Forge car.'],
    engine: ['Engine car', 'Board here to ride the train to another town. The line opens with the Core Heart.'],
    stand: ['Display stand', 'Each stand shows every tier of one part. Press E (or tap the button) to look and buy. The weapon rack sells weapons for your weapon arm.'],
    counter: ['Pip\'s counter', 'Buy tools for your belt and sell ore and materials from storage.'],
  };
  if (FIRST[spot]) hintOnce('visit-' + spot, ...FIRST[spot]);

  // tool belt and skill button (caves only)
  const inCave = !inTown();
  const beltHtml = inCave ? beltTypes().map(id => `<button type="button" data-tool="${id}" title="${C.TOOLS[id].text}">${C.TOOLS[id].key} · ${C.TOOLS[id].name} ×${S.tools[id]}</button>`).join('') : '';
  if ($('belt').innerHTML !== beltHtml) $('belt').innerHTML = beltHtml;
  const sk = activeSkill();
  $('skill').hidden = !sk || !inCave;
  if (sk) {
    $('skill').classList.toggle('ready', S.skillCharge >= 1);
    $('skillName').textContent = C.MODS[sk].name;
    $('skillBar').style.width = (S.skillCharge * 100) + '%';
  }

  // context action (pop-ups, bridge pads, the engine car)
  const act = actionHere(), ab = $('action');
  ab.hidden = !act || paused(); if (act) ab.textContent = act.label;

  // nano-bot box (shrunk, it shows just the Flux count). In town and the shop it shrinks itself so the
  // train stays in view, and it turns see-through when your mech walks under it.
  const bb = $('botBox');
  bb.classList.toggle('auto', inTown());
  const br = bb.getBoundingClientRect(), cr = cv.getBoundingClientRect();
  const sx = cr.left + P.x * CELL - camX, sy = cr.top + (ROWS - P.y) * CELL - camY;
  bb.classList.toggle('ghost', sx > br.left - CELL && sx < br.right + CELL && sy > br.top - CELL && sy < br.bottom + CELL * 0.5);
  const mini = bb.classList.contains('mini') || inTown();
  $('botTag').textContent = mini && S.bots ? fmt(S.flux) + ' Flux' : S.bots ? S.bots + ' nano-bot' + (S.bots > 1 ? 's' : '') : 'None yet';
  $('botTag').classList.toggle('open', S.bots > 0);
  $('botBox').title = S.bots ? 'Making ' + fmt(fluxRate() * 60) + ' Flux a minute, even while you\'re away (up to ' + C.NANOBOT.offlineCapHours + ' h)' : 'The first nano-bot is sealed inside the Ember Idol, Cave 1\'s relic';

  renderTip(low);
  renderCue(act);
}

// ---------- The tip line (top strip) and the key cues (bottom strip) ----------
// Messages and first-time hints show in the tip line; when there's no message it says what you can do here.
function idleTip(low) {
  if (trip) return 'Riding the Drill Liner · press any key or tap to skip';
  if (low) return '<span class="warn">Low battery · head back to an outpost on the conveyor</span>';
  if (inShop()) {
    const sp = shopSpot();
    if (sp === 'counter') return tt('Pip\'s counter') + 'Buy tools for your belt and sell ore and materials from storage.';
    if (sp) return tt(PANEL.stand()[0]) + (sp === 'stand-weapon' ? 'Weapons for your weapon arm.' : 'Every tier of this part, with the next one for sale.');
    return 'Walk up to a <b>display stand</b> or to <b>Pip</b> at the counter. The door at the bottom leads back to town.';
  }
  if (inTown()) {
    if (P.hull < hullMax() - 0.5) return tt('Repairing hull') + 'Back home, your hull repairs itself in a few seconds.';
    const t = townSpot();
    const CAR = { forge: 'Refine ore from storage into materials.', lab: 'Build mods and place them in the computer grid.', computer: 'Spend Flux on permanent upgrades for your mech.', storage: 'Everything you send home ends up here.' };
    if (t === 'engine') return tt('Engine car') + (lineIsOpen() ? 'The Drill Liner takes your whole train to ' + C.TOWNS[(S.town + 1) % C.TOWNS.length].name + '.' : 'The line to ' + C.TOWNS[1].name + ' opens when you bring home the Core Heart from Cave 3.');
    if (CAR[t]) return tt(PANEL_NAME[t]()) + CAR[t];
    return (TOWN().shop ? 'Walk through the big door of <b>Pip\'s shop</b> to buy parts and sell.' : 'Pip hasn\'t opened a shop here yet.') + ' Stand at a train car\'s door to use the <b>Forge</b>, <b>Lab</b>, <b>Storage</b> or <b>Computer</b>.';
  }
  if (station()) return tt(station() === 'outpost' ? 'Halfway outpost' : 'Entrance outpost') + 'Your battery recharges and ore rides the conveyor home. Open it to build or fast travel.';
  if (cargoCount() >= cargoMax()) return '<span class="warn">Cargo full</span> · bring it to an outpost and the conveyor sends it home.';
  return caveLabel(S.cave) + ' · ' + cave().name + '. Bring ore to an outpost and the conveyor sends it home to the train.';
}
let tipMsg = null, tipTimer = 0;
const tt = title => '<b class="tt">' + title + '</b>';
function renderTip(low) {
  const p = $('tip'), html = tipMsg || idleTip(low);
  if (p.innerHTML !== html) {
    p.innerHTML = html;
    p.classList.toggle('msg', !!tipMsg);
    p.classList.toggle('long', !!tipMsg && p.scrollHeight > p.parentElement.clientHeight + 2);
  }
}
const touchUI = matchMedia('(pointer: coarse)').matches;
function renderCue(act) {
  let html;
  if (touchUI) html = 'Drag anywhere to move · push into blocks to dig · &#x23F8; for the menu';
  else {
    const k = (key, what) => '<kbd>' + key + '</kbd> ' + what;
    const bits = [];
    if (act) bits.push(k('E', act.label));
    bits.push(k('WASD', 'move'));
    if (!inTown()) bits.push(k('F', 'attack'), k('Space', 'skill'), k('1–4', 'tools'));
    bits.push(k('Esc', 'menu'));
    html = bits.join(' · ');
  }
  if ($('cue').innerHTML !== html) $('cue').innerHTML = html;
}

// ---------- Messages ----------
const hinted = new Set();
function toast(title, msg) {
  tipMsg = (title ? '<b class="tt">' + title + '</b>' : '') + msg;
  clearTimeout(tipTimer); tipTimer = setTimeout(() => { tipMsg = null; updateUI(); }, title ? 7000 : 3500);
  if (typeof updateUI === 'function' && $('tip')) renderTip(false);
}
// First-time hints are remembered with your save, so each one shows once (and stays in the menu's hint log)
function hintOnce(key, title, msg) {
  if (hinted.has(key) || S.hints.includes(key)) return;
  hinted.add(key); S.hints.push(key); toast(title, msg);
  S.hintLog = (S.hintLog || []).concat([[title, msg]]).slice(-40);
}
