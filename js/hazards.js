// Bolt & Burrow — hazards. Unstable rock (Basalt Deeps) caves in once enough of its
// sides are dug open: it shakes, then collapses, scattering rubble into nearby open
// cells and hurting the robot if it's close.
'use strict';

const wobble = new Map();   // cell index → seconds it has been shaking

function exposed(c, r) {
  let n = 0;
  for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!at(c + a, r + b)) n++;
  return n;
}
function updateRocks(dt) {
  const r0 = Math.max(BASE_ROWS, pRow() - 12), r1 = Math.min(ROWS - 2, pRow() + 12);
  for (let r = r0; r <= r1; r++) for (let c = 1; c < COLS - 1; c++) {
    const i = idx(c, r);
    if (T[i] !== 'loose') { wobble.delete(i); continue; }
    if (exposed(c, r) >= C.ROCK.exposedSides) {
      const w = (wobble.get(i) || 0) + dt;
      if (w >= C.ROCK.wobble) { wobble.delete(i); caveIn(c, r); } else wobble.set(i, w);
    } else wobble.delete(i);
  }
}
function caveIn(c, r) {
  T[idx(c, r)] = null; DMG[idx(c, r)] = 0;
  burst(c + 0.5, r + 0.5, C.BLOCKS.loose.color, 18);
  const spots = [];
  for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
    const cc = c + a, rr = r + b;
    if ((a || b) && inBounds(cc, rr) && !at(cc, rr) && !onBelt(cc, rr) && !outpostAt(cc, rr)) spots.push([cc, rr]);
  }
  for (let k = 0; k < C.ROCK.rubble && spots.length; k++) {
    const [cc, rr] = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
    if (Math.abs(cc + 0.5 - P.x) < 0.5 + HB && Math.abs(rr + 0.5 - P.y) < 0.5 + HB) continue; // never bury the robot
    T[idx(cc, rr)] = 'rubble';
  }
  P.shake = 0.35;
  if (Math.hypot(c + 0.5 - P.x, r + 0.5 - P.y) < C.ROCK.hitRadius) {
    const n = cargoCount();
    const lost = cargoRemove(n - Math.floor(n * (1 - C.ROCK.cargoLoss)));
    toast('Cave-in!', 'Lost ' + Math.round(C.ROCK.batteryLoss * 100) + '% battery' + (lost ? ' and ' + lost + ' ore' : '') + '. Watch for shaking rock.');
    drain(batteryMax() * C.ROCK.batteryLoss);
  }
}
