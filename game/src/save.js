// Solmar Heat — save and load through localStorage.
// The save is a small plain object: cash, health, position, mission progress,
// wanted level, clock and weapons. Where localStorage does not exist (the
// node tests), an in-memory slot stands in so the round-trip still works.

import { SAVE_KEY } from './config.js';

let memorySlot = null;

function storage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch (err) {
    // localStorage exists but is blocked (private mode, sandbox).
  }
  return null;
}

export function saveGame(game) {
  const data = {
    version: 1,
    cash: game.cash,
    health: game.player.health,
    armor: game.player.armor,
    x: game.player.x,
    y: game.player.y,
    missionIndex: game.missions.index,
    objectiveIndex: game.missions.objectiveIndex,
    wanted: game.wanted,
    timeHours: game.timeHours,
    weapon: game.player.weapon,
    weaponsOwned: { ...game.player.weaponsOwned },
    ammo: { ...game.player.ammo },
    savedAt: new Date().toISOString(),
  };
  const store = storage();
  if (store) {
    try {
      store.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (err) {
      memorySlot = data;
    }
  } else {
    memorySlot = data;
  }
  return data;
}

export function loadGame() {
  const store = storage();
  let raw = null;
  if (store) {
    try {
      raw = store.getItem(SAVE_KEY);
    } catch (err) {
      raw = null;
    }
  }
  if (!raw && memorySlot) return { ...memorySlot };
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || data.version !== 1) return null;
    return data;
  } catch (err) {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  const store = storage();
  if (store) {
    try {
      store.removeItem(SAVE_KEY);
    } catch (err) { /* ignore */ }
  }
  memorySlot = null;
}

// Write a loaded save back into a live game object.
export function applySave(game, data) {
  if (!data) return false;
  game.cash = data.cash || 0;
  game.player.health = data.health ?? 100;
  game.player.armor = data.armor ?? 0;
  game.player.x = data.x ?? game.world.landmarks.spawn.x;
  game.player.y = data.y ?? game.world.landmarks.spawn.y;
  game.player.alive = game.player.health > 0;
  game.player.onFoot = true;
  game.player.vehicle = null;
  game.wanted = data.wanted || 0;
  game.timeHours = data.timeHours ?? 10;
  game.player.weapon = data.weapon || 'pistol';
  game.player.weaponsOwned = { fists: true, pistol: true, smg: false, ...(data.weaponsOwned || {}) };
  game.player.ammo = { pistol: 48, smg: 0, ...(data.ammo || {}) };
  game.missions.jumpTo(game, data.missionIndex || 0);
  game.missions.objectiveIndex = data.objectiveIndex || 0;
  game.state = 'playing';
  return true;
}
