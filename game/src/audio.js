// Solmar Heat — audio: all sound is synthesized with WebAudio. A small
// step-sequencer plays a warm synthwave radio loop; SFX are short oscillators/noise.
export function createAudio() {
  let ctx = null; let master = null; let musicGain = null; let sfxGain = null;
  let muted = false; let musicTimer = null; let step = 0; let started = false;
  const CHORDS = [
    [220.0, 261.6, 329.6], [174.6, 220.0, 261.6], [196.0, 246.9, 293.7], [146.8, 220.0, 293.7],
  ];
  const BASS = [55, 43.65, 49, 36.71];
  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
      sfxGain = ctx.createGain(); sfxGain.gain.value = 0.5; sfxGain.connect(master);
      return true;
    } catch { return false; }
  }
  function tone(freq, dur, type, vol, when = 0, dest) {
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || sfxGain);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(dur, vol, filterFreq) {
    if (!ctx) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(sfxGain); src.start();
  }
  function playStep() {
    if (!ctx || muted) return;
    const chord = CHORDS[Math.floor(step / 8) % CHORDS.length];
    const bass = BASS[Math.floor(step / 8) % BASS.length];
    if (step % 2 === 0) tone(bass, 0.42, 'triangle', 0.5, 0, musicGain);
    if (step % 4 === 0) chord.forEach((f) => tone(f, 0.9, 'sawtooth', 0.05, 0, musicGain));
    if (step % 8 === 6) tone(chord[2] * 2, 0.3, 'square', 0.06, 0, musicGain);
    if (step % 4 === 2) noise(0.06, 0.12, 6000); // hat
    if (step % 8 === 0) noise(0.18, 0.25, 300); // kick-ish thump
    step = (step + 1) % 64;
  }
  return {
    get muted() { return muted; },
    unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); },
    startMusic() {
      if (started || !ensure()) return;
      started = true;
      musicTimer = setInterval(playStep, 210);
    },
    stopMusic() { if (musicTimer) clearInterval(musicTimer); musicTimer = null; started = false; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.9;
      return muted;
    },
    sfx(name) {
      if (!ensure() || muted) return;
      if (name === 'shoot') { tone(880, 0.12, 'square', 0.25); noise(0.08, 0.3, 2500); }
      else if (name === 'punch') { noise(0.1, 0.4, 500); tone(120, 0.1, 'sine', 0.4); }
      else if (name === 'coin') { tone(988, 0.1, 'sine', 0.3); tone(1319, 0.22, 'sine', 0.3, 0.09); }
      else if (name === 'car') { tone(180, 0.3, 'sawtooth', 0.2); tone(360, 0.3, 'sawtooth', 0.12, 0.1); }
      else if (name === 'siren') { tone(700, 0.4, 'sine', 0.16); tone(950, 0.4, 'sine', 0.16, 0.4); }
      else if (name === 'crash') { noise(0.25, 0.5, 900); tone(90, 0.25, 'sine', 0.4); }
      else if (name === 'click') { tone(1200, 0.05, 'square', 0.15); }
      else if (name === 'mission') { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.25, i * 0.11)); }
      else if (name === 'hurt') { tone(160, 0.2, 'sawtooth', 0.3); }
      else if (name === 'wave') { noise(0.5, 0.1, 800); }
    },
  };
}
