# 🌍 Earth Jukebox

**NASA International Space Apps Challenge 2026**  
**Challenge:** The Earth Information Jukebox  
**Participation:** Solo Build  
**Live Demo:** [https://ahmad.github.io/earth-jukebox](https://ahmad.github.io/earth-jukebox) *(or open `index.html` directly in any modern browser)*

---

## Overview

**Earth Jukebox** is an applied climate sonification workstation that translates NASA Earth science observations into sound (*sonification*), synchronized with real-time canvas visualizers, precision haptics, and satellite imagery from NASA GIBS.

It transforms silent, inaccessible GIS datasets into an audible, tactile, and voice-operable experience for researchers, educators, and visually impaired individuals worldwide.

---

## 🎙️ Voice Control & 🎛️ Synaptics Haptic Interface

True to the jukebox concept, users can operate Earth Jukebox completely **hands-free via Voice Commands** or through **Synaptics Precision Haptic & Touchpad Gestures**:

### 1. Hands-Free Voice Control (Web Speech API)
Click **`🎤 Voice Control: OFF`** in the top navigation bar (or press `V`) to activate continuous microphone listening:
- **Playback:** *"Play"*, *"Pause"*, *"Stop"*, *"Resume"*
- **Navigation:** *"Next"*, *"Back"*, *"Previous"*, *"Forward"*
- **Story Selection:** *"Story 1"*, *"Story 2"*, *"Story 3"*, *"Story 4"*, *"Story 5"*
- **Direct Event Jumps:** *"Heat dome"*, *"Amazon"*, *"Australia"*, *"Seasons"*, *"Tokyo"*
- **Workstation Tools:** *"Explorer"*, *"Comparator"*, *"Scanner"*, *"Accessibility Lab"*
- **Autonomous Sonar:** *"Run scan"*, *"Detect anomalies"*
- **Audio Tuning:** *"Faster"*, *"Slower"*, *"Normal speed"*, *"Louder"*, *"Quieter"*
- **Diagnostics & Catalog:** *"Report"*, *"Export"*, *"Catalog"*, *"Home"*

*A live floating HUD toast displays speech recognition status and confirmed voice intent.*

### 2. Synaptics Precision Haptic & Touchpad Gestures
- **Synaptics Haptic Scrubbing Zone:** Slide or drag across the interactive trackpad pad to glide across frames with physical acoustic resistance.
- **Precision Trackpad Two-Finger Horizontal Swipe:** Swipe left/right on any laptop precision touchpad to advance or rewind frames with inertial momentum.
- **Two-Finger Tap / Double-Click:** Instantly toggles Play and Pause.
- **Physical Haptic Clicks (`navigator.vibrate`):**
  - **8 ms micro-tick:** Tactile pulse on every frame step so blind users *feel* every data observation boundary.
  - **[40ms, 30ms, 80ms] Anomaly Shockwave:** Distinctive double-pulse vibration fires the instant a critical climate threshold is breached!

---

## 4 Real-World Applied Scientific Workstation Modes

| Mode | Real-World Problem Solved | Built-In Capability |
|---|---|---|
| 🎯 **Mission Explorer** | NASA satellite imagery bandwidth lag | Instant 60 FPS Canvas Data-Viz overlay + 60 FPS Web Audio Oscilloscope + Synchronized GIBS Tiles |
| ⚖️ **Binaural Era Comparator** | Abstract line graphs fail to convey climate divergence | **Left Ear = 2000s Baseline** vs **Right Ear = 2020s Current Anomaly**. Stable climate = harmonic unison; warming = acoustic dissonance and beating |
| 🔍 **Aural Anomaly Scanner** | Human eyes suffer visual fatigue scanning thousands of pixels | High temporal resolution of hearing ($2\text{--}5\text{ ms}$) spots micro-transients. Automates $>2\sigma$ outlier detection with acoustic sonar pings and interactive shockframe logs |
| ♿ **Accessible Earth Lab** | 2.2 billion blind and low-vision individuals locked out of GIS maps | Acoustic Pitch Ruler (C3 to C6) + Audio Descriptive Verbalizer speaking rate-of-change and climate velocity |

---

## 5 Global NASA Earth Observation Datasets

1. **Breathing with the Seasons:** Mediterranean Air Temperature ($T_{2M}$, 2018–2023) — *AM Flute + Reverb*
2. **A Decadal Drift:** Tokyo 24-Year Urban Warming ($T_{2M}$, 2000–2023) — *FM Drift + Delay*
3. **Heat Dome: Pacific Northwest ⭐:** British Columbia Record Heat Anomaly ($T_{2M\_MAX}$, May–Aug 2021) — *Crisis Distortion Synth*
4. **Amazon Rainfall Pulse:** Amazon Rainforest Precipitation (`PRECTOTCORR`, 2015–2023) — *Lush Rain Pad + Chorus*
5. **Black Summer Bushfires:** New South Wales Catastrophic Wildfire Heat ($T_{2M\_MAX}$, 2019–2020) — *Sawtooth Wildfire Lead*

---

## Diagnostics Export & Provenance
Click **`📋 Export Science Report`** to generate and copy/download a standardized NASA scientific assessment report detailing dataset distribution, $Z$-score deviations, detected shockframes, and accessibility equations.

---

## Quickstart & Verification

```bash
# 1. Run local web server
python3 -m http.server 8000

# 2. Run automated validation suite (all 18 unit tests pass)
python3 scripts/test_mappings.py
```
Open **`http://localhost:8000`** in your browser.

---

## Citations & Acknowledgments

> *Imagery provided by services from the Global Imagery Browse Services (GIBS), operated by the NASA/GSFC/Earth Science Data and Information System (ESDIS) with funding provided by NASA/HQ.*  
> *Climate data courtesy of NASA POWER (LaRC) and NASA VEDA.*
