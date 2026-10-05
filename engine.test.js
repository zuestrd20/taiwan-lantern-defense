import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, TYPES, ENEMIES, WAVES, PADS, PATH, PATH_LENGTH, pathPosition, towerStats, upgradeCost, nextUpgradeCost, sellValue, STEP } from './engine.js';
import { runStrategy } from './strategy.mjs';

function runUntil(game, predicate, limit = 30000) {
  for (let i = 0; i < limit && !predicate(game); i++) game.update(1 / 30);
  assert.ok(predicate(game), `Simulation did not reach expected state: ${game.status}, wave ${game.wave}`);
}
function opening() {
  const game = new Game();
  assert.ok(game.build('lantern', 'p3').ok);
  assert.ok(game.build('lantern', 'p5').ok);
  assert.ok(game.build('tea', 'p9').ok);
  return game;
}
function stableState(game) {
  return JSON.stringify({ gold: game.gold, lives: game.lives, wave: game.wave, status: game.status, towers: game.towers, enemies: game.enemies, projectiles: game.projectiles, effects: game.effects, time: game.time, kills: game.kills, waveTime: game.waveTime });
}
// Mechanic-level fixtures isolate impact resolution. Campaign tests below use only public actions.
function enemyFixture(type = 'armor', overrides = {}) {
  return { ...ENEMIES[type], id: 'fixture', type, x: 300, y: 300, hp: 1000, maxHp: 1000, slow: 1, slowRemaining: 0, ...overrides };
}

test('initial state and the complete original campaign are well formed', () => {
  const game = new Game();
  assert.deepEqual([game.gold, game.lives, game.wave, game.status, game.paused, game.speed], [240, 20, 0, 'build', false, 1]);
  assert.equal(WAVES.length, 12);
  assert.equal(WAVES.reduce((n, wave) => n + wave.groups.reduce((k, group) => k + group.count, 0), 0), 421);
  assert.deepEqual(WAVES.slice(9).map(w => w.boss), ['mistlord', 'shelllord', 'moonlord']);
  assert.equal(Object.keys(TYPES).length, 4);
  assert.equal(towerStats('__proto__'), null);
  assert.equal(upgradeCost('constructor', 1), null);
  assert.ok(Object.isFrozen(TYPES.lantern.levels[0]));
});

test('path follows every ordered corner and has the correct exit', () => {
  assert.equal(PATH_LENGTH, 1800);
  const distances = [0, 300, 540, 900, 1080, 1380, 1800];
  distances.forEach((progress, i) => { const { x, y } = pathPosition(progress); assert.deepEqual({ x, y }, PATH[i]); });
});

test('path interpolates continuous movement and clamps endpoints', () => {
  assert.deepEqual(pathPosition(150), { x: 120, y: 150, angle: 0 });
  assert.deepEqual(pathPosition(420), { x: 270, y: 270, angle: Math.PI / 2 });
  assert.deepEqual(pathPosition(-100), pathPosition(0));
  assert.deepEqual(pathPosition(3000), { x: 930, y: 630, angle: Math.PI / 2 });
});

test('all 16 build pads are distinct in-bounds grid centers and off the path', () => {
  assert.equal(PADS.length, 16);
  assert.equal(new Set(PADS.map(p => p.id)).size, 16);
  for (const pad of PADS) {
    assert.ok(pad.x >= 30 && pad.x <= 930 && pad.y >= 30 && pad.y <= 570);
    assert.equal((pad.x - 30) % 60, 0); assert.equal((pad.y - 30) % 60, 0);
    for (let i = 0; i < PATH.length - 1; i++) {
      const a = PATH[i], b = PATH[i + 1];
      const onVertical = a.x === b.x && pad.x === a.x && pad.y >= Math.min(a.y, b.y) && pad.y <= Math.max(a.y, b.y);
      const onHorizontal = a.y === b.y && pad.y === a.y && pad.x >= Math.min(a.x, b.x) && pad.x <= Math.max(a.x, b.x);
      assert.ok(!onVertical && !onHorizontal, `${pad.id} overlaps the path`);
    }
  }
});

test('building is atomic, validates input, and prevents repeated-click overspending', () => {
  const game = new Game();
  assert.equal(game.build('unknown', 'p1').ok, false);
  assert.equal(game.build('__proto__', 'p1').ok, false);
  assert.equal(game.build('constructor', 'p1').ok, false);
  assert.equal(game.build('lantern', 'unknown').ok, false);
  const built = game.build('bamboo', 'p1');
  assert.ok(built.ok); assert.equal(game.gold, 90); assert.equal(game.towers.length, 1);
  for (let n = 0; n < 10; n++) assert.equal(game.build('bamboo', 'p1').ok, false);
  assert.equal(game.build('bamboo', 'p2').ok, false);
  assert.equal(game.gold, 90); assert.equal(game.towers.length, 1);
});

