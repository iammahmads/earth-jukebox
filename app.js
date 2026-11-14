/**
 * Earth Jukebox — Application Controller v2 (app.js)
 * NASA Mission Control UI + Live Oscilloscope + Threshold Alarm System
 */
(function () {
  'use strict';

  // ─── State ───────────────────────────────────────────────────────────────
  let stories        = [];
  let curMeta        = null;
  let curData        = null;
  let leafletMap     = null;
  let gibsLayer      = null;
  let bboxRect       = null;
  let lastTileDate   = null;
  let waveformRAF    = null;

  // ─── DOM Refs ─────────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const landingView = $('landing-view');
  const playerView  = $('player-view');
  const storiesGrid = $('stories-grid');

  // Telemetry
  const telMission = $('tel-mission');
  const telFrame   = $('tel-frame');
  const telDate    = $('tel-date');
  const telValue   = $('tel-value');
  const statusDot  = $('status-dot');
  const statusLabel= $('status-label');

  // Player
  const playerTitle    = $('player-title');
  const playerSubtitle = $('player-subtitle');
  const playerShapeBadge = $('player-shape-badge');
  const playerSynthBadge = $('player-synth-badge');
  const frameCounter   = $('frame-counter');
  const visDate        = $('vis-date');
  const visValue       = $('vis-value');
  const visUnit        = $('vis-unit');
  const liveReadout    = $('live-readout');
  const alertBanner    = $('alert-banner');
  const alertMessage   = $('alert-message');
  const threshFlash    = $('threshold-flash');
  const narrativeText  = $('narrative-text');
  const metricCard     = $('metric-card');
  const intensityFill  = $('intensity-fill');
  const intensityPtr   = $('intensity-pointer');
  const rangeLowLabel  = $('range-low-label');
  const rangeHighLabel = $('range-high-label');

  // Legend
  const scaleLegendMin = $('scale-min-label');
  const scaleLegendMax = $('scale-max-label');
  const threshNote     = $('thresh-note');
  const synthLabelTag  = $('synth-label-tag');

  // Map chips
  const chipDate    = $('chip-date');
  const chipLayer   = $('chip-layer');
  const chipDataset = $('chip-dataset');

  // Controls
  const btnBack      = $('btn-back');
  const btnPlay      = $('btn-play');
  const playGlyph    = $('play-glyph');
  const playLabel    = $('play-label');
  const btnStepBack  = $('btn-step-back');
  const btnStepFwd   = $('btn-step-fwd');
  const scrubber     = $('scrubber');
  const tlStart      = $('tl-start');
  const tlEnd        = $('tl-end');
  const tlAlertPip   = $('timeline-alert-pip');
  const speedSelect  = $('speed-select');
  const volSlider    = $('vol-slider');

  // Meta
  const metaDataset = $('meta-dataset');
  const metaSource  = $('meta-source');
  const metaArea    = $('meta-area');
  const metaBbox    = $('meta-bbox');

  // Waveform
  const waveCanvas  = $('waveform-canvas');
  const waveCtx     = waveCanvas ? waveCanvas.getContext('2d') : null;

  // ─── Boot ────────────────────────────────────────────────────────────────
  async function init() {
    try {
      const res = await fetch('stories.json');
      stories = await res.json();
      renderCatalog(stories);
    } catch (e) {
      storiesGrid.innerHTML = `<p style="color:var(--red);font-size:.85rem">
        Failed to load stories.json — please serve this directory with a local web server:<br>
        <code>python3 -m http.server 8000</code></p>`;
    }
    wireControls();
    wireAudioCallbacks();
    startWaveformLoop();
  }

  // ─── Catalog ─────────────────────────────────────────────────────────────
  function renderCatalog(list) {
    storiesGrid.innerHTML = '';
    const synthNames = {
      'story-1-seasonal': 'AM Flute Synthesis',
      'story-2-trend':    'FM Drift Synthesis',
      'story-3-event':    'Crisis Distortion'
    };
    list.forEach((s, i) => {
      const card = document.createElement('article');
      card.className = 'story-card';
      card.tabIndex = 0;
      card.setAttribute('role', 'listitem');
      card.setAttribute('aria-label', `Story ${i+1}: ${s.title}`);
      card.style.setProperty('--accent-color', s.accent_color || 'var(--cyan)');

      const badgeClass = {seasonal:'badge-seasonal',trend:'badge-trend',event:'badge-event'}[s.shape] || '';
      card.innerHTML = `
        <div>
          <div class="sc-header">
            <span class="sc-icon" aria-hidden="true">${s.icon||'🌍'}</span>
            <span class="sc-num">STORY ${i+1} · <span class="badge ${badgeClass}">${s.badge||s.shape}</span></span>
          </div>
          <h3 class="sc-title">${s.title}</h3>
          <p class="sc-subtitle">${s.subtitle}</p>
          <p class="sc-desc">${s.description}</p>
        </div>
        <div class="sc-footer">
          <span class="sc-synth-label">🎵 ${synthNames[s.id]||'Synthesis Engine'}</span>
          <span class="sc-cta">LAUNCH [${i+1}] →</span>
        </div>`;

      const open = () => loadStory(s);
      card.addEventListener('click', open);
      card.addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); open(); } });
      storiesGrid.appendChild(card);
    });
  }

  // ─── Load Story ──────────────────────────────────────────────────────────
  async function loadStory(meta) {
    try {
      const res = await fetch(meta.data_file);
      if (!res.ok) throw new Error(res.status);
      curData = await res.json();
      curMeta = meta;
      setupPlayer(meta, curData);
    } catch (e) {
      alert(`Could not load ${meta.data_file}. Run: python3 -m http.server 8000`);
    }
  }

  // ─── Setup Player ────────────────────────────────────────────────────────
  function setupPlayer(meta, data) {
    landingView.hidden = true;
    playerView.hidden  = false;
    window.scrollTo({top:0, behavior:'smooth'});

    // Telemetry
    telMission.textContent = meta.id.toUpperCase().replace('STORY-','S');

    // Header
    playerTitle.textContent    = data.title || meta.title;
    playerSubtitle.textContent = meta.subtitle || '';
    playerShapeBadge.textContent = (meta.badge || meta.shape).toUpperCase();
    playerShapeBadge.className   = `badge badge-${meta.shape}`;
    playerSynthBadge.textContent = {
      'story-1-seasonal':'AM FLUTE',
      'story-2-trend':'FM DRIFT',
      'story-3-event':'CRISIS DIST.'
    }[meta.id] || 'SYNTH';

    // Units
    visUnit.textContent = data.units || '';
    rangeLowLabel.textContent  = `${data.min.toFixed(1)} ${data.units}`;
    rangeHighLabel.textContent = `${data.max.toFixed(1)} ${data.units}`;

    // Scrubber range
    const total = data.frames.length;
    scrubber.min = 0; scrubber.max = total - 1; scrubber.value = 0;
    tlStart.textContent = data.frames[0].date;
    tlEnd.textContent   = data.frames[total-1].date;

    // Alert pip position on timeline
    if (data.threshold !== null && data.threshold !== undefined) {
      const threshIdx = data.frames.findIndex(f => f.value >= data.threshold);
      if (threshIdx >= 0) {
        tlAlertPip.hidden = false;
        tlAlertPip.style.left = `${(threshIdx / (total-1)) * 100}%`;
      }
    } else { tlAlertPip.hidden = true; }

    // Legend
    scaleLegendMin.textContent = `${data.min.toFixed(1)} ${data.units}`;
    scaleLegendMax.textContent = `${data.max.toFixed(1)} ${data.units}`;
    synthLabelTag.textContent = playerSynthBadge.textContent;
    if (data.threshold !== null && data.threshold !== undefined) {
      threshNote.textContent = `🚨 Alert at: ${data.threshold} ${data.units}${data.threshold_date ? ' / ' + data.threshold_date : ''}`;
    } else {
      threshNote.textContent = 'No threshold alert for this story';
    }

    // Map chips
    chipLayer.textContent   = meta.gibs_layer ? '📡 ' + meta.gibs_layer.split('_').slice(0,2).join(' ') : '📡 NASA GIBS';
    chipDataset.textContent = data.source || 'NASA';

    // Meta footer
    metaDataset.textContent = data.dataset  || '—';
    metaSource.textContent  = data.source   || 'NASA';
    metaArea.textContent    = data.area && data.area.name ? data.area.name : '—';
    metaBbox.textContent    = data.area && data.area.bbox ? `[${data.area.bbox.join(', ')}]` : '—';

    // Narrative
    buildNarrative(data, meta);

    // Map init
    initMap(data, meta);

    // Hide old alert
    alertBanner.hidden = true;
    metricCard.classList.remove('alert-active');

    // Audio
    AudioEngine.setStory(data);
    updateFrameUI(0, data.frames[0]);
  }

  // ─── Narrative ───────────────────────────────────────────────────────────
  function buildNarrative(data, meta) {
    const f0 = data.frames[0];
    const fN = data.frames[data.frames.length - 1];
    if (meta.shape === 'event') {
      const peak = data.frames.reduce((a,b) => b.value > a.value ? b : a, data.frames[0]);
      narrativeText.innerHTML =
        `Starting <strong>${f0.date}</strong> at a calm <strong>${f0.value.toFixed(1)} ${data.units}</strong>, 
        conditions rapidly destabilized. The <strong>${data.threshold} ${data.units}</strong> threshold was 
        breached — triggering a layered alarm — before reaching a catastrophic peak of 
        <strong style="color:var(--red)">${peak.value.toFixed(1)} ${data.units}</strong> on <strong>${peak.date}</strong>, 
        then gradually recovering through ${fN.date}.`;
    } else if (meta.shape === 'trend') {
      narrativeText.innerHTML =
        `A continuous record spanning <strong>${data.frames.length} observations</strong> from 
        <strong>${f0.date.substring(0,7)}</strong> to <strong>${fN.date.substring(0,7)}</strong>. 
        The fundamental pitch arc slowly drifts from low to high as the decadal baseline climbs — 
        from <strong>${data.min.toFixed(1)}</strong> to <strong>${data.max.toFixed(1)} ${data.units}</strong>.`;
    } else {
      narrativeText.innerHTML =
        `A harmonic seasonal cycle across <strong>${data.frames.length} months</strong>. 
        Pitch peaks each July/August at <strong>${data.max.toFixed(1)} ${data.units}</strong> 
        and returns to its winter floor of <strong>${data.min.toFixed(1)} ${data.units}</strong> 
        every January — a repeating melody written by Earth's orbital geometry.`;
    }
  }

  // ─── Map ─────────────────────────────────────────────────────────────────
  function initMap(data, meta) {
    const bbox   = data.area && data.area.bbox ? data.area.bbox : [-130, 44, -114, 54];
    const sw     = L.latLng(bbox[1], bbox[0]);
    const ne     = L.latLng(bbox[3], bbox[2]);
    const bounds = L.latLngBounds(sw, ne);
    const center = bounds.getCenter();

    if (!leafletMap) {
      leafletMap = L.map('map', {
        scrollWheelZoom: false, zoomControl: true, attributionControl: true
      }).setView(center, meta.default_zoom || 6);
      leafletMap.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
    } else {
      leafletMap.setView(center, meta.default_zoom || 6);
      if (bboxRect) leafletMap.removeLayer(bboxRect);
    }

    const color = meta.accent_color || '#00d4ff';
    bboxRect = L.rectangle(bounds, {
      color, weight: 2.5, fillColor: color, fillOpacity: 0.1, dashArray: '5,4'
    }).addTo(leafletMap);
    leafletMap.fitBounds(bounds, { padding: [20, 20] });

    lastTileDate = null;
    updateGIBSTile(data.frames[0].date, meta.gibs_layer);
  }

  function updateGIBSTile(date, layer) {
    if (!leafletMap || lastTileDate === date) return;
    lastTileDate = date;
    if (gibsLayer) leafletMap.removeLayer(gibsLayer);
    const lyr = layer || 'MODIS_Terra_CorrectedReflectance_TrueColor';
    gibsLayer = L.tileLayer(
      `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${lyr}/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
      { maxZoom: 9, minZoom: 1, tileSize: 256, attribution: 'Imagery: NASA GIBS/ESDIS' }
    ).addTo(leafletMap);
    if (bboxRect) bboxRect.bringToFront();
  }

  // ─── Frame UI Update ─────────────────────────────────────────────────────
  function updateFrameUI(idx, frame) {
    if (!curData) return;
    const total = curData.frames.length;
    const t = (frame.value - curData.min) / ((curData.max - curData.min) || 1);
    const isHot = curData.threshold !== null && frame.value >= curData.threshold;

    // Telemetry strip
    telFrame.textContent = `${idx+1}/${total}`;
    telDate.textContent  = frame.date;
    telValue.textContent = `${frame.value.toFixed(1)}${curData.units}`;

    // Map date chip
    chipDate.textContent = `📅 ${frame.date}`;

    // Player readouts
    frameCounter.textContent = `${idx+1} / ${total}`;
    visDate.textContent  = frame.date;
    visValue.textContent = frame.value.toFixed(1);
    visValue.className   = `metric-value${isHot ? ' hot' : ''}`;

    // Intensity bar
    const pct = (t * 100).toFixed(1);
    intensityFill.style.width   = `${pct}%`;
    intensityPtr.style.left     = `${pct}%`;

    // Scrubber
    scrubber.value = idx;

    // ARIA live announcement
    liveReadout.textContent = `Date: ${frame.date}. Value: ${frame.value.toFixed(1)} ${curData.units}.${isHot ? ' WARNING: threshold exceeded.' : ''}`;

    // Tile update
    if (curMeta) updateGIBSTile(frame.date, curMeta.gibs_layer);
  }

  // ─── Threshold Alert ─────────────────────────────────────────────────────
  function triggerThresholdAlert(frame) {
    // Flash overlay
    threshFlash.classList.remove('active');
    void threshFlash.offsetWidth; // force reflow
    threshFlash.classList.add('active');

    // Metric card border pulse
    metricCard.classList.add('alert-active');

    // Alert banner
    alertBanner.hidden = false;
    alertMessage.textContent =
      `THRESHOLD CROSSED — ${frame.value.toFixed(1)} ${curData ? curData.units : ''} ≥ ${curData ? curData.threshold : ''} ${curData ? curData.units : ''}`;

    // Status dot
    statusDot.className = 'status-dot alert';
    statusLabel.textContent = 'ALERT';
    setTimeout(() => {
      if (AudioEngine.isPlaying) { statusDot.className='status-dot playing'; statusLabel.textContent='PLAYING'; }
    }, 3000);
  }

  // ─── Waveform Oscilloscope ────────────────────────────────────────────────
  function startWaveformLoop() {
    if (!waveCanvas || !waveCtx) return;
    function draw() {
      waveformRAF = requestAnimationFrame(draw);
      const data = AudioEngine.getWaveformData ? AudioEngine.getWaveformData() : null;
      const W = waveCanvas.width, H = waveCanvas.height;

      waveCtx.clearRect(0, 0, W, H);
      // Grid lines
      waveCtx.strokeStyle = 'rgba(0,212,255,0.08)';
      waveCtx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        waveCtx.beginPath();
        waveCtx.moveTo(0, H * i / 4);
        waveCtx.lineTo(W, H * i / 4);
        waveCtx.stroke();
      }

      if (!data || !data.length) {
        // Idle flat line
        waveCtx.strokeStyle = 'rgba(0,212,255,0.25)';
        waveCtx.lineWidth = 1.5;
        waveCtx.beginPath();
        waveCtx.moveTo(0, H/2);
        waveCtx.lineTo(W, H/2);
        waveCtx.stroke();
        return;
      }

      // Active waveform
      const isAlert = curData && curData.threshold !== null &&
        curData.frames[AudioEngine.currentIndex] &&
        curData.frames[AudioEngine.currentIndex].value >= curData.threshold;

      const lineColor = isAlert ? '#ff3c38' : '#00d4ff';
      const glowColor = isAlert ? 'rgba(255,60,56,0.5)' : 'rgba(0,212,255,0.4)';

      waveCtx.shadowBlur = 8;
      waveCtx.shadowColor = glowColor;
      waveCtx.strokeStyle = lineColor;
      waveCtx.lineWidth = 2;
      waveCtx.beginPath();

      const sliceW = W / data.length;
      let x = 0;
      for (let i = 0; i < data.length; i++) {
        const y = (data[i] * 0.9 + 1) / 2 * H;
        if (i === 0) waveCtx.moveTo(x, y);
        else waveCtx.lineTo(x, y);
        x += sliceW;
      }
      waveCtx.stroke();
      waveCtx.shadowBlur = 0;
    }
    draw();
  }

  // ─── Audio Callbacks ─────────────────────────────────────────────────────
  function wireAudioCallbacks() {
    AudioEngine.onFrame = (idx, frame) => {
      updateFrameUI(idx, frame);
    };

    AudioEngine.onStateChange = (playing) => {
      btnPlay.setAttribute('aria-pressed', playing ? 'true' : 'false');
      if (playing) {
        playGlyph.textContent = '⏸';
        playLabel.textContent = 'PAUSE';
        statusDot.className   = 'status-dot playing';
        statusLabel.textContent = 'PLAYING';
      } else {
        playGlyph.textContent = '▶';
        playLabel.textContent = 'PLAY';
        statusDot.className   = 'status-dot';
        statusLabel.textContent = 'PAUSED';
      }
    };

    AudioEngine.onThreshold = (frame) => {
      triggerThresholdAlert(frame);
    };
  }

  // ─── Control Wiring ───────────────────────────────────────────────────────
  function wireControls() {
    btnBack.addEventListener('click', () => {
      AudioEngine.pause();
      playerView.hidden  = true;
      landingView.hidden = false;
      telMission.textContent = 'STANDBY';
      statusDot.className = 'status-dot';
      statusLabel.textContent = 'IDLE';
      window.scrollTo({top:0, behavior:'smooth'});
    });

    btnPlay.addEventListener('click', () => {
      if (AudioEngine.isPlaying) AudioEngine.pause();
      else AudioEngine.play();
    });

    btnStepBack.addEventListener('click', () => { AudioEngine.pause(); AudioEngine.seek(AudioEngine.currentIndex - 1); });
    btnStepFwd.addEventListener('click',  () => { AudioEngine.pause(); AudioEngine.seek(AudioEngine.currentIndex + 1); });

    scrubber.addEventListener('input', e => AudioEngine.seek(parseInt(e.target.value, 10)));
    speedSelect.addEventListener('change', e => AudioEngine.setRate(parseFloat(e.target.value)));
    volSlider.addEventListener('input', e => AudioEngine.setVolume(parseFloat(e.target.value)));

    document.querySelectorAll('.btn-sample').forEach(btn => {
      btn.addEventListener('click', () => AudioEngine.playSample(btn.dataset.sample));
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName) && e.target.type !== 'range') return;

      if (e.key === 'Escape' && !playerView.hidden) { e.preventDefault(); btnBack.click(); return; }
      if (['1','2','3'].includes(e.key) && stories[+e.key-1]) {
        e.preventDefault(); loadStory(stories[+e.key-1]); return;
      }
      if (playerView.hidden) return;

      const map = {
        ' ': () => btnPlay.click(),
        'ArrowLeft':  () => { AudioEngine.pause(); AudioEngine.seek(AudioEngine.currentIndex - 1); },
        'ArrowRight': () => { AudioEngine.pause(); AudioEngine.seek(AudioEngine.currentIndex + 1); },
        'Home': () => AudioEngine.seek(0),
        'End':  () => curData && AudioEngine.seek(curData.frames.length - 1)
      };
      if (map[e.key]) { e.preventDefault(); map[e.key](); }
    });
  }

  // ─── Go ───────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
