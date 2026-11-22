// Solmar Heat — the game itself: state machine, loop and wiring.
// Game owns the world, the player, the crowds, the missions and the clock,
// and each frame it updates them in order, drains the event queue (sounds,
// crimes, damage), then hands the frame to the renderer. The browser
// bootstrap at the bottom only runs where a document exists, so the class
// stays importable from the node tests.

import { makeRng, clamp, distance, angleTo } from './random.js';
import {
  PLAYER_WALK_SPEED, DAY_LENGTH_SECONDS, STORY_GOAL_CASH, SHOP_PRICES,
  WANTED_MAX, WANTED_DECAY_HIDDEN_SECONDS, WANTED_DECAY_PER_SECOND,
} from './config.js';
import { generateWorld, isWalkableAt, isBlocked, nearestRoadTile } from './world.js';
import { Input } from './input.js';
import {
  makePlayer, makeParkedCar, makeTrafficCar, makePedestrian, makePoliceCar,
  makeSpeedboat, updatePlayer, updateTraffic, updatePedestrians, updatePolice,
  nearestVehicle, enterVehicle, exitVehicle, playerIsSeen,
} from './entities.js';
import { buildMissions, MissionState } from './missions.js';
import { fireWeapon, punchAttack, damagePlayer, selectWeapon, allShootableTargets } from './combat.js';
import { AudioEngine } from './audio.js';
import { drawGame, project, unproject } from './render.js';
import { applyShot } from './shots.js';
import { saveGame, loadGame, applySave, hasSave } from './save.js';

export class Game {
  constructor(canvas, opts = {}) {
    this.canvas = canvas || null;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.seed = opts.seed || 1;
    this.rng = makeRng(this.seed ^ 0x9e3779b9);
    this.audio = new AudioEngine();
    this.input = new Input();
    this.goalCash = STORY_GOAL_CASH;
    this.shopPrices = { ...SHOP_PRICES };
    this.reset(this.seed);
  }

  reset(seed) {
    this.seed = seed;
    this.world = generateWorld(seed);
    const L = this.world.landmarks;
    this.player = makePlayer(L.spawn.x, L.spawn.y);
    this.cash = 0;
    this.wanted = 0;
    this.timeHours = 10.0;
    this.elapsed = 0;
    this.lastCrimeAt = -1000;
    this.state = 'title'; // title | playing | paused | gameover | complete
    this.cameraTarget = null;
    this.shopOpen = false;
    this.message = '';
    this.messageTimer = 0;
    this.alarmTimer = 0;
    this.muzzleFlash = 0;
    this.events = [];
    this.boatTaken = false;
    this.camX = 0;
    this.camY = 0;
    this.viewW = 1280;
    this.viewH = 720;
    this.copSpawnCooldown = 0;
    this.sirenCooldown = 0;

    this.parkedCars = this.world.parkedCars.map(
      (c) => makeParkedCar(c.x, c.y, c.angle, c.color, c.kind),
    );
    this.boat = makeSpeedboat(L.boatDock.x, L.boatDock.y);
    this.traffic = [];
    for (let i = 0; i < 10; i += 1) {
      const spot = nearestRoadTile(
        this.world,
        this.rng.float(5, this.world.size - 6),
        this.rng.float(5, this.world.size - 6),
      );
      if (!spot) continue;
      const angle = this.rng.chance(0.5) ? 0 : Math.PI / 2;
      const car = makeTrafficCar(spot.x, spot.y, angle, this.rng.pick(['#c0392b', '#2980b9', '#f1c40f', '#27ae60', '#ecf0f1']), this.rng);
      car.speed = car.cruise;
      this.traffic.push(car);
    }
    this.peds = [];
    for (let i = 0; i < 24; i += 1) {
      let x = 10;
      let y = 10;
      for (let tries = 0; tries < 20; tries += 1) {
        x = this.rng.float(4, this.world.size - 5);
        y = this.rng.float(4, this.world.size - 5);
        if (isWalkableAt(this.world, x, y) && !isBlocked(this.world, x, y, 0.3)) break;
      }
      this.peds.push(makePedestrian(x, y, this.rng));
    }
    this.police = [];
    this.policeBoat = null;
    this.missions = new MissionState(buildMissions(this.world));
    this.hasSave = hasSave();
  }

