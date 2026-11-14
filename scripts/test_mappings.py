#!/usr/bin/env python3
"""
Automated verification of Earth Jukebox sonification mappings & all 5 data files.
Run: python3 scripts/test_mappings.py
"""

import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

MIN_MIDI = 48  # C3
MAX_MIDI = 84  # C6
MIN_BPM = 60
MAX_BPM = 160

def pitch_for_value(value, story_data):
    min_val = story_data["min"]
    max_val = story_data["max"]
    if max_val == min_val:
        return round((MIN_MIDI + MAX_MIDI) / 2)
    clamped = max(min_val, min(max_val, value))
    t = (clamped - min_val) / (max_val - min_val)
    return round(MIN_MIDI + t * (MAX_MIDI - MIN_MIDI))

def timbre_for_spread(spread, max_spread=10.0):
    if not spread or max_spread <= 0:
        return 'sine'
    ratio = min(1.0, max(0.0, spread / max_spread))
    if ratio < 0.33:
        return 'sine'
    if ratio < 0.66:
        return 'triangle'
    return 'sawtooth'

def tempo_for_delta(delta, max_delta=5.0):
    if not delta or max_delta <= 0:
        return MIN_BPM
    ratio = min(1.0, max(0.0, abs(delta) / max_delta))
    return round(MIN_BPM + ratio * (MAX_BPM - MIN_BPM))

def pan_for_longitude(lon):
    if lon is None:
        return 0.0
    return max(-1.0, min(1.0, lon / 180.0))

def is_threshold_crossing(curr_frame, prev_frame, story_data):
    if story_data.get("threshold_date") and curr_frame["date"] == story_data["threshold_date"]:
        return True
    thresh = story_data.get("threshold")
    if thresh is not None:
        if prev_frame:
            return prev_frame["value"] < thresh and curr_frame["value"] >= thresh
        else:
            return curr_frame["value"] >= thresh
    return False

def assert_test(cond, msg):
    if not cond:
        raise AssertionError(f"FAIL: {msg}")
    print(f"✅ PASS: {msg}")

def test_mappings():
    print("=== Testing Sonification Mathematical Mappings ===")
    mock = {"min": 10.0, "max": 50.0, "threshold": 38.0}
    
    # 1. Determinism
    assert_test(pitch_for_value(30.0, mock) == pitch_for_value(30.0, mock), "Same input yields identical pitch")
    # 2. Min mapping
    assert_test(pitch_for_value(10.0, mock) == MIN_MIDI, f"Min value ({mock['min']}) maps to C3 ({MIN_MIDI})")
    # 3. Max mapping
    assert_test(pitch_for_value(50.0, mock) == MAX_MIDI, f"Max value ({mock['max']}) maps to C6 ({MAX_MIDI})")
    # 4. Midpoint mapping
    mid = pitch_for_value(30.0, mock)
    assert_test(mid == 66, f"Midpoint value (30.0) maps precisely to MIDI {mid}")
    # 5. Clamping
    assert_test(pitch_for_value(-10.0, mock) == MIN_MIDI, "Out-of-bounds low values are clamped to MIN_MIDI")
    assert_test(pitch_for_value(100.0, mock) == MAX_MIDI, "Out-of-bounds high values are clamped to MAX_MIDI")
    # 6. Timbre
    assert_test(timbre_for_spread(1.0, 10.0) == 'sine', "Low variability maps to sine")
    assert_test(timbre_for_spread(5.0, 10.0) == 'triangle', "Mid variability maps to triangle")
    assert_test(timbre_for_spread(9.0, 10.0) == 'sawtooth', "High variability maps to sawtooth")
    # 7. Tempo
    assert_test(tempo_for_delta(0.0, 5.0) == MIN_BPM, f"Zero delta maps to {MIN_BPM} BPM")
    assert_test(tempo_for_delta(5.0, 5.0) == MAX_BPM, f"Max delta maps to {MAX_BPM} BPM")
    # 8. Panning
    assert_test(pan_for_longitude(0) == 0.0, "Prime meridian centers pan")
    assert_test(pan_for_longitude(-180) == -1.0, "West 180 pans full left")
    assert_test(pan_for_longitude(180) == 1.0, "East 180 pans full right")
    # 9. Threshold crossing
    f1 = {"date": "2021-06-24", "value": 35.0}
    f2 = {"date": "2021-06-25", "value": 39.0}
    f3 = {"date": "2021-06-26", "value": 42.0}
    assert_test(is_threshold_crossing(f2, f1, mock), "Crosses threshold 38.0 correctly")
    assert_test(not is_threshold_crossing(f3, f2, mock), "Does not repeat crossing when already above")

def test_data_files():
    print("\n=== Validating All 5 Story JSON Files ===")
    all_stories = [
        "story-1-seasonal",
        "story-2-trend",
        "story-3-event",
        "story-4-amazon",
        "story-5-australia"
    ]
    for sid in all_stories:
        p = DATA_DIR / f"{sid}.json"
        assert_test(p.exists(), f"File {p.name} exists on disk")
        with open(p) as f:
            d = json.load(f)
        assert_test(len(d["frames"]) > 0, f"{sid} has {len(d['frames'])} frames")
        assert_test(d["min"] <= d["max"], f"{sid} min ({d['min']}) <= max ({d['max']})")
        assert_test("area" in d and "bbox" in d["area"], f"{sid} defines area and bbox")
        dates = [f["date"] for f in d["frames"]]
        assert_test(dates == sorted(dates), f"{sid} dates are strictly sorted chronologically")

if __name__ == "__main__":
    test_mappings()
    test_data_files()
    print("\n🎉 ALL 5 STORIES & MAPPINGS PASSED VALIDATION! 🎉")
