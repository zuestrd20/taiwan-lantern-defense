import test from 'node:test';
import assert from 'node:assert/strict';
import { Soundscape } from './sound.js';

function audioHarness(t, options = {}) {
  const originalAudio = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  const originalWebkit = Object.getOwnPropertyDescriptor(globalThis, 'webkitAudioContext');
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  const intervals = new Map();
  const contexts = [];
  let nextTimer = 0;

  class Param {
    constructor() { this.events = []; }
    record(method, values) {
      assert.ok(values.every(Number.isFinite), `${method} received a non-finite value`);
      if (method === 'exponentialRampToValueAtTime') assert.ok(values[0] > 0);
      this.events.push({ method, values });
    }
    setValueAtTime(...args) { this.record('setValueAtTime', args); }
    linearRampToValueAtTime(...args) { this.record('linearRampToValueAtTime', args); }
    exponentialRampToValueAtTime(...args) { this.record('exponentialRampToValueAtTime', args); }
    setTargetAtTime(...args) { this.record('setTargetAtTime', args); }
    cancelScheduledValues(...args) { this.record('cancelScheduledValues', args); }
  }
  class Node {
    constructor() { this.connections = []; this.disconnected = false; }
    connect(node) { this.connections.push(node); return node; }
    disconnect() { this.connections = []; this.disconnected = true; }
  }
  class Context {
    constructor() {
      if (options.constructorError) throw new Error('Unavailable');
      this.currentTime = 0;
      this.state = 'suspended';
      this.destination = new Node();
      this.gains = [];
      this.oscillators = [];
      this.resumeCalls = 0;
      this.closeCalls = 0;
      contexts.push(this);
    }
    createGain() {
      const gain = new Node();
      gain.gain = new Param();
      this.gains.push(gain);
      return gain;
    }
    createOscillator() {
      const oscillator = new Node();
      oscillator.frequency = new Param();
      oscillator.onended = null;
      oscillator.start = (time) => {
        assert.ok(Number.isFinite(time));
        assert.equal(oscillator.startedAt, undefined);
        oscillator.startedAt = time;
      };
      oscillator.stop = (time) => {
        assert.ok(Number.isFinite(time));
        oscillator.stoppedAt = time;
      };
      this.oscillators.push(oscillator);
      return oscillator;
    }
    async resume() {
      this.resumeCalls++;
      if (options.resumeError) throw new Error('Gesture rejected');
      if (options.resumeGate) await options.resumeGate;
      if (this.state !== 'closed') this.state = 'running';
    }
    async close() {
      this.closeCalls++;
      this.state = 'closed';
      if (options.closeError) throw new Error('Already closed');
    }
    advance(seconds) {
      this.currentTime += seconds;
      for (const oscillator of this.oscillators) {
        if (oscillator.stoppedAt <= this.currentTime) oscillator.onended?.();
      }
    }
  }

  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, writable: true, value: options.unsupported ? undefined : Context });
  Object.defineProperty(globalThis, 'webkitAudioContext', { configurable: true, writable: true, value: options.webkit ? Context : undefined });
  globalThis.setInterval = (callback) => {
    const id = ++nextTimer;
    intervals.set(id, callback);
    return id;
  };
  globalThis.clearInterval = (id) => intervals.delete(id);
  t.after(() => {
    if (originalAudio) Object.defineProperty(globalThis, 'AudioContext', originalAudio);
    else delete globalThis.AudioContext;
    if (originalWebkit) Object.defineProperty(globalThis, 'webkitAudioContext', originalWebkit);
    else delete globalThis.webkitAudioContext;
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  });
  return { contexts, intervals, tick: () => [...intervals.values()].forEach((callback) => callback()) };
}

function checkGraph(context) {
  for (const oscillator of context.oscillators) {
    assert.ok(Number.isFinite(oscillator.startedAt));
    assert.ok(Number.isFinite(oscillator.stoppedAt));
    assert.ok(oscillator.frequency.events.every((event) => event.values[0] > 0));
  }
  for (const gain of context.gains) {
    for (const event of gain.gain.events) {
      if (event.method === 'cancelScheduledValues') continue;
      assert.ok(event.values[0] >= 0 && event.values[0] <= 0.28, 'Gain remains quiet and valid');
    }
  }
}

