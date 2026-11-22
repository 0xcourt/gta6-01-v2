// Solmar Heat — wanted system + combat. Pure functions for the wanted ladder,
// damage, and shooting so the logic tests can exercise them headlessly.
import { clamp, dist } from './random.js';
import { WEAPONS, MAX_WANTED } from './config.js';

export function weaponDef(id) { return WEAPONS.find((w) => w.id === id) || WEAPONS[0]; }

// Wanted gain table: what each crime is worth in stars.
export const CRIME_WANTED = { stealCar: 1, punch: 1, shoot: 2, killPed: 2, killCop: 3, hitAndRun: 1 };

export function addWanted(state, crime) {
  const gain = CRIME_WANTED[crime] || 1;
  state.wanted = clamp(state.wanted + gain, 0, MAX_WANTED);
  state.wantedTimer = 0;
  state.hidden = false;
  return state.wanted;
}

// Decay: wanted falls one star after `seconds` hidden (out of police sight).
export function decayWanted(state, dt, isSeen) {
  if (state.wanted === 0) return 0;
  if (isSeen) { state.wantedTimer = 0; return state.wanted; }
  state.wantedTimer += dt;
  const need = 14 + state.wanted * 6; // higher wanted takes longer to shake
  if (state.wantedTimer >= need) {
    state.wanted -= 1;
    state.wantedTimer = 0;
  }
  return state.wanted;
}

export function policeCountFor(wanted) {
  return { cars: Math.min(wanted, 4), cops: wanted >= 2 ? Math.min((wanted - 1) * 2, 6) : 0, boat: wanted >= 3 ? 1 : 0 };
}

export function applyDamage(target, raw, armorFirst = true) {
  let dmg = raw;
  if (armorFirst && target.armor > 0) {
    const absorbed = Math.min(target.armor, dmg);
    target.armor -= absorbed; dmg -= absorbed;
  }
  target.health = Math.max(0, target.health - dmg);
  return target.health;
}

// A shot: returns hit info. Shooter at (x,y) aiming at angle, target list of {x,y,r,health}.
export function shoot(shooter, angle, targets, weaponId, rng) {
  const w = weaponDef(weaponId);
  const range = w.range;
  let best = null; let bestD = Infinity;
  for (const t of targets) {
    const d = dist(shooter.x, shooter.y, t.x, t.y);
    if (d > range + (t.r || 20)) continue;
    const a = Math.atan2(t.y - shooter.y, t.x - shooter.x);
    let diff = Math.abs(((a - angle) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
    if (diff < 0.16 && d < bestD) { best = t; bestD = d; }
  }
  if (!best) return { hit: false, target: null, damage: 0 };
  const spread = rng ? rng.range(0.85, 1.15) : 1;
  const dmg = Math.round(w.damage * spread);
  best.health = Math.max(0, (best.health ?? 100) - dmg);
  return { hit: true, target: best, damage: dmg, killed: best.health <= 0 };
}

export function punch(shooter, targets) {
  const w = weaponDef('fists');
  for (const t of targets) {
    if (dist(shooter.x, shooter.y, t.x, t.y) < w.range + (t.r || 18)) {
      t.health = Math.max(0, (t.health ?? 100) - w.damage);
      return { hit: true, target: t, damage: w.damage, killed: t.health <= 0 };
    }
  }
  return { hit: false, target: null, damage: 0 };
}
