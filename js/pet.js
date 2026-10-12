// Bolt & Burrow — the pet. Pip the Mole digs his own burrow (drawn in the bottom-right
// panel), earns coins while you play and while you're away, and boosts your dig power.
'use strict';

const PET = { grid: [], c: 0, r: 0, prog: 0 };
const petFloats = [];
const petDigTime = () => C.PET.baseDig / (1 + C.PET.speedPerLevel * (S.pet - 1));
const petCoins = () => C.PET.baseCoins * (1 + 0.5 * (S.pet - 1));
const petRate = () => (S.pet ? petCoins() * (1 + C.PET.oreChance * (C.PET.oreMult - 1)) / petDigTime() : 0);
const trainCost = () => Math.round(C.PET.trainBase * Math.pow(C.PET.trainGrowth, S.pet - 1));

function regenPet() {
  PET.grid = Array.from({ length: C.PET.cols * C.PET.rows }, () => (Math.random() < C.PET.oreChance ? 'ore' : 'dirt'));
  PET.c = 0; PET.r = 0; PET.prog = 0;
}
function updatePet(dt) {
  if (!S.pet) return;
  PET.prog += dt;
  if (PET.prog < petDigTime()) return;
  PET.prog = 0;
  const i = PET.r * C.PET.cols + PET.c, t = PET.grid[i];
  PET.grid[i] = null;
  const v = Math.round(petCoins() * (t === 'ore' ? C.PET.oreMult : 1));
  S.coins += v;
  petFloats.push({ c: PET.c + 0.5, r: PET.r + 0.5, text: '+' + v, ore: t === 'ore', life: 1 });
  PET.r++;
  if (PET.r >= C.PET.rows) { PET.r = 0; PET.c++; if (PET.c >= C.PET.cols) regenPet(); }
}
