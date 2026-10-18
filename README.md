# Bolt & Burrow

A browser mining game: steer a robot with swappable parts down through the earth, haul ore back up, and upgrade.

**Play:** open `index.html`, or publish the repo with GitHub Pages.

## Controls
- Desktop: arrow keys or WASD to move. Push into blocks to dig them (standing between two blocks digs both). Up goes deeper into the cave. Stand on the conveyor and hold Up or Down to ride it. E (or the action button) opens the train car, shop stand, counter or outpost you're standing at (the game pauses while it's open; E or Esc closes it), uses a bridge pad, or boards the train. Walk into an open gate in town to enter a cave; walk out the TOWN door to leave. In town, walk through the SHOP door to go inside, or stand at a train car's door to use it.
- Computer (Lab car): tap a mod, then tap a cell. With a mouse you can also drag mods onto the grid.
- F or J: attack with your weapon arm the way you face (or click the cave with a mouse to aim; ATTACK button on phones). Hold to keep attacking.
- Space or Q: use your active skill. 1–4: use tools from your belt (or tap the buttons by Recall).
- Esc or P (or the ⏸ button): the pause menu, with Mech & cargo, Train cars, Map, and Settings & hints (sound, volume, zoom, full screen, backup, reset, and every hint you've seen). M: sound on/off. ⛶ button: full screen.
- Phone: touch and drag anywhere on the cave for a joystick.
- Recall button: emergency trip back to the cave entrance, keeping half your ore.

## Files
- `index.html` – page layout and script load order
- `css/style.css` – look and layout
- `js/config.js` – every balance number (part stats, costs, blocks, conveyor, relic, materials, mods, nano-bots)
- `js/state.js` – shared game state, saving, helpers
- `js/sound.js` – sound effects (made in code, no sound files) and mute
- `js/world.js` – the town and the three caves: generation, conveyor and outposts, chasms and bridges, caches, relic chambers, moving between town and caves
- `js/player.js` – walker movement, digging and hard rock, battery, caches, bridge pads, recall, fast travel
- `js/hazards.js` – unstable rock, sand, boulders, flood water and gas pockets
- `js/gear.js` – the tool belt and active skills
- `js/trip.js` – riding the train between towns (boarding, the drilling scene, unloading)
- `js/combat.js` – the weapon arm, enemies, bosses and the hull
- `js/loot.js` – ore pixels, ore drops and the magnet, and the Computer car's Flux upgrades
- `js/base.js` – the train base: storage, shop, forge, computer and mods, nano-bots
- `js/walker.js` – the Canopy Walker mech (every part, every facing, walk and dig animation)
- `js/render.js` – drawing the cave, town, train, effects, the minimap and the nano-bot window
- `js/ui.js` – HUD, the tip line, key cues, and the pop-ups for train cars, shop stands, the counter and outposts
- `js/menu.js` – the pause menu tabs, settings, full screen and the nano-bot box
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

## v0.8.1 – Pip's shop
- Walk through the SHOP door to go inside. Pip the Mole runs the shop from behind his counter
- Each part has its own display stand: walk up to one to see every tier and buy the next (or press E)
- Sell ore and materials to Pip at the counter
- Ore and materials are worth about 50% more, so selling ore beats block coins again

## v0.9 – tools, reactive blocks and skills
- Caves slope toward their entrance. Cave 1 has sand that slides, Cave 2 has boulders that roll (walk into one to push it) and water pockets that flood your tunnels, and Cave 3 has gas pockets that explode if you dig next to them
- Pip sells tools at the counter for your belt: blast charge, support beam, flare and grapple. 3 belt slots, +1 per Tank upgrade. Keys 1–4 or the on-screen buttons
- Active skills: Dash, Drill Burst, Scan Pulse and Shield. They go in the computer's bottom row, which opens when you bring home the Core Heart. One at a time; the nano-bot recharges it. Space or Q to use
- Sound effects with a mute button
- First-time hints for every new place and system, remembered with your save
- Save backup: make a code or download a file, and load either one back
- Cave layouts rebuild once so the new blocks appear (your progress is kept)

## v0.10 – the Drill Liner and Rustvale
- The train is now the Drill Liner: a drill-nosed engine with a mech hold (roof doors and a side window), a small crane deck, a forge car with chimneys and a grated furnace, a lab car with a glass dome showing your computer grid, and a storage car whose ore pile grows with what you've stored
- Board at the Engine car: the hold doors open, the crane lifts your mech in, your pilot walks through to the cab, the crane folds and the doors close. Then a short drilling scene, and the same steps in reverse at the other end. Any key or tap skips it
- The line opens when you bring home the Core Heart (or press T five times in town to test it early)
- Rustvale, a placeholder Town 2: its own colours and name sign, a closed shop, and a test cave behind its first gate (a mix of every hazard). The other two gates say "coming soon"
- Your whole train comes with you, so the forge, lab and storage work in both towns
- New sounds for the doors, the crane, the drill and arriving; town names on the platform sign and in the HUD

## v0.11 – two arms, enemies and bosses
- The mech now has a dig arm and a weapon arm. The dig arm hits a cone: the block ahead takes full damage, the blocks beside it 40%, and with Drill Arms or better the block behind it 30%. Hard rock still needs the right tier
- Weapon arm (F / J, click to aim, or the ATTACK button). Five weapons from the new weapon rack in Pip's shops, each upgradable to Mk II and Mk III with coins and materials:
  - Melee: Wrench (free starter), Rock Hammer (cracks armour, best at mining, breaks granite)
  - Ranged: Rivet Gun
  - Defensive: Gravity Bulwark (pulls enemies together and stuns them; halves frontal damage)
  - Support: Stun Pulse (stuns everything nearby and marks enemies to take +50% damage)
- Weapons also chip at blocks, less than the dig arm
- New Hull bar: enemies damage it, Tank upgrades raise it, outposts repair it. At zero a drone recalls you (you keep half your ore)
- Enemies: Hollowmouth has Grubs, Cave Bats and Spitters; Rustvale's test cave has Rock Crabs and Magma Mites. They reset each time you enter a cave and drop coins
- Mini-bosses guard a hall before the relic: the Grub Mother (Cave 1) and the Crystal Warden (Cave 2)
- Cave 3 ends in an obsidian-walled boss room: the Basalt Golem slams shockwaves, calls bats when hurt, and drops the Core Heart
- Boss health bar; cave layouts rebuild once for the boss halls (progress kept)
- Balancing sheet: new Weapons and Enemies tabs

## v0.10.1 – Pip's two shops
- Hollowmouth: the Burrow Workshop, a grassy mound with a round 2-block double door, chimney, round window and lanterns. Inside: a dirt floor, a round rug, lanterns, pegboard displays and a tree-stump counter
- Rustvale: the Salvage Garage, corrugated metal with a 2-block roller door, a glowing PIP'S SALVAGE sign and a roof gantry. Inside: steel floor plates, a mech lift with robot arms, steel shelves and a workbench counter (Pip wears a hard hat)
- Both shop doors are 2 blocks wide, outside and in, so they're easy to walk into
- Rustvale now has a shop, so you can buy and sell in both towns

## v0.12 – ore drops and the Computer car
- Every ore block shows 1–4 ore "pixels" scattered across it, and each pixel is one piece of ore
- Breaking an ore block (or a cache, or an enemy that carries ore) pops the pieces out onto the floor. Your mech's magnet pulls in anything nearby; walk closer to grab the rest
- Block coins still go straight to you
- With full cargo the pieces stay on the floor until you leave the cave, so you can send a load home and come back for them
- New fifth car on the train: the Computer car. Spend Flux on permanent upgrades, 5 levels each:
  - Magnet: +0.7 blocks pickup range per level, and a faster pull
  - Hull Plating: +15 max hull per level
  - Damage Mitigation: −6% damage taken per level (up to −30%)
  - Field Repair: +0.5 hull a second in the caves per level
  - Weapon Power: +10% weapon damage per level
- Balancing sheet: new Flux upgrades tab

## v0.12.1 – full screen
- The game fills the whole window. A strip on top holds the HUD and a tip line (messages, first-time hints, and what you can do where you're standing); a strip at the bottom holds the key cues and buttons. Nothing covers the game except the minimap and the nano-bot box
- The panels under the game are gone. Train cars, shop stands, Pip's counter and outposts open as pop-ups when you press E (or tap Open …). The game pauses while one is open
- Pause menu (Esc, P or ⏸) with four tabs: Mech & cargo, Train cars (a read-only look from anywhere), Map (the whole explored cave, plus every cave's progress) and Settings & hints
- Settings: sound on/off (or M) and volume, cave zoom (Close / Normal / Far / Farther), full screen, the nano-bot box, controls, save backup, reset, and a log of every hint you've seen
- Full-screen button (⛶) hides the browser's bars and turns phones sideways where the browser allows it
- The nano-bot window sits in the bottom-right corner. Tap its header to shrink it to a Flux counter; it shrinks itself in town so the train stays in view, and turns see-through when your mech walks under it
- On a phone held upright the town fills the screen's height and scrolls sideways

## v0.12.2 – polish
- Fixed the screen flashing when you walked up to something you can use or opened a pop-up: the Open button made the bottom strip a few pixels taller, which resized (and blanked) the game for a frame. The bottom strip is now a fixed height, and the game redraws straight away whenever it does resize
- Two new Flux upgrades in the Computer car: Prospector's luck (8% a level chance of one more ore piece from each ore block) and Scanner range (+1 block a level, and it works even if your canopy has no scanner)
- Pop-ups work from the keyboard: W/S or the arrow keys pick a button, E presses it, and E with nothing picked (or Esc) closes it
- Phones turned sideways get a slim one-row HUD and a one-line tip, so the game keeps more of the screen
- Picking up several pieces of the same ore shows one stacking counter ("+3 copper") instead of a float per piece
- Entering a cave starts the camera a little higher, so your mech isn't on the bottom edge
- Switching tabs or windows opens the pause menu, so nothing can hit you while you're away
- In town, the tip line says when your hull is being repaired
- Balancing sheet: the two new upgrades on the Flux upgrades tab

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

### v0.9 – tools, reactive blocks and active skills (done)
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
- More nano-bots with their own movement patterns, and interactions between them
- Spend Flux to speed up the nano-bot's paths between chips, or to upgrade the chips themselves
- Train upgrades per car: engine reaches new biomes, storage size limit, faster forge, bigger lab
- A nano-bot widget outside the game (much later)
