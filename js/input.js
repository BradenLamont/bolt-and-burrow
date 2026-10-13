// Bolt & Burrow — controls. Keyboard (arrows / WASD, E, Space/Q for the skill, 1–4 for tools) and a touch joystick.
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
  const d = KEYMAP[e.code];
  if (d) { e.preventDefault(); if (!held.includes(d)) held.push(d); }
  if ((e.code === 'Space' || e.code === 'KeyQ') && !e.repeat) { e.preventDefault(); useSkill(); updateUI(); }
  const tool = TOOL_IDS.find(id => 'Digit' + C.TOOLS[id].key === e.code);
  if (tool && !e.repeat) { useTool(tool); updateUI(); }
  if ((e.code === 'KeyE' || e.code === 'Enter') && !e.repeat && !(e.target.closest && e.target.closest('button'))) { e.preventDefault(); runAction(); }
});
addEventListener('keyup', e => { const d = KEYMAP[e.code]; if (d) { const i = held.indexOf(d); if (i >= 0) held.splice(i, 1); } });
addEventListener('blur', () => { held.length = 0; joyH = joyV = null; });

// Joystick: touch anywhere on the cave and it appears under your thumb. Drag to move;
// the direction snaps to 8 ways. Lift your thumb to stop.
const JOY_RADIUS = 46, JOY_DEADZONE = 12;
const joy = $('joy'), knob = $('joyKnob');
let touch = null;
cv.addEventListener('pointerdown', e => {
  const r = stage.getBoundingClientRect();
  touch = { id: e.pointerId, ox: e.clientX, oy: e.clientY };
  cv.setPointerCapture(e.pointerId);
  joy.style.left = (e.clientX - r.left) + 'px'; joy.style.top = (e.clientY - r.top) + 'px';
  knob.style.transform = 'translate(-50%, -50%)';
  joy.hidden = false;
});
cv.addEventListener('pointermove', e => {
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
const endTouch = e => { if (!touch || e.pointerId !== touch.id) return; touch = null; joyH = joyV = null; joy.hidden = true; };
cv.addEventListener('pointerup', endTouch);
cv.addEventListener('pointercancel', endTouch);
