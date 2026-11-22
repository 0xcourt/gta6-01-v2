// Solmar Heat — city generation. Seeded, deterministic: the same seed builds the
// same city every time. Grid roads, district buildings, palms, water, islands, bridges.
import { makeRng, clamp } from './random.js';
import { WORLD_W, WORLD_H, DISTRICTS, PALETTE } from './config.js';

export const ROAD_SPACING = 200;
export const ROAD_W = 56;

export function generateWorld(seed = 1) {
  const rng = makeRng(seed);
  const buildings = [];
  const palms = [];
  const props = [];
  // Water: sea along the south and east edges, plus a marina bay in the north-east.
  const water = [
    { x: 0, y: 1960, w: WORLD_W, h: 440 },          // southern sea / beach
    { x: 1980, y: 0, w: 420, h: 1960 },             // eastern sea
    { x: 1500, y: 0, w: 480, h: 300 },              // marina bay
  ];
  // Two islands in the eastern sea, linked by bridges.
  const islands = [
    { x: 2060, y: 300, w: 260, h: 300, name: 'Isla Verde' },
    { x: 2060, y: 900, w: 260, h: 320, name: 'Isla Luz' },
  ];
  const bridges = [
    { x: 1960, y: 420, w: 140, h: 60, angle: 0 },
    { x: 1960, y: 1020, w: 140, h: 60, angle: 0 },
    { x: 2120, y: 600, w: 60, h: 320, angle: 0 },
  ];
  const isWater = (x, y) => {
    for (const b of bridges) if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return false;
    for (const w of water) if (x >= w.x && x < w.x + w.w && y >= w.y && y < w.y + w.h) return true;
    return false;
  };
  const onIsland = (x, y) => islands.some((i) => x >= i.x && x < i.x + i.w && y >= i.y && y < i.y + i.h);
  const isRoad = (x, y) => {
    const rx = x % ROAD_SPACING, ry = y % ROAD_SPACING;
    return rx < ROAD_W || ry < ROAD_W;
  };
  // Buildings fill the blocks between roads: one per grid block, snapped inside
  // the block so roads stay clear. This guarantees a dense, deterministic city.
  for (let gx = 0; gx < WORLD_W / ROAD_SPACING; gx++) {
    for (let gy = 0; gy < WORLD_H / ROAD_SPACING; gy++) {
      const bx0 = gx * ROAD_SPACING + ROAD_W + 12, by0 = gy * ROAD_SPACING + ROAD_W + 12;
      const cx = bx0 + 66, cy = by0 + 66;
      if (isWater(cx, cy)) continue;
      const d = DISTRICTS.find((dd) => cx >= dd.x && cx < dd.x + dd.w && cy >= dd.y && cy < dd.y + dd.h);
      if (!d || d.kind === 'island') continue;
      if (d.kind === 'beach' && rng.chance(0.7)) continue; // beach stays open
      if (rng.chance(0.12)) continue; // occasional empty lot / plaza
      const tall = d.kind === 'downtown';
      const w = rng.range(64, 110), h = rng.range(64, 110);
      buildings.push({
        x: cx - w / 2, y: cy - h / 2, w, h,
        height: tall ? rng.range(90, 260) : d.kind === 'villas' ? rng.range(30, 60) : rng.range(30, 110),
        color: rng.pick(PALETTE.building),
        neon: rng.chance(0.35) ? rng.pick(PALETTE.neon) : null,
        district: d.name, kind: d.kind,
        roof: rng.pick(['flat', 'flat', 'dome', 'pool']),
      });
    }
  }
  // Island buildings (small villas + a lighthouse on Isla Luz).
  for (const isl of islands) {
    for (let i = 0; i < 5; i++) {
      buildings.push({
        x: rng.range(isl.x + 30, isl.x + isl.w - 110), y: rng.range(isl.y + 30, isl.y + isl.h - 110),
        w: 70, h: 70, height: rng.range(30, 55), color: '#f0e0c0', neon: null,
        district: isl.name, kind: 'villas', roof: 'flat',
      });
    }
  }
  buildings.push({ x: 2180, y: 940, w: 36, h: 36, height: 150, color: '#f5f5f5', neon: '#ffe600', district: 'Isla Luz', kind: 'lighthouse', roof: 'dome' });
  // Palm trees along the beach strip and marina.
  for (let i = 0; i < 90; i++) {
    const x = rng.range(640, 1960), y = rng.range(1820, 1960);
    if (!isWater(x, y)) palms.push({ x, y, s: rng.range(0.8, 1.3), sway: rng.range(0, 6.28) });
  }
  for (let i = 0; i < 40; i++) palms.push({ x: rng.range(1500, 1960), y: rng.range(300, 560), s: rng.range(0.8, 1.2), sway: rng.range(0, 6.28) });
  // Props: crates at the port, containers, beach umbrellas, street lamps.
  for (let i = 0; i < 26; i++) props.push({ kind: 'crate', x: rng.range(40, 560), y: rng.range(40, 560), c: rng.pick(['#b5651d', '#2e86c1', '#c0392b']) });
  for (let i = 0; i < 18; i++) props.push({ kind: 'container', x: rng.range(40, 560), y: rng.range(300, 600), c: rng.pick(['#e67e22', '#16a085', '#7d3c98']) });
  for (let i = 0; i < 16; i++) props.push({ kind: 'umbrella', x: rng.range(700, 1500), y: rng.range(1840, 1940), c: rng.pick(PALETTE.neon) });
  return {
    seed, buildings, palms, props, water, islands, bridges,
    isWater, onIsland, isRoad,
    garage: { x: 900, y: 1500, w: 150, h: 110, name: "Marin Garage" },
    marina: { x: 1680, y: 380, w: 220, h: 120 },
    safehouse: { x: 820, y: 1380, w: 90, h: 80 },
    shop: { x: 1100, y: 500, w: 100, h: 80, name: 'Solmar Arms & Parts' },
    hospital: { x: 760, y: 900, w: 120, h: 100 },
  };
}

export function buildingAt(world, x, y) {
  for (const b of world.buildings) {
    if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return b;
  }
  return null;
}
export function collideCircle(world, x, y, r) {
  if (x < r || y < r || x > WORLD_W - r || y > WORLD_H - r) return true;
  if (world.isWater(x, y) && !world.onIsland(x, y)) return true;
  const b = buildingAt(world, x, y);
  return b !== null;
}
export function roadPoint(rng, world) {
  // A random point on a road, for spawning traffic / pedestrians.
  for (let tries = 0; tries < 40; tries++) {
    const x = rng.range(80, WORLD_W - 80), y = rng.range(80, WORLD_H - 80);
    if (world.isRoad(x, y) && !world.isWater(x, y)) return { x, y };
  }
  return { x: 700, y: 700 };
}
export function nearestRoadPoint(x, y) {
  const gx = Math.floor(x / ROAD_SPACING) * ROAD_SPACING + ROAD_W / 2;
  const gy = Math.floor(y / ROAD_SPACING) * ROAD_SPACING + ROAD_W / 2;
  return { x: clamp(gx, 40, WORLD_W - 40), y: clamp(gy, 40, WORLD_H - 40) };
}
