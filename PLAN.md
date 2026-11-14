Earth Jukebox — Full Instructional Build Plan for Coding Agent

IMPORTANT

This is a complete, zero-to-ship build plan for a solo NASA Space Apps 2026 submission. Build everything from scratch following this document exactly. No prior codebase exists. The deadline is Sunday, Nov 15, 2026 at 11:59 PM local time (PKT / UTC+5) — that is roughly 36 hours from now (Sat Nov 14, ~12:30 PM PKT).

1. Project Overview

Project Name: Earth Jukebox
Challenge: The Earth Information Jukebox (NASA Space Apps 2026)
Team: Solo
Concept: A static, fully-accessible web app that sonifies 3 NASA Earth-data time series while a synced GIBS map tile advances frame-by-frame — so the story of Earth's changing climate can be followed by ear alone, without looking at the screen.

What "Sonification" Means Here

Each data frame (one point in time) is turned into sound in real time:

The data value (e.g., temperature, flood extent) → pitch
The spatial spread/variability across the area → timbre (tone quality)
The rate of change between consecutive frames → playback tempo
A threshold crossing (e.g., exceeding seasonal norm) → a distinct marker sound
The longitude of the data area → stereo pan (left/right balance) (low priority, cut first if time is short)
2. Tech Stack (No Build Step, No Backend)
Layer	Technology	How loaded
Data prep	Python 3 + requests	Run once offline, writes data/*.json
Frontend shell	Plain HTML5 / CSS3 / vanilla JS	Direct index.html open or static serve
Audio engine	Tone.js v14
	CDN <script> tag
Map	Leaflet.js v1.9
	CDN <script> tag
Map tiles	NASA GIBS WMTS	Public tile URL, no auth
Data source	NASA VEDA Raster API + NASA POWER (fallback)	Python fetch scripts only
Hosting	GitHub Pages or Netlify Drop	Static files only

NOTE

Zero npm install, zero bundler, zero node_modules. The coding agent should be able to open index.html directly in a browser and have it work. All dependencies are CDN-loaded at runtime.

3. Repository Structure

Build exactly this structure:

earth-jukebox/
├── index.html              # App shell: map, scrubber, legend, story picker
├── styles.css              # All styling
├── app.js                  # Frame scrubber, UI wiring, ARIA live region
├── audio.js                # Tone.js sonification engine
├── stories.json            # Story metadata (titles, units, mapping ranges)
├── data/
│   ├── story-1-seasonal.json
│   ├── story-2-trend.json
│   └── story-3-event.json
├── scripts/
│   ├── fetch_veda.py       # VEDA Raster API fetch → data/*.json
│   ├── fetch_power.py      # NASA POWER fallback fetch
│   └── requirements.txt    # requests>=2.31.0
├── assets/
│   └── favicon.ico
└── README.md

WARNING

scripts/ must never be served by the deployed site. The fetch scripts are run offline once; they never ship to production. If using GitHub Pages, add a .gitignore or just don't include API credentials anywhere — none of the planned sources require auth, but keep this rule enforced.

4. The Three Stories

IMPORTANT

Story 3 (Sudden Event) is the primary focus (the user's chosen "Idea Three"). Stories 1 and 2 provide full data/audio context. All three must be built, but story 3 is the showcase.

Story 1 — Seasonal Cycle
Field	Value
story_id	story-1-seasonal
Shape	Repeating annual up-down pattern
Primary dataset	VEDA STAC: search for omi-trno2-0.10deg-agg_1d or a sea-surface-temperature/NDVI collection with clean annual cycle — confirm exact collection ID in VEDA catalog before coding
Fallback dataset	NASA POWER: T2M (2-meter air temperature) monthly, single land point (e.g., 45°N, 10°E — Central Europe), 2010–2024
Area	One ocean or land region with a visually clean yearly rhythm
What the listener hears	Pitch rises and falls on roughly the same schedule each year
Story 2 — Long Trend
Field	Value
story_id	story-2-trend
Shape	Monotonic drift upward (or downward) over 10–20+ years
Primary dataset	VEDA STAC: search for a multi-year warming or greening dataset — lis-tws-trend or NASA POWER T2M annual averages for 20+ years
Fallback	NASA POWER T2M annual, one point (e.g., 35°N, 139°E — Tokyo), 2000–2024
Area	One region with a documented long-term change
What the listener hears	Pitch slowly drifts upward (or downward) across the whole playback
Story 3 — Sudden Event ⭐ (Primary Showcase)
Field	Value
story_id	story-3-event
Shape	Calm baseline → sharp spike/crash → possible recovery
Primary dataset	VEDA STAC: search for flood-extent, fire-burned-area, or a heatwave index collection — a dated bounded event. Example: 2023 Canadian wildfire smoke (June–July 2023), or 2021 Pacific Northwest heat dome
Fallback	NASA POWER T2MAX daily, one point (e.g., 49°N, -120°W — British Columbia), June–August 2021
Area	One region, one bounded event window (e.g., 2 months before + event month + 2 months after)
threshold	The value (or date string) at which the marker sound fires — e.g., the 95th percentile of the pre-event baseline, or the event start date
What the listener hears	Calm low-mid pitch → sudden pitch spike AND a distinct percussive marker hit at threshold crossing
5. Data JSON Format (Shared Contract)

Every data/*.json file — regardless of source — must follow this exact schema:

json
{
  "story_id": "story-3-event",
  "title": "2021 Pacific Northwest Heat Dome",
  "dataset": "<exact VEDA collection id or 'NASA POWER T2MAX'>",
  "source": "VEDA",
  "units": "°C",
  "area": {
    "name": "Pacific Northwest, USA/Canada",
    "bbox": [-125.0, 44.0, -116.0, 52.0]
  },
  "min": 0.0,
  "max": 0.0,
  "threshold": 38.5,
  "frames": [
    { "date": "YYYY-MM-DD", "value": 0.0, "spread": 0.0 }
  ]
}

Rules for the fetch scripts:

min and max are computed from frames[].value — never guessed or hard-coded
spread = standard deviation or IQR of pixel values across the area of interest for that frame (whichever the API returns)
threshold = the value or ISO date string at which the marker sound fires for story 3; null for stories 1 and 2
Cache every raw API response to scripts/raw/<story_id>_raw.json before transforming it — a second script run must never re-hit the API
Print a one-line summary when done: story-3-event: 90 frames, 2021-04-01 to 2021-09-28
6. Data Fetch Scripts
scripts/requirements.txt
requests>=2.31.0
scripts/fetch_veda.py
python
"""
Fetch area statistics from the VEDA Raster API for all three stories.
Run once: python scripts/fetch_veda.py
Writes data/story-{1,2,3}-*.json and scripts/raw/*.json
"""
import json, os, math, requests
from pathlib import Path
RAW_DIR = Path("scripts/raw")
DATA_DIR = Path("data")
RAW_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)
# ── STEP 1: Confirm these values from https://openveda.cloud before running ──
# Visit https://openveda.cloud/api/stac/collections to list all collections.
# Replace the placeholders below with the confirmed collection IDs and date ranges.
STORIES = [
    {
        "story_id": "story-1-seasonal",
        "title": "Ocean SST Seasonal Cycle",          # update with real title
        "collection": "PLACEHOLDER_COLLECTION_1",     # e.g. "omi-trno2-0.10deg-agg_1d"
        "bbox": [-10.0, 35.0, 10.0, 50.0],           # update to real bbox
        "start": "2018-01-01",
        "end":   "2023-12-31",
        "units": "PLACEHOLDER_UNITS",                 # e.g. "°C" or "mol/m²"
        "threshold": None,
    },
    {
        "story_id": "story-2-trend",
        "title": "Multi-Year Warming Trend",
        "collection": "PLACEHOLDER_COLLECTION_2",
        "bbox": [130.0, 30.0, 145.0, 45.0],
        "start": "2000-01-01",
        "end":   "2023-12-31",
        "units": "PLACEHOLDER_UNITS",
        "threshold": None,
    },
    {
        "story_id": "story-3-event",
        "title": "2021 Pacific Northwest Heat Dome",
        "collection": "PLACEHOLDER_COLLECTION_3",     # e.g. "cop-dem-glo-30" or a fire/heat collection
        "bbox": [-125.0, 44.0, -116.0, 52.0],
        "start": "2021-04-01",
        "end":   "2021-09-30",
        "units": "°C",
        "threshold": 38.5,                            # update after inspecting data
    },
]
# ── STEP 2: Confirm the VEDA Raster API base URL from https://openveda.cloud/api ──
VEDA_STATS_URL = "https://staging.openveda.cloud/api/raster/statistics"  # placeholder — verify
def fetch_story(story):
    sid = story["story_id"]
    raw_path = RAW_DIR / f"{sid}_raw.json"
    # Cache raw response
    if raw_path.exists():
        print(f"[{sid}] Using cached raw response.")
        raw = json.loads(raw_path.read_text())
    else:
        params = {
            "collection": story["collection"],
            "bbox": ",".join(str(x) for x in story["bbox"]),
            "datetime": f"{story['start']}/{story['end']}",
            "statistics": "mean,std",
        }
        resp = requests.get(VEDA_STATS_URL, params=params, timeout=60)
        resp.raise_for_status()
        raw = resp.json()
        raw_path.write_text(json.dumps(raw, indent=2))
        print(f"[{sid}] Fetched and cached raw response.")
    # Transform raw → frames
    # NOTE: Adjust the key path below to match the actual VEDA response shape.
    # Inspect scripts/raw/{story_id}_raw.json after first run and fix if needed.
    frames = []
    items = raw.get("features") or raw.get("results") or raw  # adjust as needed
    for item in items:
        props = item.get("properties", item)
        date  = props.get("datetime", props.get("date", ""))[:10]
        value = float(props.get("mean", 0.0))
        spread = float(props.get("std", 0.0))
        if date:
            frames.append({"date": date, "value": value, "spread": spread})
    frames.sort(key=lambda f: f["date"])
    values = [f["value"] for f in frames]
    result = {
        "story_id": sid,
        "title": story["title"],
        "dataset": story["collection"],
        "source": "VEDA",
        "units": story["units"],
        "area": {"name": story["title"], "bbox": story["bbox"]},
        "min": min(values) if values else 0.0,
        "max": max(values) if values else 0.0,
        "threshold": story["threshold"],
        "frames": frames,
    }
    out_path = DATA_DIR / f"{sid}.json"
    out_path.write_text(json.dumps(result, indent=2))
    print(f"[{sid}] {len(frames)} frames, {frames[0]['date'] if frames else '?'} to {frames[-1]['date'] if frames else '?'}")
    return result
if __name__ == "__main__":
    for s in STORIES:
        try:
            fetch_story(s)
        except Exception as e:
            print(f"[{s['story_id']}] ERROR: {e} — run fetch_power.py as fallback")
scripts/fetch_power.py
python
"""
NASA POWER fallback: fetches daily/monthly point data for any story.
Run: python scripts/fetch_power.py
API docs: https://power.larc.nasa.gov/docs/services/api/
"""
import json, requests
from pathlib import Path
RAW_DIR = Path("scripts/raw")
DATA_DIR = Path("data")
RAW_DIR.mkdir(parents=True, exist_ok=True)
POWER_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
FALLBACK_STORIES = [
    # Uncomment and edit whichever stories need POWER as fallback
    {
        "story_id": "story-3-event",
        "title": "2021 Pacific Northwest Heat Dome (POWER fallback)",
        "parameter": "T2MMAX",           # max 2-m air temp (°C)
        "latitude": 49.0,
        "longitude": -120.0,
        "start": "20210101",
        "end":   "20210930",
        "units": "°C",
        "threshold_date": "2021-06-25",  # event start date — fires marker sound
        "bbox": [-125.0, 44.0, -116.0, 52.0],
    },
]
def fetch_power_story(story):
    sid = story["story_id"]
    raw_path = RAW_DIR / f"{sid}_power_raw.json"
    if raw_path.exists():
        print(f"[{sid}] Using cached POWER response.")
        raw = json.loads(raw_path.read_text())
    else:
        params = {
            "parameters": story["parameter"],
            "community": "RE",
            "longitude": story["longitude"],
            "latitude": story["latitude"],
            "start": story["start"],
            "end": story["end"],
            "format": "JSON",
        }
        resp = requests.get(POWER_URL, params=params, timeout=60)
        resp.raise_for_status()
        raw = resp.json()
        raw_path.write_text(json.dumps(raw, indent=2))
        print(f"[{sid}] Fetched and cached POWER response.")
    param_key = story["parameter"]
    daily_data = raw["properties"]["parameter"][param_key]  # dict: "YYYYMMDD" → value
    frames = []
    for date_str, val in sorted(daily_data.items()):
        if val == -999.0:  # POWER fill value — skip
            continue
        iso_date = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]}"
        frames.append({"date": iso_date, "value": float(val), "spread": 0.0})
    values = [f["value"] for f in frames]
    threshold = story.get("threshold_date")  # date string for event stories
    result = {
        "story_id": sid,
        "title": story["title"],
        "dataset": f"NASA POWER {param_key}",
        "source": "NASA POWER",
        "units": story["units"],
        "area": {
            "name": story["title"],
            "bbox": story["bbox"],
        },
        "min": min(values) if values else 0.0,
        "max": max(values) if values else 0.0,
        "threshold": threshold,
        "frames": frames,
    }
    out_path = DATA_DIR / f"{sid}.json"
    out_path.write_text(json.dumps(result, indent=2))
    print(f"[{sid}] {len(frames)} frames, {frames[0]['date']} to {frames[-1]['date']}")
if __name__ == "__main__":
    for s in FALLBACK_STORIES:
        fetch_power_story(s)
7. stories.json — Story Metadata

This file is hand-authored (not generated by scripts). Update the collection and gibs_layer fields after confirming them from VEDA and GIBS docs.

json
[
  {
    "id": "story-1-seasonal",
    "title": "Breathing with the Seasons",
    "description": "Watch a region's temperature or vegetation rise and fall in a repeating yearly rhythm.",
    "shape": "seasonal",
    "gibs_layer": "MODIS_Terra_CorrectedReflectance_TrueColor",
    "thumbnail": "assets/thumb-seasonal.png",
    "data_file": "data/story-1-seasonal.json"
  },
  {
    "id": "story-2-trend",
    "title": "A Decade of Drift",
    "description": "Hear how a region's temperature has crept steadily upward over twenty years.",
    "shape": "trend",
    "gibs_layer": "MODIS_Terra_Land_Surface_Temp_Day",
    "thumbnail": "assets/thumb-trend.png",
    "data_file": "data/story-2-trend.json"
  },
  {
    "id": "story-3-event",
    "title": "The Day the Heat Dome Broke Records",
    "description": "Hear the calm before the 2021 Pacific Northwest heat dome, the sharp spike when records shattered, and the slow return to normal.",
    "shape": "event",
    "gibs_layer": "MODIS_Terra_Land_Surface_Temp_Day",
    "thumbnail": "assets/thumb-event.png",
    "data_file": "data/story-3-event.json"
  }
]

NOTE

GIBS layer names must be verified at https://nasa-gibs.github.io/gibs-api-docs/
. The names above are examples — confirm the exact layer ID and tile matrix set before wiring them into Leaflet.

8. audio.js — Sonification Engine

Full specification for the coding agent to implement from scratch using Tone.js (CDN).

Public API (what app.js calls)
js
AudioEngine.setStory(storyData)   // loads a story's JSON, sets pitch range
AudioEngine.play()                 // starts/resumes Tone.Transport
AudioEngine.pause()                // pauses Tone.Transport
AudioEngine.seek(frameIndex)       // jump to a specific frame
AudioEngine.setRate(multiplier)    // 0.5 = half speed, 2.0 = double
AudioEngine.setVolume(db)          // e.g. -6 for 50%
AudioEngine.dispose()              // tear down synths when switching story
AudioEngine.onFrame = null         // callback: fn(frameIndex, frameData)
Sonification Mapping Rules (implement exactly as written — these are tested)
pitchForValue(value, storyData):
  → maps value linearly from [storyData.min, storyData.max]
      to   [MIDI note 48 (C3), MIDI note 84 (C6)]
  → pure function: same (story, value) → same pitch, always
  → clamp to range; never go below 48 or above 84
timbreForSpread(spread, maxSpread):
  → spread / maxSpread → 0.0–1.0
  → 0.0 → oscillator type "sine"  (pure tone)
  → 0.5 → "triangle"
  → 1.0 → "sawtooth"             (rich harmonics)
  → interpolate between types at runtime by cross-fading two Tone.Synth instances
tempoForDelta(delta, maxDelta):
  → |delta| / maxDelta → 0.0–1.0
  → 0.0 → 60 BPM (slow, steady)
  → 1.0 → 160 BPM (fast)
  → set Tone.Transport.bpm.value before each frame's note
markerSound(frameData, storyData):
  → fires if storyData.threshold !== null AND:
      - threshold is a number: frameData.value crosses threshold (previous frame below, this frame at or above)
      - threshold is a date string: frameData.date === threshold
  → plays one hit on a Tone.MembraneSynth (kick-like, short decay)
  → fires before the melodic note of that frame
Stereo Pan (low priority — implement last, skip if time is short)
panForFrame(bbox, frameIndex):
  → not applicable for a point source (POWER fallback)
  → for area data: pan = (bbox.center_longitude + 180) / 360 * 2 - 1
                   i.e. -180°lon → -1 (full left), 0° → 0 (center), 180° → +1 (full right)
  → wire through Tone.Panner connected between synth and Tone.Destination
Implementation Notes
js
// Pseudo-structure — implement in full vanilla JS
const AudioEngine = (() => {
  let synth, markerSynth, panner, storyData, frameIndex;
  const BASE_BPM = 60, MAX_BPM = 160;
  const MIN_NOTE = 48, MAX_NOTE = 84;
  function pitchForValue(value) {
    const t = (value - storyData.min) / (storyData.max - storyData.min);
    return Math.round(MIN_NOTE + t * (MAX_NOTE - MIN_NOTE));
  }
  function scheduleAll() {
    Tone.Transport.cancel();
    storyData.frames.forEach((frame, i) => {
      const delta = i > 0 ? Math.abs(frame.value - storyData.frames[i-1].value) : 0;
      const maxDelta = /* precomputed */ 0;
      const bpm = BASE_BPM + (delta / maxDelta) * (MAX_BPM - BASE_BPM);
      const beatDuration = 60 / bpm;
      Tone.Transport.schedule(time => {
        Tone.Transport.bpm.setValueAtTime(bpm, time);
        if (shouldFireMarker(frame, i)) {
          markerSynth.triggerAttackRelease("C1", "8n", time);
        }
        const note = Tone.Frequency(pitchForValue(frame.value), "midi").toNote();
        synth.triggerAttackRelease(note, "8n", time + 0.05);
        if (AudioEngine.onFrame) {
          Tone.getDraw().schedule(() => AudioEngine.onFrame(i, frame), time);
        }
      }, i * beatDuration /* approximate — recalculate with running time */);
    });
  }
  return { setStory, play, pause, seek, setRate, setVolume, dispose, onFrame: null };
})();

