// Solmar Heat — logic tests. Plain node, no dependencies.
// Run: node tests/logic.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, makeRng, iso, isoInverse, clamp } from '../game/src/random.js';
import { generateWorld, buildingAt } from '../game/src/world.js';
import { addWanted, decayWanted, policeCountFor, applyDamage, shoot, punch } from '../game/src/combat.js';
import { MISSIONS, makeMissionState, startMission, completeMission, advanceMission, missionById } from '../game/src/missions.js';
import { serializeSave, deserializeSave, saveGame, loadGame, hasSave } from '../game/src/save.js';
import { makePlayer, makeCar, carDef, driveCar, walkPlayer } from '../game/src/entities.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
}

test('RNG is deterministic: same seed, same sequence', () => {
  const a = mulberry32(42), b = mulberry32(42);
  for (let i = 0; i < 50; i++) assert.equal(a(), b());
  const c = mulberry32(43);
  assert.notEqual(a(), c());
  const r1 = makeRng('solmar'), r2 = makeRng('solmar');
  assert.equal(r1.range(0, 100), r2.range(0, 100));
  assert.equal(r1.pick(['a', 'b', 'c']), r2.pick(['a', 'b', 'c']));
});

test('iso projection round-trips', () => {
  for (const [x, y] of [[0, 0], [400, 200], [1200, 800], [2400, 2400]]) {
    const p = iso(x, y);
    const back = isoInverse(p.x, p.y);
    assert.ok(Math.abs(back.x - x) < 0.001 && Math.abs(back.y - y) < 0.001);
  }
  assert.equal(clamp(99, 0, 10), 10);
});

test('world generation is deterministic and populated', () => {
  const w1 = generateWorld(1), w2 = generateWorld(1);
  assert.equal(w1.buildings.length, w2.buildings.length);
  assert.equal(w1.palms.length, w2.palms.length);
  assert.ok(w1.buildings.length > 40, 'city has buildings');
  assert.ok(w1.palms.length > 50, 'beach has palms');
  assert.equal(w1.garage.name, 'Marin Garage');
  assert.ok(w1.isWater(100, 2200), 'southern sea is water');
  assert.ok(!w1.isWater(1000, 1000), 'downtown is land');
  assert.ok(w1.isRoad(10, 500), 'grid roads exist');
  const b = w1.buildings[0];
  assert.equal(buildingAt(w1, b.x + 5, b.y + 5), b);
  assert.equal(buildingAt(w1, 1000, 1000), null);
  const w3 = generateWorld(7);
  assert.notEqual(w3.buildings.length, w1.buildings.length, 'different seed, different city (usually)');
});

test('driving and walking move the player', () => {
  const car = makeCar(carDef('sedan'), 500, 500, 0);
  driveCar(car, { forward: true, back: false, left: false, right: false, brake: false }, 1);
  assert.ok(car.x > 500 && car.speed > 0);
  const p = makePlayer(500, 500);
  walkPlayer(p, { up: false, down: true, left: false, right: false }, 1);
  assert.ok(p.y > 500);
});

test('wanted level rises with crime and decays when hidden', () => {
  const s = { wanted: 0, wantedTimer: 0, hidden: false };
  assert.equal(addWanted(s, 'stealCar'), 1);
  assert.equal(addWanted(s, 'shoot'), 3);
  assert.equal(addWanted(s, 'killCop'), 5, 'caps at 5 stars');
  assert.equal(addWanted(s, 'shoot'), 5);
  // Seen: no decay.
  decayWanted(s, 60, true);
  assert.equal(s.wanted, 5);
  // Hidden long enough: drops one star at a time.
  decayWanted(s, 100, false);
  assert.equal(s.wanted, 4);
  decayWanted(s, 100, false);
  assert.equal(s.wanted, 3);
  const counts = policeCountFor(3);
  assert.deepEqual(counts, { cars: 3, cops: 4, boat: 1 });
  assert.deepEqual(policeCountFor(1), { cars: 1, cops: 0, boat: 0 });
  assert.deepEqual(policeCountFor(0), { cars: 0, cops: 0, boat: 0 });
});

test('combat: shooting hits in-cone targets, punch is close range', () => {
  const rng = makeRng(5);
  const shooter = { x: 0, y: 0 };
  const target = { x: 100, y: 0, r: 18, health: 100 };
  const far = { x: 100, y: 300, r: 18, health: 100 };
  const res = shoot(shooter, 0, [target, far], 'pistol', rng);
  assert.equal(res.hit, true);
  assert.ok(res.damage >= 28 && res.damage <= 40);
  assert.equal(target.health, 100 - res.damage);
  const miss = shoot(shooter, Math.PI, [target], 'pistol', rng);
  assert.equal(miss.hit, false);
  const p = punch(shooter, [{ x: 30, y: 0, r: 18, health: 100 }]);
  assert.equal(p.hit, true);
  assert.equal(p.damage, 12);
});

test('damage respects armor first', () => {
  const t = { health: 100, armor: 30 };
  assert.equal(applyDamage(t, 20), 100);
  assert.equal(t.armor, 10);
  assert.equal(applyDamage(t, 20), 90);
  assert.equal(t.armor, 0);
});

test('mission state machine: 10 missions, start -> complete -> advance', () => {
  assert.equal(MISSIONS.length, 10);
  assert.equal(MISSIONS[9].title, 'Take Back the Garage');
  assert.equal(missionById(99), null);
  const st = makeMissionState();
  const player = makePlayer(0, 0); player.cash = 150;
  startMission(st, 1);
  assert.equal(st.status, 'active');
  assert.equal(st.current, 1);
  const m = completeMission(st, player);
  assert.equal(m.id, 1);
  assert.equal(player.cash, 150 + 400);
  assert.equal(st.status, 'complete');
  advanceMission(st, player);
  assert.equal(st.current, 2);
  assert.equal(st.status, 'active');
  // Walk the whole arc.
  for (let id = 2; id <= 10; id++) { completeMission(st, player); advanceMission(st, player); }
  assert.equal(st.status, 'done');
  assert.equal(st.completed.length, 10);
  assert.equal(st.totalEarned, MISSIONS.reduce((s, x) => s + x.reward, 0));
});

test('save/load round-trip through fake storage', () => {
  const storage = fakeStorage();
  assert.equal(hasSave(storage), false);
  assert.equal(loadGame(storage), null);
  const game = {
    seed: 1,
    player: { ...makePlayer(950, 1450), cash: 4200, health: 80, weapon: 'pistol', ammo: { pistol: 12, smg: 0 }, weaponsOwned: ['fists', 'pistol'] },
    mission: makeMissionState(), wanted: 2, timeOfDay: 0.6,
    carsOwned: ['sedan', 'coupe'], stats: { missionsDone: 3, carsStolen: 2, arrests: 0 },
  };
  startMission(game.mission, 4);
  assert.equal(saveGame(storage, game), true);
  assert.equal(hasSave(storage), true);
  const back = loadGame(storage);
  assert.equal(back.player.cash, 4200);
  assert.equal(back.player.x, 950);
  assert.equal(back.mission.current, 4);
  assert.equal(back.wanted, 2);
  assert.deepEqual(back.carsOwned, ['sedan', 'coupe']);
  assert.equal(deserializeSave({ version: 99 }), null);
  assert.equal(deserializeSave(null), null);
  const ser = serializeSave(game);
  assert.equal(ser.version, 1);
  assert.equal(deserializeSave(ser).player.cash, 4200);
});
