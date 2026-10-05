/** Demonstrates a complete deterministic victory using ONLY the public action API. */
import { Game } from './engine.js';
import { pathToFileURL } from 'node:url';
export const STRATEGY = [
  ['build', 'lantern', 'p3'], ['build', 'lantern', 'p5'], ['build', 'tea', 'p9'],
  ['upgrade', 'p3'], ['build', 'drum', 'p6'], ['build', 'bamboo', 'p10'],
  ['upgrade', 'p10'], ['upgrade', 'p6'], ['upgrade', 'p5'], ['upgrade', 'p3'],
  ['build', 'bamboo', 'p11'], ['upgrade', 'p10'], ['upgrade', 'p9'], ['upgrade', 'p6'],
  ['upgrade', 'p11'], ['build', 'drum', 'p4'], ['upgrade', 'p4'], ['build', 'lantern', 'p13'],
  ['upgrade', 'p5'], ['upgrade', 'p9'], ['upgrade', 'p11'], ['upgrade', 'p4'],
  ['build', 'bamboo', 'p8'], ['upgrade', 'p8'], ['upgrade', 'p8'],
  ['upgrade', 'p13'], ['upgrade', 'p13'], ['build', 'bamboo', 'p14'], ['upgrade', 'p14'], ['upgrade', 'p14']
];
export function runStrategy({ speed = 3, dt = 1 / 30, log = false } = {}) {
  const game = new Game(), records = []; let nextAction = 0, frames = 0;
  game.setSpeed(speed);
  while (game.status !== 'won' && game.status !== 'lost' && frames < 200000) {
    if (game.status === 'build') {
      const purchases = [];
      while (nextAction < STRATEGY.length) {
        const action = STRATEGY[nextAction];
        const result = action[0] === 'build' ? game.build(action[1], action[2]) : game.upgrade(game.towers.find(t => t.padId === action[1])?.id);
        if (!result.ok) break;
        purchases.push(action.join(' ')); nextAction++;
      }
      records.push({ wave: game.wave + 1, lives: game.lives, gold: game.gold, towers: game.towers.length, purchases });
      game.startWave();
    }
    game.update(dt); frames++;
  }
  if (log) {
    for (const record of records) console.log(`Wave ${record.wave}: ${record.lives} lives, ${record.gold} gold, ${record.towers} towers | ${record.purchases.join('; ') || 'Save gold'}`);
    console.log(JSON.stringify({ status: game.status, waves: game.wave, lives: game.lives, gold: game.gold, kills: game.kills, simulationSeconds: Number(game.time.toFixed(2)), purchases: nextAction }, null, 2));
  }
  return { game, records, purchases: nextAction, frames };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { game } = runStrategy({ log: true });
  if (game.status !== 'won') process.exitCode = 1;
}