CAUTION

No autoplay. Tone.start() and Tone.Transport.start() must only be called inside a user-gesture event handler (click, keydown). Browsers block audio that starts without user interaction. Never call play() from a DOMContentLoaded or story-load handler.

9. index.html + app.js — UI Specification
Page Structure
┌──────────────────────────────────────────┐
│  🌍 Earth Jukebox           [Skip nav]   │
├──────────────────────────────────────────┤
│  LANDING VIEW (default)                  │
│  ┌────────┐ ┌────────┐ ┌────────┐        │
│  │ Story 1│ │ Story 2│ │ Story 3│        │
│  │ card   │ │ card   │ │ card   │        │
│  └────────┘ └────────┘ └────────┘        │
├──────────────────────────────────────────┤
│  PLAYER VIEW (shown after story selected)│
│  ┌──────────────────────────────────┐    │
│  │  Leaflet map (GIBS tile layer)   │    │
│  │  + story bbox rectangle overlay  │    │
│  └──────────────────────────────────┘    │
│                                          │
│  Date: 2021-06-29  |  Temp: 42.1 °C      │  ← ARIA live region
│                                          │
│  [◀◀]  [▶ PLAY]  [▶▶]   Speed: [1×▾]   │
│  Frame: ━━━━━━━━━━●━━━━━━━━━   Vol: 🔊  │
│                                          │
│  ── LEGEND ───────────────────────────   │
│  Low pitch = cooler / less intense       │
│  High pitch = hotter / more intense      │
│  [▶ Sample: low]  [▶ Sample: mid]        │
│  [▶ Sample: high] [▶ Marker sound]       │
│                                          │
│  ── STORY SUMMARY ────────────────────   │
│  "Values rose from 18°C to 49°C between  │
│   Apr 2021 and Sep 2021, peaking in      │
│   late June during the heat dome."       │
│                                          │
│  [← Back to stories]                    │
└──────────────────────────────────────────┘
index.html Must-Have Elements
html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Earth Jukebox</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <a href="#main" class="skip-link">Skip to main content</a>
  <header role="banner">
    <h1>🌍 Earth Jukebox</h1>
    <p>Earth's data, told in sound.</p>
  </header>
  <main id="main">
    <!-- LANDING VIEW -->
    <section id="landing" aria-label="Story selection">
      <h2>Choose a Story</h2>
      <div id="story-cards" role="list">
        <!-- Cards injected by app.js from stories.json -->
      </div>
    </section>
    <!-- PLAYER VIEW (hidden until story selected) -->
    <section id="player" hidden aria-label="Story player">
      <h2 id="story-title">Story Title</h2>
      <div id="map" role="img" aria-label="Map showing the story region"></div>
      <!-- ARIA live region: screen readers hear every frame update -->
      <div id="live-readout" aria-live="polite" aria-atomic="true" class="sr-only">
        <!-- Updated by app.js every frame: "Date: 2021-06-29. Temperature: 42.1 degrees C" -->
      </div>
      <!-- Visible readout (not sr-only) -->
      <div id="visible-readout" aria-hidden="true">
        <span id="current-date">—</span> | <span id="current-value">—</span>
      </div>
      <div id="controls" role="group" aria-label="Playback controls">
        <button id="btn-back" aria-label="Step back one frame">◀</button>
        <button id="btn-play" aria-label="Play" aria-pressed="false">▶ Play</button>
        <button id="btn-forward" aria-label="Step forward one frame">▶</button>
        <label for="scrubber">Frame</label>
        <input type="range" id="scrubber" min="0" value="0" step="1" aria-label="Frame scrubber">
        <label for="speed">Speed</label>
        <select id="speed" aria-label="Playback speed">
          <option value="0.5">0.5×</option>
          <option value="1.0" selected>1×</option>
          <option value="2.0">2×</option>
          <option value="4.0">4×</option>
        </select>
        <label for="volume">Volume</label>
        <input type="range" id="volume" min="-40" max="0" value="-6" step="1" aria-label="Volume">
      </div>
      <section id="legend" aria-label="Sound legend">
        <h3>How to Listen</h3>
        <p id="legend-text">Low pitch = <span id="legend-low-label">—</span> | High pitch = <span id="legend-high-label">—</span></p>
        <div id="sample-tones" role="group" aria-label="Sample tones">
          <button class="sample-btn" data-level="low">▶ Sample: Low</button>
          <button class="sample-btn" data-level="mid">▶ Sample: Mid</button>
          <button class="sample-btn" data-level="high">▶ Sample: High</button>
          <button class="sample-btn" data-level="marker">▶ Marker sound</button>
        </div>
      </section>
      <section id="story-summary" aria-label="Story summary">
        <h3>What Changed</h3>
        <p id="summary-text">—</p>
      </section>
      <div id="data-credit" aria-label="Data source">
        Dataset: <span id="dataset-name">—</span> | Units: <span id="dataset-units">—</span>
      </div>
      <button id="btn-back-stories">← Back to stories</button>
    </section>
  </main>
  <footer>
    <p>Built for <a href="https://www.spaceappschallenge.org/">NASA Space Apps 2026</a>.
    Data: NASA VEDA, NASA GIBS, NASA POWER. Audio: Tone.js. Map: Leaflet.</p>
  </footer>
  <!-- CDN dependencies -->
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/tone@14.7.77/build/Tone.js"></script>
  <!-- App scripts -->
  <script src="audio.js"></script>
  <script src="app.js"></script>
