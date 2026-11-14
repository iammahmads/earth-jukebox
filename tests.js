/**
 * Unit Tests for Earth Jukebox Sonification Mappings
 * Run: node tests.js
 */

const {
  pitchForValue,
  timbreForSpread,
  tempoForDelta,
  panForLongitude,
  isThresholdCrossing,
  MIN_MIDI,
  MAX_MIDI,
  MIN_BPM,
  MAX_BPM
} = require('./audio.js');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

console.log("=== Running Earth Jukebox Sonification Unit Tests ===");

// Mock Story
const mockStory = {
  min: 10.0,
  max: 50.0,
  threshold: 38.0,
  threshold_date: "2021-06-25",
  frames: [
    { date: "2021-06-23", value: 25.0, spread: 2.0 },
    { date: "2021-06-24", value: 35.0, spread: 4.0 },
    { date: "2021-06-25", value: 39.0, spread: 8.0 }, // crosses 38.0
    { date: "2021-06-26", value: 42.0, spread: 1.0 }
  ]
};

// Test 1: Determinism (Pure function: same input -> same pitch)
const p1 = pitchForValue(30.0, mockStory);
const p2 = pitchForValue(30.0, mockStory);
assert(p1 === p2, `Deterministic pitch mapping: pitchForValue(30) = ${p1}`);

// Test 2: Min value maps to MIN_MIDI (48, C3)
const minPitch = pitchForValue(mockStory.min, mockStory);
assert(minPitch === MIN_MIDI, `Minimum value maps to MIN_MIDI (${MIN_MIDI})`);

// Test 3: Max value maps to MAX_MIDI (84, C6)
const maxPitch = pitchForValue(mockStory.max, mockStory);
assert(maxPitch === MAX_MIDI, `Maximum value maps to MAX_MIDI (${MAX_MIDI})`);

// Test 4: Midpoint value maps to midpoint pitch (~66)
const midPitch = pitchForValue(30.0, mockStory);
assert(midPitch > MIN_MIDI && midPitch < MAX_MIDI, `Mid value maps strictly between MIN_MIDI and MAX_MIDI (${midPitch})`);
assert(midPitch === 66, `Midpoint precisely maps to 66`);

// Test 5: Out of bounds values are clamped safely
const belowPitch = pitchForValue(-5.0, mockStory);
const abovePitch = pitchForValue(100.0, mockStory);
assert(belowPitch === MIN_MIDI, `Values below min clamp to MIN_MIDI`);
assert(abovePitch === MAX_MIDI, `Values above max clamp to MAX_MIDI`);

// Test 6: Timbre mapping according to variability/spread
assert(timbreForSpread(1.0, 10) === 'sine', `Low spread (1.0/10) maps to sine oscillator`);
assert(timbreForSpread(5.0, 10) === 'triangle', `Medium spread (5.0/10) maps to triangle oscillator`);
assert(timbreForSpread(9.0, 10) === 'sawtooth', `High spread (9.0/10) maps to sawtooth oscillator`);

// Test 7: Tempo mapping according to rate of change (|delta|)
assert(tempoForDelta(0.0, 5) === MIN_BPM, `Zero delta maps to MIN_BPM (${MIN_BPM})`);
assert(tempoForDelta(5.0, 5) === MAX_BPM, `Max delta maps to MAX_BPM (${MAX_BPM})`);
const midTempo = tempoForDelta(2.5, 5);
assert(midTempo > MIN_BPM && midTempo < MAX_BPM, `Intermediate delta maps to proportional tempo (${midTempo} BPM)`);

// Test 8: Stereo panning by longitude
assert(panForLongitude(0) === 0, `Prime meridian (0°) centers in stereo (0.0)`);
assert(panForLongitude(-180) === -1, `Date line West (-180°) pans full left (-1.0)`);
assert(panForLongitude(180) === 1, `Date line East (+180°) pans full right (+1.0)`);
assert(panForLongitude(-120) === -120 / 180, `Pacific Northwest (-120°) pans left (-0.67)`);

// Test 9: Threshold crossing detection
const f0 = mockStory.frames[0]; // 25.0
const f1 = mockStory.frames[1]; // 35.0
const f2 = mockStory.frames[2]; // 39.0
const f3 = mockStory.frames[3]; // 42.0

assert(!isThresholdCrossing(f1, f0, mockStory), `No crossing when 25.0 -> 35.0 (below 38.0)`);
assert(isThresholdCrossing(f2, f1, mockStory), `Threshold crossing fires when 35.0 -> 39.0 (crosses 38.0)`);
// When already above threshold, does not refire
const mockStoryNoDate = { ...mockStory, threshold_date: null };
assert(!isThresholdCrossing(f3, f2, mockStoryNoDate), `Threshold crossing does not repeat once already above threshold`);

console.log("=== All 9 Sonification Unit Tests Passed Successfully! ===");
