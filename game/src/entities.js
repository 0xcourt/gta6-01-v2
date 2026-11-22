// Solmar Heat — entities: player, cars, pedestrians, police. Pure movement/AI
// helpers live here so tests can drive them without a canvas.
import { clamp, dist, angleDiff, angleTo } from './random.js';
import { CARS } from './config.js';

export function makePlayer(x, y) {
  return {
    x, y, angle: 0, speed: 0, health: 100, armor: 0, cash: 150,
    weapon: 'fists', ammo: { pistol: 0, smg: 0 }, weaponsOwned: ['fists'],
    inCar: null, onFoot: true, punchCooldown: 0, shootCooldown: 0,
    safehouseLevel: 0, garageOwned: false, hidden: false, hideTimer: 0,
  };
}

export function makeCar(def, x, y, angle = 0) {
  return {
    defId: def.id, name: def.name, color: def.color, x, y, angle,
    speed: 0, maxSpeed: def.speed, accel: def.accel, hp: def.hp, maxHp: def.hp,
    isPolice: def.id === 'police', isBoat: def.id === 'boat', driver: null, stolen: false,
  };
}
export function carDef(id) { return CARS.find((c) => c.id === id) || CARS[0]; }

export function driveCar(car, input, dt) {
  // input: {forward, back, left, right, brake}
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const dir = car.speed >= 0 ? 1 : -1;
  if (input.forward) car.speed += car.accel * dt;
  if (input.back) car.speed -= car.accel * 0.8 * dt;
  if (input.brake) car.speed *= Math.max(0, 1 - 3.2 * dt);
  car.speed *= Math.max(0, 1 - 0.55 * dt); // drag
  car.speed = clamp(car.speed, -car.maxSpeed * 0.45, car.maxSpeed);
  if (Math.abs(car.speed) > 12) car.angle += steer * 1.9 * dt * dir * clamp(Math.abs(car.speed) / 120, 0.3, 1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  return car;
}

export function walkPlayer(p, input, dt, speed = 190) {
  let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (dx === 0 && dy === 0) { p.speed = 0; return p; }
  const len = Math.hypot(dx, dy);
  dx /= len; dy /= len;
  p.x += dx * speed * dt; p.y += dy * speed * dt;
  p.angle = Math.atan2(dy, dx); p.speed = speed;
  return p;
}

export function makePed(x, y, rng) {
  return {
    x, y, angle: rng.angle(), speed: rng.range(28, 55), state: 'walk',
    targetX: x, targetY: y, wait: rng.range(0, 3), panic: 0,
    color: rng.pick(['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22']),
    seed: rng.range(0, 1000),
  };
}

export function updatePed(ped, world, rng, dt, danger) {
  if (danger && dist(ped.x, ped.y, danger.x, danger.y) < 180) ped.panic = 2.5;
  if (ped.panic > 0) {
    ped.panic -= dt;
    const a = angleTo(danger.x, danger.y, ped.x, ped.y);
    ped.x += Math.cos(a) * 130 * dt; ped.y += Math.sin(a) * 130 * dt; ped.angle = a;
    return ped;
  }
  ped.wait -= dt;
  if (ped.wait <= 0) {
    const p = { x: ped.x, y: ped.y };
    const nx = clamp(p.x + rng.range(-260, 260), 60, 2340);
    const ny = clamp(p.y + rng.range(-260, 260), 60, 2340);
    ped.targetX = nx; ped.targetY = ny; ped.wait = rng.range(4, 9);
  }
  const d = dist(ped.x, ped.y, ped.targetX, ped.targetY);
  if (d > 12) {
    const a = angleTo(ped.x, ped.y, ped.targetX, ped.targetY);
    ped.angle = a;
    const nx = ped.x + Math.cos(a) * ped.speed * dt;
    const ny = ped.y + Math.sin(a) * ped.speed * dt;
    if (!world.isWater(nx, ny)) { ped.x = nx; ped.y = ny; }
  }
  return ped;
}

// Traffic car: follows the road grid, turns at intersections, stops for nothing.
export function makeTrafficCar(def, x, y, angle, rng) {
  const c = makeCar(def, x, y, angle);
  c.ai = { dir: angle, turnAt: rng.range(2, 6), timer: rng.range(0, 4) };
  return c;
}
export function updateTrafficCar(car, world, dt, rng) {
  car.ai.timer -= dt;
  const onH = Math.abs(((car.y % 200) + 200) % 200 - 28) < 30;
  const onV = Math.abs(((car.x % 200) + 200) % 200 - 28) < 30;
  if (car.ai.timer <= 0 && (onH || onV)) {
    // At an intersection: sometimes turn.
    if (rng.chance(0.45)) car.angle += (rng.chance(0.5) ? 1 : -1) * Math.PI / 2;
    car.ai.timer = rng.range(2, 5);
  }
  car.speed = 150;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // Wrap around the city edges so traffic never runs out.
  if (car.x < 20) car.x = 2380; if (car.x > 2380) car.x = 20;
  if (car.y < 20) car.y = 2380; if (car.y > 2380) car.y = 20;
  if (world.isWater(car.x, car.y)) { car.angle += Math.PI; car.x += Math.cos(car.angle) * 60; car.y += Math.sin(car.angle) * 60; }
  return car;
}

// Police pursuit car: steers toward the player, rams gently.
export function updatePoliceCar(car, target, dt) {
  const desired = angleTo(car.x, car.y, target.x, target.y);
  car.angle += clamp(angleDiff(car.angle, desired), -2.4 * dt, 2.4 * dt);
  car.speed = Math.min(car.speed + car.accel * dt, car.maxSpeed * 0.92);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  return car;
}
export function updateFootCop(cop, target, dt) {
  const d = dist(cop.x, cop.y, target.x, target.y);
  if (d > 26) {
    const a = angleTo(cop.x, cop.y, target.x, target.y);
    cop.x += Math.cos(a) * 150 * dt; cop.y += Math.sin(a) * 150 * dt; cop.angle = a;
  }
  cop.catchTimer = (cop.catchTimer || 0) + dt;
  return cop;
}
