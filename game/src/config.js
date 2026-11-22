// Solmar Heat — central tuning constants.
// One place holds every number the rest of the game balances against, so a
// tweak here ripples through driving, combat, the wanted system and missions
// without hunting through a dozen files.

export const TILE_W = 64; // iso tile width in screen pixels
export const TILE_H = 32; // iso tile height in screen pixels
export const WORLD_SIZE = 48; // the city is a 48 x 48 tile island grid
export const WATER_BORDER = 3; // tiles of open water around the island edge

export const PLAYER_WALK_SPEED = 6.0; // tiles per second on foot
export const PLAYER_SPRINT_SPEED = 9.5;
export const CAR_ACCEL = 15.0;
export const CAR_MAX_SPEED = 23.0;
export const CAR_REVERSE_SPEED = 8.0;
export const CAR_TURN_RATE = 2.9; // radians per second at full lock
export const CAR_BRAKE = 26.0;
export const BOAT_ACCEL = 12.0;
export const BOAT_MAX_SPEED = 27.0;

export const WANTED_MAX = 5;
export const WANTED_DECAY_HIDDEN_SECONDS = 9; // quiet seconds before a star fades
export const WANTED_DECAY_PER_SECOND = 0.12; // stars lost per second while hidden
export const POLICE_SIGHT_RANGE = 14; // tiles; closer than this and you are "seen"

export const STORY_GOAL_CASH = 25000; // what Roxy must earn to buy back the garage
export const DAY_LENGTH_SECONDS = 480; // one full in-game day, in real seconds
export const SAVE_KEY = 'solmar-heat-save-v1';

export const SHOP_PRICES = {
  armor: 200, // full armor vest
  pistolAmmo: 100, // +24 pistol rounds
  smg: 1500, // buy the SMG (comes with 60 rounds)
  smgAmmo: 250, // +90 SMG rounds
  repair: 150, // patch the car you are driving back to full health
  car: 4000, // a fresh sports car delivered to the garage
};

export const DISTRICT_COLORS = {
  downtown: ['#c98f4e', '#b57a3e', '#d9a05f', '#8f6b4a'],
  residential: ['#e0a878', '#c98f6b', '#dba878', '#b98a5e'],
  port: ['#9a8f7a', '#7d7466', '#a89a82', '#6e6a5e'],
  marina: ['#e8d8b0', '#d9c49a', '#f0e0bd', '#c9b184'],
  industrial: ['#8d8578', '#756e62', '#9b9384', '#5f5a52'],
  hills: ['#f0e6d2', '#e6d6b8', '#d9c49a', '#efe0c2'],
  beach: ['#f2e3b8', '#e8d5a0', '#f7eac6', '#ddc793'],
  uptown: ['#dba878', '#c98f6b', '#e0b184', '#b98a5e'],
};

export const BUILDING_HEIGHTS = {
  downtown: [46, 132],
  residential: [18, 46],
  port: [14, 26],
  marina: [14, 30],
  industrial: [16, 32],
  hills: [12, 26],
  beach: [12, 22],
  uptown: [20, 54],
};

export const CAR_COLORS = [
  '#c0392b', '#2980b9', '#f1c40f', '#27ae60', '#8e44ad',
  '#e67e22', '#ecf0f1', '#2c3e50', '#16a085', '#d35400',
];

export const PALETTES = {
  day: {
    name: 'day', sky: '#7ec8e3', water: '#2e86c1', waterDeep: '#1f618d',
    land: '#7fb069', landDry: '#a3b86b', road: '#4a4a52', roadLine: '#e8e8e8',
    beach: '#ecd9a0', dock: '#8d7b68', bridge: '#6e5a44', night: 0,
  },
  sunset: {
    name: 'sunset', sky: '#e8907c', water: '#7a4a8f', waterDeep: '#5d3a6e',
    land: '#8a9a58', landDry: '#a8905e', road: '#4a3f4a', roadLine: '#f0d0a0',
    beach: '#e8c890', dock: '#7d6b58', bridge: '#5e4a3a', night: 0.25,
  },
  night: {
    name: 'night', sky: '#0d1b3a', water: '#12294d', waterDeep: '#0a1a33',
    land: '#2e4a2e', landDry: '#3d4a2e', road: '#23232e', roadLine: '#8a8a7a',
    beach: '#5e5238', dock: '#3a3230', bridge: '#2e2620', night: 1,
  },
};

export const MISSION_CASH_GOAL = STORY_GOAL_CASH;
