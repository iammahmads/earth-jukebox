/**
 * Earth Jukebox — Advanced Sonification Engine v4 (audio.js)
 * NASA Space Apps 2026
 *
 * 5 Distinct Synthesis Personas:
 *   story-1-seasonal  → Ethereal AM Flute Synthesis + Reverb (Harmonic orbital cycle)
 *   story-2-trend     → FM Synth Slow Drift + Ping-Pong Delay (Warming decadal shift)
 *   story-3-event     → Distorted MonoSynth + EQ + Distortion (2021 PNW Heat Dome Crisis)
 *   story-4-amazon    → Lush PolySynth Rain Pad + Chorus + Reverb (Amazon Rainfall Pulse)
 *   story-5-australia → Resonant Sawtooth Wildfire Lead + Fast Filter (2019–20 Black Summer)
 *
 * Applied Scientific Utility Additions:
 *   - Binaural Era Comparator: Left Ear (Baseline) vs Right Ear (Current Anomaly)
 *   - Acoustic Anomaly Ping for Rapid Climate Screening
 *   - Master Limiter & High-Gain Output for crisp, loud sonification
 */

// ─── Pure Mapping Functions (testable with Node.js) ─────────────────────────

const MIN_MIDI = 48;  // C3 (~130.8 Hz)
const MAX_MIDI = 84;  // C6 (~1046.5 Hz)
const MIN_BPM  = 60;
const MAX_BPM  = 160;

function pitchForValue(value, storyData) {
  if (!storyData || storyData.min === undefined) return 60;
  const { min, max } = storyData;
  if (max === min) return Math.round((MIN_MIDI + MAX_MIDI) / 2);
  const t = (Math.max(min, Math.min(max, value)) - min) / (max - min);
  return Math.round(MIN_MIDI + t * (MAX_MIDI - MIN_MIDI));
}

function timbreForSpread(spread, maxSpread = 10) {
  if (!spread || maxSpread <= 0) return 'sine';
  const r = Math.min(1, Math.max(0, spread / maxSpread));
  if (r < 0.33) return 'sine';
  if (r < 0.66) return 'triangle';
  return 'sawtooth';
}

function tempoForDelta(delta, maxDelta = 5) {
  if (!delta || maxDelta <= 0) return MIN_BPM;
  const r = Math.min(1, Math.max(0, Math.abs(delta) / maxDelta));
  return Math.round(MIN_BPM + r * (MAX_BPM - MIN_BPM));
}

function panForLongitude(lon) {
  if (lon == null || isNaN(lon)) return 0;
  return Math.max(-1, Math.min(1, lon / 180));
}

function isThresholdCrossing(currFrame, prevFrame, storyData) {
  if (!storyData || !currFrame) return false;
  if (storyData.threshold_date && currFrame.date === storyData.threshold_date) return true;
  const thresh = storyData.threshold;
  if (thresh !== null && thresh !== undefined) {
    if (prevFrame) return prevFrame.value < thresh && currFrame.value >= thresh;
    return currFrame.value >= thresh;
  }
  return false;
}

// ─── Story Audio Personality Profiles ────────────────────────────────────────

