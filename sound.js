// An original, low-volume pentatonic evening score, synthesized entirely in-browser.
// Audio is opt-in: constructing this class never creates an AudioContext.
const STEP_SECONDS = 0.375;
const LOOK_AHEAD = 0.16;
const MAX_VOICES = 64;
const FLOOR = 0.0001;
const MASTER_VOLUME = 0.28;
const MELODY = [
  74, null, 78, 81, null, 78, 76, null, 74, null, 71, 69, null, 71, 74, null,
  76, null, 78, null, 81, 83, 81, null, 78, null, 76, 74, null, null, 71, null,
  74, null, 81, 78, null, 76, 74, null, 71, null, 69, 66, null, 69, 71, null,
  76, null, 78, 81, null, 83, 86, null, 83, 81, 78, null, 76, null, 74, null,
];
const HARMONY = [[50, 57, 66], [47, 54, 62], [45, 52, 62], [50, 57, 64]];
const CUES = {
  build: { notes: [81, 86], spacing: 0.065, duration: 0.3, volume: 0.045 },
  upgrade: { notes: [74, 78, 81], spacing: 0.08, duration: 0.45, volume: 0.045 },
  wave: { notes: [50, 57, 62], spacing: 0.13, duration: 0.65, volume: 0.052 },
  clear: { notes: [78, 81, 86], spacing: 0.14, duration: 0.8, volume: 0.045 },
  won: { notes: [74, 78, 81, 83, 86], spacing: 0.19, duration: 1.2, volume: 0.055 },
  lost: { notes: [71, 69, 66, 62], spacing: 0.23, duration: 0.9, volume: 0.04 },
};
const frequency = (midi) => 440 * 2 ** ((midi - 69) / 12);

export class Soundscape {
  constructor() {
    this.enabled = false;
    this.context = null;
    this._master = null;
    this._paused = false;
    this._wanted = false;
    this._disposed = false;
    this._generation = 0;
    this._timer = null;
    this._voices = new Set();
    this._step = 0;
    this._nextTime = 0;
    this._lastCue = new Map();
  }

  async toggle() {
    if (this._disposed) return false;
    this._wanted = !this._wanted;
    const generation = ++this._generation;
    if (!this._wanted) {
      this.enabled = false;
      this._silence();
      return false;
    }

    try {
      if (!this.context || this.context.state === 'closed') {
        this._stopVoices(true);
        this._master?.disconnect();
        const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (typeof AudioContextClass !== 'function') throw new Error('Audio unavailable');
        this.context = new AudioContextClass();
        this._master = this.context.createGain();
        this._master.gain.setValueAtTime(0, this.context.currentTime);
        this._master.connect(this.context.destination);
      }
      const context = this.context;
      if (context.state !== 'running') await context.resume();
      // A second click, pause, or disposal can happen while resume is pending.
      if (generation !== this._generation || this._disposed || !this._wanted) {
        return this.enabled;
      }
      if (context.state !== 'running') throw new Error('Audio did not start');
      this.enabled = true;
      if (!this._paused) this._start();
      return true;
    } catch {
      if (generation === this._generation && !this._disposed) {
        this._wanted = false;
        this.enabled = false;
        this._silence();
        await this._releaseContext();
      }
      return false;
    }
  }

  setPaused(paused) {
    if (this._disposed) return;
    this._paused = Boolean(paused);
    if (this._paused) this._silence();
    else if (this.enabled && this._timer === null) this._start();
  }

  cue(name) {
    const cue = Object.hasOwn(CUES, name) ? CUES[name] : null;
    if (!cue || !this.enabled || this._paused || this.context?.state !== 'running') return;
    const now = this.context.currentTime;
    // Rapid tower clicks cannot pile up unbounded sound effects.
    if (now - (this._lastCue.get(name) ?? -Infinity) < 0.09) return;
    this._lastCue.set(name, now);
    cue.notes.forEach((note, index) => {
      this._note(frequency(note), now + 0.01 + index * cue.spacing,
        cue.duration, cue.volume, 'sine', 0.012);
    });
  }