test('all tower stats improve over three levels and fourth level is invalid', () => {
  for (const type of Object.keys(TYPES)) {
    const levels = [1, 2, 3].map(level => towerStats(type, level));
    assert.ok(levels[1].damage > levels[0].damage && levels[2].damage > levels[1].damage);
    assert.ok(levels[1].range > levels[0].range && levels[2].range > levels[1].range);
    assert.equal(towerStats(type, 4), null);
    assert.equal(upgradeCost(type, 3), null);
    assert.equal(upgradeCost({ type, level: 1 }), nextUpgradeCost(type, 1));
  }
});

test('upgrade changes range, accounts for all spending, and refuses unaffordable upgrades', () => {
  const game = new Game(), { towerId } = game.build('lantern', 'p1');
  assert.ok(game.upgrade(towerId).ok);
  const tower = game.towers[0];
  assert.equal(tower.level, 2); assert.equal(tower.spent, 145); assert.equal(tower.range, 170); assert.equal(game.gold, 95);
  assert.equal(game.upgrade(towerId).ok, false); assert.equal(game.gold, 95); assert.equal(tower.level, 2);
  assert.equal(game.upgrade('missing').ok, false);
});

test('selling refunds floor(70% of all spending) exactly once', () => {
  const game = new Game(), { towerId } = game.build('lantern', 'p1'); game.upgrade(towerId);
  assert.equal(sellValue(game.towers[0]), 101);
  assert.deepEqual(game.sell(towerId), { ok: true, reason: '', refund: 101 });
  assert.equal(game.gold, 196); assert.equal(game.towers.length, 0);
  assert.equal(game.sell(towerId).ok, false); assert.equal(game.gold, 196);
  assert.ok(game.build('lantern', 'p1').ok);
});

test('start-wave multiclick creates only one spawn queue', () => {
  const game = new Game(); assert.ok(game.startWave().ok);
  const queue = JSON.stringify(game.spawnQueue);
  for (let i = 0; i < 10; i++) assert.equal(game.startWave().ok, false);
  assert.equal(JSON.stringify(game.spawnQueue), queue);
  assert.equal(game.totalEnemies, 8); assert.equal(game.wave, 0);
});

test('projectiles travel before dealing damage and kill enemies for gold', () => {
  const game = new Game(); game.build('lantern', 'p1'); game.startWave();
  runUntil(game, g => g.projectiles.length > 0);
  const shot = game.projectiles[0], target = game.enemies.find(e => e.id === shot.targetId);
  assert.ok(shot.x !== target.x || shot.y !== target.y);
  assert.equal(target.hp, target.maxHp);
  const startGold = game.gold;
  runUntil(game, g => g.kills > 0);
  assert.ok(game.gold > startGold);
});

test('tea impacts slow enemies and repeated slows do not multiply', () => {
  const game = new Game(), enemy = enemyFixture('wisp');
  const shot = { ...towerStats('tea', 2), color: TYPES.tea.color };
  game._hit(enemy, shot); assert.equal(enemy.slow, .44999999999999996);
  game._hit(enemy, shot); assert.ok(Math.abs(enemy.slow - .45) < 1e-9); assert.equal(enemy.slowRemaining, 2.5);
  const resistant = enemyFixture('veil'); game._hit(resistant, shot);
  assert.ok(Math.abs(resistant.slow - .78) < 1e-9);
  assert.ok(resistant.slow > enemy.slow);
});

test('slow timer expires and motion returns to full speed', () => {
  const game = new Game(); game.build('tea', 'p1'); game.startWave();
  runUntil(game, g => g.enemies.some(e => e.slow < 1));
  const slowed = game.enemies.find(e => e.slow < 1), id = slowed.id;
  assert.ok(slowed.slowRemaining > 0);
  game.sell(game.towers[0].id);
  runUntil(game, g => g.enemies.some(e => e.id === id && e.slow === 1));
  assert.equal(game.enemies.find(e => e.id === id).slowRemaining, 0);
});

test('armor reduces lantern damage while bamboo pierces all armor', () => {
  const game = new Game(), a = enemyFixture(), b = enemyFixture();
  game._hit(a, { ...towerStats('lantern'), color: TYPES.lantern.color });
  game._hit(b, { ...towerStats('bamboo'), color: TYPES.bamboo.color });
  assert.ok(Math.abs(a.hp - (1000 - 22 * .45)) < 1e-8);
  assert.equal(b.hp, 944);
});

test('killing damage pays bounty once even if another projectile also hits', () => {
  const game = new Game(), enemy = enemyFixture('wisp', { hp: 1 });
  const projectile = { ...towerStats('bamboo'), color: TYPES.bamboo.color };
  game._hit(enemy, projectile); game._hit(enemy, projectile);
  assert.equal(game.kills, 1); assert.equal(game.gold, 248);
});

