// Bolt & Burrow — controls. Keyboard (arrows / WASD, E, Space/Q for the skill, 1–4 for tools, Esc for the menu) and a touch joystick.
// Directions are screen directions: 'up' means up the screen, which is deeper into the cave.
'use strict';

const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowDown: 'down', KeyS: 'down', ArrowUp: 'up', KeyW: 'up' };
const held = [];
let joyH = null, joyV = null;
const lastOf = (a, b) => { for (let i = held.length - 1; i >= 0; i--) if (held[i] === a || held[i] === b) return held[i]; return null; };
const horizDir = () => joyH || lastOf('left', 'right');
const vertDir = () => joyV || lastOf('up', 'down');

addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('textarea, input')) return;   // typing a backup code
  // Esc / P: the pause menu (or close a pop-up). E also closes a pop-up. M: sound on/off
  if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); if (!e.repeat) { if (popup) closePopup(); else toggleMenu(); } return; }
  if (e.code === 'KeyM' && !e.repeat) { toggleMute(); renderMenu(); updateUI(); }
  if (popup && e.code === 'KeyE') { e.preventDefault(); if (!e.repeat) closePopup(); return; }
  if (paused()) return;                                                  // menus are open: the game ignores keys
  if (trip) { if (!e.repeat) skipTrip(); return; }                      // any key skips the train trip
  if (e.code === C.LINE_TEST_KEY && onTownMap()) lineTestPress();
  const d = KEYMAP[e.code];
  if (d) { e.preventDefault(); if (!held.includes(d)) held.push(d); }
  if ((e.code === 'Space' || e.code === 'KeyQ') && !e.repeat) { e.preventDefault(); useSkill(); updateUI(); }
  const tool = TOOL_IDS.find(id => 'Digit' + C.TOOLS[id].key === e.code);
  if (tool && !e.repeat) { useTool(tool); updateUI(); }
  if ((e.code === 'KeyF' || e.code === 'KeyJ') && !e.repeat) { attackHeld = true; attack(); }
  if ((e.code === 'KeyE' || e.code === 'Enter') && !e.repeat && !(e.target.closest && e.target.closest('button'))) { e.preventDefault(); runAction(); }
});
addEventListener('keyup', e => { if (e.code === 'KeyF' || e.code === 'KeyJ') attackHeld = false; const d = KEYMAP[e.code]; if (d) { const i = held.indexOf(d); if (i >= 0) held.splice(i, 1); } });
addEventListener('blur', () => { held.length = 0; joyH = joyV = null; attackHeld = false; });

// Joystick: touch anywhere on the cave and it appears under your thumb. Drag to move;
// the direction snaps to 8 ways. Lift your thumb to stop.
const JOY_RADIUS = 46, JOY_DEADZONE = 12;
const joy = $('joy'), knob = $('joyKnob');
let touch = null;
// A mouse click on the cave aims the weapon arm at that spot and fires (hold to keep firing)
function mouseToWorld(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left + camX) / CELL, y: ROWS - (e.clientY - r.top + camY) / CELL };
}
cv.addEventListener('pointerdown', e => {
  if (trip) { skipTrip(); return; }
  if (e.pointerType === 'mouse') {
    if (e.button !== 0 || inTown()) return;
    const w = mouseToWorld(e); aimAt(w.x, w.y); attackHeld = true; attack();
    cv.setPointerCapture(e.pointerId); return;
  }
  const r = stage.getBoundingClientRect();
  touch = { id: e.pointerId, ox: e.clientX, oy: e.clientY };
  cv.setPointerCapture(e.pointerId);
  joy.style.left = (e.clientX - r.left) + 'px'; joy.style.top = (e.clientY - r.top) + 'px';
  knob.style.transform = 'translate(-50%, -50%)';
  joy.hidden = false;
});
cv.addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse') { if (attackHeld) { const w = mouseToWorld(e); aimAt(w.x, w.y); } return; }
  if (!touch || e.pointerId !== touch.id) return;
  let dx = e.clientX - touch.ox, dy = e.clientY - touch.oy;
  const len = Math.hypot(dx, dy);
  if (len > JOY_RADIUS) { dx = dx / len * JOY_RADIUS; dy = dy / len * JOY_RADIUS; }
  knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  if (len < JOY_DEADZONE) { joyH = joyV = null; return; }
  const sector = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)); // -4..4, 0 = right
  const dirs = { 0: ['right', null], 1: ['right', 'down'], 2: [null, 'down'], 3: ['left', 'down'], 4: ['left', null], '-4': ['left', null], '-3': ['left', 'up'], '-2': [null, 'up'], '-1': ['right', 'up'] };
  [joyH, joyV] = dirs[sector];
});
cv.addEventListener('pointerup', e => { if (e.pointerType === 'mouse') attackHeld = false; });
const endTouch = e => { if (!touch || e.pointerId !== touch.id) return; touch = null; joyH = joyV = null; joy.hidden = true; };
cv.addEventListener('pointerup', endTouch);
cv.addEventListener('pointercancel', endTouch);

// Test unlock for the train line: press T five times quickly in town
let lineTaps = [];
function lineTestPress() {
  const now = performance.now();
  lineTaps = lineTaps.filter(t => now - t < 3000); lineTaps.push(now);
  if (lineTaps.length >= 5 && !lineIsOpen()) { S.lineOpen = true; lineTaps = []; save(); toast('Test mode', 'The train line to ' + C.TOWNS[1].name + ' is open. Board at the Engine car.'); }
}
