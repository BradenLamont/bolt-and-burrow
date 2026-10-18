// Bolt & Burrow — riding the train between towns.
// Boarding: the hold doors open, the crane lifts your mech (pilot and all) into the engine's hold,
// the pilot walks through to the cab, the crane folds and the doors close. Then a short drilling
// scene, and the same steps in reverse at the other town. Any key or tap skips it.
'use strict';

let trip = null;   // { stage, t, dest } while a trip is running
const BOARD = ['doors', 'lift', 'walk', 'close', 'travel', 'udoors', 'uwalk', 'ulift', 'uclose'];
const STAGE_LEN = { doors: 'doors', close: 'doors', udoors: 'doors', uclose: 'doors', lift: 'lift', ulift: 'lift', walk: 'walk', uwalk: 'walk', travel: 'travel' };
const stageTime = st => C.TRIP[STAGE_LEN[st]];
const otherTown = () => (S.town + 1) % C.TOWNS.length;

// Where the boarding happens, in town coordinates (the engine is parked on the tracks in row 0)
const ENGINE = () => C.TOWN.station.cars.find(c => c.id === 'engine');
const holdX = () => ENGINE().cols[0] + 1.6;             // middle of the mech hold
const boardSpot = () => ({ x: carDoor('engine') + 0.5, y: C.TOWN.station.platformRow + 0.5 });

function startTrip() {
  if (trip || !onTownMap()) return;
  if (!lineIsOpen()) return toast('Engine car', 'The line to ' + C.TOWNS[otherTown()].name + ' opens when you bring home the Core Heart.');
  trip = { stage: 'doors', t: 0, dest: otherTown() };
  P.x = boardSpot().x; P.y = boardSpot().y; P.dir = 'down'; P.digging = [];
  sfx('doors');
  save();
}
function nextStage() {
  const i = BOARD.indexOf(trip.stage);
  if (trip.stage === 'travel') arriveTown();
  if (i === BOARD.length - 1) { endTrip(); return; }
  trip.stage = BOARD[i + 1]; trip.t = 0;
  sfx({ lift: 'crane', ulift: 'crane', close: 'doors', udoors: 'doors', uclose: 'doors', travel: 'drill', walk: 'click', uwalk: 'click' }[trip.stage] || 'click');
}
function updateTrip(dt) {
  if (!trip) return false;
  trip.t += dt;
  if (trip.stage === 'travel' && Math.random() < dt * 4) sfx('drill');
  if (trip.t >= stageTime(trip.stage)) nextStage();
  return true;
}
// Switch to the other town, with the mech still in the hold
function arriveTown() {
  if (trip.arrived) return;
  trip.arrived = true;
  S.town = trip.dest; S.cave = -1;
  loadArea();
  const b = boardSpot();
  arrive(b.x, b.y, 'down');
  sfx('arrive');
}
function endTrip() {
  if (!trip) return;
  if (!trip.arrived) arriveTown();
  trip = null;
  const b = boardSpot(); P.x = b.x; P.y = b.y; lastCell = -1;
  toast(TOWN().name, S.town === 1 ? 'The old mining town. Its first gate leads to the Scrap Tunnels; each relic you bring home opens the next.' : 'Back home in Hollowmouth.');
  save(); updateUI();
}
function skipTrip() { if (trip) endTrip(); }

// ---------- What the animation shows right now ----------
const tripStage = () => (trip ? trip.stage : null);
const tripK = () => (trip ? Math.min(1, trip.t / stageTime(trip.stage)) : 0);
const ease = k => k * k * (3 - 2 * k);
// How far open the roof doors over the hold are (0 = shut)
function doorsOpen() {
  const st = tripStage(), k = ease(tripK());
  if (st === 'doors' || st === 'udoors') return k;
  if (st === 'close' || st === 'uclose') return 1 - k;
  return st === 'lift' || st === 'walk' || st === 'uwalk' || st === 'ulift' ? 1 : 0;
}
// The mech: in the hold (seen through its window), on the crane hook, or out on the platform
function mechState() {
  const st = tripStage();
  if (!st) return { where: 'out' };
  if (st === 'doors' || st === 'uclose') return { where: 'out' };
  if (st === 'lift' || st === 'ulift') {
    const k = ease(st === 'lift' ? tripK() : 1 - tripK()), b = boardSpot();
    return { where: 'hook', x: b.x + (holdX() - b.x) * k, y: b.y + (0.55 - b.y) * k, h: Math.sin(Math.PI * k) * 1.3 + k * 0.2 };
  }
  return { where: 'hold' };
}
// The pilot: in the mech, walking through the inside walkway (0 = hold, 1 = cab), or in the cab
function pilotState() {
  const st = tripStage();
  if (st === 'walk') return { where: 'walk', k: tripK() };
  if (st === 'uwalk') return { where: 'walk', k: 1 - tripK() };
  if (st === 'close' || st === 'travel' || st === 'udoors') return { where: 'cab' };
  return { where: 'mech' };
}
// The crane's hook: over the mech while it lifts, otherwise folded along the roof
function craneTarget() {
  const m = mechState();
  return m.where === 'hook' ? m : null;
}
const walkerHidden = () => !!trip && mechState().where !== 'out';
