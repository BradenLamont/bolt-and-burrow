// Bolt & Burrow — the train base: storage, the shop, the forge, the computer (mods) and nano-bots.
// The train is parked in town. Stand at a car's door to use it; stand in front of the SHOP to trade.
'use strict';

// ---------- Where you're standing in town ----------
// Returns the train car at your position ('engine', 'forge', 'lab', 'storage'), or null.
function townSpot() {
  if (!onTownMap()) return null;
  const ST = C.TOWN.station, c = pCol(), r = pRow();
  if (r === ST.platformRow) {
    const car = ST.cars.find(k => c >= k.cols[0] && c <= k.cols[1]);
    if (car) return car.id;
  }
  if (r === C.BOARD.row - 1 && Math.abs(c - C.BOARD.col) <= 0) return 'board';   // in front of the contracts board
  return null;
}
// Inside the shop: 'stand-head' (etc.) when you're right next to a display stand, 'counter' at Pip's counter
function shopSpot() {
  if (!inShop()) return null;
  const SH = C.SHOP, c = pCol(), r = pRow();
  for (const st of SH.stands) if (r === st.row && Math.abs(c - st.col) === 1) return 'stand-' + st.slot;
  if (r === SH.counterRow - 1 && c >= SH.cols[0] + 2 && c <= SH.cols[1] - 2) return 'counter';
  return null;
}
function buyPart(slot) {
  const next = C.PARTS[slot].tiers[S.tiers[slot] + 1];
  if (shopSpot() !== 'stand-' + slot || !next || S.coins < next.cost) { if (next && S.coins < next.cost) toast(null, 'Pip: "Come back with ' + fmt(next.cost - S.coins) + ' more coins!"'); return; }
  S.coins -= next.cost; S.tiers[slot]++; sfx('buy');
  if (slot === 'body') P.battery = batteryMax();
  toast(null, next.name + ' installed. Pip: "Pleasure doing business!"'); save();
}
const carDoor = id => { const k = C.TOWN.station.cars.find(c => c.id === id); return (k.cols[0] + k.cols[1]) / 2; };

// ---------- Storage and the shop ----------
// At any station, your cargo goes into the train's storage car (from a cave it rides the conveyor home).
function depositCargo() {
  const n = cargoCount();
  if (!n) return;
  for (const [t, k] of Object.entries(S.cargo.items)) S.storage[t] = (S.storage[t] || 0) + k;
  S.cargo.items = {};
  contractEvent('home', n);
  floatText(P.x, P.y + 0.6, '+' + n + ' ore home', '#e8a160'); sfx('coin');
  toast(null, n + ' ore ' + (inTown() ? 'unloaded into the storage car.' : 'sent home along the conveyor to the train\'s storage car.'));
  hintOnce('storage', null, 'Ore isn\'t sold automatically any more. Sell it at the town SHOP, or refine it in the Forge car.');
}
const itemValue = id => (C.BLOCKS[id] && C.BLOCKS[id].value) || C.MATERIALS[id].value;
const owned = id => (C.MATERIALS[id] ? S.mats[id] : S.storage[id]) || 0;
function sellItem(id, all) {
  if (shopSpot() !== 'counter') return;
  const n = all ? owned(id) : Math.min(1, owned(id));
  if (!n) return;
  if (C.MATERIALS[id]) S.mats[id] -= n; else S.storage[id] -= n;
  const coins = n * itemValue(id);
  S.coins += coins; sfx('sell'); contractEvent('sell', coins);
  toast(null, 'Sold ' + n + ' ' + itemName(id).toLowerCase() + ' for ' + fmt(coins) + ' coins.');
  save();
}
const itemName = id => (C.MATERIALS[id] ? C.MATERIALS[id].name : id[0].toUpperCase() + id.slice(1));

// ---------- Forge ----------
// Jobs run one at a time from S.forge.start. Because it's all timestamps, the forge keeps
// working while you're in a cave or the game is closed.
const recipeTime = id => C.MATERIALS[id].time * 1000;
const canAfford = needs => Object.entries(needs).every(([k, n]) => owned(k) >= n);
function queueRecipe(id) {
  const m = C.MATERIALS[id];
  if (townSpot() !== 'forge' || S.forge.queue.length >= C.FORGE.queueMax || !canAfford(m.needs)) return;
  for (const [k, n] of Object.entries(m.needs)) S.storage[k] -= n;
  if (!S.forge.queue.length) S.forge.start = Date.now();
  S.forge.queue.push(id); sfx('click');
  hintOnce('forge-queue', 'Forge', 'Jobs keep running while you\'re in a cave or the game is closed. Collect materials from the Storage car later.');
  save();
}
function updateForge() {
  const q = S.forge.queue, now = Date.now();
  let made = 0;
  while (q.length && now - S.forge.start >= recipeTime(q[0])) {
    S.forge.start += recipeTime(q[0]);
    S.mats[q[0]]++; made++; sfx('ding'); contractEvent('refine');
    if (onTownMap()) floatText(carDoor('forge') + 0.5, C.TOWN.station.platformRow + 1.2, '+1 ' + C.MATERIALS[q[0]].name, C.MATERIALS[q[0]].color);
    q.shift();
  }
  if (!q.length) S.forge.start = 0;
  return made;
}
const forgeProgress = () => (S.forge.queue.length ? Math.min(1, (Date.now() - S.forge.start) / recipeTime(S.forge.queue[0])) : 0);