const STORY_PROFILES = {
  'story-1-seasonal': {
    buildSynth: (chain) => {
      const synth = new Tone.AMSynth({
        harmonicity: 2.5,
        oscillator: { type: 'sine' },
        modulation: { type: 'triangle' },
        modulationEnvelope: { attack: 0.1, decay: 0.1, sustain: 0.7, release: 0.8 },
        envelope: { attack: 0.08, decay: 0.1, sustain: 0.8, release: 1.0 }
      });
      synth.volume.value = 2;
      const chorus = new Tone.Chorus(2.5, 2.5, 0.4).start();
      const reverb = new Tone.Reverb({ decay: 2.5, wet: 0.35 });
      synth.chain(chorus, reverb, chain);
      return { synth, effects: [chorus, reverb] };
    },
    ambientNote: 'C3',
    ambientType: 'sine',
    noteLength: '8n',
    color: '#38bdf8',
    label: 'AM Flute Synthesis'
  },

  'story-2-trend': {
    buildSynth: (chain) => {
      const synth = new Tone.FMSynth({
        harmonicity: 1.5,
        modulationIndex: 3.5,
        oscillator: { type: 'triangle' },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.2, decay: 0.0, sustain: 1.0, release: 0.5 },
        envelope: { attack: 0.08, decay: 0.1, sustain: 0.9, release: 1.2 }
      });
      synth.volume.value = 3;
      const delay  = new Tone.PingPongDelay({ delayTime: '8n', feedback: 0.25, wet: 0.25 });
      const reverb = new Tone.Reverb({ decay: 2.0, wet: 0.25 });
      const filter = new Tone.Filter(2800, 'lowpass');
      synth.chain(filter, delay, reverb, chain);
      return { synth, effects: [delay, reverb, filter] };
    },
    ambientNote: 'E3',
    ambientType: 'triangle',
    noteLength: '4n',
    color: '#f59e0b',
    label: 'FM Drift Synthesis'
  },

  'story-3-event': {
    buildSynth: (chain) => {
      const synth = new Tone.MonoSynth({
        oscillator: { type: 'sawtooth' },
        filter: { type: 'lowpass', Q: 4.5 },
        filterEnvelope: { attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.7, baseFrequency: 500, octaves: 3 },
        envelope: { attack: 0.01, decay: 0.08, sustain: 0.85, release: 0.5 }
      });
      synth.volume.value = 4;
      const distort = new Tone.Distortion(0.22);
      const reverb  = new Tone.Reverb({ decay: 1.2, wet: 0.2 });
      const eq      = new Tone.EQ3({ low: -2, mid: 3, high: 4 });
      synth.chain(distort, eq, reverb, chain);
      return { synth, effects: [distort, reverb, eq] };
    },
    ambientNote: 'G2',
    ambientType: 'sawtooth',
    noteLength: '16n',
    color: '#ef4444',
    label: 'Crisis Distortion Synthesis'
  },

  'story-4-amazon': {
    buildSynth: (chain) => {
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.12, decay: 0.2, sustain: 0.8, release: 1.2 }
      });
      synth.volume.value = 3;
      const chorus = new Tone.Chorus(1.5, 3.5, 0.5).start();
      const reverb = new Tone.Reverb({ decay: 3.5, wet: 0.4 });
      synth.chain(chorus, reverb, chain);
      return { synth, effects: [chorus, reverb] };
    },
    ambientNote: 'F2',
    ambientType: 'sine',
    noteLength: '8n',
    color: '#10b981',
    label: 'Rain Pad Synthesis'
  },

  'story-5-australia': {
    buildSynth: (chain) => {
      const synth = new Tone.MonoSynth({
        oscillator: { type: 'sawtooth' },
        filter: { type: 'bandpass', Q: 3 },
        filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.6, baseFrequency: 600, octaves: 2.5 },
        envelope: { attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.5 }
      });
      synth.volume.value = 4;
      const delay  = new Tone.FeedbackDelay({ delayTime: '16n', feedback: 0.3, wet: 0.25 });
      const distort = new Tone.Distortion(0.28);
      synth.chain(distort, delay, chain);
      return { synth, effects: [delay, distort] };
    },
    ambientNote: 'D2',
    ambientType: 'sawtooth',
    noteLength: '16n',
    color: '#a855f7',
    label: 'Wildfire Lead Synthesis'
  }
};

// ─── Browser AudioEngine ─────────────────────────────────────────────────────

