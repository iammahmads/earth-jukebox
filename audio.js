/**
 * Earth Jukebox - Sonification Engine (audio.js)
 * Built on Tone.js (Web Audio API)
 * 
 * Maps Earth observation time series parameters into sound dimensions:
 * - Value -> Pitch (MIDI 48 / C3 to MIDI 84 / C6)
 * - Spread / Variability -> Timbre (Sine -> Triangle -> Sawtooth)
 * - Rate of Change -> Tempo (60 BPM to 160 BPM)
 * - Threshold Crossing -> Percussive Warning Marker Sound
 * - Longitude -> Stereo Pan (-1.0 to +1.0)
 */

// Pure sonification mapping functions (reusable in tests & engine)
const MIN_MIDI = 48; // C3
const MAX_MIDI = 84; // C6
const MIN_BPM = 60;
const MAX_BPM = 160;

/**
 * Linearly maps a data value to a MIDI note integer between MIN_MIDI and MAX_MIDI.
 * Pure function of (value, storyData).
 */
function pitchForValue(value, storyData) {
  if (!storyData || storyData.min === undefined || storyData.max === undefined) {
    return 60; // Middle C default
  }
  const min = storyData.min;
  const max = storyData.max;
  if (max === min) {
    return Math.round((MIN_MIDI + MAX_MIDI) / 2);
  }
  const clampedVal = Math.max(min, Math.min(max, value));
  const t = (clampedVal - min) / (max - min);
  return Math.round(MIN_MIDI + t * (MAX_MIDI - MIN_MIDI));
}

/**
 * Maps variability/spread to oscillator type.
 * Returns 'sine' (pure), 'triangle' (mellow), or 'sawtooth' (rich in harmonics).
 */
function timbreForSpread(spread, maxSpread = 10) {
  if (!spread || maxSpread <= 0) return 'sine';
  const ratio = Math.min(1.0, Math.max(0.0, spread / maxSpread));
  if (ratio < 0.33) return 'sine';
  if (ratio < 0.66) return 'triangle';
  return 'sawtooth';
}

/**
 * Maps rate of change (|delta|) to playback tempo (BPM).
 */
function tempoForDelta(delta, maxDelta = 5) {
  if (!delta || maxDelta <= 0) return MIN_BPM;
  const ratio = Math.min(1.0, Math.max(0.0, Math.abs(delta) / maxDelta));
  return Math.round(MIN_BPM + ratio * (MAX_BPM - MIN_BPM));
}

/**
 * Computes stereo pan position (-1.0 left to +1.0 right) based on longitude.
 */
function panForLongitude(lon) {
  if (lon === undefined || lon === null || isNaN(lon)) return 0;
  // Normalize lon from [-180, 180] to [-1.0, 1.0]
  return Math.max(-1.0, Math.min(1.0, lon / 180.0));
}

/**
 * Determines whether a frame triggers a threshold event marker.
 */
function isThresholdCrossing(currentFrame, prevFrame, storyData) {
  if (!storyData || !currentFrame) return false;
  
  // Date-based threshold
  if (storyData.threshold_date && currentFrame.date === storyData.threshold_date) {
    return true;
  }
  
  // Value-based threshold
  if (storyData.threshold !== null && storyData.threshold !== undefined) {
    const thresh = storyData.threshold;
    if (prevFrame) {
      return prevFrame.value < thresh && currentFrame.value >= thresh;
    } else {
      return currentFrame.value >= thresh;
    }
  }
  
  return false;
}

