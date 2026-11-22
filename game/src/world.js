// Solmar Heat — seeded city generation.
// Solmar is a 48 x 48 tile island. A water channel splits it into a west
// island and an east island, joined by two bridges; a second channel cuts
// off a small southern beach islet, joined by a third bridge. Roads run on
// a 4-tile grid, blocks between them hold buildings, and the map is divided
// into districts (port, marina, downtown, beach, industrial, hills) that
// decide building height, colour and props. Everything comes from one seed.

import { makeRng, clamp, distance } from './random.js';
import {
  WORLD_SIZE, BUILDING_HEIGHTS, DISTRICT_COLORS, CAR_COLORS,
} from './config.js';

export const TILE = {
  WATER: 0,
  LAND: 1,
  ROAD: 2,
  BRIDGE: 3,
  BEACH: 4,
  DOCK: 5,
};

// The channel between the west and east islands, and the bridges over it.
export const CHANNEL_X0 = 22;
export const CHANNEL_X1 = 25;
export const BRIDGE_ROWS = [[11, 13], [31, 33]];
// The channel that cuts off the southern beach islet, and its bridge.
export const SOUTH_CHANNEL_Y0 = 38;
export const SOUTH_CHANNEL_Y1 = 39;
export const SOUTH_BRIDGE_X0 = 33;
export const SOUTH_BRIDGE_X1 = 35;

export function districtAt(x, y) {
  if (x >= 3 && x <= 9 && y >= 28) return 'port';
  if (x >= 42 && y >= 14 && y <= 20) return 'marina';
  if (x >= 28 && y <= 12) return 'industrial';
  if (x <= 12 && y <= 10) return 'hills';
  if (y >= 40) return 'beach';
  if (x >= 14 && x <= 20 && y >= 13 && y <= 22) return 'downtown';
  if (x >= 26) return 'uptown';
  return 'residential';
}

function onBridge(x, y) {
  if (x >= CHANNEL_X0 && x <= CHANNEL_X1) {
    for (const [y0, y1] of BRIDGE_ROWS) {
      if (y >= y0 && y <= y1) return true;
    }
  }
  if (y >= SOUTH_CHANNEL_Y0 && y <= SOUTH_CHANNEL_Y1) {
    if (x >= SOUTH_BRIDGE_X0 && x <= SOUTH_BRIDGE_X1) return true;
  }
  return false;
}

function inChannel(x, y) {
  if (x >= CHANNEL_X0 && x <= CHANNEL_X1) return true;
  if (y >= SOUTH_CHANNEL_Y0 && y <= SOUTH_CHANNEL_Y1 && x >= 26) return true;
  return false;
}

function tileFor(x, y) {
  if (x < 3 || x > WORLD_SIZE - 4 || y < 3 || y > WORLD_SIZE - 4) return TILE.WATER;
  if (inChannel(x, y)) return onBridge(x, y) ? TILE.BRIDGE : TILE.WATER;
  if (x >= 42 && y >= 14 && y <= 20) return TILE.DOCK;
  if (y >= 41) return TILE.BEACH;
  if (x % 4 === 0 || y % 4 === 0) return TILE.ROAD;
  return TILE.LAND;
}

function buildingOverlaps(list, b) {
  for (const other of list) {
    if (b.x < other.x + other.w && b.x + b.w > other.x
      && b.y < other.y + other.d && b.y + b.d > other.y) return true;
  }
  return false;
}

