// Solmar Heat — the people and vehicles of Solmar.
// Factories build the player, pedestrians, traffic cars and police; the
// update functions below give each of them one frame of behaviour. Traffic
// follows the road grid, pedestrians wander the sidewalks and panic when
// danger is close, and police hunt the player with a speed that scales with
// the wanted level.

import { makeRng, distance, angleTo, angleDifference, normalizeAngle, clamp } from './random.js';
import {
  CAR_ACCEL, CAR_MAX_SPEED, CAR_REVERSE_SPEED, CAR_TURN_RATE, CAR_BRAKE,
  BOAT_ACCEL, BOAT_MAX_SPEED, PLAYER_WALK_SPEED, PLAYER_SPRINT_SPEED,
  POLICE_SIGHT_RANGE,
} from './config.js';
import { isBlocked, isRoadAt, isWaterAt, isWalkableAt, tileAt, TILE, nearestRoadTile } from './world.js';

export function makePlayer(x, y) {
  return {
    kind: 'player',
    x, y,
    angle: -Math.PI / 2,
    speed: 0,
    onFoot: true,
    vehicle: null, // the car or boat being driven, or null
    health: 100,
    armor: 0,
    weapon: 'pistol',
    weaponsOwned: { fists: true, pistol: true, smg: false },
    ammo: { pistol: 48, smg: 0 },
    alive: true,
    radius: 0.35,
    aimAngle: 0,
    fireCooldown: 0,
    punchCooldown: 0,
    walkCycle: 0,
  };
}

export function makeParkedCar(x, y, angle, color, kind = 'sedan') {
  return {
    kind: 'car', x, y, angle, speed: 0,
    color, driver: 'parked', vehicleKind: kind,
    health: 100, maxSpeed: CAR_MAX_SPEED, radius: 0.8,
  };
}

export function makeTrafficCar(x, y, angle, color, rng) {
  return {
    kind: 'car', x, y, angle, speed: 0,
    color, driver: 'traffic', vehicleKind: 'sedan',
    health: 100, maxSpeed: 7 + rng.float(0, 3),
    cruise: 6 + rng.float(0, 3), radius: 0.8,
    turnCooldown: 0,
  };
}

export function makePedestrian(x, y, rng) {
  return {
    kind: 'ped', x, y,
    angle: rng.float(0, Math.PI * 2),
    speed: 0,
    targetX: x, targetY: y,
    state: 'walk', // walk | panic | cop
    panic: 0,
    color: rng.pick(['#e74c3c', '#3498db', '#f39c12', '#2ecc71', '#9b59b6', '#ecf0f1', '#1abc9c']),
    walkCycle: rng.float(0, Math.PI * 2),
    waitTimer: rng.float(0, 2),
  };
}

export function makePoliceCar(x, y) {
  return {
    kind: 'car', x, y, angle: 0, speed: 0,
    color: '#1a1a2e', driver: 'police', vehicleKind: 'police',
    health: 100, maxSpeed: 20, radius: 0.85, sirenPhase: 0,
  };
}

export function makePoliceBoat(x, y) {
  return {
    kind: 'boat', x, y, angle: 0, speed: 0,
    color: '#1a1a2e', driver: 'police', vehicleKind: 'police-boat',
    health: 100, maxSpeed: 24, radius: 1.0,
  };
}

export function makeSpeedboat(x, y) {
  return {
    kind: 'boat', x, y, angle: -Math.PI / 2, speed: 0,
    color: '#e74c3c', driver: 'parked', vehicleKind: 'speedboat',
    health: 100, maxSpeed: BOAT_MAX_SPEED, radius: 1.0,
  };
}

// Move a point, axis by axis, so it slides along walls instead of sticking.
function tryMove(world, entity, dx, dy, pad = 0.25) {
  const nx = entity.x + dx;
  if (!isBlocked(world, nx, entity.y, pad)) entity.x = nx;
  const ny = entity.y + dy;
  if (!isBlocked(world, entity.x, ny, pad)) entity.y = ny;
}

