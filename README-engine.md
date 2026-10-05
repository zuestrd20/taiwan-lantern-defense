# Lantern Defense simulation

`engine.js` is a dependency-free ES module with no DOM, timers, randomness, storage, or network calls. The logical playfield is 960 × 600, with 60 px cells. The renderer may read state; game changes should go through the public methods.

## Public API

- `new Game()` / `game.reset()`: gold 240, lives 20, zero completed waves, clean IDs and all battle state.
- `game.build(type, padId)`: type `lantern`, `tea`, `drum`, or `bamboo`; pad `p1`–`p16`. Returns `{ok, reason, towerId, tower}` on success.
- `game.upgrade(towerId)`: three levels maximum; range and damage improve. The full investment is tracked in `tower.spent`.
- `game.sell(towerId)`: returns `{ok, reason, refund}`; refund is `floor(spent × 0.7)`.
- `game.startWave()`: only from `build`. Resumes if paused. Waves never auto-start.
- `game.togglePause()`: freezes all simulation movement, effects, damage, spawning and time. Building and upgrading remain possible.
- `game.setSpeed(1 | 2 | 3)`: simulation speed, never damage multipliers.
- `game.update(realDt)`: seconds since last render. Uses fixed 1/60-second simulation ticks and caps an input frame at 0.25 seconds. Invalid or negative deltas are ignored. Paused and terminal games do not simulate.
- Actions return `{ok: boolean, reason: string}`; failures have a Traditional Chinese explanation and no economy changes.

`game.wave` is the number of **completed** waves (initially 0). During combat display `game.wave + 1`; after victory it is 12. `status` is `build`, `wave`, `won`, or `lost`. Exposed state includes `gold`, `lives`, `paused`, `speed`, `towers`, `enemies`, `projectiles`, `effects`, `time`, `kills`, `leaked`, `waveTime`, `spawnQueue`, `spawned`, `totalEnemies`, and `lastReward`.

Wave victory occurs once all scheduled enemies are killed or have exited. Leaks deduct the enemy's `leak` value; zero lives ends the game immediately. Gold is paid once per kill and once per cleared wave. The final three waves feature three distinct bosses. Bosses have partial slow resistance rather than immunity.

### Configuration and helpers

- `TYPES`: Chinese labels, costs, colors, upgrade costs and level specifications.
- `ENEMIES`: Chinese labels, HP, speed, bounty, armor, slow resistance, leak cost, color and radius.
- `WAVES`: 12 original campaign definitions, groups and completion rewards; 421 enemies total.
- `PADS`: `{id, x, y}` for all legal tower positions, explicitly off the path.
- `PATH`: ordered pixel-center `{x,y}` waypoints. `PATH_LENGTH` is 1800 px.
- `pathPosition(progress)`: interpolated `{x,y,angle}` along the path.
- `towerStats(type, level=1)`: stats including `damage`, `range`, `interval`, `projectileSpeed`, `splash`, `slowFactor`, `slowDuration`, `pierce`. Invalid types/levels return `null`.
- `upgradeCost(type, level)` or `upgradeCost(tower)`; also exported as `nextUpgradeCost`. Returns `null` at max level.
- `sellValue(tower)`: gold refund.

Tower state: `{id,type,padId,x,y,level,range,spent,cooldown,angle,shots}`.
Enemy state includes `{id,type,x,y,angle,hp,maxHp,progress,speed,slow,slowRemaining,armor,slowResist,radius,boss,hitAt}`. `slow` is the active speed multiplier (1 means normal). A tea tower's slow cannot stack multiplicatively; the strongest active effect applies.
Projectiles are homing, travel before impact, and retain the firing tower's stats if that tower is sold or upgraded. Drum splash can hit nearby enemies even if its primary target dies in flight. Bamboo bypasses armor. Targeting selects the in-range enemy closest to the exit.
Effects: `{id,type,x,y,color,duration,age,life,radius,text}`. Types: `build`, `upgrade`, `sell`, `leak`, `splash`, `hit`, `death`, `gold`, `wave`. Effects are capped at 240.

## Verification

```sh
node --test engine.test.js
node strategy.mjs
```

The suite covers path geometry, valid pads, economy and repeated clicks, upgrades/refunds, projectile travel, splash, slow resistance and expiration, armor piercing, payout de-duplication, wave rewards, pause, fast-forward, frame partition determinism, browser-stall safety, normal loss, restart, and deterministic full-campaign victory. Isolated impact tests use explicit mechanic fixtures. The complete campaign test and strategy never alter game state directly.

`strategy.mjs` records every purchase and wave, using only `build`, `upgrade`, `startWave`, `setSpeed`, and `update`. The verified opening is lanterns at **p3 (330,210)** and **p5 (330,330)**, plus tea at **p9 (570,270)**. Upgrade p3 before wave 2; add a drum at p6 before wave 3 and bamboo at p10 before wave 4. The remainder of the ordered build plan is included in that script.

Verified deterministic result: **12 waves won, 20 lives, 421 kills, 30 purchase/upgrade actions, approximately 309 simulated seconds**. Choosing towers and upgrades well can preserve every life; doing nothing loses in wave 2. No currency cheats or direct simulation-state mutations are used for the victory.