  // ---- flow ----------------------------------------------------------------

  start() {
    this.audio.ensure();
    this.audio.resume();
    this.state = 'playing';
    this.missions.startObjective(this);
    this.message = 'Mission 1: First Delivery — pick up the package at the corner shop';
    this.messageTimer = 5;
  }

  restart() {
    this.reset(this.seed);
    this.start();
  }

  togglePause() {
    if (this.state === 'playing') this.state = 'paused';
    else if (this.state === 'paused') this.state = 'playing';
  }

  addCrime(stars) {
    this.wanted = clamp(this.wanted + stars, 0, WANTED_MAX);
    this.lastCrimeAt = this.elapsed;
  }

  // ---- per-frame update ------------------------------------------------------

  update(dt) {
    this.elapsed += dt;
    this.timeHours = (this.timeHours + (dt * 24) / DAY_LENGTH_SECONDS) % 24;
    this.messageTimer = Math.max(0, this.messageTimer - dt);
    this.alarmTimer = Math.max(0, this.alarmTimer - dt);
    this.muzzleFlash = Math.max(0, this.muzzleFlash - dt);
    // Paused: the world freezes, but pause/resume, restart and quick-save
    // must still answer — the old early return swallowed those keys, so P
    // could pause the game but never unpause it.
    if (this.state === 'paused') {
      if (this.input.wasPressedAny(['KeyP', 'Escape'])) this.togglePause();
      if (this.input.wasPressed('KeyR')) this.restart();
      if (this.input.wasPressed('KeyQ')) {
        saveGame(this);
        this.message = 'Quick-saved';
        this.messageTimer = 2;
      }
      this.input.endFrame();
      return;
    }
    // Title, game-over and story-complete screens: drain stale presses so
    // a key tapped on a menu does not fire on the first frame of play.
    if (this.state !== 'playing') {
      this.input.endFrame();
      return;
    }

    this.handleKeys();
    this.updateAim();
    updatePlayer(this, dt, this.input);
    updateTraffic(this, dt, this.input);
    updatePedestrians(this, dt);
    updatePolice(this, dt);
    this.missions.update(this, dt);
    this.checkVehiclePedHits(dt);
    this.spawnFootCops(dt);
    this.decayWanted(dt);
    this.drainEvents();
    this.input.endFrame();
  }

  updateAim() {
    const p = project(this.player.x, this.player.y, 0);
    const sx = p.x - this.camX;
    const sy = p.y - this.camY;
    const mx = this.input.mouse.x;
    const my = this.input.mouse.y;
    // Mouse position in world space, via the inverse of the camera transform.
    const worldMouse = unproject(mx + this.camX, my + this.camY);
    this.player.aimAngle = angleTo(this.player.x, this.player.y, worldMouse.x, worldMouse.y);
    // Keep the values the renderer needs for the aim tick.
    this.playerScreenX = sx;
    this.playerScreenY = sy;
  }

