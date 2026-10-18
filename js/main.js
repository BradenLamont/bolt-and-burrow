// Bolt & Burrow — start-up and the main loop.
'use strict';

let prev = performance.now(), uiT = 0, saveT = 0;
function frame(now) {
  const dt = Math.max(0, Math.min(0.05, (now - prev) / 1000)); prev = now; time += dt;
  if (!paused()) {          // a pop-up or the pause menu freezes the game (the forge and nano-bots keep working)
    if (!updateTrip(dt) && !updateCrawl(dt)) {   // riding the train or the crawler: no walking until you arrive
      depositAndCharge(dt);
      updatePlayer(dt);
      updateRocks(dt);
      updateCombat(dt);
      updateDrops(dt);
    }
    updateSkills(dt);
    updateEffects(dt);
    updateTutorial(dt);
  }
  updateBots(dt);
  if (updateForge()) updateUI();
  render(dt);
  renderMinimap(dt);
  renderBots();
  uiT += dt; if (uiT > 0.15) { uiT = 0; updateUI(); }
  saveT += dt; if (saveT > 5) { saveT = 0; save(); }
  requestAnimationFrame(frame);
}

rollContracts();
rollDaily();
loadArea();
resizeMinimap();
placePlayerFromSave();
spawnFoes();
markSeen();
resize();
[camX, camY] = cameraTarget();
gameReady = true;

if (isNewGame) {
  setTimeout(() => toast('Bolt & Burrow', 'Welcome to town. Your train is your base. Walk up the path to the Cave 1 gate. Bring each cave\'s relic home to open the next gate.'), 300);
} else {
  // while you were away: the forge finished its jobs, and the crew's base jobs kept looping
  const away = (Date.now() - S.last) / 1000, made = updateForge(), lines = crewAway(away);
  if (lines.some(([b]) => C.JOBS[b.job].base) && away > 60) {
    const h = Math.floor(away / 3600), m = Math.floor(away / 60) % 60;
    awayReport = { hours: (h ? h + ' h ' : '') + m + ' min', lines, forge: made };
    setTimeout(() => { if (!paused() && !trip) openPopup('away'); }, 400);
  } else if (made) setTimeout(() => toast('Welcome back', 'While you were away, the forge finished ' + made + ' job' + (made > 1 ? 's' : '') + '.'), 300);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
updateUI();
requestAnimationFrame(frame);
