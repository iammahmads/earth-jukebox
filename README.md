# 🌍 Earth Jukebox

**NASA International Space Apps Challenge 2026**  
**Challenge:** The Earth Information Jukebox  
**Participation:** Solo Build  
**Live Demo:** [https://ahmad.github.io/earth-jukebox](https://ahmad.github.io/earth-jukebox) *(or open `index.html` directly in any web browser)*

---

## Overview

**Earth Jukebox** is an accessible, modern web application that translates NASA Earth observation time series into multi-dimensional sound (*sonification*), synchronized with real-time visual canvas animations and NASA GIBS satellite imagery.

It allows researchers, students, visually impaired users, and the public to experience climate dynamics **by ear and eye simultaneously**.

---

## 5 Verified NASA Earth Data Stories

| # | Story | Dataset | Period | Synthesis Persona |
|---|---|---|---|---|
| **1** | **Breathing with the Seasons** | Mediterranean Air Temp ($T_{2M}$) | 2018–2023 (72 mo) | **AM Flute + Reverb** (Airy, harmonic orbital cycle) |
| **2** | **A Decadal Drift** | Tokyo Basin Warming ($T_{2M}$) | 2000–2023 (288 mo) | **FM Drift + Ping-Pong Delay** (Slow harmonic shimmer) |
| **3** | **Heat Dome: Pacific Northwest ⭐** | Max Daily Temperature ($T_{2M\_MAX}$) | May–Aug 2021 (123 d) | **Crisis Distortion MonoSynth** (Sharp alert at 38°C / 100°F) |
| **4** | **Amazon Rainfall Pulse** | Amazon Basin Precipitation | 2015–2023 (108 mo) | **Lush PolySynth Rain Pad + Chorus** (Wet/dry breathing) |
| **5** | **Black Summer Bushfires** | NSW Australia Extreme Heat | Jul 2019–Mar 2020 (275 d) | **Wildfire Sawtooth Lead** (Repeated alarms > 40°C) |

---

## Real-Time Audio-Visual Synchronization

### Why Earlier NASA Image Loading Lags Behind Audio:
NASA GIBS operates as a planetary tile server across HTTP. Fetching multiple 256×256 JPEG tiles per frame across live playback causes bandwidth contention and visual lag.

### The Earth Jukebox Solution:
1. **Instant Canvas Data-Viz Overlay:** A GPU-accelerated `<canvas>` is drawn directly over the map at 60 FPS in zero milliseconds. As each note sounds, a color-reactive temperature orb and ripple pulse expand in exact lockstep with Tone.js audio.
2. **Smart GIBS Preloading:** The app samples and pre-caches satellite tile images in the browser cache, debouncing tile updates during rapid playback (1.5s intervals) and instantly locking to the exact tile on pause/scrub.
3. **Live Oscilloscope:** A high-speed Web Audio `AnalyserNode` displays the real-time audio waveform above the map, glowing cyan during normal playback and flashing red during threshold alarms.

---

## Sonification Mathematical Specification

| Data Dimension | Audio Dimension | Mathematical Rule |
|---|---|---|
| **Value** | **Pitch** | Linear mapping from $[min, max]$ to MIDI 48 (C3, 130.8 Hz) through MIDI 84 (C6, 1046.5 Hz). Monotonic pure function. |
| **Spatial Spread** | **Timbre** | Low spread $\rightarrow$ pure sine; medium $\rightarrow$ triangle; high $\rightarrow$ harmonic-rich sawtooth. |
| **Rate of Change** ($\Delta$) | **Tempo** | Dynamic speed from 60 BPM (stable) up to 160 BPM (rapid anomaly). |
| **Threshold Breach** | **Layered Alarm** | Metal bell synth (`C5`) + pink noise burst fires on breach date/value, with a full-screen red flash. |
| **Longitude** | **Stereo Pan** | Longitude mapped from $[-180^\circ, +180^\circ]$ to $[-1.0, +1.0]$ across stereo channels. |

---

## Audio Master Output
- **Boosted Volume:** High-gain master bus with dynamic **Limiter** (`-0.5 dB`) to deliver loud, clear sound without clipping or distortion.
- **Atmospheric Sub-Pad:** Gentle ambient drone beneath each story that slowly shifts pitch with climate baseline changes.

---

## Accessibility & Keyboard Navigation (WCAG 2.1 AA)

- **Screen Reader Announcements:** Dedicated ARIA live region (`#live-readout`, `aria-live="polite"`) speaks date, value, units, and alerts on every frame.
- **Keyboard Shortcuts:**
  - `Space`: Play / Pause toggle
  - `←` / `→`: Step backward / forward one frame
  - `Home` / `End`: Jump to start / end of time series
  - `1`, `2`, `3`, `4`, `5`: Instant switch between the 5 stories
  - `Esc`: Return to catalog
- **Interactive Legend:** Preview Low, Mid, High notes and the Threshold Alarm independently.

---

## How to Run & Verify

```bash
# 1. Run local web server
python3 -m http.server 8000

# 2. Run automated validation suite
python3 scripts/test_mappings.py
```

---

## NASA Citations & Acknowledgments

> *Imagery provided by services from the Global Imagery Browse Services (GIBS), operated by the NASA/GSFC/Earth Science Data and Information System (ESDIS) with funding provided by NASA/HQ.*  
> *Data courtesy of NASA POWER (LaRC) and NASA VEDA.*
