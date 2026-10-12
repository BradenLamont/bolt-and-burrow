// Bolt & Burrow — the HUD and the panels under the cave.
// The left panel is the Workshop at base or an outpost, and your Inventory everywhere else.
'use strict';

const SLOTS = ['head', 'arms', 'body', 'legs'];
const ORE_NAMES = { copper: 'Copper', silver: 'Silver', gold: 'Gold', crystal: 'Crystal', mixed: 'Mixed ore' };

// ---------- Workshop: parts ----------
$('parts').innerHTML = SLOTS.map(s => `
  <div class="row">
    <div><small>${C.PARTS[s].label} · ${C.PARTS[s].stat}</small><strong id="cur-${s}"></strong><span id="stat-${s}"></span></div>
    <button id="up-${s}" data-slot="${s}" type="button"></button>
  </div>`).join('');

$('parts').addEventListener('click', e => {
  const s = e.target.closest('button')?.dataset.slot; if (!s || !station()) return;
  const next = C.PARTS[s].tiers[S.tiers[s] + 1]; if (!next || S.coins < next.cost) return;
  S.coins -= next.cost; S.tiers[s]++;
  if (s === 'body') P.battery = batteryMax();
  toast(null, next.name + ' installed.'); save(); updateUI();
});

// ---------- Workshop: conveyor, outposts and fast travel ----------
$('extend').addEventListener('click', () => {
  if (!station() || extendMaxed() || beltBlocked().length || S.coins < extendCost()) return;
  S.coins -= extendCost(); S.outposts++; buildOutpost(S.outposts);
  toast('Outpost ' + S.outposts + ' built', 'The conveyor now reaches ' + depthOf(beltEnd()) + ' m. Sell, recharge, shop and fast travel there.');
  save(); updateUI();
});
$('travel').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  travelTo(Number(b.dataset.k));
});
let travelSig = '';
function renderTravel() {
  const here = station() === 'outpost' ? outpostAt(pCol(), pRow()) : station() === 'base' ? 0 : -1;
  const sig = S.outposts + ':' + here;
  if (sig === travelSig) return;
  travelSig = sig;
  $('travelRow').hidden = S.outposts === 0;
  let html = '';
  for (let k = 0; k <= S.outposts; k++) html += `<button type="button" data-k="${k}" ${k === here ? 'disabled' : ''}>${k ? 'OP' + k + ' · ' + depthOf(outpostRow(k)) + ' m' : 'Base'}</button>`;
  $('travel').innerHTML = html;
}

// ---------- Pet ----------
$('train').addEventListener('click', () => {
  if (!station() || !S.pet || S.pet >= C.PET.maxLevel || S.coins < trainCost()) return;
  S.coins -= trainCost(); S.pet++;
  toast(null, C.PET.name + ' is now level ' + S.pet + '.'); save(); updateUI();
});

// ---------- Inventory ----------
let invSig = '';
function renderInventory() {
  const items = S.cargo.items;
  const sig = JSON.stringify(items) + S.relicHeld;
  if (sig === invSig) return;
  invSig = sig;
  const types = Object.keys(items).filter(t => items[t].n > 0).sort((a, b) => items[b].value - items[a].value);
  let html = '';
  if (S.relicHeld) html += `<li class="relic"><i style="background:#c9a2ff"></i><span>${C.RELIC.name}</span><b>1</b><em>${fmt(C.RELIC.reward)}</em></li>`;
  for (const t of types) {
    const col = (C.BLOCKS[t] && C.BLOCKS[t].ore) || '#a8937c';
    html += `<li><i style="background:${col}"></i><span>${ORE_NAMES[t] || t}</span><b>×${items[t].n}</b><em>${fmt(items[t].value)}</em></li>`;
  }
  $('invList').innerHTML = html || '<li class="empty">Nothing yet. Ore you dig up shows here.</li>';
  $('invTotal').textContent = types.length
    ? 'Worth ' + fmt(cargoValue()) + ' coins. It sells automatically at base or any outpost.'
    : 'Sell ore at base or any outpost.';
}

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
confirmButton('recall', 'Recall', () => 'Tap again · keep ' + Math.round(C.RECALL.keepCargo * 100) + '% ore', () => { if (station() !== 'base') recall('manual'); });
confirmButton('reset', 'Reset progress', () => 'Click again to reset', () => {
  S = freshState(); genWorld(); regenPet(); placePlayerFromSave();
  wobble.clear(); lastBiome = null; lastCell = -1; markSeen(); save(); updateUI();
  toast('New dig', 'Head into the cave for ore. Sell it at base or an outpost, then upgrade your robot.');
});

