/** Deterministic, DOM-free Taiwan Lantern Defense simulation. All times are seconds. */
export const WIDTH = 960;
export const HEIGHT = 600;
export const CELL = 60;
export const STEP = 1 / 60;
const freeze = value => { Object.freeze(value); Object.values(value).forEach(v => { if (v && typeof v === 'object' && !Object.isFrozen(v)) freeze(v); }); return value; };
export const PATH = freeze([[-1, 2], [4, 2], [4, 6], [10, 6], [10, 3], [15, 3], [15, 10]].map(([x, y]) => ({ x: x * CELL + 30, y: y * CELL + 30 })));
const SEGMENTS = PATH.slice(1).map((point, i) => ({ from: PATH[i], to: point, length: Math.hypot(point.x - PATH[i].x, point.y - PATH[i].y) }));
export const PATH_LENGTH = SEGMENTS.reduce((sum, segment) => sum + segment.length, 0);
export function pathPosition(progress) {
  let distance = Math.max(0, Number.isFinite(progress) ? progress : 0);
  for (const segment of SEGMENTS) {
    if (distance <= segment.length) {
      const t = distance / segment.length;
      return { x: segment.from.x + (segment.to.x - segment.from.x) * t, y: segment.from.y + (segment.to.y - segment.from.y) * t, angle: Math.atan2(segment.to.y - segment.from.y, segment.to.x - segment.from.x) };
    }
    distance -= segment.length;
  }
  return { ...PATH.at(-1), angle: Math.PI / 2 };
}
export const PADS = freeze([[2, 1], [3, 3], [5, 3], [3, 5], [5, 5], [7, 5], [7, 7], [9, 7], [9, 4], [11, 5], [11, 2], [13, 2], [14, 4], [14, 6], [14, 8], [12, 4]].map(([x, y], i) => ({ id: `p${i + 1}`, x: x * CELL + 30, y: y * CELL + 30 })));
export const TYPES = freeze({
  lantern: { id: 'lantern', name: '天燈塔', short: '天燈', description: '穩定單體輸出，以暖光驅散迷霧。', role: '單體速攻', color: '#ffbd69', cost: 70, upgrades: [75, 115], levels: [
    { damage: 22, range: 150, interval: .75, projectileSpeed: 430 }, { damage: 36, range: 170, interval: .65, projectileSpeed: 460 }, { damage: 58, range: 190, interval: .55, projectileSpeed: 490 }
  ] },
  tea: { id: 'tea', name: '茶香塔', short: '茶香', description: '清香緩速迷霧，讓其他防禦塔多攻擊幾次。', role: '緩速輔助', color: '#8ed7a6', cost: 90, upgrades: [90, 130], levels: [
    { damage: 7, range: 135, interval: 1.15, projectileSpeed: 360, slowFactor: .55, slowDuration: 2.2 }, { damage: 12, range: 155, interval: 1, projectileSpeed: 380, slowFactor: .45, slowDuration: 2.5 }, { damage: 20, range: 175, interval: .85, projectileSpeed: 400, slowFactor: .35, slowDuration: 2.8 }
  ] },
  drum: { id: 'drum', name: '醒獅鼓', short: '獅鼓', description: '鼓聲造成範圍傷害，適合對付成群霧靈。', role: '範圍爆破', color: '#ff8075', cost: 120, upgrades: [115, 165], levels: [
    { damage: 38, range: 140, interval: 1.55, projectileSpeed: 330, splash: 65 }, { damage: 65, range: 155, interval: 1.35, projectileSpeed: 350, splash: 78 }, { damage: 105, range: 170, interval: 1.15, projectileSpeed: 370, splash: 90 }
  ] },
  bamboo: { id: 'bamboo', name: '竹弩塔', short: '竹弩', description: '竹箭無視護甲，剋制硬殼霧靈與首領。', role: '破甲狙擊', color: '#88c9f9', cost: 150, upgrades: [135, 185], levels: [
    { damage: 56, range: 180, interval: 1.1, projectileSpeed: 600, pierce: 1 }, { damage: 90, range: 200, interval: .95, projectileSpeed: 640, pierce: 1 }, { damage: 150, range: 220, interval: .8, projectileSpeed: 680, pierce: 1 }
  ] }
});
export function towerStats(type, level = 1) {
  const spec = Object.hasOwn(TYPES, type) ? TYPES[type] : null;
  if (!spec || !Number.isInteger(level) || level < 1 || level > 3) return null;
  return { splash: 0, slowFactor: 1, slowDuration: 0, pierce: 0, ...spec.levels[level - 1], cost: spec.cost, cooldown: spec.levels[level - 1].interval };
}
export function upgradeCost(typeOrTower, level) {
  const type = typeof typeOrTower === 'object' && typeOrTower ? typeOrTower.type : typeOrTower;
  const currentLevel = typeof typeOrTower === 'object' && typeOrTower ? typeOrTower.level : level;
  return Object.hasOwn(TYPES, type) && Number.isInteger(currentLevel) ? TYPES[type].upgrades[currentLevel - 1] ?? null : null;
}
export const nextUpgradeCost = upgradeCost;
export function sellValue(tower) { return tower ? Math.floor(tower.spent * .7) : 0; }
export const ENEMIES = freeze({
  wisp: { name: '霧靈', description: '慢速的基礎迷霧。', hp: 55, speed: 54, reward: 8, armor: 0, slowResist: 0, leak: 1, color: '#bfbbf9', radius: 13 },
  rusher: { name: '疾風霧', description: '體型輕巧，移動迅速。', hp: 45, speed: 96, reward: 9, armor: 0, slowResist: .05, leak: 1, color: '#f5b0ce', radius: 11 },
  armor: { name: '岩殼霧', description: '護甲減傷 55%，竹弩可穿透。', hp: 160, speed: 43, reward: 15, armor: .55, slowResist: .1, leak: 2, color: '#8eaccb', radius: 17 },
  swarm: { name: '碎霧', description: '成群出現，害怕鼓聲。', hp: 30, speed: 72, reward: 5, armor: 0, slowResist: 0, leak: 1, color: '#c4dbff', radius: 9 },
  veil: { name: '迴風霧', description: '抗緩速 60%，需要集中火力。', hp: 120, speed: 72, reward: 12, armor: .12, slowResist: .6, leak: 1, color: '#90e0d2', radius: 14 },
  mistlord: { name: '山嵐巨靈', description: '第十波首領，護甲 18%，抗緩速 65%。', hp: 1550, speed: 29, reward: 130, armor: .18, slowResist: .65, leak: 5, boss: true, color: '#d3b2ff', radius: 27 },
  shelllord: { name: '玄岩巨靈', description: '第十一波首領，護甲 55%，抗緩速 70%。', hp: 2300, speed: 26, reward: 150, armor: .55, slowResist: .7, leak: 7, boss: true, color: '#b7ccdf', radius: 29 },
  moonlord: { name: '月蝕霧王', description: '最終首領，護甲 28%，抗緩速 78%。', hp: 4200, speed: 30, reward: 220, armor: .28, slowResist: .78, leak: 10, boss: true, color: '#f2a6eb', radius: 33 }
});
const group = (type, count, gap, at = 0) => ({ type, count, gap, at });
export const WAVES = freeze([
  { name: '街口初霧', description: '霧靈沿著山城小徑出現。先佈置天燈塔。', reward: 30, groups: [group('wisp', 8, 1.05)] },
  { name: '風穿燈巷', description: '疾風霧速度快，茶香能留住牠們。', reward: 35, groups: [group('wisp', 10, .85), group('rusher', 4, 1, 5)] },
  { name: '碎霧成群', description: '醒獅鼓的範圍攻擊適合清除碎霧。', reward: 40, groups: [group('swarm', 20, .3), group('wisp', 6, .7, 5)] },
  { name: '岩殼來訪', description: '岩殼霧帶有護甲，試試竹弩塔。', reward: 45, groups: [group('armor', 6, 1.8), group('rusher', 10, .65, 3)] },
  { name: '夜市疾行', description: '快速混合波。照顧轉彎處與出口。', reward: 50, groups: [group('rusher', 18, .5), group('swarm', 16, .3, 4)] },
  { name: '石階霧陣', description: '護甲與數量並進，升級竹弩與獅鼓。', reward: 55, groups: [group('armor', 12, 1.25), group('wisp', 14, .65, 2)] },
  { name: '迴風入城', description: '迴風霧能抵抗部分緩速，補強傷害。', reward: 60, groups: [group('veil', 14, .75), group('rusher', 16, .5, 4)] },
  { name: '霧海湧流', description: '密集碎霧伴隨岩殼，範圍與破甲缺一不可。', reward: 65, groups: [group('swarm', 36, .22), group('armor', 12, 1, 2)] },
  { name: '山城守望', description: '三種霧靈夾擊，準備迎戰巨靈。', reward: 70, groups: [group('veil', 18, .6), group('armor', 14, 1.1, 2), group('rusher', 14, .6, 7)] },
  { name: '山嵐巨靈', description: '第一位首領登場；緩速效果會減弱。', reward: 80, boss: 'mistlord', groups: [group('mistlord', 1, 1, 3), group('swarm', 32, .26), group('rusher', 18, .6, 7)] },
  { name: '玄岩巨靈', description: '重甲首領，竹弩是關鍵。', reward: 90, boss: 'shelllord', groups: [group('shelllord', 1, 1, 3), group('armor', 18, .95), group('veil', 18, .55, 7)] },
  { name: '萬燈破曉', description: '月蝕霧王來襲！守住最後一盞燈。', reward: 120, boss: 'moonlord', groups: [group('moonlord', 1, 1, 4), group('armor', 20, .85), group('veil', 24, .6, 5), group('swarm', 40, .22, 10)] }
]);
const ok = extra => ({ ok: true, reason: '', ...extra });
const no = reason => ({ ok: false, reason });
const distanceSquared = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export class Game {
  constructor() { this.reset(); }
  reset() {
    this.gold = 240; this.lives = 20; this.wave = 0; this.status = 'build'; this.paused = false; this.speed = 1;
    this.towers = []; this.enemies = []; this.projectiles = []; this.effects = []; this.time = 0; this.kills = 0;
    this.spawnQueue = []; this.waveTime = 0; this.spawned = 0; this.totalEnemies = 0; this.leaked = 0;
    this.lastReward = 0; this._accumulator = 0; this._nextId = 1; this._tick = 0;
    return ok();
  }
  build(type, padId) {
    if (this.status === 'won' || this.status === 'lost') return no('本局已結束，請重新開始。');
    const spec = Object.hasOwn(TYPES, type) ? TYPES[type] : null, pad = PADS.find(p => p.id === padId);
    if (!spec) return no('請選擇有效的防禦塔。');
    if (!pad) return no('請選擇發光的建造空地。');
    if (this.towers.some(t => t.padId === padId)) return no('這塊空地已有防禦塔。');
    if (this.gold < spec.cost) return no('金幣不足。');
    const tower = { id: `t${this._nextId++}`, type, padId, x: pad.x, y: pad.y, level: 1, spent: spec.cost, range: towerStats(type).range, cooldown: 0, angle: -Math.PI / 2, shots: 0 };
    this.gold -= spec.cost; this.towers.push(tower);
    this._effect('build', tower.x, tower.y, spec.color, .65, 34);
    return ok({ towerId: tower.id, tower });
  }
  upgrade(towerId) {
    if (this.status === 'won' || this.status === 'lost') return no('本局已結束，請重新開始。');
    const tower = this.towers.find(t => t.id === towerId);
    if (!tower) return no('找不到這座防禦塔。');
    const cost = upgradeCost(tower);
    if (cost === null) return no('已達最高等級。');
    if (this.gold < cost) return no('升級所需的金幣不足。');
    this.gold -= cost; tower.spent += cost; tower.level++; tower.range = towerStats(tower.type, tower.level).range;
    tower.cooldown = Math.min(tower.cooldown, towerStats(tower.type, tower.level).interval);
    this._effect('upgrade', tower.x, tower.y, TYPES[tower.type].color, .8, 46);
    return ok({ towerId, level: tower.level, cost });
  }
  sell(towerId) {
    if (this.status === 'won' || this.status === 'lost') return no('本局已結束，請重新開始。');
    const i = this.towers.findIndex(t => t.id === towerId);
    if (i < 0) return no('找不到這座防禦塔。');
    const [tower] = this.towers.splice(i, 1), refund = sellValue(tower);
    this.gold += refund; this._effect('sell', tower.x, tower.y, '#ffdf88', .65, 32);
    return ok({ refund });
  }
  startWave() {
    if (this.status !== 'build' || this.wave >= WAVES.length) return no('請先完成目前的波次。');
    const definition = WAVES[this.wave];
    this.status = 'wave'; this.paused = false; this.waveTime = 0; this.spawned = 0; this._accumulator = 0;
    this.lastReward = 0;
    this.spawnQueue = definition.groups.flatMap((g, groupIndex) => Array.from({ length: g.count }, (_, i) => ({ type: g.type, at: .25 + g.at + i * g.gap, order: groupIndex * 1000 + i }))).sort((a, b) => a.at - b.at || a.order - b.order);
    this.totalEnemies = this.spawnQueue.length;
    return ok({ wave: this.wave + 1 });
  }
  togglePause() {
    if (this.status === 'won' || this.status === 'lost') return no('本局已結束。');
    this.paused = !this.paused;
    // Clear a sub-tick remainder so resuming cannot inherit elapsed paused time.
    this._accumulator = 0;
    return ok({ paused: this.paused });
  }
  setSpeed(n) {
    if (![1, 2, 3].includes(n)) return no('速度僅支援 1、2 或 3 倍。');
    this.speed = n; return ok({ speed: n });
  }
  update(realDt) {
    if (!Number.isFinite(realDt) || realDt <= 0 || this.paused || this.status === 'won' || this.status === 'lost') return;
    // Clamp long browser stalls: never jump an entire unseen wave after a hidden tab.
    this._accumulator += Math.min(realDt, .25) * this.speed;
    while (this._accumulator + 1e-10 >= STEP) {
      this._accumulator -= STEP;
      if (this._accumulator < 0) this._accumulator = 0;
      this._step();
      if (this.status === 'won' || this.status === 'lost') { this._accumulator = 0; break; }
    }
  }
  _step() {
    this._tick++; this.time = this._tick * STEP;
    this.effects.forEach(effect => { effect.age += STEP; effect.life = Math.max(0, effect.duration - effect.age); });
    this.effects = this.effects.filter(effect => effect.age < effect.duration);
    if (this.status !== 'wave') return;
    this.waveTime += STEP;
    while (this.spawnQueue.length && this.spawnQueue[0].at <= this.waveTime + 1e-9) this._spawn(this.spawnQueue.shift().type);
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      enemy.slowRemaining = Math.max(0, enemy.slowRemaining - STEP);
      if (!enemy.slowRemaining) enemy.slow = 1;
      enemy.progress += enemy.speed * enemy.slow * STEP;
      Object.assign(enemy, pathPosition(enemy.progress));
      if (enemy.progress >= PATH_LENGTH) {
        enemy.dead = true; enemy.escaped = true; this.leaked++; this.lives = Math.max(0, this.lives - enemy.leak);
        this._effect('leak', WIDTH - 30, HEIGHT - 12, '#ff6382', .7, 52);
      }
    }
    this.enemies = this.enemies.filter(enemy => !enemy.dead);
    if (this.lives <= 0) { this.status = 'lost'; this.projectiles = []; return; }
    for (const tower of this.towers) {
      tower.cooldown = Math.max(0, tower.cooldown - STEP);
      if (tower.cooldown > 1e-9) continue;
      const stats = towerStats(tower.type, tower.level);
      // Target the enemy closest to the exit, with stable ID order for ties.
      let target = null;
      for (const enemy of this.enemies) {
        if (enemy.dead || distanceSquared(tower, enemy) > stats.range ** 2) continue;
        if (!target || enemy.progress > target.progress) target = enemy;
      }
      if (!target) continue;
      tower.cooldown = stats.interval; tower.angle = Math.atan2(target.y - tower.y, target.x - tower.x); tower.shots++;
      this.projectiles.push({ id: `pjt${this._nextId++}`, towerId: tower.id, type: tower.type, targetId: target.id, x: tower.x, y: tower.y, fromX: tower.x, fromY: tower.y, targetX: target.x, targetY: target.y, color: TYPES[tower.type].color, age: 0, ...stats });
    }
    for (const projectile of this.projectiles) {
      projectile.age += STEP;
      const target = this.enemies.find(enemy => enemy.id === projectile.targetId && !enemy.dead);
      if (target) { projectile.targetX = target.x; projectile.targetY = target.y; }
      const dx = projectile.targetX - projectile.x, dy = projectile.targetY - projectile.y;
      const distance = Math.hypot(dx, dy), travel = projectile.projectileSpeed * STEP;
      projectile.angle = Math.atan2(dy, dx);
      if (distance <= travel || projectile.age > 4) {
        projectile.x = projectile.targetX; projectile.y = projectile.targetY; projectile.dead = true;
        if (projectile.splash) {
          for (const victim of this.enemies) if (!victim.dead && distanceSquared(projectile, victim) <= projectile.splash ** 2) this._hit(victim, projectile);
          this._effect('splash', projectile.x, projectile.y, projectile.color, .4, projectile.splash);
        } else if (target) this._hit(target, projectile);
      } else { projectile.x += dx / distance * travel; projectile.y += dy / distance * travel; }
    }
    this.projectiles = this.projectiles.filter(projectile => !projectile.dead);
    this.enemies = this.enemies.filter(enemy => !enemy.dead);
    if (!this.spawnQueue.length && !this.enemies.length) {
      this.lastReward = WAVES[this.wave].reward; this.gold += this.lastReward; this.wave++;
      this.status = this.wave === WAVES.length ? 'won' : 'build'; this.projectiles = [];
      this._effect('wave', WIDTH / 2, HEIGHT / 2, '#ffe5a0', 1.3, 160);
    }
  }
  _spawn(type) {
    const spec = ENEMIES[type], scale = 1 + this.wave * .095;
    // Boss HP is already tuned for the late campaign; normal enemies scale each wave.
    const maxHp = Math.round(spec.hp * (spec.boss ? 1 : scale));
    this.enemies.push({ id: `e${this._nextId++}`, type, ...spec, hp: maxHp, maxHp, speed: spec.speed * (1 + this.wave * .009), progress: 0, ...pathPosition(0), slow: 1, slowRemaining: 0, hitFlash: 0 });
    this.spawned++;
  }
  _hit(enemy, projectile) {
    const armor = enemy.armor * (1 - projectile.pierce);
    enemy.hp = Math.max(0, enemy.hp - projectile.damage * (1 - armor));
    enemy.hitAt = this.time;
    if (projectile.slowFactor < 1) {
      const slow = 1 - (1 - projectile.slowFactor) * (1 - enemy.slowResist);
      enemy.slow = Math.min(enemy.slow, slow); enemy.slowRemaining = Math.max(enemy.slowRemaining, projectile.slowDuration);
    }
    this._effect('hit', enemy.x, enemy.y, projectile.color, .18, enemy.radius + 4);
    if (enemy.hp <= 0 && !enemy.dead) {
      enemy.dead = true; this.gold += enemy.reward; this.kills++;
      this._effect('death', enemy.x, enemy.y, enemy.color, .5, enemy.radius * 1.7);
      this._effect('gold', enemy.x, enemy.y - enemy.radius, '#ffe09b', .7, 0, `+${enemy.reward}`);
    }
  }
  _effect(type, x, y, color, duration, radius, text = '') {
    this.effects.push({ id: `fx${this._nextId++}`, type, x, y, color, duration, age: 0, life: duration, radius, text });
    if (this.effects.length > 240) this.effects.splice(0, this.effects.length - 240);
  }
}
