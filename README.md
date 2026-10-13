# Bolt & Burrow

A browser mining game: steer a robot with swappable parts down through the earth, haul ore back up, and upgrade.

**Play:** open `index.html`, or publish the repo with GitHub Pages.

## Controls
- Desktop: arrow keys or WASD to move. Push into blocks to dig them (standing between two blocks digs both). Up goes deeper into the cave. Stand on the conveyor and hold Up or Down to ride it. E (or the action button) uses a bridge pad or boards the train. Walk into an open gate in town to enter a cave; walk out the TOWN door to leave. In town, stand in front of the SHOP or at a train car's door to use it.
- Computer (Lab car): tap a mod, then tap a cell. With a mouse you can also drag mods onto the grid.
- Phone: touch and drag anywhere on the cave for a joystick.
- Recall button: emergency trip back to the cave entrance, keeping half your ore.

## Files
- `index.html` – page layout and script load order
- `css/style.css` – look and layout
- `js/config.js` – every balance number (part stats, costs, blocks, conveyor, relic, materials, mods, nano-bots)
- `js/state.js` – shared game state, saving, helpers
- `js/world.js` – the town and the three caves: generation, conveyor and outposts, chasms and bridges, caches, relic chambers, moving between town and caves
- `js/player.js` – walker movement, digging and hard rock, battery, caches, bridge pads, recall, fast travel
- `js/hazards.js` – unstable rock cave-ins
- `js/base.js` – the train base: storage, shop, forge, computer and mods, nano-bots
- `js/walker.js` – the Canopy Walker mech (every part, every facing, walk and dig animation)
- `js/render.js` – drawing the cave, town, train, effects, the minimap and the nano-bot window
- `js/ui.js` – HUD and the base panel (shop, forge, lab, storage, outposts, cargo)
- `js/input.js` – keyboard and touch joystick
- `js/main.js` – start-up and the main loop
- `docs/balancing.xlsx` – planning copy of the numbers (doesn't change the game)

## v0.2
- Player-controlled robot; dig left, right and down (never up)
- Battery and cargo limits; sell and recharge at the surface or the lift dock
- Extendable lift in the far-left column (dig the shaft clear first)
- Jumping, platforms, and a jetpack on the top leg upgrade
- Two biomes: Topsoil (safe) and Basalt Deeps (loose rock falls)
- Pet: Pip the Mole digs in his own burrow, earns coins offline, and boosts your dig power

## v0.3
- Smooth physics movement with a weighted jump (about 2 blocks with Treads)
- Head-bump on ceilings; step-up assist for small lips
- Dig upward (slower, 50% more battery); loose rock above you can fall when you do
- One-way platforms: jump up through them, hold Down to drop through
- Shop moved beside the lift, standing on undiggable foundation
- Lift extensions can be bought at the dock; extending removes platforms in the shaft
- The lift stops at the dock; keep holding Down to dig or drop below it
- Recall button (keeps half your cargo; a dead battery still loses it all)

## v0.4 – top-down cave
- Switched from a side view with gravity to a top-down 2.5D cave: raised block walls, free 8-direction movement, no jumping or platforms
- "Down the screen" is deeper into the cave; biomes, ore value and hazards still scale with depth
- The lift is now a conveyor down the middle column. Dig its path clear, then build an outpost every 25 m
- Outposts sell ore, recharge your battery and open the full shop; ride the conveyor between them for free
- Legs now set speed and movement battery cost
- Loose rock reworked into unstable rock: once two of its sides are dug open it shakes, then caves in, leaving rubble
- Older saves start fresh (the world shape changed)

## v0.5
- Flipped the view: base at the bottom of the screen, the cave goes up from there
- Inventory panel replaces the workshop when you're away from base or an outpost
- Area digging: standing between two blocks digs both
- Low battery warning, with a marker on the battery bar for roughly what the trip back needs
- Fast travel between base and any built outpost
- The Ancient Relic: sealed in a chamber near the end of the Basalt Deeps, past the last outpost. Bring it back to claim 5,000 coins
- Touch joystick replaces swipe controls
- Split the game code into separate files by job
- Removed the leftover platform button

## v0.5.1 – art update
- The robot is now the Canopy Walker: an orange mining mech with a glass canopy, piloted by the mono-eye robot
- Front, back and side views (the walker faces the way it last moved), a walk cycle and dig animations
- Every part tier has its own look: Glass Bubble / Armored Visor / Sensor Dome canopies, Rock Claws / Drill Arms / Plasma Cutters, Small Tank / Twin Tanks / Reactor Tank, Piston Legs / Spring Struts / Hover Jets
- Part names updated to match the art (saves still work; stats unchanged)

## v0.6 – three caves
- The game is now three caves (levels), about 50 m deep each, sharing one base. Pick a cave at base
- Each cave has one outpost halfway in and its own relic at the end; bringing a relic home unlocks the next cave
  - Cave 1 · Topsoil Hollow: soft soil, copper and silver, a little granite
  - Cave 2 · Granite Rift: lots of granite, some obsidian, a chasm across the cave, relic sealed in granite
  - Cave 3 · Basalt Deeps: gold and crystal, granite and obsidian, a chasm and pits, falling unstable rock, relic sealed in obsidian
- Hard rock: Granite needs Drill Arms, Obsidian needs Plasma Cutters. Pushing into it with weaker arms shows "Too hard" and tells you what you need
- Chasms block the walker. Cross on the old bridge, or stand on a bridge pad and pay coins to deploy a new one
- Treasure caches hidden in the rock: coins plus the cave's best ore. Canopies with a scanner reveal them nearby
- Open caverns with stalagmites (and crystals in the Basalt Deeps)
- Minimap of everything you've explored in the current cave
- Ore is worth more in deeper caves. Coins, parts and the pet carry over from v0.5 saves (the cave layout starts fresh)

## v0.7 – the town
- You now start in a town with three cave gates. Walk into an open gate to enter that cave; walk out a cave's TOWN door to return
- Gates are sealed until you bring home the previous cave's relic, which then sits on its pedestal in town
- Each cave has a free outpost at its entrance, plus the halfway outpost you build with the conveyor. Fast travel works between them
- Relic rewards are smaller (300 / 800 / 2,000 coins) now that relics are keys
- Bridge pads use cave-specific bridge keys instead of coins. Each cave hides one marked key cache per bridge pad before the chasm (visible once your light reaches it)
- Cave 2 keeps its old bridge; Cave 3 has no old bridge and two bridge pads
- Unstable rock is harsher: it collapses faster, starts falling as you pass by, and sets off nearby unstable rock in a chain reaction
- Recall and a dead battery now bring you back to the cave's entrance outpost

## v0.7.1 – town touch-ups
- Relic pedestals now stand beside each cave's gate, with grass underneath trees and pedestals
- A train station along the bottom of town (the line to other towns isn't open yet)
- The town is fitted between the HUD and the controls so nothing hides under them

## v0.8 – the train base, materials and the computer
- The train in town is your home base: Engine, Forge, Lab and Storage cars. Stand at a car's door to use it
- Ore isn't sold automatically any more. Outposts send it home on the conveyor to the storage car
- Every block you dig pays coins (more for hard rock and deeper caves)
- The SHOP sells parts and buys ore and materials from storage. Parts are only sold in town now
- The Forge refines ore into wire, circuits, conductors and lenses on short timers that keep running while you're away
- The Lab's computer: a 2×2 grid of fixed-shape mods (9 mods). Build them with materials and coins, upgrade them with Flux
- Pip is retired. The first nano-bot comes with the Ember Idol and makes Flux, shown working in the nano-bot window
- Saves start fresh in this version
- Balancing sheet updated: block coins, materials and mods tabs

## The plan (agreed October 2026)

### v0.8 – the train base, materials and the computer (done)
- **The train is your home base** and travels with you to every town. Cars:
  - Engine car – travels between towns (later: upgrades to reach new biomes)
  - Forge car – refines ore into materials on a timer (short timers while testing)
  - Lab car – the Computer menu: place mods and assign the nano-bot
  - Storage car – holds ore and materials. Unlimited for now (later: a size limit you upgrade)
- **Ore is no longer sold automatically.** Outposts send your cargo home along the conveyor into train storage
- **Coins per block dug**, more for harder rock, so you earn while digging
- **Town shop** buys ore and materials, so selling is a choice
- **Materials**: copper → wire, silver → circuits, gold → conductors, crystal → lenses
- **Computer slots**: a grid where every mod is a fixed-shape block (no rotation), like Tetris
  - Starts 2×2: 2 passive cells, plus 2 active cells that open after the first town
  - Lesser mods are 1 cell; stronger mods are bigger shapes
  - Mods are built with materials and coins, and upgraded with Flux
  - Placing: drag and drop or tap-tap on desktop, tap-tap on phones
- **Nano-bots replace Pip** (Pip's design is saved for a future shopkeeper)
  - The first nano-bot comes with the Ember Idol (Cave 1's relic), so it can't be missed
  - Nano-bots make Flux; a small window shows them working
  - Flux upgrades mods, buys nano-bot slots, powers the computer, and installs expansion slots
- Old saves are not carried over for this update

### v0.9 – tools, reactive blocks and active skills
- Reactive blocks: falling sand, rolling boulders, flooding water, gas pockets
- Tools you buy and carry: blast charges, support beams, flares, grapple
- Fragile and special ore (crystal that shatters with strong tools, "hot" ore, heavy cargo)
- Cave events: tremors, gas leaks
- Active skills (1 at a time): dash, drill burst, scan pulse, shield, charged attack. The nano-bots recharge them; some also cost battery

### v0.10 – blueprints and better parts
- Blueprints drop from caches, contracts and relic rooms and unlock upgraded mech parts
- Parts as loot with rarities and perks

### After that
- Contracts board, repairing the train, Town 2
- End of each town: a computer expansion (+2 cells) that costs Flux to install
- Combat with split dig and combat arms; creatures
- Hand-built rooms and small puzzles inside caves
- More nano-bots and nano-bot jobs (Refine, Repair, Scout), with an offline cap
- First-time hints for each new system, and sounds
- Nano-Bots: rework pets into nano-bots that live inside the robot, still giving bonuses and passive coins
- Ways for pets / nano-bots to interact with the player
- More pets with their own movement patterns (bat, worm, drone)
- Lava and gas hazards, hidden but hinted by a glow in nearby blocks
- More biomes
- A relic at the bottom of each biome
- Prestige (rebuild the bot for a permanent bonus)
- Separate game modes: timed or challenge runs
- Store release (mobile and PC)
- New artwork for the 2.5D style, including up and down facing for the robot (next, after v0.5)
- Replace the base shop with a town (cosmetic at first, still gives shop access)
- Unique caves alongside the biomes, and a way to travel between them
- Sound effects and a mute button
- Save backup (export / import)
- Tutorial for new players
- More upgrade tiers per part
- Redesign the pet view if pets start helping in the player's cave
- Art direction chosen: the Canopy Walker (orange mech with a glass canopy, piloted by the mono-eye robot). Concept board is a Claude artifact
- Interchangeable parts system: parts become items you collect and swap, each with its own stats and abilities
- Possibly a gacha-style system later: summon parts with different rarities, stats and abilities
- Pilot customization (the pilot robot is separate from the mech)
- RPG / adventure direction: each cave is its own level (started in v0.6)
- Player-made custom caves, plus procedurally generated caves to keep things fresh
- Combat: split the arms into two slots, one arm for digging and one for combat
- Contracts from the town (e.g. bring back 10 silver)
- Pilot XP: the pilot levels up separately from the mech, with small perks
- More towns, each with its own caves, linked by the train
- Train upgrades per car: engine reaches new biomes, storage size limit, faster forge, bigger lab
- A nano-bot widget outside the game (much later)
