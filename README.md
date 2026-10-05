# 燈火守望 · 山海之間

An original Taiwan-inspired HTML5 tower-defense game. Protect a fictional lantern-lit valley for twelve nights, from the night market past rice fields and a temple courtyard to the mountain village.

## Play

Choose a tower, then a numbered `+` building pad. Select a built tower to upgrade or sell. Each tower has three levels; selling refunds 70% of all money invested. Start each wave when ready. Space pauses, Escape cancels selection, and speed cycles through 1×/2×/3×. Mouse, keyboard-focusable pads, and touch input are supported. Music starts only after its toggle is pressed.

- **天燈塔**: affordable, fast single-target light.
- **茶香塔**: slowing support; resistant enemies reduce its effect.
- **醒獅鼓**: area damage against dense swarms.
- **竹弩塔**: armor-piercing fire against shells and bosses.

The last three nights feature distinct bosses. A cleared night rewards extra coins. You win after all twelve nights if at least one of twenty lights remains. Waves wait for your input, so take time to plan.

## Development

No build step or runtime dependencies. Serve this folder over HTTP (`npm run serve`) and open the local address shown by your server. `npm test` runs deterministic Node.js tests. `node strategy.mjs` demonstrates a complete legal-action victory without modifying game state or awarding extra resources. The simulation uses fixed 1/60-second ticks.

Static GitHub Pages deployment uses the `main` branch at `/` with `.nojekyll`; no custom Actions workflow or secrets are required.

## Original work and accessibility

All illustration is original canvas vector drawing. All music is original WebAudio synthesis; there are no copied commercial sprites, samples, fonts, or third-party assets. Taiwan-inspired visual motifs are used respectfully in an invented setting. Enemies are whimsical fantasy mist creatures, not real communities or religious figures.

Traditional Chinese interface; distinct tower silhouettes and text roles; keyboard-accessible pad controls; reduced-motion support; manual audio opt-in; auto-pause on backgrounding. The game stores no personal information and uses no analytics. In-progress games reset on reload.
