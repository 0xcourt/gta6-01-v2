// Solmar Heat — deterministic screenshot poses (?shot=start|play|chase|end&seed=1).
// Each pose sets a fixed game state so the four screenshots are reproducible.
import { startMission, completeMission, MISSIONS } from './missions.js';
import { makeCar, carDef } from './entities.js';

export function applyShot(game, shot) {
  if (shot === 'start') {
    game.screen = 'title';
    game.timeOfDay = 0.78; // dusk over the city
    game.player.x = 1000; game.player.y = 400;
    game.camera.x = 0; game.camera.y = 0;
  } else if (shot === 'play') {
    game.screen = 'play';
    game.timeOfDay = 0.5; // midday downtown
    const car = makeCar(carDef('coupe'), 1228, 428, 0); // on the road; no tall building to its south-east
    game.player.inCar = car; game.player.onFoot = false;
    game.cars.push(car);
    startMission(game.mission, 1);
    game.missionDef = MISSIONS[0];
    game.missionObjectiveText = MISSIONS[0].text;
    game.message = 'Deliver the package to the Marina';
  } else if (shot === 'chase') {
    game.screen = 'play';
    game.timeOfDay = 0.9; // night at the port
    game.wanted = 3;
    const car = makeCar(carDef('sport'), 228, 228, 0); // road intersection at the port
    car.hp = 9999; car.maxHp = 9999; // pose only: survive the screenshot
    game.player.inCar = car; game.player.onFoot = false;
    game.player.health = 100;
    game.cars.push(car);
    for (let i = 0; i < 3; i++) {
      const pc = makeCar(carDef('police'), 228 - 180 - i * 110, 228 + 40 + i * 30, 0);
      pc.isPolice = true; game.policeCars.push(pc); game.cars.push(pc);
    }
    startMission(game.mission, 3);
    game.missionDef = MISSIONS[2];
    game.missionObjectiveText = MISSIONS[2].text;
    game.message = 'Lose the police — 3 stars!';
  } else if (shot === 'end') {
    game.screen = 'complete';
    game.timeOfDay = 0.5;
    startMission(game.mission, 10);
    completeMission(game.mission, game.player);
    game.mission.status = 'done'; // final mission: the story is over
    game.missionDef = MISSIONS[9];
    game.missionObjectiveText = MISSIONS[9].text;
    game.player.cash = 25800;
    game.message = 'Mission complete: Take Back the Garage — +$8000';
  }
  return game;
}
export const SHOT_NAMES = ['start', 'play', 'chase', 'end'];
