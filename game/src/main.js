// Solmar Heat — main game: loop, state machine, missions, wanted, shops, save.
// Vanilla JS + Canvas 2D, ES modules, no libraries, no network at runtime.
import { generateWorld, buildingAt } from './world.js';
import { makeRng, clamp, dist, iso, angleTo } from './random.js';
import { CONTROLS, DAY_LENGTH, GARAGE_PRICE, SHOP_ITEMS, CARS, GAME_SUBTITLE } from './config.js';
import { createInput } from './input.js';
import { makePlayer, makeCar, carDef, driveCar, walkPlayer, makePed, updatePed, makeTrafficCar, updateTrafficCar, updatePoliceCar, updateFootCop } from './entities.js';
import { addWanted, decayWanted, policeCountFor, applyDamage, shoot, punch, weaponDef } from './combat.js';
import { MISSIONS, missionById, makeMissionState, startMission, completeMission, advanceMission } from './missions.js';
import { createAudio } from './audio.js';
import { drawWorld, drawCarIso, drawPersonIso, drawMinimap, drawHUD, timeOfDayColor, isNight } from './render.js';
import { applyShot } from './shots.js';
import { saveGame, loadGame, hasSave } from './save.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 1) || 1;
const shot = params.get('shot');

const rng = makeRng(seed);
const world = generateWorld(seed);
const input = createInput(canvas);
const audio = createAudio();

const game = {
  seed, world, screen: 'title', timeOfDay: 0.42, animT: 0,
  player: makePlayer(950, 1450), wanted: 0, wantedTimer: 0, hidden: false,
  mission: makeMissionState(), missionDef: null, missionObjectiveText: '',
  cars: [], peds: [], policeCars: [], footCops: [], bullets: [], pickups: [],
  carsOwned: ['sedan'], carsSpawned: 0, stats: { missionsDone: 0, carsStolen: 0, arrests: 0 },
  camera: { x: 0, y: 0 }, message: '', messageTimer: 0, clockText: '12:00',
  dialogue: null, shopOpen: false, shopIndex: 0, raceTimer: 0, drops: [],
  saveFlash: '', mouseWorld: { x: 0, y: 0 },
};
window.__game = game; // exposed for smoke tests / debugging

