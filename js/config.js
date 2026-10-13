// Bolt & Burrow — balance and tuning.
// Every number that changes how the game *feels* lives here, so you can
// rebalance without touching the game logic in game.js.
// Top-down: the town sits at the bottom, with three cave gates along its top edge.
// Each cave is its own area. In a cave, row 0 is the entrance and higher rows are deeper.

const CONFIG = {
  // ----- World -----
  COLS: 25,          // cave width in blocks (the outer columns are bedrock walls)
  ROWS: 62,          // cave length in blocks: yard + about 55 m of cave (the last row is bedrock)
  BASE_ROWS: 4,      // rows 0–3 of every cave are its entrance hall (with the entrance outpost)
  BASE_BUILDING: { cols: [3, 6], rows: [0, 1] }, // the entrance outpost building
  SPAWN: { col: 9, row: 2 },                     // where you arrive in a cave
  EXIT: { col: 9, row: 0 },                      // the door back to town

  // ----- The town -----
  // Walk into an open gate to enter that cave. A cave's gate opens once you bring home
  // the previous cave's relic, which then sits on its pedestal in town.
  TOWN: {
    rows: 10,
    gates: [5, 12, 19],                          // gate columns for caves 1, 2, 3 (in the cliff at gateRow)
    gateRow: 8,
    shop: { cols: [2, 6], rows: [1, 2], label: 'SHOP' },
    burrow: { cols: [18, 21], rows: [1, 2], label: 'BURROW' },
    pedestals: [3, 5, 7], pedestalRow: 4,        // a relic pedestal for each cave, beside the shop
    trees: [[1, 6], [23, 6], [9, 5], [15, 5], [23, 3]],
    spawn: { col: 12, row: 3 },
  },

  // ----- The caves (levels) -----
  // Each cave is about 50 m deep, with an outpost at the entrance, a buildable one halfway in,
  // and a relic at the end. Bringing a cave's relic home opens the next cave's gate.
  //   rock: the plain rock it's made of · ores: chance per block · granite/obsidian: hard rock chance
  //   chasms: { row, oldBridge, pads } — pads need this cave's bridge keys; one key cache per pad
  //   is hidden before the chasm · pits: small extra chasms · unstable: falling-rock chance
  //   caverns: open chambers · valueMult: ore value multiplier
  CAVES: [
    { id: 'hollow', name: 'Topsoil Hollow', rock: ['dirt', 'clay'], floor: '#2a1e15',
      ores: { copper: 0.06, silver: 0.025 }, granite: 0.04, obsidian: 0, chasms: [], pits: 0, unstable: 0, caverns: 2,
      valueMult: 1, relic: { name: 'Ember Idol', reward: 300, wall: null }, keyName: 'Hollow bridge key', fossil: true,
      note: 'Soft soil and copper. Watch for granite: Rock Claws can\'t break it.' },
    { id: 'rift', name: 'Granite Rift', rock: ['stone'], floor: '#211d1f',
      ores: { silver: 0.05, gold: 0.03 }, granite: 0.1, obsidian: 0.02, chasms: [{ row: 38, oldBridge: true, pads: 1 }], pits: 0, unstable: 0, caverns: 3,
      valueMult: 2, relic: { name: 'Storm Lens', reward: 800, wall: 'granite' }, keyName: 'Rift bridge key',
      note: 'A chasm splits this cave. Cross on the old bridge, or find the bridge key hidden before the chasm and use it on a bridge pad.' },
    { id: 'deeps', name: 'Basalt Deeps', rock: ['basalt'], floor: '#1b1820',
      ores: { gold: 0.05, crystal: 0.025 }, granite: 0.06, obsidian: 0.07, chasms: [{ row: 36, oldBridge: false, pads: 2 }], pits: 3, unstable: 0.08, caverns: 3,
      valueMult: 3.5, relic: { name: 'Core Heart', reward: 2000, wall: 'obsidian' }, keyName: 'Deeps bridge key',
      note: 'No old bridge here: find this cave\'s bridge keys before the chasm. Unstable rock collapses as you pass and sets off the rock around it.' },
  ],

  // hp = how much digging a block takes; value = coins when sold
  BLOCKS: {
    dirt:    { hp: 2,   color: '#6b4a32' },
    clay:    { hp: 4,   color: '#86563a' },
    stone:   { hp: 5,   color: '#5b5753' },
    basalt:  { hp: 9,   color: '#3e3c44' },
    // Hard rock: needs = the Arms tier required (1 = Drill Arms, 2 = Plasma Cutters)
    granite:  { hp: 10, needs: 1, color: '#8c8286', label: 'Granite' },
    obsidian: { hp: 16, needs: 2, color: '#241d2c', label: 'Obsidian' },
    cache:   { hp: 4 },                         // a hidden treasure cache
    keycache: { hp: 4 },                        // a marked cache holding one of this cave's bridge keys
    chasm:   { hp: Infinity },                  // a drop you can't cross or dig
    bridge:  { hp: Infinity },                  // a deployed bridge (walkable)
    oldbridge: { hp: Infinity },                // an old bridge (walkable)
    pad:     { hp: Infinity },                  // a bridge pad (walkable)
    exit:    { hp: Infinity },                  // the door from a cave back to town (walkable)
    gate:    { hp: Infinity },                  // an open cave gate in town (walkable)
    gatelocked: { hp: Infinity },               // a sealed cave gate
    cliff:   { hp: Infinity, color: '#4a4038' },// the town's cliffs
    tree:    { hp: Infinity },                  // town decoration
    pedestal: { hp: Infinity },                 // a relic pedestal in town
    loose:   { hp: 3,   color: '#7a6d5e' },  // unstable rock (hazard)
    rubble:  { hp: 1,   color: '#5d544b' },  // left behind by a cave-in
    copper:  { hp: 3,   value: 5,  ore: '#e08a42', label: 'copper' },
    silver:  { hp: 5,   value: 14, ore: '#e2e6ea', label: 'silver' },
    gold:    { hp: 8,   value: 40, ore: '#f2c94c', label: 'gold' },
    crystal: { hp: 11,  value: 95, ore: '#9fe3f0', label: 'crystal' },
    fossil:  { hp: 4 },
    relic:   { hp: 40 },                        // each cave's relic, at the deep end
    found:   { hp: Infinity, color: '#4b4038' }, // base building: can't be dug
    post:    { hp: Infinity, color: '#4b4038' }, // outpost building
    bedrock: { hp: Infinity, color: '#141115' },
  },
  ORE_DEPTH_BONUS: 60, // ore is worth +100% for every 60 blocks of depth

  // ----- Canopy Walker parts (tier 0 is what you start with) -----
  // Part ids stay the same across versions so saves keep working; names match the art.
  PARTS: {
    // light = how far you can see; scan = how far past your light the scanner picks out unstable rock and treasure caches (0 = no scanner)
    head: { label: 'Canopy', stat: 'Light · scanner', fmt: v => v.light + ' blocks · ' + (v.scan ? 'scans ' + v.scan + ' blocks for caches and unstable rock' : 'no scanner'), tiers: [
      { id: 'bulb',    name: 'Glass Bubble',   cost: 0,    val: { light: 2.5, scan: 0 } },
      { id: 'dome',    name: 'Armored Visor', cost: 120,  val: { light: 4,   scan: 3 } },
      { id: 'quantum', name: 'Sensor Dome',  cost: 1000, val: { light: 6,   scan: 6 } },
    ]},
    arms: { label: 'Arms', stat: 'Dig power', fmt: v => '×' + v, tiers: [
      { id: 'pincers', name: 'Rock Claws',        cost: 0,   val: 1 },
      { id: 'drills',  name: 'Drill Arms',     cost: 60,  val: 3 },
      { id: 'plasma',  name: 'Plasma Cutters', cost: 900, val: 8 },
    ]},
    body: { label: 'Tank', stat: 'Battery · cargo', fmt: v => v.battery + ' power · ' + v.cargo + ' ore', tiers: [
      { id: 'tin',     name: 'Small Tank',   cost: 0,    val: { battery: 80,  cargo: 8 } },
      { id: 'iron',    name: 'Twin Tanks', cost: 150,  val: { battery: 140, cargo: 16 } },
      { id: 'reactor', name: 'Reactor Tank',   cost: 1400, val: { battery: 240, cargo: 30 } },
    ]},
    // speed in blocks per second; eff = share of the normal battery cost of moving
    legs: { label: 'Legs', stat: 'Speed · efficiency', fmt: v => v.speed + ' blocks/s · ' + Math.round(v.eff * 100) + '% move cost', tiers: [
      { id: 'treads',  name: 'Piston Legs', cost: 0,    val: { speed: 4,   eff: 1 } },
      { id: 'springs', name: 'Spring Struts',  cost: 90,   val: { speed: 5.5, eff: 0.8 } },
      { id: 'jets',    name: 'Hover Jets',   cost: 1200, val: { speed: 7,   eff: 0.55 } },
    ]},
  },

  // ----- Movement -----
  BODY: 0.68,         // robot hitbox size in blocks (fits through 1-block tunnels)
  DIG_RATE: 4,        // damage per second for each point of dig power
  ALIGN_SPEED: 6,     // how quickly you slide to the centre of a tunnel
  ALIGN_SNAP: 0.22,   // only line up when you're this close to a lane's centre, so you can still dig between two blocks

  // ----- Battery -----
  CHARGE_RATE: 45,    // power per second at the base or an outpost
  BATTERY: { move: 0.5, dig: 1.2 }, // move = per block travelled

  // ----- Low battery warning -----
  // The battery bar marks roughly how much power the trip back needs (walking to the
  // conveyor, then riding it for free). You get a warning when you're close to that mark.
  LOW_BATTERY: { safety: 1.3, buffer: 6 },

  // ----- Conveyor & outposts -----
  // The conveyor runs straight down the middle column. Dig its path clear, then
  // extend it; every extension ends in a new outpost (sell, recharge, shop).
  // Each cave gets one outpost, halfway in. Its cost grows with each cave.
  CONVEYOR: { col: 12, step: 25, maxOutposts: 1, baseCost: 80, costGrowth: 2.5, speed: 11 },

  // ----- Chasms and bridges -----
  // Chasms block the walker. Some have an old bridge somewhere along them. Bridge pads deploy a
  // new bridge using one of that cave's bridge keys (found in marked caches before the chasm).

  // ----- Treasure caches -----
  // Hidden in the rock. A canopy with a scanner reveals them within its scan range;
  // without one you only find them by digging into them.
  CACHE: { perCave: 4, coins: [60, 160], ores: 2 },

  // ----- Relics -----
  // Each cave's relic sits in a chamber at the deep end (row 57 ≈ 54 m), sealed in that cave's
  // hard rock. Carry it to base or the outpost to claim the reward and unlock the next cave.
  RELIC: { row: 57 },

  // ----- Recall (emergency exit) -----
  RECALL: { keepCargo: 0.5 }, // a manual recall keeps half your ore; a dead battery loses it all

  // ----- Unstable rock hazard (only in caves with an `unstable` chance) -----
  // It starts shaking once two sides are dug open, or as soon as you pass within triggerRadius of
  // it with one side open. A collapse sets nearby unstable rock shaking too (a chain reaction).
  ROCK: { exposedSides: 2, wobble: 0.4, triggerRadius: 1.8, chainRadius: 2.2, chainStart: 0.5,
          rubble: 4, hitRadius: 1.4, batteryLoss: 0.25, cargoLoss: 0.3 },

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
