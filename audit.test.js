/** Independent audit: exact ledgers, edge impacts, action races and a legal campaign. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, PADS, TYPES, ENEMIES, WAVES, PATH, PATH_LENGTH, STEP, pathPosition, towerStats } from './engine.js';

const clone = value => JSON.stringify(value);
function enemy(type, id, progress, overrides = {}) {
  return { ...ENEMIES[type], type, id, maxHp: 1000, hp: 1000, progress,
    ...pathPosition(progress), speed: 0, slow: 1, slowRemaining: 0, ...overrides };
}
function arena(enemies) {
  const game = new Game(); game.startWave(); game.enemies = enemies;
  game.spawnQueue = [{ type: 'wisp', at: 10000 }];
  return game;
}
function shot(type, target, overrides = {}) {
  return { ...towerStats(type), id: 'audit-shot', type, targetId: target.id,
    x: target.x, y: target.y, targetX: target.x, targetY: target.y,
    age: 0, color: TYPES[type].color, ...overrides };
}

test('audit: randomized public actions preserve exact transaction ledger and unique pad occupancy', () => {
  const game = new Game(); let expected = 240, seed = 918273, purchases = 0, refunds = 0;
  const next = n => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed%n; };
  for (let i=0;i<5000;i++) {
    const operation=next(3), type=Object.keys(TYPES)[next(4)], pad=PADS[next(PADS.length)].id;
    const tower=game.towers[next(game.towers.length||1)], before=clone(game);
    let result;
    if(operation===0) { result=game.build(type,pad); if(result.ok){expected-=TYPES[type].cost;purchases+=TYPES[type].cost;} }
    else if(operation===1) {
      const cost=tower?TYPES[tower.type].upgrades[tower.level-1]:null;
      result=game.upgrade(tower?.id); if(result.ok){expected-=cost;purchases+=cost;}
    } else {
      const amount=tower?Math.floor(tower.spent*.7):0;
      result=game.sell(tower?.id); if(result.ok){expected+=amount;refunds+=amount;}
    }
    if(!result.ok) assert.equal(clone(game),before,'Rejected action mutated state');
    assert.equal(game.gold,expected); assert.ok(game.gold>=0);
    assert.equal(new Set(game.towers.map(t=>t.padId)).size,game.towers.length);
    assert.equal(game.gold,240-purchases+refunds);
  }
});

test('audit: path advances continuously through every corner without teleporting', () => {
  let total=0;
  for(let i=1;i<PATH.length;i++) {
    total+=Math.hypot(PATH[i].x-PATH[i-1].x,PATH[i].y-PATH[i-1].y);
    const at=pathPosition(total), before=pathPosition(total-.001), after=pathPosition(total+.001);
    assert.deepEqual({x:at.x,y:at.y},PATH[i]);
    assert.ok(Math.hypot(before.x-at.x,before.y-at.y)<.001001);
    assert.ok(Math.hypot(after.x-at.x,after.y-at.y)<.001001);
  }
  assert.equal(total,PATH_LENGTH);
  for(let p=0;p<PATH_LENGTH;p+=.7) {
    const a=pathPosition(p),b=pathPosition(p+.7);
    assert.ok(Math.hypot(b.x-a.x,b.y-a.y)<=.70000001);
  }
});

test('audit: real splash impact obeys exact radius, enemy armor and one-impact accounting', () => {
  const center=enemy('wisp','center',400), armored=enemy('armor','armored',440), edge=enemy('wisp','edge',465), outside=enemy('wisp','outside',465.001);
  const game=arena([center,armored,edge,outside]); game.projectiles=[shot('drum',center)]; game.update(STEP);
  assert.equal(center.hp,962); assert.ok(Math.abs(armored.hp-(1000-38*.45))<1e-8);
  assert.equal(edge.hp,962); assert.equal(outside.hp,1000); assert.equal(game.projectiles.length,0);
  game.update(STEP); assert.equal(center.hp,962); assert.equal(game.gold,240);
});

test('audit: bamboo ignores armor while tea respects resistance and expires through movement loop', () => {
  const armored=enemy('armor','armored',400), game=arena([armored]);
  game.projectiles=[shot('bamboo',armored)]; game.update(STEP); assert.equal(armored.hp,944);
  const veil=enemy('veil','veil',450); game.enemies=[veil]; game.projectiles=[shot('tea',veil)]; game.update(STEP);
  assert.ok(Math.abs(veil.slow-.82)<1e-10); assert.equal(veil.slowRemaining,2.2);
  for(let i=0;i<133;i++)game.update(STEP);
  assert.equal(veil.slow,1); assert.equal(veil.slowRemaining,0);
});

test('audit: sold towers leave only their already-fired projectile and no new shots', () => {
  const game=new Game(), built=game.build('lantern','p3'); game.startWave();
  let frames=0;while(!game.projectiles.length&&frames++<3000)game.update(STEP);
  assert.ok(game.projectiles.length);const shotId=game.projectiles[0].id;
  const gold=game.gold;assert.ok(game.sell(built.towerId).ok);assert.equal(game.gold,gold+49);
  for(let i=0;i<180;i++)game.update(STEP);
  assert.equal(game.towers.length,0);assert.equal(game.projectiles.length,0);
  assert.ok(!game.projectiles.some(p=>p.id!==shotId));
});

test('audit: simultaneous overkill projectiles cannot duplicate a reward', () => {
  const target=enemy('wisp','one',400,{hp:1}),game=arena([target]);
  game.projectiles=Array.from({length:20},(_,i)=>shot('bamboo',target,{id:`shot${i}`}));
  game.update(STEP);assert.equal(game.gold,248);assert.equal(game.kills,1);assert.equal(game.enemies.length,0);
});

test('audit: an escaped projectile target never pays a kill bounty or damages lives twice', () => {
  const target=enemy('armor','exit',PATH_LENGTH-.1,{speed:43}),game=arena([target]);
  game.projectiles=[shot('bamboo',target)];game.update(STEP);
  assert.equal(game.lives,18);assert.equal(game.leaked,1);assert.equal(game.gold,240);assert.equal(game.kills,0);
  for(let i=0;i<300;i++)game.update(STEP);
  assert.equal(game.lives,18);assert.equal(game.leaked,1);assert.equal(game.gold,240);
});

test('audit: repeat clicks, pause cancellation and reset cannot retain purchase or battle state', () => {
  const game=new Game();const first=game.build('tea','p3');
  for(let i=0;i<100;i++)game.build('tea','p3');assert.equal(game.gold,150);assert.equal(game.towers.length,1);
  game.upgrade(first.towerId);for(let i=0;i<100;i++)game.upgrade(first.towerId);
  assert.equal(game.gold,60);assert.equal(game.towers[0].level,2);
  game.startWave();const queue=clone(game.spawnQueue);for(let i=0;i<100;i++)game.startWave();assert.equal(clone(game.spawnQueue),queue);
  game.update(.007);game.togglePause();const frozen=clone(game);for(let i=0;i<100;i++)game.update(.25);assert.equal(clone(game),frozen);
  game.togglePause();game.update(.01);assert.equal(game.time,0,'Pause cancellation must discard the partial tick');
  game.update(.25);game.reset();assert.deepEqual(game,new Game());
  game.startWave();game.update(.25);assert.equal(game.spawned,1);assert.equal(game.wave,0);
});

// Separately replay the documented public-action recipe, checking every cent and enemy.
const recipe=[['b','lantern','p3'],['b','lantern','p5'],['b','tea','p9'],['u','p3'],['b','drum','p6'],['b','bamboo','p10'],['u','p10'],['u','p6'],['u','p5'],['u','p3'],['b','bamboo','p11'],['u','p10'],['u','p9'],['u','p6'],['u','p11'],['b','drum','p4'],['u','p4'],['b','lantern','p13'],['u','p5'],['u','p9'],['u','p11'],['u','p4'],['b','bamboo','p8'],['u','p8'],['u','p8'],['u','p13'],['u','p13'],['b','bamboo','p14'],['u','p14'],['u','p14']];
test('audit: legal 12-wave victory reconciles every purchase, kill bounty and wave reward', () => {
  const game=new Game();let purchase=0,spent=0,bounties=0,waveRewards=0,kills=0,frames=0;
  while(!['won','lost'].includes(game.status)&&frames++<50000) {
    if(game.status==='build') {
      while(purchase<recipe.length) {
        const action=recipe[purchase],tower=game.towers.find(t=>t.padId===action[1]);
        const cost=action[0]==='b'?TYPES[action[1]].cost:TYPES[tower.type].upgrades[tower.level-1];
        const result=action[0]==='b'?game.build(action[1],action[2]):game.upgrade(tower.id);
        if(!result.ok){assert.ok(game.gold<cost);break;}
        spent+=cost;purchase++;assert.equal(game.gold,240+bounties+waveRewards-spent);
      }
      assert.ok(game.startWave().ok);
    }
    const previousEnemies=[...game.enemies],previousWave=game.wave;
    game.update(STEP);
    for(const victim of previousEnemies)if(victim.dead&&!victim.escaped){bounties+=victim.reward;kills++;}
    if(game.wave!==previousWave)waveRewards+=WAVES[previousWave].reward;
    assert.equal(game.gold,240+bounties+waveRewards-spent,`Resource drift at ${game.time}`);
    assert.equal(game.kills,kills);assert.ok(game.gold>=0);assert.ok(game.lives>=0);
    assert.ok(game.enemies.every(e=>Number.isFinite(e.hp)&&e.hp>0&&Number.isFinite(e.progress)));
  }
  assert.equal(game.status,'won');assert.equal(game.wave,12);assert.equal(game.lives,20);assert.equal(game.kills,421);assert.equal(purchase,30);
  const terminal=clone(game);for(let i=0;i<200;i++){game.update(.25);game.startWave();game.build('lantern','p1');game.upgrade(game.towers[0].id);game.sell(game.towers[0].id);game.togglePause();}
  assert.equal(clone(game),terminal);assert.equal(game.gold,1572);
});
