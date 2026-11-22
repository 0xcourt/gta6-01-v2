// Solmar Heat — synthesized sound: a WebAudio radio loop plus effects.
// No audio files anywhere: the music is a bassline and a plucked lead over a
// kick, all oscillators, and every effect is a short oscillator or noise
// burst. Everything is guarded so the game still runs (silently) where
// WebAudio is unavailable, and nothing starts until the player interacts.

const STATIONS = [
  {
    name: 'SOLMAR FM',
    bpm: 96,
    // Am — F — C — G, one bar each, bass roots in Hz.
    bass: [55.0, 43.65, 65.41, 49.0],
    lead: [220.0, 261.63, 329.63, 392.0, 440.0, 329.63, 261.63, 196.0],
  },
  {
    name: 'PALM WAVE',
    bpm: 112,
    bass: [65.41, 55.0, 49.0, 58.27],
    lead: [261.63, 329.63, 392.0, 493.88, 440.0, 392.0, 329.63, 261.63],
  },
];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.station = 0;
    this.musicTimer = null;
    this.step = 0;
    this.nextNoteTime = 0;
    this.sirenOn = false;
    this.sirenNodes = null;
  }

  get available() {
    return typeof window !== 'undefined'
      && (typeof window.AudioContext !== 'undefined' || typeof window.webkitAudioContext !== 'undefined');
  }

  // Create the context on first user gesture; safe to call repeatedly.
  ensure() {
    if (this.ctx || !this.available) return false;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.startMusic();
      return true;
    } catch (err) {
      this.ctx = null;
      return false;
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setValueAtTime(muted ? 0 : 0.5, this.ctx.currentTime);
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  nextStation() {
    this.station = (this.station + 1) % STATIONS.length;
    return STATIONS[this.station].name;
  }

  get stationName() {
    return STATIONS[this.station].name;
  }

  // --- music scheduler -----------------------------------------------------
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.musicTimer = setInterval(() => this.scheduleAhead(), 120);
  }

  scheduleAhead() {
    if (!this.ctx) return;
    const station = STATIONS[this.station];
    const stepDur = 60 / station.bpm / 2; // eighth notes
    while (this.nextNoteTime < this.ctx.currentTime + 0.35) {
      const t = this.nextNoteTime;
      const bar = Math.floor(this.step / 8) % 4;
      const inBar = this.step % 8;
      if (this.step % 2 === 0) this.kick(t);
      if (inBar === 0) this.bassNote(t, station.bass[bar], stepDur * 7);
      if (this.step % 2 === 1) {
        const note = station.lead[(this.step * 3 + bar) % station.lead.length];
        this.pluck(t, note, stepDur * 1.8);
      }
      this.nextNoteTime += stepDur;
      this.step += 1;
    }
  }

  kick(t) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  bassNote(t, freq, dur) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.32, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur);
  }

  pluck(t, freq, dur) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur);
  }

  // --- one-shot effects ----------------------------------------------------
  blip(freq, dur, type = 'sine', volume = 0.3, slideTo = null) {
    if (!this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      gain.gain.setValueAtTime(volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + dur);
    } catch (err) { /* silent fallback */ }
  }

  noiseBurst(dur, volume = 0.35, lowpass = 1200) {
    if (!this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t);
    } catch (err) { /* silent fallback */ }
  }

  playShoot() {
    this.noiseBurst(0.12, 0.5, 2400);
    this.blip(180, 0.08, 'square', 0.2, 60);
  }

  playPunch() {
    this.blip(90, 0.12, 'sine', 0.4, 45);
  }

  playPickup() {
    this.blip(660, 0.09, 'sine', 0.25);
    setTimeout(() => this.blip(880, 0.12, 'sine', 0.25), 90);
  }

  playCrash() {
    this.noiseBurst(0.3, 0.5, 700);
    this.blip(70, 0.25, 'sawtooth', 0.3, 35);
  }

  playClick() {
    this.blip(1200, 0.05, 'sine', 0.15);
  }

  playSirenBlip() {
    this.blip(750, 0.28, 'sine', 0.12, 950);
    setTimeout(() => this.blip(950, 0.28, 'sine', 0.12, 750), 300);
  }

  playGameOver() {
    this.blip(392, 0.3, 'triangle', 0.3, 196);
    setTimeout(() => this.blip(311, 0.4, 'triangle', 0.3, 155), 300);
  }

  playWin() {
    [523, 659, 784, 1046].forEach((f, i) => {
      setTimeout(() => this.blip(f, 0.35, 'triangle', 0.3), i * 160);
    });
  }
}
