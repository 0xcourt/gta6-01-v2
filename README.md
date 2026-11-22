# Solmar Heat

![gta6-01](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/0xcourt/gta6-01-v2/rank.svg)
![reward](https://make.fun/badge/gta6-01/0xcourt/gta6-01-v2/reward.svg)

An open-world crime game for the [gta6-01 bounty](https://make.fun/bounty/gta6-01) on [make.fun](https://make.fun). Vanilla JavaScript + Canvas 2D, ES modules, no libraries, no network at runtime, no external assets — all art is drawn in code and all sound is synthesized with WebAudio.

## The story

Rosa "Roxy" Marín, a former getaway driver turned courier, must earn **$25,000** to buy back her late father's garage from rival crew boss **El Toro**. A 10-mission arc runs through courier deliveries, car theft, timed getaways, a boat chase across the bay, and a final heist to take the garage back. The ten mission payouts add up to exactly $25,000.

## The city

Solmar is a seeded, deterministic island city: a port and docks, a marina, downtown towers with neon, a beach strip, an industrial zone, and hillside villas — plus an east island and a southern beach islet, all linked by bridges over the water. Buildings are isometric boxes of varying heights, roads run on a grid, palm trees and props fill the blocks, and a day/night cycle shifts the palette from sun to sunset to neon-lit night.

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrows | Walk / drive (W accelerate, S brake/reverse, A/D steer) |
| E | Enter/exit/steal a car or boat, open the corner shop |
| Mouse aim + click | Shoot |
| F | Punch |
| Space | Handbrake |
| 1 / 2 / 3 | Fists / pistol / SMG (in the shop: buy items) |
| P / Esc | Pause |
| M | Mute |
| Q | Quick-save |
| L | Load save |
| R | Restart (after game over / story complete) |

## Systems

- **On foot, by car, by speedboat** — steal parked cars, drive the road grid, take the boat from the marina.
- **Traffic and pedestrians** — traffic cars follow the roads, pedestrians wander the sidewalks and panic when danger is near.
- **Wanted system (1–5 stars)** — rises when you steal cars, shoot, or hit pedestrians; police cars, foot cops, and a police boat respond, scaling with the star level; the level decays when you stay hidden and quiet.
- **Combat** — fists, pistol and SMG with ammo, health and armor (armor absorbs damage first).
- **Money progression** — mission payouts plus a corner shop selling weapons, ammo, armor, car repairs and more.
- **HUD + live minimap** — cash, health/armor bars, wanted stars, mission tracker, in-game clock, radio station, and a minimap showing the city, the player, police, and the mission marker.
- **Synth radio** — two WebAudio stations (SOLMAR FM, PALM WAVE) plus synthesized effects for shots, pickups, crashes and sirens.
- **Save/load** — quick-save with Q, load with L, via localStorage.
- **Deterministic screenshot poses** — `?shot=start|play|chase|end&seed=1`.

## How to run

```sh
node serve.ts        # then open http://localhost:8080
```

Or serve `game/` with any static file server and open `game/index.html`.

## How to test

```sh
node tests/logic.test.mjs
```

The logic tests cover RNG determinism, iso projection round-trips, deterministic world generation, driving/walking, the wanted system, combat and armor, the 10-mission state machine, and save/load.

## Files

| File | Job |
| --- | --- |
| `game/src/config.js` | Tuning constants, palettes, prices |
| `game/src/random.js` | mulberry32 RNG + math helpers |
| `game/src/world.js` | Seeded city generation (districts, roads, bridges, marina) |
| `game/src/input.js` | Keyboard/mouse state |
| `game/src/entities.js` | Player, pedestrians, traffic, police + their AI |
| `game/src/missions.js` | 10-mission story and state machine |
| `game/src/combat.js` | Weapons, shooting cones, armor/damage |
| `game/src/audio.js` | WebAudio synth radio + SFX |
| `game/src/render.js` | Isometric renderer, HUD, minimap, screens |
| `game/src/shots.js` | Deterministic screenshot poses |
| `game/src/save.js` | localStorage save/load |
| `game/src/main.js` | Game loop, state machine, wiring |
| `main.ts` | Entry program: copies the game to `/output` + writes `dossier.json` |