</body>
</html>
app.js Responsibilities
js
// 1. Load stories.json on DOMContentLoaded — render landing cards
// 2. On story card click → load data/story-X.json → show player view
// 3. Wire scrubber ↔ AudioEngine.seek()
// 4. Wire Play/Pause button ↔ AudioEngine.play() / AudioEngine.pause()
//    - toggle aria-pressed on the button
//    - toggle button label "▶ Play" / "⏸ Pause"
// 5. Wire speed select → AudioEngine.setRate(value)
// 6. Wire volume slider → AudioEngine.setVolume(value)
// 7. Wire step-back / step-forward buttons → AudioEngine.seek(frameIndex ± 1)
// 8. AudioEngine.onFrame = (i, frame) => {
//      scrubber.value = i;
//      currentDate.textContent = frame.date;
//      currentValue.textContent = `${frame.value.toFixed(2)} ${storyData.units}`;
//      liveReadout.textContent = `Date: ${frame.date}. ${storyData.title}: ${frame.value.toFixed(2)} ${storyData.units}`;
//      map.setDate(frame.date);  // see GIBS tile function below
//    }
// 9. Keyboard shortcuts:
//    - Space → play/pause (prevent default scroll)
//    - ArrowLeft → step back
//    - ArrowRight → step forward
// 10. Build story summary text from storyData:
//    `"Values ranged from ${min} to ${max} ${units} between ${firstDate} and ${lastDate}."`
//    For story 3 specifically: also note the threshold crossing date and peak value.
// 11. Sample tone buttons → call AudioEngine with specific preset values, no full playback
// 12. Back button → hide player, show landing, AudioEngine.dispose()
GIBS Tile Layer (Leaflet)
js
// Confirm the exact URL template from https://nasa-gibs.github.io/gibs-api-docs/
// before wiring this up. The pattern below is illustrative — the exact template
// may differ in the current GIBS documentation.
function createGIBSLayer(layerName, date) {
  // date format: "YYYY-MM-DD"
  const url = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layerName}/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
  return L.tileLayer(url, {
    attribution: 'Imagery provided by services from the Global Imagery Browse Services (GIBS), operated by the NASA/GSFC/Earth Science Data and Information System (ESDIS) with funding provided by NASA/HQ.',
    maxZoom: 9,
    tileSize: 256,
  });
}
// When frame advances, remove old GIBS layer and add new one with updated date:
function updateMapDate(date) {
  if (currentGIBSLayer) map.removeLayer(currentGIBSLayer);
  currentGIBSLayer = createGIBSLayer(currentStory.gibs_layer, date);
  currentGIBSLayer.addTo(map);
}
10. styles.css — Key Requirements
css
/* Accessibility first */
.skip-link {
  position: absolute; left: -9999px;
}
.skip-link:focus {
  left: 1rem; top: 1rem; z-index: 9999;
  padding: 0.5rem 1rem; background: #000; color: #fff;
}
.sr-only {
  position: absolute; width: 1px; height: 1px;
  padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}