export function generateWorld(seed = 1) {
  const rng = makeRng(seed);
  const size = WORLD_SIZE;
  const grid = [];
  for (let y = 0; y < size; y += 1) {
    const row = [];
    for (let x = 0; x < size; x += 1) row.push(tileFor(x, y));
    grid.push(row);
  }

  // Buildings: one or two per city block, height and colour by district.
  const buildings = [];
  for (let by = 4; by <= size - 8; by += 4) {
    for (let bx = 4; bx <= size - 8; bx += 4) {
      const cx = bx + 2;
      const cy = by + 2;
      if (grid[cy][cx] !== TILE.LAND) continue;
      const district = districtAt(cx, cy);
      if (!rng.chance(0.86)) continue;
      const [hMin, hMax] = BUILDING_HEIGHTS[district];
      const palette = DISTRICT_COLORS[district];
      const count = district === 'downtown' && rng.chance(0.4) ? 2 : 1;
      for (let i = 0; i < count; i += 1) {
        const w = rng.float(1.5, 2.6);
        const d = rng.float(1.5, 2.6);
        const b = {
          x: bx + 0.6 + rng.float(0, 3.4 - w),
          y: by + 0.6 + rng.float(0, 3.4 - d),
          w, d,
          h: rng.float(hMin, hMax),
          color: rng.pick(palette),
          district,
          roof: rng.pick(['#5a4632', '#3d4a3d', '#6b5a4a', '#2f3a4a']),
          neon: district === 'downtown' && rng.chance(0.45),
          neonColor: rng.pick(['#ff2e88', '#22e6ff', '#ffd319', '#7cff5e']),
        };
        if (!buildingOverlaps(buildings, b)) buildings.push(b);
      }
    }
  }

  // Palm trees and street trees on open land, never inside a building.
  const trees = [];
  let treeTries = 0;
  while (trees.length < 150 && treeTries < 900) {
    treeTries += 1;
    const x = rng.float(3.5, size - 4.5);
    const y = rng.float(3.5, size - 4.5);
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    const t = grid[ty][tx];
    if (t !== TILE.LAND && t !== TILE.BEACH) continue;
    if (isPointInBuilding(buildings, x, y, 0.4)) continue;
    trees.push({
      x, y,
      kind: districtAt(tx, ty) === 'beach' || rng.chance(0.55) ? 'palm' : 'tree',
      s: rng.float(0.8, 1.3),
    });
  }

  // Street lamps along the roads, plus a few crates and hydrants near the port.
  const props = [];
  for (let y = 4; y < size - 4; y += 8) {
    for (let x = 4; x < size - 4; x += 8) {
      if (grid[y][x] === TILE.ROAD) props.push({ x: x + 0.4, y: y + 0.4, kind: 'lamp' });
    }
  }
  for (let i = 0; i < 26; i += 1) {
    props.push({
      x: rng.float(4, 10), y: rng.float(30, 43),
      kind: rng.chance(0.5) ? 'crate' : 'hydrant',
    });
  }

  // Parked cars on road tiles, spread across both islands.
  const parkedCars = [];
  const roadTiles = [];
  for (let y = 4; y < size - 4; y += 1) {
    for (let x = 4; x < size - 4; x += 1) {
      if (grid[y][x] === TILE.ROAD) roadTiles.push([x + 0.5, y + 0.5]);
    }
  }
  const shuffledRoads = rng.shuffle(roadTiles);
  for (let i = 0; i < 12 && i < shuffledRoads.length; i += 1) {
    const [x, y] = shuffledRoads[i * 7 % shuffledRoads.length];
    parkedCars.push({
      x, y,
      angle: rng.chance(0.5) ? 0 : Math.PI / 2,
      color: CAR_COLORS[i % CAR_COLORS.length],
      kind: rng.chance(0.2) ? 'taxi' : 'sedan',
    });
  }

  const landmarks = {
    spawn: { x: 12.5, y: 24.5 }, // Roxy starts on the road by her father's garage
    garage: { x: 10.5, y: 23.5 }, // the garage El Toro holds
    shop: { x: 17.5, y: 15.5 }, // corner shop in downtown
    downtown: { x: 17.5, y: 18.5 },
    port: { x: 6.5, y: 36.5 },
    marina: { x: 43.5, y: 17.5 }, // docks on the east edge
    boatDock: { x: 45.5, y: 17.5 }, // the speedboat, in the water by the dock
    beach: { x: 36.5, y: 42.5 },
    hills: { x: 8.5, y: 6.5 },
    industrial: { x: 36.5, y: 6.5 },
    islandEast: { x: 34.5, y: 24.5 },
    isletSouth: { x: 36.5, y: 42.5 },
    bridgeNorth: { x: 23.5, y: 12.5 },
    bridgeSouth: { x: 23.5, y: 32.5 },
  };

  return {
    seed, size, grid, buildings, trees, props, parkedCars, landmarks,
  };
}

export function tileAt(world, x, y) {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= world.size || ty >= world.size) return TILE.WATER;
  return world.grid[ty][tx];
}

export function isWaterAt(world, x, y) {
  return tileAt(world, x, y) === TILE.WATER;
}

export function isRoadAt(world, x, y) {
  const t = tileAt(world, x, y);
  return t === TILE.ROAD || t === TILE.BRIDGE;
}

export function isDriveableAt(world, x, y) {
  const t = tileAt(world, x, y);
  return t === TILE.ROAD || t === TILE.BRIDGE || t === TILE.DOCK || t === TILE.BEACH;
}

export function isWalkableAt(world, x, y) {
  const t = tileAt(world, x, y);
  return t !== TILE.WATER;
}

export function isPointInBuilding(buildings, x, y, pad = 0) {
  for (const b of buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad
      && y > b.y - pad && y < b.y + b.d + pad) return true;
  }
  return false;
}

export function isBlocked(world, x, y, pad = 0.25) {
  if (isWaterAt(world, x, y)) return true;
  return isPointInBuilding(world.buildings, x, y, pad);
}

// Find the nearest road tile to a point (used to drop traffic and the player
// back onto the street grid).
export function nearestRoadTile(world, x, y) {
  let best = null;
  let bestD = Infinity;
  for (let ty = 4; ty < world.size - 4; ty += 1) {
    for (let tx = 4; tx < world.size - 4; tx += 1) {
      if (!isRoadAt(world, tx + 0.5, ty + 0.5)) continue;
      const d = distance(x, y, tx + 0.5, ty + 0.5);
      if (d < bestD) {
        bestD = d;
        best = { x: tx + 0.5, y: ty + 0.5 };
      }
    }
  }
  return best;
}

export function clampToWorld(world, x, y) {
  return {
    x: clamp(x, 1, world.size - 2),
    y: clamp(y, 1, world.size - 2),
  };
}