function showMessage(text, secs = 4) { game.message = text; game.messageTimer = secs; }
function spawnTraffic(n) {
  const defs = CARS.filter((c) => !['police', 'boat'].includes(c.id));
  for (let i = 0; i < n; i++) {
    const x = rng.range(100, 1900), y = rng.range(100, 1900);
    if (world.isWater(x, y)) continue;
    game.cars.push(makeTrafficCar(rng.pick(defs), x, y, rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), rng));
  }
}
function spawnPeds(n) {
  for (let i = 0; i < n; i++) game.peds.push(makePed(rng.range(100, 1900), rng.range(100, 1900), rng));
}
function spawnParkedCars() {
  const spots = [[1050, 430, 'coupe'], [700, 700, 'sedan'], [1200, 900, 'taxi'], [300, 500, 'pickup'], [1700, 500, 'van'], [900, 1600, 'sedan'], [1400, 1200, 'coupe']];
  for (const [x, y, id] of spots) game.cars.push(makeCar(carDef(id), x, y, rng.angle()));
  const boat = makeCar(carDef('boat'), 1700, 380, 0); game.cars.push(boat);
}
function nearestCar(maxD = 90) {
  let best = null, bd = maxD;
  for (const c of game.cars) {
    const d = dist(game.player.x, game.player.y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
function ensurePolice() {
  const need = policeCountFor(game.wanted);
  while (game.policeCars.length < need.cars) {
    const a = rng.angle();
    const pc = makeCar(carDef('police'), game.player.x + Math.cos(a) * 500, game.player.y + Math.sin(a) * 500, a);
    pc.isPolice = true; game.policeCars.push(pc); game.cars.push(pc);
  }
  while (game.footCops.length < need.cops) {
    const a = rng.angle();
    game.footCops.push({ x: game.player.x + Math.cos(a) * 260, y: game.player.y + Math.sin(a) * 260, angle: a, health: 60, catchTimer: 0 });
  }
  if (need.boat === 0 && game.boatCop) { game.boatCop = null; }
}
function dropPolice() {
  game.policeCars = game.policeCars.filter((c) => dist(c.x, c.y, game.player.x, game.player.y) < 900);
  game.cars = game.cars.filter((c) => !c.isPolice || game.policeCars.includes(c));
  game.footCops = game.footCops.filter((c) => dist(c.x, c.y, game.player.x, game.player.y) < 500);
}

function startGame(fromSave) {
  audio.unlock(); audio.startMusic();
  if (fromSave) {
    const data = loadGame(localStorage);
    if (data) {
      Object.assign(game.player, data.player);
      game.mission = data.mission; game.wanted = data.wanted; game.timeOfDay = data.timeOfDay;
      game.carsOwned = data.carsOwned || ['sedan']; game.stats = data.stats || game.stats;
      game.missionDef = missionById(game.mission.current);
      showMessage('Save loaded — welcome back to Solmar');
    }
  } else {
    game.missionDef = missionById(1);
    startMission(game.mission, 1);
    game.raceTimer = game.missionDef.kind === 'race' ? 75 : 0;
    game.dialogue = { lines: game.missionDef.dialogue, index: 0 };
  }
  game.screen = 'play';
  statusEl.textContent = 'Playing — Solmar Heat';
}

function tryEnterCar() {
  const car = nearestCar();
  if (!car) return;
  if (car.isPolice && game.wanted < 1) { /* stealing a police car is a crime too */ }
  game.player.inCar = car; game.player.onFoot = false;
  car.driver = 'player';
  if (car.stolen !== true && !game.carsOwned.includes(car.defId) && !car.isPolice) {
    car.stolen = true; game.stats.carsStolen += 1;
    addWanted(game, 'stealCar'); showMessage(`Stole a ${car.name}! Wanted level up.`); audio.sfx('siren');
  } else { showMessage(`Driving the ${car.name}`); }
  audio.sfx('car');
}
function exitCar() {
  const car = game.player.inCar;
  if (!car) return;
  game.player.x = car.x + 50; game.player.y = car.y + 50;
  game.player.inCar = null; game.player.onFoot = true; car.driver = null; car.speed = 0;
}
function fireWeapon() {
  const p = game.player;
  if (p.shootCooldown > 0 || p.weapon === 'fists') return;
  if ((p.ammo[p.weapon] || 0) <= 0) { showMessage('Out of ammo — buy more at the shop (near Downtown)'); audio.sfx('click'); return; }
  p.ammo[p.weapon] -= 1; p.shootCooldown = p.weapon === 'smg' ? 0.12 : 0.35;
  const aim = Math.atan2(game.mouseWorld.y - p.y, game.mouseWorld.x - p.x);
  // Shoot against the live pedestrian / cop objects.
  const live = [...game.peds, ...game.footCops];
  const res = shoot(p, aim, live.map((t) => ({ x: t.x, y: t.y, r: 18, health: t.health ?? 60, _live: t })), p.weapon, rng);
  audio.sfx('shoot');
  game.bullets.push({ x: p.x, y: p.y, angle: aim, life: 0.15 });
  if (res.hit) {
    const liveT = res.target._live;
    liveT.health = res.target.health;
    addWanted(game, liveT === game.footCops.find((c) => c === liveT) ? 'killCop' : 'shoot');
    if (res.killed) {
      if (game.footCops.includes(liveT)) { game.footCops = game.footCops.filter((c) => c !== liveT); addWanted(game, 'killCop'); }
      else { game.peds = game.peds.filter((t) => t !== liveT); addWanted(game, 'killPed'); }
      showMessage('Target down. The city noticed.');
    }
  }
}
function doPunch() {
  const p = game.player;
  if (p.punchCooldown > 0) return;
  p.punchCooldown = 0.45;
  const live = [...game.peds, ...game.footCops];
  const res = punch(p, live.map((t) => ({ x: t.x, y: t.y, r: 18, health: t.health ?? 60, _live: t })));
  audio.sfx('punch');
  if (res.hit) {
    const liveT = res.target._live; liveT.health = res.target.health;
    addWanted(game, 'punch');
    if (res.killed) { game.peds = game.peds.filter((t) => t !== liveT); game.footCops = game.footCops.filter((c) => c !== liveT); }
  }
}
function buyItem(item) {
  const p = game.player;
  if (p.cash < item.price) { showMessage('Not enough cash.'); return; }
  p.cash -= item.price;
  if (item.kind === 'weapon') { const w = weaponDef(item.id); if (!p.weaponsOwned.includes(item.id)) p.weaponsOwned.push(item.id); p.ammo[item.id] = (p.ammo[item.id] || 0) + w.ammo; p.weapon = item.id; }
  else if (item.kind === 'ammo') { p.ammo.pistol = (p.ammo.pistol || 0) + 24; }
  else if (item.kind === 'armor') { p.armor = Math.min(100, p.armor + 50); }
  else if (item.kind === 'health') { p.health = 100; }
  else if (item.kind === 'car') { if (!game.carsOwned.includes(item.id)) game.carsOwned.push(item.id); }
  else if (item.kind === 'safehouse') { p.safehouseLevel = 1; p.health = 100; }
  audio.sfx('coin'); showMessage(`Bought: ${item.name}`);
}
function checkMissionProgress() {
  const m = game.missionDef; if (!m || game.mission.status !== 'active') return;
  const p = game.player;
  const px = p.inCar ? p.inCar.x : p.x, py = p.inCar ? p.inCar.y : p.y;
  const at = (t, r = 90) => dist(px, py, t.x, t.y) < r;
  if (m.kind === 'deliver' || m.kind === 'heist') {
    if (m.id === 4 && game.mission.objectiveIndex === 0) {
      if (at({ x: 300, y: 300 }, 110)) { game.mission.objectiveIndex = 1; game.missionObjectiveText = 'Crate collected — deliver to Old Town'; showMessage('Crate collected!'); }
    } else if (at(m.target)) finishMission();
  } else if (m.kind === 'steal') {
    if (p.inCar && p.inCar.defId === 'coupe' && at(world.garage, 160)) finishMission();
  } else if (m.kind === 'escape') {
    if (game.wanted === 0 && at(m.target, 120)) finishMission();
    if (m.id === 9 && game.mission.objectiveIndex === 0) { game.mission.objectiveIndex = 1; }
  } else if (m.kind === 'race') {
    const cps = [{ x: 900, y: 1900 }, { x: 1200, y: 1900 }, { x: 1500, y: 1900 }];
    const cp = cps[game.mission.checkpointsHit];
    if (cp && at(cp, 110)) { game.mission.checkpointsHit += 1; audio.sfx('coin'); showMessage(`Checkpoint ${game.mission.checkpointsHit}/3`); }
    if (game.mission.checkpointsHit >= 3) finishMission();
    if (game.raceTimer <= 0) { showMessage('Too slow — race failed. Try again!'); startMission(game.mission, m.id); game.raceTimer = 75; }
  } else if (m.kind === 'boat') {
    if (p.inCar && p.inCar.isBoat && at(m.target, 140)) finishMission();
  } else if (m.kind === 'combat') {
    if (game.mission.objectiveIndex === 0 && at(m.target, 130)) { game.mission.objectiveIndex = 1; game.missionObjectiveText = 'Rival crew dealt with — return to the garage'; spawnRivals(); }
    else if (game.mission.objectiveIndex === 1 && game.rivalsLeft <= 0 && at(world.garage, 160)) finishMission();
  }
}
function spawnRivals() {
  game.rivalsLeft = 3;
  for (let i = 0; i < 3; i++) game.peds.push({ x: 300 + i * 60, y: 900 + i * 40, angle: 0, speed: 90, state: 'rival', targetX: 300, targetY: 900, wait: 0, panic: 0, color: '#111', health: 60, seed: i });
  showMessage('Rival crew! Deal with them (F to punch, click to shoot).');
}
function finishMission() {
  const m = completeMission(game.mission, game.player);
  if (!m) return;
  game.stats.missionsDone += 1;
  audio.sfx('mission');
  game.screen = 'complete';
  if (game.player.cash >= GARAGE_PRICE && !game.player.garageOwned) {
    game.player.garageOwned = true;
    showMessage('You can buy back Marin Garage! ($25,000)');
  }
}

function update(dt) {
  game.animT += dt;
  game.timeOfDay = (game.timeOfDay + dt / DAY_LENGTH) % 1;
  const hours = Math.floor(game.timeOfDay * 24);
  const mins = Math.floor((game.timeOfDay * 24 - hours) * 60);
  game.clockText = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  if (game.messageTimer > 0) { game.messageTimer -= dt; if (game.messageTimer <= 0) game.message = ''; }
  const p = game.player;
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);
  // Mouse -> world coords for aiming.
  const isoP = iso(p.x, p.y);
  const camX = isoP.x - 640, camY = isoP.y - 360;
  game.mouseWorld = { x: 0, y: 0 };
  // invert screen mouse: screen = iso - cam  =>  iso = mouse + cam
  const mx = input.mouse.x + camX, my = input.mouse.y + camY;
  game.mouseWorld = { x: (my * 2 + mx) / 2, y: (my * 2 - mx) / 2 };
  const move = {
    up: input.down('w', 'arrowup'), down: input.down('s', 'arrowdown'),
    left: input.down('a', 'arrowleft'), right: input.down('d', 'arrowright'),
  };
  if (p.inCar) {
    const car = p.inCar;
    driveCar(car, { forward: move.up, back: move.down, left: move.left, right: move.right, brake: input.down(' ') }, dt);
    // Collisions: buildings and water block the car.
    if (buildingAt(world, car.x, car.y) || (world.isWater(car.x, car.y) && !car.isBoat && !world.onIsland(car.x, car.y))) {
      car.x -= Math.cos(car.angle) * car.speed * dt; car.y -= Math.sin(car.angle) * car.speed * dt;
      if (Math.abs(car.speed) > 200) { audio.sfx('crash'); car.hp -= 10; }
      car.speed *= -0.3;
    }
    if (car.isBoat && !world.isWater(car.x, car.y) && !world.onIsland(car.x, car.y)) {
      car.x -= Math.cos(car.angle) * car.speed * dt; car.y -= Math.sin(car.angle) * car.speed * dt; car.speed *= -0.3;
    }
    car.x = clamp(car.x, 30, 2370); car.y = clamp(car.y, 30, 2370);
    // Hit pedestrians while driving fast = wanted.
    for (const ped of [...game.peds]) {
      if (dist(car.x, car.y, ped.x, ped.y) < 30 && Math.abs(car.speed) > 120) {
        game.peds = game.peds.filter((t) => t !== ped);
        addWanted(game, 'hitAndRun'); showMessage('Hit and run! Witnesses called the police.');
      }
    }
    p.x = car.x; p.y = car.y; p.angle = car.angle;
  } else {
    const ox = p.x, oy = p.y;
    walkPlayer(p, move, dt);
    if (buildingAt(world, p.x, p.y) || (world.isWater(p.x, p.y) && !world.onIsland(p.x, p.y))) { p.x = ox; p.y = oy; }
    p.x = clamp(p.x, 30, 2370); p.y = clamp(p.y, 30, 2370);
  }
  if (input.wasPressed('e')) { if (p.inCar) exitCar(); else tryEnterCar(); }
  if (input.wasPressed('f')) doPunch();
  if (input.mouse.clicked && p.weapon !== 'fists' && !p.inCar) fireWeapon();
  if (input.wasPressed('1')) p.weapon = 'fists';
  if (input.wasPressed('2') && p.weaponsOwned.includes('pistol')) p.weapon = 'pistol';
  if (input.wasPressed('3') && p.weaponsOwned.includes('smg')) p.weapon = 'smg';
  if (input.wasPressed('m')) { const muted = audio.toggleMute(); showMessage(muted ? 'Muted' : 'Sound on'); }
  if (input.wasPressed('p') || input.wasPressed('escape')) { game.screen = 'pause'; statusEl.textContent = 'Paused'; }
  // Traffic + peds.
  for (const c of game.cars) if (c.ai && !c.driver && !c.isPolice) updateTrafficCar(c, world, dt, rng);
  for (const ped of game.peds) updatePed(ped, world, rng, dt, game.wanted > 0 ? p : null);
  // Wanted decay: hidden when far from police and not in a car chase.
  const nearestCop = Math.min(...game.policeCars.map((c) => dist(c.x, c.y, p.x, p.y)), ...game.footCops.map((c) => dist(c.x, c.y, p.x, p.y)), 9999);
  const seen = nearestCop < 320;
  decayWanted(game, dt, seen);
  if (game.wanted > 0) {
    ensurePolice();
    for (const pc of game.policeCars) updatePoliceCar(pc, p, dt);
    for (const cop of game.footCops) {
      updateFootCop(cop, p, dt);
      if (dist(cop.x, cop.y, p.x, p.y) < 26 && cop.catchTimer > 2) {
        cop.catchTimer = 0;
        applyDamage(p, 8); audio.sfx('hurt');
        if (p.health <= 0) { game.screen = 'gameover'; game.stats.arrests += 1; }
      }
    }
    if (game.wanted >= 3 && Math.floor(game.animT) % 3 === 0) audio.sfx('siren');
  } else dropPolice();
  // Police cars ram the player — but at most once per half second, so a chase
  // is survivable instead of an instant wreck.
  game.lastRam = (game.lastRam || 0) - dt;
  for (const pc of game.policeCars) {
    if (dist(pc.x, pc.y, p.x, p.y) < 34 && game.lastRam <= 0) {
      game.lastRam = 0.5;
      if (p.inCar) { p.inCar.hp -= 5; if (p.inCar.hp <= 0) { showMessage('Your car is wrecked!'); exitCar(); } }
      else { applyDamage(p, 5); audio.sfx('hurt'); }
      if (p.health <= 0) game.screen = 'gameover';
    }
  }
  // Health regen at safehouse, slow regen otherwise when not wanted.
  if (game.wanted === 0 && p.health < 100) p.health = Math.min(100, p.health + 1.2 * dt);
  if (dist(p.x, p.y, world.safehouse.x, world.safehouse.y) < 90) p.health = Math.min(100, p.health + 12 * dt);
  // Shop proximity.
  if (dist(p.x, p.y, world.shop.x, world.shop.y) < 110 && input.wasPressed('e') && p.onFoot) { game.screen = 'shop'; }
  // Save on demand.
  if (input.wasPressed('q')) { saveGame(localStorage, game); game.saveFlash = 'Game saved'; setTimeout(() => { game.saveFlash = ''; }, 2000); }
  if (game.missionDef && game.missionDef.kind === 'race' && game.mission.status === 'active') {
    if (game.raceTimer > 0) game.raceTimer -= dt;
  }
  game.bullets = game.bullets.filter((b) => (b.life -= dt) > 0);
  checkMissionProgress();
  // Dialogue advance must happen here, before endFrame clears the presses.
  if (game.dialogue && input.wasPressed('enter')) {
    game.dialogue.index += 1;
    if (game.dialogue.index >= game.dialogue.lines.length) game.dialogue = null;
  }
  // Camera follows the player in iso space.
  const ip = iso(p.x, p.y);
  game.camera.x = ip.x - 640; game.camera.y = ip.y - 360;
  input.endFrame();
}

function drawTitle() {
  drawWorld(ctx, game, game.camera, 1280, 720, game.animT);
  ctx.fillStyle = 'rgba(10,10,30,0.55)'; ctx.fillRect(0, 0, 1280, 720);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff7e5f'; ctx.font = 'bold 84px sans-serif';
  ctx.fillText('SOLMAR HEAT', 640, 190);
  ctx.fillStyle = '#ffe600'; ctx.font = 'bold 26px sans-serif';
  ctx.fillText(GAME_SUBTITLE.toUpperCase(), 640, 232);
  ctx.fillStyle = '#fff'; ctx.font = '16px sans-serif';
  ctx.fillText('Rosa "Roxy" Marin must earn $25,000 to buy back her father\u2019s garage from El Toro.', 640, 280);
  ctx.fillText('Explore Solmar on foot, by car and by boat. Take missions. Dodge the police.', 640, 306);
  ctx.fillStyle = '#ffe600'; ctx.font = 'bold 20px sans-serif';
  ctx.fillText(hasSave(localStorage) ? 'Press ENTER to play  •  L to load save' : 'Press ENTER to play', 640, 360);
  ctx.fillStyle = '#fff'; ctx.font = '15px sans-serif';
  CONTROLS.forEach((c, i) => ctx.fillText(`${c[0]}  —  ${c[1]}`, 640, 410 + i * 24));
  ctx.fillStyle = '#aaa'; ctx.font = '13px sans-serif';
  ctx.fillText('Q quick-save  •  E near the shop to buy weapons, cars and upgrades  •  M mute', 640, 640);
  ctx.textAlign = 'left';
}
function drawPause() {
  ctx.fillStyle = 'rgba(10,10,30,0.7)'; ctx.fillRect(0, 0, 1280, 720);
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = 'bold 44px sans-serif';
  ctx.fillText('PAUSED', 640, 280);
  ctx.font = '18px sans-serif';
  ctx.fillText('P / Esc — resume    •    Q — save    •    R — restart    •    M — mute', 640, 330);
  ctx.fillText(`Missions done: ${game.stats.missionsDone}/10   •   Cash: $${game.player.cash}   •   Cars stolen: ${game.stats.carsStolen}`, 640, 368);
  ctx.textAlign = 'left';
}
function drawComplete() {
  const m = game.missionDef;
  ctx.fillStyle = 'rgba(10,30,10,0.75)'; ctx.fillRect(0, 0, 1280, 720);
  ctx.textAlign = 'center'; ctx.fillStyle = '#7cff6a'; ctx.font = 'bold 52px sans-serif';
  ctx.fillText('MISSION COMPLETE', 640, 260);
  if (m) {
    ctx.fillStyle = '#fff'; ctx.font = 'bold 26px sans-serif'; ctx.fillText(`${m.title}  —  +$${m.reward}`, 640, 320);
    ctx.font = '18px sans-serif'; ctx.fillText(`Total earned: $${game.mission.totalEarned}   •   Garage fund: $${game.player.cash} / $${GARAGE_PRICE}`, 640, 360);
  }
  ctx.fillStyle = '#ffe600'; ctx.font = 'bold 20px sans-serif';
  ctx.fillText(game.mission.status === 'done' ? 'STORY COMPLETE — You took back Marin Garage!' : 'Press ENTER for the next mission', 640, 420);
  ctx.textAlign = 'left';
}
function drawGameOver() {
  ctx.fillStyle = 'rgba(30,5,5,0.8)'; ctx.fillRect(0, 0, 1280, 720);
  ctx.textAlign = 'center'; ctx.fillStyle = '#ff5555'; ctx.font = 'bold 56px sans-serif';
  ctx.fillText('BUSTED / WASTED', 640, 300);
  ctx.fillStyle = '#fff'; ctx.font = '20px sans-serif';
  ctx.fillText('Roxy is down. The city keeps moving without her.', 640, 350);
  ctx.fillStyle = '#ffe600'; ctx.font = 'bold 20px sans-serif'; ctx.fillText('Press ENTER to restart', 640, 410);
  ctx.textAlign = 'left';
}
function drawShop() {
  ctx.fillStyle = 'rgba(10,10,30,0.8)'; ctx.fillRect(0, 0, 1280, 720);
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffe600'; ctx.font = 'bold 36px sans-serif';
  ctx.fillText('SOLMAR ARMS & PARTS', 640, 120);
  ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif'; ctx.fillText(`Cash: $${game.player.cash}`, 640, 156);
  SHOP_ITEMS.forEach((it, i) => {
    ctx.fillStyle = i === game.shopIndex ? '#ffe600' : '#fff';
    ctx.font = i === game.shopIndex ? 'bold 18px sans-serif' : '18px sans-serif';
    ctx.fillText(`${i + 1}. ${it.name} — $${it.price}`, 640, 200 + i * 32);
  });
  ctx.fillStyle = '#aaa'; ctx.font = '15px sans-serif';
  ctx.fillText('Up / Down to choose, Enter to buy, Esc to leave', 640, 540);
  ctx.textAlign = 'left';
}
function drawDialogue() {
  const d = game.dialogue; if (!d) return;
  const line = d.lines[d.index];
  ctx.fillStyle = 'rgba(10,10,30,0.9)'; ctx.fillRect(140, 520, 1000, 130);
  ctx.strokeStyle = '#ffe600'; ctx.lineWidth = 2; ctx.strokeRect(140, 520, 1000, 130);
  ctx.fillStyle = '#ffe600'; ctx.font = 'bold 16px sans-serif'; ctx.fillText(game.missionDef ? game.missionDef.title : 'Solmar', 170, 556);
  ctx.fillStyle = '#fff'; ctx.font = '17px sans-serif';
  ctx.fillText(line, 170, 590);
  ctx.fillStyle = '#aaa'; ctx.font = '14px sans-serif'; ctx.fillText('Press ENTER to continue', 170, 626);
}
function drawPlay() {
  drawWorld(ctx, game, game.camera, 1280, 720, game.animT);
  const px = (x, y, z = 0) => { const p = iso(x, y, z); return { x: p.x - game.camera.x, y: p.y - game.camera.y }; };
  // Mission target marker.
  if (game.missionDef && game.mission.status === 'active') {
    const t = game.missionDef.target;
    const p = px(t.x, t.y);
    ctx.fillStyle = '#ffe600';
    ctx.beginPath(); ctx.moveTo(p.x, p.y - 46 - Math.sin(game.animT * 4) * 6); ctx.lineTo(p.x - 12, p.y - 66 - Math.sin(game.animT * 4) * 6); ctx.lineTo(p.x + 12, p.y - 66 - Math.sin(game.animT * 4) * 6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,0,0.5)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 40, 18, 0, 0, Math.PI * 2); ctx.stroke();
  }
  // Draw cars + people sorted by depth.
  const drawables = [];
  for (const c of game.cars) drawables.push({ d: c.x + c.y, kind: 'car', obj: c });
  for (const ped of game.peds) drawables.push({ d: ped.x + ped.y, kind: 'ped', obj: ped });
  for (const cop of game.footCops) drawables.push({ d: cop.x + cop.y, kind: 'cop', obj: cop });
  drawables.sort((a, b) => a.d - b.d);
  for (const it of drawables) {
    if (it.kind === 'car') drawCarIso(ctx, px, it.obj, it.obj === game.player.inCar);
    else if (it.kind === 'ped') drawPersonIso(ctx, px, it.obj.x, it.obj.y, it.obj.angle, it.obj.color, null, false);
    else drawPersonIso(ctx, px, it.obj.x, it.obj.y, it.obj.angle, '#1a2a4a', 'POLICE', false);
  }
  if (game.player.onFoot) drawPersonIso(ctx, px, game.player.x, game.player.y, game.player.angle, '#ff5a7a', 'ROXY', true);
  // Bullets.
  ctx.strokeStyle = '#ffe600'; ctx.lineWidth = 3;
  for (const b of game.bullets) {
    const p1 = px(b.x, b.y), p2 = px(b.x + Math.cos(b.angle) * 40, b.y + Math.sin(b.angle) * 40);
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
  }
  // Wanted flash at high stars.
  if (game.wanted >= 4) { ctx.fillStyle = `rgba(255,0,0,${0.05 + 0.04 * Math.sin(game.animT * 6)})`; ctx.fillRect(0, 0, 1280, 720); }
  // Night overlay.
  if (isNight(game.timeOfDay)) { ctx.fillStyle = 'rgba(10,16,48,0.28)'; ctx.fillRect(0, 0, 1280, 720); }
  drawHUD(ctx, game, 1280);
  drawMinimap(ctx, game, 1280 - 180, 720 - 180, 160);
  if (game.saveFlash) { ctx.fillStyle = '#7cff6a'; ctx.font = 'bold 16px sans-serif'; ctx.fillText(game.saveFlash, 22, 680); }
  if (game.dialogue) drawDialogue();
}

function frame(now, last) {
  const dt = Math.min(0.05, (now - last) / 1000);
  if (game.screen === 'play') update(dt);
  else if (game.screen === 'title') {
    game.animT += dt; game.timeOfDay = (game.timeOfDay + dt / DAY_LENGTH) % 1;
    const ip = iso(1000, 400); game.camera.x = ip.x - 640; game.camera.y = ip.y - 360;
    if (input.wasPressed('enter')) startGame(false);
    if (input.wasPressed('l') && hasSave(localStorage)) startGame(true);
    input.endFrame();
  } else if (game.screen === 'pause') {
    if (input.wasPressed('p') || input.wasPressed('escape') || input.wasPressed('enter')) game.screen = 'play';
    if (input.wasPressed('r')) location.reload();
    if (input.wasPressed('q')) { saveGame(localStorage, game); showMessage('Game saved'); }
    input.endFrame();
  } else if (game.screen === 'complete') {
    if (input.wasPressed('enter')) {
      if (game.mission.status === 'done') { game.screen = 'title'; }
      else {
        advanceMission(game.mission, game.player);
        game.missionDef = missionById(game.mission.current);
        game.missionObjectiveText = game.missionDef.text;
        game.dialogue = { lines: game.missionDef.dialogue, index: 0 };
        game.raceTimer = game.missionDef.kind === 'race' ? 75 : 0;
        game.screen = 'play';
      }
    }
    input.endFrame();
  } else if (game.screen === 'gameover') {
    if (input.wasPressed('enter')) location.reload();
    input.endFrame();
  } else if (game.screen === 'shop') {
    if (input.wasPressed('arrowup') || input.wasPressed('w')) game.shopIndex = (game.shopIndex + SHOP_ITEMS.length - 1) % SHOP_ITEMS.length;
    if (input.wasPressed('arrowdown') || input.wasPressed('s')) game.shopIndex = (game.shopIndex + 1) % SHOP_ITEMS.length;
    if (input.wasPressed('enter')) buyItem(SHOP_ITEMS[game.shopIndex]);
    if (input.wasPressed('escape')) game.screen = 'play';
    input.endFrame();
  }
  // Dialogue advance is handled inside update() (before input.endFrame).
  ctx.clearRect(0, 0, 1280, 720);
  if (game.screen === 'title') drawTitle();
  else if (game.screen === 'pause') { drawPlay(); drawPause(); }
  else if (game.screen === 'complete') { drawPlay(); drawComplete(); }
  else if (game.screen === 'gameover') { drawPlay(); drawGameOver(); }
  else if (game.screen === 'shop') { drawPlay(); drawShop(); }
  else drawPlay();
  requestAnimationFrame((t) => frame(t, now));
}

// Init.
spawnTraffic(14); spawnPeds(24); spawnParkedCars();
game.missionDef = missionById(1);
game.missionObjectiveText = MISSIONS[0].text;
if (shot) applyShot(game, shot);
if (game.screen === 'play' && shot) { /* poses render without needing a keypress */ }
statusEl.textContent = shot ? `Solmar Heat — pose: ${shot}` : 'Solmar Heat — press Enter to play';
requestAnimationFrame((t) => frame(t, t));
