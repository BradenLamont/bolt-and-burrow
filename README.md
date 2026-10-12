# Bolt & Burrow

A browser mining game: steer a robot with swappable parts down through the earth, haul ore back up, and upgrade.

**Play:** open `index.html`, or publish the repo with GitHub Pages.

## Controls
- Desktop: arrow keys or WASD to move in any direction; push into a block to dig it; stand on the conveyor and hold Up or Down to ride it
- Phone: swipe and hold to move and dig (diagonals work)
- Recall button: emergency trip back to base, keeping half your ore

## Files
- `index.html` – page layout
- `css/style.css` – look and layout
- `js/config.js` – every balance number (part stats, costs, block toughness, lift, pet)
- `js/game.js` – game logic

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
