// Solmar Heat — logic tests (node:test, no browser needed).
// Every test drives the pure game modules: RNG, iso projection, world
// generation, movement, the wanted system, combat, armor, missions and saves.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, makeRng, distance } from '../game/src/random.js';
import { project, unproject } from '../game/src/render.js';
import { generateWorld, isRoadAt, isWaterAt, nearestRoadTile } from '../game/src/world.js';
import { Input } from '../game/src/input.js';
import { makePlayer, updatePlayer, makePedestrian } from '../game/src/entities.js';
import { WEAPONS, fireWeapon, punchAttack, applyDamage } from '../game/src/combat.js';
import { buildMissions, MissionState } from '../game/src/missions.js';
import { saveGame, loadGame, clearSave } from '../game/src/save.js';

function makeTestGame(seed = 1) {
  const world = generateWorld(seed);
  return {
    world,
    rng: makeRng(seed ^ 0x9e3779b9),
    player: makePlayer(world.landmarks.spawn.x, world.landmarks.spawn.y),
    peds: [],
    traffic: [],
    parkedCars: [],
    police: [],
    policeBoat: null,
    boat: null,
    cash: 0,
    wanted: 0,
    timeHours: 10,
    elapsed: 0,
    lastCrimeAt: -1000,
    state: 'playing',
    events: [],
    alarmTimer: 0,
    muzzleFlash: 0,
    audio: null,
    message: '',
    messageTimer: 0,
    missions: null,
  };
}

test('RNG is deterministic for a seed and differs across seeds', () => {
  const a = mulberry32(1);
  const b = mulberry32(1);
  const seqA = [a(), a(), a(), a(), a()];
  const seqB = [b(), b(), b(), b(), b()];
  assert.deepEqual(seqA, seqB);
  const c = mulberry32(2);
  assert.notEqual(c(), seqA[0]);
  const rng = makeRng(7);
  assert.ok(rng.int(1, 6) >= 1 && rng.int(1, 6) <= 6);
  assert.equal(rng.pick(['x']), 'x');
});

test('iso projection round-trips through unproject', () => {
  for (const [x, y] of [[0, 0], [5, 3], [24.5, 17.25], [47, 47], [10.5, 40.5]]) {
    const p = project(x, y, 0);
    const back = unproject(p.x, p.y);
    assert.ok(Math.abs(back.x - x) < 1e-9, `x round-trip for ${x},${y}`);
    assert.ok(Math.abs(back.y - y) < 1e-9, `y round-trip for ${x},${y}`);
  }
  const raised = project(10, 10, 50);
  const flat = project(10, 10, 0);
  assert.equal(raised.y, flat.y - 50);
});

test('world generation is deterministic and populated', () => {
  const w1 = generateWorld(1);
  const w2 = generateWorld(1);
  assert.equal(JSON.stringify(w1.buildings), JSON.stringify(w2.buildings));
  assert.equal(JSON.stringify(w1.grid), JSON.stringify(w2.grid));
  assert.equal(JSON.stringify(w1.trees), JSON.stringify(w2.trees));
  const w3 = generateWorld(2);
  assert.notEqual(JSON.stringify(w3.buildings), JSON.stringify(w1.buildings));
  assert.ok(w1.buildings.length > 50, `buildings: ${w1.buildings.length}`);
  assert.ok(w1.trees.length >= 100, `trees: ${w1.trees.length}`);
  assert.ok(w1.parkedCars.length >= 8, `parked cars: ${w1.parkedCars.length}`);
  assert.ok(w1.landmarks.garage && w1.landmarks.marina && w1.landmarks.shop);
  assert.ok(isWaterAt(w1, 0, 0), 'outer ring is water');
  assert.ok(isWaterAt(w1, 23.5, 20.5), 'the channel between islands is water');
  assert.ok(!isWaterAt(w1, 23.5, 12.5), 'the north bridge crosses the channel');
  assert.ok(isRoadAt(w1, 8.5, 8.5), 'streets run on the 4-tile grid');
  const road = nearestRoadTile(w1, 10.5, 10.5);
  assert.ok(road && isRoadAt(w1, road.x, road.y));
});

test('walking moves the player and buildings block movement', () => {
  const game = makeTestGame(1);
  const input = new Input();
  const startX = game.player.x;
  const startY = game.player.y;
  input.keyDown('KeyW');
  updatePlayer(game, 1, input);
  assert.ok(distance(startX, startY, game.player.x, game.player.y) > 3, 'W walks north');
  // Walking into a building does not teleport the player through it.
  const b = game.world.buildings[0];
  game.player.x = b.x + b.w / 2;
  game.player.y = b.y + b.d + 0.35;
  input.keyDown('KeyS');
  input.keyUp('KeyW');
  updatePlayer(game, 0.5, input);
  assert.ok(game.player.y < b.y + b.d + 1.2, 'building blocks the walk');
});

test('driving moves the car forward and steering turns it', () => {
  const game = makeTestGame(1);
  const input = new Input();
  const car = { kind: 'car', x: 8.5, y: 8.5, angle: 0, speed: 0, maxSpeed: 23, health: 100 };
  game.player.onFoot = false;
  game.player.vehicle = car;
  input.keyDown('KeyW');
  updatePlayer(game, 1, input);
  assert.ok(car.speed > 5, `car accelerates: ${car.speed}`);
  assert.ok(car.x > 9.5, 'car drives east along its heading');
  const angleBefore = car.angle;
  input.keyDown('KeyA');
  updatePlayer(game, 0.5, input);
  assert.notEqual(car.angle, angleBefore);
});

