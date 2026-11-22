// Solmar Heat — deterministic random numbers.
// The whole city is generated from one seed with mulberry32, so the same seed
// always builds the same streets, buildings and trees. That is what makes the
// screenshot poses and the tests reproducible.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A small helper object that wraps a mulberry32 stream with the calls the
// world generator and the entity spawners actually need.
export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    // float in [min, max)
    float(min, max) {
      return min + next() * (max - min);
    },
    // integer in [min, max] inclusive
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    // true with probability p
    chance(p) {
      return next() < p;
    },
    // one element of an array
    pick(array) {
      return array[Math.floor(next() * array.length)];
    },
    // a shuffled copy of an array (Fisher-Yates)
    shuffle(array) {
      const copy = array.slice();
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        const tmp = copy[i];
        copy[i] = copy[j];
        copy[j] = tmp;
      }
      return copy;
    },
  };
}

export function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function distance(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

// Shortest signed difference between two angles, in (-PI, PI].
export function angleDifference(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

export function normalizeAngle(a) {
  let v = a % (Math.PI * 2);
  if (v > Math.PI) v -= Math.PI * 2;
  if (v < -Math.PI) v += Math.PI * 2;
  return v;
}
