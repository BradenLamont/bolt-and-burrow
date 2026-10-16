// Bolt & Burrow — balance and tuning.
// Every number that changes how the game *feels* lives here, so you can
// rebalance without touching the game logic.
// Top-down: the town sits at the bottom, with three cave gates along its top edge.
// Each cave is its own area. In a cave, row 0 is the entrance and higher rows are deeper.

const pct = v => Math.round(v * 100) + '%';   // 0.15 → "15%" (used in mod descriptions)

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
    rows: 12,
    gates: [5, 12, 19],                          // gate columns for caves 1, 2, 3 (in the cliff at gateRow)
    gateRow: 10,
    shop: { cols: [2, 6], rows: [3, 4], label: 'SHOP', door: 4, doorW: 2 },   // a 2-block door (cols 4–5): walk into it to go inside
    pedestals: [4, 11, 18], pedestalRow: 9,      // a relic pedestal beside each cave's gate (left side)
    trees: [[1, 8], [23, 8], [8, 7], [16, 7], [23, 5], [1, 5], [19, 4], [21, 3], [17, 5]],
    spawn: { col: 12, row: 5 },
    // The train is your home base. It's parked along the bottom of town: tracks in row 0, a platform in
    // row 1. Stand at a car's door (the marked platform tile) to use it. Other towns aren't built yet.
    station: { railRow: 0, platformRow: 1, cars: [
      { id: 'engine',  name: 'Engine car',  cols: [3, 5] },
      { id: 'forge',   name: 'Forge car',   cols: [7, 9] },
      { id: 'lab',     name: 'Lab car',     cols: [11, 13] },
      { id: 'storage', name: 'Storage car', cols: [15, 17] },
    ] },
  },

  // ----- Towns on the train line -----
  // Every town uses the TOWN layout above; each has its own name, colours and caves behind its gates
  // (gates: a cave number, or null for a sealed "coming soon" gate). shop: Pip's shop style there
  // ('burrow' = Burrow Workshop, 'garage' = Salvage Garage). Town 2 is a placeholder for testing travel.
  TOWNS: [
    { name: 'Hollowmouth', gates: [0, 1, 2], shop: 'burrow', pedestals: true,
      look: { grass: '#3c4a2c', grassDot: 'rgba(120,150,80,.25)', path: '#7a6248', cliff: '#4a4038' } },
    { name: 'Rustvale', gates: [3, null, null], shop: 'garage', pedestals: false, placeholder: true,
      look: { grass: '#4d4230', grassDot: 'rgba(190,150,90,.22)', path: '#86684a', cliff: '#5a4334' } },
  ],
  // The train trip: seconds for each part of boarding, the drilling scene and unloading
  TRIP: { doors: 0.6, lift: 1.4, walk: 0.9, travel: 4 },
  LINE_TEST_KEY: 'KeyT',   // press it 5 times in town to open the line early (for testing)

  // ----- Pip's shop (inside the SHOP building) -----
  // A small room: walk up to a display stand to buy that part, or to Pip at the counter to sell.
  // Rows count up from the door (row 0). cols: the room's inside, between its side walls.
  SHOP: {
    rows: 9, cols: [7, 17], door: 12, doorW: 2, counterRow: 6, pipRow: 7,
    stands: [ { slot: 'head', col: 7, row: 4 }, { slot: 'arms', col: 7, row: 2 },
              { slot: 'body', col: 17, row: 4 }, { slot: 'legs', col: 17, row: 2 }, { slot: 'weapon', col: 7, row: 5 } ],
  },

  // ----- The caves (levels) -----
  // Each cave is about 50 m deep, with an outpost at the entrance, a buildable one halfway in,
  // and a relic at the end. Bringing a cave's relic home opens the next cave's gate.
  //   rock: the plain rock it's made of · ores: chance per block · granite/obsidian: hard rock chance
  //   chasms: { row, oldBridge, pads } — pads need this cave's bridge keys; one key cache per pad
  //   is hidden before the chasm · pits: small extra chasms · unstable: falling-rock chance
  //   caverns: open chambers · valueMult: ore value multiplier
  //   sand: patches of sliding sand · boulders: rolling boulder chance · aquifers: hidden water pockets
  //   gas: hidden gas pockets. Every cave slopes down toward its entrance, so sand and boulders move that way.
  CAVES: [
    { id: 'hollow', name: 'Topsoil Hollow', rock: ['dirt', 'clay'], floor: '#2a1e15',
      ores: { copper: 0.06, silver: 0.025 }, granite: 0.04, obsidian: 0, chasms: [], pits: 0, unstable: 0, caverns: 2,
      valueMult: 1, relic: { name: 'Ember Idol', reward: 300, wall: null }, keyName: 'Hollow bridge key', coinMult: 1, sand: 9,
      foes: { grub: 6, bat: 3 }, miniBoss: 'grubmother',
      note: 'Soft soil and copper. Pale sand slides toward the entrance when you dig the block in front of it. Rock Claws can\'t break granite.' },
    { id: 'rift', name: 'Granite Rift', rock: ['stone'], floor: '#211d1f',
      ores: { silver: 0.05, gold: 0.03 }, granite: 0.1, obsidian: 0.02, chasms: [{ row: 38, oldBridge: true, pads: 1 }], pits: 0, unstable: 0, caverns: 3,
      valueMult: 2, relic: { name: 'Storm Lens', reward: 800, wall: 'granite' }, keyName: 'Rift bridge key', coinMult: 1.5, boulders: 0.02, aquifers: 5,
      foes: { grub: 3, bat: 5, spitter: 4 }, miniBoss: 'warden',
      note: 'A chasm splits this cave. Boulders roll toward the entrance, and dark wet rock hides water that floods your tunnels. Push boulders by walking into them.' },
    { id: 'deeps', name: 'Basalt Deeps', rock: ['basalt'], floor: '#1b1820',
      ores: { gold: 0.05, crystal: 0.025 }, granite: 0.06, obsidian: 0.07, chasms: [{ row: 36, oldBridge: false, pads: 2 }], pits: 3, unstable: 0.08, caverns: 3,
      valueMult: 3.5, relic: { name: 'Core Heart', reward: 2000, wall: 'obsidian' }, keyName: 'Deeps bridge key', coinMult: 2, gas: 8,
      foes: { grub: 4, bat: 5, spitter: 6 }, boss: 'golem',
      note: 'No old bridge here: find this cave\'s bridge keys before the chasm. Unstable rock collapses as you pass, and green gas pockets explode if you dig next to them.' },
    // Rustvale's test cave: a mix of everything, to try the town-to-town loop
    { id: 'test', name: 'Test Cavern', town: 1, label: 'Test cave', rock: ['stone'], floor: '#1d2129',
      ores: { copper: 0.05, silver: 0.04, gold: 0.02 }, granite: 0.05, obsidian: 0, chasms: [], pits: 1, unstable: 0.03, caverns: 3,
      valueMult: 1.5, relic: { name: 'Test Shard', reward: 100, wall: null }, keyName: 'Test bridge key', coinMult: 1.5,
      sand: 3, boulders: 0.008, aquifers: 2, gas: 3, foes: { crab: 5, mite: 3 },
      note: 'A placeholder cave for testing: a little of everything from Hollowmouth\'s three caves.' },
  ],

  // hp = how much digging a block takes; coin = coins for digging it (× the cave's coinMult);
  // value = what the shop pays for one piece of ore
  BLOCKS: {
    dirt:    { hp: 2,   coin: 1, color: '#6b4a32' },
    clay:    { hp: 4,   coin: 2, color: '#86563a' },
    stone:   { hp: 5,   coin: 2, color: '#5b5753' },
    basalt:  { hp: 9,   coin: 3, color: '#3e3c44' },
    // Hard rock: needs = the Arms tier required (1 = Drill Arms, 2 = Plasma Cutters)
    granite:  { hp: 10, coin: 4, needs: 1, color: '#8c8286', label: 'Granite' },
    obsidian: { hp: 16, coin: 6, needs: 2, color: '#241d2c', label: 'Obsidian' },
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
    pedestal: { hp: Infinity },
    rail:    { hp: Infinity },                  // train tracks in town
    shopdoor: { hp: Infinity },                 // the shop's door (walkable)
    shopwall: { hp: Infinity, color: '#4a372a' },
    stand:   { hp: Infinity },                  // a part display stand in the shop
    counter: { hp: Infinity },                  // Pip's counter
    void:    { hp: Infinity },                  // nothing (outside the shop's walls)
    loose:   { hp: 3,   coin: 2, color: '#7a6d5e' },  // unstable rock (hazard)
    sand:    { hp: 1.2, coin: 1, color: '#c9b07a' },  // slides toward the entrance into open space
    boulder: { hp: 30,  coin: 3, color: '#8a8178' },  // rolls toward the entrance; push it by walking into it
    aquifer: { hp: 3,   coin: 1, color: '#3d4a52' },  // wet rock: floods your tunnels when opened
    water:   { hp: Infinity },                        // flood water (walkable, slows you)
    gas:     { hp: 3,   coin: 1, color: '#4f5e3c' },  // a gas pocket: explodes if you dig next to it
    beam:    { hp: Infinity },                        // a support beam you placed (walkable)
    rubble:  { hp: 1,   color: '#5d544b' },  // left behind by a cave-in
    copper:  { hp: 3,   coin: 1, value: 9,   ore: '#e08a42', label: 'copper' },
    silver:  { hp: 5,   coin: 1, value: 24,  ore: '#e2e6ea', label: 'silver' },
    gold:    { hp: 8,   coin: 1, value: 68,  ore: '#f2c94c', label: 'gold' },
    crystal: { hp: 11,  coin: 1, value: 165, ore: '#9fe3f0', label: 'crystal' },
    fossil:  { hp: 4 },
    relic:   { hp: 40 },                        // each cave's relic, at the deep end
    found:   { hp: Infinity, color: '#4b4038' }, // base building: can't be dug
    post:    { hp: Infinity, color: '#4b4038' }, // outpost building
    bedrock: { hp: Infinity, color: '#141115' },
  },

  // ----- Canopy Walker parts (tier 0 is what you start with) -----
  // Part ids stay the same across versions so saves keep working; names match the art.
  PARTS: {
    // light = how far you can see; scan = how far past your light the scanner picks out unstable rock and treasure caches (0 = no scanner)
    head: { label: 'Canopy', stat: 'Light · scanner', fmt: v => v.light + ' blocks · ' + (v.scan ? 'scans ' + v.scan + ' blocks for caches and unstable rock' : 'no scanner'), tiers: [
      { id: 'bulb',    name: 'Glass Bubble',   cost: 0,    val: { light: 2.5, scan: 0 } },
      { id: 'dome',    name: 'Armored Visor', cost: 120,  val: { light: 4,   scan: 3 } },
      { id: 'quantum', name: 'Sensor Dome',  cost: 1000, val: { light: 6,   scan: 6 } },
    ]},
    // The dig arm hits a cone in front of you: the block ahead takes full damage, the blocks beside it 40%,
    // and (Drill Arms and up) the block behind it 30%. Hard rock still needs the right tier.
    arms: { label: 'Dig arm', stat: 'Dig power', fmt: v => '×' + v + ' (' + v * 4 + ' damage a second)', tiers: [
      { id: 'pincers', name: 'Rock Claws',        cost: 0,   val: 1 },
      { id: 'drills',  name: 'Drill Arms',     cost: 60,  val: 3 },
      { id: 'plasma',  name: 'Plasma Cutters', cost: 900, val: 8 },
    ]},
    body: { label: 'Tank', stat: 'Battery · hull · cargo', fmt: v => v.battery + ' power · ' + v.hull + ' hull · ' + v.cargo + ' ore', tiers: [
      { id: 'tin',     name: 'Small Tank',   cost: 0,    val: { battery: 80,  cargo: 8,  hull: 60 } },
      { id: 'iron',    name: 'Twin Tanks', cost: 150,  val: { battery: 140, cargo: 16, hull: 100 } },
      { id: 'reactor', name: 'Reactor Tank',   cost: 1400, val: { battery: 240, cargo: 30, hull: 160 } },
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

  // ----- Reactive blocks -----
  REACT: {
    sandSlide: 0.3,      // seconds before sand slides into an open space
    boulderStart: 0.6,   // a boulder that comes loose rumbles this long before it rolls
    boulderRoll: 0.14,   // seconds per block while a boulder rolls
    pushTime: 0.3,       // seconds of pushing to shove a boulder one block
    floodVolume: 10, floodStep: 0.2,   // blocks of water per pocket, seconds per block
    waterSpeed: 0.55, waterDrain: 1.2, // speed while wading, extra battery per second
    gasFuse: 0.9, gasRadius: 1, gasHit: 1.8,
    hits: { sand: { battery: 0.05, cargo: 0 }, boulder: { battery: 0.15, cargo: 0.1 }, gas: { battery: 0.3, cargo: 0.3 } },
  },

  // ----- Tools (bought from Pip, carried on your tool belt) -----
  // Each tool type takes one belt slot. Slots = beltSlots + your Tank tier. max = how many fit in a slot.
  TOOLS: {
    blast:   { name: 'Blast charge', cost: 40, max: 3, key: '1', text: 'Breaks a 3×3 area in front of you, even hard rock' },
    beam:    { name: 'Support beam', cost: 15, max: 5, key: '2', text: 'Placed where you stand: sand and boulders can\'t move into it, and nearby unstable rock stays put' },
    flare:   { name: 'Flare',        cost: 10, max: 5, key: '3', text: 'Lights up a wide area for 30 seconds', radius: 7, time: 30 },
    grapple: { name: 'Grapple',      cost: 60, max: 2, key: '4', text: 'Face a chasm and swing across it (up to 3 blocks)' },
  },
  BELT_SLOTS: 3,

  // ----- Weapon arm -----
  // Fire with F or J (or click to aim, or the ATTACK button). Each weapon also chips at blocks: blockHit is
  // the share of its damage that blocks take, and tier is the hardest rock it can break (like dig arms).
  // Mk II and Mk III multiply damage (dmg) and shorten the cooldown (cd).
  //   kind: melee = an arc in front · shot = a projectile · pull = a bash that drags enemies together and stuns
  //         pulse = a ring that stuns and marks enemies (marked enemies take +50% and lose their armour)
  WEAPONS: {
    wrench:  { name: 'Wrench',          cls: 'Melee',     kind: 'melee', cost: 0,   dmg: 3, cd: 0.45, range: 1.3, arc: 100, blockHit: 0.5, tier: 0,
               text: 'A free starter swing. Hits everything in a small arc.' },
    hammer:  { name: 'Rock Hammer',     cls: 'Melee',     kind: 'melee', cost: 180, dmg: 8, cd: 0.7, range: 1.45, arc: 130, blockHit: 0.9, tier: 1, armorBreak: true,
               text: 'Heavy arc swing. Cracks armour, mines better than any weapon and can break granite.' },
    rivet:   { name: 'Rivet Gun',       cls: 'Ranged',    kind: 'shot',  cost: 220, dmg: 3, cd: 0.3, range: 7, speed: 13, blockHit: 0.25, tier: 0,
               text: 'Fires rivets in a straight line. Less damage, but you stay out of reach.' },
    bulwark: { name: 'Gravity Bulwark', cls: 'Defensive', kind: 'pull',  cost: 260, dmg: 2, cd: 1.6, range: 3.2, stun: 0.9, blockHit: 0.2, tier: 0, guard: 0.5,
               text: 'Shield bash that pulls nearby enemies together in front of you and stuns them. Halves damage from the front.' },
    stun:    { name: 'Stun Pulse',      cls: 'Support',   kind: 'pulse', cost: 300, dmg: 1, cd: 2.5, range: 3, stun: 1.5, mark: 4, blockHit: 0, tier: 0,
               text: 'A ring that stuns everything around you and marks enemies to take +50% damage.' },
  },
  WEAPON_MK: { dmg: [1, 1.5, 2.2], cd: [1, 0.9, 0.8], cost: [{ coins: 150, circuits: 2 }, { coins: 400, conductors: 2 }] },
  HULL: { repair: 30, invuln: 0.5 },   // hull repaired per second at stations; seconds of safety after a hit

  // ----- Enemies -----
  // hp, speed (blocks/s), dmg (to hull), r (size), aggro (how close before they notice you), coins when beaten.
  // armor: share of damage blocked unless the hit cracks armour (Rock Hammer) or the enemy is marked/stunned.
  FOES: {
    grub:    { name: 'Grub',       hp: 10,  speed: 1.2, dmg: 6,  r: 0.3,  aggro: 5,  coins: 3,  color: '#c9b07a' },
    bat:     { name: 'Cave Bat',   hp: 5,   speed: 3.6, dmg: 4,  r: 0.25, aggro: 7,  coins: 2,  color: '#6b5a7a', fly: true },
    spitter: { name: 'Spitter',    hp: 14,  speed: 0,   dmg: 8,  r: 0.35, aggro: 6,  coins: 6,  color: '#7fae4a', range: 6, fire: 2.2, shot: 5 },
    crab:    { name: 'Rock Crab',  hp: 22,  speed: 1.6, dmg: 10, r: 0.38, aggro: 5,  coins: 8,  color: '#8c8286', armor: 0.7 },
    mite:    { name: 'Magma Mite', hp: 3,   speed: 3,   dmg: 3,  r: 0.2,  aggro: 6,  coins: 1,  color: '#e2705a', group: 4 },
    // mini-bosses guard the hall before the relic; the big boss holds Cave 3's Core Heart
    grubmother: { name: 'Grub Mother',   hp: 70,  speed: 0.8, dmg: 7,  r: 0.7, aggro: 7, coins: 150, flux: 20, color: '#d9b77a', boss: 'mini', spawn: 'grub', every: 6 },
    warden:     { name: 'Crystal Warden', hp: 160, speed: 1.4, dmg: 15, r: 0.65, aggro: 7, coins: 300, flux: 40, color: '#9fe3f0', boss: 'mini', armor: 0.5, charge: 4 },
    golem:      { name: 'Basalt Golem',  hp: 450, speed: 1.0, dmg: 18, r: 1.0, aggro: 9, coins: 500, flux: 60, color: '#3e3c44', boss: 'big', slam: 5, slamRadius: 3.2, slamDmg: 20, spawn: 'bat', every: 8 },
  },
  BOSS_HALL: { rows: [50, 53], cols: [6, 18] },     // the mini-boss hall, just before the relic chamber
  BOSS_ARENA: { rows: [50, 59], cols: [2, 22] },    // Cave 3's boss room, walled in obsidian

  // ----- Unstable rock hazard (only in caves with an `unstable` chance) -----
  // It starts shaking once two sides are dug open, or as soon as you pass within triggerRadius of
  // it with one side open. A collapse sets nearby unstable rock shaking too (a chain reaction).
  ROCK: { exposedSides: 2, wobble: 0.4, triggerRadius: 1.8, chainRadius: 2.2, chainStart: 0.5,
          rubble: 4, hitRadius: 1.4, batteryLoss: 0.25, cargoLoss: 0.3 },

  // ----- Forge (train) -----
  // Ore you bring home goes into train storage. The forge refines it into materials, one job at a
  // time (jobs keep running while you're in a cave or away). time = seconds (short while testing);
  // value = what the shop pays for one.
  MATERIALS: {
    wire:       { name: 'Wire',       color: '#e08a42', needs: { copper: 2 },             time: 2, value: 24 },
    circuits:   { name: 'Circuits',   color: '#8fd18a', needs: { silver: 2, copper: 1 },  time: 3, value: 75 },
    conductors: { name: 'Conductors', color: '#f2c94c', needs: { gold: 2, silver: 1 },    time: 4, value: 195 },
    lenses:     { name: 'Lenses',     color: '#9fe3f0', needs: { crystal: 2, gold: 1 },   time: 6, value: 480 },
  },
  FORGE: { queueMax: 6 },

  // ----- Computer (Lab car) -----
  // A grid of cells. The top row is the passive area; the bottom row is for active skills and
  // opens after the first town. Every mod is a fixed shape (no rotating): cells are [x, y] from its
  // top-left corner. Build a mod with materials and coins; upgrade it with Flux (levels 1–3).
  // The active row opens when you bring home the Core Heart (the end of Town 1); it holds one skill at a time.
  // eff = its effect at each level.
  COMPUTER: { cols: 2, rows: 2, passiveRows: 1, upgradeFlux: [25, 75] },  // Flux per cell for level 2, level 3
  MODS: {
    drill:      { name: 'Drill Chip',      shape: [[0, 0]],                         cost: { wire: 2 }, coins: 40,
                  eff: [0.1, 0.15, 0.2],   text: e => '+' + pct(e) + ' dig speed' },
    saver:      { name: 'Power Saver',     shape: [[0, 0]],                         cost: { wire: 3 }, coins: 60,
                  eff: [0.15, 0.22, 0.3],  text: e => '−' + pct(e) + ' battery used moving' },
    prospector: { name: 'Prospector',      shape: [[0, 0]],                         cost: { wire: 2, circuits: 1 }, coins: 80,
                  eff: [0.1, 0.2, 0.3],    text: e => '+' + pct(e) + ' coins per block' },
    lamp:       { name: 'Lamp Chip',       shape: [[0, 0]],                         cost: { lenses: 1 }, coins: 150,
                  eff: [1, 1.5, 2],        text: e => '+' + e + ' light radius' },
    hardrock:   { name: 'Hardrock Driver', shape: [[0, 0], [1, 0]],                 cost: { circuits: 2 }, coins: 150,
                  eff: [0.3, 0.45, 0.6],   text: e => '+' + pct(e) + ' dig speed on granite and obsidian' },
    sorter:     { name: 'Sorter',          shape: [[0, 0], [1, 0]],                 cost: { circuits: 3 }, coins: 200,
                  eff: [0.15, 0.22, 0.3],  text: e => pct(e) + ' chance of double ore' },
    coolant:    { name: 'Coolant Loop',    shape: [[0, 0], [0, 1]],                 cost: { conductors: 2 }, coins: 250,
                  eff: [0.2, 0.3, 0.4],    text: e => '+' + pct(e) + ' battery' },
    oresense:   { name: 'Ore Sense',       shape: [[0, 0], [1, 0], [0, 1]],         cost: { conductors: 2, lenses: 1 }, coins: 400,
                  eff: [3, 4, 5],          text: e => 'see ore through rock within ' + e + ' blocks' },
    overclock:  { name: 'Overclock',       shape: [[0, 0], [1, 0], [2, 0], [1, 1]], cost: { conductors: 2, lenses: 2 }, coins: 600,
                  eff: [0.25, 0.35, 0.45], text: e => '+' + pct(e) + ' dig speed, +10% battery use' },
    // Active skills: they go in the bottom row (one at a time). eff = seconds for the nano-bot to recharge it.
    dash:       { name: 'Dash',            shape: [[0, 0]], active: true, cost: { wire: 3, circuits: 1 }, coins: 150, battery: 3,
                  eff: [8, 6, 4],          text: e => 'Burst 3 blocks forward · recharges in ' + e + ' s' },
    burst:      { name: 'Drill Burst',     shape: [[0, 0]], active: true, cost: { circuits: 2, conductors: 1 }, coins: 250, battery: 5,
                  eff: [20, 16, 12],       text: e => 'Triple dig speed for 4 s · recharges in ' + e + ' s' },
    pulse:      { name: 'Scan Pulse',      shape: [[0, 0]], active: true, cost: { circuits: 2, lenses: 1 }, coins: 250, battery: 0,
                  eff: [15, 12, 9],        text: e => 'Reveals ore, caches and hazards 8 blocks around · recharges in ' + e + ' s' },
    shield:     { name: 'Shield',          shape: [[0, 0], [1, 0]], active: true, cost: { conductors: 2, lenses: 1 }, coins: 400, battery: 0,
                  eff: [30, 25, 20],       text: e => 'Blocks the next cave-in, boulder or gas blast · recharges in ' + e + ' s' },
  },

  // ----- Nano-bots -----
  // The first nano-bot comes with the Ember Idol (Cave 1's relic). Nano-bots make Flux, even while
  // you're away (up to offlineCapHours).
  NANOBOT: { fluxPerMin: 10, offlineCapHours: 8 },
};
