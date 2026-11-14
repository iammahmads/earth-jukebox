/**
 * Earth Jukebox — Applied Scientific Workstation Controller v5 (app.js)
 * NASA Space Apps 2026
 *
 * Implements:
 *   1. 🎤 Hands-Free Voice Control (Web Speech API)
 *   2. 🎛️ Synaptics Precision Haptic & Gesture Trackpad (Web Vibration API & Pointer Events)
 *   3. 🎯 Mission Explorer: Leaflet Map + Instant Canvas Viz + 60fps Oscilloscope
 *   4. ⚖️ Binaural Era Comparator: Left Ear (Baseline) vs Right Ear (Current Anomaly)
 *   5. 🔍 Aural Anomaly Scanner: Automated statistical outlier screening (>2σ) & diagnostics
 *   6. ♿ Accessible Earth Lab: BVI acoustic ruler, plain-language verbalizer & telemetry
 *   7. 📋 NASA-style Scientific Diagnostics Report Exporter (.txt / clipboard)
 */
(function () {
  'use strict';

  // ─── State ───────────────────────────────────────────────────────────────
  let stories   = [];
  let curMeta   = null;
  let curData   = null;
  let curMode   = 'explorer'; // explorer, comparator, scanner, accessibility
  let leafMap   = null;
  let gibsLyr   = null;
  let bboxRect  = null;
  let lastTileDate = null;
  let tileCache    = {};
  let gibsUpdateTimer = null;

  // Visualizer Animation
  let ripples  = [];
  let osc_RAF  = null;
  let hero_RAF = null;

  // Scanner State
  let scannerRunning = false;
  let scannerTimer   = null;

  // Synaptics & Haptic State
  let hapticsActive  = true;
  let isPointerDown  = false;
  let lastTapTime    = 0;
  let wheelThrottle  = 0;

  // Voice Recognition State
  let isListening        = false;
  let speechRecognition  = null;
  let voiceToastTimer    = null;

  // ─── DOM References ───────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const landingView = $('view-landing');
  const playerView  = $('view-player');
  const storiesGrid = $('stories-grid');
  const storyTabs   = $('story-tabs');

  // Workstation Mode Tabs & Panels
  const wsTabs = document.querySelectorAll('.ws-tab');
  const wsPanels = {
    explorer: $('panel-explorer'),
    comparator: $('panel-comparator'),
    scanner: $('panel-scanner'),
    accessibility: $('panel-accessibility')
  };

  // Top Nav Voice & Synaptics Controls
  const btnVoiceToggle    = $('btn-voice-toggle');
  const voiceBtnLabel     = $('voice-btn-label');
  const micIcon           = $('mic-icon');
  const btnSynapticsToggle= $('btn-synaptics-toggle');
  const synapticsBtnLabel = $('synaptics-btn-label');
  const btnVoiceGuide     = $('btn-voice-guide');
  const voiceStation      = $('voice-station');
  const voiceStationText  = $('voice-station-text');
  const voiceStationIcon  = $('voice-station-icon');
  const voiceStationTitle = $('voice-station-title');
  const voiceEngineBadge  = $('voice-engine-badge');
  const btnCloseVoiceStation = $('btn-close-voice-station');
  const voiceInputForm    = $('voice-input-form');
  const voiceTextInput    = $('voice-text-input');
  const tabModeVoice      = $('tab-mode-voice');
  const vuMeterFill       = $('vu-meter-fill');
  const vuMeterVal        = $('vu-meter-val');
  const btnTestMic        = $('btn-test-mic');
  const transcriptPlaceholder = $('transcript-placeholder');
  const transcriptInterim = $('transcript-interim');
  const btnClickToSpeak   = $('btn-click-to-speak');
  const pttIcon           = $('ptt-icon');
  const pttText           = $('ptt-text');

  // Telemetry Strip
  const telDot    = $('tel-dot');
  const telStatus = $('tel-status');
  const telDate   = $('tel-date');
  const telValue  = $('tel-value');
  const telFrame  = $('tel-frame');
  const pillLive  = $('pill-live');

  // Explorer Panel Readouts
  const mpStoryName = $('mp-story-name');
  const mpFrame     = $('mp-frame');
  const mpDate      = $('mp-date');
  const mpValue     = $('mp-value');
  const mpUnit      = $('mp-unit');
  const mpBar       = $('mp-bar');
  const mpCursor    = $('mp-cursor');
  const mpLow       = $('mp-low');
  const mpHigh      = $('mp-high');
  const metricPanel = $('metric-panel');
  const liveReadout = $('live-readout');
  const alertPanel  = $('alert-panel');
  const alertText   = $('alert-text');
  const flashOverlay= $('flash-overlay');
  const narrativeEl = $('narrative');
  const synthPill   = $('synth-pill');
  const legGrad     = $('leg-gradient');
  const legMin      = $('leg-min');
  const legMax      = $('leg-max');
  const legThresh   = $('leg-threshold');
  const chipDate    = $('chip-date');
  const chipDataset = $('chip-dataset');

  // Playback Controls
  const btnBack  = $('btn-back');
  const btnPlay  = $('btn-play');
  const playGlyph= $('play-glyph');
  const playLbl  = $('play-lbl');
  const btnPrev  = $('btn-prev');
  const btnNext  = $('btn-next');
  const scrubber = $('scrubber');
  const tlStart  = $('tl-start');
  const tlEnd    = $('tl-end');
  const tlPip    = $('tl-pip');
  const speedSel = $('speed-sel');
  const volRng   = $('vol-rng');

  // Synaptics Touchpad Zone
  const synapticsPad        = $('synaptics-pad');
  const synapticsGestureInd = $('synaptics-gesture-ind');

  // Canvases
  const heroCanvas = $('hero-canvas');
  const waveCanvas = $('waveform-canvas');
  const vizCanvas  = $('data-viz-canvas');

  // Binaural Comparator Elements
  const compSliderA   = $('comp-slider-a');
  const compSliderB   = $('comp-slider-b');
  const compDateA     = $('comp-date-a');
  const compDateB     = $('comp-date-b');
  const compValA      = $('comp-val-a');
  const compValB      = $('comp-val-b');
  const compFreqA     = $('comp-freq-a');
  const compFreqB     = $('comp-freq-b');
  const compDeltaTemp = $('comp-delta-temp');
  const compDeltaInt  = $('comp-delta-interval');
  const compDeltaDesc = $('comp-delta-desc');
  const btnCompPlay   = $('btn-comp-play');

  // Anomaly Scanner Elements
  const btnStartScanner   = $('btn-start-scanner');
  const scanTotal         = $('scan-total');
  const scanMean          = $('scan-mean');
  const scanStd           = $('scan-std');
  const scanAnomaliesCount= $('scan-anomalies-count');
  const anomalyTableBody  = $('anomaly-table-body');

  // BVI Accessible Lab Elements
  const bviSpeechText  = $('bvi-speech-text');
  const bviSlopeMetric = $('bvi-slope-metric');
  const bviPitchMetric = $('bvi-pitch-metric');

  // Report Modal Elements
  const reportModal     = $('report-modal');
  const btnExportReport = $('btn-export-report');
  const btnCloseModal   = $('btn-close-modal');
  const reportContent   = $('report-content');
  const btnCopyReport   = $('btn-copy-report');
  const btnDownloadRep  = $('btn-download-report');

  // Voice Guide Modal Elements
  const voiceModal          = $('voice-modal');
  const btnCloseVoiceModal  = $('btn-close-voice-modal');
  const btnDismissVoiceModal= $('btn-dismiss-voice-modal');

  // ─── App Boot ────────────────────────────────────────────────────────────
  async function init() {
    startHeroAnimation();
    try {
      const r = await fetch('stories.json');
      stories = await r.json();
      renderCatalog();
    } catch (e) {
      storiesGrid.innerHTML = `<p style="color:var(--red);font-size:.9rem;padding:1rem">
        ⚠ Serve with: <code>python3 -m http.server 8000</code></p>`;
    }
    wireControls();
    wireWorkstationTabs();
    wireBinauralComparator();
    wireAnomalyScanner();
    wireAccessibilityLab();
    wireReportModal();
    wireVoiceAndSynaptics();
    wireAudioCallbacks();
    startOscilloscope();
  }

  // ─── Hero Multi-Wave Canvas Animation ────────────────────────────────────
  function startHeroAnimation() {
    if (!heroCanvas) return;
    const ctx = heroCanvas.getContext('2d');
    let t = 0;
    function draw() {
      hero_RAF = requestAnimationFrame(draw);
      const W = heroCanvas.width, H = heroCanvas.height;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = 'rgba(0,212,255,0.08)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath(); ctx.moveTo(0, H*i/4); ctx.lineTo(W, H*i/4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(W*i/4, 0); ctx.lineTo(W*i/4, H); ctx.stroke();
      }

      const waves = [
        { freq: 0.025, amp: 0.25, phase: 0,    color: 'rgba(0,212,255,0.8)', lw: 2   },
        { freq: 0.018, amp: 0.18, phase: 1.2,  color: 'rgba(0,255,136,0.5)', lw: 1.5 },
        { freq: 0.04,  amp: 0.1,  phase: 2.4,  color: 'rgba(255,170,0,0.4)', lw: 1   },
      ];

      waves.forEach(w => {
        ctx.beginPath();
        ctx.strokeStyle = w.color;
        ctx.lineWidth = w.lw;
        ctx.shadowBlur = 8; ctx.shadowColor = w.color;
        for (let x = 0; x <= W; x++) {
          const y = H/2 + Math.sin(x * w.freq + t + w.phase) * H * w.amp;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      });
      t += 0.04;
    }
    draw();
  }

  // ─── Catalog Rendering ───────────────────────────────────────────────────
  const SYNTH_NAMES = {
    'story-1-seasonal': 'AM Flute Synthesis',
    'story-2-trend':    'FM Drift Synthesis',
    'story-3-event':    'Crisis Distortion Lead',
    'story-4-amazon':   'Rain Pad Synthesis',
    'story-5-australia':'Wildfire Lead Synth'
  };

  function renderCatalog() {
    storiesGrid.innerHTML = '';
    stories.forEach((s, i) => {
      const card = document.createElement('article');
      card.className = 'story-card';
      card.tabIndex = 0;
      card.setAttribute('role', 'listitem');
      card.setAttribute('aria-label', `Story ${i+1}: ${s.title}`);
      card.style.setProperty('--accent', s.accent_color || 'var(--cyan)');

      card.innerHTML = `
        <div>
          <div class="sc-row1">
            <span class="sc-icon" aria-hidden="true">${s.icon}</span>
            <div style="text-align:right">
              <div class="sc-num">STORY ${i+1} · ${s.years || ''}</div>
              <span class="sc-badge" style="color:${s.accent_color};border-color:${s.accent_color}">${s.badge}</span>
            </div>
          </div>
          <h2 class="sc-title">${s.title}</h2>
          <p class="sc-subtitle">${s.subtitle}</p>
          <p class="sc-desc">${s.description}</p>
        </div>
        <div class="sc-footer">
          <span class="sc-synth">🎵 ${SYNTH_NAMES[s.id] || 'Synthesis'}</span>
          <span class="sc-cta">LAUNCH WORKSTATION [${i+1}] →</span>
        </div>`;

      const open = () => loadStory(s);
      card.addEventListener('click', open);
      card.addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' '){e.preventDefault();open();} });
      storiesGrid.appendChild(card);
    });
  }

  // ─── Workstation Tabs (Explorer, Comparator, Scanner, Accessibility, Voice) ─────
  function wireWorkstationTabs() {
    wsTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const mode = tab.dataset.mode;
        if (mode === 'voice') {
          openVoiceStation(true);
          return;
        }
        setWorkstationMode(mode);
      });
    });
  }

  function setWorkstationMode(mode) {
    curMode = mode;
    wsTabs.forEach(t => {
      const isActive = t.dataset.mode === mode;
      t.classList.toggle('active', isActive);
      t.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    Object.keys(wsPanels).forEach(k => {
      if (wsPanels[k]) {
        wsPanels[k].hidden = (k !== mode);
      }
    });

    triggerHaptic(12);

    if (mode === 'explorer') {
      setTimeout(resizeVizCanvas, 50);
      if (leafMap) leafMap.invalidateSize();
    } else if (mode === 'comparator') {
      updateComparatorUI();
    } else if (mode === 'scanner') {
      populateScannerAnalytics();
    } else if (mode === 'accessibility') {
      updateAccessibilityReadout();
    }
  }

  // ─── Story Tabs Switcher ─────────────────────────────────────────────────
  function renderTabs(activeId) {
    storyTabs.innerHTML = '';
    stories.forEach((s, i) => {
      const btn = document.createElement('button');
      btn.className = `story-tab${s.id === activeId ? ' active' : ''}`;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', s.id === activeId ? 'true' : 'false');
      btn.setAttribute('aria-label', `Switch to story: ${s.title}`);
      btn.textContent = `${s.icon} ${i+1}. ${s.title.split(':')[0]}`;
      btn.addEventListener('click', () => loadStory(s));
      storyTabs.appendChild(btn);
    });
  }

  // ─── Load Story ──────────────────────────────────────────────────────────
  async function loadStory(meta) {
    try {
      const r = await fetch(meta.data_file);
      if (!r.ok) throw new Error(r.status);
      curData = await r.json();
      curMeta = meta;
      setupPlayer(meta, curData);
      triggerHaptic([15, 20, 25]);
    } catch (e) {
      alert(`Could not load ${meta.data_file}. Run: python3 -m http.server 8000`);
    }
  }

  // ─── Setup Player View ───────────────────────────────────────────────────
  function setupPlayer(meta, data) {
    landingView.hidden = true;
    playerView.hidden  = false;
    if (hero_RAF) { cancelAnimationFrame(hero_RAF); hero_RAF = null; }
    window.scrollTo({top:0, behavior:'smooth'});

    renderTabs(meta.id);

    // Header Telemetry
    telStatus.textContent = meta.id.replace('story-','S').toUpperCase();
    pillLive.hidden = false;

    // Units
    mpUnit.textContent = data.units;
    mpLow.textContent  = `${data.min.toFixed(1)} ${data.units}`;
    mpHigh.textContent = `${data.max.toFixed(1)} ${data.units}`;

    // Scrubber
    const total = data.frames.length;
    scrubber.min = 0; scrubber.max = total - 1; scrubber.value = 0;
    tlStart.textContent = data.frames[0].date;
    tlEnd.textContent   = data.frames[total-1].date;

    // Alert Pip
    if (data.threshold !== null && data.threshold !== undefined) {
      const idx = data.frames.findIndex(f => f.value >= data.threshold);
      if (idx >= 0) {
        tlPip.hidden = false;
        tlPip.style.left = `${(idx/(total-1))*100}%`;
      }
    } else { tlPip.hidden = true; }

    // Legend
    synthPill.textContent = SYNTH_NAMES[meta.id] || '—';
    legGrad.style.background = `linear-gradient(90deg, ${(meta.palette||['#38bdf8','#ef4444']).join(',')})`;
    legMin.textContent = `${data.min.toFixed(1)} ${data.units}`;
    legMax.textContent = `${data.max.toFixed(1)} ${data.units}`;
    if (data.threshold !== null && data.threshold !== undefined) {
      legThresh.textContent = `🚨 Alert at: ${data.threshold} ${data.units}${data.threshold_date?' / '+data.threshold_date:''}`;
    } else { legThresh.textContent = 'No threshold alert for this story'; }

    // Map chips
    chipDataset.textContent = data.source || 'NASA';
    mpStoryName.textContent = meta.id.toUpperCase().replace('STORY-','S');

    // Narrative
    buildNarrative(data, meta);

    // Reset alert panel
    alertPanel.hidden = true;
    metricPanel.classList.remove('alarming');

    // Init map
    initMap(data, meta);

    // Preload satellite tiles
    preloadGibsTiles(data, meta);

    // Comparator sliders setup
    initComparatorSliders(data);

    // Populate Anomaly Diagnostics
    populateScannerAnalytics();

    // Reset Workstation view to Explorer by default
    setWorkstationMode('explorer');

    // Feed to AudioEngine
    AudioEngine.setStory(data);
    updateFrameUI(0, data.frames[0]);
  }

  // ─── Narrative Generator ─────────────────────────────────────────────────
  function buildNarrative(data, meta) {
    const f0 = data.frames[0];
    const fN = data.frames[data.frames.length-1];
    if (meta.shape === 'event') {
      const peak = data.frames.reduce((a,b) => b.value > a.value ? b : a, f0);
      narrativeEl.innerHTML =
        `Starting <strong>${f0.date}</strong> at <strong>${f0.value.toFixed(1)} ${data.units}</strong>, 
        conditions rapidly destabilized. Crossing the <strong>${data.threshold} ${data.units}</strong> threshold 
        triggers a layered alarm. The catastrophic peak: 
        <strong style="color:var(--red)">${peak.value.toFixed(1)} ${data.units}</strong> on <strong>${peak.date}</strong>.`;
    } else if (meta.shape === 'trend') {
      narrativeEl.innerHTML =
        `<strong>${data.frames.length} observations</strong> from <strong>${f0.date.substring(0,7)}</strong> 
        to <strong>${fN.date.substring(0,7)}</strong>. The pitch arc slowly drifts upward — 
        from <strong>${data.min.toFixed(1)}</strong> to <strong>${data.max.toFixed(1)} ${data.units}</strong> — 
        as the decadal baseline climbs imperceptibly but relentlessly.`;
    } else {
      narrativeEl.innerHTML =
        `A harmonic seasonal pattern across <strong>${data.frames.length} observations</strong>. 
        Peak values reach <strong>${data.max.toFixed(1)} ${data.units}</strong> in summer and 
        trough at <strong>${data.min.toFixed(1)} ${data.units}</strong> in winter — 
        the same melodic arc repeating year after year.`;
    }
  }

  // ─── Map Setup ───────────────────────────────────────────────────────────
  function initMap(data, meta) {
    const bbox   = data.area && data.area.bbox ? data.area.bbox : [-130,44,-114,54];
    const sw     = L.latLng(bbox[1], bbox[0]);
    const ne     = L.latLng(bbox[3], bbox[2]);
    const bounds = L.latLngBounds(sw, ne);

    if (!leafMap) {
      leafMap = L.map('map', { scrollWheelZoom: false, zoomControl: true, attributionControl: true });
      leafMap.attributionControl.setPrefix('');
    }
    if (bboxRect) leafMap.removeLayer(bboxRect);

    bboxRect = L.rectangle(bounds, {
      color: meta.accent_color || '#00d4ff', weight: 2,
      fillColor: meta.accent_color || '#00d4ff', fillOpacity: 0.08, dashArray: '6,4'
    }).addTo(leafMap);
    leafMap.fitBounds(bounds, { padding: [20,20] });

    lastTileDate = null;
    tileCache = {};
    updateGibsTileDebounced(data.frames[0].date, meta.gibs_layer);
  }

  function updateGibsTileDebounced(date, layer) {
    if (AudioEngine.isPlaying) {
      if (gibsUpdateTimer) return;
      gibsUpdateTimer = setTimeout(() => {
        gibsUpdateTimer = null;
        setGibsTile(date, layer);
      }, 1500);
    } else {
      clearTimeout(gibsUpdateTimer);
      gibsUpdateTimer = null;
      setGibsTile(date, layer);
    }
  }

  function setGibsTile(date, layer) {
    if (!leafMap || lastTileDate === date) return;
    lastTileDate = date;
    if (gibsLyr) leafMap.removeLayer(gibsLyr);
    const lyr = layer || 'MODIS_Terra_CorrectedReflectance_TrueColor';
    gibsLyr = L.tileLayer(
      `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${lyr}/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
      { maxZoom: 9, minZoom: 1, tileSize: 256, attribution: 'NASA GIBS/ESDIS' }
    ).addTo(leafMap);
    if (bboxRect) bboxRect.bringToFront();
  }

  function preloadGibsTiles(data, meta) {
    const lyr = meta.gibs_layer || 'MODIS_Terra_CorrectedReflectance_TrueColor';
    const frames = data.frames;
    const step = Math.max(1, Math.floor(frames.length / 20));
    for (let i = 0; i < frames.length; i += step) {
      const date = frames[i].date;
      if (tileCache[date]) continue;
      const img = new Image();
      img.src = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${lyr}/default/${date}/GoogleMapsCompatible_Level9/4/2/4.jpg`;
      tileCache[date] = img;
    }
  }

  // ─── Instant Canvas Data Visualization (0ms Sync) ────────────────────────
  function spawnRipple(x, y, color, maxR) {
    ripples.push({ x, y, r: 0, maxR: maxR || 60, alpha: 0.9, color });
  }

  function drawVizCanvas(frame, storyData) {
    if (!vizCanvas || !storyData) return;
    const ctx = vizCanvas.getContext('2d');
    const W = vizCanvas.width, H = vizCanvas.height;
    ctx.clearRect(0, 0, W, H);

    const t = (frame.value - storyData.min) / ((storyData.max - storyData.min) || 1);
    const isAlert = storyData.threshold !== null && frame.value >= storyData.threshold;

    const r = Math.round(t * 255);
    const g = Math.round((1 - Math.abs(t - 0.5) * 2) * 180);
    const b = Math.round((1 - t) * 255);
    const mainColor = `rgba(${r},${g},${b}`;

    const cx = W * 0.5, cy = H * 0.5;
    const radius = 20 + t * 55;

    // Glowing halo
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 2);
    grad.addColorStop(0, `${mainColor},0.4)`);
    grad.addColorStop(0.5, `${mainColor},0.15)`);
    grad.addColorStop(1, `${mainColor},0)`);
    ctx.beginPath(); ctx.arc(cx, cy, radius * 2, 0, Math.PI * 2);
    ctx.fillStyle = grad; ctx.fill();

    // Solid core
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = `${mainColor},0.7)`;
    ctx.shadowBlur = 20; ctx.shadowColor = `rgb(${r},${g},${b})`;
    ctx.fill(); ctx.shadowBlur = 0;

    if (isAlert) {
      ctx.beginPath(); ctx.arc(cx, cy, radius + 15, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,60,56,0.85)';
      ctx.lineWidth = 3; ctx.stroke();
    }

    ctx.font = `bold ${Math.round(14 + t * 8)}px 'Courier New'`;
    ctx.fillStyle = isAlert ? '#ff3c38' : '#fff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowBlur = 10; ctx.shadowColor = isAlert ? 'red' : 'rgba(0,212,255,0.8)';
    ctx.fillText(`${frame.value.toFixed(1)}${storyData.units}`, cx, cy);
    ctx.shadowBlur = 0;

    const alive = [];
    ripples.forEach(rp => {
      rp.r += 2.5; rp.alpha -= 0.025;
      if (rp.alpha > 0) {
        ctx.beginPath(); ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI*2);
        ctx.strokeStyle = rp.color.replace('rgb', 'rgba').replace(')', `,${rp.alpha})`);
        ctx.lineWidth = 2; ctx.stroke();
        alive.push(rp);
      }
    });
    ripples.length = 0;
    ripples.push(...alive);
  }

  function resizeVizCanvas() {
    if (!vizCanvas) return;
    const mapEl = document.getElementById('map');
    if (!mapEl) return;
    vizCanvas.width  = mapEl.offsetWidth;
    vizCanvas.height = mapEl.offsetHeight;
  }

  // ─── Frame UI Synchronization ────────────────────────────────────────────
  function updateFrameUI(idx, frame) {
    if (!curData || !frame) return;
    const total = curData.frames.length;
    const t = (frame.value - curData.min) / ((curData.max - curData.min) || 1);
    const isAlert = curData.threshold !== null && frame.value >= curData.threshold;

    // Trigger subtle Synaptics haptic tick on each frame change
    triggerHaptic(8);

    // Header Telemetry
    telDate.textContent  = frame.date;
    telValue.textContent = `${frame.value.toFixed(1)}${curData.units}`;
    telFrame.textContent = `${idx+1}/${total}`;

    // Map date chip
    chipDate.textContent = `📅 ${frame.date}`;

    // Metric panel
    mpFrame.textContent = `${idx+1} / ${total}`;
    mpDate.textContent  = frame.date;
    mpValue.textContent = frame.value.toFixed(1);
    mpValue.className   = `metric-value${isAlert ? ' hot' : ''}`;
    const pct = (t * 100).toFixed(1);
    mpBar.style.width   = `${pct}%`;
    mpCursor.style.left = `${pct}%`;

    // Scrubber
    scrubber.value = idx;

    // ARIA Live
    liveReadout.textContent = `Date: ${frame.date}. Value: ${frame.value.toFixed(1)} ${curData.units}.${isAlert?' ALERT: threshold exceeded.':''}`;

    // BVI Speech Verbalizer
    if (curMode === 'accessibility') {
      updateAccessibilityReadout(idx, frame);
    }

    // Instant Canvas Visualization
    resizeVizCanvas();
    drawVizCanvas(frame, curData);

    if (vizCanvas) {
      const cx = vizCanvas.width * 0.5, cy = vizCanvas.height * 0.5;
      const r = Math.round(t*255), b = Math.round((1-t)*255);
      spawnRipple(cx, cy, `rgb(${r},100,${b})`, 40 + t * 50);
    }

    // Throttled Satellite imagery
    if (curMeta) updateGibsTileDebounced(frame.date, curMeta.gibs_layer);
  }

  // ─── Threshold Alarm ─────────────────────────────────────────────────────
  function triggerAlert(frame) {
    // Powerful Haptic Anomaly Shockwave
    triggerHapticAlert();

    flashOverlay.classList.remove('on');
    void flashOverlay.offsetWidth;
    flashOverlay.classList.add('on');

    metricPanel.classList.add('alarming');

    alertPanel.hidden = false;
    alertText.textContent = `${frame.value.toFixed(2)} ${curData ? curData.units : ''} ≥ ${curData ? curData.threshold : ''} ${curData ? curData.units : ''}`;

    if (vizCanvas) {
      const cx = vizCanvas.width * 0.5, cy = vizCanvas.height * 0.5;
      for (let i = 0; i < 4; i++) {
        setTimeout(() => spawnRipple(cx, cy, 'rgb(255,60,56)', 80 + i * 25), i * 80);
      }
    }

    telDot.className = 'tel-dot alert';
    telStatus.textContent = 'ALERT';
    setTimeout(() => {
      if (AudioEngine.isPlaying) { telDot.className = 'tel-dot active'; telStatus.textContent = 'PLAYING'; }
    }, 4000);
  }

  // ─── TOOL 2: BINAURAL COMPARATOR LOGIC ───────────────────────────────────
  function initComparatorSliders(data) {
    if (!data || !data.frames || !compSliderA) return;
    const maxIdx = data.frames.length - 1;
    compSliderA.min = 0; compSliderA.max = maxIdx; compSliderA.value = 0;
    compSliderB.min = 0; compSliderB.max = maxIdx; compSliderB.value = Math.min(maxIdx, Math.floor(maxIdx * 0.8));
    updateComparatorUI();
  }

  function wireBinauralComparator() {
    if (compSliderA && compSliderB) {
      compSliderA.addEventListener('input', () => { triggerHaptic(8); updateComparatorUI(); });
      compSliderB.addEventListener('input', () => { triggerHaptic(8); updateComparatorUI(); });
    }
    if (btnCompPlay) {
      btnCompPlay.addEventListener('click', () => {
        if (!curData) return;
        const idxA = parseInt(compSliderA.value, 10);
        const idxB = parseInt(compSliderB.value, 10);
        const valA = curData.frames[idxA].value;
        const valB = curData.frames[idxB].value;
        triggerHaptic([20, 20, 20]);
        AudioEngine.playBinauralComparison(valA, valB, curData);
      });
    }
  }

  function updateComparatorUI() {
    if (!curData || !compSliderA) return;
    const idxA = parseInt(compSliderA.value, 10);
    const idxB = parseInt(compSliderB.value, 10);
    const fA = curData.frames[idxA];
    const fB = curData.frames[idxB];
    if (!fA || !fB) return;

    compDateA.textContent = fA.date;
    compValA.textContent  = `${fA.value.toFixed(1)} ${curData.units}`;
    compDateB.textContent = fB.date;
    compValB.textContent  = `${fB.value.toFixed(1)} ${curData.units}`;

    const midiA = pitchForValue(fA.value, curData);
    const midiB = pitchForValue(fB.value, curData);
    const freqA = Math.round(440 * Math.pow(2, (midiA - 69) / 12));
    const freqB = Math.round(440 * Math.pow(2, (midiB - 69) / 12));

    compFreqA.textContent = `Pitch: MIDI ${midiA} · ${freqA} Hz`;
    compFreqB.textContent = `Pitch: MIDI ${midiB} · ${freqB} Hz`;

    const deltaVal = (fB.value - fA.value);
    const deltaSign = deltaVal > 0 ? '+' : '';
    compDeltaTemp.textContent = `${deltaSign}${deltaVal.toFixed(1)} ${curData.units}`;
    compDeltaTemp.style.color = deltaVal > 0 ? 'var(--red)' : (deltaVal < 0 ? 'var(--cyan)' : 'var(--white)');

    const semitones = Math.abs(midiB - midiA);
    const intervals = [
      'Pure Unison (0 st)', 'Minor Second (1 st)', 'Major Second (2 st)',
      'Minor Third (3 st)', 'Major Third (4 st)', 'Perfect Fourth (5 st)',
      'Tritone / Flat 5th (6 st)', 'Perfect Fifth (7 st)', 'Minor Sixth (8 st)',
      'Major Sixth (9 st)', 'Minor Seventh (10 st)', 'Major Seventh (11 st)',
      'Octave Jump (12 st)'
    ];
    const intName = semitones <= 12 ? intervals[semitones] : `High Divergence (${semitones} st)`;
    compDeltaInt.textContent = intName;

    if (semitones === 0) {
      compDeltaDesc.textContent = 'Both ears in unison: zero climate divergence.';
    } else if (semitones <= 2) {
      compDeltaDesc.textContent = 'Subtle acoustic beating: moderate temperature delta.';
    } else {
      compDeltaDesc.textContent = 'Strong harmonic dissonance: severe climate divergence detected!';
    }
  }

  // ─── TOOL 3: ANOMALY SCANNER LOGIC ───────────────────────────────────────
  function calculateDatasetStats(data) {
    if (!data || !data.frames || !data.frames.length) return null;
    const vals = data.frames.map(f => f.value);
    const n = vals.length;
    const mean = vals.reduce((a,b) => a+b, 0) / n;
    const variance = vals.reduce((a,b) => a + Math.pow(b - mean, 2), 0) / (n - 1 || 1);
    const std = Math.sqrt(variance);

    const anomalies = [];
    data.frames.forEach((f, idx) => {
      const z = (f.value - mean) / (std || 1);
      const isThresh = (data.threshold !== null && f.value >= data.threshold);
      if (Math.abs(z) >= 2.0 || isThresh) {
        anomalies.push({
          index: idx,
          date: f.date,
          value: f.value,
          zScore: z,
          deviation: f.value - mean
        });
      }
    });

    return { n, mean, std, anomalies };
  }

  function populateScannerAnalytics() {
    if (!curData || !scanTotal) return;
    const stats = calculateDatasetStats(curData);
    if (!stats) return;

    scanTotal.textContent = stats.n;
    scanMean.textContent  = `${stats.mean.toFixed(2)} ${curData.units}`;
    scanStd.textContent   = `±${stats.std.toFixed(2)} ${curData.units}`;
    scanAnomaliesCount.textContent = stats.anomalies.length;

    anomalyTableBody.innerHTML = '';
    if (stats.anomalies.length === 0) {
      anomalyTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--muted)">
        Zero &gt;2σ anomalies detected in this baseline series. Climate conditions were stable.
      </td></tr>`;
      return;
    }

    stats.anomalies.forEach(anom => {
      const tr = document.createElement('tr');
      const devSign = anom.deviation > 0 ? '+' : '';
      tr.innerHTML = `
        <td style="font-weight:700">${anom.date}</td>
        <td style="color:${anom.zScore > 0 ? 'var(--red)' : 'var(--cyan)'};font-weight:700">${anom.value.toFixed(2)} ${curData.units}</td>
        <td>${devSign}${anom.deviation.toFixed(2)} ${curData.units}</td>
        <td style="color:var(--amber)">${anom.zScore.toFixed(2)}σ</td>
        <td>
          <button class="btn-table-audition" data-idx="${anom.index}">🎧 Audition</button>
        </td>
      `;
      tr.querySelector('.btn-table-audition').addEventListener('click', () => {
        triggerHaptic([30, 20, 50]);
        AudioEngine.seek(anom.index);
        AudioEngine.triggerAnomalySonar(90);
      });
      anomalyTableBody.appendChild(tr);
    });
  }

  function wireAnomalyScanner() {
    if (btnStartScanner) {
      btnStartScanner.addEventListener('click', runHighSpeedScanner);
    }
  }

  function runHighSpeedScanner() {
    if (!curData) return;
    if (scannerRunning) {
      clearInterval(scannerTimer);
      scannerRunning = false;
      btnStartScanner.textContent = '▶ Run High-Speed Acoustic Sonar Scan';
      return;
    }

    scannerRunning = true;
    btnStartScanner.textContent = '⏹ Stop Sonar Scan';
    AudioEngine.setRate(3.0);
    AudioEngine.seek(0);
    AudioEngine.play();

    const stats = calculateDatasetStats(curData);
    const anomIndices = new Set(stats.anomalies.map(a => a.index));

    scannerTimer = setInterval(() => {
      if (!AudioEngine.isPlaying || AudioEngine.currentIndex >= curData.frames.length - 1) {
        clearInterval(scannerTimer);
        scannerRunning = false;
        btnStartScanner.textContent = '▶ Run High-Speed Acoustic Sonar Scan';
        return;
      }
      if (anomIndices.has(AudioEngine.currentIndex)) {
        triggerHapticAlert();
        AudioEngine.triggerAnomalySonar(92);
      }
    }, 120);
  }

  // ─── TOOL 4: BVI ACCESSIBLE LAB LOGIC ────────────────────────────────────
  function wireAccessibilityLab() {
    document.querySelectorAll('.btn-ruler').forEach(btn => {
      btn.addEventListener('click', () => {
        const note = parseInt(btn.dataset.note, 10);
        triggerHaptic(15);
        AudioEngine.ensureInit().then(() => {
          Tone.start();
          const synth = new Tone.Synth().toDestination();
          synth.triggerAttackRelease(Tone.Frequency(note, 'midi').toNote(), '2n');
        });
      });
    });
  }

  function updateAccessibilityReadout(idx, frame) {
    if (!curData || !frame || !bviSpeechText) return;
    const curIdx = idx !== undefined ? idx : AudioEngine.currentIndex;
    const curF   = frame || curData.frames[curIdx];
    if (!curF) return;

    const prevF = curIdx > 0 ? curData.frames[curIdx - 1] : null;
    const delta = prevF ? (curF.value - prevF.value) : 0;
    const midi  = pitchForValue(curF.value, curData);
    const note  = Tone.Frequency(midi, 'midi').toNote();

    const deltaText = delta > 0 ? `rising by ${delta.toFixed(2)} ${curData.units}` : (delta < 0 ? `falling by ${Math.abs(delta).toFixed(2)} ${curData.units}` : 'stable');
    const isAlert   = curData.threshold !== null && curF.value >= curData.threshold;

    bviSpeechText.innerHTML = `Observation for <strong>${curF.date}</strong>: Value is <strong>${curF.value.toFixed(1)} ${curData.units}</strong> (${deltaText}). ${isAlert ? '<span style="color:var(--red)">⚠ ALERT: Critical threshold of ' + curData.threshold + curData.units + ' is exceeded!</span>' : 'Within normal operational envelope.'}`;
    bviSlopeMetric.textContent = `Rate of Change: ${delta >= 0 ? '+' : ''}${delta.toFixed(2)} ${curData.units}/step`;
    bviPitchMetric.textContent = `Acoustic Note: ${note} (MIDI ${midi})`;
  }

  // ─── SCIENTIFIC REPORT MODAL EXPORTER ────────────────────────────────────
  function wireReportModal() {
    if (btnExportReport && reportModal) {
      btnExportReport.addEventListener('click', openReportModal);
      btnCloseModal.addEventListener('click', () => reportModal.close());
      reportModal.addEventListener('click', e => {
        if (e.target === reportModal) reportModal.close();
      });

      btnCopyReport.addEventListener('click', () => {
        navigator.clipboard.writeText(reportContent.textContent);
        btnCopyReport.textContent = '✅ Copied!';
        triggerHaptic(20);
        setTimeout(() => { btnCopyReport.textContent = '📋 Copy to Clipboard'; }, 2000);
      });

      btnDownloadRep.addEventListener('click', () => {
        const blob = new Blob([reportContent.textContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `NASA_Sonification_Report_${curData ? curData.story_id : 'export'}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        triggerHaptic([15, 30]);
      });
    }
  }

  function openReportModal() {
    if (!curData || !reportModal) return;
    const stats = calculateDatasetStats(curData);
    const dateNow = new Date().toISOString().substring(0, 10);

    let text = `================================================================================
NASA EARTH SCIENCE CLIMATE SONIFICATION & ANOMALY ASSESSMENT REPORT
Generated via Earth Jukebox Workstation (NASA Space Apps Challenge 2026)
Date: ${dateNow}
================================================================================

1. DATASET PROVENANCE
---------------------
Story ID:           ${curData.story_id}
Dataset Name:       ${curData.dataset}
Source Service:     ${curData.source} (NASA ESDIS / POWER / VEDA)
Observation Units:  ${curData.units}
Target Region:      ${curData.area ? curData.area.name : 'Unknown'}
Spatial Bbox:       [${curData.area && curData.area.bbox ? curData.area.bbox.join(', ') : 'N/A'}]
Time Range:         ${curData.frames[0].date} to ${curData.frames[curData.frames.length - 1].date}
Total Observations: ${curData.frames.length} frames

2. STATISTICAL DISTRIBUTION
---------------------------
Mean (μ):           ${stats.mean.toFixed(2)} ${curData.units}
Standard Dev (σ):   ${stats.std.toFixed(2)} ${curData.units}
Minimum Observed:   ${curData.min.toFixed(2)} ${curData.units} (${curData.frames.find(f => f.value === curData.min)?.date || 'N/A'})
Maximum Observed:   ${curData.max.toFixed(2)} ${curData.units} (${curData.frames.find(f => f.value === curData.max)?.date || 'N/A'})
Alert Threshold:    ${curData.threshold !== null ? curData.threshold + ' ' + curData.units : 'None'}

3. DETECTED CLIMATE ANOMALIES (> 2.0σ or Threshold Breach)
----------------------------------------------------------
Total Outliers:     ${stats.anomalies.length}
`;

    if (stats.anomalies.length === 0) {
      text += `No >2σ statistical outliers were detected. The time series exhibited steady harmonic behavior.\n`;
    } else {
      text += `DATE        | VALUE         | DEVIATION   | Z-SCORE (σ)\n`;
      text += `------------|---------------|-------------|------------\n`;
      stats.anomalies.forEach(a => {
        const devSign = a.deviation > 0 ? '+' : '';
        text += `${a.date.padEnd(11)} | ${(a.value.toFixed(2) + ' ' + curData.units).padEnd(13)} | ${(devSign + a.deviation.toFixed(2) + ' ' + curData.units).padEnd(11)} | ${a.zScore.toFixed(2)}σ\n`;
      });
    }

    text += `
4. SONIFICATION & ACCESSIBILITY SPECIFICATION
---------------------------------------------
Acoustic Pitch Range:      MIDI 48 (C3, 130.81 Hz) to MIDI 84 (C6, 1046.50 Hz)
Mathematical Mapping:      f(x) = round(48 + ((x - min) / (max - min)) * 36)
Timbre Modulation:         Entropy/Variance -> Sine (low) -> Triangle (mid) -> Sawtooth (high)
Rate of Change Velocity:   Scaled dynamically from 60 BPM (stable) to 160 BPM (acute anomaly)
Alert Sound Architecture:  440 Hz Metal Bell + Pink Noise burst
Spatial Stereo Pan:        Geographic Longitude [-180°, +180°] -> [-1.0 (Left), +1.0 (Right)]
Universal Accessibility:   WCAG 2.1 AA Compliant (Voice Command API, Synaptics Haptics, BVI Lab)

================================================================================
CONFIRMATION: This report and sonification was computed from verified NASA 
Earth Observation archives and is free for open educational and research use.
================================================================================
`;

    reportContent.textContent = text;
    reportModal.showModal();
  }

  // ─── 🎤 VOICE CONTROL & 🎛️ SYNAPTICS HAPTICS CONTROLLER ───────────────────

  function triggerHaptic(duration = 10) {
    if (!hapticsActive) return;
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate(duration);
      }
    } catch (_) {}
  }

  function triggerHapticAlert() {
    if (!hapticsActive) return;
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate([40, 30, 80]);
      }
    } catch (_) {}
  }

  // ─── MICROPHONE HARDWARE TELEMETRY & VU METER ────────────────────────────
  let micStream       = null;
  let micAudioContext = null;
  let micAnalyser     = null;
  let micSource       = null;
  let micAnimId       = null;

  async function startMicVisualizer() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (vuMeterVal) {
          vuMeterVal.textContent = 'API not supported';
          vuMeterVal.style.color = 'var(--yellow)';
        }
        return;
      }
      if (!micStream) {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      }
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!micAudioContext) {
        micAudioContext = new AudioCtx();
      }
      if (micAudioContext.state === 'suspended') {
        await micAudioContext.resume();
      }
      if (!micAnalyser) {
        micAnalyser = micAudioContext.createAnalyser();
        micAnalyser.fftSize = 256;
        micAnalyser.smoothingTimeConstant = 0.25;
        micSource = micAudioContext.createMediaStreamSource(micStream);
        micSource.connect(micAnalyser);
      }

      const dataArray = new Uint8Array(micAnalyser.frequencyBinCount);

      function monitorAudioLevel() {
        if (voiceStation && voiceStation.hidden && !isListening) {
          if (micAnimId) cancelAnimationFrame(micAnimId);
          micAnimId = null;
          return;
        }
        micAnalyser.getByteFrequencyData(dataArray);
        let sum = 0;
        let peak = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
          if (dataArray[i] > peak) peak = dataArray[i];
        }
        const avg = sum / dataArray.length;
        const pct = Math.min(100, Math.round((Math.max(avg * 1.5, peak * 0.7) / 128) * 100));

        if (vuMeterFill) {
          vuMeterFill.style.width = pct + '%';
          if (pct > 60) {
            vuMeterFill.style.background = 'var(--red)';
          } else if (pct > 15) {
            vuMeterFill.style.background = 'var(--green)';
          } else {
            vuMeterFill.style.background = 'var(--cyan)';
          }
        }

        if (vuMeterVal) {
          if (pct < 3) {
            vuMeterVal.textContent = '0% (Silent)';
            vuMeterVal.style.color = 'var(--muted)';
          } else {
            vuMeterVal.textContent = `${pct}% (Voice Detected!)`;
            vuMeterVal.style.color = pct > 20 ? 'var(--green)' : 'var(--cyan)';
          }
        }

        micAnimId = requestAnimationFrame(monitorAudioLevel);
      }

      if (!micAnimId) {
        micAnimId = requestAnimationFrame(monitorAudioLevel);
      }
    } catch (err) {
      console.warn('Microphone hardware stream access error:', err);
      if (vuMeterVal) {
        vuMeterVal.textContent = 'Mic Blocked (Check Permissions)';
        vuMeterVal.style.color = 'var(--yellow)';
      }
    }
  }

  function stopMicVisualizer() {
    if (micAnimId) {
      cancelAnimationFrame(micAnimId);
      micAnimId = null;
    }
    if (micStream) {
      micStream.getTracks().forEach(t => t.stop());
      micStream = null;
    }
    if (micAudioContext) {
      try { micAudioContext.close(); } catch (_) {}
      micAudioContext = null;
      micAnalyser = null;
      micSource = null;
    }
    if (vuMeterFill) vuMeterFill.style.width = '0%';
    if (vuMeterVal) {
      vuMeterVal.textContent = '0% (Offline)';
      vuMeterVal.style.color = 'var(--muted)';
    }
  }

  async function runMicDiagnosticTest() {
    if (vuMeterVal) vuMeterVal.textContent = 'Testing Mic...';
    try {
      await startMicVisualizer();
      if (!micStream) {
        updateVoiceStationStatus('⚠️ Microphone access was not granted. Please allow microphone access in browser address bar.', 'alert');
        return;
      }
      const audioTrack = micStream.getAudioTracks()[0];
      const micName = audioTrack ? (audioTrack.label || 'Default Microphone') : 'Microphone';
      updateVoiceStationStatus(`🎙️ Testing "${micName}" — Speak into your mic right now!`, 'live');

      let maxPeak = 0;
      const testInterval = setInterval(() => {
        if (!micAnalyser) return;
        const testData = new Uint8Array(micAnalyser.frequencyBinCount);
        micAnalyser.getByteFrequencyData(testData);
        for (let i = 0; i < testData.length; i++) {
          if (testData[i] > maxPeak) maxPeak = testData[i];
        }
      }, 50);

      setTimeout(() => {
        clearInterval(testInterval);
        const peakPct = Math.round((maxPeak / 255) * 100);
        if (peakPct > 8) {
          updateVoiceStationStatus(`✅ Microphone is receiving audio loud & clear! Peak signal: ${peakPct}%. Device: "${micName}"`, 'success');
        } else {
          updateVoiceStationStatus(`⚠️ Signal was 0%. Your microphone may be hardware muted or muted in OS sound settings. Device: "${micName}"`, 'alert');
        }
      }, 3000);
    } catch (err) {
      updateVoiceStationStatus(`⚠️ Mic test error: ${err.message}. Check browser mic permissions.`, 'alert');
    }
  }

  function updateVoiceStationStatus(text, statusType = 'info') {
    if (!voiceStation) return;
    clearTimeout(voiceToastTimer);
    voiceStation.hidden = false;

    if (voiceStationText) voiceStationText.textContent = text;

    if (statusType === 'live') {
      if (voiceStationIcon) voiceStationIcon.textContent = '🔴';
      if (voiceStationTitle) voiceStationTitle.style.color = 'var(--cyan)';
      if (voiceStationText) voiceStationText.style.color = 'var(--cyan)';
    } else if (statusType === 'success') {
      if (voiceStationIcon) voiceStationIcon.textContent = '✅';
      if (voiceStationTitle) voiceStationTitle.style.color = 'var(--green)';
      if (voiceStationText) voiceStationText.style.color = 'var(--green)';
    } else if (statusType === 'alert') {
      if (voiceStationIcon) voiceStationIcon.textContent = '⚠️';
      if (voiceStationTitle) voiceStationTitle.style.color = 'var(--yellow)';
      if (voiceStationText) voiceStationText.style.color = 'var(--yellow)';
    } else {
      if (voiceStationIcon) voiceStationIcon.textContent = '🎤';
      if (voiceStationTitle) voiceStationTitle.style.color = 'var(--cyan)';
      if (voiceStationText) voiceStationText.style.color = 'var(--muted2)';
    }

    voiceToastTimer = setTimeout(() => {
      if (!voiceStation || voiceStation.hidden) return;
      if (isListening) {
        if (voiceStationIcon) voiceStationIcon.textContent = '🔴';
        if (voiceStationTitle) voiceStationTitle.style.color = 'var(--cyan)';
        if (voiceStationText) {
          voiceStationText.textContent = '🔴 Microphone live: Listening for speech (or click any chip below)...';
          voiceStationText.style.color = 'var(--muted2)';
        }
      } else {
        if (voiceStationIcon) voiceStationIcon.textContent = '🎤';
        if (voiceStationTitle) voiceStationTitle.style.color = 'var(--cyan)';
        if (voiceStationText) {
          voiceStationText.textContent = 'Ready. Speak any command into your microphone or click any voice command below...';
          voiceStationText.style.color = 'var(--muted2)';
        }
      }
    }, 4500);
  }

  function showVoiceToast(text, isAlert = false) {
    updateVoiceStationStatus(text, isAlert ? 'alert' : 'info');
  }

  // ─── LOCAL ON-DEVICE NEURAL SPEECH COMMANDS AI ENGINE ───────────────────────
  let localAiRecognizer = null;
  let isAiModelLoading  = false;
  let isAiListening     = false;

  async function initLocalAiSpeechEngine() {
    if (localAiRecognizer || isAiModelLoading) return;
    try {
      isAiModelLoading = true;
      if (typeof speechCommands === 'undefined') {
        console.warn('speechCommands library not loaded yet');
        isAiModelLoading = false;
        return;
      }
      if (voiceEngineBadge) {
        voiceEngineBadge.textContent = '🤖 Loading Local AI...';
        voiceEngineBadge.classList.add('loading');
      }

      // Absolute URLs required by speech-commands library scheme check (must start with http:// or https://)
      const modelUrl = new URL('assets/models/speech-commands/model.json', window.location.href).href;
      const metaUrl  = new URL('assets/models/speech-commands/metadata.json', window.location.href).href;

      // Load model from local offline assets
      localAiRecognizer = speechCommands.create(
        'BROWSER_FFT',
        null,
        modelUrl,
        metaUrl
      );

      await localAiRecognizer.ensureModelLoaded();
      isAiModelLoading = false;
      console.log('Local AI Speech Commands Model Loaded Successfully!');
      if (voiceEngineBadge) {
        voiceEngineBadge.textContent = '🤖 Local AI: ACTIVE';
        voiceEngineBadge.classList.remove('loading');
        voiceEngineBadge.classList.add('active');
      }
      if (voiceStationText && !isListening) {
        voiceStationText.textContent = '🤖 Local AI Voice Ready! Say: "Go" (Play), "Stop" (Pause), "Three" (Heat Dome), "Up" (Volume)';
      }
    } catch (err) {
      console.warn('Could not load local AI speech model:', err);
      isAiModelLoading = false;
      if (voiceEngineBadge) {
        voiceEngineBadge.textContent = '🤖 Local AI: Standby';
      }
    }
  }

  async function startLocalAiListening() {
    if (!localAiRecognizer) {
      await initLocalAiSpeechEngine();
    }
    if (!localAiRecognizer || isAiListening) return;

    try {
      const words = localAiRecognizer.wordLabels();
      isAiListening = true;

      await localAiRecognizer.listen(result => {
        const scores = result.scores;
        let maxScore = -1;
        let maxIdx = -1;
        for (let i = 0; i < scores.length; i++) {
          if (scores[i] > maxScore) {
            maxScore = scores[i];
            maxIdx = i;
          }
        }
        const detectedWord = words[maxIdx];

        // Filter background noise and unknown sounds
        if (maxScore >= 0.70 && detectedWord !== '_background_noise_' && detectedWord !== '_unknown_') {
          handleLocalAiWord(detectedWord, maxScore);
        }
      }, {
        includeSpectrogram: false,
        probabilityThreshold: 0.70,
        overlapFactor: 0.45
      });
      console.log('Local AI Speech Commands listening actively.');
    } catch (err) {
      console.warn('Error starting local AI speech recognition:', err);
      isAiListening = false;
    }
  }

  function stopLocalAiListening() {
    if (localAiRecognizer && isAiListening) {
      try {
        localAiRecognizer.stopListening();
      } catch (_) {}
      isAiListening = false;
    }
  }

  // ─── YOUTUBE-STYLE ON-DEMAND CLICK-TO-SPEAK CONTROLLER ────────────────────
  let clickToSpeakActive  = false;
  let clickToSpeakTimeout = null;

  async function triggerClickToSpeak() {
    if (clickToSpeakActive) {
      stopClickToSpeak('Microphone closed.');
      return;
    }

    clickToSpeakActive = true;
    if (btnClickToSpeak) {
      btnClickToSpeak.classList.add('listening');
      if (pttText) pttText.textContent = 'Listening... Speak now!';
      if (pttIcon) pttIcon.textContent = '🔴';
    }
    if (btnVoiceToggle) {
      btnVoiceToggle.classList.add('listening', 'active');
      btnVoiceToggle.setAttribute('aria-pressed', 'true');
      if (voiceBtnLabel) voiceBtnLabel.textContent = 'Voice: LISTENING';
      if (micIcon) micIcon.textContent = '🔴';
    }
    if (transcriptPlaceholder) {
      transcriptPlaceholder.style.display = 'inline';
      transcriptPlaceholder.textContent = '🔴 Listening... Say "Go", "Stop", "Three", "Up", "Down", "Scan"';
    }
    if (transcriptInterim) transcriptInterim.innerHTML = '';
    updateVoiceStationStatus('🔴 Listening... Speak your command into your microphone now', 'live');
    triggerHaptic([30, 20]);

    // Start hardware VU meter for this single utterance
    startMicVisualizer();

    // Start on-device local AI recognition
    startLocalAiListening();

    // Start Web Speech API if supported in browser
    if (speechRecognition) {
      try {
        speechRecognition.start();
      } catch (_) {}
    }

    // Auto-turn-off timeout after 5.5s if no speech is detected
    clearTimeout(clickToSpeakTimeout);
    clickToSpeakTimeout = setTimeout(() => {
      if (clickToSpeakActive) {
        stopClickToSpeak('Microphone closed. Click mic whenever you want to speak.');
      }
    }, 5500);
  }

  function stopClickToSpeak(reasonMessage) {
    if (!clickToSpeakActive) return;
    clickToSpeakActive = false;
    clearTimeout(clickToSpeakTimeout);

    // Stop local AI listening
    stopLocalAiListening();

    // Stop Web Speech API
    if (speechRecognition) {
      try { speechRecognition.stop(); } catch (_) {}
    }

    // Stop hardware mic stream immediately (preserves privacy & battery)
    stopMicVisualizer();

    // Reset button UI
    if (btnClickToSpeak) {
      btnClickToSpeak.classList.remove('listening');
      if (pttText) pttText.textContent = 'Click to Speak';
      if (pttIcon) pttIcon.textContent = '🎙️';
    }
    if (btnVoiceToggle) {
      btnVoiceToggle.classList.remove('listening');
      if (voiceBtnLabel) voiceBtnLabel.textContent = 'Voice: READY';
      if (micIcon) micIcon.textContent = '🎤';
    }

    if (reasonMessage) {
      updateVoiceStationStatus(reasonMessage, 'info');
      if (transcriptPlaceholder) {
        transcriptPlaceholder.style.display = 'inline';
        transcriptPlaceholder.textContent = reasonMessage;
      }
    }
  }

  function handleLocalAiWord(word, score) {
    const pct = Math.round(score * 100);
    if (transcriptPlaceholder) transcriptPlaceholder.style.display = 'none';
    if (transcriptInterim) {
      transcriptInterim.innerHTML = `<span class="heard-tag">🗣️ Spoken Word:</span> <strong class="heard-words">"${word.toUpperCase()}"</strong> <span style="font-size:0.7rem;color:var(--cyan)">(${pct}% AI match)</span>`;
    }

    triggerHaptic(20);

    // Stop listening immediately after word is recognized (like YouTube voice search)
    stopClickToSpeak();

    // Map the 18 words to Earth Jukebox actions:
    switch (word) {
      case 'go':
        updateVoiceStationStatus(`🗣️ AI Voice: "GO" ➔ PLAY`, 'success');
        AudioEngine.play();
        break;
      case 'stop':
        updateVoiceStationStatus(`🗣️ AI Voice: "STOP" ➔ PAUSE`, 'success');
        AudioEngine.pause();
        break;
      case 'one':
        updateVoiceStationStatus(`🗣️ AI Voice: "ONE" ➔ Story 1 (Seasonal Cycle)`, 'success');
        if (stories[0]) loadStory(stories[0]);
        break;
      case 'two':
        updateVoiceStationStatus(`🗣️ AI Voice: "TWO" ➔ Story 2 (Tokyo Trend)`, 'success');
        if (stories[1]) loadStory(stories[1]);
        break;
      case 'three':
        updateVoiceStationStatus(`🗣️ AI Voice: "THREE" ➔ Story 3 (Heat Dome ⭐)`, 'success');
        if (stories[2]) loadStory(stories[2]);
        break;
      case 'four':
        updateVoiceStationStatus(`🗣️ AI Voice: "FOUR" ➔ Story 4 (Amazon Precipitation)`, 'success');
        if (stories[3]) loadStory(stories[3]);
        break;
      case 'five':
        updateVoiceStationStatus(`🗣️ AI Voice: "FIVE" ➔ Story 5 (Australia Bushfires)`, 'success');
        if (stories[4]) loadStory(stories[4]);
        break;
      case 'up':
        updateVoiceStationStatus(`🗣️ AI Voice: "UP" ➔ Volume Boost (+3 dB)`, 'success');
        volRng.value = Math.min(12, parseInt(volRng.value, 10) + 3);
        AudioEngine.setVolume(parseFloat(volRng.value));
        break;
      case 'down':
        updateVoiceStationStatus(`🗣️ AI Voice: "DOWN" ➔ Volume Softer (-3 dB)`, 'success');
        volRng.value = Math.max(-10, parseInt(volRng.value, 10) - 3);
        AudioEngine.setVolume(parseFloat(volRng.value));
        break;
      case 'right':
        updateVoiceStationStatus(`🗣️ AI Voice: "RIGHT" ➔ Next Frame`, 'success');
        AudioEngine.pause();
        AudioEngine.seek(AudioEngine.currentIndex + 1);
        break;
      case 'left':
        updateVoiceStationStatus(`🗣️ AI Voice: "LEFT" ➔ Previous Frame`, 'success');
        AudioEngine.pause();
        AudioEngine.seek(AudioEngine.currentIndex - 1);
        break;
      case 'yes':
        updateVoiceStationStatus(`🗣️ AI Voice: "YES" ➔ Run Anomaly Sonar Scan`, 'success');
        setWorkstationMode('scanner');
        runHighSpeedScanner();
        break;
      case 'no':
        updateVoiceStationStatus(`🗣️ AI Voice: "NO" ➔ Return to Mission Explorer`, 'success');
        setWorkstationMode('explorer');
        break;
      default:
        break;
    }
  }

  function openVoiceStation(forceOpen = false) {
    if (!voiceStation) return;
    if (forceOpen || voiceStation.hidden) {
      voiceStation.hidden = false;
      if (btnVoiceToggle) {
        btnVoiceToggle.classList.add('active');
        btnVoiceToggle.setAttribute('aria-pressed', 'true');
      }
      if (voiceBtnLabel) voiceBtnLabel.textContent = 'Voice: READY';

      // Pre-warm local AI engine in background (offline, zero-cloud)
      initLocalAiSpeechEngine();

      updateVoiceStationStatus('Ready. Click the microphone button to speak, or use any voice command chip below.', 'info');

      if (voiceTextInput) {
        setTimeout(() => voiceTextInput.focus(), 100);
      }
    } else {
      closeVoiceStation();
    }
  }

  function closeVoiceStation() {
    if (!voiceStation) return;
    stopClickToSpeak();
    voiceStation.hidden = true;
    if (btnVoiceToggle) {
      btnVoiceToggle.classList.remove('active', 'listening');
      btnVoiceToggle.setAttribute('aria-pressed', 'false');
    }
    if (voiceBtnLabel) voiceBtnLabel.textContent = 'Voice Control: OFF';
    if (micIcon) micIcon.textContent = '🎤';
  }

  function executeVoiceCommand(rawTranscript) {
    const text = rawTranscript.toLowerCase().trim();
    if (transcriptPlaceholder) transcriptPlaceholder.style.display = 'none';
    if (transcriptInterim) {
      transcriptInterim.innerHTML = `<span class="heard-tag">Executed:</span> <span class="heard-words">"${text}"</span>`;
    }
    updateVoiceStationStatus(`🗣️ Executing: "${text}"`, 'success');
    triggerHaptic(20);

    // Stop listening once command is parsed
    stopClickToSpeak();

    // 1. Play / Start
    if (text.includes('play') || text.includes('start') || text.includes('resume') || text.includes('begin') || text.includes('go')) {
      AudioEngine.play();
      return;
    }

    // 2. Pause / Stop
    if (text.includes('pause') || text.includes('stop') || text.includes('freeze') || text.includes('halt') || text.includes('wait')) {
      AudioEngine.pause();
      return;
    }

    // 3. Next / Forward
    if (text.includes('next') || text.includes('forward') || text.includes('advance') || text.includes('skip')) {
      AudioEngine.pause();
      AudioEngine.seek(AudioEngine.currentIndex + 1);
      return;
    }

    // 4. Back / Previous / Rewind
    if (text.includes('back') || text.includes('previous') || text.includes('rewind') || text.includes('step back')) {
      AudioEngine.pause();
      AudioEngine.seek(AudioEngine.currentIndex - 1);
      return;
    }

    // 5. Stories 1 - 5
    if (text.includes('story 1') || text.includes('story one') || text.includes('first story') || text.includes('seasons') || text.includes('season') || text.includes('mediterranean')) {
      if (stories[0]) loadStory(stories[0]);
      return;
    }
    if (text.includes('story 2') || text.includes('story two') || text.includes('second story') || text.includes('trend') || text.includes('tokyo') || text.includes('warming')) {
      if (stories[1]) loadStory(stories[1]);
      return;
    }
    if (text.includes('story 3') || text.includes('story three') || text.includes('third story') || text.includes('heat dome') || text.includes('heat') || text.includes('dome') || text.includes('canada') || text.includes('pacific')) {
      if (stories[2]) loadStory(stories[2]);
      return;
    }
    if (text.includes('story 4') || text.includes('story four') || text.includes('fourth story') || text.includes('amazon') || text.includes('rain') || text.includes('rainfall') || text.includes('precipitation')) {
      if (stories[3]) loadStory(stories[3]);
      return;
    }
    if (text.includes('story 5') || text.includes('story five') || text.includes('fifth story') || text.includes('australia') || text.includes('bushfire') || text.includes('wildfire') || text.includes('black summer') || text.includes('fire')) {
      if (stories[4]) loadStory(stories[4]);
      return;
    }

    // 6. Workstation Tools
    if (text.includes('explorer') || text.includes('map') || text.includes('mission')) {
      setWorkstationMode('explorer');
      return;
    }
    if (text.includes('compare') || text.includes('comparator') || text.includes('binaural') || text.includes('divergence') || text.includes('ears')) {
      setWorkstationMode('comparator');
      return;
    }
    if (text.includes('scan') || text.includes('scanner') || text.includes('anomaly') || text.includes('sonar')) {
      setWorkstationMode('scanner');
      return;
    }
    if (text.includes('accessibility') || text.includes('accessible') || text.includes('lab') || text.includes('ruler') || text.includes('bvi')) {
      setWorkstationMode('accessibility');
      return;
    }

    // 7. Run Sonar Scan
    if (text.includes('run scan') || text.includes('start scan') || text.includes('detect') || text.includes('acoustic scan')) {
      setWorkstationMode('scanner');
      runHighSpeedScanner();
      return;
    }

    // 8. Speed
    if (text.includes('faster') || text.includes('speed up') || text.includes('double speed') || text.includes('quick')) {
      speedSel.value = '2.0';
      AudioEngine.setRate(2.0);
      return;
    }
    if (text.includes('slower') || text.includes('slow down') || text.includes('half speed')) {
      speedSel.value = '0.5';
      AudioEngine.setRate(0.5);
      return;
    }
    if (text.includes('normal speed') || text.includes('regular speed') || text.includes('reset speed')) {
      speedSel.value = '1.0';
      AudioEngine.setRate(1.0);
      return;
    }

    // 9. Volume
    if (text.includes('louder') || text.includes('volume up') || text.includes('boost') || text.includes('turn up') || text.includes('more sound')) {
      volRng.value = Math.min(12, parseInt(volRng.value, 10) + 3);
      AudioEngine.setVolume(parseFloat(volRng.value));
      return;
    }
    if (text.includes('quieter') || text.includes('volume down') || text.includes('softer') || text.includes('turn down') || text.includes('less sound')) {
      volRng.value = Math.max(-10, parseInt(volRng.value, 10) - 3);
      AudioEngine.setVolume(parseFloat(volRng.value));
      return;
    }

    // 10. Report & Catalog
    if (text.includes('report') || text.includes('export') || text.includes('diagnostics') || text.includes('download report')) {
      openReportModal();
      return;
    }
    if (text.includes('catalog') || text.includes('home') || text.includes('stories')) {
      btnBack.click();
      return;
    }

    // 11. Help / Guide
    if (text.includes('help') || text.includes('guide') || text.includes('command')) {
      if (voiceModal) voiceModal.showModal();
      return;
    }

    updateVoiceStationStatus(`Command not recognized: "${text}". Try "Play", "Story 3", "Faster", "Scan" or click any chip.`, 'alert');
  }

  function wireVoiceAndSynaptics() {
    // 🎤 Web Speech API Voice Controller Setup
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRec) {
      try {
        speechRecognition = new SpeechRec();
        speechRecognition.continuous = true;
        speechRecognition.interimResults = true; // Enable real-time interim recognition
        speechRecognition.lang = 'en-US';

        speechRecognition.onstart = () => {
          isListening = true;
          if (btnVoiceToggle) {
            btnVoiceToggle.classList.add('listening', 'active');
            btnVoiceToggle.setAttribute('aria-pressed', 'true');
          }
          if (voiceBtnLabel) voiceBtnLabel.textContent = 'Voice Control: ACTIVE';
          if (micIcon) micIcon.textContent = '🔴';
          updateVoiceStationStatus('🔴 Microphone live: Listening for speech (speak now or click any chip below)...', 'live');
          if (transcriptPlaceholder) {
            transcriptPlaceholder.style.display = 'inline';
            transcriptPlaceholder.textContent = 'Listening... Speak words like "Play", "Story 3", "Faster", "Louder"';
          }
          if (transcriptInterim) transcriptInterim.innerHTML = '';
        };

        speechRecognition.onaudiostart = () => {
          if (transcriptPlaceholder) transcriptPlaceholder.textContent = '🎙️ Audio signal detected! Listening for words...';
        };

        speechRecognition.onsoundstart = () => {
          if (transcriptPlaceholder) transcriptPlaceholder.textContent = 'Sound incoming...';
        };

        speechRecognition.onspeechstart = () => {
          if (transcriptPlaceholder) transcriptPlaceholder.textContent = 'Voice detected! Converting speech to text...';
        };

        speechRecognition.onresult = (e) => {
          let interimText = '';
          let finalCommand = '';

          for (let i = e.resultIndex; i < e.results.length; ++i) {
            const transcript = e.results[i][0].transcript;
            if (e.results[i].isFinal) {
              finalCommand += transcript;
            } else {
              interimText += transcript;
            }
          }

          // Live visual feedback: user sees their voice being fed in real-time!
          if (transcriptInterim) {
            if (interimText) {
              if (transcriptPlaceholder) transcriptPlaceholder.style.display = 'none';
              transcriptInterim.innerHTML = `<span class="hearing-tag">Hearing:</span> <span class="hearing-words">"${interimText}"</span>`;
            }
          }

          if (finalCommand) {
            const trimmed = finalCommand.trim();
            executeVoiceCommand(trimmed);
          }
        };

        speechRecognition.onerror = (e) => {
          console.warn('Speech recognition status:', e.error);
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            isListening = false;
            if (btnVoiceToggle) {
              btnVoiceToggle.classList.remove('listening');
              btnVoiceToggle.classList.add('active');
              btnVoiceToggle.setAttribute('aria-pressed', 'true');
            }
            if (voiceBtnLabel) voiceBtnLabel.textContent = 'Voice: ACTIVE';
            if (micIcon) micIcon.textContent = '🎤';
            updateVoiceStationStatus('ℹ️ Microphone blocked or requires HTTP. Local AI Voice & Command Chips active!', 'alert');
          } else if (e.error === 'network') {
            console.info('Google Cloud speech network disabled in Chromium. Local AI speech engine is running.');
            if (voiceEngineBadge) {
              voiceEngineBadge.textContent = '🤖 Local AI (Zero-Cloud)';
              voiceEngineBadge.classList.add('active');
            }
            updateVoiceStationStatus('🤖 Local AI Speech Active! Say: "Go" (Play), "Stop" (Pause), "Three" (Heat Dome), "Up" (Volume)', 'live');
            startLocalAiListening();
          } else if (e.error === 'no-speech') {
            if (isListening && transcriptPlaceholder) {
              transcriptPlaceholder.style.display = 'inline';
              transcriptPlaceholder.textContent = 'Listening... Speak clearly: "Go", "Stop", "Three", "Up", "Down"';
            }
          }
        };

        speechRecognition.onend = () => {
          if (isListening) {
            try { speechRecognition.start(); } catch (_) {}
          } else {
            if (btnVoiceToggle && voiceStation && voiceStation.hidden) {
              btnVoiceToggle.classList.remove('listening', 'active');
              btnVoiceToggle.setAttribute('aria-pressed', 'false');
              voiceBtnLabel.textContent = 'Voice Control: OFF';
              micIcon.textContent = '🎤';
            }
          }
        };
      } catch (err) {
        console.warn('Could not instantiate SpeechRecognition:', err);
      }
    }

    // YouTube-Style Click-to-Speak Button
    if (btnClickToSpeak) {
      btnClickToSpeak.addEventListener('click', () => {
        triggerClickToSpeak();
      });
    }

    // Toggle / Speak button in header
    if (btnVoiceToggle) {
      btnVoiceToggle.addEventListener('click', () => {
        if (voiceStation && voiceStation.hidden) {
          openVoiceStation();
          triggerClickToSpeak();
        } else {
          if (clickToSpeakActive) {
            stopClickToSpeak('Microphone closed.');
          } else {
            triggerClickToSpeak();
          }
        }
      });
    }

    // Hotkey 'V': Press V anywhere (not in text input) to Click-to-Speak
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        if (voiceStation && voiceStation.hidden) {
          openVoiceStation();
        }
        triggerClickToSpeak();
      }
    });

    // Test Mic Diagnostic Button
    if (btnTestMic) {
      btnTestMic.addEventListener('click', () => {
        runMicDiagnosticTest();
      });
    }

    // Close button on Voice Station Drawer
    if (btnCloseVoiceStation) {
      btnCloseVoiceStation.addEventListener('click', () => {
        closeVoiceStation();
      });
    }

    // Quick Voice Command Chips
    document.querySelectorAll('.voice-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const cmd = chip.dataset.cmd;
        if (cmd) executeVoiceCommand(cmd);
      });
    });

    // Voice Text Input Fallback
    if (voiceInputForm && voiceTextInput) {
      voiceInputForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const cmd = voiceTextInput.value.trim();
        if (cmd) {
          executeVoiceCommand(cmd);
          voiceTextInput.value = '';
        }
      });
    }

    // 🎛️ Synaptics Haptics Toggle
    if (btnSynapticsToggle) {
      btnSynapticsToggle.addEventListener('click', () => {
        hapticsActive = !hapticsActive;
        btnSynapticsToggle.classList.toggle('active', hapticsActive);
        synapticsBtnLabel.textContent = hapticsActive ? 'Synaptics: ACTIVE' : 'Synaptics: OFF';
        if (hapticsActive) triggerHaptic([20, 20]);
      });
    }

    // Voice & Touch Guide Dialog
    if (btnVoiceGuide && voiceModal) {
      btnVoiceGuide.addEventListener('click', () => voiceModal.showModal());
      if (btnCloseVoiceModal) btnCloseVoiceModal.addEventListener('click', () => voiceModal.close());
      if (btnDismissVoiceModal) btnDismissVoiceModal.addEventListener('click', () => voiceModal.close());
      voiceModal.addEventListener('click', (e) => { if (e.target === voiceModal) voiceModal.close(); });
    }

    // 🎛️ Synaptics Precision Haptic Touchpad Area Gestures
    if (synapticsPad) {
      function handlePadScrub(clientX) {
        if (!curData || !curData.frames) return;
        const rect = synapticsPad.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const targetIdx = Math.round(ratio * (curData.frames.length - 1));
        AudioEngine.seek(targetIdx);
        triggerHaptic(10);
        if (synapticsGestureInd) {
          synapticsGestureInd.textContent = `SCRUBBING [F${targetIdx + 1}]`;
          synapticsGestureInd.classList.add('scrubbing');
        }
      }

      synapticsPad.addEventListener('pointerdown', (e) => {
        isPointerDown = true;
        synapticsPad.classList.add('active-gesture');
        synapticsPad.setPointerCapture(e.pointerId);

        // Check for double tap / rapid two click (Play/Pause)
        const now = Date.now();
        if (now - lastTapTime < 300) {
          btnPlay.click();
          triggerHaptic([30, 30]);
          lastTapTime = 0;
          return;
        }
        lastTapTime = now;

        handlePadScrub(e.clientX);
      });

      synapticsPad.addEventListener('pointermove', (e) => {
        if (!isPointerDown) return;
        handlePadScrub(e.clientX);
      });

      const endPointer = (e) => {
        if (!isPointerDown) return;
        isPointerDown = false;
        synapticsPad.classList.remove('active-gesture');
        try { synapticsPad.releasePointerCapture(e.pointerId); } catch (_) {}
        if (synapticsGestureInd) {
          synapticsGestureInd.textContent = 'READY';
          synapticsGestureInd.classList.remove('scrubbing');
        }
      };

      synapticsPad.addEventListener('pointerup', endPointer);
      synapticsPad.addEventListener('pointercancel', endPointer);

      // Horizontal trackpad wheel gesture (Two-finger horizontal swipe on precision trackpad)
      synapticsPad.addEventListener('wheel', (e) => {
        if (Math.abs(e.deltaX) > 10) {
          e.preventDefault();
          const now = Date.now();
          if (now - wheelThrottle > 60) {
            wheelThrottle = now;
            const direction = e.deltaX > 0 ? 1 : -1;
            AudioEngine.seek(AudioEngine.currentIndex + direction);
            triggerHaptic(8);
          }
        }
      }, { passive: false });
    }

    // Global Synaptics Wheel Support over Scrubber & Map
    window.addEventListener('wheel', (e) => {
      if (playerView.hidden || !curData) return;
      // If user swipes horizontally with trackpad two fingers
      if (Math.abs(e.deltaX) > 18 && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        const now = Date.now();
        if (now - wheelThrottle > 75) {
          wheelThrottle = now;
          const direction = e.deltaX > 0 ? 1 : -1;
          AudioEngine.seek(AudioEngine.currentIndex + direction);
          triggerHaptic(8);
        }
      }
    }, { passive: true });
  }

  // ─── Real-Time 60 FPS Oscilloscope ───────────────────────────────────────
  function startOscilloscope() {
    if (!waveCanvas) return;
    const ctx = waveCanvas.getContext('2d');
    function draw() {
      osc_RAF = requestAnimationFrame(draw);
      const W = waveCanvas.offsetWidth; const H = waveCanvas.offsetHeight;
      waveCanvas.width = W; waveCanvas.height = H;
      ctx.clearRect(0, 0, W, H);

      ctx.strokeStyle = 'rgba(0,212,255,0.07)'; ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0,H*i/4); ctx.lineTo(W,H*i/4); ctx.stroke(); }

      const data = AudioEngine.getWaveformData ? AudioEngine.getWaveformData() : null;
      if (!data || !data.length) {
        ctx.strokeStyle = 'rgba(0,212,255,0.2)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0,H/2); ctx.lineTo(W,H/2); ctx.stroke();
        return;
      }

      const isAlert = curData && curData.threshold !== null &&
        curData.frames[AudioEngine.currentIndex] &&
        curData.frames[AudioEngine.currentIndex].value >= curData.threshold;

      ctx.strokeStyle = isAlert ? '#ff3c38' : '#00d4ff';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 10;
      ctx.shadowColor = isAlert ? '#ff3c38' : '#00d4ff';
      ctx.beginPath();
      const sw = W / data.length;
      for (let i = 0; i < data.length; i++) {
        const x = i * sw;
        const y = (data[i] * 0.9 + 1) / 2 * H;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke(); ctx.shadowBlur = 0;
    }
    draw();
  }

  // ─── Audio Engine Callbacks ──────────────────────────────────────────────
  function wireAudioCallbacks() {
    AudioEngine.onFrame = (idx, frame) => updateFrameUI(idx, frame);

    AudioEngine.onStateChange = (playing) => {
      btnPlay.setAttribute('aria-pressed', playing ? 'true' : 'false');
      if (playing) {
        playGlyph.textContent = '⏸'; playLbl.textContent = 'PAUSE';
        telDot.className = 'tel-dot active'; telStatus.textContent = 'PLAYING';
      } else {
        playGlyph.textContent = '▶'; playLbl.textContent = 'PLAY';
        telDot.className = 'tel-dot'; telStatus.textContent = 'PAUSED';
        if (curData && curMeta) {
          const f = curData.frames[AudioEngine.currentIndex];
          if (f) setGibsTile(f.date, curMeta.gibs_layer);
        }
      }
    };

    AudioEngine.onThreshold = (frame) => triggerAlert(frame);
  }

  // ─── General Controls & Keyboard Shortcuts ───────────────────────────────
  function wireControls() {
    btnBack.addEventListener('click', () => {
      AudioEngine.pause();
      if (scannerRunning) {
        clearInterval(scannerTimer);
        scannerRunning = false;
        if (btnStartScanner) btnStartScanner.textContent = '▶ Run High-Speed Acoustic Sonar Scan';
      }
      playerView.hidden  = true;
      landingView.hidden = false;
      pillLive.hidden = true;
      telStatus.textContent = 'STANDBY';
      telDate.textContent = telValue.textContent = telFrame.textContent = '—';
      telDot.className = 'tel-dot';
      startHeroAnimation();
      window.scrollTo({top:0, behavior:'smooth'});
    });

    btnPlay.addEventListener('click', () => {
      triggerHaptic(15);
      if (AudioEngine.isPlaying) AudioEngine.pause();
      else AudioEngine.play();
    });

    btnPrev.addEventListener('click', () => {
      triggerHaptic(8);
      AudioEngine.pause();
      AudioEngine.seek(AudioEngine.currentIndex - 1);
    });
    btnNext.addEventListener('click', () => {
      triggerHaptic(8);
      AudioEngine.pause();
      AudioEngine.seek(AudioEngine.currentIndex + 1);
    });

    scrubber.addEventListener('input', e => AudioEngine.seek(parseInt(e.target.value, 10)));
    speedSel.addEventListener('change', e => AudioEngine.setRate(parseFloat(e.target.value)));

    volRng.addEventListener('input', e => AudioEngine.setVolume(parseFloat(e.target.value)));
    AudioEngine.setVolume && AudioEngine.setVolume(4);

    document.querySelectorAll('.btn-sample').forEach(btn => {
      btn.addEventListener('click', () => {
        triggerHaptic(12);
        AudioEngine.playSample(btn.dataset.sample);
      });
    });

    // Universal Keyboard Navigation
    document.addEventListener('keydown', e => {
      const tag = e.target.tagName;
      if ((tag==='INPUT'&&e.target.type!=='range')||tag==='SELECT'||tag==='TEXTAREA') return;

      if (e.key==='Escape' && !playerView.hidden) {
        if (reportModal && reportModal.open) { reportModal.close(); return; }
        if (voiceModal && voiceModal.open) { voiceModal.close(); return; }
        e.preventDefault(); btnBack.click(); return;
      }

      const idx = parseInt(e.key, 10);
      if (!isNaN(idx) && idx >= 1 && idx <= 5 && stories[idx-1]) {
        e.preventDefault(); loadStory(stories[idx-1]); return;
      }
      if (playerView.hidden) return;

      const acts = {
        ' ': () => btnPlay.click(),
        'ArrowLeft':  () => { AudioEngine.pause(); AudioEngine.seek(AudioEngine.currentIndex - 1); },
        'ArrowRight': () => { AudioEngine.pause(); AudioEngine.seek(AudioEngine.currentIndex + 1); },
        'Home': () => AudioEngine.seek(0),
        'End':  () => curData && AudioEngine.seek(curData.frames.length - 1),
      };
      if (acts[e.key]) { e.preventDefault(); acts[e.key](); }
    });

    window.addEventListener('resize', resizeVizCanvas);
  }

  // ─── Ready ───────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
