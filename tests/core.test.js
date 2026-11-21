import test from 'node:test';
import assert from 'node:assert/strict';
import {Drive, liveBoundary, ballCarrierDown, forwardPassAllowed, catchWindow, catchEligible, movementSpeed, skillMove, tackleBreaks} from '../rules.js';
import {createCareer, complete, commit, offers, stars, practice, purchaseUpgrade, upgradeCost, availableXP, playerAttributes, validCareer, ensureDevelopment} from '../career.js';
import {simulatePossession, deadBallRunoff} from '../possessions.js';
import {offensivePlays, routePoint, predictReceiver} from '../playbook.js';
import {defensiveFormations, defensiveAlignment, pursuitTarget, defensiveReaction} from '../defense.js';
import {defaultProfile, normalizeProfile, validateProfile, physique} from '../player-profile.js';

const result = (overrides = {}) => ({yards:120, td:2, comp:4, tackles:0, home:21, away:7, ...overrides});

test('a live runner can retreat into the own end zone before becoming downed', () => {
  for (const z of [0, -.01, -2, -9.99]) assert.equal(liveBoundary({x:0, z}), null);
  assert.equal(new Drive().finish(-2), 'SAFETY', 'safety belongs to dead-ball resolution');
});

test('the carrier scores at the far goal plane and stops at actual field boundaries', () => {
  assert.equal(liveBoundary({x:0, z:100}), 'TOUCHDOWN');
  assert.equal(liveBoundary({x:27, z:25}), 'OUT_OF_BOUNDS');
  assert.equal(liveBoundary({x:27, z:-1}), 'SAFETY_OUT');
  assert.equal(liveBoundary({x:0, z:-10}), 'SAFETY_OUT');
  assert.equal(liveBoundary({x:27, z:101, hasBall:false}), null, 'off-ball routes cannot score');
  assert.throws(() => liveBoundary({x:NaN, z:20}), TypeError);
});

test('only grounding the actual ball carrier can end a tackle', () => {
  assert.equal(ballCarrierDown(6, 7, {grounded:true}), false);
  assert.equal(ballCarrierDown(6, 6, {grounded:false}), false);
  assert.equal(ballCarrierDown(-1, -1, {grounded:true}), false);
  assert.equal(ballCarrierDown(6, 6, {grounded:true}), true);
});

test('forward passing remains locked after crossing even if the QB retreats', () => {
  assert.equal(forwardPassAllowed({passerZ:21, scrimmageZ:25}), true);
  assert.equal(forwardPassAllowed({passerZ:25, scrimmageZ:25}), true);
  assert.equal(forwardPassAllowed({passerZ:25.01, scrimmageZ:25}), false);
  assert.equal(forwardPassAllowed({passerZ:22, scrimmageZ:25, crossed:true}), false);
  assert.throws(() => forwardPassAllowed({passerZ:Infinity, scrimmageZ:25}), TypeError);
});

test('receivers must track passes closely and catching skill widens a bounded window', () => {
  const receiver = {x:0, z:35};
  assert.equal(catchEligible(receiver, {x:.4, z:35.4}, 65), true);
  assert.equal(catchEligible(receiver, {x:1.25, z:35}, 65), false);
  assert.equal(catchEligible(receiver, {x:1, z:35}, 65), false);
  assert.equal(catchEligible(receiver, {x:1, z:35}, 100), true);
  assert.ok(catchWindow(69) > catchWindow(65));
  assert.ok(catchWindow(0) >= .65 && catchWindow(100) <= 1.05);
});

test('movement upgrades improve route and sprint pace without unlimited top speed', () => {
  assert.ok(movementSpeed(77) > movementSpeed(65));
  assert.ok(movementSpeed(77, {sprint:true}) > movementSpeed(65, {sprint:true}));
  assert.equal(movementSpeed(77, {sprint:true, stamina:0}), movementSpeed(77));
  assert.ok(movementSpeed(999, {sprint:true}) <= 6.65);
});

test('skill cuts cost stamina and cannot be chained during recovery', () => {
  const cut = skillMove({speed:65, stamina:.18});
  assert.equal(cut.cost, .18);
  assert.ok(cut.duration > 0 && cut.cooldown > cut.duration);
  assert.equal(skillMove({stamina:.179}), null);
  assert.equal(skillMove({cooldown:.01}), null);
  assert.equal(skillMove({active:true}), null);
  assert.ok(skillMove({speed:77}).distance > cut.distance);
});

