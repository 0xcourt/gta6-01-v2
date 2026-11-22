// Solmar Heat — the story: ten missions for Rosa "Roxy" Marín.
// Roxy, a former getaway driver turned courier, has to earn $25,000 to buy
// back her late father's garage from the rival crew boss El Toro. Every
// mission pays out, and the ten payouts add up to exactly $25,000.
// A mission is a list of objectives; the state machine walks them in order
// (start -> objectives -> complete -> next mission) and ends the story after
// mission ten.

import { distance } from './random.js';

export function buildMissions(world) {
  const L = world.landmarks;
  return [
    {
      id: 1,
      title: 'First Delivery',
      brief: [
        'ROXY: One last courier run and the garage fund starts growing.',
        'Pick up the package at the corner shop, then drop it on the beach strip.',
      ],
      reward: 500,
      objectives: [
        { type: 'goto', x: L.shop.x, y: L.shop.y, label: 'Pick up the package at the corner shop' },
        { type: 'goto', x: L.beach.x, y: L.beach.y, label: 'Deliver the package to the beach strip' },
      ],
    },
    {
      id: 2,
      title: 'Hot Wheels',
      brief: [
        'ROXY: No wheels, no work. Borrow a car — permanently.',
        'El Toro\'s boys watch the garage. Take any parked car and bring it home.',
      ],
      reward: 800,
      objectives: [
        { type: 'steal', label: 'Steal a car (press E next to one)' },
        { type: 'goto', x: L.garage.x, y: L.garage.y, label: 'Bring the car back to the garage' },
      ],
    },
    {
      id: 3,
      title: 'The Getaway',
      brief: [
        'ROXY: El Toro\'s crew knows my face now. Time to prove the old getaway driver still has it.',
        'Race to the hillside villas before the timer runs out.',
      ],
      reward: 1200,
      objectives: [
        { type: 'race', x: L.hills.x, y: L.hills.y, timer: 90, label: 'Race to the hillside villas — beat the clock' },
      ],
    },
    {
      id: 4,
      title: 'Dockside Pickup',
      brief: [
        'ROXY: A crate came in on the night ferry. Nobody asks what\'s inside.',
        'Collect it at the port, then run it up to downtown.',
      ],
      reward: 1500,
      objectives: [
        { type: 'goto', x: L.port.x, y: L.port.y, label: 'Collect the crate at the port' },
        { type: 'goto', x: L.downtown.x, y: L.downtown.y, label: 'Deliver the crate downtown' },
      ],
    },
    {
      id: 5,
      title: 'Heat on the Strip',
      brief: [
        'ROXY: The cops are crawling the beach strip tonight. So be it.',
        'Survive 60 seconds with the heat on you. Don\'t get boxed in.',
      ],
      reward: 2000,
      objectives: [
        { type: 'survive', timer: 60, stars: 2, label: 'Survive the heat for 60 seconds' },
      ],
    },
    {
      id: 6,
      title: 'Island Run',
      brief: [
        'ROXY: A client on the east island pays double for discretion.',
        'Take the speedboat from the marina and cross to the east island.',
      ],
      reward: 2500,
      objectives: [
        { type: 'goto', x: L.marina.x, y: L.marina.y, label: 'Get to the marina' },
        { type: 'boat', x: L.islandEast.x, y: L.islandEast.y, label: 'Take the boat across to the east island' },
      ],
    },
    {
      id: 7,
      title: "El Toro's Errand",
      brief: [
        'ROXY: El Toro wants a "favour". I do it, he backs off the garage — for now.',
        'Run his package to the industrial zone. 75 seconds, no excuses.',
      ],
      reward: 3000,
      objectives: [
        { type: 'race', x: L.industrial.x, y: L.industrial.y, timer: 75, label: 'Deliver to the industrial zone in 75 seconds' },
      ],
    },
    {
      id: 8,
      title: 'Midnight Chase',
      brief: [
        'ROXY: Three stars and every cruiser in Solmar on my tail. Classic.',
        'Lose the police completely — get the wanted level back to zero.',
      ],
      reward: 3500,
      objectives: [
        { type: 'escape', stars: 3, label: 'Lose the police — get back to zero stars' },
      ],
    },
    {
      id: 9,
      title: 'The Big Score Setup',
      brief: [
        'ROXY: Three drops, three corners of the city. Then the garage is almost mine.',
        'Collect the packages at the port, downtown and the hills.',
      ],
      reward: 4000,
      objectives: [
        { type: 'goto', x: L.port.x, y: L.port.y, label: 'Collect package 1 of 3 — the port' },
        { type: 'goto', x: L.downtown.x, y: L.downtown.y, label: 'Collect package 2 of 3 — downtown' },
        { type: 'goto', x: L.hills.x, y: L.hills.y, label: 'Collect package 3 of 3 — the hills' },
      ],
    },
    {
      id: 10,
      title: 'The Garage Heist',
      brief: [
        'ROXY: Tonight I take back what\'s mine. El Toro\'s crew guards the garage — hold them off.',
        'Get to the garage and survive the final stand. Then the keys are mine.',
      ],
      reward: 6000,
      objectives: [
        { type: 'goto', x: L.garage.x, y: L.garage.y, label: 'Get to the garage' },
        { type: 'survive', timer: 45, stars: 3, label: 'Hold the garage for 45 seconds' },
      ],
    },
  ];
}

