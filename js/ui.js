// Bolt & Burrow — the HUD and the panels under the cave.
// The left panel changes with where you stand: in town it's the shop or a train car (forge, lab,
// storage); at a cave outpost it's the outpost; anywhere else in a cave it's your cargo.
// The right panel is the nano-bot window.
'use strict';

const SLOTS = ['head', 'arms', 'body', 'legs'];
const ORE_NAMES = { copper: 'Copper', silver: 'Silver', gold: 'Gold', crystal: 'Crystal' };
const dot = col => `<i style="background:${col}"></i>`;
const itemColor = id => (C.MATERIALS[id] ? C.MATERIALS[id].color : C.BLOCKS[id].ore);
const needsText = needs => Object.entries(needs).map(([k, n]) => n + ' ' + itemName(k).toLowerCase()).join(' + ');
const haveText = needs => Object.entries(needs).map(([k, n]) => `<span class="${owned(k) >= n ? '' : 'short'}">${owned(k)}/${n} ${itemName(k).toLowerCase()}</span>`).join(' · ');

let selMod = null, dragging = false;

// Which panel to show
function panelMode() {
  if (inTown()) return townSpot() || 'town';
  return station() ? 'outpost' : 'cargo';
}

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
function partsRows() {
  return '<div class="rows">' + SLOTS.map(s => {
    const cur = part(s), next = C.PARTS[s].tiers[S.tiers[s] + 1];
    const btn = next ? `<button type="button" data-act="buy" data-id="${s}" ${S.coins < next.cost ? 'disabled' : ''}>${next.name} · ${fmt(next.cost)}</button>` : '<button type="button" disabled>Maxed</button>';
    return `<div class="row"><div><small>${C.PARTS[s].label} · ${C.PARTS[s].stat}</small><strong>${cur.name}</strong><span>${C.PARTS[s].fmt(cur.val)}</span></div>${btn}</div>`;
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
    <div class="legend"><span><i class="lg open"></i>Passive</span><span><i class="lg locked"></i>Active · opens after Town 1</span>
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
      status = placed ? 'Installed' : !fitsEmpty(id) ? 'Too big for your computer for now' : fitsAnywhere(id) ? 'Not installed · tap to pick it up' : 'No room · remove a mod to make space';
      btns = lv >= 3 ? '<button type="button" disabled>Max level</button>'
        : `<button type="button" data-act="upgrade" data-id="${id}" ${S.flux >= upgradeCost(id) ? '' : 'disabled'}>Lv ${lv + 1} · ${upgradeCost(id)} Flux</button>`;
      if (placed) btns += `<button type="button" data-act="remove" data-id="${id}">Remove</button>`;
    }
    const cls = ['mod', lv ? 'owned' : '', id === selMod ? 'sel' : '', placed ? 'placed' : ''].join(' ');
    return `<div class="${cls}" ${lv ? `data-act="select" data-id="${id}" draggable="true" data-mod="${id}"` : ''}>
      ${shapeMini(id)}<div><strong>${m.name}${lv ? ' · Lv ' + lv : ''}</strong><span>${eff}</span><small>${status}</small></div><div class="mod-btns">${btns}</div></div>`;
  }).join('') + '</div>';
}

const PANEL = {
  town: () => ['Town', 'Home base', `<p class="note">Stand in front of the <b>SHOP</b> to buy parts and sell. Stand at a train car's door (the marked platform tiles) to use the <b>Forge</b>, <b>Lab</b> or <b>Storage</b>.</p>` +
    '<small class="sub">In storage</small>' + itemList([...ORE_LIST, ...MAT_LIST], { empty: 'Storage is empty. Ore you bring to any outpost ends up here.' })],
  shop: () => ['Shop', 'Parts and trading', partsRows() + '<small class="sub">Sell from storage</small>' +
    itemList([...ORE_LIST, ...MAT_LIST], { sell: true, empty: 'Nothing to sell. Ore you bring home is kept in the storage car until you sell or refine it.' })],
  engine: () => ['Engine car', 'Coming later', '<p class="note">The engine will take the whole train, forge and lab included, to the next town once that line opens. Press E or tap Board train to have a look.</p>'],
  forge: () => ['Forge car', 'Queue ' + S.forge.queue.length + '/' + C.FORGE.queueMax, forgeRows()],
  lab: () => ['Lab car', '<span data-live="flux"></span>', computerGrid() + modRows()],
  storage: () => ['Storage car', 'Unlimited for now', '<small class="sub">Ore</small>' + itemList(ORE_LIST, { empty: 'No ore stored.' }) +
    '<small class="sub">Materials</small>' + itemList(MAT_LIST, { empty: 'No materials yet. Refine ore in the Forge car.' })],
  outpost: () => [station() === 'outpost' ? 'Halfway outpost' : 'Entrance outpost', 'Recharging',
    outpostRows() + '<p class="note">Your battery recharges here, and ore rides the conveyor home to the train\'s storage car.</p>' + cargoList()],
  cargo: () => ['Cargo', cargoCount() + '/' + cargoMax(), cargoList() + '<p class="note">Bring ore to an outpost and the conveyor sends it home to the train.</p>'],
};

