// Solmar Heat — combat: fists, pistol and SMG, plus armor.
// Shooting is a cone test from the player's aim: a target inside the range
// and inside the half-angle of the aim counts as hit. Damage hits armor
// first and only spills into health once the vest is gone. Pure functions
// wherever possible, so the tests can drive them without a browser.

import { distance, angleTo, angleDifference } from './random.js';

export const WEAPONS = {
  fists: {
    key: 'fists', name: 'Fists', damage: 15, range: 1.5,
    rate: 0.35, auto: false, ammoKey: null, spread: 0.9,
  },
  pistol: {
    key: 'pistol', name: 'Pistol', damage: 26, range: 15,
    rate: 0.28, auto: false, ammoKey: 'pistol', spread: 0.12,
  },
  smg: {
    key: 'smg', name: 'SMG', damage: 13, range: 13,
    rate: 0.09, auto: true, ammoKey: 'smg', spread: 0.22,
  },
};

// Is a target inside the firing cone? target must be a {x, y} point.
export function inFiringCone(origin, aimAngle, weapon, target) {
  const d = distance(origin.x, origin.y, target.x, target.y);
  if (d > weapon.range) return false;
  if (d < 0.01) return true;
  const toTarget = angleTo(origin.x, origin.y, target.x, target.y);
  return Math.abs(angleDifference(aimAngle, toTarget)) <= weapon.spread;
}

// Fire the player's current weapon at a list of targets (peds, cops, cars).
// Returns the hit record or null. Consumes one round of ammo for guns.
export function fireWeapon(game, targets) {
  const player = game.player;
  const weapon = WEAPONS[player.weapon];
  if (!weapon || player.fireCooldown > 0) return null;
  if (weapon.ammoKey) {
    if ((player.ammo[weapon.ammoKey] || 0) <= 0) {
      game.events.push('dryFire');
      player.fireCooldown = weapon.rate;
      return null;
    }
    player.ammo[weapon.ammoKey] -= 1;
  }
  player.fireCooldown = weapon.rate;
  game.alarmTimer = 4; // gunfire draws attention
  game.events.push('shoot');
  game.muzzleFlash = 0.06;

  let best = null;
  let bestD = Infinity;
  for (const target of targets) {
    if (target === player) continue;
    if (target.alive === false) continue;
    if (target.health !== undefined && target.health <= 0) continue;
    if (!inFiringCone(player, player.aimAngle, weapon, target)) continue;
    const d = distance(player.x, player.y, target.x, target.y);
    if (d < bestD) {
      bestD = d;
      best = target;
    }
  }
  if (!best) return { hit: false, damage: 0 };
  const dealt = applyDamage(best, weapon.damage);
  game.events.push({ type: 'hit', damage: dealt, target: best });
  return { hit: true, target: best, damage: dealt };
}

// A punch: short range, wide arc, no ammo, no noise.
export function punchAttack(game, targets) {
  const player = game.player;
  const weapon = WEAPONS.fists;
  if (player.punchCooldown > 0) return null;
  player.punchCooldown = weapon.rate;
  game.events.push('punch');
  let best = null;
  let bestD = Infinity;
  for (const target of targets) {
    if (target === player) continue;
    if (target.health !== undefined && target.health <= 0) continue;
    if (!inFiringCone(player, player.aimAngle, weapon, target)) continue;
    const d = distance(player.x, player.y, target.x, target.y);
    if (d < bestD) {
      bestD = d;
      best = target;
    }
  }
  if (!best) return { hit: false, damage: 0 };
  const dealt = applyDamage(best, weapon.damage);
  game.events.push({ type: 'hit', damage: dealt, target: best });
  return { hit: true, target: best, damage: dealt };
}

// Damage goes to armor first, then health. Returns the damage actually dealt.
export function applyDamage(target, amount) {
  if (target.armor === undefined) target.armor = 0;
  if (target.health === undefined) target.health = 100;
  let remaining = amount;
  if (target.armor > 0) {
    const absorbed = Math.min(target.armor, remaining);
    target.armor -= absorbed;
    remaining -= absorbed;
  }
  target.health -= remaining;
  if (target.health <= 0) {
    target.health = 0;
    target.alive = false;
  }
  return amount;
}

export function damagePlayer(game, amount) {
  const dealt = applyDamage(game.player, amount);
  game.events.push({ type: 'playerHurt', damage: dealt });
  if (!game.player.alive) {
    game.state = 'gameover';
    game.events.push('playerDied');
  }
  return dealt;
}

// Switch the player's weapon if they own it.
export function selectWeapon(game, key) {
  const player = game.player;
  if (!WEAPONS[key]) return false;
  if (!player.weaponsOwned[key]) return false;
  player.weapon = key;
  return true;
}

export function allShootableTargets(game) {
  const targets = [];
  for (const ped of game.peds) targets.push(ped);
  for (const car of game.traffic) targets.push(car);
  for (const cop of game.police) targets.push(cop);
  if (game.policeBoat) targets.push(game.policeBoat);
  return targets;
}