export class MissionState {
  constructor(missions) {
    this.missions = missions;
    this.index = 0; // which mission is active
    this.objectiveIndex = 0; // which objective inside it
    this.timer = 0; // counts down for timed objectives
    this.state = 'active'; // active | done
    this.started = false;
  }

  current() {
    return this.missions[this.index] || null;
  }

  objective() {
    const mission = this.current();
    if (!mission) return null;
    return mission.objectives[this.objectiveIndex] || null;
  }

  get done() {
    return this.index >= this.missions.length;
  }

  get totalReward() {
    return this.missions.reduce((sum, m) => sum + m.reward, 0);
  }

  startObjective(game) {
    const objective = this.objective();
    if (!objective) return;
    if (objective.timer) this.timer = objective.timer;
    if (objective.type === 'survive' || objective.type === 'escape') {
      const stars = objective.stars || 2;
      if (game.wanted < stars) game.wanted = stars;
      game.lastCrimeAt = game.elapsed;
    }
    this.started = true;
  }

  update(game, dt) {
    if (this.done) return;
    const mission = this.current();
    const objective = this.objective();
    if (!mission || !objective) return;
    const player = game.player;

    if (objective.type === 'goto' || objective.type === 'deliver'
      || objective.type === 'race' || objective.type === 'boat') {
      const d = distance(player.x, player.y, objective.x, objective.y);
      if (objective.type === 'boat'
        && (!player.vehicle || player.vehicle.kind !== 'boat')) {
        // The boat leg only counts while actually on the water.
        if (d < 2.5) game.events.push('needBoat');
      } else if (d < 2.2) {
        this.completeObjective(game);
        return;
      }
      if (objective.type === 'race') {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.timer = objective.timer;
          game.message = 'Too slow — the clock reset. Try again, faster.';
          game.messageTimer = 3;
          game.events.push('raceReset');
        }
      }
      return;
    }

    if (objective.type === 'steal') {
      if (player.vehicle) this.completeObjective(game);
      return;
    }

    if (objective.type === 'escape') {
      if (game.wanted <= 0) this.completeObjective(game);
      return;
    }

    if (objective.type === 'survive') {
      this.timer -= dt;
      if (game.wanted < 2) game.wanted = 2;
      if (this.timer <= 0) this.completeObjective(game);
    }
  }

  completeObjective(game) {
    const mission = this.current();
    game.events.push('objectiveDone');
    if (game.audio) game.audio.playPickup();
    this.objectiveIndex += 1;
    if (this.objectiveIndex >= mission.objectives.length) {
      this.finishMission(game);
    } else {
      this.startObjective(game);
    }
  }

  finishMission(game) {
    const mission = this.current();
    game.cash += mission.reward;
    game.message = `Mission complete: ${mission.title} — +$${mission.reward}`;
    game.messageTimer = 4;
    game.events.push('missionComplete');
    this.index += 1;
    this.objectiveIndex = 0;
    this.timer = 0;
    if (this.done) {
      this.state = 'done';
      game.state = 'complete';
      game.events.push('storyComplete');
    } else {
      this.startObjective(game);
    }
  }

  // Jump straight to a mission (used by the screenshot poses and saves).
  jumpTo(game, missionIndex) {
    this.index = Math.max(0, Math.min(missionIndex, this.missions.length - 1));
    this.objectiveIndex = 0;
    this.timer = 0;
    this.state = 'active';
    this.startObjective(game);
  }
}
