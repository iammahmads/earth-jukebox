/**
 * Earth Jukebox — Advanced Sonification Engine v2 (audio.js)
 * NASA Space Apps 2026
 *
 * Per-story tonal personalities:
 *   story-1-seasonal  → Ethereal flute-like AM synth + reverb (cool/natural)
 *   story-2-trend     → FM synth slow harmonic drone (warming, rising)
 *   story-3-event     → Distorted lead + multi-layer alert system (crisis/alarm)
 *
 * Sound dimensions:
 *   Value       → Pitch   (MIDI 48 C3 → 84 C6, linear, pure function)
 *   Spread      → Timbre  (Sine → Triangle → Sawtooth)
 *   |Δ value|   → Tempo   (60 BPM → 160 BPM)
 *   Threshold   → Alert   (layered alarm, bell + noise burst + flash)
 *   Longitude   → Pan     (−1.0 to +1.0)
 */

// ─── Pure Mapping Functions (testable with Node.js) ─────────────────────────

const MIN_MIDI = 48;  // C3
const MAX_MIDI = 84;  // C6
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
    // Flute-like AM synthesis — cool, harmonic, airy. Fits ocean/seasonal.
    buildSynth: (chain) => {
      const synth = new Tone.AMSynth({
        harmonicity: 2.5,
        oscillator: { type: 'sine' },
        modulation: { type: 'triangle' },
        modulationEnvelope: { attack: 0.3, decay: 0.1, sustain: 0.5, release: 0.8 },
        envelope: { attack: 0.15, decay: 0.1, sustain: 0.7, release: 1.2 }
      });
      const chorus = new Tone.Chorus(2.5, 2.5, 0.4).start();
      const reverb  = new Tone.Reverb({ decay: 3.5, wet: 0.45 });
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
    // FM synthesis with slow modulation — warm, slightly dissonant drone. Fits warming trend.
    buildSynth: (chain) => {
      const synth = new Tone.FMSynth({
        harmonicity: 1.5,
        modulationIndex: 3,
        oscillator: { type: 'triangle' },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.5, decay: 0.0, sustain: 1.0, release: 0.5 },
        envelope: { attack: 0.2, decay: 0.0, sustain: 0.9, release: 1.5 }
      });
      const delay  = new Tone.PingPongDelay({ delayTime: '8n', feedback: 0.25, wet: 0.3 });
      const reverb = new Tone.Reverb({ decay: 2.0, wet: 0.3 });
      const filter = new Tone.Filter(2400, 'lowpass');
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
    // Distorted MonoSynth + hard filter — tense, urgent, dramatic. Fits heat dome crisis.
    buildSynth: (chain) => {
      const synth = new Tone.MonoSynth({
        oscillator: { type: 'sawtooth' },
        filter: { type: 'lowpass', Q: 4 },
        filterEnvelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.8, baseFrequency: 400, octaves: 3 },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.5 }
      });
      const distort = new Tone.Distortion(0.25);
      const reverb  = new Tone.Reverb({ decay: 1.2, wet: 0.2 });
      const eq      = new Tone.EQ3({ low: -4, mid: 2, high: 3 });
      synth.chain(distort, eq, reverb, chain);
      return { synth, effects: [distort, reverb, eq] };
    },
    ambientNote: 'G2',
    ambientType: 'sawtooth',
    noteLength: '16n',
    color: '#ef4444',
    label: 'Crisis Distortion Synthesis'
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

  // Audio nodes
  let masterVol    = null;
  let panner       = null;
  let synthCtx     = null;   // { synth, effects[] }
  let ambientOsc   = null;   // Background ambient hum oscillator
  let markerBell   = null;
  let markerNoise  = null;
  let analyser     = null;   // For waveform visualization
  let analyserNode = null;   // Native Web Audio AnalyserNode

  // Callbacks
  let onFrameCb       = null;
  let onStateCb       = null;
  let onThresholdCb   = null;  // NEW: fires when alert sounds

  async function ensureInit() {
    if (ready) return;
    if (typeof Tone === 'undefined') { console.warn('Tone.js not loaded'); return; }

    await Tone.start();

    masterVol = new Tone.Volume(-8).toDestination();

    // Analyser for waveform display (connected to master)
    analyser = new Tone.Analyser('waveform', 256);
    masterVol.connect(analyser);

    // Native AnalyserNode for the visualizer canvas
    analyserNode = Tone.getContext().rawContext.createAnalyser();
    analyserNode.fftSize = 512;
    // Connect Tone destination to native analyser
    Tone.getDestination().connect(analyserNode);

    panner = new Tone.Panner(0).connect(masterVol);

    // Layered alert system
    markerBell = new Tone.MetalSynth({
      frequency: 400,
      envelope: { attack: 0.001, decay: 1.4, release: 0.2 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5
    }).connect(masterVol);
    markerBell.volume.value = -10;

    markerNoise = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.005, decay: 0.18, sustain: 0, release: 0.1 }
    }).connect(masterVol);
    markerNoise.volume.value = -18;

    ready = true;
    console.log('AudioEngine v2 initialized.');
  }

  function buildStoryProfile(profileId) {
    // Tear down any existing synth
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

    const profile = STORY_PROFILES[profileId] || STORY_PROFILES['story-1-seasonal'];
    currentProfile = profile;
    synthCtx = profile.buildSynth(panner);

    // Subtle ambient pad — plays a soft low note continuously
    ambientOsc = new Tone.Synth({
      oscillator: { type: profile.ambientType },
      envelope: { attack: 2, decay: 0, sustain: 1, release: 3 }
    });
    const ambientReverb = new Tone.Reverb({ decay: 5, wet: 0.7 });
    const ambientVol    = new Tone.Volume(-28);
    ambientOsc.chain(ambientReverb, ambientVol, masterVol);
    ambientOsc.triggerAttack(profile.ambientNote);
  }

  function setStory(storyData) {
    pause();
    currentStory = storyData;
    frameIndex = 0;

    if (!storyData || !storyData.frames || !storyData.frames.length) return;

    // Precompute ranges
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

    // Stereo pan by story longitude center
    if (ready && panner && storyData.area && storyData.area.bbox) {
      const lon = (storyData.area.bbox[0] + storyData.area.bbox[2]) / 2;
      panner.pan.rampTo(panForLongitude(lon), 0.5);
    }

    // Build story-specific audio personality
    if (ready) buildStoryProfile(storyData.story_id);

    if (onFrameCb) onFrameCb(0, storyData.frames[0]);
  }

  function playFrame(frame, prevFrame) {
    if (!ready || !synthCtx) return;

    const midi  = pitchForValue(frame.value, currentStory);
    const note  = Tone.Frequency(midi, 'midi').toNote();
    const noteLen = currentProfile ? currentProfile.noteLength : '8n';

    // Dynamically modulate oscillator type based on spread
    const timbre = timbreForSpread(frame.spread, maxSpread);
    try {
      if (synthCtx.synth.oscillator) {
        synthCtx.synth.oscillator.type = timbre;
      }
    } catch (_) {}

    // Threshold alert — layered bell + noise burst
    if (isThresholdCrossing(frame, prevFrame, currentStory)) {
      if (markerBell)  markerBell.triggerAttackRelease('C5', '4n');
      if (markerNoise) markerNoise.triggerAttackRelease('16n');
      if (onThresholdCb) onThresholdCb(frame);
    }

    // Play the melodic note
    synthCtx.synth.triggerAttackRelease(note, noteLen);

    // Modulate ambient pad pitch slowly based on current value normalised 0–1
    if (ambientOsc && currentProfile) {
      const t = (frame.value - currentStory.min) / (currentStory.max - currentStory.min || 1);
      const baseFreq = Tone.Frequency(currentProfile.ambientNote).toFrequency();
      const targetFreq = baseFreq * (1 + t * 0.5);
      ambientOsc.frequency.rampTo(targetFreq, 1.5);
    }
  }

  function step() {
    if (!isPlaying || !currentStory) return;
    if (frameIndex >= currentStory.frames.length) {
      pause(); frameIndex = 0;
      if (onFrameCb) onFrameCb(0, currentStory.frames[0]);
      return;
    }
    const frame    = currentStory.frames[frameIndex];
    const prevFrame = frameIndex > 0 ? currentStory.frames[frameIndex - 1] : null;

    playFrame(frame, prevFrame);
    if (onFrameCb) onFrameCb(frameIndex, frame);

    const delta   = prevFrame ? Math.abs(frame.value - prevFrame.value) : 0;
    const bpm     = tempoForDelta(delta, maxDelta);
    const ms      = Math.max(80, Math.min(900, (60000 / bpm) / (playbackRate * 2.5)));

    frameIndex++;
    playbackTimer = setTimeout(step, ms);
  }

  async function play() {
    await ensureInit();
    if (!synthCtx && currentStory) buildStoryProfile(currentStory.story_id);
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

  function setRate(r)  { playbackRate = Math.max(0.25, Math.min(4, parseFloat(r) || 1)); }
  function setVolume(db) { if (masterVol) masterVol.volume.rampTo(parseFloat(db), 0.1); }

  async function playSample(level) {
    await ensureInit();
    if (!synthCtx) buildStoryProfile(currentStory ? currentStory.story_id : 'story-1-seasonal');
    if (!ready) return;
    if (level === 'marker') {
      if (markerBell)  markerBell.triggerAttackRelease('C5', '4n');
      if (markerNoise) markerNoise.triggerAttackRelease('16n');
      return;
    }
    const midiMap = { low: MIN_MIDI, mid: Math.round((MIN_MIDI+MAX_MIDI)/2), high: MAX_MIDI };
    const note = Tone.Frequency(midiMap[level] || 66, 'midi').toNote();
    synthCtx.synth.triggerAttackRelease(note, '4n');
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
    ensureInit, setStory, play, pause, seek, setRate, setVolume, playSample, dispose, getWaveformData,
    get isPlaying()    { return isPlaying; },
    get currentIndex() { return frameIndex; },
    set onFrame(cb)     { onFrameCb = cb; },
    set onStateChange(cb) { onStateCb = cb; },
    set onThreshold(cb)   { onThresholdCb = cb; }
  };
})();

// Node.js exports (for test runner)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { pitchForValue, timbreForSpread, tempoForDelta, panForLongitude,
                     isThresholdCrossing, MIN_MIDI, MAX_MIDI, MIN_BPM, MAX_BPM };
}
if (typeof window !== 'undefined') {
  Object.assign(window, { AudioEngine, pitchForValue, timbreForSpread,
                           tempoForDelta, panForLongitude, isThresholdCrossing });
}
