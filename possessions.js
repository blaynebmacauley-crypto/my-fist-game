// Condensed, probabilistic off-screen drives for the three-minute prototype.
// These results are a simulation, not play-by-play regulation football.
const clamp = (n, low, high) => Math.min(high, Math.max(low, n));

/**
 * Simulate one possession. start is yards from the possessing team's own goal;
 * difficulty 0..2 represents the three high-school challenges. Both scoring and
 * scoreless results remain possible at every difficulty and field position.
 * Inject a [0, 1) RNG to make replays/tests deterministic.
 */
export function simulatePossession({difficulty = 0, start = 25} = {}, rng = Math.random) {
  if (!Number.isFinite(difficulty) || !Number.isFinite(start)) {
    throw new TypeError('Possession difficulty and field position must be finite');
  }
  if (typeof rng !== 'function') throw new TypeError('Possession RNG must be a function');
  const random = () => {
    const value = rng();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new RangeError('Possession RNG must return a number in [0, 1)');
    }
    return value;
  };
  const level = clamp(difficulty, 0, 2);
  const field = clamp(start, 0, 100);
  const shortField = field - 25;
  const touchdownChance = clamp(.30 + level * .06 + shortField * .0035, .18, .60);
  const fieldGoalChance = clamp(.20 + Math.max(0, shortField) * .0004, .20, .23);
  const turnoverChance = .12 - level * .01;
  const roll = random();
  let points, outcome;
  if (roll < touchdownChance) {
    points = 7;
    outcome = 'TOUCHDOWN + EXTRA POINT';
  } else if (roll < touchdownChance + fieldGoalChance) {
    points = 3;
    outcome = 'FIELD GOAL';
  } else if (roll < touchdownChance + fieldGoalChance + turnoverChance) {
    points = 0;
    outcome = 'TURNOVER — DEFENSE GETS A STOP';
  } else {
    points = 0;
    outcome = 'PUNT — DEFENSE GETS A STOP';
  }
  return {
    points,
    seconds: 18 + Math.floor(random() * 23),
    outcome,
    plays: 3 + Math.floor(random() * 6),
  };
}

/** Between-play runoff. Incompletions and the sideline stop the clock. */
export function deadBallRunoff(reason) {
  const stopped = ['INCOMPLETE', 'OUT OF BOUNDS', 'FINAL WHISTLE'];
  return stopped.includes(String(reason).trim().toUpperCase()) ? 0 : 6;
}