test('drum explosion hits grouped swarms through the real projectile loop', () => {
  const game = opening(); game.setSpeed(3);
  game.startWave(); runUntil(game, g => g.status === 'build'); game.upgrade(game.towers.find(t => t.padId === 'p3').id);
  game.startWave(); runUntil(game, g => g.status === 'build');
  assert.ok(game.build('drum', 'p1').ok); game.setSpeed(1); game.startWave();
  let simultaneousVictims = 0, observedSplash = false;
  for (let i = 0; i < 1600 && game.status === 'wave'; i++) {
    const before = new Map(game.enemies.map(e => [e.id, e.hp]));
    const oldEffects = new Set(game.effects.map(e => e.id));
    game.update(STEP);
    if (game.effects.some(e => e.type === 'splash' && !oldEffects.has(e.id))) {
      observedSplash = true;
      const after = new Map(game.enemies.map(e => [e.id, e.hp]));
      simultaneousVictims = Math.max(simultaneousVictims, [...before].filter(([id, hp]) => !after.has(id) || after.get(id) < hp).length);
    }
  }
  assert.ok(observedSplash); assert.ok(simultaneousVictims >= 3, `Only ${simultaneousVictims} victims`);
});

test('wave completion rewards once and never auto-starts the next wave', () => {
  const game = opening(); game.setSpeed(3); game.startWave();
  runUntil(game, g => g.status === 'build');
  assert.equal(game.wave, 1); assert.equal(game.kills, 8); assert.equal(game.gold, 104); assert.equal(game.lastReward, 30);
  const gold = game.gold; for (let i = 0; i < 500; i++) game.update(1 / 30);
  assert.equal(game.gold, gold); assert.equal(game.wave, 1); assert.equal(game.enemies.length, 0);
});

test('pause freezes every simulation field and resume continues', () => {
  const game = opening(); game.startWave(); for (let i = 0; i < 300; i++) game.update(STEP);
  game.togglePause(); const before = stableState(game);
  for (let i = 0; i < 100; i++) game.update(.25);
  assert.equal(stableState(game), before);
  game.togglePause(); game.update(STEP); assert.notEqual(stableState(game), before);
});

test('speed accepts 1/2/3 only and fast-forward preserves simulation state', () => {
  const slow = opening(), fast = opening(); slow.startWave(); fast.startWave(); fast.setSpeed(3);
  for (let i = 0; i < 1200; i++) slow.update(STEP);
  for (let i = 0; i < 400; i++) fast.update(STEP);
  assert.equal(stableState(slow), stableState(fast));
  assert.equal(fast.setSpeed(0).ok, false); assert.equal(fast.setSpeed(4).ok, false); assert.equal(fast.speed, 3);
});

test('fixed-step outcomes are identical across equivalent frame partitions', () => {
  const a = opening(), b = opening(); a.startWave(); b.startWave();
  for (let i = 0; i < 600; i++) a.update(1 / 60);
  for (let i = 0; i < 300; i++) b.update(1 / 30);
  assert.equal(stableState(a), stableState(b));
});

test('invalid frame deltas are ignored and browser stalls are safely capped', () => {
  const game = opening(); game.startWave(); const initial = stableState(game);
  for (const dt of [-1, 0, NaN, Infinity, undefined]) game.update(dt);
  assert.equal(stableState(game), initial);
  game.update(999); assert.equal(game.time, .25);
});

test('unattended defense loses normally and terminal state is immutable by actions', () => {
  const game = new Game(); game.setSpeed(3);
  while (game.status !== 'lost') {
    if (game.status === 'build') game.startWave();
    game.update(.1);
    assert.ok(game.time < 200);
  }
  assert.equal(game.lives, 0); assert.ok(game.leaked > 0);
  const before = stableState(game); game.update(.25);
  assert.equal(stableState(game), before); assert.equal(game.build('lantern', 'p1').ok, false); assert.equal(game.startWave().ok, false);
});

test('the documented legal build strategy wins all twelve waves deterministically', () => {
  const first = runStrategy(), second = runStrategy();
  assert.equal(first.game.status, 'won'); assert.equal(first.game.wave, 12); assert.equal(first.game.lives, 20);
  assert.equal(first.game.kills, 421); assert.equal(first.purchases, 30);
  assert.equal(stableState(first.game), stableState(second.game));
  const before = stableState(first.game); first.game.update(.25); assert.equal(stableState(first.game), before);
  assert.equal(first.game.upgrade(first.game.towers[0].id).ok, false); assert.equal(first.game.sell(first.game.towers[0].id).ok, false);
});

test('restart clears all battle state and produces an identical opening', () => {
  const game = runStrategy().game; assert.ok(game.reset().ok);
  assert.deepEqual(game, new Game());
  assert.ok(game.build('lantern', 'p3').ok); assert.ok(game.startWave().ok); game.update(.25);
  assert.equal(game.wave, 0); assert.equal(game.status, 'wave'); assert.equal(game.lives, 20);
});