// Browser AudioEngine implementation
const AudioEngine = (() => {
  let isToneReady = false;
  let isPlaying = false;
  let synth = null;
  let markerSynth = null;
  let panner = null;
  let masterVol = null;
  
  let currentStory = null;
  let currentFrameIndex = 0;
  let playbackTimer = null;
  let playbackRate = 1.0;
  let maxDelta = 1.0;
  let maxSpread = 1.0;

  let onFrameCallback = null;
  let onStateChangeCallback = null;

  async function ensureInit() {
    if (isToneReady) return;
    if (typeof Tone === "undefined") {
      console.warn("Tone.js is not loaded yet.");
      return;
    }
    await Tone.start();
    
    // Master volume node
    masterVol = new Tone.Volume(-6).toDestination();
    
    // Stereo panner
    panner = new Tone.Panner(0).connect(masterVol);
    
    // Main melodic synthesizer
    synth = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: {
        attack: 0.05,
        decay: 0.2,
        sustain: 0.3,
        release: 0.4
      }
    }).connect(panner);
    
    // Warning/Alert marker synthesizer (punchy membrane kick / chime)
    markerSynth = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 5,
      oscillator: { type: "sine" },
      envelope: {
        attack: 0.001,
        decay: 0.4,
        sustain: 0.01,
        release: 0.4
      }
    }).connect(masterVol);

    isToneReady = true;
    console.log("AudioEngine initialized successfully.");
  }

  function setStory(storyData) {
    pause();
    currentStory = storyData;
    currentFrameIndex = 0;
    
    if (currentStory && currentStory.frames && currentStory.frames.length > 0) {
      // Precompute max delta and max spread
      let localMaxDelta = 0.1;
      let localMaxSpread = 0.1;
      for (let i = 0; i < currentStory.frames.length; i++) {
        const f = currentStory.frames[i];
        if (f.spread && f.spread > localMaxSpread) localMaxSpread = f.spread;
        if (i > 0) {
          const delta = Math.abs(f.value - currentStory.frames[i - 1].value);
          if (delta > localMaxDelta) localMaxDelta = delta;
        }
      }
      maxDelta = localMaxDelta || 1.0;
      maxSpread = localMaxSpread || 1.0;
      
      // Update stereo pan according to story area
      if (currentStory.area && currentStory.area.bbox && panner) {
        const centerLon = (currentStory.area.bbox[0] + currentStory.area.bbox[2]) / 2;
        panner.pan.value = panForLongitude(centerLon);
      }
    }
    
    if (onFrameCallback && currentStory && currentStory.frames[0]) {
      onFrameCallback(0, currentStory.frames[0]);
    }
  }

  function playToneForFrame(frame, prevFrame) {
    if (!isToneReady || !synth) return;
    
    // Set oscillator timbre according to spread
    const timbre = timbreForSpread(frame.spread, maxSpread);
    if (synth.oscillator.type !== timbre) {
      synth.oscillator.type = timbre;
    }
    
    // Calculate pitch
    const midi = pitchForValue(frame.value, currentStory);
    const note = Tone.Frequency(midi, "midi").toNote();
    
    // Trigger marker sound if threshold crossed
    if (isThresholdCrossing(frame, prevFrame, currentStory)) {
      if (markerSynth) {
        markerSynth.triggerAttackRelease("C2", "8n");
      }
    }
    
    // Play melodic pitch
    synth.triggerAttackRelease(note, "16n");
  }

  function step() {
    if (!isPlaying || !currentStory || !currentStory.frames.length) return;
    
    if (currentFrameIndex >= currentStory.frames.length) {
      pause();
      currentFrameIndex = 0; // reset
      if (onFrameCallback && currentStory.frames[0]) {
        onFrameCallback(0, currentStory.frames[0]);
      }
      return;
    }

    const frame = currentStory.frames[currentFrameIndex];
    const prevFrame = currentFrameIndex > 0 ? currentStory.frames[currentFrameIndex - 1] : null;
    
    playToneForFrame(frame, prevFrame);
    
    if (onFrameCallback) {
      onFrameCallback(currentFrameIndex, frame);
    }
    
    // Determine dynamic interval based on rate of change
    const delta = prevFrame ? Math.abs(frame.value - prevFrame.value) : 0;
    const bpm = tempoForDelta(delta, maxDelta);
    // Base quarter note in ms is (60000 / bpm), adjusted by user rate multiplier
    const frameIntervalMs = Math.max(75, Math.min(800, (60000 / bpm) / (playbackRate * 2.5)));
    
    currentFrameIndex++;
    playbackTimer = setTimeout(step, frameIntervalMs);
  }

  async function play() {
    await ensureInit();
    if (isPlaying) return;
    isPlaying = true;
    if (onStateChangeCallback) onStateChangeCallback(true);
    step();
  }

  function pause() {
    isPlaying = false;
    if (playbackTimer) {
      clearTimeout(playbackTimer);
      playbackTimer = null;
    }
    if (onStateChangeCallback) onStateChangeCallback(false);
  }

  async function seek(index) {
    if (!currentStory || !currentStory.frames.length) return;
    const clampedIndex = Math.max(0, Math.min(currentStory.frames.length - 1, index));
    currentFrameIndex = clampedIndex;
    const frame = currentStory.frames[clampedIndex];
    const prevFrame = clampedIndex > 0 ? currentStory.frames[clampedIndex - 1] : null;
    
    if (onFrameCallback) {
      onFrameCallback(clampedIndex, frame);
    }
    
    // Play a preview tone on seek
    if (isToneReady) {
      playToneForFrame(frame, prevFrame);
    }
  }

  function setRate(rate) {
    playbackRate = Math.max(0.25, Math.min(4.0, parseFloat(rate) || 1.0));
  }

  function setVolume(db) {
    if (masterVol) {
      masterVol.volume.value = parseFloat(db);
    }
  }

  /**
   * Triggers an individual sample tone for testing and legend preview.
   * level can be: 'low', 'mid', 'high', 'marker'
   */
  async function playSample(level) {
    await ensureInit();
    if (!isToneReady) return;
    
    if (level === 'marker') {
      if (markerSynth) markerSynth.triggerAttackRelease("C2", "8n");
      return;
    }
    
    let midi = 60;
    if (level === 'low') midi = MIN_MIDI;
    else if (level === 'mid') midi = Math.round((MIN_MIDI + MAX_MIDI) / 2);
    else if (level === 'high') midi = MAX_MIDI;
    
    const note = Tone.Frequency(midi, "midi").toNote();
    if (synth) {
      synth.oscillator.type = "sine";
      synth.triggerAttackRelease(note, "4n");
    }
  }

  function dispose() {
    pause();
    currentStory = null;
    currentFrameIndex = 0;
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
    dispose,
    get isPlaying() { return isPlaying; },
    get currentIndex() { return currentFrameIndex; },
    set onFrame(cb) { onFrameCallback = cb; },
    set onStateChange(cb) { onStateChangeCallback = cb; }
  };
})();

// Export for Node.js test environment if available
if (typeof module !== "undefined" && module.exports) {
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

// Attach to browser global window
if (typeof window !== "undefined") {
  window.AudioEngine = AudioEngine;
  window.pitchForValue = pitchForValue;
  window.timbreForSpread = timbreForSpread;
  window.tempoForDelta = tempoForDelta;
  window.panForLongitude = panForLongitude;
  window.isThresholdCrossing = isThresholdCrossing;
}
