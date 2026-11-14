# 🌍 Earth Jukebox

**NASA International Space Apps Challenge 2026**  
**Challenge:** The Earth Information Jukebox  
**Participation:** Solo Build  
**Live Demo:** [https://ahmad.github.io/earth-jukebox](https://ahmad.github.io/earth-jukebox) *(or open `index.html` directly in any modern web browser)*

---

## Overview

**Earth Jukebox** is a fully accessible, static web application that translates NASA Earth science observations into sound (*sonification*), synchronized with a frame-by-frame satellite map display from NASA GIBS. It allows researchers, students, visually impaired users, and the public to experience climate dynamics **by ear alone**.

The app showcases three distinct time series shapes specified in the challenge brief:
1. **Seasonal Cycle:** Mediterranean Annual Temperature Cycle (2018–2023) — rhythmic harmonic wave echoing Earth's orbital tilt.
2. **Long Trend:** Tokyo Decadal Climate Drift (2000–2023) — 24-year progressive upward baseline shift.
3. **Sudden Event ⭐ (Primary Showcase):** 2021 Pacific Northwest Heat Dome (May–August 2021) — calm spring baseline violently shattered in late June, triggering a percussive alert chime as temperatures cross 38°C (100°F) and soar to 39.3°C.

---

## Sonification Mapping Specification

Every frame is rendered in real time into Web Audio dimensions using pure mathematical mappings:

| Data Dimension | Audio Dimension | Mathematical Rule |
|---|---|---|
| **Value** (e.g. Temperature in °C) | **Pitch** | Linear mapping from $[min, max]$ to MIDI 48 (C3, 130.8 Hz) through MIDI 84 (C6, 1046.5 Hz). Monotonic and deterministic. |
| **Spatial Spread** (Variability) | **Timbre** | Low spread $\rightarrow$ pure sine wave; medium spread $\rightarrow$ triangle wave; high spread $\rightarrow$ harmonic-rich sawtooth wave. |
| **Rate of Change** ($\Delta$ value) | **Tempo** | Dynamic playback speed from 60 BPM (stable conditions) up to 160 BPM (rapid anomalies). |
| **Threshold Crossing** | **Percussive Alert** | Distinct membrane kick chime fires precisely when the value breaches critical thresholds (e.g., 38°C). |
| **Longitude** | **Stereo Pan** | Longitude mapped from $[-180^\circ, +180^\circ]$ to $[-1.0, +1.0]$ across stereo channels. |

---

## Accessibility (WCAG 2.1 AA Compliant)

Designed from the ground up for universal access:
- **ARIA Live Region:** Dedicated `#live-readout` with `aria-live="polite"` announces date, numerical value, units, and threshold alerts for screen-reader users on every frame.
- **Full Keyboard Navigation:**
  - `Space`: Play / Pause toggle
  - `←` / `→`: Step back / forward one frame
  - `Home` / `End`: Jump to beginning / end of time series
  - `1`, `2`, `3`: Instant switch between the 3 stories
  - `Esc`: Return to story selection catalog
- **Interactive Legend:** Sample buttons allow listening to low, mid, high, and alert tones independently without running full playback.
- **No Autoplay:** Audio initializes strictly following an explicit user click/keypress in compliance with browser Web Audio policies.
- **High-Contrast Focus Outlines:** High visibility `:focus-visible` rings throughout.

---

## NASA Data & Imagery Sources

- **NASA POWER (Prediction of Worldwide Energy Resources):** Daily and monthly air temperature ($T_{2M}$, $T_{2M\_MAX}$) point and regional time series.
- **NASA GIBS (Global Imagery Browse Services):** Dynamic satellite imagery tile layer (`MODIS_Terra_CorrectedReflectance_TrueColor`) updated synchronously with each frame's observation date.
- **NASA VEDA (Visualization, Exploration, and Data Analysis):** Catalog and raster statistics architecture.

### Data Verification & Re-fetch

All data is pre-cached in static JSON files (`data/*.json`) so the demo never fails on live network constraints or rate limits.

To re-fetch or update the datasets:
```bash
pip install -r scripts/requirements.txt
python scripts/fetch_power.py
python scripts/test_mappings.py
```

---

## Technical Stack

- **Zero Build Step:** Plain HTML5, CSS3, and modern Vanilla JavaScript.
- **Audio Synthesis:** [Tone.js v14](https://tonejs.github.io/) via CDN.
- **Mapping:** [Leaflet.js v1.9](https://leafletjs.com/) via CDN with NASA GIBS WMTS endpoint.
- **Hosting:** Fully static (GitHub Pages, Netlify, or local web server).

---

## AI Disclosure

In accordance with NASA Space Apps Challenge guidelines: AI coding assistants were utilized for script generation, dataset parsing, and accessibility structure verification under the direction and supervision of the solo participant.

---

## Acknowledgments & Citations

> *Imagery provided by services from the Global Imagery Browse Services (GIBS), operated by the NASA/GSFC/Earth Science Data and Information System (ESDIS) with funding provided by NASA/HQ.*
