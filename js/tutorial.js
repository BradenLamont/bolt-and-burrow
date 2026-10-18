// Bolt & Burrow — the first-run tutorial in Cave 1. Scout, a little guide drone, flies beside your mech,
// points at things and talks you through moving, digging, ore, fighting and sending ore home, then flies
// back to the train. S.tut is the current step (null = not started yet, 'done' = finished or skipped).
'use strict';

const touchHint = (keys, touch) => (touchUI ? touch : keys);
const TUT = [
  { id: 'move', text: () => 'Hi, I\'m Scout! I\'ll show you around. ' + touchHint('Walk up into the cave with WASD or the arrow keys.', 'Drag anywhere on the cave to walk. Head up into the cave.'),
    done: () => pRow() >= BASE_ROWS + 1 },
  { id: 'dig', text: () => 'Push into rock to dig it. Dig ' + C.TUTORIAL.digBlocks + ' blocks. Every block pays a few coins.',
    done: () => tutDug >= C.TUTORIAL.digBlocks },
  { id: 'ore', text: () => 'See the coloured pixels on some blocks? That\'s ore, one piece per pixel. Dig one out and your magnet pulls the pieces in.',
    target: () => nearestOre(), done: () => cargoCount() > 0 },
  { id: 'fight', text: () => 'A grub! Face it and ' + touchHint('press F to swing your wrench (or click on it).', 'tap Attack to swing your wrench.'),
    setup: () => spawnTutGrub(), target: () => (tutGrub && !tutGrub.dead ? { x: tutGrub.x, y: tutGrub.y } : null),
    done: () => tutGrub && tutGrub.dead },
  { id: 'home', text: () => 'Ore only counts once it\'s home. Head back to the entrance: the outpost there sends your cargo along to the train.',
    target: () => ({ x: C.SPAWN.col + 0.5, y: C.SPAWN.row + 0.5 }), done: () => station() === 'entrance' },
  { id: 'end', text: () => 'That\'s the basics! Deeper in, dig the dashed conveyor path and build the halfway outpost. The Ember Idol waits at the far end. I\'ll be on the train. Good luck!',
    done: () => tutT > 9 },
];
let tutDug = 0, tutT = 0, tutGrub = null, tutStarted = -1, tutSaid = -1;
const scout = { x: 0, y: 0, leaving: 0, shown: false };
const tutActive = () => S.cave === 0 && typeof S.tut === 'number' && S.tut < TUT.length;

