# Bolt & Burrow

A browser mining game: steer a robot with swappable parts down through the earth, haul ore back up, and upgrade.

**Play:** open `index.html`, or publish the repo with GitHub Pages.

## Controls
- Desktop: arrow keys or WASD to move. Push into blocks to dig them (standing between two blocks digs both). Up goes deeper into the cave. Stand on the conveyor and hold Up or Down to ride it.
- Phone: touch and drag anywhere on the cave for a joystick.
- Recall button: emergency trip back to base, keeping half your ore.

## Files
- `index.html` – page layout and script load order
- `css/style.css` – look and layout
- `js/config.js` – every balance number (part stats, costs, blocks, conveyor, relic, pet)
- `js/state.js` – shared game state, saving, helpers
- `js/world.js` – cave generation, conveyor and outposts, relic chamber
- `js/player.js` – robot movement, digging, battery, recall, fast travel
- `js/hazards.js` – unstable rock cave-ins
- `js/pet.js` – Pip the Mole
- `js/render.js` – all drawing
- `js/ui.js` – HUD, workshop, inventory
- `js/input.js` – keyboard and touch joystick
- `js/main.js` – start-up and the main loop

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

## Ideas for later
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
