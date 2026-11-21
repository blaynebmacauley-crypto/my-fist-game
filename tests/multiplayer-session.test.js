import test from 'node:test';
import assert from 'node:assert/strict';
import {HeadToHeadMatch, PROTOCOL_VERSION, MAX_SEQUENCE, sanitizeInput, sanitizeAction, sanitizeName, validateEnvelope, validateSnapshot, sanitizeSnapshot} from '../multiplayer-session.js';

const snapshot = () => ({
  type: 'snapshot', version: PROTOCOL_VERSION, seq: 1, clock: 179.4, phase: 'live', offense: 'host',
  scores: {host: 0, guest: 0}, carrier: 0, spot: 25, down: 1, line: 35, paused: false,
  players: Array.from({length: 22}, (_, index) => ({x: index - 11, y: 0, z: 21 + index / 2, yaw: index < 11 ? 0 : Math.PI, speed: 5.5, vx: 0, vz: 5.5})),
  ball: {x: .25, y: 1.3, z: 21.3, rx: .3, ry: 0, rz: 0},
  play: {id: 'slant', name: 'Quick Slant', type: 'pass', route: 'slant', direction: 1}, tackle: null,
});

test('host and guest control opposing roles and possession follows the actual ball carrier', () => {
  const match = new HeadToHeadMatch();
  assert.equal(match.seatRole('host'), 'QB');
  assert.equal(match.seatRole('guest'), 'LB');
  assert.equal(match.controlledIndex('host', 6), 6);
  assert.equal(match.controlledIndex('host', -1), 0);
  assert.equal(match.controlledIndex('guest', 6), 16);
  match.switchPossession();
  assert.equal(match.seatRole('guest'), 'QB');
  assert.equal(match.controlledIndex('guest', 8), 8);
  assert.equal(match.controlledIndex('host', 8), 16);
  assert.throws(() => match.seatRole('spectator'), RangeError);
});

test('touchdowns award offense seven and a safety awards the opposing seat two', () => {
  const match = new HeadToHeadMatch();
  const first = match.finishDrive({reason: 'TOUCHDOWN', spot: 100.2});
  assert.deepEqual(first.scores, {host: 7, guest: 0});
  assert.equal(first.scoringSeat, 'host');
  assert.equal(first.offense, 'guest');
  assert.equal(first.nextSpot, 25);
  assert.equal(first.switchPossession, true);
  const safety = match.finishDrive({reason: 'SAFETY', spot: -2});
  assert.deepEqual(safety.scores, {host: 9, guest: 0});
  assert.equal(safety.scoringSeat, 'host');
  assert.equal(safety.offense, 'host');
  assert.equal(match.stats.host.touchdowns, 1);
  assert.equal(match.stats.host.safeties, 1);
  assert.equal(match.stats.host.points, 9);
});

test('interceptions and failed fourth downs change offense without granting free points', () => {
  const match = new HeadToHeadMatch();
  for (const reason of ['INTERCEPTED', 'TURNOVER ON DOWNS']) {
    const offense = match.offense;
    const result = match.finishDrive({reason, spot: 40});
    assert.equal(result.ended, true);
    assert.equal(result.points, 0);
    assert.notEqual(result.offense, offense);
    assert.deepEqual(match.scores, {host: 0, guest: 0});
  }
  assert.equal(match.stats.host.turnovers, 1);
  assert.equal(match.stats.guest.turnovers, 1);
  assert.equal(match.possession, 2);
});

test('ordinary dead balls cannot switch a drive and a stale possession cannot score twice', () => {
  const match = new HeadToHeadMatch();
  for (const reason of ['TACKLED', 'OUT OF BOUNDS', 'INCOMPLETE', 'FIRST DOWN']) {
    const result = match.finishDrive({reason, spot: 30});
    assert.equal(result.ended, false);
    assert.equal(result.switchPossession, false);
  }
  assert.equal(match.possession, 0);
  match.finishDrive({reason: 'TOUCHDOWN', possession: 0});
  assert.equal(match.finishDrive({reason: 'TOUCHDOWN', possession: 0}).rejected, true);
  assert.deepEqual(match.scores, {host: 7, guest: 0});
  assert.equal(match.possession, 1);
  const before = JSON.stringify(match);
  assert.throws(() => match.finishDrive({reason: 'SAFETY', spot: NaN}), TypeError);
  assert.equal(JSON.stringify(match), before);
});