const AudioEngine = (() => {
  let ready = false;
  let isPlaying = false;
  let playbackTimer = null;
  let playbackRate = 1.0;
  let maxDelta = 1.0;
  let maxSpread = 1.0;
  let currentStory = null;
  let currentProfile = null;
  let frameIndex = 0;

  // Master bus
  let masterVol    = null;
  let limiter      = null;
  let panner       = null;
  let synthCtx     = null;
  let ambientOsc   = null;
  let markerBell   = null;
  let markerNoise  = null;
  let anomalyPing  = null;
  let analyserNode = null;

  // Binaural Comparator synths (Left = Era A baseline, Right = Era B anomaly)
  let binauralLeftPan   = null;
  let binauralRightPan  = null;
  let binauralLeftSynth = null;
  let binauralRightSynth= null;

  // Callbacks
  let onFrameCb     = null;
  let onStateCb     = null;
  let onThresholdCb = null;

  async function ensureInit() {
    if (ready) return;
    if (typeof Tone === 'undefined') {
      console.warn('Tone.js is not loaded yet.');
      return;
    }

    await Tone.start();

    // Limiter -> Master Volume
    limiter = new Tone.Limiter(-0.5).toDestination();
    masterVol = new Tone.Volume(4).connect(limiter);

    // Native AnalyserNode for 60fps canvas oscilloscope
    analyserNode = Tone.getContext().rawContext.createAnalyser();
    analyserNode.fftSize = 512;
    Tone.getDestination().connect(analyserNode);

    // Primary Panner
    panner = new Tone.Panner(0).connect(masterVol);

    // Layered Alert System: Bell + Noise
    markerBell = new Tone.MetalSynth({
      frequency: 440,
      envelope: { attack: 0.001, decay: 1.2, release: 0.2 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5
    }).connect(masterVol);
    markerBell.volume.value = 2;

    markerNoise = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.005, decay: 0.16, sustain: 0, release: 0.1 }
    }).connect(masterVol);
    markerNoise.volume.value = -4;

    // Acoustic Anomaly Screening Ping (high-frequency clean sonar ping)
    anomalyPing = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.005, decay: 0.25, sustain: 0.0, release: 0.1 }
    }).connect(masterVol);
    anomalyPing.volume.value = 1;

    // Binaural Era Comparator Synths (Hard Left vs Hard Right)
    binauralLeftPan = new Tone.Panner(-0.85).connect(masterVol);
    binauralRightPan = new Tone.Panner(0.85).connect(masterVol);

    binauralLeftSynth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.05, decay: 0.1, sustain: 0.8, release: 0.4 }
    }).connect(binauralLeftPan);
    binauralLeftSynth.volume.value = 1;

    binauralRightSynth = new Tone.Synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.05, decay: 0.1, sustain: 0.8, release: 0.4 }
    }).connect(binauralRightPan);
    binauralRightSynth.volume.value = 1;

    ready = true;
    console.log('AudioEngine v4 initialized with Binaural Comparator and Anomaly Sonar.');
  }

  function buildStoryProfile(storyId) {
    if (synthCtx) {
      try {
        synthCtx.synth.dispose();
        synthCtx.effects.forEach(e => e.dispose());
      } catch (_) {}
      synthCtx = null;
    }
    if (ambientOsc) {
      try { ambientOsc.dispose(); } catch (_) {}
      ambientOsc = null;
    }

    const profile = STORY_PROFILES[storyId] || STORY_PROFILES['story-1-seasonal'];
    currentProfile = profile;
    synthCtx = profile.buildSynth(panner);

    ambientOsc = new Tone.Synth({
      oscillator: { type: profile.ambientType },
      envelope: { attack: 2.0, decay: 0.1, sustain: 1.0, release: 3.0 }
    });
    const ambientReverb = new Tone.Reverb({ decay: 4, wet: 0.7 });
    const ambientVol    = new Tone.Volume(-22);
    ambientOsc.chain(ambientReverb, ambientVol, masterVol);
    ambientOsc.triggerAttack(profile.ambientNote);
  }

  function setStory(storyData) {
    pause();
    currentStory = storyData;
    frameIndex = 0;

    if (!storyData || !storyData.frames || !storyData.frames.length) return;

    let mxDelta = 0.1, mxSpread = 0.1;
    for (let i = 0; i < storyData.frames.length; i++) {
      const f = storyData.frames[i];
      if (f.spread > mxSpread) mxSpread = f.spread;
      if (i > 0) {
        const d = Math.abs(f.value - storyData.frames[i-1].value);
        if (d > mxDelta) mxDelta = d;
      }
    }
    maxDelta = mxDelta;
    maxSpread = mxSpread;

    if (ready && panner && storyData.area && storyData.area.bbox) {
      const lon = (storyData.area.bbox[0] + storyData.area.bbox[2]) / 2;
      panner.pan.rampTo(panForLongitude(lon), 0.5);
    }

    if (ready) {
      buildStoryProfile(storyData.story_id);
    }

    if (onFrameCb) onFrameCb(0, storyData.frames[0]);
  }

  function playFrame(frame, prevFrame) {
    if (!ready || !synthCtx) return;

    const midi = pitchForValue(frame.value, currentStory);
    const note = Tone.Frequency(midi, 'midi').toNote();
    const noteLen = currentProfile ? currentProfile.noteLength : '8n';

    const timbre = timbreForSpread(frame.spread, maxSpread);
    try {
      if (synthCtx.synth.oscillator) {
        synthCtx.synth.oscillator.type = timbre;
      }
    } catch (_) {}

    if (isThresholdCrossing(frame, prevFrame, currentStory)) {
      if (markerBell)  markerBell.triggerAttackRelease('C5', '4n');
      if (markerNoise) markerNoise.triggerAttackRelease('16n');
      if (onThresholdCb) onThresholdCb(frame);
    }

    try {
      synthCtx.synth.triggerAttackRelease(note, noteLen);
    } catch (_) {}

    if (ambientOsc && currentProfile) {
      const t = (frame.value - currentStory.min) / ((currentStory.max - currentStory.min) || 1);
      const baseFreq = Tone.Frequency(currentProfile.ambientNote).toFrequency();
      const targetFreq = baseFreq * (1 + t * 0.45);
      ambientOsc.frequency.rampTo(targetFreq, 1.2);
    }
  }

  function step() {
    if (!isPlaying || !currentStory) return;
    if (frameIndex >= currentStory.frames.length) {
      pause();
      frameIndex = 0;
      if (onFrameCb) onFrameCb(0, currentStory.frames[0]);
      return;
    }

    const frame     = currentStory.frames[frameIndex];
    const prevFrame = frameIndex > 0 ? currentStory.frames[frameIndex - 1] : null;

    playFrame(frame, prevFrame);
    if (onFrameCb) onFrameCb(frameIndex, frame);

    const delta = prevFrame ? Math.abs(frame.value - prevFrame.value) : 0;
    const bpm   = tempoForDelta(delta, maxDelta);
    const ms = Math.max(75, Math.min(850, (60000 / bpm) / (playbackRate * 2.5)));

    frameIndex++;
    playbackTimer = setTimeout(step, ms);
  }

  async function play() {
    await ensureInit();
    if (!synthCtx && currentStory) {
      buildStoryProfile(currentStory.story_id);
    }
    if (isPlaying) return;
    isPlaying = true;
    if (onStateCb) onStateCb(true);
    step();
  }

  function pause() {
    isPlaying = false;
    clearTimeout(playbackTimer);
    playbackTimer = null;
    if (onStateCb) onStateCb(false);
  }

  async function seek(index) {
    if (!currentStory || !currentStory.frames.length) return;
    frameIndex = Math.max(0, Math.min(currentStory.frames.length - 1, index));
    const frame = currentStory.frames[frameIndex];
    const prev  = frameIndex > 0 ? currentStory.frames[frameIndex - 1] : null;
    if (onFrameCb) onFrameCb(frameIndex, frame);
    if (ready) playFrame(frame, prev);
  }

  function setRate(r) {
    playbackRate = Math.max(0.25, Math.min(4.0, parseFloat(r) || 1.0));
  }

  function setVolume(db) {
    if (masterVol) {
      masterVol.volume.rampTo(parseFloat(db), 0.05);
    }
  }

  async function playSample(level) {
    await ensureInit();
    if (!synthCtx) {
      buildStoryProfile(currentStory ? currentStory.story_id : 'story-1-seasonal');
    }
    if (!ready) return;

    if (level === 'marker') {
      if (markerBell)  markerBell.triggerAttackRelease('C5', '4n');
      if (markerNoise) markerNoise.triggerAttackRelease('16n');
      return;
    }

    if (level === 'anomaly') {
      if (anomalyPing) anomalyPing.triggerAttackRelease('E6', '16n');
      return;
    }

    const midiMap = {
      low: MIN_MIDI,
      mid: Math.round((MIN_MIDI + MAX_MIDI) / 2),
      high: MAX_MIDI
    };
    const note = Tone.Frequency(midiMap[level] || 66, 'midi').toNote();
    if (synthCtx && synthCtx.synth) {
      synthCtx.synth.triggerAttackRelease(note, '4n');
    }
  }

  /**
   * Binaural Era Comparator: Plays valA in Left Ear and valB in Right Ear simultaneously.
   * If valA == valB, listener hears pure acoustic unison.
   * If valB differs, listener hears acoustic beating / harmonic divergence.
   */
  async function playBinauralComparison(valA, valB, storyData) {
    await ensureInit();
    if (!ready || !binauralLeftSynth || !binauralRightSynth) return;

    const midiA = pitchForValue(valA, storyData);
    const midiB = pitchForValue(valB, storyData);

    const noteA = Tone.Frequency(midiA, 'midi').toNote();
    const noteB = Tone.Frequency(midiB, 'midi').toNote();

    binauralLeftSynth.triggerAttackRelease(noteA, '2n');
    binauralRightSynth.triggerAttackRelease(noteB, '2n');
  }

  /**
   * Fires an alert sonar ping for anomaly screening.
   */
  async function triggerAnomalySonar(pitchMidi = 88) {
    await ensureInit();
    if (!ready || !anomalyPing) return;
    const note = Tone.Frequency(pitchMidi, 'midi').toNote();
    anomalyPing.triggerAttackRelease(note, '16n');
  }

  function getWaveformData() {
    if (!analyserNode) return null;
    const buf = new Float32Array(analyserNode.frequencyBinCount);
    analyserNode.getFloatTimeDomainData(buf);
    return buf;
  }

  function dispose() {
    pause();
    currentStory = null;
    frameIndex = 0;
  }

  return {
    ensureInit,
    setStory,
    play,
    pause,
    seek,
    setRate,
    setVolume,
    playSample,
    playBinauralComparison,
    triggerAnomalySonar,
    dispose,
    getWaveformData,
    get isPlaying()    { return isPlaying; },
    get currentIndex() { return frameIndex; },
    set onFrame(cb)     { onFrameCb = cb; },
    set onStateChange(cb) { onStateCb = cb; },
    set onThreshold(cb)   { onThresholdCb = cb; }
  };
})();

// Node.js exports (for test runner)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    pitchForValue,
    timbreForSpread,
    tempoForDelta,
    panForLongitude,
    isThresholdCrossing,
    MIN_MIDI,
    MAX_MIDI,
    MIN_BPM,
    MAX_BPM
  };
}

// Browser window exports
if (typeof window !== 'undefined') {
  Object.assign(window, {
    AudioEngine,
    pitchForValue,
    timbreForSpread,
    tempoForDelta,
    panForLongitude,
    isThresholdCrossing
  });
}
