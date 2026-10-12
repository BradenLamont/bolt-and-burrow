// Bolt & Burrow — balance and tuning.
// Every number that changes how the game *feels* lives here, so you can
// rebalance without touching the game logic in game.js.

const CONFIG = {
  // ----- World -----
  COLS: 13,          // world width in blocks (column 0 is the lift shaft)
  ROWS: 150,         // world depth in blocks (last row is bedrock)
  SURFACE_ROW: 2,    // the row the robot stands on at the surface
  GROUND_ROW: 3,     // first row of dirt

  BIOMES: [
    { id: 'topsoil', name: 'Topsoil',      from: 3,  to: 64,  hazards: false,
      note: 'Safe zone. No hazards here.' },
    { id: 'basalt',  name: 'Basalt Deeps', from: 65, to: 149, hazards: true,
      note: 'Loose rock falls when you dig out the block beneath it.' },
  ],

  // hp = how much digging a block takes; value = coins when sold
  BLOCKS: {
    dirt:    { hp: 2,   color: '#6b4a32' },
    clay:    { hp: 4,   color: '#86563a' },
    basalt:  { hp: 9,   color: '#3e3c44' },
    loose:   { hp: 3,   color: '#7a6d5e' },
    copper:  { hp: 3,   value: 5,  ore: '#e08a42', label: 'copper' },
    silver:  { hp: 5,   value: 14, ore: '#e2e6ea', label: 'silver' },
    gold:    { hp: 8,   value: 40, ore: '#f2c94c', label: 'gold' },
    crystal: { hp: 11,  value: 95, ore: '#9fe3f0', label: 'crystal' },
    fossil:  { hp: 4 },
    plat:    { hp: 0.3, color: '#a77d48' },
    bedrock: { hp: Infinity, color: '#141115' },
  },
  ORE_DEPTH_BONUS: 60, // ore is worth +100% for every 60 blocks of depth

  // ----- Robot parts (tier 0 is what you start with) -----
  PARTS: {
    head: { label: 'Head', stat: 'Light radius', fmt: v => v + ' blocks', tiers: [
      { id: 'bulb',    name: 'Optic Bulb',   cost: 0,    val: 2.5 },
      { id: 'dome',    name: 'Scanner Dome', cost: 120,  val: 4 },
      { id: 'quantum', name: 'Quantum Eye',  cost: 1000, val: 6 },
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
    legs: { label: 'Legs', stat: 'Speed · climb', fmt: v => v.speed + ' blocks/s · ' + (v.fly ? 'jetpack' : 'jump ' + v.jump), tiers: [
      { id: 'treads',  name: 'Rusty Treads', cost: 0,    val: { speed: 4,   jump: 1, fly: false } },
      { id: 'springs', name: 'Spring Legs',  cost: 90,   val: { speed: 5.5, jump: 2, fly: false } },
      { id: 'jets',    name: 'Hover Jets',   cost: 1200, val: { speed: 6.5, jump: 2, fly: true } },
    ]},
  },

  // ----- Movement -----
  DIG_RATE: 4,        // damage per second for each point of dig power
  JUMP_SPEED: 8,      // blocks per second while rising
  FALL_SPEED: 12,     // blocks per second while falling
  HANG_TIME: 0.45,    // seconds you float at the top of a jump (time to drop a platform)

  // ----- Battery -----
  CHARGE_RATE: 45,    // power per second at the surface or the lift dock
  BATTERY: { move: 0.5, dig: 1.2, jump: 1, jet: 2 },

  // ----- Platforms -----
  PLATFORMS: { carry: 12, restockCost: 2 }, // auto-restocked at the surface and dock

  // ----- Lift (far-left column) -----
  LIFT: { startRow: 10, step: 8, baseCost: 60, costGrowth: 1.45, speed: 9 },

  // ----- Loose rock hazard (Basalt Deeps) -----
  ROCK: { chance: 0.07, wobble: 0.7, gravity: 30, maxSpeed: 14, batteryLoss: 0.25, cargoLoss: 0.3 },

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
