// Solmar Heat — configuration: tuning, palette, districts, vehicles, shops.
// All values are plain data so the game logic can be tested without a browser.
export const GAME_TITLE = 'SOLMAR HEAT';
export const GAME_SUBTITLE = 'A sun-soaked coastal crime story';
export const WORLD_W = 2400;
export const WORLD_H = 2400;
export const TILE = 48;
export const DAY_LENGTH = 240; // seconds for a full day/night cycle
export const GARAGE_PRICE = 25000;
export const START_CASH = 150;
export const MAX_WANTED = 5;
export const MAX_HEALTH = 100;

export const PALETTE = {
  skyDawn: '#ff9a5c', skyDay: '#7ec8e3', skyDusk: '#ff7e5f', skyNight: '#1b2340',
  sand: '#f2d8a0', grass: '#7fae5a', road: '#3a3a44', roadLine: '#e8d44d',
  sidewalk: '#b8a88a', water: '#2a7fa8', waterDeep: '#1d5f86',
  building: ['#e8b4a0', '#d9a066', '#c98f7a', '#a8b8c8', '#e0c090', '#b0a0c0'],
  neon: ['#ff2e88', '#00e5ff', '#ffe600', '#7cff00', '#ff6a00'],
};

export const DISTRICTS = [
  { name: 'Port & Docks', x: 0, y: 0, w: 620, h: 620, kind: 'port', color: '#8a7a5a' },
  { name: 'Downtown', x: 640, y: 80, w: 760, h: 700, kind: 'downtown', color: '#c8b090' },
  { name: 'Marina', x: 1420, y: 60, w: 500, h: 560, kind: 'marina', color: '#7fb8c8' },
  { name: 'Beach Strip', x: 640, y: 800, w: 900, h: 420, kind: 'beach', color: '#f2d8a0' },
  { name: 'Industrial', x: 0, y: 640, w: 620, h: 560, kind: 'industrial', color: '#9a8a78' },
  { name: 'Hillside Villas', x: 1560, y: 800, w: 840, h: 560, kind: 'villas', color: '#b8c898' },
  { name: 'Old Town', x: 640, y: 1240, w: 900, h: 560, kind: 'oldtown', color: '#d8b088' },
  { name: 'North Island', x: 1560, y: 80, w: 0, h: 0, kind: 'island', color: '#a8d8b0' },
];

export const CARS = [
  { id: 'sedan', name: 'Solmar Sedan', color: '#c0392b', speed: 340, accel: 220, price: 1200, hp: 100 },
  { id: 'taxi', name: 'City Taxi', color: '#f1c40f', speed: 320, accel: 200, price: 900, hp: 90 },
  { id: 'coupe', name: 'Sunset Coupe', color: '#8e44ad', speed: 420, accel: 300, price: 4500, hp: 80 },
  { id: 'pickup', name: 'Dock Pickup', color: '#2e86c1', speed: 300, accel: 190, price: 1500, hp: 140 },
  { id: 'sport', name: 'Vela Sport', color: '#e74c3c', speed: 480, accel: 360, price: 9000, hp: 70 },
  { id: 'van', name: 'Courier Van', color: '#f8f9fa', speed: 280, accel: 170, price: 2000, hp: 160 },
  { id: 'police', name: 'Police Cruiser', color: '#1a2a4a', speed: 440, accel: 330, price: 0, hp: 120 },
  { id: 'boat', name: 'Marina Speedboat', color: '#ffffff', speed: 380, accel: 260, price: 6000, hp: 90 },
];

export const WEAPONS = [
  { id: 'fists', name: 'Fists', damage: 12, price: 0, ammo: Infinity, range: 46 },
  { id: 'pistol', name: 'Pistol', damage: 34, price: 800, ammo: 24, range: 420 },
  { id: 'smg', name: 'Street SMG', damage: 18, price: 2400, ammo: 60, range: 360 },
];

export const SHOP_ITEMS = [
  { id: 'pistol', kind: 'weapon', name: 'Pistol + 24 rounds', price: 800 },
  { id: 'ammo', kind: 'ammo', name: 'Pistol ammo (24)', price: 150 },
  { id: 'smg', kind: 'weapon', name: 'Street SMG + 60 rounds', price: 2400 },
  { id: 'armor', kind: 'armor', name: 'Body armor (+50)', price: 500 },
  { id: 'health', kind: 'health', name: 'First-aid kit (full heal)', price: 200 },
  { id: 'coupe', kind: 'car', name: 'Sunset Coupe', price: 4500 },
  { id: 'sport', kind: 'car', name: 'Vela Sport', price: 9000 },
  { id: 'boat', kind: 'car', name: 'Marina Speedboat', price: 6000 },
  { id: 'safehouse', kind: 'safehouse', name: 'Safehouse upgrade (heal + save)', price: 3000 },
];

export const WANTED_LABELS = ['', 'Watched', 'Chased', 'Hunted', 'Siege', 'Lockdown'];
export const CONTROLS = [
  ['W A S D / Arrows', 'Move / drive'],
  ['E', 'Enter, exit or steal car / boat'],
  ['F', 'Punch'],
  ['Mouse aim + Click', 'Shoot pistol / SMG'],
  ['Space', 'Handbrake'],
  ['P / Esc', 'Pause'],
  ['M', 'Mute music & sound'],
  ['1 / 2 / 3', 'Fists / Pistol / SMG'],
];