test('audio is opt-in, with one scheduler and finite quiet envelopes', async (t) => {
  const harness = audioHarness(t);
  const sound = new Soundscape();
  assert.equal(sound.enabled, false);
  assert.equal(sound.context, null);
  sound.cue('build');
  sound.setPaused(false);
  assert.equal(harness.contexts.length, 0);
  assert.equal(await sound.toggle(), true);
  assert.equal(sound.enabled, true);
  assert.equal(sound.context, harness.contexts[0]);
  assert.equal(harness.contexts[0].resumeCalls, 1);
  assert.equal(harness.intervals.size, 1);
  assert.equal(harness.contexts[0].oscillators.length, 5);
  checkGraph(sound.context);
  await sound.dispose();
});

test('finished oscillators and envelopes disconnect and leave the voice set', async (t) => {
  const harness = audioHarness(t);
  const sound = new Soundscape();
  await sound.toggle();
  const context = sound.context;
  context.advance(6);
  assert.equal(sound._voices.size, 0);
  assert.ok(context.oscillators.every((node) => node.disconnected));
  assert.ok(context.gains.slice(1).every((node) => node.disconnected));
  assert.equal(harness.intervals.size, 1);
  await sound.dispose();
});

test('pause fades scheduled voices, blocks cues, and resumes without a second context', async (t) => {
  const harness = audioHarness(t);
  const sound = new Soundscape();
  await sound.toggle();
  const context = sound.context;
  const count = context.oscillators.length;
  sound.setPaused(true);
  assert.equal(sound.enabled, true);
  assert.equal(harness.intervals.size, 0);
  assert.ok(context.oscillators.every((node) => node.stoppedAt <= 0.05));
  sound.cue('wave');
  assert.equal(context.oscillators.length, count);
  context.advance(0.1);
  assert.equal(sound._voices.size, 0);
  sound.setPaused(false);
  assert.equal(harness.intervals.size, 1);
  assert.equal(harness.contexts.length, 1);
  sound.setPaused(false);
  assert.equal(harness.intervals.size, 1);
  await sound.dispose();
});

test('toggling on while paused waits for unpause to schedule music', async (t) => {
  const harness = audioHarness(t);
  const sound = new Soundscape();
  sound.setPaused(true);
  assert.equal(await sound.toggle(), true);
  assert.equal(sound.context.oscillators.length, 0);
  assert.equal(harness.intervals.size, 0);
  sound.setPaused(false);
  assert.equal(sound.context.oscillators.length, 5);
  assert.equal(harness.intervals.size, 1);
  await sound.dispose();
});

test('off stops scheduling and the same context can be toggled back on', async (t) => {
  const harness = audioHarness(t);
  const sound = new Soundscape();
  await sound.toggle();
  const context = sound.context;
  assert.equal(await sound.toggle(), false);
  assert.equal(sound.enabled, false);
  assert.equal(harness.intervals.size, 0);
  assert.equal(context.gains[0].gain.events.at(-1).values[0], 0);
  context.advance(0.1);
  assert.equal(sound._voices.size, 0);
  assert.equal(await sound.toggle(), true);
  assert.equal(sound.context, context);
  assert.equal(harness.intervals.size, 1);
  await sound.dispose();
});

test('all game cues are finite, short, rate-limited, and unknown names are harmless', async (t) => {
  audioHarness(t);
  const sound = new Soundscape();
  await sound.toggle();
  const context = sound.context;
  for (const name of ['build', 'upgrade', 'wave', 'clear', 'won', 'lost']) {
    const before = context.oscillators.length;
    sound.cue(name);
    assert.ok(context.oscillators.length > before);
    const after = context.oscillators.length;
    sound.cue(name);
    assert.equal(context.oscillators.length, after);
  }
  const count = context.oscillators.length;
  for (const unknown of ['unknown', 'constructor', '__proto__', null, undefined]) sound.cue(unknown);
  assert.equal(context.oscillators.length, count);
  checkGraph(context);
  await sound.dispose();
});

test('a sleeping tab skips missed beats instead of creating a catch-up burst', async (t) => {
  const harness = audioHarness(t);
  const sound = new Soundscape();
  await sound.toggle();
  const context = sound.context;
  context.advance(3600);
  const before = context.oscillators.length;
  harness.tick();
  assert.ok(context.oscillators.length - before <= 5);
  assert.ok(sound._nextTime > context.currentTime);
  for (let index = 0; index < 300; index++) {
    context.advance(0.3);
    harness.tick();
    assert.ok(sound._voices.size < 40);
  }
  checkGraph(context);
  await sound.dispose();
});

