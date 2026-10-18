// Bolt & Burrow — the pause menu (Esc, P or the ⏸ button), full screen, and the nano-bot box.
// Tabs: Mech & cargo, Bots (the crew's collection log), Train cars (a read-only look; use a car at its door), Map, Settings & hints.
// The game is paused while the menu is open. The forge and nano-bots keep working, as they do while you're away.
'use strict';

let menuTab = 'mech', trainTab = 'storage', resetArmed = 0;
const ROMAN = ['I', 'II', 'III'];

function openMenu(tab) {
  if (popup) closePopup();
  menuOpen = true; held.length = 0; joyH = joyV = null; attackHeld = false;
  if (tab) menuTab = tab;
  $('menu').hidden = false; sfx('click');
  renderMenu();
  $('menu').querySelector('.resume').focus({ preventScroll: true });
}
function closeMenu() {
  if (!menuOpen) return;
  menuOpen = false; $('menu').hidden = true; backupCode = ''; sfx('click');
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  updateUI();
}
const toggleMenu = () => (menuOpen ? closeMenu() : openMenu());

// ---------- Tabs ----------
const row = (small, strong, span) => `<div class="row"><div><small>${small}</small><strong>${strong}</strong>${span ? '<span>' + span + '</span>' : ''}</div></div>`;
function mechTab() {
  let h = '<small class="sub">Your mech</small><div class="rows">';
  for (const sl of SLOTS) h += row(C.PARTS[sl].label + ' · tier ' + (S.tiers[sl] + 1) + '/' + C.PARTS[sl].tiers.length, part(sl).name, C.PARTS[sl].fmt(part(sl).val));
  const W = C.WEAPONS[S.weapon];
  h += row('Weapon arm · ' + W.cls, W.name + ' Mk ' + ROMAN[weaponMk(S.weapon) - 1], W.text);
  h += row('Hull', Math.ceil(Math.max(0, P.hull)) + ' / ' + hullMax(), 'Battery ' + Math.ceil(Math.max(0, P.battery)) + ' / ' + batteryMax() + ' · magnet ' + magnetRange().toFixed(1) + ' blocks');
  h += '</div>';
  const mods = S.grid.map(p => C.MODS[p.id].name + ' Lv ' + modLevel(p.id));
  const core = Object.keys(C.CORE).filter(id => coreLevel(id)).map(id => C.CORE[id].name + ' ' + coreLevel(id) + ' (' + C.CORE[id].unit(coreVal(id)) + ')');
  h += '<small class="sub">Upgrades</small><div class="rows">' +
    row('Computer mods (Lab car)', mods.length ? mods.join(', ') : 'None installed') +
    row('Flux upgrades (Computer car)', core.length ? core.join(', ') : 'None yet') +
    row('Tool belt · ' + beltTypes().length + '/' + beltSlots() + ' slots', beltTypes().length ? beltTypes().map(id => C.TOOLS[id].name + ' ×' + S.tools[id]).join(', ') : 'Empty', 'Buy tools at Pip\'s counter.') +
    row('Nano-bot crew', crewCount() ? crewCount() + ' bot' + (crewCount() > 1 ? 's' : '') + ' · ' + equipped().length + ' equipped · ' + fmt(crewFluxPerMin()) + ' Flux a minute' : 'None yet', crewCount() ? 'Base jobs keep working while you\'re away (up to ' + offlineCap() + ' h). See the Bots tab.' : 'Scout joins your crew when you finish the Cave 1 tutorial.') + '</div>';
  h += '<small class="sub">Cargo · ' + cargoCount() + '/' + cargoMax() + '</small>' + cargoList();
  return h;
}
const TRAIN_TABS = ['storage', 'forge', 'lab', 'computer'];
function trainTabView() {
  const name = PANEL_NAME[trainTab]();
  return '<div class="subtabs">' + TRAIN_TABS.map(t => `<button type="button" data-act="traintab" data-id="${t}" class="${t === trainTab ? 'on' : ''}">${PANEL_NAME[t]()}</button>`).join('') + '</div>' +
    `<p class="note">A look from anywhere. To use it, stand at the <b>${name}</b>'s door in town and press E.</p><div class="readonly view">${PANEL[trainTab]()[2]}</div>`;
}
function caveList() {
  return '<div class="rows one">' + C.CAVES.map((cv, k) => {
    if (caveTown(k) !== S.town) return '';
    const cs = S.caves[k], g = TOWN().gates.indexOf(k), open = g >= 0 && gateOpen(g);
    const status = cs.relicDone ? 'Relic brought home' : open ? (cs.outposts ? 'Halfway outpost built' : 'No halfway outpost yet') : 'Gate sealed';
    const boss = cv.boss || cv.miniBoss ? (cs.bossDone ? ' · ' + C.FOES[cv.boss || cv.miniBoss].name + ' beaten' : '') : '';
    return row(caveLabel(k) + (k === S.cave ? ' · you are here' : ''), cv.name, status + boss);
  }).join('') + '</div>';
}
function mapTab() {
  if (inTown()) return '<p class="note">You\'re in <b>' + TOWN().name + '</b>. Enter a cave to see its map here.</p><small class="sub">Caves</small>' + caveList();
  const key = (col, t) => `<span><i style="background:${col}"></i>${t}</span>`;
  return `<div class="mapwrap"><canvas id="bigmap" aria-label="Map of everything you've explored in this cave"></canvas>
    <div class="maplegend"><strong>${caveLabel(S.cave)} · ${cave().name}</strong><div class="k">
      ${key('#9fe3f0', 'You')}${key('#d9813b', 'Conveyor and outposts')}${key('#9a7a58', 'Open tunnel')}${key('#000', 'Chasm')}${key('#a77d48', 'Bridge')}${key('#3d6f96', 'Water')}
      ${key('#8c8286', 'Granite')}${key('#3a2d48', 'Obsidian')}${key('#f2c94c', 'Cache (scanned)')}${key('#9fe3f0', 'Key cache')}${key('#c9a2ff', 'Relic')}</div>
      <p class="note">Fast travel from any outpost: stand on it and open it with E.</p>
      <small class="sub">Caves</small>${caveList()}</div></div>`;
}
function settingsTab() {
  const seg = (act, opts, cur) => '<div class="seg">' + opts.map(([id, label]) => `<button type="button" data-act="${act}" data-id="${id}" class="${id === cur ? 'on' : ''}">${label}</button>`).join('') + '</div>';
  const fsOn = !!(document.fullscreenElement || document.webkitFullscreenElement);
  let h = '<small class="sub">Sound</small><div class="rows">' +
    `<div class="row"><div><small>Sound effects · M</small>${seg('mute', [['on', 'On'], ['off', 'Off']], muted ? 'off' : 'on')}</div></div>` +
    `<div class="row"><div><small>Volume</small><input type="range" id="vol" min="0" max="1" step="0.05" value="${volume}" aria-label="Volume"></div></div></div>`;
  h += '<small class="sub">Screen</small><div class="rows">' +
    `<div class="row"><div><small>Zoom in the caves</small>${seg('zoom', [['close', 'Close'], ['normal', 'Normal'], ['far', 'Far'], ['farther', 'Farther']], zoom)}<span>Shows about ${ZOOMS[zoom]} rows of the cave. The town and shop always fit the screen.</span></div></div>` +
    (fsOK ? `<div class="row"><div><small>Full screen</small><span>Hides the browser's bars${touchUI ? ' and turns your phone sideways where it can' : ''}.</span></div><button type="button" data-act="fs">${fsOn ? 'Leave full screen' : 'Go full screen'}</button></div>` : '') +
    `<div class="row"><div><small>Nano-bot box</small>${seg('botbox', [['open', 'Shown'], ['mini', 'Shrunk']], $('botBox').classList.contains('mini') ? 'mini' : 'open')}<span>Shrunk, it shows just your Flux. In town it always shrinks so your train stays in view.</span></div></div></div>`;
  h += '<small class="sub">Controls</small>' + (touchUI
    ? '<dl class="keylist"><dt>Drag</dt><dd>Move (the joystick appears under your thumb); push into blocks to dig</dd><dt>Buttons</dt><dd>Attack, skill, tools, recall, and Open / Board at stations</dd><dt>&#x23F8;</dt><dd>This menu</dd></dl>'
    : '<dl class="keylist"><dt>Arrows / WASD</dt><dd>Move; push into blocks to dig; up goes deeper</dd><dt>E</dt><dd>Open the car, stand, counter or outpost you\'re at; bridge pads; board the train or the crawler</dd><dt>F / J or click</dt><dd>Attack (click aims)</dd><dt>Space / Q</dt><dd>Active skill</dd><dt>1–4</dt><dd>Tools on your belt</dd><dt>Esc / P</dt><dd>This menu (or close a pop-up)</dd><dt>M</dt><dd>Sound on / off</dd></dl>');
  h += '<small class="sub">Save backup</small>' + backupView();
  h += `<small class="sub">Start over</small><div class="row"><div><span>Wipes all progress in this browser. Make a backup first if you might want it back.</span></div><button type="button" data-act="reset" class="${resetArmed ? 'armed' : ''}">${resetArmed ? 'Click again to reset' : 'Reset progress'}</button></div>`;
  const log = (S.hintLog || []).slice().reverse();
  h += '<small class="sub">Hints you\'ve seen</small><div class="hintlog">' + (log.length ? log.map(([t, m]) => `<p><b>${t}</b> · ${m}</p>`).join('') : '<p>First-time hints show here once you\'ve seen them.</p>') + '</div>';
  return h;
}
const TABS = { mech: mechTab, train: trainTabView, map: mapTab, settings: settingsTab };
function renderMenu() {
  if (!menuOpen) return;
  document.querySelectorAll('#menuTabs [data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === menuTab));
  $('menuBody').innerHTML = TABS[menuTab]();
  if (menuTab === 'map' && !inTown()) {
    const c = $('bigmap'), m = Math.max(3, Math.min(8, Math.floor(Math.min(560, innerHeight * 0.6) / ROWS)));
    c.width = COLS * m; c.height = (ROWS - 1) * m;
    drawCaveMap(c.getContext('2d'), m, c);
  }
}
$('menuTabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { menuTab = b.dataset.tab; sfx('click'); renderMenu(); } });
$('menu').addEventListener('click', e => { if (e.target === $('menu') || e.target.closest('[data-close]')) closeMenu(); });
$('menuBody').addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  const act = b.dataset.act, id = b.dataset.id;
  if (act === 'traintab') trainTab = id;
  if (act === 'mute' && (id === 'off') !== muted) toggleMute();
  if (act === 'zoom') { zoom = id; try { localStorage.setItem('bolt-burrow-zoom', id); } catch (e) {} resize(); [camX, camY] = cameraTarget(); }
  if (act === 'fs') toggleFullscreen();
  if (act === 'botbox') setBotBox(id === 'mini');
  if (act === 'mkcode') { save(); backupCode = encodeSave(); }
  if (act === 'dlsave') {
    save();
    const a = document.createElement('a'), d = new Date();
    a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: 'application/json' }));
    a.download = 'bolt-burrow-save-' + d.toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
  }
  if (act === 'loadsave') return loadSaveText($('importCode').value);
  if (act === 'reset') {
    if (!resetArmed) { resetArmed = setTimeout(() => { resetArmed = 0; renderMenu(); }, 3000); }
    else { clearTimeout(resetArmed); resetArmed = 0; resetProgress(); closeMenu(); return; }
  }
  renderMenu(); updateUI();
});
$('menuBody').addEventListener('input', e => { if (e.target.id === 'vol') setVolume(+e.target.value); });
$('menuBody').addEventListener('change', e => {
  if (e.target.id === 'vol') sfx('ding');
  if (e.target.id === 'saveFile' && e.target.files[0]) e.target.files[0].text().then(loadSaveText);
});
$('pauseBtn').addEventListener('click', () => { toggleMenu(); });
// Switching tabs or windows opens the pause menu, so nothing can hit you while you're away
const autoPause = () => { if (gameReady && !paused()) openMenu(); };
document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
addEventListener('blur', autoPause);

