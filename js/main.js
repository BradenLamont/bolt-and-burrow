// Bolt & Burrow — start-up and the main loop.
'use strict';

let prev = performance.now(), uiT = 0, saveT = 0;
function frame(now) {
  const dt = Math.max(0, Math.min(0.05, (now - prev) / 1000)); prev = now; time += dt;
  if (!paused()) {          // a pop-up or the pause menu freezes the game (the forge and nano-bots keep working)
    if (!updateTrip(dt)) {   // riding the train: no walking until you arrive
      depositAndCharge(dt);
      updatePlayer(dt);
      updateRocks(dt);
      updateCombat(dt);
      updateDrops(dt);
    }
    updateSkills(dt);
    updateEffects(dt);
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

loadArea();
resizeMinimap();
placePlayerFromSave();
spawnFoes();
markSeen();
resize();
[camX, camY] = cameraTarget();

if (isNewGame) {
  setTimeout(() => toast('Bolt & Burrow', 'Welcome to town. Your train is your base. Walk up the path to the Cave 1 gate. Bring each cave\'s relic home to open the next gate.'), 300);
} else {
  const made = updateForge(), flux = offlineFlux();
  const parts = [];
  if (flux) parts.push('your nano-bot made ' + fmt(flux) + ' Flux');
  if (made) parts.push('the forge finished ' + made + ' job' + (made > 1 ? 's' : ''));
  if (parts.length) setTimeout(() => toast('Welcome back', 'While you were away, ' + parts.join(' and ') + '.'), 300);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
updateUI();
requestAnimationFrame(frame);
