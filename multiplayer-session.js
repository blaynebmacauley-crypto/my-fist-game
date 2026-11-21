/** Shared rules for a friendly two-browser match. Only the host mutates scores. */
export const PROTOCOL_VERSION = 13;
export const MAX_SEQUENCE = 1_000_000_000;
export const MAX_MESSAGE_BYTES = 64 * 1024;
export const SEATS = Object.freeze(['host', 'guest']);
export const MESSAGE_TYPES = Object.freeze(['hello', 'welcome', 'ready', 'start', 'call', 'input', 'action', 'snapshot', 'ping', 'pong', 'leave', 'error']);
export const ACTIONS = Object.freeze(['snap', 'pass1', 'pass2', 'pass3', 'tackle', 'skillLeft', 'skillRight', 'pause']);

const END_REASONS = new Set(['TOUCHDOWN', 'SAFETY', 'INTERCEPTED', 'TURNOVER ON DOWNS']);
const PHASES = new Set(['ready', 'live', 'tackle', 'dead', 'simulation', 'summary', 'ended', 'final']);
const OFFENSE_ACTIONS = new Set(['snap', 'pass1', 'pass2', 'pass3', 'skillLeft', 'skillRight', 'pause']);
const DEFENSE_ACTIONS = new Set(['tackle', 'skillLeft', 'skillRight', 'pause']);
const INPUT_KEYS = new Set(['type', 'version', 'sessionId', 'matchId', 'seq', 'dx', 'dz', 'sprint', 'at']);
const ACTION_KEYS = new Set(['type', 'version', 'sessionId', 'matchId', 'seq', 'action']);
const unsafeKeys = new Set(['__proto__', 'prototype', 'constructor']);
const own = (object, key) => Object.hasOwn(object, key);
const finite = (value, low, high) => typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high;
const integer = (value, low, high) => Number.isInteger(value) && value >= low && value <= high;
const isSeat = value => value === 'host' || value === 'guest';
const otherSeat = seat => seat === 'host' ? 'guest' : 'host';

