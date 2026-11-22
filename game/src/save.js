// Solmar Heat — save / load. Pure serialize/deserialize over a plain object,
// so tests can pass a fake storage. The browser wrapper uses localStorage.
export const SAVE_KEY = 'solmar-heat-save-v1';

export function serializeSave(game) {
  return {
    version: 1, seed: game.seed,
    player: {
      x: game.player.x, y: game.player.y, health: game.player.health, armor: game.player.armor,
      cash: game.player.cash, weapon: game.player.weapon, ammo: game.player.ammo,
      weaponsOwned: game.player.weaponsOwned, safehouseLevel: game.player.safehouseLevel,
      garageOwned: game.player.garageOwned,
    },
    mission: game.mission, wanted: game.wanted, timeOfDay: game.timeOfDay,
    carsOwned: game.carsOwned, stats: game.stats,
  };
}

export function deserializeSave(data) {
  if (!data || typeof data !== 'object' || data.version !== 1) return null;
  if (typeof data.player?.x !== 'number' || typeof data.player?.cash !== 'number') return null;
  if (!data.mission || typeof data.mission.current !== 'number') return null;
  return data;
}

export function saveGame(storage, game) {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(serializeSave(game)));
    return true;
  } catch { return false; }
}
export function loadGame(storage) {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return null;
    return deserializeSave(JSON.parse(raw));
  } catch { return null; }
}
export function hasSave(storage) {
  try { return storage.getItem(SAVE_KEY) !== null; } catch { return false; }
}
export function clearSave(storage) {
  try { storage.removeItem(SAVE_KEY); return true; } catch { return false; }
}
