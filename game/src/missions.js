// Solmar Heat — 10-mission story arc. Roxy must earn 25,000 to buy back her
// late father's garage from crew boss El Toro. Pure state machine + data.
export const MISSIONS = [
  { id: 1, title: 'First Delivery', giver: 'Mama Luz', reward: 400, kind: 'deliver',
    briefing: 'Mama Luz needs a package at the Marina. Drive it there, no questions.',
    dialogue: ['ROXY: One package, one drive. Easy money.', 'MAMA LUZ: The marina boys are watching. Be quick, mija.'],
    target: { x: 1720, y: 420 }, text: 'Deliver the package to the Marina' },
  { id: 2, title: 'Hot Wheels', giver: 'Tito', reward: 600, kind: 'steal',
    briefing: 'Tito wants a Sunset Coupe from Downtown. Borrow it. Permanently.',
    dialogue: ['TITO: Parked outside the tower, keys in it. Rich people, huh?', 'ROXY: Borrowing is such an ugly word.'],
    target: { x: 1000, y: 400 }, text: 'Steal the Sunset Coupe and bring it to the garage' },
  { id: 3, title: 'The Getaway', giver: 'Mama Luz', reward: 900, kind: 'escape',
    briefing: 'A pickup went loud. Lose the police, then reach the safehouse.',
    dialogue: ['ROXY: Two stars already? I just got here.', 'MAMA LUZ: Drive like your father taught you.'],
    target: { x: 820, y: 1380 }, text: 'Lose the police, then reach the safehouse' },
  { id: 4, title: 'Dockside Pickup', giver: 'Captain Vela', reward: 1200, kind: 'deliver',
    briefing: 'Crates at the Port need a courier. Pick up at the docks, drop at Old Town.',
    dialogue: ['CAPTAIN VELA: The manifest says machine parts. Do not open it.', 'ROXY: Machine parts. Got it. Heavy machine parts.'],
    target: { x: 1000, y: 1500 }, text: 'Collect the crate at the Port, deliver to Old Town' },
  { id: 5, title: 'Beach Run', giver: 'Tito', reward: 1500, kind: 'race',
    briefing: 'A race down the Beach Strip. Beat the clock, beat the traffic.',
    dialogue: ['TITO: Three checkpoints, one beach. Do not hit the umbrellas.', 'ROXY: No promises about the umbrellas.'],
    target: { x: 1500, y: 1900 }, text: 'Hit all 3 beach checkpoints before time runs out' },
  { id: 6, title: 'Harbor Lights', giver: 'Captain Vela', reward: 2200, kind: 'boat',
    briefing: 'Take the speedboat from the Marina to Isla Verde. The police boat is out tonight.',
    dialogue: ['CAPTAIN VELA: The boat is fast. The water is faster. Go.', 'ROXY: Finally, a job with a view.'],
    target: { x: 2190, y: 450 }, text: 'Take the boat to Isla Verde' },
  { id: 7, title: 'Debt Collector', giver: 'El Toro', reward: 3000, kind: 'combat',
    briefing: 'El Toro wants a word with a rival crew at the Industrial zone. Bring protection.',
    dialogue: ['EL TORO: You drive for me now, Roxy. Collect what they owe.', 'ROXY: I collect. I do not kneel.'],
    target: { x: 300, y: 900 }, text: 'Deal with the rival crew at the Industrial zone' },
  { id: 8, title: 'Night Shift', giver: 'Mama Luz', reward: 3800, kind: 'deliver',
    briefing: 'Three drops across the city, all before dawn. The night is yours.',
    dialogue: ['MAMA LUZ: Downtown, Marina, Old Town. In that order.', 'ROXY: Three drops, one tank of gas. Let us go.'],
    target: { x: 1000, y: 400 }, text: 'Make all 3 drops: Downtown, Marina, Old Town' },
  { id: 9, title: 'The Setup', giver: 'Tito', reward: 5000, kind: 'escape',
    briefing: 'El Toro set a trap. Survive the ambush, escape with 4 stars, reach the garage.',
    dialogue: ['TITO: It is a trap, Roxy. The whole crew is coming.', 'ROXY: Then they will learn what my father taught me.'],
    target: { x: 900, y: 1500 }, text: 'Survive the ambush and reach the garage' },
  { id: 10, title: 'Take Back the Garage', giver: 'Roxy', reward: 8000, kind: 'heist',
    briefing: 'Final job: storm El Toro\u2019s tower, take the deed, and buy back Marin Garage for good.',
    dialogue: ['ROXY: This is for my father. For the garage. For Solmar.', 'EL TORO: You cannot take what is mine, little driver.', 'ROXY: Watch me.'],
    target: { x: 1100, y: 300 }, text: 'Storm the tower, take the deed, return to the garage' },
];

export function missionById(id) { return MISSIONS.find((m) => m.id === id) || null; }

export function makeMissionState() {
  return { current: 1, status: 'idle', // idle | active | complete | done
    objectiveIndex: 0, timer: 0, checkpointsHit: 0, dropsDone: 0,
    completed: [], totalEarned: 0, message: '', dialogueIndex: 0 };
}

export function startMission(state, id) {
  const m = missionById(id);
  if (!m) return state;
  state.current = id; state.status = 'active';
  state.objectiveIndex = 0; state.timer = m.kind === 'race' ? 75 : 0;
  state.checkpointsHit = 0; state.dropsDone = 0; state.dialogueIndex = 0;
  state.message = m.briefing;
  return state;
}

export function completeMission(state, player) {
  const m = missionById(state.current);
  if (!m || state.status !== 'active') return null;
  state.status = 'complete';
  state.completed.push(m.id);
  state.totalEarned += m.reward;
  if (player) player.cash += m.reward;
  state.message = `Mission complete: ${m.title} — +$${m.reward}`;
  return m;
}

export function advanceMission(state, player) {
  // Called after the complete screen is dismissed.
  if (state.status !== 'complete') return state;
  const next = state.current + 1;
  if (next > MISSIONS.length) { state.status = 'done'; return state; }
  return startMission(state, next);
}

export function missionProgress(state) {
  return { done: state.completed.length, total: MISSIONS.length, current: state.current, status: state.status };
}
export function isStoryDone(state) { return state.status === 'done'; }