test('a new friendly match resets independent scores, stats and initial possession', () => {
  const a = new HeadToHeadMatch({duration: 300}), b = new HeadToHeadMatch();
  a.finishDrive({reason: 'TOUCHDOWN'});
  assert.deepEqual(b.scores, {host: 0, guest: 0});
  a.reset();
  assert.equal(a.duration, 300);
  assert.equal(a.offense, 'host');
  assert.equal(a.possession, 0);
  assert.equal(a.stats.host.possessions, 1);
  assert.equal(a.stats.guest.possessions, 0);
  assert.deepEqual(a.scores, b.scores);
  for (const duration of [0, -1, NaN, Infinity, 7201]) assert.throws(() => new HeadToHeadMatch({duration}), RangeError);
});

test('movement intent is finite, normalized and detached from the sender', () => {
  const input = {type: 'input', seq: 4, dx: 1, dz: 1, sprint: true, at: 1234};
  const parsed = sanitizeInput(input, 3);
  assert.ok(Math.abs(Math.hypot(parsed.dx, parsed.dz) - 1) < 1e-12);
  assert.equal(parsed.sprint, true);
  assert.equal(parsed.at, 1234);
  parsed.dx = 0;
  assert.equal(input.dx, 1);
  const enormous = sanitizeInput({seq: 0, dx: Number.MAX_VALUE, dz: Number.MAX_VALUE});
  assert.ok(Number.isFinite(enormous.dx) && Math.hypot(enormous.dx, enormous.dz) <= 1);
  assert.equal(enormous.sprint, false);
});

test('guest input rejects stale sequence, injected position/score, invalid coordinates and bad versions', () => {
  const valid = {type: 'input', seq: 6, dx: .3, dz: -.4, sprint: false};
  for (const patch of [{seq: 4}, {seq: 5}, {seq: MAX_SEQUENCE + 1}, {seq: 5.1}, {dx: NaN}, {dz: Infinity}, {sprint: 'true'}, {x: 90}, {scores: {guest: 999}}, {type: 'snapshot'}, {version: 999}, {at: -1}]) {
    assert.equal(sanitizeInput({...valid, ...patch}, 5), null);
  }
  assert.equal(sanitizeInput({...valid, scores: {guest: 999}}, 4), null);
  assert.equal(sanitizeInput({...valid, seq: 6}, 5).seq, 6);
  assert.equal(sanitizeInput(Object.assign(Object.create({cheat: true}), valid), 4), null);
});

test('the offense can pass and snap while the defense can tackle; neither can submit a score', () => {
  const message = action => ({type: 'action', seq: 2, action});
  for (const action of ['snap', 'pass1', 'pass2', 'pass3']) {
    assert.equal(sanitizeAction(message(action), 'QB', 1), action);
    assert.equal(sanitizeAction(message(action), 'LB', 1), null);
  }
  assert.equal(sanitizeAction(message('tackle'), 'LB', 1), 'tackle');
  assert.equal(sanitizeAction(message('tackle'), 'QB', 1), null);
  for (const role of ['QB', 'LB']) for (const action of ['skillLeft', 'skillRight', 'pause']) assert.equal(sanitizeAction(message(action), role, 1), action);
  assert.equal(sanitizeAction(message('touchdown'), 'QB', 1), null);
  assert.equal(sanitizeAction(message('pause'), 'QB', 2), null);
  assert.equal(sanitizeAction({...message('pass1'), score: 99}, 'QB', 1), null);
  assert.equal(sanitizeAction(message('pass1'), 'spectator', 1), null);
});

test('a reused connection cannot revive movement or actions from an older match epoch', () => {
  const input = {type: 'input', seq: 99, dx: 1, dz: 0, sprint: false, sessionId: 'same-connection', matchId: 'older-game'};
  const action = {type: 'action', seq: 99, action: 'pass1', sessionId: 'same-connection', matchId: 'older-game'};
  assert.equal(sanitizeInput(input, 0, 'new-game'), null);
  assert.equal(sanitizeAction(action, 'QB', 0, 'new-game'), null);
  assert.equal(sanitizeInput({...input, matchId: 'new-game'}, 0, 'new-game').seq, 99);
  assert.equal(sanitizeAction({...action, matchId: 'new-game'}, 'QB', 0, 'new-game'), 'pass1');
  for (const matchId of ['', 3, null, 'a'.repeat(81)]) {
    assert.equal(sanitizeInput({...input, matchId}, 0), null);
    assert.equal(sanitizeAction({...action, matchId}, 'QB', 0), null);
  }
  assert.equal(validateEnvelope({type: 'ready', version: 13}), true);
  assert.equal(validateEnvelope({type: 'call', version: 13, sessionId: 'same-connection', matchId: 'new-game', seq: 2, kind: 'offense', id: 'slant'}), true);
});