  handleKeys() {
    const input = this.input;
    if (input.wasPressed('KeyM')) {
      const muted = this.audio.toggleMute();
      this.message = muted ? 'Sound muted (M to unmute)' : 'Sound on';
      this.messageTimer = 2;
    }
    if (input.wasPressed('KeyQ')) {
      saveGame(this);
      this.message = 'Quick-saved';
      this.messageTimer = 2;
      this.audio.playClick();
    }
    if (input.wasPressed('KeyL')) {
      const data = loadGame();
      if (data && applySave(this, data)) {
        this.message = 'Save loaded';
        this.messageTimer = 2;
      } else {
        this.message = 'No save found';
        this.messageTimer = 2;
      }
    }
    if (input.wasPressedAny(['KeyP', 'Escape'])) {
      if (this.shopOpen) this.shopOpen = false;
      else this.togglePause();
    }
    if (input.wasPressed('KeyR') && (this.state === 'paused')) this.restart();

    // The shop eats the number keys while it is open.
    if (this.shopOpen) {
      if (input.wasPressed('Digit1')) this.buyFromShop('armor');
      if (input.wasPressed('Digit2')) this.buyFromShop('pistolAmmo');
      if (input.wasPressed('Digit3')) this.buyFromShop('smg');
      if (input.wasPressed('Digit4')) this.buyFromShop('smgAmmo');
      if (input.wasPressed('Digit5')) this.buyFromShop('repair');
      if (input.wasPressedAny(['KeyE', 'Escape'])) this.shopOpen = false;
      return;
    }

    if (input.wasPressed('Digit1')) selectWeapon(this, 'fists');
    if (input.wasPressed('Digit2')) selectWeapon(this, 'pistol');
    if (input.wasPressed('Digit3')) selectWeapon(this, 'smg');
    if (input.wasPressed('KeyF')) punchAttack(this, allShootableTargets(this));
    if (input.mouse.clicked && this.player.weapon !== 'fists') {
      fireWeapon(this, allShootableTargets(this));
    }
    if (input.wasPressed('KeyE')) this.interact();
  }

  interact() {
    const player = this.player;
    const L = this.world.landmarks;
    if (!player.onFoot) {
      exitVehicle(this);
      return;
    }
    if (distance(player.x, player.y, L.shop.x, L.shop.y) < 2.5) {
      this.shopOpen = true;
      this.audio.playClick();
      return;
    }
    const vehicle = nearestVehicle(this, 1.8);
    if (vehicle) {
      const wasParked = vehicle.driver === 'parked';
      enterVehicle(this, vehicle);
      if (wasParked) {
        this.addCrime(1); // stealing a car is a crime, and witnesses notice
        this.message = vehicle.kind === 'boat' ? 'Borrowed the speedboat' : 'Car stolen — the heat is on';
        this.messageTimer = 3;
      }
    }
  }

  buyFromShop(item) {
    const price = this.shopPrices[item];
    if (price === undefined) return;
    if (this.cash < price) {
      this.message = `Not enough cash — ${item} costs $${price}`;
      this.messageTimer = 2.5;
      return;
    }
    const player = this.player;
    if (item === 'smg' && player.weaponsOwned.smg) {
      this.message = 'You already own the SMG';
      this.messageTimer = 2;
      return;
    }
    this.cash -= price;
    if (item === 'armor') player.armor = 100;
    if (item === 'pistolAmmo') player.ammo.pistol += 24;
    if (item === 'smg') {
      player.weaponsOwned.smg = true;
      player.ammo.smg += 60;
      player.weapon = 'smg';
    }
    if (item === 'smgAmmo') player.ammo.smg += 90;
    if (item === 'repair' && player.vehicle) player.vehicle.health = 100;
    this.message = `Bought ${item} for $${price}`;
    this.messageTimer = 2.5;
    this.audio.playPickup();
  }

  checkVehiclePedHits() {
    const player = this.player;
    if (player.onFoot || !player.vehicle) return;
    if (Math.abs(player.vehicle.speed) < 4) return;
    for (const ped of this.peds) {
      if (ped.state === 'cop') continue;
      ped.hitCooldown = Math.max(0, (ped.hitCooldown || 0) - 0.016);
      if (ped.hitCooldown > 0) continue;
      if (distance(ped.x, ped.y, player.x, player.y) < 1.3) {
        ped.hitCooldown = 2;
        ped.state = 'panic';
        ped.panic = 4;
        ped.x += Math.cos(ped.angle) * 1.5;
        ped.y += Math.sin(ped.angle) * 1.5;
        this.addCrime(1);
        this.events.push('crash');
        this.message = 'You hit a pedestrian — witnesses called the police!';
        this.messageTimer = 3;
      }
    }
  }