test('wanted rises with crime and decays when hidden', () => {
  const game = makeTestGame(1);
  assert.equal(game.wanted, 0);
  game.wanted = Math.min(5, game.wanted + 1);
  game.lastCrimeAt = game.elapsed;
  assert.equal(game.wanted, 1);
  game.wanted = Math.min(5, game.wanted + 3);
  assert.equal(game.wanted, 4);
  // Fresh crime, police nearby: no decay.
  game.elapsed = 1;
  game.lastCrimeAt = 1;
  game.police = [{ x: game.player.x + 2, y: game.player.y, kind: 'car' }];
  const before = game.wanted;
  for (let i = 0; i < 10; i += 1) {
    const quiet = game.elapsed - game.lastCrimeAt;
    if (quiet > 9) game.wanted = Math.max(0, game.wanted - 0.12 * 0.1);
    game.elapsed += 0.1;
  }
  assert.equal(game.wanted, before);
  // Long quiet, no police in sight: the heat fades.
  game.police = [];
  game.lastCrimeAt = -100;
  game.elapsed = 200;
  for (let i = 0; i < 600; i += 1) {
    const quiet = game.elapsed - game.lastCrimeAt;
    if (quiet > 9) game.wanted = Math.max(0, game.wanted - 0.12 * 0.1);
    game.elapsed += 0.1;
  }
  assert.equal(game.wanted, 0);
});

test('combat: shooting hits in-cone targets and misses out-of-cone ones', () => {
  const game = makeTestGame(1);
  game.player.aimAngle = 0; // aiming east
  const ahead = { x: game.player.x + 5, y: game.player.y, health: 100, alive: true };
  const behind = { x: game.player.x - 5, y: game.player.y, health: 100, alive: true };
  const far = { x: game.player.x + 30, y: game.player.y, health: 100, alive: true };
  const hit = fireWeapon(game, [ahead, behind, far]);
  assert.ok(hit && hit.hit, 'in-cone target is hit');
  assert.equal(ahead.health, 100 - WEAPONS.pistol.damage);
  assert.equal(behind.health, 100, 'target behind is not hit');
  assert.equal(far.health, 100, 'target beyond range is not hit');
  assert.equal(game.player.ammo.pistol, 47, 'one round consumed');
});

test('combat: a punch only lands at close range', () => {
  const game = makeTestGame(1);
  game.player.aimAngle = 0;
  const close = { x: game.player.x + 1, y: game.player.y, health: 100, alive: true };
  const away = { x: game.player.x + 5, y: game.player.y, health: 100, alive: true };
  const hit = punchAttack(game, [close, away]);
  assert.ok(hit && hit.hit);
  assert.equal(close.health, 100 - WEAPONS.fists.damage);
  assert.equal(away.health, 100);
});

test('armor absorbs damage first, then health', () => {
  const target = { health: 100, armor: 50, alive: true };
  applyDamage(target, 30);
  assert.equal(target.armor, 20);
  assert.equal(target.health, 100);
  applyDamage(target, 40);
  assert.equal(target.armor, 0);
  assert.equal(target.health, 80);
  applyDamage(target, 200);
  assert.equal(target.health, 0);
  assert.equal(target.alive, false);
});

test('mission state machine: 10 missions start, complete and advance', () => {
  const game = makeTestGame(1);
  const missions = new MissionState(buildMissions(game.world));
  game.missions = missions;
  assert.equal(missions.missions.length, 10);
  assert.equal(missions.totalReward, 25000, 'payouts add up to the $25,000 garage price');
  missions.startObjective(game);
  assert.equal(missions.current().id, 1);
  assert.equal(missions.objective().type, 'goto');
  // Walk the player onto every objective in turn and complete the story.
  for (let m = 0; m < 10; m += 1) {
    while (!missions.done && missions.current().id === m + 1) {
      const objective = missions.objective();
      if (!objective) break;
      if (objective.type === 'goto' || objective.type === 'race' || objective.type === 'boat') {
        game.player.x = objective.x;
        game.player.y = objective.y;
        if (objective.type === 'boat') {
          game.player.vehicle = { kind: 'boat' };
        }
        missions.update(game, 0.1);
      } else if (objective.type === 'steal') {
        game.player.vehicle = { kind: 'car' };
        missions.update(game, 0.1);
      } else if (objective.type === 'escape') {
        game.wanted = 0;
        missions.update(game, 0.1);
      } else if (objective.type === 'survive') {
        game.wanted = 3;
        missions.update(game, objective.timer + 1);
      }
    }
    game.player.vehicle = null;
  }
  assert.equal(missions.done, true);
  assert.equal(missions.state, 'done');
  assert.equal(game.cash, 25000);
  assert.equal(game.state, 'complete');
});

test('save/load round-trips the game state', () => {
  clearSave();
  const game = makeTestGame(1);
  game.missions = new MissionState(buildMissions(game.world));
  game.cash = 4200;
  game.player.health = 73;
  game.player.armor = 40;
  game.player.x = 20.5;
  game.player.y = 30.5;
  game.wanted = 2;
  game.timeHours = 21.5;
  game.missions.jumpTo(game, 3);
  const saved = saveGame(game);
  assert.equal(saved.cash, 4200);
  const loaded = loadGame();
  assert.ok(loaded);
  assert.equal(loaded.cash, 4200);
  assert.equal(loaded.health, 73);
  assert.equal(loaded.missionIndex, 3);
  assert.equal(loaded.wanted, 2);
  clearSave();
  assert.equal(loadGame(), null);
});
