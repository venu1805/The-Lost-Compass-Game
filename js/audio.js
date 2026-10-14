/* ==========================================================================
   AUDIO ENGINE - The Lost Compass
   Procedural Web Audio API sound generator & dynamic cinematic music synthesizer
   ========================================================================== */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.ambientGain = null;

    // Music playback state
    this.currentTrack = null;
    this.musicInterval = null;
    this.ambientNodes = [];
    this.activeToneNodes = [];

    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();

      // Master output node
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // SFX Bus
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      // Music Bus
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(0.45, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);

      // Ambient Bus
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      this.ambientGain.connect(this.masterGain);

      this.initialized = true;

      // Ensure audio context resumes on any initial user gesture
      const resumeHandler = () => {
        this.resume();
        window.removeEventListener('click', resumeHandler);
        window.removeEventListener('keydown', resumeHandler);
      };
      window.addEventListener('click', resumeHandler);
      window.addEventListener('keydown', resumeHandler);
    } catch (e) {
      console.warn("Web Audio API not supported or blocked", e);
    }
  }

  resume() {
    if (!this.initialized) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.7, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  /* -------------------------------------------------------------------------
     SOUND EFFECTS GENERATORS
     ------------------------------------------------------------------------- */

  playSwordSwing() {
    if (!this.initialized || this.isMuted) return;
    const now = this.ctx.currentTime;
    
    // White noise swoosh with highpass filter sweep
    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(2600, now + 0.08);
    filter.frequency.exponentialRampToValueAtTime(400, now + 0.15);
    filter.Q.setValueAtTime(3.0, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.6, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(now);
    noise.stop(now + 0.16);
  }

  playSwordClash() {
    if (!this.initialized || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Metallic chime ringing + short transient impact
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sine';

    osc1.frequency.setValueAtTime(1480, now);
    osc1.frequency.exponentialRampToValueAtTime(1120, now + 0.35);

    osc2.frequency.setValueAtTime(2890, now);
    osc2.frequency.exponentialRampToValueAtTime(2200, now + 0.35);

    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.45);
    osc2.stop(now + 0.45);

    this.playNoiseBurst(0.06, 0.5, 3000);
  }

  playPistolShot() {
    if (!this.initialized || this.isMuted) return;
    const now = this.ctx.currentTime;

    // 1. Initial gunpowder explosive crack (filtered noise)
    this.playNoiseBurst(0.25, 0.8, 1200);

    // 2. Low-frequency punch
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.2);

    gain.gain.setValueAtTime(0.9, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  playCannonFire() {
    if (!this.initialized || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Heavy booming explosion
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(22, now + 0.6);

    gain.gain.setValueAtTime(1.0, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.75);

    this.playNoiseBurst(0.7, 0.9, 600);
  }

  playNoiseBurst(duration, initialGain, cutoffFreq) {
    if (!this.initialized || this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoffFreq, now);
    filter.frequency.exponentialRampToValueAtTime(120, now + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(initialGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(now);
    noise.stop(now + duration + 0.05);
  }

  playJump() {
    if (!this.initialized || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(360, now + 0.15);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  playLand() {
    if (!this.initialized || this.isMuted) return;
    this.playNoiseBurst(0.08, 0.4, 400);
  }

  playFootstep() {
    if (!this.initialized || this.isMuted) return;
    this.playNoiseBurst(0.04, 0.15, 600);
  }

  playSplash() {
    if (!this.initialized || this.isMuted) return;
    this.playNoiseBurst(0.35, 0.5, 1400);
  }

  playCompassTone() {
    if (!this.initialized || this.isMuted) return;
    const now = this.ctx.currentTime;
    
    // Ethereal mystical chord (C# minor / E major mystical resonance)
    const freqs = [554.37, 659.25, 830.61, 1108.73];
    freqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.04);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.25 / freqs.length, now + idx * 0.04 + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now + idx * 0.04);
      osc.stop(now + 1.3);
    });
  }

  playCoin() {
    if (!this.initialized || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(987.77, now); // B5
    osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  playChestOpen() {
    if (!this.initialized || this.isMuted) return;
    const now = this.ctx.currentTime;
    [440, 554.37, 659.25, 880].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.3, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.4);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.45);
    });
  }

  playHurt() {
    if (!this.initialized || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.2);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.28);
  }

  playThunder() {
    if (!this.initialized || this.isMuted) return;
    this.playNoiseBurst(1.8, 0.9, 300);
  }

  /* -------------------------------------------------------------------------
     DYNAMIC CINEMATIC SOUNDTRACK SYNTHESIS
     ------------------------------------------------------------------------- */

  playLevelMusic(levelIndex) {
    if (!this.initialized) return;
    if (this.currentTrack === levelIndex) return;
    this.stopMusic();
    this.currentTrack = levelIndex;

    switch (levelIndex) {
      case 1: // The Storm & Theft (Dramatic Minor Ostinato & Storm Winds)
        this.startStormTheme();
        break;
      case 2: // The Hidden Island (Tropical Mystery Flute / Plucks)
        this.startIslandTheme();
        break;
      case 3: // Port Royale Town (Pirate Sea Shanty Tavern Waltz)
        this.startTavernShantyTheme();
        break;
      case 4: // Naval Battle (War Drums & Heroic Horns)
        this.startNavalBattleTheme();
        break;
      case 5: // The Cursed Caves (Bioluminescent Spectral Cavern Reverb)
        this.startCursedCaveTheme();
        break;
      case 6: // Naval Prison Escape
      case 7: // Ghost Lighthouse
      case 12: // Haunted Bay
      case 14: // Tempest Crossing
        this.startStormTheme();
        break;
      case 8: // Shattered Reef
      case 9: // Drowned Galleon
      case 11: // Leviathan of the Deep
        this.startCursedCaveTheme();
        break;
      case 10: // Smugglers' Port
      case 13: // The Lost Fleet
        this.startTavernShantyTheme();
        break;
      case 15: // The Final Treasure (Epic Golden Climax & Davy Jones Style Organ)
        this.startFinalTreasureTheme();
        break;
      default:
        this.startTavernShantyTheme();
    }
  }

  stopMusic() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    this.activeToneNodes.forEach(n => {
      try { n.stop(); } catch(e) {}
    });
    this.activeToneNodes = [];
    this.ambientNodes.forEach(n => {
      try { n.stop(); } catch(e) {}
    });
    this.ambientNodes = [];
  }

  // Level 1: Storm & Sinking Galleon
  startStormTheme() {
    const notes = [110, 110, 130.81, 146.83, 110, 110, 164.81, 146.83]; // A2, C3, D3, E3
    let step = 0;
    this.musicInterval = setInterval(() => {
      if (this.isMuted) return;
      const freq = notes[step % notes.length];
      this.playSynthBass(freq, 0.35, 'sawtooth', 0.2);
      if (step % 2 === 0) {
        this.playSynthLead(freq * 2, 0.25, 'triangle', 0.15);
      }
      step++;
    }, 280);
  }

  // Level 2: Island Jungle / Ancient Ruins
  startIslandTheme() {
    // Pentatonic mystery melody (D minor pentatonic: D, F, G, A, C)
    const melody = [293.66, 349.23, 392.00, 440.00, 523.25, 440.00, 392.00, 349.23];
    let step = 0;
    this.musicInterval = setInterval(() => {
      if (this.isMuted) return;
      if (step % 2 === 0) {
        const note = melody[Math.floor(Math.random() * melody.length)];
        this.playPluck(note, 0.6, 0.18);
      }
      if (step % 4 === 0) {
        this.playPluck(146.83, 0.8, 0.22); // D3 Drone
      }
      step++;
    }, 380);
  }

  // Level 3: Port Royale Sea Shanty / Accordion 6/8 time
  startTavernShantyTheme() {
    // Classic swashbuckling 3/4 shanty waltz in D minor
    const chords = [
      { bass: 146.83, lead: [293.66, 349.23, 440.0] }, // Dm
      { bass: 130.81, lead: [261.63, 329.63, 392.0] }, // C
      { bass: 116.54, lead: [233.08, 293.66, 349.23] }, // Bb
      { bass: 110.00, lead: [220.00, 277.18, 329.63] }  // A
    ];
    let chordIdx = 0;
    let beat = 0;
    this.musicInterval = setInterval(() => {
      if (this.isMuted) return;
      const current = chords[chordIdx];
      if (beat === 0) {
        // Bass hit
        this.playSynthBass(current.bass, 0.45, 'triangle', 0.3);
      } else {
        // Accordion chord strum
        current.lead.forEach(f => this.playSynthLead(f, 0.25, 'sawtooth', 0.12));
      }
      beat = (beat + 1) % 3;
      if (beat === 0) {
        chordIdx = (chordIdx + 1) % chords.length;
      }
    }, 260);
  }

  // Level 4: Naval Battle War Anthem
  startNavalBattleTheme() {
    // Powerful marching rhythm
    const warNotes = [110, 110, 110, 138.59, 146.83, 146.83, 130.81, 110];
    let step = 0;
    this.musicInterval = setInterval(() => {
      if (this.isMuted) return;
      const freq = warNotes[step % warNotes.length];
      this.playSynthBass(freq, 0.3, 'sawtooth', 0.35);
      // Brass horn fanfare on accents
      if (step % 4 === 0) {
        this.playSynthLead(freq * 3, 0.5, 'sawtooth', 0.25);
      }
      step++;
    }, 220);
  }

  // Level 5: The Cursed Caves / Submerged Grotto
  startCursedCaveTheme() {
    // Eerie ambient crystal tones & deep water drone
    const eerieTones = [220, 261.63, 311.13, 370.00, 415.30];
    let step = 0;
    this.musicInterval = setInterval(() => {
      if (this.isMuted) return;
      if (step % 2 === 0) {
        const tone = eerieTones[Math.floor(Math.random() * eerieTones.length)];
        this.playPluck(tone, 1.2, 0.14);
      }
      step++;
    }, 500);
  }

  // Level 6: The Final Treasure / Aztec Temple Climax
  startFinalTreasureTheme() {
    // Majestic, triumphant, dramatic minor-to-major epic chords
    const chords = [
      [220, 261.63, 329.63, 440], // Am
      [174.61, 220, 261.63, 349.23], // F
      [130.81, 164.81, 196, 261.63], // C
      [196, 246.94, 293.66, 392]  // G
    ];
    let idx = 0;
    this.musicInterval = setInterval(() => {
      if (this.isMuted) return;
      const c = chords[idx % chords.length];
      this.playSynthBass(c[0] / 2, 0.8, 'triangle', 0.35);
      c.forEach(f => this.playSynthLead(f, 0.7, 'sine', 0.16));
      idx++;
    }, 650);
  }

  /* -------------------------------------------------------------------------
     SYNTHESIZER VOICES
     ------------------------------------------------------------------------- */

  playSynthBass(freq, duration, type = 'sawtooth', gainLevel = 0.25) {
    if (!this.initialized || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(100, now + duration);

    gain.gain.setValueAtTime(gainLevel, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  playSynthLead(freq, duration, type = 'sawtooth', gainLevel = 0.15) {
    if (!this.initialized || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(gainLevel, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.musicGain);

    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  playPluck(freq, duration, gainLevel = 0.2) {
    if (!this.initialized || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(gainLevel, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.musicGain);

    osc.start(now);
    osc.stop(now + duration + 0.05);
  }
}

// Global Audio Instance
window.soundEngine = new SoundEngine();
