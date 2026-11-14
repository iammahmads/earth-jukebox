/**
 * Earth Jukebox — App Controller v3
 * - 5 Stories, story-tab switcher
 * - Canvas data-viz overlay (always in-sync with sound)
 * - Smart GIBS preloading (tiles cached before needed)
 * - Hero animated waveform on landing
 * - Volume boosted
 */
(function () {
  'use strict';

  // ─── State ───────────────────────────────────────────────────────────────
  let stories   = [];
  let curMeta   = null;
  let curData   = null;
  let leafMap   = null;
  let gibsLyr   = null;
  let bboxRect  = null;
  let lastTileDate = null;
  let tileCache    = {};   // date → preloaded Image
  let gibsUpdateTimer = null;

  // canvas animation
  let ripples  = [];       // {x,y,r,maxR,alpha,color}
  let osc_RAF  = null;
  let viz_RAF  = null;
  let hero_RAF = null;

  // ─── DOM ─────────────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const landingView = $('view-landing');
  const playerView  = $('view-player');
  const storiesGrid = $('stories-grid');
  const storyTabs   = $('story-tabs');

  // Telemetry
  const telDot    = $('tel-dot');
  const telStatus = $('tel-status');
  const telDate   = $('tel-date');
  const telValue  = $('tel-value');
  const telFrame  = $('tel-frame');
  const pillLive  = $('pill-live');

  // Player
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
  const liveDotSm   = $('live-dot-sm');

  // Controls
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

  // Canvases
  const heroCanvas = $('hero-canvas');
  const waveCanvas = $('waveform-canvas');
  const vizCanvas  = $('data-viz-canvas');

  // ─── Init ────────────────────────────────────────────────────────────────
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
    wireAudioCallbacks();
    startOscilloscope();
  }

  // ─── Hero Landing Animation ───────────────────────────────────────────────
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

      // Grid
      ctx.strokeStyle = 'rgba(0,212,255,0.08)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath(); ctx.moveTo(0, H*i/4); ctx.lineTo(W, H*i/4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(W*i/4, 0); ctx.lineTo(W*i/4, H); ctx.stroke();
      }

      // Multiple waves
      const waves = [
        { freq: 0.025, amp: 0.25, phase: 0,    color: 'rgba(0,212,255,0.8)',  lw: 2   },
        { freq: 0.018, amp: 0.18, phase: 1.2,  color: 'rgba(0,255,136,0.5)',  lw: 1.5 },
        { freq: 0.04,  amp: 0.1,  phase: 2.4,  color: 'rgba(255,170,0,0.4)',  lw: 1   },
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

  // ─── Catalog ─────────────────────────────────────────────────────────────
  const SYNTH_NAMES = {
    'story-1-seasonal': 'AM Flute + Reverb',
    'story-2-trend':    'FM Drift + Delay',
    'story-3-event':    'Crisis Distortion',
    'story-4-amazon':   'Rain Pad + Chorus',
    'story-5-australia':'Wildfire Lead'
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
              <div class="sc-num">STORY ${i+1}</div>
              <span class="sc-badge" style="color:${s.accent_color};border-color:${s.accent_color}">${s.badge}</span>
            </div>
          </div>
          <h2 class="sc-title">${s.title}</h2>
          <p class="sc-subtitle">${s.subtitle}</p>
          <p class="sc-desc">${s.description}</p>
        </div>
        <div class="sc-footer">
          <span class="sc-synth">🎵 ${SYNTH_NAMES[s.id] || 'Synthesis'}</span>
          <span class="sc-cta">OPEN [${i+1}] →</span>
        </div>`;

      const open = () => loadStory(s);
      card.addEventListener('click', open);
      card.addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' '){e.preventDefault();open();} });
      storiesGrid.appendChild(card);
    });
  }

  // ─── Story Tabs ──────────────────────────────────────────────────────────
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
    } catch (e) {
      alert(`Could not load ${meta.data_file}. Run: python3 -m http.server 8000`);
    }
  }

  // ─── Setup Player ────────────────────────────────────────────────────────
  function setupPlayer(meta, data) {
    landingView.hidden = true;
    playerView.hidden  = false;
    if (hero_RAF) { cancelAnimationFrame(hero_RAF); hero_RAF = null; }
    window.scrollTo({top:0, behavior:'smooth'});

    renderTabs(meta.id);

    // Telemetry header
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

    // Alert pip
    if (data.threshold !== null && data.threshold !== undefined) {
      const idx = data.frames.findIndex(f => f.value >= data.threshold);
      if (idx >= 0) {
        tlPip.hidden = false;
        tlPip.style.left = `${(idx/(total-1))*100}%`;
      }
    } else { tlPip.hidden = true; }

    // Synth label
    synthPill.textContent = SYNTH_NAMES[meta.id] || '—';

    // Legend gradient
    legGrad.style.background = `linear-gradient(90deg, ${(meta.palette||['#38bdf8','#ef4444']).join(',')})`;
    legMin.textContent = `${data.min.toFixed(1)} ${data.units}`;
    legMax.textContent = `${data.max.toFixed(1)} ${data.units}`;
    if (data.threshold !== null && data.threshold !== undefined) {
      legThresh.textContent = `🚨 Alert at: ${data.threshold} ${data.units}${data.threshold_date?' / '+data.threshold_date:''}`;
    } else { legThresh.textContent = 'No threshold alert for this story'; }

    // Map chip
    chipDataset.textContent = data.source || 'NASA';
    mpStoryName.textContent = meta.id.toUpperCase().replace('STORY-','S');

    // Narrative
    buildNarrative(data, meta);

    // Reset alerts
    alertPanel.hidden = true;
    metricPanel.classList.remove('alarming');

    // Init map
    initMap(data, meta);

    // Preload GIBS tiles in background
    preloadGibsTiles(data, meta);

    // Audio
    AudioEngine.setStory(data);
    updateFrameUI(0, data.frames[0]);
  }

  // ─── Narrative ───────────────────────────────────────────────────────────
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

  // ─── Map ─────────────────────────────────────────────────────────────────
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

  // Smart GIBS: update at most once per second during playback, instant on pause
  function updateGibsTileDebounced(date, layer) {
    if (AudioEngine.isPlaying) {
      // During playback: throttle to 1 tile per 1500ms (avoid overloading)
      if (gibsUpdateTimer) return;
      gibsUpdateTimer = setTimeout(() => {
        gibsUpdateTimer = null;
        setGibsTile(date, layer);
      }, 1500);
    } else {
      // On pause or seek: update immediately (no throttle)
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

  // Preload GIBS tile Images in background so browser has them cached
  function preloadGibsTiles(data, meta) {
    const lyr = meta.gibs_layer || 'MODIS_Terra_CorrectedReflectance_TrueColor';
    // Sample ~20 evenly-spaced dates from the story to warm browser cache
    const frames = data.frames;
    const step = Math.max(1, Math.floor(frames.length / 20));
    // Use zoom=4 for preloading (smaller tiles, fastest cache warm)
    for (let i = 0; i < frames.length; i += step) {
      const date = frames[i].date;
      if (tileCache[date]) continue;
      const img = new Image();
      img.src = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${lyr}/default/${date}/GoogleMapsCompatible_Level9/4/2/4.jpg`;
      tileCache[date] = img;
    }
  }

  // ─── Canvas Data Visualization (always instant sync) ─────────────────────
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

    // Color gradient: cool blue → hot red
    const r = Math.round(t * 255);
    const g = Math.round((1 - Math.abs(t - 0.5) * 2) * 180);
    const b = Math.round((1 - t) * 255);
    const mainColor = `rgba(${r},${g},${b}`;

    // Center circle pulse
    const cx = W * 0.5, cy = H * 0.5;
    const radius = 20 + t * 55;

    // Outer glow ring
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 2);
    grad.addColorStop(0, `${mainColor},0.4)`);
    grad.addColorStop(0.5, `${mainColor},0.15)`);
    grad.addColorStop(1, `${mainColor},0)`);
    ctx.beginPath(); ctx.arc(cx, cy, radius * 2, 0, Math.PI * 2);
    ctx.fillStyle = grad; ctx.fill();

    // Core circle
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = `${mainColor},0.7)`;
    ctx.shadowBlur = 20; ctx.shadowColor = `rgb(${r},${g},${b})`;
    ctx.fill(); ctx.shadowBlur = 0;

    // Alert: add pulsing red ring
    if (isAlert) {
      ctx.beginPath(); ctx.arc(cx, cy, radius + 15, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,60,56,0.8)';
      ctx.lineWidth = 3; ctx.stroke();
    }

    // Value label on canvas
    ctx.font = `bold ${Math.round(14 + t * 8)}px 'Courier New'`;
    ctx.fillStyle = isAlert ? '#ff3c38' : '#fff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowBlur = 10; ctx.shadowColor = isAlert ? 'red' : 'rgba(0,212,255,0.8)';
    ctx.fillText(`${frame.value.toFixed(1)}${storyData.units}`, cx, cy);
    ctx.shadowBlur = 0;

    // Ripple animations
    const stillAlive = [];
    ripples.forEach(rp => {
      rp.r += 2.5; rp.alpha -= 0.025;
      if (rp.alpha > 0) {
        ctx.beginPath(); ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI*2);
        ctx.strokeStyle = rp.color.replace('rgb', 'rgba').replace(')', `,${rp.alpha})`);
        ctx.lineWidth = 2; ctx.stroke();
        stillAlive.push(rp);
      }
    });
    ripples.length = 0;
    ripples.push(...stillAlive);
  }

  function resizeVizCanvas() {
    if (!vizCanvas) return;
    const mapEl = document.getElementById('map');
    if (!mapEl) return;
    vizCanvas.width  = mapEl.offsetWidth;
    vizCanvas.height = mapEl.offsetHeight;
  }

  // ─── Frame Update (called by AudioEngine.onFrame) ────────────────────────
  function updateFrameUI(idx, frame) {
    if (!curData || !frame) return;
    const total = curData.frames.length;
    const t = (frame.value - curData.min) / ((curData.max - curData.min) || 1);
    const isAlert = curData.threshold !== null && frame.value >= curData.threshold;

    // Telemetry
    telDate.textContent  = frame.date;
    telValue.textContent = `${frame.value.toFixed(1)}${curData.units}`;
    telFrame.textContent = `${idx+1}/${total}`;

    // Chips
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

    // ARIA live
    liveReadout.textContent = `Date: ${frame.date}. Value: ${frame.value.toFixed(1)} ${curData.units}.${isAlert?' ALERT: threshold exceeded.':''}`;

    // Data-viz canvas (instant sync)
    resizeVizCanvas();
    drawVizCanvas(frame, curData);

    // Spawn a ripple on each frame for the viz
    if (vizCanvas) {
      const cx = vizCanvas.width * 0.5, cy = vizCanvas.height * 0.5;
      const r = Math.round(t*255), b = Math.round((1-t)*255);
      spawnRipple(cx, cy, `rgb(${r},100,${b})`, 40 + t * 50);
    }

    // GIBS tile (throttled during playback)
    if (curMeta) updateGibsTileDebounced(frame.date, curMeta.gibs_layer);
  }

  // ─── Threshold Alert ─────────────────────────────────────────────────────
  function triggerAlert(frame) {
    flashOverlay.classList.remove('on');
    void flashOverlay.offsetWidth;
    flashOverlay.classList.add('on');

    metricPanel.classList.add('alarming');

    alertPanel.hidden = false;
    alertText.textContent = `${frame.value.toFixed(2)} ${curData ? curData.units : ''} ≥ ${curData ? curData.threshold : ''} ${curData ? curData.units : ''}`;

    // Red ripple burst
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

  // ─── Oscilloscope ────────────────────────────────────────────────────────
  function startOscilloscope() {
    if (!waveCanvas) return;
    const ctx = waveCanvas.getContext('2d');
    function draw() {
      osc_RAF = requestAnimationFrame(draw);
      const W = waveCanvas.offsetWidth; const H = waveCanvas.offsetHeight;
      waveCanvas.width = W; waveCanvas.height = H;
      ctx.clearRect(0, 0, W, H);

      // Grid
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

  // ─── Audio Callbacks ──────────────────────────────────────────────────────
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
        // On pause, update tile immediately to current frame
        if (curData && curMeta) {
          const f = curData.frames[AudioEngine.currentIndex];
          if (f) setGibsTile(f.date, curMeta.gibs_layer);
        }
      }
    };

    AudioEngine.onThreshold = (frame) => triggerAlert(frame);
  }

  // ─── Control Wiring ──────────────────────────────────────────────────────
  function wireControls() {
    btnBack.addEventListener('click', () => {
      AudioEngine.pause();
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
      if (AudioEngine.isPlaying) AudioEngine.pause();
      else AudioEngine.play();
    });

    btnPrev.addEventListener('click', () => { AudioEngine.pause(); AudioEngine.seek(AudioEngine.currentIndex - 1); });
    btnNext.addEventListener('click', () => { AudioEngine.pause(); AudioEngine.seek(AudioEngine.currentIndex + 1); });

    scrubber.addEventListener('input', e => AudioEngine.seek(parseInt(e.target.value, 10)));
    speedSel.addEventListener('change', e => AudioEngine.setRate(parseFloat(e.target.value)));

    // Volume: mapped 0–12 dB for loud playback
    volRng.addEventListener('input', e => AudioEngine.setVolume(parseFloat(e.target.value)));
    // Set initial volume (boosted default)
    AudioEngine.setVolume && AudioEngine.setVolume(4);

    document.querySelectorAll('.btn-sample').forEach(btn => {
      btn.addEventListener('click', () => AudioEngine.playSample(btn.dataset.sample));
    });

    // Keyboard
    document.addEventListener('keydown', e => {
      const tag = e.target.tagName;
      if ((tag==='INPUT'&&e.target.type!=='range')||tag==='SELECT'||tag==='TEXTAREA') return;

      if (e.key==='Escape' && !playerView.hidden) { e.preventDefault(); btnBack.click(); return; }
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

    // Resize viz canvas when window resizes
    window.addEventListener('resize', resizeVizCanvas);
  }

  // ─── Go ──────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