// ---------- Computer and mods ----------
const CP = C.COMPUTER;
const modLevel = id => S.mods[id] || 0;
const placedMod = id => S.grid.find(p => p.id === id);
// A mod's effect, only while it's placed in the computer
function modVal(id) {
  const lv = modLevel(id);
  return lv && placedMod(id) ? C.MODS[id].eff[lv - 1] : 0;
}
const activeOpen = () => S.caves[CORE].relicDone;   // the active row opens with the Core Heart (end of Town 1)
const cellOpen = (x, y) => x >= 0 && y >= 0 && x < CP.cols && y < CP.rows && (y < CP.passiveRows || activeOpen());
function modAt(x, y) {
  return S.grid.find(p => C.MODS[p.id].shape.some(([dx, dy]) => p.x + dx === x && p.y + dy === y));
}
// Can mod `id` go with its top-left corner at (x, y)? Ignores the mod's own current spot.
// Passive mods go in the top row, skills in the bottom row
const rowOk = (id, y) => (C.MODS[id].active ? y >= CP.passiveRows : y < CP.passiveRows);
function fits(id, x, y) {
  return C.MODS[id].shape.every(([dx, dy]) => {
    const cx = x + dx, cy = y + dy, o = modAt(cx, cy);
    return cellOpen(cx, cy) && rowOk(id, cy) && (!o || o.id === id || (C.MODS[id].active && C.MODS[o.id].active));
  });
}
// Could it fit in an empty computer? (If not, it needs a bigger computer: expansions come later.)
function fitsEmpty(id) {
  for (let y = 0; y < CP.rows; y++) for (let x = 0; x < CP.cols; x++)
    if (C.MODS[id].shape.every(([dx, dy]) => cellOpen(x + dx, y + dy) && rowOk(id, y + dy))) return true;
  return false;
}
// Could it fit anywhere in the computer as it is now (counting space it would free up)?
function fitsAnywhere(id) {
  for (let y = 0; y < CP.rows; y++) for (let x = 0; x < CP.cols; x++) if (fits(id, x, y)) return true;
  return false;
}
function placeMod(id, x, y) {
  if (townSpot() !== 'lab' || !modLevel(id)) return false;
  if (!fits(id, x, y)) { toast(null, C.MODS[id].name + ' doesn\'t fit there.'); return false; }
  S.grid = S.grid.filter(p => p.id !== id && !(C.MODS[id].active && C.MODS[p.id].active));   // one skill at a time
  S.grid.push({ id, x, y }); sfx('click');
  if (C.MODS[id].active) { S.skillCharge = 0; hintOnce('skill', C.MODS[id].name, 'Your nano-bot charges this skill. Use it in a cave with Space or Q, or the skill button.'); }
  if (P.battery > batteryMax()) P.battery = batteryMax();
  save(); return true;
}
function removeMod(id) {
  if (townSpot() !== 'lab') return;
  S.grid = S.grid.filter(p => p.id !== id);
  if (P.battery > batteryMax()) P.battery = batteryMax();
  save();
}
const modCostOk = id => canAfford(C.MODS[id].cost) && S.coins >= C.MODS[id].coins;
function buildMod(id) {
  const m = C.MODS[id];
  if (townSpot() !== 'lab' || modLevel(id) || !modCostOk(id)) return;
  for (const [k, n] of Object.entries(m.cost)) S.mats[k] -= n;
  S.coins -= m.coins; S.mods[id] = 1; sfx('buy');
  toast(m.name + ' built', 'Tap it, then tap a cell in the computer to install it.' + (m.active && !activeOpen() ? ' Skills go in the active row, which opens when you bring home the Core Heart.' : fitsEmpty(id) ? '' : ' It\'s too big for your computer right now. Expansions come later.'));
  save();
}
const upgradeCost = id => (modLevel(id) >= 3 ? 0 : CP.upgradeFlux[modLevel(id) - 1] * C.MODS[id].shape.length);
function upgradeMod(id) {
  if (townSpot() !== 'lab' || !modLevel(id) || modLevel(id) >= 3 || S.flux < upgradeCost(id)) return;
  S.flux -= upgradeCost(id); S.mods[id]++; sfx('buy');
  toast(null, C.MODS[id].name + ' is now level ' + S.mods[id] + ': ' + C.MODS[id].text(C.MODS[id].eff[S.mods[id] - 1]) + '.');
  save();
}

// ---------- Nano-bots ----------
const fluxRate = () => S.bots * C.NANOBOT.fluxPerMin / 60;   // Flux per second
function updateBots(dt) { S.flux += fluxRate() * dt; }
// Called on start-up: Flux made while the game was closed (capped)
function offlineFlux() {
  const away = Math.min((Date.now() - S.last) / 1000, C.NANOBOT.offlineCapHours * 3600);
  const gain = Math.floor(away * fluxRate());
  if (away > 30 && gain > 0) { S.flux += gain; return gain; }
  return 0;
}