function plain(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireSeat(seat) {
  if (!isSeat(seat)) throw new RangeError('Seat must be host or guest');
  return seat;
}

function sequence(value, previous = -1) {
  return integer(value, 0, MAX_SEQUENCE) && integer(previous, -1, MAX_SEQUENCE) && value > previous;
}

function sessionHeader(data, type, expectedMatchId = null) {
  return plain(data) && (!own(data, 'type') || data.type === type)
    && (!own(data, 'version') || data.version === PROTOCOL_VERSION)
    && (!own(data, 'sessionId') || typeof data.sessionId === 'string' && data.sessionId.length > 0 && data.sessionId.length <= 80)
    && (!own(data, 'matchId') || typeof data.matchId === 'string' && data.matchId.length > 0 && data.matchId.length <= 80)
    && (expectedMatchId === null || typeof expectedMatchId === 'string' && expectedMatchId.length > 0 && expectedMatchId.length <= 80 && data.matchId === expectedMatchId);
}

/** Trim public display names. Never use the result as HTML or as an identifier. */
export function sanitizeName(value, fallback = 'Player') {
  const clean = source => typeof source === 'string'
    ? Array.from(source.normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/[^\p{L}\p{M}\p{N} ._'’#-]/gu, '').replace(/\s+/g, ' ').trim()).slice(0, 18).join('').trim()
    : '';
  return clean(value) || clean(fallback) || 'Player';
}

export const sanitizePlayerName = sanitizeName;

/**
 * Accept only movement intent, not position, speed, ratings or score. The
 * returned object is new and contains no unexpected properties from the peer.
 */
export function sanitizeInput(data, previousSeq = -1, expectedMatchId = null) {
  if (!sessionHeader(data, 'input', expectedMatchId) || Object.keys(data).some(key => !INPUT_KEYS.has(key))) return null;
  if (!sequence(data.seq, previousSeq) || !finite(data.dx, -Number.MAX_VALUE, Number.MAX_VALUE) || !finite(data.dz, -Number.MAX_VALUE, Number.MAX_VALUE)) return null;
  if (own(data, 'sprint') && typeof data.sprint !== 'boolean') return null;
  if (own(data, 'at') && !finite(data.at, 0, 1e15)) return null;
  // Scale before hypot so even hostile, enormous finite values remain finite.
  const scale = Math.max(1, Math.abs(data.dx), Math.abs(data.dz));
  let dx = data.dx / scale, dz = data.dz / scale;
  const length = Math.hypot(dx, dz);
  if (length > 1) { dx /= length; dz /= length; }
  const result = {seq: data.seq, dx, dz, sprint: data.sprint === true};
  if (own(data, 'at')) result.at = data.at;
  return result;
}

/** Role checks supplement, rather than replace, the host's live phase checks. */
export function sanitizeAction(data, seatRole, previousSeq = -1, expectedMatchId = null) {
  if (!sessionHeader(data, 'action', expectedMatchId) || Object.keys(data).some(key => !ACTION_KEYS.has(key)) || !sequence(data.seq, previousSeq)) return null;
  const allowed = seatRole === 'QB' ? OFFENSE_ACTIONS : seatRole === 'LB' ? DEFENSE_ACTIONS : null;
  return allowed?.has(data.action) ? data.action : null;
}

function safeTree(value, depth, budget, seen) {
  if (--budget.nodes < 0 || depth > 7) return false;
  if (value === null || value === undefined || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value) && Math.abs(value) <= 1e15;
  if (typeof value === 'string') return value.length <= 512;
  if (typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) {
    if (value.length > 64) return false;
    for (const child of value) if (!safeTree(child, depth + 1, budget, seen)) return false;
  } else {
    if (!plain(value)) return false;
    const keys = Object.keys(value);
    if (keys.length > 64) return false;
    for (const key of keys) if (unsafeKeys.has(key) || key.length > 64 || !safeTree(value[key], depth + 1, budget, seen)) return false;
  }
  seen.delete(value);
  return true;
}

/** Check bounded JSON-shaped data before reading any specific message fields. */
export function validateEnvelope(data) {
  if (!plain(data) || !MESSAGE_TYPES.includes(data.type)) return false;
  if (own(data, 'version') && data.version !== PROTOCOL_VERSION) return false;
  if (!safeTree(data, 0, {nodes: 3000}, new Set())) return false;
  try {
    return new TextEncoder().encode(JSON.stringify(data)).byteLength <= MAX_MESSAGE_BYTES;
  } catch { return false; }
}

export const validateMessage = validateEnvelope;

function validPlayer(player) {
  return plain(player)
    && finite(player.x, -80, 80) && finite(player.y, -4, 6) && finite(player.z, -40, 140)
    && finite(player.yaw, -1e6, 1e6) && finite(player.speed, 0, 15)
    && finite(player.vx, -20, 20) && finite(player.vz, -20, 20);
}

function validBall(ball) {
  return plain(ball) && finite(ball.x, -100, 100) && finite(ball.y, -10, 80) && finite(ball.z, -50, 160)
    && ['rx', 'ry', 'rz'].every(key => finite(ball[key], -1e6, 1e6));
}

function validTackle(tackle) {
  if (tackle === null) return true;
  return plain(tackle) && integer(tackle.carrier, 0, 10) && integer(tackle.defender, 11, 21)
    && finite(tackle.t, 0, 5) && finite(tackle.duration, .05, 5) && tackle.t <= tackle.duration + .05
    && ['wrap', 'drive', 'fall', 'ground'].includes(tackle.phase)
    && ['front', 'side', 'trip'].includes(tackle.style)
    && (!own(tackle, 'spot') || finite(tackle.spot, -20, 120));
}

/**
 * A snapshot contains presentation state from the host, never an alternative
 * route for a guest to submit actor transforms or scoring changes. Additional
 * small JSON fields are permitted for HUD information without a protocol bump.
 */
export function validateSnapshot(data, previousSeq = -1) {
  if (!validateEnvelope(data) || data.type !== 'snapshot' || !sequence(data.seq, previousSeq)) return false;
  if (!finite(data.clock, 0, 7200) || !PHASES.has(data.phase) || !isSeat(data.offense)) return false;
  if (!plain(data.scores) || !integer(data.scores.host, 0, 10000) || !integer(data.scores.guest, 0, 10000)) return false;
  if (!integer(data.carrier, -1, 21) || !finite(data.spot, 0, 100) || !integer(data.down, 1, 4) || !finite(data.line, 0, 100)) return false;
  if (!Array.isArray(data.players) || data.players.length !== 22 || !data.players.every(validPlayer) || !validBall(data.ball)) return false;
  if (own(data, 'paused') && typeof data.paused !== 'boolean') return false;
  if (own(data, 'play') && !plain(data.play)) return false;
  if (own(data, 'tackle') && !validTackle(data.tackle)) return false;
  return true;
}

/** Return a detached JSON copy after validation, dropping inherited properties. */
export function sanitizeSnapshot(data, previousSeq = -1) {
  return validateSnapshot(data, previousSeq) ? JSON.parse(JSON.stringify(data)) : null;
}

const emptyStats = () => ({points: 0, touchdowns: 0, safeties: 0, possessions: 0, turnovers: 0, stops: 0, yards: 0, attempts: 0, completions: 0, tackles: 0});

/** Friendly-match possession and scoring. This class does not run simulated drives. */
export class HeadToHeadMatch {
  constructor({duration = 180} = {}) {
    if (!finite(duration, 1, 7200)) throw new RangeError('Match duration must be between 1 and 7200 seconds');
    this.duration = duration;
    this.reset();
  }

  reset() {
    this.offense = 'host';
    this.scores = {host: 0, guest: 0};
    this.stats = {host: emptyStats(), guest: emptyStats()};
    this.stats.host.possessions = 1;
    this.possession = 0;
    return this;
  }

  seatRole(seat) {
    return requireSeat(seat) === this.offense ? 'QB' : 'LB';
  }

  controlledIndex(seat, carrier = 0) {
    if (this.seatRole(seat) === 'LB') return 16;
    return integer(carrier, 0, 10) ? carrier : 0;
  }

  switchPossession() {
    const previousOffense = this.offense;
    this.offense = otherSeat(previousOffense);
    this.possession++;
    this.stats[this.offense].possessions++;
    return {previousOffense, offense: this.offense, possession: this.possession};
  }

  finishDrive({reason, spot = 25, possession = this.possession} = {}) {
    if (typeof reason !== 'string' || reason.length > 64 || !finite(spot, -1000, 1000)) throw new TypeError('A drive requires a reason and finite ball spot');
    const normalized = reason.trim().toUpperCase();
    const previousOffense = this.offense;
    const base = {reason: normalized, spot, nextSpot: 25, previousOffense, offense: this.offense, possession: this.possession, points: 0, scoringSeat: null, scores: {...this.scores}, ended: false, switchPossession: false};
    // The integration can pass the down's possession number to reject a delayed
    // or duplicate event after the next drive has already begun.
    if (!integer(possession, 0, MAX_SEQUENCE) || possession !== this.possession) return {...base, rejected: true};
    if (!END_REASONS.has(normalized)) return base;
    const defense = otherSeat(previousOffense);
    let points = 0, scoringSeat = null;
    if (normalized === 'TOUCHDOWN') {
      points = 7;
      scoringSeat = previousOffense;
      this.stats[previousOffense].touchdowns++;
    } else if (normalized === 'SAFETY') {
      points = 2;
      scoringSeat = defense;
      this.stats[defense].safeties++;
      this.stats[defense].stops++;
    } else {
      this.stats[previousOffense].turnovers++;
      this.stats[defense].stops++;
    }
    if (scoringSeat) {
      this.scores[scoringSeat] += points;
      this.stats[scoringSeat].points += points;
    }
    const next = this.switchPossession();
    return {...base, ...next, points, scoringSeat, scores: {...this.scores}, ended: true, switchPossession: true};
  }
}