let panelHTML = '', titleSig = '';
function renderPanel() {
  const [title, chip, body] = PANEL[panelMode()]();
  if (title + chip !== titleSig) { titleSig = title + chip; $('panelTitle').textContent = title; $('shopState').innerHTML = chip; }
  $('shopState').classList.toggle('open', panelMode() !== 'cargo');
  if (body !== panelHTML && !dragging) { panelHTML = body; $('panelBody').innerHTML = body; }
  // numbers that change every frame are written straight in, so the buttons aren't rebuilt
  document.querySelectorAll('[data-live="flux"]').forEach(e => (e.textContent = fmt(S.flux) + ' Flux'));
  document.querySelectorAll('[data-live="forge"]').forEach(e => (e.style.width = (forgeProgress() * 100) + '%'));
}

// ---------- Panel buttons (one handler for everything) ----------
$('panelBody').addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  const id = b.dataset.id, act = b.dataset.act;
  if (act === 'buy') {
    const next = C.PARTS[id].tiers[S.tiers[id] + 1];
    if (townSpot() !== 'shop' || !next || S.coins < next.cost) return;
    S.coins -= next.cost; S.tiers[id]++;
    if (id === 'body') P.battery = batteryMax();
    toast(null, next.name + ' installed.'); save();
  }
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
// Drag and drop (mouse): drag a mod onto a cell
$('panelBody').addEventListener('dragstart', e => {
  const m = e.target.closest('[data-mod]'); if (!m) return;
  dragging = true; selMod = m.dataset.mod;
  e.dataTransfer.setData('text/plain', m.dataset.mod); e.dataTransfer.effectAllowed = 'move';
});
$('panelBody').addEventListener('dragend', () => { dragging = false; updateUI(); });
$('panelBody').addEventListener('dragover', e => { if (e.target.closest('.cell.open')) e.preventDefault(); });
$('panelBody').addEventListener('drop', e => {
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
confirmButton('reset', 'Reset progress', () => 'Click again to reset', () => {
  S = freshState(); selMod = null; loadArea(); placePlayerFromSave();
  arrive(P.x, P.y, 'up');
  toast('New dig', 'Walk up to the Cave 1 gate to start digging.');
});

// ---------- Refresh everything that shows numbers ----------
function updateUI() {
  const st = station();
  $('depth').textContent = depthOf(pRow()) + ' m';
  $('biome').textContent = inTown() ? 'Town' : 'Cave ' + (S.cave + 1) + ' · ' + (st === 'entrance' ? 'entrance' : st === 'outpost' ? 'halfway outpost' : cave().name);
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
  $('batWarn').hidden = !low;
  const cn = cargoCount();
  $('cargoBar').style.width = (cn / cargoMax() * 100) + '%';
  $('cargoTxt').textContent = cn + '/' + cargoMax();
  $('recall').hidden = st === 'town' || st === 'entrance';

  if (panelMode() !== 'lab') selMod = null;
  renderPanel();

  // context action (bridge pads, the engine car)
  const act = actionHere(), ab = $('action');
  ab.hidden = !act; if (act) ab.textContent = act.label;

  // nano-bot panel
  $('botTag').textContent = S.bots ? S.bots + ' nano-bot' + (S.bots > 1 ? 's' : '') : 'None yet';
  $('botTag').classList.toggle('open', S.bots > 0);
  $('botInfo').innerHTML = S.bots
    ? '<b>Making ' + fmt(fluxRate() * 60) + ' Flux a minute</b>, even while you\'re away (up to ' + C.NANOBOT.offlineCapHours + ' h). Spend Flux on mod upgrades in the Lab car.'
    : 'The first nano-bot is sealed inside the Ember Idol, Cave 1\'s relic. Bring it home to start making Flux.';
}

// ---------- Messages ----------
let toastTimer;
const hinted = new Set();
function toast(title, msg) {
  const t = $('toast');
  t.innerHTML = (title ? '<b>' + title + '</b>' : '') + msg;
  t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), title ? 4200 : 2600);
}
function hintOnce(key, title, msg) { if (hinted.has(key)) return; hinted.add(key); toast(title, msg); }