test('moving runners may shed glancing contact but square or stationary hits wrap up', () => {
  assert.equal(tackleBreaks({speed:5.5, leverage:0, roll:0}), true);
  assert.equal(tackleBreaks({speed:5.5, leverage:.8, roll:0}), false);
  assert.equal(tackleBreaks({speed:0, leverage:0, roll:0}), false);
  assert.equal(tackleBreaks({speed:5.5, leverage:0, roll:.99}), false);
});

test('first downs, incompletions, four downs and touchdown resets keep field rules', () => {
  const drive = new Drive();
  assert.equal(drive.finish(36), 'FIRST DOWN');
  assert.equal(drive.down, 1);
  assert.equal(drive.line, 46);
  drive.finish(42);
  assert.equal(drive.finish(99, true), 'INCOMPLETE');
  assert.equal(drive.spot, 42);
  drive.finish(42);
  assert.equal(drive.finish(42), 'TURNOVER ON DOWNS');
  assert.equal(drive.spot, 25);
  assert.equal(drive.finish(100), 'TOUCHDOWN');
  assert.equal(drive.score, 7);
  assert.equal(drive.spot, 25);
});

test('signing follows exactly three HS games and unlocks twelve college games', () => {
  const career = createCareer('Avery Stone', 'WR', 'route-runner');
  assert.equal(commit(career, 'Auburn'), false);
  for (let game=0; game<3; game++) complete(career, result());
  assert.equal(career.games, 3);
  assert.equal(career.highSchool, 'STATE');
  assert.throws(() => complete(career, result()), /not available/);
  assert.equal(commit(career, offers(career)[0].name), true);
  for (let game=0; game<12; game++) complete(career, result());
  assert.equal(career.games, 15);
  assert.equal(career.log.length, 15);
  assert.throws(() => complete(career, result()), /not available/);
  assert.equal(validCareer(JSON.parse(JSON.stringify(career))), true);
});

test('actual production and wins improve recruiting stars and available offers', () => {
  const low = createCareer('Low Production', 'QB');
  const high = createCareer('High Production', 'QB');
  for (let game=0; game<3; game++) {
    complete(low, result({yards:0, td:0, comp:0, home:0, away:14}));
    complete(high, result({yards:300, td:4, comp:12, home:35, away:7}));
  }
  assert.ok(stars(high) > stars(low));
  assert.ok(offers(high).length > offers(low).length);
  assert.equal(commit(low, 'Georgia'), false);
  assert.equal(commit(high, 'Georgia'), true);
});

test('coach practice gives one meeting per week and ends after career completion', () => {
  const career = createCareer('Weekly Practice', 'RB');
  assert.equal(practice(career), true);
  assert.equal(career.xp, 20);
  assert.equal(career.trust, 50);
  assert.equal(practice(career), false);
  complete(career, result());
  assert.equal(practice(career), true);
  career.games = 15;
  assert.equal(practice(career), false);
});

test('purchased upgrades spend XP once and improve the actual role ratings', () => {
  const career = createCareer('Route Upgrade', 'WR', 'route-runner');
  assert.equal(purchaseUpgrade(career, 'speed'), false, 'upgrades are between games');
  complete(career, result({yards:250, td:2, comp:10}));
  const earned = career.xp;
  const original = playerAttributes(career).speed;
  let spent = 0;
  for (let level=0; level<3; level++) {
    spent += upgradeCost(career, 'speed');
    assert.equal(purchaseUpgrade(career, 'speed'), true);
  }
  assert.equal(career.xp, earned, 'lifetime earnings are retained');
  assert.equal(availableXP(career), earned-spent);
  assert.equal(playerAttributes(career).speed, original+12);
  assert.equal(purchaseUpgrade(career, 'speed'), false);
  assert.equal(purchaseUpgrade(career, 'throwing'), false, 'WR cannot buy QB-only skills');
  assert.equal(validCareer(JSON.parse(JSON.stringify(career))), true);
});

test('malformed or overspent saves cannot award free upgraded attributes', () => {
  const career = createCareer('Save Recovery', 'WR');
  const corrupt = JSON.parse(JSON.stringify(career));
  corrupt.upgrades.speed = 3;
  corrupt.xpSpent = 210;
  assert.equal(validCareer(corrupt), false);
  ensureDevelopment(corrupt);
  assert.equal(corrupt.upgrades.speed, 0);
  assert.equal(availableXP(corrupt), 0);
  assert.equal(validCareer({...career, games:4, school:null}), false);
  assert.equal(validCareer({...career, log:[{}]}), false);
});