function nearestOre() {
  let best = null, bd = 99;
  for (let r = Math.max(0, pRow() - 8); r <= Math.min(ROWS - 1, pRow() + 8); r++) for (let c = 1; c < COLS - 1; c++) {
    const i = idx(c, r);
    if (!ORES.has(T[i]) || !SEEN[i]) continue;
    const d = Math.hypot(c + 0.5 - P.x, r + 0.5 - P.y);
    if (d < bd) { bd = d; best = { x: c + 0.5, y: r + 0.5 }; }
  }
  return best;
}
// The fight step brings in one grub close by (in floor you've already dug)
function spawnTutGrub() {
  tutGrub = null;
  const spots = [];
  for (let r = pRow() - 5; r <= pRow() + 5; r++) for (let c = pCol() - 5; c <= pCol() + 5; c++) {
    const d = Math.hypot(c + 0.5 - P.x, r + 0.5 - P.y);
    if (d < 2 || d > 5 || at(c, r) !== null || onBelt(c, r)) continue;
    if (foeFree(c + 0.5, r + 0.5, C.FOES.grub.r) && lineOfSight(c + 0.5, r + 0.5, P.x, P.y)) spots.push([c, r, d]);
  }
  if (!spots.length) return false;
  spots.sort((a, b) => b[2] - a[2]);
  tutGrub = makeFoe('grub', spots[0][0] + 0.5, spots[0][1] + 0.5);
  tutGrub.hp = tutGrub.max = 6; foes.push(tutGrub); burst(tutGrub.x, tutGrub.y, '#c9b07a', 10);
  return true;
}
function startStep() {
  const st = TUT[S.tut];
  tutDug = 0; tutT = 0; tutStarted = S.tut;
  if (st.setup && !st.setup()) tutStarted = -1;   // no room yet: try again in a moment
  if (tutSaid !== S.tut) { tutSaid = S.tut; toast('Scout', st.text()); }
}
function updateTutorial(dt) {
  if (S.cave === 0 && S.tut == null && !S.caves[0].relicDone) { S.tut = 0; scout.x = P.x - 1; scout.y = P.y - 1; }
  // Scout flies off after the last step
  if (scout.leaving > 0) { scout.leaving -= dt; scout.y -= dt * 4; scout.x += dt * 2; }
  if (!tutActive()) return;
  if (!scout.shown) { scout.shown = true; scout.x = P.x - 1.2; scout.y = P.y - 0.8; }
  if (tutStarted !== S.tut) { tutT += dt; if (tutT > 0.8 || S.tut === 0) startStep(); }
  tutT += dt;
  const st = TUT[S.tut];
  if (tutStarted === S.tut && st.done()) {
    S.tut++; tutStarted = -1; tutT = 0; sfx('ready');
    if (S.tut >= TUT.length) endTutorial(false);
  }
  // Scout hovers beside you, leaning toward whatever it's pointing at
  const tg = st.target && st.target();
  const hx = P.x - 0.9 + (tg ? Math.sign(tg.x - P.x) * 0.4 : 0), hy = P.y + 1.1;
  scout.x += (hx - scout.x) * Math.min(1, dt * 3); scout.y += (hy - scout.y) * Math.min(1, dt * 3);
}
function tutDigged() { if (tutActive()) tutDug++; }
function endTutorial(skipped) {
  S.tut = 'done'; scout.leaving = 1.5; tutGrub = null;
  // Scout joins the crew as its first bot, with a couple of chips for the job board
  if (!crewCount() || !crew().bots.some(b => b.type === 'scout')) { addBot('scout'); giveChip('scout', 1); giveChip('flux', 1); }
  save();
  setTimeout(() => toast('Scout joined your crew!', 'I\'m your first nano-bot. I\'ll fly with you and light up the rock. Visit the Computer car on the train and I\'ll show you the job board.'), skipped ? 0 : 7500);
  updateUI();
}
function drawTutorial(X, Y, s, W) {
  if (S.cave !== 0 || (!tutActive() && scout.leaving <= 0)) return;
  const sx = X(scout.x), sy = Y(scout.y) - s * 0.9 + Math.sin(time * 4) * s * 0.06, R = s * 0.22;
  const st = tutActive() ? TUT[S.tut] : null, tg = st && st.target && st.target();
  // pointer: a dotted line from Scout and a bouncing chevron over the target
  if (tg) {
    const tx = X(tg.x), ty = Y(tg.y) - W - s * 0.55 - Math.abs(Math.sin(time * 4)) * s * 0.15;
    g.strokeStyle = 'rgba(134,207,220,.45)'; g.lineWidth = 1.5; g.setLineDash([3, 5]);
    g.beginPath(); g.moveTo(sx, sy); g.lineTo(tx, ty); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#86cfdc'; g.beginPath(); g.moveTo(tx - s * 0.16, ty - s * 0.1); g.lineTo(tx + s * 0.16, ty - s * 0.1); g.lineTo(tx, ty + s * 0.1); g.closePath(); g.fill();
  }
  // Scout: a round drone with a rotor ring, a mono-eye and a little antenna light
  g.fillStyle = 'rgba(134,207,220,.15)'; g.beginPath(); g.arc(sx, sy, R * 2.4, 0, 7); g.fill();
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(sx, sy + s * 0.9, R, R * 0.3, 0, 0, 7); g.fill();
  g.strokeStyle = 'rgba(200,210,215,.7)'; g.lineWidth = 2; g.beginPath(); g.ellipse(sx, sy - R * 0.9, R * 1.5, R * 0.3, 0, 0, 7); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.5)'; g.beginPath(); const a = time * 30; g.moveTo(sx + Math.cos(a) * R * 1.4, sy - R * 0.9 + Math.sin(a) * R * 0.25); g.lineTo(sx - Math.cos(a) * R * 1.4, sy - R * 0.9 - Math.sin(a) * R * 0.25); g.stroke();
  g.fillStyle = '#c9d3d6'; g.beginPath(); g.arc(sx, sy, R, 0, 7); g.fill();
  g.fillStyle = '#d9813b'; g.fillRect(sx - R, sy + R * 0.2, R * 2, R * 0.25);
  g.fillStyle = '#16110d'; g.beginPath(); g.arc(sx, sy - R * 0.1, R * 0.45, 0, 7); g.fill();
  const look = tg ? Math.max(-1, Math.min(1, (tg.x - scout.x) / 3)) : Math.sin(time * 0.7);
  g.fillStyle = '#86cfdc'; g.beginPath(); g.arc(sx + look * R * 0.15, sy - R * 0.1, R * 0.22, 0, 7); g.fill();
  g.strokeStyle = '#5D646E'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(sx, sy - R); g.lineTo(sx, sy - R * 1.6); g.stroke();
  g.fillStyle = Math.sin(time * 6) > 0 ? '#f2c94c' : '#7a6a30'; g.beginPath(); g.arc(sx, sy - R * 1.65, R * 0.15, 0, 7); g.fill();
}
$('skipTut').addEventListener('click', () => endTutorial(true));