test('both seats begin with independent finite gameplay statistics and reset all of them', () => {
  const match = new HeadToHeadMatch();
  for (const seat of ['host', 'guest']) for (const field of ['yards', 'attempts', 'completions', 'tackles']) assert.equal(match.stats[seat][field], 0);
  match.stats.host.yards += 18.5;
  match.stats.host.attempts++;
  match.stats.host.completions++;
  match.stats.guest.tackles++;
  assert.equal(match.stats.guest.yards, 0);
  assert.equal(match.stats.host.tackles, 0);
  assert.equal(match.stats.host.yards, 18.5);
  match.reset();
  for (const seat of ['host', 'guest']) for (const field of ['yards', 'attempts', 'completions', 'tackles']) assert.equal(match.stats[seat][field], 0);
  const summary = snapshot(); summary.phase = 'summary';
  assert.equal(validateSnapshot(summary), true);
});

test('public names remain short text and do not preserve HTML or invisible controls', () => {
  assert.equal(sanitizeName('  Avery\n Rivers  '), 'Avery Rivers');
  assert.equal(sanitizeName('<script>'), 'script');
  assert.equal(sanitizeName('Jo\u202ee'), 'Joe');
  assert.equal(sanitizeName('Jose\u0301'), 'José');
  assert.equal(Array.from(sanitizeName('A'.repeat(100))).length, 18);
  assert.equal(sanitizeName(null, 'Guest'), 'Guest');
  assert.equal(sanitizeName('', ''), 'Player');
});

test('the protocol rejects unknown, oversized, circular and prototype-bearing payloads', () => {
  assert.equal(validateEnvelope({type: 'hello', version: 13, name: 'Avery'}), true);
  assert.equal(validateEnvelope({type: 'set_score', value: 900}), false);
  assert.equal(validateEnvelope({type: 'hello', version: 12}), false);
  assert.equal(validateEnvelope({type: 'snapshot', players: Array(1000).fill(0)}), false);
  assert.equal(validateEnvelope({type: 'error', message: 'x'.repeat(100000)}), false);
  assert.equal(validateEnvelope(JSON.parse('{"type":"hello","__proto__":{"admin":true}}')), false);
  const circular = {type: 'hello'}; circular.data = circular;
  assert.equal(validateEnvelope(circular), false);
  assert.equal(validateEnvelope({type: 'hello', execute() {}}), false);
});

test('a snapshot carries exactly twenty-two bounded actor states and an independent ball', () => {
  const original = snapshot();
  assert.equal(validateSnapshot(original), true);
  assert.equal(validateSnapshot(original, 1), false);
  const copy = sanitizeSnapshot(original);
  copy.players[0].x = 70;
  copy.scores.host = 77;
  assert.notEqual(original.players[0].x, 70);
  assert.equal(original.scores.host, 0);
  for (const mutate of [s => s.players.pop(), s => s.players.push({...s.players[0]}), s => s.players[0].x = Infinity, s => s.players[0].speed = 100, s => s.ball.y = NaN, s => s.scores.host = -1, s => s.offense = 'spectator', s => s.carrier = 22, s => s.down = 5, s => s.clock = -1, s => s.phase = 'teleport', s => s.paused = 'false']) {
    const bad = snapshot(); mutate(bad);
    assert.equal(validateSnapshot(bad), false);
    assert.equal(sanitizeSnapshot(bad), null);
  }
});

test('tackle snapshots identify the grounded carrier and keep contact progress bounded', () => {
  const data = snapshot();
  data.phase = 'tackle';
  data.tackle = {carrier: 6, defender: 16, t: .7, duration: 1.35, phase: 'fall', style: 'side', spot: 42};
  assert.equal(validateSnapshot(data), true);
  for (const patch of [{carrier: -1}, {defender: 6}, {t: 8}, {duration: 0}, {phase: 'flying'}, {style: 'teleport'}]) {
    assert.equal(validateSnapshot({...data, tackle: {...data.tackle, ...patch}}), false);
  }
});