// ---- player ---------------------------------------------------------------

export function updatePlayer(game, dt, input) {
  const player = game.player;
  if (!player.alive) return;
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  player.punchCooldown = Math.max(0, player.punchCooldown - dt);

  if (player.onFoot) {
    const axes = input.moveAxes();
    const speed = input.sprinting ? PLAYER_SPRINT_SPEED : PLAYER_WALK_SPEED;
    const dx = axes.x * speed * dt;
    const dy = axes.y * speed * dt;
    if (dx !== 0 || dy !== 0) {
      player.angle = Math.atan2(dy, dx);
      player.walkCycle += dt * 10;
    }
    tryMove(game.world, player, dx, dy, 0.3);
    player.speed = (dx !== 0 || dy !== 0) ? speed : 0;
  } else if (player.vehicle) {
    driveVehicle(game, player.vehicle, dt, input, true);
    player.x = player.vehicle.x;
    player.y = player.vehicle.y;
    player.angle = player.vehicle.angle;
    player.speed = player.vehicle.speed;
  }
}

// Shared car/boat driving: W/S throttle, A/D steer, Space handbrake.
export function driveVehicle(game, vehicle, dt, input, isPlayer) {
  const onWater = vehicle.kind === 'boat';
  const accel = onWater ? BOAT_ACCEL : CAR_ACCEL;
  const maxSpeed = onWater ? BOAT_MAX_SPEED : (vehicle.maxSpeed || CAR_MAX_SPEED);
  const forward = input.isDown('KeyW') || input.isDown('ArrowUp');
  const reverse = input.isDown('KeyS') || input.isDown('ArrowDown');
  const left = input.isDown('KeyA') || input.isDown('ArrowLeft');
  const right = input.isDown('KeyD') || input.isDown('ArrowRight');
  const handbrake = input.isDown('Space');

  if (forward) vehicle.speed += accel * dt;
  if (reverse) {
    if (vehicle.speed > 0.5) vehicle.speed -= CAR_BRAKE * dt;
    else vehicle.speed -= accel * 0.6 * dt;
  }
  if (handbrake) {
    vehicle.speed -= Math.sign(vehicle.speed) * CAR_BRAKE * 1.4 * dt;
    if (Math.abs(vehicle.speed) < 0.6) vehicle.speed = 0;
  }
  // Rolling drag and reverse clamp.
  vehicle.speed -= vehicle.speed * 0.55 * dt;
  vehicle.speed = clamp(vehicle.speed, -CAR_REVERSE_SPEED, maxSpeed);

  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  if (steer !== 0 && Math.abs(vehicle.speed) > 0.4) {
    const grip = onWater ? 1.6 : CAR_TURN_RATE;
    vehicle.angle += steer * grip * dt * Math.sign(vehicle.speed)
      * (handbrake ? 1.5 : 1) * clamp(Math.abs(vehicle.speed) / 8, 0.35, 1);
  }
  vehicle.angle = normalizeAngle(vehicle.angle);

  const dx = Math.cos(vehicle.angle) * vehicle.speed * dt;
  const dy = Math.sin(vehicle.angle) * vehicle.speed * dt;
  const beforeX = vehicle.x;
  const beforeY = vehicle.y;
  if (onWater) {
    vehicle.x += dx;
    vehicle.y += dy;
    if (!isWaterAt(game.world, vehicle.x, vehicle.y)
      && tileAt(game.world, vehicle.x, vehicle.y) !== TILE.DOCK) {
      vehicle.x = beforeX;
      vehicle.y = beforeY;
      vehicle.speed *= -0.25;
      if (isPlayer && Math.abs(vehicle.speed) > 4) game.events.push('crash');
    }
  } else {
    const pad = 0.55;
    const nx = vehicle.x + dx;
    if (!isBlocked(game.world, nx, vehicle.y, pad)) vehicle.x = nx;
    else if (isPlayer) crashCheck(game, vehicle);
    const ny = vehicle.y + dy;
    if (!isBlocked(game.world, vehicle.x, ny, pad)) vehicle.y = ny;
    else if (isPlayer) crashCheck(game, vehicle);
    if (isWaterAt(game.world, vehicle.x, vehicle.y)) {
      vehicle.x = beforeX;
      vehicle.y = beforeY;
      vehicle.speed *= -0.3;
    }
  }
  vehicle.x = clamp(vehicle.x, 1, game.world.size - 2);
  vehicle.y = clamp(vehicle.y, 1, game.world.size - 2);
}