  async dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this._wanted = false;
    this.enabled = false;
    ++this._generation;
    this._stopScheduler();
    this._stopVoices(true);
    this._lastCue.clear();
    await this._releaseContext();
  }

  _start() {
    if (!this.context || this.context.state !== 'running' || this._disposed || this._paused) return;
    this._stopScheduler();
    this._stopVoices(true);
    this._volume(true);
    this._nextTime = this.context.currentTime + 0.05;
    this._tick();
    this._timer = globalThis.setInterval(() => this._tick(), 80);
  }

  _tick() {
    if (!this.enabled || this._paused || this.context?.state !== 'running') return;
    const now = this.context.currentTime;
    // Do not replay missed music in a burst after a background tab wakes up.
    if (this._nextTime < now - LOOK_AHEAD) this._nextTime = now + 0.025;
    for (let count = 0; count < 8 && this._nextTime < now + LOOK_AHEAD; count++) {
      const step = this._step % MELODY.length;
      const note = MELODY[step];
      if (note !== null) {
        this._note(frequency(note), this._nextTime, 1.25, 0.061, 'sine', 0.012);
        this._note(frequency(note + 12), this._nextTime, 0.65, 0.011, 'sine', 0.006);
      }
      if (step % 16 === 0) {
        const chord = HARMONY[Math.floor(step / 16)];
        for (const tone of chord.slice(1)) {
          this._note(frequency(tone), this._nextTime, 5.3, 0.018, 'sine', 0.35);
        }
      }
      if (step % 8 === 0) {
        const bass = HARMONY[Math.floor(step / 16)][0];
        this._note(frequency(bass), this._nextTime, 2.2, 0.056, 'triangle', 0.07);
      }
      this._step++;
      this._nextTime += STEP_SECONDS;
    }
  }

  _note(hertz, start, duration, volume, type, attack) {
    if (!this.context || !this._master || this._voices.size >= MAX_VOICES) return;
    if (![hertz, start, duration, volume, attack].every(Number.isFinite) || hertz <= 0) return;
    start = Math.max(this.context.currentTime, start);
    duration = Math.max(0.08, Math.min(6, duration));
    volume = Math.max(FLOOR, Math.min(0.12, volume));
    attack = Math.max(0.003, Math.min(duration / 2, attack));
    let oscillator;
    let envelope;
    let voice;
    try {
      oscillator = this.context.createOscillator();
      envelope = this.context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(hertz, start);
      envelope.gain.setValueAtTime(FLOOR, start);
      envelope.gain.linearRampToValueAtTime(volume, start + attack);
      envelope.gain.exponentialRampToValueAtTime(FLOOR, start + duration);
      oscillator.connect(envelope);
      envelope.connect(this._master);
      voice = { oscillator, envelope };
      this._voices.add(voice);
      oscillator.onended = () => this._removeVoice(voice);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.025);
    } catch {
      if (voice) this._removeVoice(voice);
      else {
        oscillator?.disconnect();
        envelope?.disconnect();
      }
    }
  }

  _volume(audible) {
    if (!this._master || !this.context || this.context.state === 'closed') return;
    const now = this.context.currentTime;
    this._master.gain.cancelScheduledValues(now);
    this._master.gain.setTargetAtTime(audible ? MASTER_VOLUME : 0, now, 0.018);
  }

  _silence() {
    this._stopScheduler();
    this._volume(false);
    this._stopVoices(false);
  }

  _stopScheduler() {
    if (this._timer !== null) globalThis.clearInterval(this._timer);
    this._timer = null;
  }

  _stopVoices(immediate) {
    const now = this.context?.currentTime ?? 0;
    for (const voice of this._voices) {
      try {
        if (!immediate) {
          voice.envelope.gain.cancelScheduledValues(now);
          voice.envelope.gain.setTargetAtTime(FLOOR, now, 0.01);
        }
        voice.oscillator.stop(immediate ? now : now + 0.05);
      } catch { /* The context or oscillator may already have ended. */ }
      if (immediate || this.context?.state !== 'running') this._removeVoice(voice);
    }
  }

  _removeVoice(voice) {
    voice.oscillator.onended = null;
    voice.oscillator.disconnect();
    voice.envelope.disconnect();
    this._voices.delete(voice);
  }

  async _releaseContext() {
    const context = this.context;
    this.context = null;
    this._stopVoices(true);
    this._master?.disconnect();
    this._master = null;
    if (context && context.state !== 'closed') {
      try { await context.close(); } catch { /* Teardown must remain safe. */ }
    }
  }
}
