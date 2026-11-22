// Solmar Heat — deterministic screenshot poses.
// `?shot=start|play|chase|end&seed=1` puts the game into a fixed pose so the
// four screenshots are reproducible: the title over the city, daytime
// driving, a night chase at three stars, and the story-complete screen.
// Each pose sets the clock, the wanted level, the mission, the player's
// health and position, and spawns the police the scene needs.

import { makePoliceCar, makeTrafficCar, makeParkedCar } from './entities.js';
import { CAR_COLORS } from './config.js';

export const SHOT_NAMES = ['start', 'play', 'chase', 'end'];

export function applyShot(game, name) {
  const L = game.world.landmarks;
  if (name === 'start') {
    game.state = 'title';
    game.timeHours = 10.5;
    game.cash = 0;
    game.wanted = 0;
    game.player.x = L.spawn.x;
    game.player.y = L.spawn.y;
    game.player.health = 100;
    game.player.alive = true;
    game.cameraTarget = { x: L.downtown.x, y: L.downtown.y };
    game.missions.jumpTo(game, 0);
    return 'start';
  }

  if (name === 'play') {
    game.state = 'playing';
    game.timeHours = 13.0;
    game.cash = 1250;
    game.wanted = 0;
    game.police = [];
    game.policeBoat = null;
    // Roxy driving a red sedan down a downtown road, traffic around her.
    const car = makeParkedCar(16.5, 20.5, 0, '#c0392b', 'sedan');
    car.driver = 'player';
    car.speed = 9;
    game.player.vehicle = car;
    game.player.onFoot = false;
    game.player.x = car.x;
    game.player.y = car.y;
    game.player.angle = 0;
    game.player.health = 100;
    game.player.armor = 25;
    game.player.weapon = 'pistol';
    game.player.ammo.pistol = 36;
    game.traffic = [
      makeTrafficCar(12.5, 20.5, 0, CAR_COLORS[1], game.rng),
      makeTrafficCar(20.5, 16.5, Math.PI / 2, CAR_COLORS[2], game.rng),
    ];
    for (const t of game.traffic) t.speed = 6;
    game.cameraTarget = null;
    game.missions.jumpTo(game, 0);
    game.missions.objectiveIndex = 1;
    game.message = 'Deliver the package to the beach strip';
    game.messageTimer = 99;
    return 'play';
  }

  if (name === 'chase') {
    game.state = 'playing';
    game.timeHours = 22.0;
    game.cash = 8400;
    game.wanted = 3;
    game.lastCrimeAt = game.elapsed;
    game.player.health = 82;
    game.player.armor = 40;
    game.player.alive = true;
    game.player.weapon = 'smg';
    game.player.weaponsOwned.smg = true;
    game.player.ammo.smg = 90;
    const car = makeParkedCar(18.5, 20.5, Math.PI / 2, '#c0392b', 'sedan');
    car.driver = 'player';
    car.speed = 12;
    game.player.vehicle = car;
    game.player.onFoot = false;
    game.player.x = car.x;
    game.player.y = car.y;
    game.player.angle = Math.PI / 2;
    game.traffic = [makeTrafficCar(12.5, 16.5, 0, CAR_COLORS[3], game.rng)];
    game.traffic[0].speed = 6;
    // Three cruisers closing in from different directions.
    game.police = [];
    const spots = [
      [14.5, 16.5], [22.5, 20.5], [18.5, 24.5],
    ];
    for (const [x, y] of spots) {
      const cop = makePoliceCar(x, y);
      cop.angle = Math.atan2(game.player.y - y, game.player.x - x);
      cop.speed = 10;
      cop.sirenPhase = x;
      game.police.push(cop);
    }
    game.cameraTarget = null;
    game.missions.jumpTo(game, 7); // mission 8: Midnight Chase
    game.message = 'Lose the police — get back to zero stars';
    game.messageTimer = 99;
    return 'chase';
  }

  if (name === 'end') {
    game.state = 'complete';
    game.timeHours = 18.5;
    game.cash = 25000;
    game.wanted = 0;
    game.police = [];
    game.player.health = 100;
    game.player.alive = true;
    game.player.x = L.garage.x;
    game.player.y = L.garage.y;
    game.cameraTarget = { x: L.garage.x, y: L.garage.y };
    game.missions.index = game.missions.missions.length;
    game.missions.objectiveIndex = 0;
    game.missions.state = 'done';
    return 'end';
  }

  return null;
}