  spawnFootCops(dt) {
    this.copSpawnCooldown = Math.max(0, this.copSpawnCooldown - dt);
    if (this.wanted < 2 || this.copSpawnCooldown > 0) return;
    const cops = this.peds.filter((p) => p.state === 'cop').length;
    if (cops >= Math.min(this.wanted, 3)) return;
    const a = this.rng.float(0, Math.PI * 2);
    const x = clamp(this.player.x + Math.cos(a) * 8, 4, this.world.size - 5);
    const y = clamp(this.player.y + Math.sin(a) * 8, 4, this.world.size - 5);
    const cop = makePedestrian(x, y, this.rng);
    cop.state = 'cop';
    cop.color = '#1a2a6b';
    this.peds.push(cop);
    this.copSpawnCooldown = 6;
  }

  decayWanted(dt) {
    if (this.wanted <= 0) return;
    const quietFor = this.elapsed - this.lastCrimeAt;
    if (quietFor > WANTED_DECAY_HIDDEN_SECONDS && !playerIsSeen(this)) {
      this.wanted = Math.max(0, this.wanted - WANTED_DECAY_PER_SECOND * dt);
      if (this.wanted === 0) {
        this.message = 'You lost the heat';
        this.messageTimer = 2;
      }
    }
  }

  drainEvents() {
    for (const event of this.events) {
      if (typeof event === 'string') {
        if (event === 'shoot') {
          this.audio.playShoot();
          this.addCrime(0.15);
        } else if (event === 'punch') this.audio.playPunch();
        else if (event === 'crash') this.audio.playCrash();
        else if (event === 'siren') {
          this.sirenCooldown = Math.max(0, this.sirenCooldown - 0.016);
          if (this.sirenCooldown <= 0) {
            this.sirenCooldown = 3;
            this.audio.playSirenBlip();
          }
        } else if (event === 'missionComplete') this.audio.playPickup();
        else if (event === 'storyComplete') this.audio.playWin();
        else if (event === 'playerDied') this.audio.playGameOver();
        else if (event === 'needBoat') {
          this.message = 'This leg needs the boat — get to the marina';
          this.messageTimer = 2;
        } else if (event === 'dryFire') {
          this.message = 'Out of ammo — buy more at the corner shop';
          this.messageTimer = 2;
        }
      } else if (event && typeof event === 'object') {
        if (event.type === 'rammed' || event.type === 'copHit') {
          damagePlayer(this, event.amount);
        }
      }
    }
    this.events.length = 0;
  }

  // ---- rendering -------------------------------------------------------------

  render() {
    if (!this.ctx) return;
    drawGame(this.ctx, this);
  }

  // ---- main loop -------------------------------------------------------------

  run() {
    let last = performance.now();
    const frame = (now) => {
      const dt = clamp((now - last) / 1000, 0, 0.05);
      last = now;
      this.update(dt);
      this.render();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}

// ---- browser bootstrap (skipped under node) ---------------------------------

if (typeof document !== 'undefined') {
  const canvas = document.getElementById('game');
  const params = new URLSearchParams(window.location.search);
  const seed = parseInt(params.get('seed') || '1', 10) || 1;
  const game = new Game(canvas, { seed });
  window.__game = game;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  window.addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    game.audio.ensure();
    game.audio.resume();
    if (game.state === 'title' && e.code === 'Enter') {
      game.start();
      return;
    }
    if (game.state === 'title' && e.code === 'KeyL') {
      const data = loadGame();
      if (data && applySave(game, data)) game.state = 'playing';
      return;
    }
    if ((game.state === 'gameover' || game.state === 'complete') && e.code === 'KeyR') {
      game.restart();
      return;
    }
    game.input.keyDown(e.code);
  });
  window.addEventListener('keyup', (e) => game.input.keyUp(e.code));
  canvas.addEventListener('mousedown', (e) => {
    game.audio.ensure();
    game.audio.resume();
    const rect = canvas.getBoundingClientRect();
    game.input.mouseDown(e.clientX - rect.left, e.clientY - rect.top);
  });
  window.addEventListener('mouseup', () => game.input.mouseUp());
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    game.input.mouseMove(e.clientX - rect.left, e.clientY - rect.top);
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  const shot = params.get('shot');
  if (shot) {
    applyShot(game, shot);
    game.render();
  }
  game.run();
}