// ---------- Full screen (the browser's own; turns phones sideways where allowed) ----------
const fsOK = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
function toggleFullscreen() {
  const d = document, el = d.documentElement;
  if (d.fullscreenElement || d.webkitFullscreenElement) { (d.exitFullscreen || d.webkitExitFullscreen).call(d); return; }
  const r = (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
  const turn = () => { if (touchUI && screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); };
  if (r && r.then) r.then(turn).catch(() => toast(null, 'Full screen isn\'t allowed here.')); else turn();
}
$('fsBtn').hidden = !fsOK;
$('fsBtn').addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', () => { $('fsBtn').innerHTML = document.fullscreenElement ? '&#x2715;' : '&#x26F6;'; $('fsBtn').title = document.fullscreenElement ? 'Leave full screen' : 'Full screen'; renderMenu(); });

// ---------- Nano-bot box: tap its header to shrink it (remembered in this browser) ----------
function setBotBox(mini, init) {
  $('botBox').classList.toggle('mini', mini);
  $('botToggle').setAttribute('aria-expanded', !mini);
  if (init) return;
  try { localStorage.setItem('bolt-burrow-botbox', mini ? 'mini' : 'open'); } catch (e) {}
  updateUI();
}
{
  let pref = null;
  try { pref = localStorage.getItem('bolt-burrow-botbox'); } catch (e) {}
  setBotBox(pref ? pref === 'mini' : innerWidth < 720 || innerHeight < 520, true);   // phones start with it shrunk
}
$('botToggle').addEventListener('click', () => setBotBox(!$('botBox').classList.contains('mini')));
