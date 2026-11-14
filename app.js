/**
 * Earth Jukebox — UI Application Controller (app.js)
 * NASA Space Apps 2026
 */

(function () {
  'use strict';

  // State
  let stories = [];
  let currentStoryMeta = null;
  let currentStoryData = null;
  let leafletMap = null;
  let gibsTileLayer = null;
  let bboxOverlay = null;
  let lastTileDate = null;

  // DOM Elements
  const landingView = document.getElementById('landing-view');
  const playerView = document.getElementById('player-view');
  const storiesGrid = document.getElementById('stories-grid');
  const btnBackCatalog = document.getElementById('btn-back-catalog');

  // Player Elements
  const playerStoryTitle = document.getElementById('player-story-title');
  const playerStorySubtitle = document.getElementById('player-story-subtitle');
  const playerShapeBadge = document.getElementById('player-shape-badge');
  const playerSourceBadge = document.getElementById('player-source-badge');
  const frameCounter = document.getElementById('frame-counter');
  const visibleDate = document.getElementById('visible-date');
  const visibleValue = document.getElementById('visible-value');
  const chipDate = document.getElementById('chip-date');
  const liveReadout = document.getElementById('live-readout');
  const storySummaryText = document.getElementById('story-summary-text');
  
  // Legend Elements
  const legendMinVal = document.getElementById('legend-min-val');
  const legendMaxVal = document.getElementById('legend-max-val');
  const legendThreshVal = document.getElementById('legend-thresh-val');
  const sampleButtons = document.querySelectorAll('.btn-sample');

  // Controls Elements
  const btnPlayPause = document.getElementById('btn-play-pause');
  const playIcon = document.getElementById('play-icon');
  const playText = document.getElementById('play-text');
  const btnStepBack = document.getElementById('btn-step-back');
  const btnStepForward = document.getElementById('btn-step-forward');
  const timelineScrubber = document.getElementById('timeline-scrubber');
  const timelineStartDate = document.getElementById('timeline-start-date');
  const timelineEndDate = document.getElementById('timeline-end-date');
  const timelineEventMarker = document.getElementById('timeline-event-marker');
  const selectSpeed = document.getElementById('select-speed');
  const sliderVolume = document.getElementById('slider-volume');

  // Meta Footer
  const metaDatasetName = document.getElementById('meta-dataset-name');
  const metaBboxCoords = document.getElementById('meta-bbox-coords');
  const gibsLayerLabel = document.getElementById('gibs-layer-label');
  const mapCoordinatesLabel = document.getElementById('map-coordinates-label');

  /**
   * Initializes the application: loads stories catalog.
   */
  async function initApp() {
    try {
      const res = await fetch('stories.json');
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      stories = await res.json();
      renderStoriesCatalog(stories);
    } catch (err) {
      console.error('Failed to load stories.json:', err);
      storiesGrid.innerHTML = `
        <div class="card-desc" style="color:var(--accent-red)">
          Error loading stories catalog. Please ensure you are serving this folder via a local web server (e.g., python3 -m http.server 8000).
        </div>`;
    }

    setupEventListeners();
    setupAudioEngineCallbacks();
  }

  /**
   * Renders the story selection cards on the landing view.
   */
  function renderStoriesCatalog(storyList) {
    storiesGrid.innerHTML = '';
    storyList.forEach((story, idx) => {
      const card = document.createElement('article');
      card.className = 'story-card';
      card.tabIndex = 0;
      card.setAttribute('role', 'listitem');
      card.setAttribute('aria-label', `Select Story ${idx + 1}: ${story.title}`);

      let badgeClass = 'badge-seasonal';
      if (story.shape === 'trend') badgeClass = 'badge-trend';
      if (story.shape === 'event') badgeClass = 'badge-event';

      card.innerHTML = `
        <div>
          <div class="card-header-row">
            <span class="card-icon" aria-hidden="true">${story.icon || '🌍'}</span>
            <span class="badge ${badgeClass}">${story.badge || story.shape}</span>
          </div>
          <h3 class="card-title">${story.title}</h3>
          <p class="card-subtitle">${story.subtitle}</p>
          <p class="card-desc">${story.description}</p>
        </div>
        <div class="card-cta">
          <span>Explore Sonification →</span>
          <span>Shortcut [${idx + 1}]</span>
        </div>
      `;

      card.addEventListener('click', () => loadStory(story));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          loadStory(story);
        }
      });

      storiesGrid.appendChild(card);
    });
  }

  /**
   * Loads story data and transitions to player view.
   */
  async function loadStory(storyMeta) {
    try {
      currentStoryMeta = storyMeta;
      const res = await fetch(storyMeta.data_file);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      currentStoryData = await res.json();
      
      setupPlayerView(currentStoryMeta, currentStoryData);
    } catch (err) {
      console.error(`Failed to load data for ${storyMeta.id}:`, err);
      alert(`Could not load story dataset (${storyMeta.data_file}). Check network or file permissions.`);
    }
  }

  /**
   * Configures player UI with loaded story dataset.
   */
  function setupPlayerView(meta, data) {
    // Switch views
    landingView.hidden = true;
    playerView.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Update Header
    playerStoryTitle.textContent = data.title || meta.title;
    playerStorySubtitle.textContent = meta.subtitle || meta.description;
    playerShapeBadge.textContent = meta.badge || meta.shape.toUpperCase();
    playerShapeBadge.className = `badge badge-${meta.shape}`;
    playerSourceBadge.textContent = data.source || 'NASA Data';

    // Meta Footer
    metaDatasetName.textContent = data.dataset || 'NASA Observation';
    if (data.area && data.area.bbox) {
      metaBboxCoords.textContent = `[${data.area.bbox.join(', ')}] — ${data.area.name || ''}`;
      mapCoordinatesLabel.textContent = `Region: ${data.area.name || 'Target Area'}`;
    }
    gibsLayerLabel.textContent = meta.gibs_layer || 'MODIS TrueColor';

    // Scrubber Range
    const totalFrames = data.frames.length;
    timelineScrubber.min = 0;
    timelineScrubber.max = totalFrames - 1;
    timelineScrubber.value = 0;
    timelineStartDate.textContent = data.frames[0].date;
    timelineEndDate.textContent = data.frames[totalFrames - 1].date;

    // Threshold indicator on timeline
    if (data.threshold !== null && data.threshold !== undefined) {
      timelineEventMarker.hidden = false;
      timelineEventMarker.textContent = `⚠️ Threshold: ${data.threshold} ${data.units}`;
    } else {
      timelineEventMarker.hidden = true;
    }

    // Legend
    legendMinVal.textContent = `${data.min.toFixed(1)} ${data.units}`;
    legendMaxVal.textContent = `${data.max.toFixed(1)} ${data.units}`;
    if (data.threshold !== null && data.threshold !== undefined) {
      legendThreshVal.textContent = `Chimes when value crosses ${data.threshold} ${data.units}${data.threshold_date ? ' (' + data.threshold_date + ')' : ''}`;
    } else {
      legendThreshVal.textContent = 'None (continuous harmonic curve)';
    }

    // Generate narrative summary
    generateNarrativeSummary(data, meta);

    // Initialize Leaflet Map
    initOrUpdateMap(data, meta);

    // Feed to AudioEngine
    AudioEngine.setStory(data);

    // Display first frame
    if (data.frames.length > 0) {
      updateFrameUI(0, data.frames[0]);
    }
  }

  /**
   * Generates a descriptive scientific narrative for the dataset.
   */
  function generateNarrativeSummary(data, meta) {
    const total = data.frames.length;
    const start = data.frames[0];
    const end = data.frames[total - 1];

    if (meta.shape === 'event') {
      // Sudden Event analysis
      let maxFrame = data.frames[0];
      data.frames.forEach(f => {
        if (f.value > maxFrame.value) maxFrame = f;
      });
      storySummaryText.innerHTML = `
        <strong>Sudden Anomaly:</strong> Beginning on <em>${start.date}</em> at a moderate <strong>${start.value.toFixed(1)}${data.units}</strong>, 
        atmospheric conditions built up until a severe anomaly struck in late June 2021. 
        Temperatures crossed the danger threshold of <strong>${data.threshold}${data.units}</strong>, reaching a historic peak of 
        <strong style="color:var(--accent-red)">${maxFrame.value.toFixed(1)}${data.units}</strong> on <em>${maxFrame.date}</em> before gradually abating.
      `;
    } else if (meta.shape === 'trend') {
      // Long Trend analysis
      storySummaryText.innerHTML = `
        <strong>Decadal Drift:</strong> Continuous observation over <strong>${total} months</strong> from <em>${start.date.substring(0, 7)}</em> 
        to <em>${end.date.substring(0, 7)}</em>. Overall temperatures fluctuate seasonally between <strong>${data.min.toFixed(1)}${data.units}</strong> 
        and <strong>${data.max.toFixed(1)}${data.units}</strong>, with a persistent upward baseline climb across decades that you can hear in the rising note registers.
      `;
    } else {
      // Seasonal cycle analysis
      storySummaryText.innerHTML = `
        <strong>Seasonal Harmonic:</strong> Spanning <em>${start.date}</em> to <em>${end.date}</em>, this region exhibits 
        Earth's orbital rhythm with high temperatures around <strong>${data.max.toFixed(1)}${data.units}</strong> in July/August 
        and winter troughs dipping to <strong>${data.min.toFixed(1)}${data.units}</strong> in January, producing a repeating melodic wave.
      `;
    }
  }

  /**
   * Sets up or updates the Leaflet map with NASA GIBS Tile Layer and Area Bounding Box.
   */
  function initOrUpdateMap(data, meta) {
    const bbox = data.area && data.area.bbox ? data.area.bbox : [-125, 45, -115, 52];
    const southWest = L.latLng(bbox[1], bbox[0]);
    const northEast = L.latLng(bbox[3], bbox[2]);
    const bounds = L.latLngBounds(southWest, northEast);
    const center = bounds.getCenter();

    if (!leafletMap) {
      leafletMap = L.map('map', {
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: false
      }).setView(center, meta.default_zoom || 6);

      // Attribution
      leafletMap.attributionControl.setPrefix(
        '<a href="https://earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs" target="_blank">NASA GIBS</a>'
      );
    } else {
      leafletMap.setView(center, meta.default_zoom || 6);
      if (bboxOverlay) {
        leafletMap.removeLayer(bboxOverlay);
      }
    }

    // Add highlighted bounding box rectangle
    const strokeColor = meta.accent_color || '#38bdf8';
    bboxOverlay = L.rectangle(bounds, {
      color: strokeColor,
      weight: 3,
      fillColor: strokeColor,
      fillOpacity: 0.15
    }).addTo(leafletMap);

    leafletMap.fitBounds(bounds, { padding: [25, 25] });

    // Update GIBS Tile Layer for first date
    lastTileDate = null;
    updateGibsTileDate(data.frames[0].date, meta.gibs_layer);
  }

  /**
   * Updates NASA GIBS Tile Layer to match the current frame's date.
   */
  function updateGibsTileDate(dateStr, layerName) {
    if (!leafletMap) return;
    if (lastTileDate === dateStr) return; // Prevent unnecessary tile reloads
    lastTileDate = dateStr;

    if (gibsTileLayer) {
      leafletMap.removeLayer(gibsTileLayer);
    }

    const layer = layerName || 'MODIS_Terra_CorrectedReflectance_TrueColor';
    const tileUrl = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${dateStr}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;

    gibsTileLayer = L.tileLayer(tileUrl, {
      maxZoom: 9,
      minZoom: 1,
      tileSize: 256,
      attribution: 'NASA Earth Science Data / GIBS'
    }).addTo(leafletMap);

    // Keep bbox overlay on top of satellite imagery
    if (bboxOverlay) {
      bboxOverlay.bringToFront();
    }
  }

  /**
   * Synchronizes UI elements with the current data frame.
   */
  function updateFrameUI(index, frame) {
    if (!currentStoryData) return;
    const total = currentStoryData.frames.length;

    // Counter & Readouts
    frameCounter.textContent = `Frame ${index + 1} of ${total}`;
    visibleDate.textContent = frame.date;
    visibleValue.textContent = `${frame.value.toFixed(1)} ${currentStoryData.units}`;
    chipDate.textContent = frame.date;
    timelineScrubber.value = index;

    // Check if threshold crossing for alert styling
    const isAlert = currentStoryData.threshold !== null && frame.value >= currentStoryData.threshold;
    if (isAlert) {
      visibleValue.style.color = 'var(--accent-red)';
    } else {
      visibleValue.style.color = 'var(--text-highlight)';
    }

    // Accessible Screen Reader Announcement (polite)
    liveReadout.textContent = `Date: ${frame.date}. Value: ${frame.value.toFixed(1)} degrees Celsius.${isAlert ? ' Alert: threshold exceeded.' : ''}`;

    // Update satellite map tile imagery
    updateGibsTileDate(frame.date, currentStoryMeta.gibs_layer);
  }

  /**
   * Connects AudioEngine events to the UI.
   */
  function setupAudioEngineCallbacks() {
    AudioEngine.onFrame = (index, frame) => {
      updateFrameUI(index, frame);
    };

    AudioEngine.onStateChange = (isPlaying) => {
      btnPlayPause.setAttribute('aria-pressed', isPlaying ? 'true' : 'false');
      if (isPlaying) {
        playIcon.textContent = '⏸';
        playText.textContent = 'Pause';
        btnPlayPause.classList.add('playing');
      } else {
        playIcon.textContent = '▶';
        playText.textContent = 'Play';
        btnPlayPause.classList.remove('playing');
      }
    };
  }

  /**
   * Wires all user controls and keyboard navigation.
   */
  function setupEventListeners() {
    // Return to catalog
    btnBackCatalog.addEventListener('click', () => {
      AudioEngine.pause();
      playerView.hidden = true;
      landingView.hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Play / Pause
    btnPlayPause.addEventListener('click', () => {
      if (AudioEngine.isPlaying) {
        AudioEngine.pause();
      } else {
        AudioEngine.play();
      }
    });

    // Step Back
    btnStepBack.addEventListener('click', () => {
      AudioEngine.pause();
      AudioEngine.seek(AudioEngine.currentIndex - 1);
    });

    // Step Forward
    btnStepForward.addEventListener('click', () => {
      AudioEngine.pause();
      AudioEngine.seek(AudioEngine.currentIndex + 1);
    });

    // Scrubber Slider
    timelineScrubber.addEventListener('input', (e) => {
      const idx = parseInt(e.target.value, 10);
      AudioEngine.seek(idx);
    });

    // Playback Speed
    selectSpeed.addEventListener('change', (e) => {
      AudioEngine.setRate(parseFloat(e.target.value));
    });

    // Volume Slider
    sliderVolume.addEventListener('input', (e) => {
      AudioEngine.setVolume(parseFloat(e.target.value));
    });

    // Sample Preview Buttons in Legend
    sampleButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const sampleType = btn.getAttribute('data-sample');
        AudioEngine.playSample(sampleType);
      });
    });

    // Global Accessible Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      // Ignore if user is inside an input or select
      if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
      if (e.target.tagName === 'SELECT') return;

      // Escape -> Back to catalog
      if (e.key === 'Escape' && !playerView.hidden) {
        e.preventDefault();
        btnBackCatalog.click();
        return;
      }

      // 1, 2, 3 -> Switch to Story 1, 2, or 3
      if (['1', '2', '3'].includes(e.key)) {
        const storyIdx = parseInt(e.key, 10) - 1;
        if (stories[storyIdx]) {
          e.preventDefault();
          loadStory(stories[storyIdx]);
          return;
        }
      }

      // In Player View:
      if (!playerView.hidden) {
        // Space -> Play / Pause
        if (e.key === ' ' || e.code === 'Space') {
          e.preventDefault();
          btnPlayPause.click();
        }
        // Left Arrow -> Step back
        else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          btnStepBack.click();
        }
        // Right Arrow -> Step forward
        else if (e.key === 'ArrowRight') {
          e.preventDefault();
          btnStepForward.click();
        }
        // Home -> First frame
        else if (e.key === 'Home') {
          e.preventDefault();
          AudioEngine.seek(0);
        }
        // End -> Last frame
        else if (e.key === 'End' && currentStoryData) {
          e.preventDefault();
          AudioEngine.seek(currentStoryData.frames.length - 1);
        }
      }
    });
  }

  // Run on page ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
