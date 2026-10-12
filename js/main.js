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
  renderPet();
  uiT += dt; if (uiT > 0.15) { uiT = 0; updateUI(); }
  saveT += dt; if (saveT > 5) { saveT = 0; save(); }
  requestAnimationFrame(frame);
}

loadWorld();
placePlayerFromSave();
regenPet();
markSeen();
lastBiome = pRow() >= BASE_ROWS ? biomeAt(pRow()).id : null;
resize();
[camX, camY] = cameraTarget();

if (isNewGame) {
  setTimeout(() => toast('Bolt & Burrow', 'Dig up into the cave for ore and bring it back to base. Clear the middle column to build your first outpost at 25 m.'), 300);
} else if (S.pet) {
  const away = Math.min((Date.now() - S.last) / 1000, C.PET.offlineCapHours * 3600);
  const gain = Math.floor(away * petRate());
  if (away > 30 && gain > 0) { S.coins += gain; setTimeout(() => toast('Welcome back', C.PET.name + ' dug up ' + fmt(gain) + ' coins while you were away.'), 300); }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
updateUI();
requestAnimationFrame(frame);