function crashCheck(game, vehicle) {
  if (Math.abs(vehicle.speed) > 9) {
    game.events.push('crash');
    vehicle.health = Math.max(0, vehicle.health - 8);
    if (vehicle.health <= 0) {
      game.events.push('carWrecked');
      vehicle.speed = 0;
    }
  }
  vehicle.speed *= 0.4;
}

// ---- entering and leaving vehicles ----------------------------------------

export function nearestVehicle(game, maxDist) {
  const player = game.player;
  let best = null;
  let bestD = maxDist;
  const candidates = [...game.parkedCars, ...game.traffic, game.boat].filter(Boolean);
  for (const v of candidates) {
    if (v.driver === 'police') continue;
    const d = distance(player.x, player.y, v.x, v.y);
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  return best;
}

export function enterVehicle(game, vehicle) {
  const player = game.player;
  player.onFoot = false;
  player.vehicle = vehicle;
  vehicle.driver = 'player';
  const idx = game.parkedCars.indexOf(vehicle);
  if (idx >= 0) game.parkedCars.splice(idx, 1);
  if (vehicle === game.boat) game.boatTaken = true;
  game.events.push(vehicle.kind === 'boat' ? 'boardBoat' : 'enterCar');
  return true;
}

export function exitVehicle(game) {
  const player = game.player;
  const vehicle = player.vehicle;
  if (!vehicle) return false;
  // Step out to the side of the vehicle, onto walkable ground.
  const side = vehicle.angle + Math.PI / 2;
  for (const off of [1.2, -1.2, 2.0, -2.0]) {
    const x = vehicle.x + Math.cos(side) * off;
    const y = vehicle.y + Math.sin(side) * off;
    if (isWalkableAt(game.world, x, y) && !isBlocked(game.world, x, y, 0.3)) {
      player.x = x;
      player.y = y;
      break;
    }
  }
  player.onFoot = true;
  player.vehicle = null;
  player.speed = 0;
  if (vehicle.kind === 'boat') {
    vehicle.driver = 'parked';
  } else if (vehicle.driver === 'player') {
    vehicle.driver = 'parked';
    game.parkedCars.push(vehicle);
  }
  game.events.push('exitCar');
  return true;
}

// ---- traffic ---------------------------------------------------------------

export function updateTraffic(game, dt) {
  const rng = game.rng;
  for (const car of game.traffic) {
    car.turnCooldown = Math.max(0, car.turnCooldown - dt);
    const aheadX = car.x + Math.cos(car.angle) * 1.6;
    const aheadY = car.y + Math.sin(car.angle) * 1.6;
    const playerCar = game.player.vehicle;
    const nearPlayer = playerCar && distance(car.x, car.y, playerCar.x, playerCar.y) < 3.5;
    let targetSpeed = car.cruise;
    if (!isRoadAt(game.world, aheadX, aheadY) || nearPlayer) targetSpeed = 0;
    if (car.speed < targetSpeed) car.speed += 6 * dt;
    else if (car.speed > targetSpeed) car.speed -= 10 * dt;
    if (car.speed < 0) car.speed = 0;

    // At an intersection, sometimes turn onto a cross street.
    const onJunction = Math.abs(car.x % 4 - 0.5) < 0.35 && Math.abs(car.y % 4 - 0.5) < 0.35;
    if (onJunction && car.turnCooldown <= 0 && rng.chance(0.25)) {
      const options = [0, Math.PI / 2, Math.PI, -Math.PI / 2].filter((a) => {
        const nx = car.x + Math.cos(a) * 2;
        const ny = car.y + Math.sin(a) * 2;
        return isRoadAt(game.world, nx, ny);
      });
      if (options.length > 0) {
        car.angle = options[Math.floor(rng.next() * options.length)];
        car.turnCooldown = 2;
      }
    }
    if (car.speed > 0.1) {
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      if (isRoadAt(game.world, nx, ny) || isRoadAt(game.world, car.x, ny)) car.x = nx;
      else car.angle += Math.PI / 2;
      if (isRoadAt(game.world, car.x, ny)) car.y = ny;
      else car.angle += Math.PI / 2;
    }
  }
}

// ---- pedestrians -----------------------------------------------------------

export function updatePedestrians(game, dt) {
  const player = game.player;
  const dangerNear = game.wanted > 0 || game.alarmTimer > 0;
  for (const ped of game.peds) {
    ped.walkCycle += dt * 6;
    const distToPlayer = distance(ped.x, ped.y, player.x, player.y);
    if (ped.state === 'cop') {
      // A foot cop runs the player down and swings when close.
      const a = angleTo(ped.x, ped.y, player.x, player.y);
      ped.angle = a;
      if (distToPlayer > 0.9) {
        ped.x += Math.cos(a) * 7 * dt;
        ped.y += Math.sin(a) * 7 * dt;
      } else if (player.alive) {
        ped.hitCooldown = Math.max(0, (ped.hitCooldown || 0) - dt);
        if (ped.hitCooldown <= 0) {
          ped.hitCooldown = 0.8;
          game.events.push({ type: 'copHit', amount: 6 });
        }
      }
      continue;
    }
    if (dangerNear && distToPlayer < 10) {
      ped.state = 'panic';
      ped.panic = 3;
    }
    if (ped.state === 'panic') {
      ped.panic -= dt;
      const away = angleTo(player.x, player.y, ped.x, ped.y);
      ped.angle = away;
      const nx = ped.x + Math.cos(away) * 7.5 * dt;
      const ny = ped.y + Math.sin(away) * 7.5 * dt;
      if (isWalkableAt(game.world, nx, ny) && !isBlocked(game.world, nx, ny, 0.3)) {
        ped.x = nx;
        ped.y = ny;
      }
      if (ped.panic <= 0) ped.state = 'walk';
      continue;
    }
    // Wandering: drift toward a target, pick a new one on arrival or timeout.
    ped.waitTimer -= dt;
    const d = distance(ped.x, ped.y, ped.targetX, ped.targetY);
    if (d < 0.5 || ped.waitTimer <= 0) {
      if (game.rng.chance(0.4)) {
        ped.targetX = ped.x + game.rng.float(-4, 4);
        ped.targetY = ped.y + game.rng.float(-4, 4);
        ped.targetX = clamp(ped.targetX, 4, game.world.size - 5);
        ped.targetY = clamp(ped.targetY, 4, game.world.size - 5);
        ped.waitTimer = game.rng.float(2, 6);
      } else {
        ped.waitTimer = game.rng.float(1, 3);
      }
    } else {
      const a = angleTo(ped.x, ped.y, ped.targetX, ped.targetY);
      ped.angle = a;
      const nx = ped.x + Math.cos(a) * 1.6 * dt;
      const ny = ped.y + Math.sin(a) * 1.6 * dt;
      if (isWalkableAt(game.world, nx, ny) && !isBlocked(game.world, nx, ny, 0.3)) {
        ped.x = nx;
        ped.y = ny;
      } else {
        ped.targetX = ped.x;
        ped.targetY = ped.y;
      }
    }
  }
}

// ---- police ----------------------------------------------------------------

export function wantedPoliceCount(wanted) {
  return Math.min(2 + wanted, 7);
}

export function updatePolice(game, dt) {
  const player = game.player;
  if (game.wanted <= 0 || !player.alive) {
    // No heat: cruisers drift home and fade out.
    for (const cop of game.police) {
      cop.speed = Math.max(0, cop.speed - 8 * dt);
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
    }
    if (game.policeBoat) {
      game.policeBoat.speed = Math.max(0, game.policeBoat.speed - 8 * dt);
    }
    return;
  }
  const want = wantedPoliceCount(game.wanted);
  while (game.police.length < want) {
    const a = game.rng.float(0, Math.PI * 2);
    const d = 16 + game.rng.float(0, 6);
    const rawX = clamp(player.x + Math.cos(a) * d, 4, game.world.size - 5);
    const rawY = clamp(player.y + Math.sin(a) * d, 4, game.world.size - 5);
    // Snap the spawn onto the road grid: a cruiser dropped inside a
    // building can never move, and the chase would stall.
    const spot = nearestRoadTile(game.world, rawX, rawY) || { x: rawX, y: rawY };
    const x = spot.x;
    const y = spot.y;
    const car = makePoliceCar(x, y);
    car.angle = angleTo(x, y, player.x, player.y);
    game.police.push(car);
    game.events.push('siren');
  }
  const chaseSpeed = 10 + game.wanted * 2.2;
  for (const cop of game.police) {
    cop.sirenPhase += dt * 6;
    const targetAngle = angleTo(cop.x, cop.y, player.x, player.y);
    const diff = angleDifference(cop.angle, targetAngle);
    cop.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
    cop.speed = Math.min(chaseSpeed, cop.speed + 12 * dt);
    const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
    const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
    if (!isBlocked(game.world, nx, cop.y, 0.5)) cop.x = nx;
    if (!isBlocked(game.world, cop.x, ny, 0.5)) cop.y = ny;
    // Ramming the player hurts.
    const d = distance(cop.x, cop.y, player.x, player.y);
    if (d < 1.4 && player.alive) {
      cop.hitCooldown = Math.max(0, (cop.hitCooldown || 0) - dt);
      if (cop.hitCooldown <= 0) {
        cop.hitCooldown = 1.0;
        cop.speed *= 0.4;
        game.events.push({ type: 'rammed', amount: 8 + game.wanted * 2 });
      }
    }
  }
  // The police boat only matters when Roxy is on the water.
  if (player.vehicle && player.vehicle.kind === 'boat') {
    if (!game.policeBoat) {
      game.policeBoat = makePoliceBoat(
        clamp(player.x + 10, 2, game.world.size - 2),
        clamp(player.y - 6, 2, game.world.size - 2),
      );
    }
    const boat = game.policeBoat;
    const targetAngle = angleTo(boat.x, boat.y, player.x, player.y);
    boat.angle += clamp(angleDifference(boat.angle, targetAngle), -2 * dt, 2 * dt);
    boat.speed = Math.min(22, boat.speed + 10 * dt);
    boat.x += Math.cos(boat.angle) * boat.speed * dt;
    boat.y += Math.sin(boat.angle) * boat.speed * dt;
  } else if (game.policeBoat) {
    game.policeBoat.speed = Math.max(0, game.policeBoat.speed - 8 * dt);
  }
}

// The player is "seen" while any police unit is close, or the alarm is fresh.
export function playerIsSeen(game) {
  if (game.alarmTimer > 0) return true;
  for (const cop of game.police) {
    if (distance(cop.x, cop.y, game.player.x, game.player.y) < POLICE_SIGHT_RANGE) return true;
  }
  for (const ped of game.peds) {
    if (ped.state === 'cop'
      && distance(ped.x, ped.y, game.player.x, game.player.y) < POLICE_SIGHT_RANGE) return true;
  }
  return false;
}
