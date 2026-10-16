// Bolt & Burrow — sound effects, made on the fly with the Web Audio API (no sound files).
// The browser only allows sound after you press a key or tap, so the audio starts then.
// sfx('name') plays one; the mute button turns them all off (remembered in this browser).
'use strict';

let actx = null, master = null;
let muted = false;
try { muted = localStorage.getItem('bolt-burrow-sound') === 'off'; } catch (e) {}
function startAudio() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  actx = new AC(); master = actx.createGain(); master.gain.value = 0.35; master.connect(actx.destination);
}
addEventListener('keydown', startAudio);
addEventListener('pointerdown', startAudio);

// A tone that can slide from one pitch to another
function tone(freq, dur, type = 'square', vol = 0.3, to = freq, delay = 0) {
  const t0 = actx.currentTime + delay, o = actx.createOscillator(), gn = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  gn.gain.setValueAtTime(vol, t0); gn.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(gn); gn.connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
}
// A burst of filtered noise (digging, rumbles, splashes, explosions)
function noise(dur, vol = 0.3, freq = 1200, q = 1, delay = 0) {
  const t0 = actx.currentTime + delay, n = Math.floor(actx.sampleRate * dur), buf = actx.createBuffer(1, n, actx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = actx.createBufferSource(), f = actx.createBiquadFilter(), gn = actx.createGain();
  src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  gn.gain.setValueAtTime(vol, t0); gn.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(f); f.connect(gn); gn.connect(master); src.start(t0);
}

const SFX = {
  dig:    () => noise(0.05, 0.12, 900 + Math.random() * 600, 2),
  break:  () => { noise(0.12, 0.25, 500, 1); tone(140, 0.08, 'triangle', 0.15, 80); },
  ore:    () => { tone(660, 0.07, 'square', 0.12); tone(990, 0.09, 'square', 0.1, 990, 0.06); },
  coin:   () => { tone(1320, 0.06, 'square', 0.08); tone(1760, 0.1, 'square', 0.08, 1760, 0.05); },
  sand:   () => noise(0.2, 0.12, 2500, 0.6),
  roll:   () => noise(0.25, 0.2, 180, 1.5),
  splash: () => { noise(0.4, 0.25, 700, 0.5); tone(300, 0.25, 'sine', 0.1, 120); },
  hiss:   () => noise(0.8, 0.12, 5000, 0.4),
  boom:   () => { noise(0.7, 0.6, 120, 0.7); tone(90, 0.5, 'sine', 0.4, 30); },
  rumble: () => noise(0.6, 0.4, 90, 0.8),
  hit:    () => { tone(220, 0.18, 'sawtooth', 0.2, 90); noise(0.15, 0.2, 400); },
  shield: () => { tone(500, 0.25, 'sine', 0.2, 1200); tone(800, 0.25, 'sine', 0.12, 1600, 0.05); },
  dash:   () => { noise(0.18, 0.2, 3000, 0.7); tone(300, 0.15, 'triangle', 0.15, 900); },
  skill:  () => { tone(200, 0.3, 'sawtooth', 0.15, 600); },
  pulse:  () => { tone(1200, 0.5, 'sine', 0.15, 300); },
  ready:  () => { tone(880, 0.08, 'triangle', 0.12); tone(1320, 0.12, 'triangle', 0.12, 1320, 0.08); },
  tool:   () => { tone(260, 0.08, 'square', 0.12, 200); noise(0.08, 0.15, 1500); },
  buy:    () => { tone(784, 0.08, 'square', 0.1); tone(1047, 0.14, 'square', 0.1, 1047, 0.08); },
  sell:   () => { tone(1047, 0.06, 'square', 0.08); tone(1568, 0.1, 'square', 0.08, 1568, 0.05); },
  door:   () => { noise(0.12, 0.15, 600, 1); tone(180, 0.1, 'triangle', 0.12, 140); },
  click:  () => tone(1000, 0.03, 'square', 0.06),
  ding:   () => { tone(1568, 0.25, 'sine', 0.12); },
  doors:  () => { noise(0.25, 0.25, 300, 1.2); tone(90, 0.2, 'square', 0.1, 70, 0.15); },
  crane:  () => { tone(140, 1.2, 'sawtooth', 0.06, 260); noise(1.2, 0.05, 900, 3); },
  drill:  () => { noise(0.35, 0.18, 220 + Math.random() * 120, 1); tone(70, 0.3, 'square', 0.05, 60); },
  arrive: () => { [784, 659, 988].forEach((f, k) => tone(f, 0.2, 'triangle', 0.12, f, k * 0.1)); },
  swing:  () => noise(0.12, 0.15, 2600, 0.8),
  hit2:   () => { noise(0.1, 0.3, 700, 1); tone(180, 0.08, 'square', 0.12, 110); },
  shoot:  () => { tone(900, 0.06, 'square', 0.08, 400); noise(0.05, 0.12, 3000, 1); },
  pull:   () => { tone(120, 0.35, 'sine', 0.2, 300); noise(0.3, 0.1, 400, 1); },
  pop:    () => { tone(500, 0.08, 'triangle', 0.12, 200); noise(0.08, 0.15, 1500, 1); },
  spit:   () => { noise(0.15, 0.12, 1800, 2); tone(300, 0.1, 'sine', 0.06, 500); },
  relic:  () => { [523, 659, 784, 1047].forEach((f, k) => tone(f, 0.25, 'triangle', 0.15, f, k * 0.12)); },
};
let lastDig = 0;
function sfx(name) {
  if (muted || !actx || actx.state !== 'running' || !SFX[name]) return;
  if (name === 'dig') { if (actx.currentTime - lastDig < 0.09) return; lastDig = actx.currentTime; }
  try { SFX[name](); } catch (e) {}
}
function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('bolt-burrow-sound', muted ? 'off' : 'on'); } catch (e) {}
  if (!muted) { startAudio(); setTimeout(() => sfx('click'), 30); }
}