/* Focus rings must be clearly visible */
:focus-visible {
  outline: 3px solid #f90; outline-offset: 2px;
}
/* Map */
#map {
  width: 100%; height: 400px;
  border: 2px solid #333;
}
/* Story cards grid */
#story-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.5rem;
  padding: 1rem;
}
.story-card {
  border: 2px solid #ccc; border-radius: 8px; padding: 1rem;
  cursor: pointer; transition: border-color 0.2s;
}
.story-card:hover, .story-card:focus {
  border-color: #0070f3;
}
/* Controls layout */
#controls {
  display: flex; flex-wrap: wrap; gap: 0.75rem;
  align-items: center; padding: 0.75rem 0;
}
#scrubber { flex: 1; min-width: 200px; }
/* Legend */
#legend { margin-top: 1.5rem; padding: 1rem; background: #f5f5f5; border-radius: 6px; }
.sample-btn { margin: 0.25rem; padding: 0.4rem 0.75rem; cursor: pointer; }
/* Dark mode support */
@media (prefers-color-scheme: dark) {
  body { background: #111; color: #eee; }
  .story-card { border-color: #444; }
  #legend { background: #222; }
}
11. Accessibility Checklist (Build These In, Not After)
#	Requirement	Where implemented
1	Every control reachable by Tab in a logical order	index.html DOM order, tabindex only where needed
2	Space = play/pause, Arrow keys = step frame	app.js keydown handler on document
3	ARIA live region announces date + value every frame	#live-readout with aria-live="polite"
4	Play button has aria-pressed toggled	app.js
5	No autoplay on page load or story open	Never call Tone.start() outside user gesture
6	Volume + speed both keyboard-operable	Native <input range> and <select>
7	Legend and sample tones usable before playback	Sample buttons work independently of play state
8	Text summary of full story arc shown	#story-summary auto-generated from data
9	Map region outlined visually	Leaflet rectangle overlay using storyData.area.bbox
10	GIBS attribution shown on map	attribution field in createGIBSLayer()
12. Mapping Unit Tests

Write these as plain JS, runnable in the browser console or with Node.js directly (no test runner needed):

js
// File: tests.js  (not shipped to production)
// Run: node tests.js  OR paste into browser console after loading index.html
function assert(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}
// Mock story data
const mockStory = { min: 10, max: 50, frames: [{ value: 10 }, { value: 30 }, { value: 50 }] };
// Test 1: same value → same pitch
assert(pitchForValue(30, mockStory) === pitchForValue(30, mockStory), "Same input → same pitch");
// Test 2: min value → lowest note (MIDI 48)
assert(pitchForValue(10, mockStory) === 48, "Min value → MIDI note 48 (C3)");
// Test 3: max value → highest note (MIDI 84)
assert(pitchForValue(50, mockStory) === 84, "Max value → MIDI note 84 (C6)");
// Test 4: mid value → between 48 and 84
const mid = pitchForValue(30, mockStory);
assert(mid > 48 && mid < 84, "Mid value → between C3 and C6");
// Test 5: threshold marker fires on crossing, not before
// (Requires AudioEngine mock — verify in app manually)
console.log("All mapping tests passed.");
13. README.md Template
markdown
Earth Jukebox

NASA Space Apps 2026 | Challenge: The Earth Information Jukebox | Solo submission

Earth's climate data, told in sound. Three stories — a seasonal cycle, a long trend, and a sudden event — each sonified so the story can be followed by ear alone while a NASA satellite map advances frame by frame.

Live Demo

https://your-username.github.io/earth-jukebox

NASA Data Used
NASA VEDA (Visualization, Exploration, and Data Analysis): [collection IDs TBD after fetch]
NASA GIBS (Global Imagery Browse Services): tile imagery synced to each data frame
NASA POWER (Prediction of Worldwide Energy Resources): fallback time-series data where used
How to Re-fetch the Data
bash
pip install -r scripts/requirements.txt
python scripts/fetch_veda.py    # writes data/story-*.json
# If a story falls back to POWER:
python scripts/fetch_power.py
Libraries Used
Tone.js v14
 — Web Audio sonification
Leaflet.js v1.9
 — Interactive map
AI Use Disclosure

[Describe any AI-generated code, audio, or data used in this project, as required by NASA Space Apps rules.]

Acknowledgments

Imagery provided by services from the Global Imagery Browse Services (GIBS), operated by the NASA/GSFC/Earth Science Data and Information System (ESDIS) with funding provided by NASA/HQ.

14. Build Order for the Coding Agent

IMPORTANT

Follow this order exactly. Do not start UI work before data files exist. Do not start audio work before the data contract (JSON schema) is locked.

Step 1 — Scaffold repo structure (all files/folders, empty bodies)
Step 2 — Write scripts/fetch_veda.py and fetch_power.py
Step 3 — Confirm VEDA and GIBS endpoints (read their current docs)
Step 4 — Run fetch_veda.py → inspect raw/*.json → fix parser → verify data/*.json
Step 5 — Write stories.json with confirmed collection IDs and GIBS layer names
Step 6 — Write audio.js: implement pitchForValue(), scheduleAll(), marker sound
Step 7 — Write tests.js: run mapping unit tests (must all pass before continuing)
Step 8 — Write index.html: full DOM structure as specified above
Step 9 — Write app.js: load data, wire all controls, ARIA live region, keyboard shortcuts
Step 10 — Write styles.css: layout, accessibility (focus rings, skip link, sr-only)
Step 11 — Wire GIBS Leaflet layer with date updates per frame
Step 12 — Add Leaflet bbox rectangle overlay per story
Step 13 — Implement legend sample tones (independent of playback)
Step 14 — Build story summary text generator
Step 15 — Stereo pan (Tone.Panner) — ONLY if steps 1–14 are complete and time remains
Step 16 — Cross-browser test (Chrome + Firefox minimum)
Step 17 — Accessibility pass: keyboard-only walkthrough all 3 stories
Step 18 — Deploy to GitHub Pages or Netlify Drop
Step 19 — Run tests.js in deployed site's console
Step 20 — Confirm deployed URL opens cleanly in a private/incognito window
15. Deployment
bash
# Option A: GitHub Pages
git init && git add . && git commit -m "Initial build"
git remote add origin https://github.com/YOUR_USERNAME/earth-jukebox.git
git push -u origin main
# Then: GitHub repo Settings → Pages → Branch: main → / (root) → Save
# Option B: Netlify Drop
# Drag the earth-jukebox/ folder (minus scripts/) to https://app.netlify.com/drop

WARNING

Deploy at the end of UI build, not at the very end. Redeploy after each phase so there is always a working public link. Test the GIBS tile layer specifically on the live deployed URL — CORS and HTTPS mixed-content issues only appear there, not in local file:// testing.

16. Risk & Fallback Table
Risk	Fallback
A VEDA collection can't be confirmed or reached	Switch that story to fetch_power.py — never blocked on access
GIBS tile URL behaves unexpectedly	Ship story without live tiles — use a static image of the bbox area
Tone.js unpredictable in one browser	Fall back to raw AudioContext for that story; keep Tone.js for the rest
Phase overruns — fewer than 3 stories working	Ship 2 fully-tested, fully-accessible stories rather than 3 rough ones
UI phase overruns	Cut stereo pan first, then static legend text (drop interactive sample tones)
Demo recording fails close to deadline	Prepare ≤7 slides as a drop-in alternative (no recording/editing needed)
17. Submission Checklist
 Repo is public and the root index.html is served at the GitHub Pages / Netlify URL
 Demo link and project link open without login in a private browser window
 NASA Data field lists: VEDA collection ID(s), GIBS, NASA POWER (if used)
 Resources field lists: Tone.js, Leaflet.js, any other external assets
 AI use disclosed in the project description
 Demo video ≤30 seconds with English subtitles (or ≤7 slides)
 Both required boxes ticked, "Submit for Judging" clicked before 11:59 PM Sun Nov 15 PKT
 Participant certificate downloaded after submitting

Plan authored: 2026-11-14. Deadline: 2026-11-15 23:59 PKT (UTC+5).