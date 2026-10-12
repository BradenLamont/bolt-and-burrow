// Bolt & Burrow — start-up and the main loop.
'use strict';

let prev = performance.now(), uiT = 0, saveT = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - prev) / 1000); prev = now; time += dt;
  sellAndCharge(dt);
  updatePlayer(dt);
  updateRocks(dt);
  updatePet(dt);
  updateEffects(dt);
  render(dt);
  renderMinimap(dt);
  renderPet();
  uiT += dt; if (uiT > 0.15) { uiT = 0; updateUI(); }
  saveT += dt; if (saveT > 5) { saveT = 0; save(); }
  requestAnimationFrame(frame);
}

loadCave();
placePlayerFromSave();
regenPet();
markSeen();
resize();
[camX, camY] = cameraTarget();

if (isNewGame) {
  S.seenNotes.push(cave().id);
  setTimeout(() => toast('Bolt & Burrow', 'Dig up into the cave for ore and bring it back to base. Clear the middle column to build the outpost at 25 m. The relic at the end opens the next cave.'), 300);
} else if (migrated) {
  setTimeout(() => toast('Three caves', 'The cave is now three caves, each with its own relic. Your coins, parts and pet came with you.'), 300);
} else if (S.pet) {
  const away = Math.min((Date.now() - S.last) / 1000, C.PET.offlineCapHours * 3600);
  const gain = Math.floor(away * petRate());
  if (away > 30 && gain > 0) { S.coins += gain; setTimeout(() => toast('Welcome back', C.PET.name + ' dug up ' + fmt(gain) + ' coins while you were away.'), 300); }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
updateUI();
requestAnimationFrame(frame);
