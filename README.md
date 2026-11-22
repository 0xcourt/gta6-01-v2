# Solmar Heat

![make.fun bounty](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/0xcourt/gta6-01-v2/rank.svg)
![reward](https://make.fun/badge/gta6-01/0xcourt/gta6-01-v2/reward.svg)

An isometric 2.5D open-world crime game, built for the [make.fun bounty "Make GTA 6"](https://make.fun/bounty/gta6-01) on [make.fun](https://make.fun). Vanilla JavaScript + Canvas 2D, ES modules, no libraries, no network at runtime, no external assets — all art is drawn in code and all sound is synthesized with WebAudio.

## The story

Solmar is a sun-soaked coastal city: port and docks, a marina, downtown towers, a beach strip, an industrial zone, hillside villas, and two islands linked by bridges. Rosa "Roxy" Marín, a former getaway driver turned courier, must earn **$25,000** to buy back her late father's garage from rival crew boss **El Toro** — across a 10-mission arc of courier runs, getaways, pickups, a boat chase, and a final heist to take the garage back.

## How to play

Serve the `game/` folder with any static server and open `game/index.html` in desktop Chrome:

```sh
python3 -m http.server 8080 --directory game
# open http://localhost:8080
```

Press **Enter** on the title screen to start. Progress saves to localStorage (press **Q** to quick-save; the title screen offers to load a save).

## Controls

| Key | Action |
| --- | --- |
| W A S D / Arrow keys | Move on foot / drive |
| E | Enter, exit or steal a car / boat |
| F | Punch |
| Mouse aim + click | Shoot pistol / SMG |
| Space | Handbrake |
| P / Esc | Pause |
| M | Mute music & sound |
| Q | Quick-save |
| 1 / 2 / 3 | Fists / Pistol / SMG |

## Systems

- **Explore on foot and by car** — plus a speedboat at the marina; steal any parked car with E.
- **Traffic cars and pedestrians** with simple AI (grid driving, wandering, panic when danger is near).
- **Wanted system, 1–5 stars** — police cars, foot cops and a police boat respond; the level decays when you stay hidden.
- **10 story missions** with dialogue, objectives, checkpoints, races, a boat chase and a final heist.
- **Combat** — fists and pistol/SMG with ammo, health and armor; violence raises your wanted level.
- **Money progression** — earn cash from missions, buy weapons, ammo, armor, cars and safehouse upgrades at the shop.
- **HUD** — cash, health, wanted stars, mission objective, clock, plus a live minimap.
- **Start menu, pause, game over and restart; save/load via localStorage.**
- **Day/night cycle** with a sunset palette, neon signs and lit windows at night.
- **Synth radio music and sound effects** (WebAudio, M to mute).
- **Deterministic** — seeded RNG everywhere; screenshot poses via `?shot=start|play|chase|end&seed=1`.

## Tests

```sh
node tests/logic.test.mjs
```

## Entry

`main.ts` (Node 22, stdlib only) copies `game/` and `screenshots/` to `/output` (or `$MAKEFUN_OUTPUT_DIR`) and writes `/output/dossier.json`.
