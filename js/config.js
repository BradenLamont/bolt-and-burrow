// Bolt & Burrow — balance and tuning.
// Every number that changes how the game *feels* lives here, so you can
// rebalance without touching the game logic in game.js.
// v0.4: top-down cave. "Down the screen" means deeper into the cave.

const CONFIG = {
  // ----- World -----
  COLS: 25,          // cave width in blocks (the outer columns are bedrock walls)
  ROWS: 160,         // cave length in blocks (the last row is bedrock)
  BASE_ROWS: 4,      // rows 0–3 are the open yard at the cave mouth (your base)
  BASE_BUILDING: { cols: [3, 6], rows: [0, 1] }, // the base shop building
  SPAWN: { col: 9, row: 2 },

  BIOMES: [
    { id: 'topsoil', name: 'Topsoil',      from: 4,  to: 64,  hazards: false,
      note: 'Safe zone. No hazards here.' },
    { id: 'basalt',  name: 'Basalt Deeps', from: 65, to: 159, hazards: true,
      note: 'Unstable rock caves in once two of its sides are dug open.' },
  ],

  // hp = how much digging a block takes; value = coins when sold
  BLOCKS: {
    dirt:    { hp: 2,   color: '#6b4a32' },
    clay:    { hp: 4,   color: '#86563a' },
    basalt:  { hp: 9,   color: '#3e3c44' },
    loose:   { hp: 3,   color: '#7a6d5e' },  // unstable rock (hazard)
    rubble:  { hp: 1,   color: '#5d544b' },  // left behind by a cave-in
    copper:  { hp: 3,   value: 5,  ore: '#e08a42', label: 'copper' },
    silver:  { hp: 5,   value: 14, ore: '#e2e6ea', label: 'silver' },
    gold:    { hp: 8,   value: 40, ore: '#f2c94c', label: 'gold' },
    crystal: { hp: 11,  value: 95, ore: '#9fe3f0', label: 'crystal' },
    fossil:  { hp: 4 },
    found:   { hp: Infinity, color: '#4b4038' }, // base building: can't be dug
    post:    { hp: Infinity, color: '#4b4038' }, // outpost building
    bedrock: { hp: Infinity, color: '#141115' },
  },
  ORE_DEPTH_BONUS: 60, // ore is worth +100% for every 60 blocks of depth

  // ----- Robot parts (tier 0 is what you start with) -----
  PARTS: {
    // light = how far you can see; scan = how far past your light unstable rock shows in the dark (0 = not at all)
    head: { label: 'Head', stat: 'Light · rock scan', fmt: v => v.light + ' blocks · ' + (v.scan ? 'spots unstable rock ' + v.scan + ' blocks into the dark' : 'no rock scan'), tiers: [
      { id: 'bulb',    name: 'Optic Bulb',   cost: 0,    val: { light: 2.5, scan: 0 } },
      { id: 'dome',    name: 'Scanner Dome', cost: 120,  val: { light: 4,   scan: 3 } },
      { id: 'quantum', name: 'Quantum Eye',  cost: 1000, val: { light: 6,   scan: 6 } },
    ]},
    arms: { label: 'Arms', stat: 'Dig power', fmt: v => '×' + v, tiers: [
      { id: 'pincers', name: 'Pincers',        cost: 0,   val: 1 },
      { id: 'drills',  name: 'Drill Arms',     cost: 60,  val: 3 },
      { id: 'plasma',  name: 'Plasma Cutters', cost: 900, val: 8 },
    ]},
    body: { label: 'Body', stat: 'Battery · cargo', fmt: v => v.battery + ' power · ' + v.cargo + ' ore', tiers: [
      { id: 'tin',     name: 'Tin Can',   cost: 0,    val: { battery: 80,  cargo: 8 } },
      { id: 'iron',    name: 'Iron Core', cost: 150,  val: { battery: 140, cargo: 16 } },
      { id: 'reactor', name: 'Reactor',   cost: 1400, val: { battery: 240, cargo: 30 } },
    ]},
    // speed in blocks per second; eff = share of the normal battery cost of moving
    legs: { label: 'Legs', stat: 'Speed · efficiency', fmt: v => v.speed + ' blocks/s · ' + Math.round(v.eff * 100) + '% move cost', tiers: [
      { id: 'treads',  name: 'Rusty Treads', cost: 0,    val: { speed: 4,   eff: 1 } },
      { id: 'springs', name: 'Spring Legs',  cost: 90,   val: { speed: 5.5, eff: 0.8 } },
      { id: 'jets',    name: 'Hover Jets',   cost: 1200, val: { speed: 7,   eff: 0.55 } },
    ]},
  },

  // ----- Movement -----
  BODY: 0.68,         // robot hitbox size in blocks (fits through 1-block tunnels)
  DIG_RATE: 4,        // damage per second for each point of dig power
  ALIGN_SPEED: 6,     // how quickly you slide to the centre of a tunnel

  // ----- Battery -----
  CHARGE_RATE: 45,    // power per second at the base or an outpost
  BATTERY: { move: 0.5, dig: 1.2 }, // move = per block travelled

  // ----- Conveyor & outposts -----
  // The conveyor runs straight down the middle column. Dig its path clear, then
  // extend it; every extension ends in a new outpost (sell, recharge, shop).
  CONVEYOR: { col: 12, step: 25, baseCost: 80, costGrowth: 1.6, speed: 11 },

  // ----- Recall (emergency exit) -----
  RECALL: { keepCargo: 0.5 }, // a manual recall keeps half your ore; a dead battery loses it all

  // ----- Unstable rock hazard (Basalt Deeps) -----
  ROCK: { chance: 0.07, exposedSides: 2, wobble: 0.8, rubble: 3, hitRadius: 1.3, batteryLoss: 0.25, cargoLoss: 0.3 },

  // ----- Pet -----
  PET: {
    name: 'Pip', species: 'Mole', pattern: 'Digs straight down, one column at a time.',
    cols: 16, rows: 6,
    baseDig: 1.4,          // seconds per block at level 1
    speedPerLevel: 0.3,    // +30% dig speed per level
    baseCoins: 2,          // coins per block at level 1 (+50% per level)
    oreChance: 0.12, oreMult: 5,
    digBonusPerLevel: 0.08, // +8% dig power for the robot per level
    trainBase: 120, trainGrowth: 1.8, maxLevel: 10,
    offlineCapHours: 4,
    fossilRows: [14, 26],  // the fossil that hatches the pet hides between these rows
  },
};