// ---------- Refresh everything that shows numbers ----------
function updateUI() {
  const st = station();
  $('depth').textContent = depthOf(pRow()) + ' m';
  $('biome').textContent = st === 'base' ? 'Base' : st === 'outpost' ? 'Outpost ' + outpostAt(pCol(), pRow()) : biomeAt(pRow()).name;
  $('coins').textContent = fmt(S.coins);

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

  // left panel: workshop at a station, inventory elsewhere
  $('shopView').hidden = !st; $('invView').hidden = !!st;
  $('panelTitle').textContent = st ? 'Workshop' : 'Inventory';
  const chip = $('shopState');
  chip.textContent = st === 'base' ? 'At base' : st === 'outpost' ? 'At outpost ' + outpostAt(pCol(), pRow()) : 'Cargo ' + cn + '/' + cargoMax();
  chip.classList.toggle('open', !!st);
  $('recall').hidden = st === 'base';

  if (st) {
    SLOTS.forEach(s => {
      const cur = part(s), next = C.PARTS[s].tiers[S.tiers[s] + 1], btn = $('up-' + s);
      $('cur-' + s).textContent = cur.name;
      $('stat-' + s).textContent = C.PARTS[s].fmt(cur.val);
      if (!next) { btn.textContent = 'Maxed'; btn.disabled = true; }
      else { btn.textContent = next.name + ' · ' + fmt(next.cost); btn.disabled = S.coins < next.cost; }
    });
    $('liftDepth').textContent = S.outposts ? 'Reaches ' + depthOf(beltEnd()) + ' m · ' + S.outposts + ' outpost' + (S.outposts > 1 ? 's' : '') : 'No outposts yet';
    const blocked = beltBlocked(), ext = $('extend');
    if (extendMaxed()) { ext.textContent = 'Max length'; ext.disabled = true; $('liftNote').textContent = 'The conveyor reaches as deep as it can. The relic lies further in.'; }
    else {
      ext.textContent = 'Build outpost ' + (S.outposts + 1) + ' · ' + fmt(extendCost());
      ext.disabled = blocked.length > 0 || S.coins < extendCost();
      $('liftNote').textContent = blocked.length
        ? 'Dig the conveyor path (the dashed middle column) to ' + depthOf(outpostRow(S.outposts + 1)) + ' m first: ' + blocked.length + ' blocks left.'
        : 'The path is clear. Build the next outpost at ' + depthOf(outpostRow(S.outposts + 1)) + ' m.';
    }
    renderTravel();
  } else {
    travelSig = '';
    renderInventory();
  }

  if (S.pet) {
    $('petTag').textContent = C.PET.name + ' · level ' + S.pet;
    $('petTag').classList.add('open');
    $('petInfo').innerHTML = '<b>' + C.PET.name + ' the ' + C.PET.species + '.</b> ' + C.PET.pattern + ' Earns about ' + fmt(petRate() * 60) + ' coins a minute, even while you are away. Gives you +' + Math.round(C.PET.digBonusPerLevel * S.pet * 100) + '% dig power.';
    const tb = $('train'); tb.hidden = false;
    if (S.pet >= C.PET.maxLevel) { tb.textContent = 'Max level'; tb.disabled = true; }
    else { tb.textContent = 'Train · ' + fmt(trainCost()); tb.disabled = !st || S.coins < trainCost(); }
  }
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
