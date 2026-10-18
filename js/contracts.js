// Bolt & Burrow — daily contracts. A board in each town shows three contracts picked at random each day
// (the same three for the whole day, new ones at midnight). Progress counts anywhere; claim rewards at the board.
// Other files report what happens with contractEvent(kind, amount, extra).
'use strict';

const todayKey = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
// How far along you are: picks the contract sizes and scales the coin rewards
function contractTier() {
  if (S.caves[CORE].relicDone) return 3;
  if (S.caves[1].relicDone) return 2;
  if (S.caves[0].relicDone) return 1;
  return 0;
}
// A small seeded random number generator, so a day's contracts don't change when you reload
function seeded(str) {
  let h = 2166136261;
  for (let k = 0; k < str.length; k++) h = Math.imul(h ^ str.charCodeAt(k), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}
const CT = () => C.CONTRACTS;
const ctDef = id => CT().list.find(d => d.id === id);
// Ore and enemy types you can actually reach at your tier
function reachableCaves() { return C.CAVES.map((c, k) => k).filter(k => caveOpen(k)); }
function rollContracts() {
  const day = todayKey();
  if (S.contracts && S.contracts.day === day) return;
  const rnd = seeded(day + '/' + (S.created || 'bolt')), tier = contractTier();
  const ores = [...new Set(reachableCaves().flatMap(k => Object.keys(C.CAVES[k].ores)))];
  const foes = [...new Set(reachableCaves().flatMap(k => Object.keys(C.CAVES[k].foes || {})))];
  const pool = CT().list.map(d => d.id), list = [];
  while (list.length < CT().perDay && pool.length) {
    const id = pool.splice(Math.floor(rnd() * pool.length), 1)[0], d = ctDef(id);
    const ct = { id, n: d.n[tier], have: 0, claimed: false };
    if (id === 'ore') { if (!ores.length) continue; ct.x = ores[Math.floor(rnd() * ores.length)]; }
    if (id === 'foeType') { if (!foes.length) continue; ct.x = foes[Math.floor(rnd() * foes.length)]; }
    list.push(ct);
  }
  S.contracts = { day, tier, list, bonus: false };
}
const ctName = ct => {
  const d = ctDef(ct.id);
  if (ct.id === 'ore') return d.text(ct.n, C.BLOCKS[ct.x].label);
  if (ct.id === 'foeType') return d.text(ct.n, C.FOES[ct.x].name + (ct.n > 1 ? 's' : ''));
  return d.text(ct.n);
};
const ctReward = ct => { const d = ctDef(ct.id); return { coins: Math.round(d.coins * Math.pow(CT().tierMult, S.contracts.tier)), flux: d.flux }; };
const ctBonus = () => ({ coins: Math.round(CT().bonus.coins * Math.pow(CT().tierMult, S.contracts.tier)), flux: CT().bonus.flux });
const contractsReady = () => !!S.contracts && (S.contracts.list.some(ct => !ct.claimed && ct.have >= ct.n) || (!S.contracts.bonus && S.contracts.list.every(ct => ct.claimed)));

function contractEvent(kind, amount = 1, extra) {
  if (!S.contracts || S.contracts.day !== todayKey()) rollContracts();
  for (const ct of S.contracts.list) {
    if (ct.claimed || ct.have >= ct.n) continue;
    let hit = false;
    if (ct.id === kind && ct.id !== 'ore' && ct.id !== 'depth') hit = true;
    if (ct.id === 'ore' && kind === 'ore' && extra === ct.x) hit = true;
    if (ct.id === 'foeType' && kind === 'foes' && extra === ct.x) hit = true;
    if (ct.id === 'depth' && kind === 'depth') { ct.have = Math.max(ct.have, amount); }
    else if (hit) ct.have = Math.min(ct.n, ct.have + amount);
    if (ct.have >= ct.n) {
      ct.have = ct.n; sfx('ding');
      toast('Contract done', ctName(ct) + '. Claim the reward at the board in town.');
    }
  }
}
function claimContract(k) {
  if (townSpot() !== 'board') return;
  const ct = S.contracts.list[k];
  if (!ct || ct.claimed || ct.have < ct.n) return;
  const rw = ctReward(ct);
  ct.claimed = true; S.coins += rw.coins; S.flux += rw.flux; sfx('buy');
  toast(null, 'Contract claimed: +' + fmt(rw.coins) + ' coins, +' + rw.flux + ' Flux.');
  save();
}
function claimBonus() {
  if (townSpot() !== 'board' || S.contracts.bonus || !S.contracts.list.every(ct => ct.claimed)) return;
  const b = ctBonus();
  S.contracts.bonus = true; S.coins += b.coins; S.flux += b.flux; sfx('relic');
  toast('All three done!', 'Daily bonus: +' + fmt(b.coins) + ' coins, +' + b.flux + ' Flux. New contracts tomorrow.');
  save();
}
function untilMidnight() {
  const now = new Date(), m = new Date(now); m.setHours(24, 0, 0, 0);
  const min = Math.ceil((m - now) / 60000);
  return Math.floor(min / 60) + ' h ' + (min % 60) + ' min';
}

// The board's pop-up
PANEL.board = () => {
  rollContracts();
  const CS_ = S.contracts, done = CS_.list.filter(ct => ct.claimed).length;
  let h = '<p class="note">Three new contracts every day. Progress counts in any cave or town; come back here to claim the reward. New contracts in <b>' + untilMidnight() + '</b>.</p><div class="rows one">';
  CS_.list.forEach((ct, k) => {
    const rw = ctReward(ct), ready = !ct.claimed && ct.have >= ct.n;
    const btn = ct.claimed ? '<button type="button" disabled>Claimed</button>' : `<button type="button" data-act="claim" data-id="${k}" ${ready ? '' : 'disabled'}>${ready ? 'Claim' : ct.have + '/' + ct.n}</button>`;
    h += `<div class="row${ready ? ' here' : ''}"><div><small>Contract ${k + 1} · ${fmt(rw.coins)} coins + ${rw.flux} Flux</small><strong>${ctName(ct)}</strong><div class="pbar"><i style="width:${Math.round(ct.have / ct.n * 100)}%"></i></div></div>${btn}</div>`;
  });
  const b = ctBonus(), all = CS_.list.every(ct => ct.claimed);
  h += `<div class="row"><div><small>Daily bonus · finish all three</small><strong>${fmt(b.coins)} coins + ${b.flux} Flux</strong><span>${done}/${CS_.list.length} claimed</span></div>${CS_.bonus ? '<button type="button" disabled>Claimed</button>' : `<button type="button" data-act="bonus" ${all ? '' : 'disabled'}>Claim bonus</button>`}</div></div>`;
  return ['Contracts board', done + '/' + CS_.list.length + ' today', h];
};
PANEL_NAME.board = () => 'Contracts board';
$('popBody').addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  if (b.dataset.act === 'claim') { claimContract(+b.dataset.id); updateUI(); }
  if (b.dataset.act === 'bonus') { claimBonus(); updateUI(); }
});
