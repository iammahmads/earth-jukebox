Earth Jukebox — Solo Build Plan

Scope and summary
Build Earth Jukebox solo for NASA Space Apps 2026, answering The Earth Information Jukebox challenge: a static, accessible web app that sonifies 3 NASA Earth-data time series while a synced map frame advances, so the story can be followed by ear alone.
Scope decisions made up front, not left for the final hours:
• 3 stories, not 4. The brief's own fallback ("if time runs out, ship three stories") is the starting plan for a solo build, not a stretch goal.
• Cache first, build second. Every dataset is fetched once and saved as static JSON before any UI code is written; the live app and the demo make zero external API calls.
• No backend. The whole thing ships as static files — one less thing to deploy, debug or explain to judges.
• Stereo pan is the first cut, not the last addition — build it last, and if Phase 5 of the schedule below runs over, skip it and move on.
• Target tier: Intermediate / Beginner & Youth (the levels listed for this challenge). Re-check the exact brief once the 2026 Project Submission Guide and per-challenge resources publish, since the full challenge statement was unreachable when this plan was written.
• Eligibility: to qualify for a Global Award, the NASA Data field on the submission page must name the NASA datasets/APIs actually used (VEDA, GIBS, and NASA POWER if used as a fallback).
Tech stack and architecture
No backend and no build step: a one-time Python script caches NASA data as JSON, and a static front end renders, scrubs and sonifies it.
• Data prep (offline, run once): Python 3 + requests, fetching VEDA Raster API statistics, NASA POWER point time series, and GIBS tile metadata, written to /data/*.json
• Frontend: plain HTML/CSS/JS, no framework and no bundler — a coding agent can open index.html directly
• Audio: Tone.js (loaded from a CDN) over the Web Audio API — Tone.Synth for pitch, Tone.Transport for tempo/timing, Tone.Panner for stereo pan (cut first if time is short)
• Map: Leaflet.js (CDN) with a NASA GIBS WMTS tile layer for the frame background
• Hosting: static files only — GitHub Pages, Netlify drag-and-drop, or Vercel static; no server, no login wall
The demo never calls a live API: every number the audio engine and map use comes from the cached JSON, so a rate limit or a flaky connection on demo day cannot break it.
Repository and folder structure
One repo, flat and static — no build tool, no node_modules to commit.
earth-jukebox/
├── index.html              # the whole app shell: map, scrubber, legend, controls
├── styles.css
├── app.js                  # frame scrubber, UI wiring, accessibility live region
├── audio.js                # Tone.js engine: mapping spec implemented here
├── stories.json            # story metadata: title, dataset, units, mapping ranges
├── data/
│   ├── story-1-seasonal.json
│   ├── story-2-trend.json
│   └── story-3-event.json
├── scripts/
│   ├── fetch_veda.py       # pulls VEDA Raster API stats per story, writes data/*.json
│   ├── fetch_power.py      # NASA POWER fallback fetch
│   └── requirements.txt
├── assets/
│   └── favicon.ico
└── README.md               # NASA data credits, how to re-run the fetch scripts
Keep scripts/ out of the deployed site, or deploy only index.html, styles.css, app.js, audio.js, stories.json, data/ and assets/ — the fetch scripts and any API keys never need to ship.
Data sources and setup
Source
What it gives this app
Access
Used by
VEDA STAC + Raster API
Per-time-step statistics for an area of interest, for Earth datasets in the VEDA catalog
No credentials; confirm the exact endpoint in the current VEDA API docs before coding
Stories 1–3 (primary)
GIBS WMTS
Map tile imagery matching each frame's date
Public WMTS/tile endpoint; confirm the exact URL template in the GIBS API docs and include the acknowledgment line it asks for
Map background behind the scrubber
NASA POWER
Daily/monthly point time series (temperature, precipitation, solar, 300+ parameters), 1981/1984–present, no auth, CC BY 4.0
Public REST API: https://power.larc.nasa.gov/api/temporal/daily/point with parameters, community, longitude, latitude, start, end, format=JSON
Fallback for any story if a VEDA dataset isn't reachable in time
api.nasa.gov
Only needed if a story ends up using a different NASA API (e.g. EONET for events)
No key to explore; free key = 1,000 req/hr, DEMO_KEY = 30/hr and 50/day per IP
Optional
Setup before writing any fetch code:
1.  Confirm the VEDA Raster API's current base URL and the exact area-of-interest statistics endpoint from VEDA's own docs — do not hand-build this URL from memory.
2.  Confirm the GIBS tile URL template and required attribution text from the GIBS API docs page.
3.  No signup is needed for VEDA, GIBS or NASA POWER as planned here; get a free api.nasa.gov key only if a story needs it.
4.  Put nothing secret in client-side code — none of the above needs a key, but if one is ever added, keep it server-side or out of the shipped repo entirely (the challenge's own rules warn that your repo and project page are public).
Story selection: the 3 stories to build
Each has a clear shape, per the brief's own list (seasonal cycle, long trend, sudden event), and each is checkable against its own source.
#
Shape
Candidate dataset
Area
Why this shape
1
Seasonal cycle
A VEDA ocean or land dataset with a strong annual cycle (e.g. sea-surface temperature or a vegetation index) — confirm the exact collection in the VEDA STAC catalog
One ocean or land region with a clean yearly pattern
A listener should hear the same shape repeat each year
2
Long trend
A VEDA dataset with a multi-year warming/drying/greening trend, or NASA POWER temperature for one point over 20+ years as fallback
One region with a documented long-term change
A listener should hear pitch drift steadily across the piece
3
Sudden event
A VEDA dataset covering one dated event (a heatwave, a flood, a fire season) with a sharp before/after
One region, one bounded event window
A listener should hear a clear marker sound at the threshold crossing
Pick each dataset by searching the VEDA STAC catalog for these three shapes, confirm its id, time range and spatial extent, and record the exact collection id in stories.json and in the project page's NASA Data field. If a candidate VEDA dataset is not reachable in time, fall back to a NASA POWER point series for that story — it is slower to set up as a map story but never fails on access.
Sonification mapping spec
Write this spec into the app itself (a visible, playable legend), not only into the code — the brief asks for it to be shown, and it is also what the unit tests in the Testing section check against.
Data dimension
Sound dimension
Rule
Value (the story's own measurement)
Pitch
Monotonic mapping to a fixed note range per story (the story's own min → lowest note, max → highest note); the range stays fixed for that story's whole playback
Spread / variability across the area
Timbre
Low spread → a pure tone (sine); high spread → a richer tone (added harmonics or a different oscillator type)
Rate of change between frames
Tempo
Faster change → faster playback tempo for that stretch; steady periods play at a slower, even tempo
A threshold crossing (above the seasonal norm, past the event date)
Marker sound
One short, distinct percussive hit the instant the threshold is crossed, separate from the continuous tone
Longitude across the frame (stretch only)
Stereo pan
Left edge of frame → left channel, right edge → right channel; cut first if time is short
Rules that keep it checkable (used directly in the Testing section):
• The same input value always produces the same pitch — the mapping is a pure function of (story, value), nothing else
• The story's minimum value always produces the lowest note in its range, and the maximum always produces the highest
• Units, dataset name and version are shown on screen next to every story, beside the legend
Legend: before each story plays, show the mapping as both text ("low pitch = cooler / less flooded", etc.) and a few sample tones the user can trigger on demand.
Data-prep script spec
One script per source, run once before any UI work starts (python scripts/fetch_veda.py, python scripts/fetch_power.py), each writing one JSON file per story into data/.
Each output file follows one shared shape, so audio.js and app.js only need to understand one format regardless of source:
{
  "story_id": "story-1-seasonal",
  "title": "...",
  "dataset": "<exact dataset/collection id>",
  "source": "VEDA",
  "units": "...",
  "area": {"name": "...", "bbox": [west, south, east, north]},
  "min": 0.0,
  "max": 0.0,
  "threshold": null,
  "frames": [
    {"date": "YYYY-MM-DD", "value": 0.0, "spread": 0.0}
  ]
}
• min/max are computed from the story's own frames, not guessed — this is what the mapping spec's pitch range is built from
• spread is the area statistic's standard deviation or IQR, whichever the chosen API returns
• threshold, when the story has one (story 3's event), is the value or date the marker sound fires on
• Cache every raw API response to disk on first fetch (a raw/ subfolder is fine) before transforming it, so a second run never re-hits the API
• Log a one-line summary per story when the script finishes ("story-1-seasonal: 48 frames, 2018-01 to 2026-10") so a bad fetch is obvious immediately, not discovered during UI work
Audio engine spec (audio.js)
Built on Tone.js, loaded from a CDN script tag — no bundler needed.
• One Tone.Synth (or Tone.PolySynth if a story ever needs more than one voice) per story, created when that story is selected and disposed when it is not
• A Tone.Transport schedules one note per frame; tempo for a given stretch is set from that stretch's rate of change, per the mapping spec
• A Tone.Panner is added last, after everything else works, wired to longitude across the frame
• A short, distinct marker sound (a separate Tone.MembraneSynth or Tone.NoiseSynth hit) fires exactly on a threshold-crossing frame
• Playback exposes: play(), pause(), a setStory(storyId) that loads a new story's cached JSON and rebuilds the synth with its fixed pitch range, and a setRate(multiplier) for the adjustable-speed control
• Nothing in this file makes a network call — it only reads the already-cached data/*.json
• No autoplay: audio starts only on an explicit user action (a Play button or Space key), per the accessibility rules below and per browsers' own autoplay restrictions
UI and frame scrubber spec (index.html / app.js)
One page, three stories reachable from a landing view.
• Landing: story picker (3 cards: title, one-line description, thumbnail), each opens that story's player
• Player, per story:
    ◦ A Leaflet map showing the GIBS tile layer for the current frame's date, with the story's area outlined
    ◦ A frame scrubber: a horizontal slider plus Play/Pause, stepping through frames in order
    ◦ The legend from the mapping spec, with sample tones the user can trigger without starting playback
    ◦ A speed control and a volume control
    ◦ A text readout of the current frame's date, value and units, updated every frame
• Keyboard: Space = play/pause, arrow keys = step one frame back/forward, every control reachable by Tab in a sensible order
• State: which story is open and the current frame index live in page variables, not localStorage — this is a single-session demo tool, not something that needs to remember a visitor between visits
• Precompute nothing at runtime that the data-prep script already computed (min/max, spread) — app.js only reads and displays what's in the JSON
Accessibility requirements
This is the project's strongest Presentation and Creativity argument — treat it as a requirement, not a polish pass.
[ ] Every control reachable and operable by keyboard alone (Tab order, Space, arrow keys as above)
[ ] An ARIA live region announces the current date and value as playback advances, so a screen-reader user can follow without looking at the map
[ ] A text summary of what changed over the story's full run ("values rose steadily from X to Y between 2018 and 2026") shown alongside the player
[ ] Adjustable playback speed and volume, both keyboard-operable
[ ] No autoplay on page load or story open
[ ] Legend and sample tones are usable before committing to a full playback
[ ] Tested with a screen reader (VoiceOver on Mac or NVDA on Windows) at least once before submission
[ ] The 30-second demo video carries English subtitles describing what the sound is doing, as the challenge's submission guide requires on video demos
Testing and validation plan
• Mapping unit tests (plain JS, run with Node or in-browser console): same input value → same pitch every time; the story's minimum value → the lowest note in its range; the maximum → the highest; a value outside the cached min/max never occurs (the data-prep script computes the range from the full dataset)
• Data checks: for each story, confirm frame count, date range and units against the source dataset's own listing page before building the UI around it
• Cross-browser check: open the deployed site in at least two browsers (Chrome + one other); Web Audio autoplay policies differ, so confirm Play requires a click in both
• Accessibility check: keyboard-only pass through all three stories; one screen-reader pass
• Demo rehearsal: time the 30-second script below against a clock at least twice before recording
• Link check: open the deployed site and the submission's demo link in a private/incognito window — the project page cannot take uploads, and judges open public links cold
Hour-by-hour build schedule
Submission closes Sunday, Nov 15 at 11:59 PM local time; from now (Sat, Nov 14, ~11:47 AM) that leaves about 36 hours. The block below assumes that deadline is in your own local time — confirm against your Local Event's actual time zone if it differs.
Phase
Window
Hours
Deliverable
0. Setup
Sat 11:47 AM–1:00 PM
~1
Registered, solo team confirmed, repo created, Space Apps account/event verified
1. Data research
Sat 1:00–5:00 PM
4
3 confirmed VEDA/POWER datasets, GIBS tile template confirmed, one test fetch per source working
2. Data-prep scripts
Sat 5:00–10:00 PM
5
fetch_veda.py / fetch_power.py written; data/*.json cached for all 3 stories; min/max/spread verified
3. Rest (flexible)
Sat 10:00 PM–Sun 7:00 AM
9
Optional — shift earlier phases later if you work through this block instead
4. Audio engine
Sun 7:00–11:00 AM
4
audio.js working end to end for one story: pitch, timbre, tempo, marker sound
5. UI build
Sun 11:00 AM–3:00 PM
4
Map, scrubber, legend, controls working for all 3 stories; stereo pan only if time allows
6. Accessibility pass
Sun 3:00–6:00 PM
3
Every item in the Accessibility checklist above ticked
7. Testing + demo recording
Sun 6:00–8:00 PM
2
Testing plan run; demo video or slide deck recorded with subtitles
8. Polish + deploy
Sun 8:00–10:00 PM
2
Final deploy live; all project-page fields drafted
9. Submit + buffer
Sun 10:00–11:59 PM
~2
Submitted, certificate downloaded, buffer for last-minute issues
Freeze scope at the end of Phase 5 (Sun 3:00 PM): whatever isn't working by then goes in the "if time runs out" column of the Risk table below, not into Sunday evening.
Deployment plan
• Push the repo (minus scripts/, if preferred) to GitHub
• Enable GitHub Pages on the main branch root, or drag the folder into Netlify Drop — either gives a public URL with no login wall, which the submission requires
• Test the deployed URL in a private browser window exactly as a judge would open it
• Deploy early (end of Phase 5) and redeploy after each later phase, so there is always a working public link even if a later phase runs short
• Confirm the GIBS tile layer loads over HTTPS from the deployed domain — mixed-content or CORS issues show up only once it's live, not in local testing
Demo script (30 seconds, matches the submission guide's structure)
1.  0:00 — name, team (solo), the challenge chosen and why
2.  0:05 — project title and one-line tagline
3.  0:10 — show it working: open a story, press play, let the sound and the map frame advance together for a few seconds; name the NASA data behind it
4.  0:20 — one sentence on what it could do next (more datasets, a mobile version, live data)
Record with English subtitles describing what the sound is doing at each moment — the submission guide requires subtitles on video demos. Rehearse against a clock at least twice; up to 7 slides is the alternative format if a clean video proves hard to get.
Submission checklist
[ ] Registered for Space Apps 2026 and confirmed the chosen Local Event or the Universal Event (not waitlisted)
[ ] Solo team created before Saturday's Project tab opened
[ ] Every project-page field filled: name, high-level summary, demo link, final project link, detailed description, NASA data, other data, AI use
[ ] NASA Data field names every dataset/API actually used (VEDA collection id(s), GIBS, NASA POWER if used) and how
[ ] Every external resource listed in the resources field (Tone.js, Leaflet, any code or images not written from scratch)
[ ] Any AI-generated code, audio or data disclosed in the description; any AI-generated image or video watermarked; no NASA logos or mission identifiers used as branding
[ ] Demo link and project link are public, need no login, and were opened in a private browser window to confirm
[ ] Demo video is 30 seconds or fewer with English subtitles (or ≤7 slides instead)
[ ] Both required boxes ticked (terms, original work), Submit for Judging clicked, before 11:59 PM local time Sunday
[ ] Participant certificate downloaded from the profile page after submitting
Risk mitigation and fallback plan
Risk
Fallback
A chosen VEDA dataset can't be confirmed or reached in time
Switch that story to a NASA POWER point series — slower to make map-interesting but never blocked on access
GIBS tile URL/template doesn't behave as expected
Ship the story without the live map frame — use a static image of the area instead, and say so plainly in the description
Tone.js audio behaves unpredictably across browsers
Fall back to the raw Web Audio API for the one story giving trouble; keep Tone.js for the rest
Running out of time before all 3 stories are polished
Ship 2 fully accessible, fully tested stories rather than 3 rough ones — Validity and Presentation reward a defensible build over a broad one
Phase 5 (UI) overruns
Cut stereo pan first, then cut the sample-tone legend interactivity (keep it as static text) before cutting anything in the Accessibility section
Demo recording goes wrong close to the deadline
Have the 7-slide format ready as a drop-in alternative to a video, since it needs no recording or editing
Sources to cite in the submission
• NASA Space Apps 2026: the challenge brief for The Earth Information Jukebox, and the 2026 Project Submission Guide once published
• VEDA data services — find the current docs URL when selecting datasets (search for the VEDA/openveda documentation directly, rather than relying on a link from memory)
• NASA GIBS API documentation, including the acknowledgment line it requires
• NASA POWER API documentation, if used as a fallback source
• NASA's own note on data sonification, and any sonification mapping convention used as prior art — cite it and say how this project's mapping differs
• Tone.js and Leaflet.js, listed as external libraries in the submission's resources field
All of the above must also appear, named plainly, in the project page's NASA Data and resources fields — not only here.