test('red-zone route concepts settle inside the end zone instead of drifting forever', () => {
  for (const play of offensivePlays('QB')) for (const spot of [80, 98]) for (let index=6; index<=10; index++) {
    const home = {x:[-20, 18, -11, 4, -3][index-6], z:spot-1};
    const end = routePoint(play, index, home, {spot, time:20});
    assert.deepEqual(routePoint(play, index, home, {spot, time:40}), end);
    assert.ok(Math.abs(end.x) <= 25.3 && end.z <= 107 && end.z >= -8);
  }
  const lead = predictReceiver({x:0,z:40}, {x:4,z:-2}, 1, {controlled:true,throwing:87});
  assert.ok(lead.x > 0 && lead.z < 40, 'pass leading follows sideways and backward movement');
});

test('fronts retain eleven assignments and defenders use distinct bounded pursuit lanes', () => {
  for (const formation of defensiveFormations) {
    const jobs = defensiveAlignment(formation, 98);
    assert.equal(jobs.length, 11);
    assert.equal(new Set(jobs.map(job => job.index)).size, 11);
    assert.ok(jobs.some(job => job.index === 16));
    assert.ok(jobs.every(job => job.z <= 108 && job.z >= 0));
  }
  const context = {runner:{x:22,z:45,vx:4,vz:5},defender:{x:10,z:56},spot:25,elapsed:2};
  const targets = [11,16,20].map(index => pursuitTarget({...context,index}));
  assert.ok(targets.every(target => Math.abs(target.x) <= 26 && target.z <= 108));
  assert.notDeepEqual(targets[0], targets[2]);
  assert.notEqual(defensiveReaction(20, 1), defensiveReaction(20, 2));
});

test('simulated possessions may score, kick, punt or turn over while consuming clock', () => {
  const outcomes = [.05,.40,.55,.90].map(roll => simulatePossession({}, () => roll));
  assert.deepEqual(outcomes.map(outcome => outcome.points), [7,3,0,0]);
  assert.match(outcomes[2].outcome, /TURNOVER/);
  assert.match(outcomes[3].outcome, /PUNT/);
  assert.ok(outcomes.every(outcome => outcome.seconds>=18 && outcome.seconds<=40 && outcome.plays>=3 && outcome.plays<=8));
  assert.equal(deadBallRunoff('INCOMPLETE'), 0);
  assert.equal(deadBallRunoff('OUT OF BOUNDS'), 0);
  assert.equal(deadBallRunoff('TACKLED'), 6);
});

test('opponent scoring stays possible but never guaranteed at every challenge and field position', () => {
  for (const difficulty of [0,1,2]) for (const start of [1,25,99]) {
    assert.equal(simulatePossession({difficulty,start}, () => 0).points, 7);
    assert.equal(simulatePossession({difficulty,start}, () => .99).points, 0);
  }
  assert.equal(simulatePossession({difficulty:0,start:25}, () => .35).points, 3);
  assert.equal(simulatePossession({difficulty:2,start:80}, () => .35).points, 7);
  assert.throws(() => simulatePossession({}, () => 1), RangeError);
  assert.throws(() => simulatePossession({start:NaN}), TypeError);
});

test('old appearance profiles gain canonical defaults and invalid choices are normalized', () => {
  const profile = normalizeProfile({hometown:'  Pine\n Valley  ',state:'ca',jersey:1000,heightInches:200,weightLbs:20,visor:'bad'});
  assert.equal(profile.hometown, 'Pine Valley');
  assert.equal(profile.state, 'CA');
  assert.equal(profile.jersey, 99);
  assert.equal(profile.heightInches, 80);
  assert.equal(profile.weightLbs, 165);
  assert.equal(profile.visor, defaultProfile().visor);
  assert.equal(validateProfile(JSON.parse(JSON.stringify(profile))), true);
  assert.equal(validateProfile({...profile,unexpected:true}), false);
});

test('measurements alter modest visual proportions without changing gameplay ratings', () => {
  const career = createCareer('Cosmetic Profile', 'RB');
  const before = playerAttributes(career);
  career.profile = normalizeProfile({heightInches:78,weightLbs:235,build:'power',dominantHand:'left'});
  const scale = physique(career.profile);
  assert.ok(scale.y>1 && scale.x>1 && scale.x<=1.16);
  assert.deepEqual(playerAttributes(career), before);
});