test('voice creation is bounded even if ended callbacks are delayed', async (t) => {
  audioHarness(t);
  const sound = new Soundscape();
  await sound.toggle();
  const context = sound.context;
  for (let index = 0; index < 200; index++) {
    context.currentTime += 0.1;
    sound.cue('won');
  }
  assert.equal(sound._voices.size, 64);
  assert.equal(context.oscillators.length, 64);
  await sound.dispose();
  assert.equal(sound._voices.size, 0);
  assert.ok(context.oscillators.every((node) => node.disconnected));
  assert.ok(context.gains.every((node) => node.disconnected));
});

test('unsupported and constructor-rejected audio return false cleanly', async (t) => {
  audioHarness(t, { unsupported: true });
  const sound = new Soundscape();
  assert.equal(await sound.toggle(), false);
  assert.equal(sound.enabled, false);
  assert.equal(sound.context, null);
  await sound.dispose();
});

test('a failed AudioContext constructor is recoverable', async (t) => {
  audioHarness(t, { constructorError: true });
  const sound = new Soundscape();
  assert.equal(await sound.toggle(), false);
  assert.equal(await sound.toggle(), false);
  assert.equal(sound.context, null);
  await sound.dispose();
});

test('rejected audio resume releases its graph and reports disabled', async (t) => {
  const harness = audioHarness(t, { resumeError: true });
  const sound = new Soundscape();
  assert.equal(await sound.toggle(), false);
  assert.equal(sound.enabled, false);
  assert.equal(sound.context, null);
  assert.equal(harness.intervals.size, 0);
  assert.equal(harness.contexts[0].closeCalls, 1);
  assert.ok(harness.contexts[0].gains.every((node) => node.disconnected));
  assert.equal(await sound.toggle(), false);
  assert.equal(harness.contexts.length, 2);
  await sound.dispose();
});

test('legacy prefixed WebAudio remains supported', async (t) => {
  audioHarness(t, { unsupported: true, webkit: true });
  const sound = new Soundscape();
  assert.equal(await sound.toggle(), true);
  await sound.dispose();
});

test('a second toggle cancels a pending resume without late music starting', async (t) => {
  let release;
  const resumeGate = new Promise((resolve) => { release = resolve; });
  const harness = audioHarness(t, { resumeGate });
  const sound = new Soundscape();
  const first = sound.toggle();
  assert.equal(await sound.toggle(), false);
  release();
  assert.equal(await first, false);
  assert.equal(sound.enabled, false);
  assert.equal(harness.intervals.size, 0);
  assert.equal(sound.context.oscillators.length, 0);
  assert.equal(await sound.toggle(), true);
  await sound.dispose();
});

test('disposal during a pending resume cannot restart the scheduler', async (t) => {
  let release;
  const resumeGate = new Promise((resolve) => { release = resolve; });
  const harness = audioHarness(t, { resumeGate });
  const sound = new Soundscape();
  const pending = sound.toggle();
  const context = sound.context;
  await sound.dispose();
  release();
  assert.equal(await pending, false);
  assert.equal(sound.context, null);
  assert.equal(sound.enabled, false);
  assert.equal(harness.intervals.size, 0);
  assert.equal(context.closeCalls, 1);
  assert.ok(context.gains.every((node) => node.disconnected));
  assert.equal(await sound.toggle(), false);
  await sound.dispose();
  assert.equal(context.closeCalls, 1);
});

test('disposal is idempotent even when closing the audio context rejects', async (t) => {
  const harness = audioHarness(t, { closeError: true });
  const sound = new Soundscape();
  await sound.toggle();
  const context = sound.context;
  await sound.dispose();
  await sound.dispose();
  sound.setPaused(false);
  sound.cue('won');
  assert.equal(await sound.toggle(), false);
  assert.equal(context.closeCalls, 1);
  assert.equal(harness.intervals.size, 0);
  assert.equal(sound._voices.size, 0);
  assert.ok(context.oscillators.every((node) => node.disconnected));
});
