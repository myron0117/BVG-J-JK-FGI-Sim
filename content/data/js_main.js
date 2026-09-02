// ========================================================================================
//  J/JK FGI-Simulator
// ========================================================================================
(function () {
  'use strict';
  const currentScript = document.querySelector('script[src*="js_main.js"]');
  const isRemote = currentScript && currentScript.dataset.remote === '1';

  // ---------- DOM references (unchanged) ----------
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const infoFallbackLayer = $('.information-display-fallback-layer');
  const infoLineIcon = $('.information-display-line-icon');
  const simpleContainer = $('#information-display-line-simple');
  const exitsContainer = $('#information-display-exits-connections');
  const extendedContainer = $('#information-display-line-extended');
  const extendedArrow = $('.information-display-line-extended-arrow');
  const extendedDestination = $('.information-display-line-extended-destination');
  const overlayImages = $$('.interface-overlay');
  const appearanceLightBtn = $('#appearanceLightModeButton');
  const appearanceDarkBtn = $('#appearanceDarkModeButton');

  const dirFallback = $('.direction-display-fallback-layer');
  const dirDestination = $('.direction-display-destination');
  const dirDestName = $('.direction-display-destination-name');
  const dirDestLineIcon = $('.direction-display-destination-line-icon');
  const dirDestLineIconSuburban = $('.direction-display-destination-line-icon-suburban');
  const nextStationDisplay = $('.direction-display-next-station');
  const nextStationName = $('.direction-display-next-station-name');
  const nextStationPage1 = $('.direction-display-next-station-page-1');
  const nextStationPage2 = $('.direction-display-next-station-page-2');
  const exitLeftArrow = $('.direction-display-next-station-exit-left');
  const exitRightArrow = $('.direction-display-next-station-exit-right');
  const exitSideContainer = $('.direction-display-next-station-exit-side');

  const doorLightbar = $('#door-lightbar');

  const btnLangDE = $('#languageToggleGermanButton');
  const btnLangEN = $('#languageToggleEnglishButton');

  const btnConfirm = $('#routeConfirmButton');
  const btnReset = $('#routeResetButton');
  const btnForward = $('#routeForwardButton');
  const btnBackward = $('#routeBackwardButton');
  const btnArrival = $('#routeArrivalButton');
  const btnDoorRelease = $('#routeDoorReleaseButton');
  const btnDoorLock = $('#routeDoorLockButton');

  const inputLine = $('#inputLine');
  const inputStart = $('#inputStartStation');
  const inputEnd = $('#inputEndStation');
  const inputSkip = $('#inputStationsToSkip');

  const btnSide1 = $('#configDisplaySideOneButton');
  const btnSide2 = $('#configDisplaySideTwoButton');
  const btnPosH = $('#configDisplayPositionFrontButton');
  const btnPosM = $('#configDisplayPositionMidButton');
  const btnPosV = $('#configDisplayPositionBackButton');
  const btnAlwaysY = $('#configAlwaysShowExitsOverviewTrueButton');
  const btnAlwaysN = $('#configAlwaysShowExitsOverviewFalseButton');
  const btnLiveY = $('#configShowLiveConnectionsOverviewTrueButton');
  const btnLiveN = $('#configShowLiveConnectionsOverviewFalseButton');
  const btnCombinedAlt = $('#configCombinedLineDesignAlternativeButton');
  const btnCombinedReal = $('#configCombinedLineDesignRealisticButton');
  const btnFallback1 = $('#configFallbackLayerOneButton');
  const btnFallback2 = $('#configFallbackLayerTwoButton');
  const btnFallback3 = $('#configFallbackLayerThreeButton');
  const btnFallback4 = $('#configFallbackLayerFourButton');
  const fallbackBtns = [btnFallback1, btnFallback2, btnFallback3, btnFallback4];

  const btnRemoteY = $('#configAllowRemoteControlTrueButton');
  const btnRemoteN = $('#configAllowRemoteControlFalseButton');

  const saveBtn = document.getElementById('saveConfigButton');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      try {
        const response = await fetch('/save-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config)
        });
        if (!response.ok) throw new Error('Server returned ' + response.status);
        console.log('Configuration saved.');
        // Optional visual feedback
        saveBtn.style.border = '4px solid #0ed145';
        setTimeout(() => { saveBtn.style.border = '4px solid #d2d2d2'; }, 2000);
      } catch (err) {
        console.error('Save failed:', err);
        alert('Could not save configuration.');
      }
    });
  }

  // ---------- state ----------
  let config = null;
  let localizationData = null;
  let lineData = null;
  let routeStations = [];
  let direction = 1;
  let currentRouteIndex = 0;
  let routeActive = false;
  let phase = 'normal';
  let allowRemoteControl = false;

  let gongTimer = null;
  let pageLoopTimer = null;
  let doorBlinkInterval = null;
  let blinkStopTimer = null;
  let forwardPendingTimer = null;
  let doorAutoCloseTimer = null;
  let directionPage = 1;
  let exitsTimedOut = false;
  let currentVia = null;

  let liveConnectionsTimer = null;      // 10‑second timer for showing the overview
  let liveConnectionsInterval = null;   // 10‑second page cycling
  let liveConnectionsTimeInterval = null; // periodic time update
  let liveConnectionsData = null;       // fetched departures
  let liveConnectionsPages = [];        // array of arrays (each page up to 12 services)
  let liveConnectionsCurrentPage = 0;
  let liveConnectionsStationId = null;  // cache the station ID
  let destinationFilter = null;

  let extendedStations = [];
  let extendedFrameFile = '';
  let extendedPositions = [];
  let stationPositions = null;

  const gongStandard = new Audio('audio/BVG_Gong_Standard.wav');
  const gongEnd = new Audio('audio/BVG_Gong_Endstation.wav');
  const doorSound = new Audio('audio/METRO_Türschlusssignal_Außen_2.wav');

  // ---------- helpers ----------
  const disableBtn = (btn) => { if (!btn) return; btn.style.opacity = '0.2'; btn.style.pointerEvents = 'none'; };
  const enableBtn = (btn) => { if (!btn) return; btn.style.opacity = '1'; btn.style.pointerEvents = 'auto'; };

  function currentTextColor() {
    return config && config.appearance === 'dark' ? '#ffffff' : '#252525';
  }

  function currentPassedColor() {
    return config && config.appearance === 'dark' ? '#585858' : '#8c8c8c';
  }

  function clearAllTimers() {
    if (gongTimer) { clearTimeout(gongTimer); gongTimer = null; }
    if (pageLoopTimer) { clearInterval(pageLoopTimer); pageLoopTimer = null; }
    if (doorBlinkInterval) { clearInterval(doorBlinkInterval); doorBlinkInterval = null; }
    if (blinkStopTimer) { clearTimeout(blinkStopTimer); blinkStopTimer = null; }
    if (forwardPendingTimer) { clearTimeout(forwardPendingTimer); forwardPendingTimer = null; }
    if (doorAutoCloseTimer) { clearTimeout(doorAutoCloseTimer); doorAutoCloseTimer = null; }
  }

  async function fetchDepartures(stationId) {
    try {
      const resp = await fetch(`http://127.0.0.1:7003/stops/${stationId}/departures?duration=120`);
      if (!resp.ok) throw new Error('API error');
      return await resp.json();
    } catch (e) {
      console.error('Failed to fetch departures:', e);
      return null;
    }
  }

  function processDepartures(departuresJson) {
    if (!departuresJson || !departuresJson.departures) return [];

    const currentLine = (lineData && lineData.line) ? lineData.line.toUpperCase() : '';
    const currentProduct = (lineData && lineData.alternative === 'suburban') ? 'suburban' : 'subway';

    const now = Date.now();
    const MIN_DEPARTURE_DELAY = 5 * 60 * 1000;   // 5 minutes in milliseconds

    const filtered = departuresJson.departures.filter(d => {
      const product = d.line && d.line.product;
      if (!product) return false;
      if (product === 'express' || product === 'ferry') return false;
      const name = (d.line && d.line.name) || '';
      if (product === currentProduct && name.toUpperCase() === currentLine) return false;

      // Exclude services leaving too soon
      if (!d.when) return false;
      const departureTime = new Date(d.when).getTime();
      if (departureTime - now < MIN_DEPARTURE_DELAY) return false;

      return true;
    });

    // 2. Product order
    const productOrder = { regional: 1, suburban: 2, subway: 3, tram: 4, bus: 5 };

    // 3. Group by product
    const groups = {};
    filtered.forEach(d => {
      const product = d.line.product;
      if (!groups[product]) groups[product] = [];
      groups[product].push(d);
    });

    // 4. Within each product, sort by line name (custom for S‑Bahn)
    const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

    const compareLineNames = (nameA, nameB, product) => {
      if (product === 'suburban') {
        const extract = (name) => {
          const match = name.match(/(\d+)/);
          if (!match) return { primary: Infinity, full: Infinity };
          const full = parseInt(match[1], 10);
          const primary = parseInt(match[1][0], 10);
          return { primary, full };
        };
        const a = extract(nameA);
        const b = extract(nameB);
        if (a.primary !== b.primary) return a.primary - b.primary;
        return a.full - b.full;
      }
      return collator.compare(nameA, nameB);
    };

    for (const product in groups) {
      groups[product].sort((a, b) => {
        const nameA = (a.line && a.line.name) || '';
        const nameB = (b.line && b.line.name) || '';
        return compareLineNames(nameA, nameB, product);
      });
    }

    // 5. Within each line, keep only earliest departure per destination
    for (const product in groups) {
      const deduped = [];
      const seen = new Map(); // key: lineName + '|' + direction
      groups[product].forEach(d => {
        const lineName = (d.line && d.line.name) || '';
        const dir = d.direction || '';
        const key = lineName + '|' + dir;
        if (!seen.has(key)) {
          seen.set(key, d);
        } else {
          // keep the earlier one
          const existing = seen.get(key);
          if (new Date(d.when).getTime() < new Date(existing.when).getTime()) {
            seen.set(key, d);
          }
        }
      });
      groups[product] = Array.from(seen.values());
    }

    // 6. Now sort within each product: line name order first, then departure time
    for (const product in groups) {
      groups[product].sort((a, b) => {
        const nameA = (a.line && a.line.name) || '';
        const nameB = (b.line && b.line.name) || '';
        const cmp = compareLineNames(nameA, nameB, product);
        if (cmp !== 0) return cmp;
        // same line → earlier departure first
        return new Date(a.when).getTime() - new Date(b.when).getTime();
      });
    }

    // 7. Flatten in product order
    const sorted = [];
    ['regional', 'suburban', 'subway', 'tram', 'bus'].forEach(product => {
      if (groups[product]) sorted.push(...groups[product]);
    });

    // 8. Split into pages of 12
    const pages = [];
    for (let i = 0; i < sorted.length; i += 12) {
      pages.push(sorted.slice(i, i + 12));
    }
    return pages;
  }

  function startLiveConnectionsTimer() {
    if (isRemote) return;          // only on main page
    if (liveConnectionsTimer) clearTimeout(liveConnectionsTimer);
    liveConnectionsTimer = setTimeout(() => showLiveConnections(), 10000);
  }

  async function showLiveConnections() {
    if (!routeActive) return;
    const station = routeStations[currentRouteIndex];
    const stationId = station.apiID;
    if (!stationId) return;

    // Fetch if not already cached for this station
    if (liveConnectionsStationId !== stationId) {
      liveConnectionsStationId = stationId;
      const json = await fetchDepartures(stationId);
      liveConnectionsData = json;
      liveConnectionsPages = processDepartures(json);
    }

    if (liveConnectionsPages.length === 0) {
      hideLiveConnections();
      return;
    }

    liveConnectionsCurrentPage = 0;
    renderLiveConnectionsPage(liveConnectionsCurrentPage);
    updatePageIndicator();

    // Show the container
    const lcContainer = document.getElementById('information-display-live-connections');
    if (lcContainer) lcContainer.style.visibility = config.showLiveConnectionsOverview ? 'visible' : 'hidden';

    // Update grid image for current appearance
    updateLiveConnectionsGridSrc();

    // ★★★ BROADCAST PAGES TO POP‑OUTS ★★★
    if (!isRemote && window.broadcastChannel && liveConnectionsPages.length > 0) {
      window.broadcastChannel.postMessage({
        type: 'liveConnections',
        pages: liveConnectionsPages
      });
    }

    // Start page cycling
    if (liveConnectionsInterval) clearInterval(liveConnectionsInterval);
    liveConnectionsInterval = setInterval(() => {
      liveConnectionsCurrentPage = (liveConnectionsCurrentPage + 1) % liveConnectionsPages.length;
      renderLiveConnectionsPage(liveConnectionsCurrentPage);
      updatePageIndicator();
    }, 10000);

    // Start time updates
    if (liveConnectionsTimeInterval) clearInterval(liveConnectionsTimeInterval);
    liveConnectionsTimeInterval = setInterval(updateLiveConnectionTimes, 5000);
  }

  function hideLiveConnections() {
    const lcContainer = document.getElementById('information-display-live-connections');
    if (lcContainer) lcContainer.style.visibility = 'hidden';

    if (liveConnectionsTimer) { clearTimeout(liveConnectionsTimer); liveConnectionsTimer = null; }
    if (liveConnectionsInterval) { clearInterval(liveConnectionsInterval); liveConnectionsInterval = null; }
    if (liveConnectionsTimeInterval) { clearInterval(liveConnectionsTimeInterval); liveConnectionsTimeInterval = null; }
    liveConnectionsCurrentPage = 0;
    liveConnectionsStationId = null;
    liveConnectionsData = null;
    liveConnectionsPages = [];

    // Tell all pop‑outs to hide as well
    if (!isRemote && window.broadcastChannel) {
      window.broadcastChannel.postMessage({ type: 'hideLiveConnections' });
    }
  }

  function renderLiveConnectionsPage(pageIdx) {
    const lcContainer = document.getElementById('information-display-live-connections');
    if (!lcContainer) return;
    // Remove existing service rows (all children with class 'information-display-live-connections-service')
    const oldRows = lcContainer.querySelectorAll('.information-display-live-connections-service');
    oldRows.forEach(el => el.remove());

    const page = liveConnectionsPages[pageIdx];
    if (!page) return;
    const html = buildLiveConnectionsPage(page);
    // Insert after the page indicator row (or before the first service row)
    const indicatorRow = lcContainer.querySelector('.information-display-live-connections-page-indicator-row');
    if (indicatorRow) {
      indicatorRow.insertAdjacentHTML('afterend', html);
    } else {
      lcContainer.insertAdjacentHTML('beforeend', html);
    }
  }

  function updatePageIndicator() {
    const lcContainer = document.getElementById('information-display-live-connections');
    if (!lcContainer) return;
    const indicators = lcContainer.querySelectorAll('.information-display-live-connections-page-indicator');
    const totalPages = liveConnectionsPages.length;
    const isDark = config.appearance === 'dark';

    // Hide all if only one page
    const indicatorRow = lcContainer.querySelector('.information-display-live-connections-page-indicator-row');
    if (totalPages <= 1) {
      if (indicatorRow) indicatorRow.style.display = 'none';
      return;
    }
    if (indicatorRow) indicatorRow.style.display = '';

    indicators.forEach((img, i) => {
      if (i >= totalPages) {
        img.style.display = 'none';
        return;
      }
      img.style.display = '';
      const filled = i === liveConnectionsCurrentPage ? '1' : '0';
      img.src = `visuals/interface/information_display/connections_overview/page_indicator_${filled}_${isDark ? 'dark' : 'light'}.svg`;
    });
  }

  function formatLiveMinutes(minutes) {
    const marker = (config && config.appearance === 'dark') ? '’' : "'";
    if (minutes > 0) return `${minutes}${marker}`;
    return `0${marker}`;
  }

  function updateLiveConnectionTimes() {
    const lcContainer = document.getElementById('information-display-live-connections');
    if (!lcContainer) return;
    const timeEls = lcContainer.querySelectorAll('.information-display-live-connections-service-time');
    const now = Date.now();
    timeEls.forEach(el => {
      // The dataset stores the original departure ISO string
      const iso = el.dataset.when;
      if (!iso) return;
      const then = new Date(iso).getTime();
      const mins = Math.ceil((then - now) / 60000);
      el.textContent = formatLiveMinutes(mins);
    });
    // Also update the data-when on the time elements when the page is built
  }

  function buildLiveConnectionsPage(pageServices) {
    if (!pageServices || pageServices.length === 0) return '';

    const iconPositions = {
      suburban: { left: '29px', top: '20px', height: '40px', iconFolder: 'suburban_lines' },
      subway: { left: '32px', top: '21px', height: '39px', iconFolder: 'subway_lines' },
      tram: { left: '31px', top: '22px', height: '40px', iconFolder: null },
      bus: { left: '29px', top: '20px', height: '44px', iconFolder: null },
    };

    const leftTops = [580, 662, 746, 830, 914, 998];
    const rightTops = [580, 662, 746, 830, 914, 998];
    const layout = [];
    for (let i = 0; i < 12; i++) {
      layout.push({
        left: i < 6 ? '0px' : '960px',
        top: i < 6 ? leftTops[i] + 'px' : rightTops[i - 6] + 'px'
      });
    }

    let html = '';
    pageServices.forEach((d, idx) => {
      if (idx >= 12) return;
      const product = d.line && d.line.product;
      const lineName = (d.line && d.line.name) || '';
      const direction = applyDestinationFilter(d.direction || '');
      const when = d.when || '';
      const minutes = when ? Math.ceil((new Date(when).getTime() - Date.now()) / 60000) : 0;
      const pos = layout[idx];   // <-- layout coordinates

      if (product === 'regional') {
        html += `
                <div class="information-display-live-connections-service" style="left:${pos.left}; top:${pos.top};">
                    <div class="information-display-live-connections-service-regional-box"></div>
                    <div class="information-display-live-connections-service-regional-line">${lineName}</div>
                    <img class="information-display-live-connections-service-icon" src="" style="display:none;">
                    <div class="information-display-live-connections-service-line" style="display:none;"></div>
                    <div class="information-display-live-connections-service-destination">${direction}</div>
                    <div class="information-display-live-connections-service-time" data-when="${when}">${formatLiveMinutes(minutes)}</div>
                </div>`;
      } else if (product === 'suburban' || product === 'subway') {
        const ico = iconPositions[product];
        const iconSrc = `visuals/service_icons/${ico.iconFolder}/${lineName}.svg`;
        html += `
                <div class="information-display-live-connections-service" style="left:${pos.left}; top:${pos.top};">
                    <div class="information-display-live-connections-service-regional-box" style="display:none;"></div>
                    <div class="information-display-live-connections-service-regional-line" style="display:none;"></div>
                    <img class="information-display-live-connections-service-icon" src="${iconSrc}" style="left:${ico.left}; top:${ico.top}; height:${ico.height};">
                    <div class="information-display-live-connections-service-line" style="display:none;"></div>
                    <div class="information-display-live-connections-service-destination">${direction}</div>
                    <div class="information-display-live-connections-service-time" data-when="${when}">${formatLiveMinutes(minutes)}</div>
                </div>`;
      } else if (product === 'tram' || product === 'bus') {
        const ico = iconPositions[product];
        const iconSrc = `visuals/service_icons/${product}.svg`;
        html += `
                <div class="information-display-live-connections-service" style="left:${pos.left}; top:${pos.top};">
                    <div class="information-display-live-connections-service-regional-box" style="display:none;"></div>
                    <div class="information-display-live-connections-service-regional-line" style="display:none;"></div>
                    <img class="information-display-live-connections-service-icon" src="${iconSrc}" style="left:${ico.left}; top:${ico.top}; height:${ico.height};">
                    <div class="information-display-live-connections-service-line">${lineName}</div>
                    <div class="information-display-live-connections-service-destination">${direction}</div>
                    <div class="information-display-live-connections-service-time" data-when="${when}">${formatLiveMinutes(minutes)}</div>
                </div>`;
      }
    });
    return html;
  }

  function applyDestinationFilter(direction) {
    if (!direction) return '';
    let result = direction;
    if (destinationFilter) {
      for (const [from, to] of Object.entries(destinationFilter)) {
        result = result.split(from).join(to);
      }
    }
    return result.trim();
  }

  function liveConnectionsGridSrc() {
    const isDark = config.appearance === 'dark';
    const prefix = 'visuals/interface/information_display/connections_overview/';
    const alt = lineData && lineData.alternative;
    if (alt === 'tram') {
      return prefix + (isDark ? 'grid_cube_dark.svg' : 'grid_cube_light.svg');
    }
    if (alt === 'bus' || alt === 'ferry' || alt === 'suburban') {
      return prefix + (isDark ? 'grid_circle_dark.svg' : 'grid_circle_light.svg');
    }
    return prefix + (isDark ? 'grid_default_dark.svg' : 'grid_default_light.svg');
  }

  function updateLiveConnectionsGridSrc() {
    const gridImg = document.querySelector('.information-display-live-connections-grid');
    if (gridImg) gridImg.src = liveConnectionsGridSrc();
  }

  function showLiveConnectionsRemote(pages) {
    if (!pages || pages.length === 0) {
      hideLiveConnections();
      return;
    }
    liveConnectionsPages = pages;
    liveConnectionsCurrentPage = 0;
    renderLiveConnectionsPage(liveConnectionsCurrentPage);
    updatePageIndicator();
    const lcContainer = document.getElementById('information-display-live-connections');
    if (lcContainer) lcContainer.style.visibility = config.showLiveConnectionsOverview ? 'visible' : 'hidden';
    updateLiveConnectionsGridSrc();

    // Send the complete pages to all pop‑outs
    if (!isRemote && window.broadcastChannel && liveConnectionsPages.length > 0) {
      window.broadcastChannel.postMessage({
        type: 'liveConnections',
        pages: liveConnectionsPages
      });
    }

    // Start page cycling on pop‑out too
    if (liveConnectionsInterval) clearInterval(liveConnectionsInterval);
    liveConnectionsInterval = setInterval(() => {
      liveConnectionsCurrentPage = (liveConnectionsCurrentPage + 1) % liveConnectionsPages.length;
      renderLiveConnectionsPage(liveConnectionsCurrentPage);
      updatePageIndicator();
    }, 10000);

    // Start time updates
    if (liveConnectionsTimeInterval) clearInterval(liveConnectionsTimeInterval);
    liveConnectionsTimeInterval = setInterval(updateLiveConnectionTimes, 5000);
  }

  function playSound(audio) {
    audio.currentTime = 0;
    audio.play().catch(() => { });
  }

  async function loadJSON(url) {
    // Add a cache-buster to prevent stale responses
    const cacheBuster = '?t=' + Date.now();
    const r = await fetch(url + cacheBuster);
    if (!r.ok) throw new Error(`Fehler beim Laden: ${url}`);
    return r.json();
  }

  async function loadLineJSON(lineName) {
    const productFolders = ['subway', 'suburban', 'tram', 'bus', 'ferry'];
    for (const folder of productFolders) {
      try {
        const path = `data/lines/${folder}/${lineName}.json`;
        const data = await loadJSON(path);
        data.filePath = `${folder}/${lineName}`;   // store the relative path
        return data;
      } catch (e) {
        // continue searching
      }
    }
    throw new Error('Line not found in any product folder');
  }

  function measureTextWidth(text, fontSize, fontFamily = 'TransitPro') {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    ctx.font = `bold ${fontSize}px ${fontFamily}, sans-serif`;
    return ctx.measureText(text).width;
  }

  function fitNameToPage(nameEl, container, maxFontSize) {
    const text = nameEl.textContent;
    let fontSize = maxFontSize;
    const maxWidth = 1600;   // available width when name is alone on the page
    while (fontSize > 30 && measureTextWidth(text, fontSize) * 0.95 > maxWidth) {
      fontSize -= 2;
    }
    nameEl.style.fontSize = fontSize + 'px';
    adjustStationNameScale(nameEl);
  }

  function serviceIconHTML(service, size) {
    if (service.startsWith('U')) {
      if (size === 'simple') {
        return `<div style="width:52px; height:31px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/subway_lines/${service}.svg" style="width:52px; flex-shrink:0;"></div>`;
      } else if (size === 'extended' || size === 'grayscale') {
        const base = size === 'grayscale' ? 'visuals/service_icons/grayscale/subway_lines/' : 'visuals/service_icons/subway_lines/';
        return `<div style="width:26px; height:15px; display:flex; justify-content:center; align-items:center;"><img src="${base}${service}.svg" style="width:26px; flex-shrink:0;"></div>`;
      } else if (size === 'exits') {
        return `<div style="width:88px; height:52px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/subway_lines/${service}.svg" style="width:88px; flex-shrink:0;"></div>`;
      } else if (size === 'direction') {
        return `<div style="width:260px; height:154px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/subway_lines/${service}.svg" style="width:260px; flex-shrink:0;"></div>`;
      }
      return '';
    }
    if (service.startsWith('S')) {
      if (size === 'simple') {
        return `<div style="width:56px; height:31px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/suburban_lines/${service}.svg" style="width:62px; flex-shrink:0;"></div>`;
      } else if (size === 'extended' || size === 'grayscale') {
        const base = size === 'grayscale' ? 'visuals/service_icons/grayscale/suburban_lines/' : 'visuals/service_icons/suburban_lines/';
        return `<div style="width:26px; height:15px; display:flex; justify-content:center; align-items:center;"><img src="${base}${service}.svg" style="width:30px; flex-shrink:0;"></div>`;
      } else if (size === 'exits') {
        return `<div style="width:96px; height:52px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/suburban_lines/${service}.svg" style="width:104px; flex-shrink:0;"></div>`;
      } else if (size === 'direction') {
        return `<div style="width:280px; height:154px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/suburban_lines/${service}.svg" style="width:308px; flex-shrink:0;"></div>`;
      }
      return '';
    }
    const map = {
      fernverkehr: {
        simple: `<div style="width:31px; height:31px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/fernverkehr.svg" style="width:35px; flex-shrink:0;"></div>`,
        extended: `<div style="width:17px; height:15px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/fernverkehr.svg" style="width:17px; flex-shrink:0;"></div>`,
        grayscale: `<div style="width:17px; height:15px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/grayscale/fernverkehr.svg" style="width:17px; flex-shrink:0;"></div>`,
        exits: `<div style="width:52px; height:52px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/fernverkehr.svg" style="width:58px; flex-shrink:0;"></div>`,
        direction: `<div style="width:155px; height:154px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/fernverkehr.svg" style="width:173px; flex-shrink:0;"></div>`
      },
      bahn: {
        simple: `<div style="width:30px; height:31px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/bahn.svg" style="width:42px; flex-shrink:0;"></div>`,
        extended: `<div style="width:21px; height:15px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/bahn.svg" style="width:21px; flex-shrink:0;"></div>`,
        grayscale: `<div style="width:21px; height:15px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/grayscale/bahn.svg" style="width:21px; flex-shrink:0;"></div>`,
        exits: `<div style="width:53px; height:52px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/bahn.svg" style="width:71px; flex-shrink:0;"></div>`,
        direction: `<div style="width:155px; height:154px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/bahn.svg" style="width:211px; flex-shrink:0;"></div>`
      },
      sbahn: {
        simple: `<div style="width:31px; height:31px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/sbahn.svg" style="width:35px; flex-shrink:0;"></div>`,
        extended: `<div style="width:17px; height:15px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/sbahn.svg" style="width:17px; flex-shrink:0;"></div>`,
        grayscale: `<div style="width:17px; height:15px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/grayscale/sbahn.svg" style="width:17px; flex-shrink:0;"></div>`,
        exits: `<div style="width:52px; height:52px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/sbahn.svg" style="width:58px; flex-shrink:0;"></div>`,
        direction: `<div style="width:155px; height:154px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/sbahn.svg" style="width:173px; flex-shrink:0;"></div>`
      },
      jelbi: {
        simple: `<div style="width:31px; height:31px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/jelbi.svg" style="width:31px; flex-shrink:0;"></div>`,
        extended: `<div style="width:15px; height:15px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/jelbi.svg" style="width:15px; flex-shrink:0;"></div>`,
        grayscale: `<div style="width:15px; height:15px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/grayscale/jelbi.svg" style="width:15px; flex-shrink:0;"></div>`,
        exits: `<div style="width:52px; height:52px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/jelbi.svg" style="width:52px; flex-shrink:0;"></div>`,
        direction: `<div style="width:154px; height:154px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/jelbi.svg" style="width:154px; flex-shrink:0;"></div>`
      },
      flughafen: {
        simple: `<div style="width:31px; height:31px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/flughafen.svg" style="width:35px; flex-shrink:0;"></div>`,
        extended: `<div style="width:17px; height:15px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/flughafen.svg" style="width:17px; flex-shrink:0;"></div>`,
        grayscale: `<div style="width:17px; height:15px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/grayscale/flughafen.svg" style="width:17px; flex-shrink:0;"></div>`,
        exits: `<div style="width:52px; height:52px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/flughafen.svg" style="width:58px; flex-shrink:0;"></div>`,
        direction: `<div style="width:155px; height:154px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/flughafen.svg" style="width:173px; flex-shrink:0;"></div>`
      },
      tram: { exits: `<div style="width:52px; height:52px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/tram.svg" style="width:52px; flex-shrink:0;"></div>` },
      bus: {
        simple: `<div style="width:31px; height:31px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/bus.svg" style="width:35px; flex-shrink:0;"></div>`,
        extended: `<div style="width:17px; height:15px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/bus.svg" style="width:17px; flex-shrink:0;"></div>`,
        grayscale: `<div style="width:17px; height:15px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/grayscale/bus.svg" style="width:17px; flex-shrink:0;"></div>`,
        exits: `<div style="width:52px; height:52px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/bus.svg" style="width:58px; flex-shrink:0;"></div>`,
        direction: `<div style="width:155px; height:154px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/bus.svg" style="width:173px; flex-shrink:0;"></div>`
      },
      ferry: { exits: `<div style="width:52px; height:52px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/ferry.svg" style="width:58px; flex-shrink:0;"></div>` }
    };
    if (map[service] && map[service][size]) return map[service][size];
    return '';
  }

  // Safe setters for direction‑display elements (which may be absent in remote mode)
  function setDirDisplay(prop, value, important = false) {
    if (dirDestination) {
      if (important) dirDestination.style.setProperty(prop, value, 'important');
      else dirDestination.style[prop] = value;
    }
  }
  function setNextStationDisplay(prop, value, important = false) {
    if (nextStationDisplay) {
      if (important) nextStationDisplay.style.setProperty(prop, value, 'important');
      else nextStationDisplay.style[prop] = value;
    }
  }
  function setExitArrows(leftShow, rightShow) {
    if (exitLeftArrow) exitLeftArrow.style.visibility = leftShow ? 'visible' : 'hidden';
    if (exitRightArrow) exitRightArrow.style.visibility = rightShow ? 'visible' : 'hidden';
  }

  function currentOverlaySrc() {
    const isDark = config.appearance === 'dark';
    const prefix = 'visuals/interface/information_display/background/';
    const alt = lineData && lineData.alternative;
    if (alt === 'tram') {
      return prefix + (isDark ? 'main_cube_dark.svg' : 'main_cube_light.svg');
    }
    if (alt === 'bus' || alt === 'ferry' || alt === 'suburban') {
      return prefix + (isDark ? 'main_circle_dark.svg' : 'main_circle_light.svg');
    }
    // default (subway)
    return prefix + (isDark ? 'main_default_dark.svg' : 'main_default_light.svg');
  }

  // ---------- configuration ----------
  async function loadConfig() {
    try {
      config = await loadJSON('config/config.json');
    } catch (e) {
      console.warn('config.json not found, using defaults');
      config = {
        language: 'de',
        displaySide: 1,
        displayPosition: 2,
        alwaysShowExitsOverview: false,
        showLiveConnectionsOverview: true,
        fallbackLayer: 1,
        appearance: 'light',
        combinedLineDesign: 'alternative'
      };
    }
    try {
      stationPositions = await loadJSON('data/extended_line_station_positions.json');
    } catch (e) {
      console.error('Station positions file missing');
    }
    applyConfigUI();
    if (!isRemote) updateConfirmButtonState();
  }

  function applyConfigUI() {
    const setActive = (btn, active) => btn && (btn.style.border = active ? '4px solid #f0d722' : '');
    setActive(btnLangDE, config.language === 'de');
    setActive(btnLangEN, config.language === 'en');
    setActive(btnSide1, config.displaySide === 1);
    setActive(btnSide2, config.displaySide === 2);
    setActive(btnPosH, config.displayPosition === 1);
    setActive(btnPosM, config.displayPosition === 2);
    setActive(btnPosV, config.displayPosition === 3);
    setActive(btnAlwaysY, config.alwaysShowExitsOverview);
    setActive(btnAlwaysN, !config.alwaysShowExitsOverview);
    setActive(btnLiveY, config.showLiveConnectionsOverview);
    setActive(btnLiveN, !config.showLiveConnectionsOverview);
    setActive(btnCombinedAlt, config.combinedLineDesign === 'alternative');
    setActive(btnCombinedReal, config.combinedLineDesign === 'realistic');
    setActive(btnFallback1, config.fallbackLayer === 1);
    setActive(btnFallback2, config.fallbackLayer === 2);
    setActive(btnFallback3, config.fallbackLayer === 3);
    setActive(btnFallback4, config.fallbackLayer === 4);
    setActive(appearanceLightBtn, config.appearance === 'light');
    setActive(appearanceDarkBtn, config.appearance === 'dark');
    setActive(btnRemoteY, allowRemoteControl);
    setActive(btnRemoteN, !allowRemoteControl);

    if (!config.showLiveConnectionsOverview) {
      const lcContainer = document.getElementById('information-display-live-connections');
      if (lcContainer && lcContainer.style.visibility === 'visible') {
        lcContainer.style.visibility = 'hidden';
      }
    }

    if (!isRemote && window.broadcastChannel) {
      window.broadcastChannel.postMessage({
        type: 'configUpdate',
        config: {
          showLiveConnectionsOverview: config.showLiveConnectionsOverview,
          combinedLineDesign: config.combinedLineDesign
        }
      });
    }

    if (!isRemote) {
      // If a fallback button is currently hovered, override the yellow border with white
      fallbackBtns.forEach(btn => {
        if (btn && btn.matches(':hover')) {      // safety check for null
          btn.style.border = '4px solid #ffffff';
        }
      });
      [btnLangDE, btnLangEN].forEach(btn => {
        if (btn && btn.matches(':hover')) {
          btn.style.border = '4px solid #ffffff';
        }
      });

      // Language buttons – same hover behaviour as fallback layer buttons
      const langBtns = [btnLangDE, btnLangEN];
      langBtns.forEach(btn => {
        if (!btn) return;
        btn.addEventListener('mouseenter', () => {
          btn.style.border = '4px solid #ffffff';
        });
        btn.addEventListener('mouseleave', () => {
          const isActive = (btn === btnLangDE && config.language === 'de') ||
            (btn === btnLangEN && config.language === 'en');
          btn.style.border = isActive ? '4px solid #f0d722' : '4px solid #d2d2d2';
        });
      });

      btnLangDE.onclick = () => { config.language = 'de'; applyConfigUI(); };
      btnLangEN.onclick = () => { config.language = 'en'; applyConfigUI(); };

      btnRemoteY.onclick = () => { allowRemoteControl = true; applyConfigUI(); };
      btnRemoteN.onclick = () => { allowRemoteControl = false; applyConfigUI(); };

      btnCombinedAlt.onclick = () => { config.combinedLineDesign = 'alternative'; applyConfigUI(); };
      btnCombinedReal.onclick = () => { config.combinedLineDesign = 'realistic'; applyConfigUI(); };
    }



    const srcMap = {
      1: 'visuals/interface/information_display/fallback_layer/bvg_logo.svg',
      2: 'visuals/interface/information_display/fallback_layer/network_map.svg',
      3: 'visuals/interface/information_display/fallback_layer/feedback_j.svg',
      4: 'visuals/interface/information_display/fallback_layer/fahrinfo_app.svg'
    };
    infoFallbackLayer.src = srcMap[config.fallbackLayer] || '';

    // Refresh displays immediately when config changes
    if (routeActive) {
      computeRouteSegmentColors();
      updateAllDisplays();
      if (!isRemote && (phase === 'arrival' || phase === 'doorReleased' || phase === 'closing')) {
        const station = routeStations[currentRouteIndex];
        const exitSide = station.exitSide[`direction${direction}`];
        const via = currentVia ||
          (currentRouteIndex === routeStations.length - 1 && exitSide?.terminus
            ? exitSide.terminus : exitSide?.via || '');
        const showExits = shouldShowExits(via);
        if (showExits) {
          simpleContainer.style.visibility = 'hidden';
          $$('.information-display-line-simple-station-name').forEach(el => el.style.visibility = 'hidden');
          $$('.information-display-line-simple-station-additional-name').forEach(el => el.style.visibility = 'hidden');
          $$('.information-display-line-simple-station-connections-rows').forEach(el => el.style.visibility = 'hidden');
          exitsContainer.style.visibility = 'visible';
          populateExitsConnections();
        } else {
          simpleContainer.style.visibility = 'visible';
          $$('.information-display-line-simple-station-name').forEach(el => el.style.visibility = 'visible');
          $$('.information-display-line-simple-station-additional-name').forEach(el => el.style.visibility = 'visible');
          $$('.information-display-line-simple-station-connections-rows').forEach(el => el.style.visibility = '');
          exitsContainer.style.visibility = 'hidden';
        }
      }
    }

    const lcContainer = document.getElementById('information-display-live-connections');
    if (lcContainer) {
      // The overview is "active" when the page‑cycling interval is running
      const lcActive = liveConnectionsInterval !== null;
      const shouldShowLC = config.showLiveConnectionsOverview && lcActive;
      lcContainer.style.visibility = shouldShowLC ? 'visible' : 'hidden';
      if (shouldShowLC) {
        updateLiveConnectionsGridSrc();
        updatePageIndicator();
      }
    }

    updatePositionButtonsLayout();

    // Dark mode
    const isDark = config.appearance === 'dark';
    document.body.classList.toggle('dark-mode', isDark);
    toggleDarkModeStyles(isDark);

    // Swap interface overlays
    overlayImages.forEach(img => { img.src = currentOverlaySrc(); });

    updateLiveConnectionsGridSrc();
    updatePageIndicator();
    updateLiveConnectionTimes();

    applyLocalization();

    // Broadcast appearance change to all pop‑outs
    if (!isRemote && window.broadcastChannel) {
      window.broadcastChannel.postMessage({
        type: 'appearanceChange',
        appearance: config.appearance
      });
    }
  }

  function applyLocalization() {
    if (!localizationData || !config || !config.language) return;
    const lang = config.language;

    // Labels (textContent)
    if (localizationData.labels) {
      localizationData.labels.forEach(item => {
        const el = document.getElementById(item.id);
        if (el && item.language[lang]) {
          el.textContent = item.language[lang];
        }
      });
    }

    // Inputs (placeholder)
    if (localizationData.inputs) {
      localizationData.inputs.forEach(item => {
        const el = document.getElementById(item.id);
        if (el && item.language[lang]) {
          el.placeholder = item.language[lang];
        }
      });
    }

    // Buttons (textContent)
    if (localizationData.buttons) {
      localizationData.buttons.forEach(item => {
        const el = document.getElementById(item.id);
        if (el && item.language[lang]) {
          el.textContent = item.language[lang];
        }
      });
    }
  }

  function toggleDarkModeStyles(enable) {
    let styleEl = document.getElementById('dark-mode-styles');
    if (enable) {
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'dark-mode-styles';
        styleEl.textContent = `
                /* ---------- Simple line overview ---------- */
                /* Lower station names & additional names → normal weight */
                .dark-mode .information-display-line-simple-station ~ .information-display-line-simple-station .information-display-line-simple-station-name,
                .dark-mode .information-display-line-simple-station .information-display-line-simple-station-additional-name {
                    font-weight: normal !important;
                }
                .dark-mode .information-display-line-simple-station ~ .information-display-line-simple-station-last .information-display-line-simple-station-name {
                    font-weight: bold !important;
                }
                /* Live clock */
                .dark-mode .information-display-clock {
                    font-weight: normal !important;
                }

                /* ---------- Extended line overview ---------- */
                .dark-mode .information-display-line-extended-station-name {
                    left: -13px !important;
                    top: -31px !important;
                    font-size: 32px !important;
                }
                .dark-mode .information-display-line-extended-station-connections {
                    transform: translateX(3px) !important;
                }
                /* Focused stations (termini, current/next) - 900 → bold */
                .dark-mode .information-display-line-extended-station-name[style*="font-weight: 900"] {
                    font-weight: bold !important;
                }
                /* Unfocused stations - bold → normal */
                .dark-mode .information-display-line-extended-station-name[style*="font-weight: bold"] {
                    font-weight: normal !important;
                }

                /* ---------- Text colours (existing) ---------- */
                .dark-mode .information-display-line-simple-station-name,
                .dark-mode .information-display-line-simple-station-additional-name,
                .dark-mode .information-display-line-extended-line-number,
                .dark-mode .information-display-line-extended-arrow,
                .dark-mode .information-display-line-extended-destination,
                .dark-mode .information-display-exits-connections-station-name,
                .dark-mode .information-display-exits-connections-station-additional-name,
                .dark-mode .direction-display-destination-name,
                .dark-mode .direction-display-next-station-name,
                .dark-mode .direction-display-next-station-connections,
                .dark-mode .information-display-clock,
                .dark-mode .information-display-exits-connections-connectionrow-left-arrow,
                .dark-mode .information-display-exits-connections-connectionrow-right-arrow {
                    color: #ffffff !important;
                }
                /* Extended-line station names - only colour current/future stations white */
                .dark-mode .information-display-line-extended-station-name:not([style*="color: #8c8c8c"]):not([style*="color: #585858"]),
                .dark-mode .information-display-line-extended-station-additional-name:not([style*="color: #8c8c8c"]):not([style*="color: #585858"]) {
                    color: #ffffff !important;
                }
                /* Keep passed stations in their correct colour */
                .dark-mode .information-display-line-extended-station-name[style*="color: #8c8c8c"],
                .dark-mode .information-display-line-extended-station-name[style*="color: #585858"],
                .dark-mode .information-display-line-extended-station-additional-name[style*="color: #8c8c8c"],
                .dark-mode .information-display-line-extended-station-additional-name[style*="color: #585858"] {
                    color: inherit;   /* let the inline style win */
                }
                .dark-mode .information-display-exits-connections-exitrow-item,
                .dark-mode .information-display-exits-connections-exitrow-item-textbox-single,
                .dark-mode .information-display-exits-connections-exitrow-item-textbox-double {
                    outline-color: #000000 !important;
                }



                .dark-mode .information-display-live-connections-service-line,
                .dark-mode .information-display-live-connections-service-destination,
                .dark-mode .information-display-live-connections-service-time {
                    color: #ffffff !important;
                }
                .dark-mode .information-display-live-connections-header {
                    color: #252525 !important;
                }

                .dark-mode .information-display-live-connections-header span[style*="font-style: italic"] {
                    font-weight: normal !important;
                }

                .dark-mode .information-display-live-connections-service-destination {
                    font-weight: normal !important;
                }

                /* ---------- Exits/connections overview ---------- */
                .dark-mode .information-display-exits-connections-exitrow-item-textbox-text {
                    font-weight: normal !important;
                }
                .dark-mode .information-display-exits-connections-station-name.has-additional-name {
                    top: 211px !important;
                }
                .dark-mode .information-display-exits-connections-station-additional-name {
                    top: 394px !important;
                    font-weight: normal !important;
                }
            `;
        document.head.appendChild(styleEl);
      }
    } else {
      if (styleEl) styleEl.remove();
    }
  }

  function shouldShowExits(via) {
    if (exitsTimedOut) return false;
    if (config.alwaysShowExitsOverview) return true;
    if (via === 'both') return true;
    const physicalSide = (direction === config.displaySide) ? 'left' : 'right';
    return via === physicalSide;
  }

  if (!isRemote) {
    btnSide1.onclick = () => { config.displaySide = 1; applyConfigUI(); };
    btnSide2.onclick = () => { config.displaySide = 2; applyConfigUI(); };
    btnPosH.onclick = () => { config.displayPosition = 1; applyConfigUI(); };
    btnPosM.onclick = () => { config.displayPosition = 2; applyConfigUI(); };
    btnPosV.onclick = () => { config.displayPosition = 3; applyConfigUI(); };
    btnAlwaysY.onclick = () => { config.alwaysShowExitsOverview = true; applyConfigUI(); };
    btnAlwaysN.onclick = () => { config.alwaysShowExitsOverview = false; applyConfigUI(); };
    btnLiveY.onclick = () => { config.showLiveConnectionsOverview = true; applyConfigUI(); };
    btnLiveN.onclick = () => { config.showLiveConnectionsOverview = false; applyConfigUI(); };
    btnFallback1.onclick = () => { config.fallbackLayer = 1; applyConfigUI(); };
    btnFallback2.onclick = () => { config.fallbackLayer = 2; applyConfigUI(); };
    btnFallback3.onclick = () => { config.fallbackLayer = 3; applyConfigUI(); };
    btnFallback4.onclick = () => { config.fallbackLayer = 4; applyConfigUI(); };
    appearanceLightBtn.onclick = () => { config.appearance = 'light'; applyConfigUI(); };
    appearanceDarkBtn.onclick = () => { config.appearance = 'dark'; applyConfigUI(); };

    fallbackBtns.forEach(btn => {
      btn.addEventListener('mouseenter', () => {
        btn.style.border = '4px solid #ffffff';
      });
      btn.addEventListener('mouseleave', () => {
        const activeValue = (btn === btnFallback1 && config.fallbackLayer === 1) ||
          (btn === btnFallback2 && config.fallbackLayer === 2) ||
          (btn === btnFallback3 && config.fallbackLayer === 3) ||
          (btn === btnFallback4 && config.fallbackLayer === 4);
        btn.style.border = activeValue ? '4px solid #f0d722' : '4px solid #d2d2d2';
      });
    });

    btnReset.removeAttribute('onclick');
    btnReset.addEventListener('click', (e) => {
      if (e.shiftKey) {
        if (!routeActive) return;
        resetRouteKeepInputs();
      } else {
        window.send('removeScript');
      }
    });
  }

  // ------------------------------------------------------------
  // WebSocket connection for global hotkey control
  // (only on main page, and only if allowRemoteControl is true)
  // ------------------------------------------------------------
  if (!isRemote) {
    const ws = new WebSocket('ws://127.0.0.1:7002');
    ws.addEventListener('message', (event) => {
      if (!allowRemoteControl) return;   // toggle must be ON

      const cmd = event.data;
      switch (cmd) {
        case 'forward':
          // Only if Forward button is enabled (gong not active, not at terminus)
          if (btnForward && btnForward.style.pointerEvents === 'none') break;
          window.send('forward');
          break;

        case 'backward':
          if (btnBackward && btnBackward.style.pointerEvents === 'none') break;
          window.send('backward');
          break;

        case 'arrivalLeft':
          // Only if Arrival button is enabled (phase = normal, after gong)
          if (btnArrival && btnArrival.style.pointerEvents === 'none') break;
          currentVia = 'left';
          window.send('arrival');   // calls shortBeforeStop and broadcasts via
          break;

        case 'arrivalRight':
          if (btnArrival && btnArrival.style.pointerEvents === 'none') break;
          currentVia = 'right';
          window.send('arrival');
          break;

        case 'doorRelease':
          if (btnDoorRelease && btnDoorRelease.style.pointerEvents === 'none') break;
          window.send('doorRelease');
          break;

        case 'doorLock':
          if (btnDoorLock && btnDoorLock.style.pointerEvents === 'none') break;
          window.send('doorLock');
          break;

        case 'removeScript':
          window.send('removeScript');
          break;
      }
    });
  }

  // ---------- input validation ----------
  async function validateLine() {
    const val = inputLine.value.trim();
    if (!val) return;

    // Normalise to uppercase for file lookup (files are named like U5.json, ABC.json, M10.json)
    const upper = val.toUpperCase();
    inputLine.value = upper;

    // Try to fetch the line JSON – if it succeeds, the line is valid
    try {
      lineData = await loadLineJSON(upper);
      inputLine.style.setProperty('border', '4px solid #d2d2d2', 'important');
      inputLine.dataset.invalid = '';
      lineData.lineFile = lineData.filePath;
    } catch (e) {
      lineData = null;
      inputLine.style.setProperty('border', '4px solid #ec1c24', 'important');
      inputLine.dataset.invalid = 'true';
    }

    // Re‑validate stations now that we have the line data (if any)
    validateStation(inputStart, 'start');
    validateStation(inputEnd, 'end');
    updateConfirmButtonState();
  }

  function validateStation(input, type) {
    const val = input.value.trim();
    if (!val) {
      input.style.setProperty('border', '4px solid #d2d2d2', 'important');
      input.dataset.invalid = '';
      updateConfirmButtonState();
      return;
    }
    if (type === 'skip') {
      const raw = input.value.trim();
      const isInclude = raw.startsWith('!');
      let stationPart = raw;
      if (isInclude) {
        stationPart = raw.slice(1).trim();
      }
      const tokens = stationPart.split(/\s+/).filter(t => t);

      // Validate all tokens are real station abbreviations
      let allValid = true;
      const correctedTokens = tokens.map(t => {
        const correct = findStationAbbrev(t);
        if (!correct) allValid = false;
        return correct || t;
      });

      if (!allValid) {
        inputSkip.style.setProperty('border', '4px solid #ec1c24', 'important');
        inputSkip.dataset.invalid = 'true';
        updateConfirmButtonState();
        return;
      }

      // Reconstruct the input value with corrected abbreviations, preserving the prefix
      if (isInclude) {
        inputSkip.value = '! ' + correctedTokens.join(' ');
      } else {
        inputSkip.value = correctedTokens.join(' ');
      }

      // Valid – mark skip input valid
      inputSkip.style.setProperty('border', '4px solid #d2d2d2', 'important');
      inputSkip.dataset.invalid = '';
      updateConfirmButtonState();
      return;
    }

    // Read fresh values (one of them may have just been corrected)
    const startVal = inputStart.value.trim();
    const endVal = inputEnd.value.trim();
    const otherVal = (type === 'start') ? endVal : startVal;
    const otherInput = (type === 'start') ? inputEnd : inputStart;

    // Check existence and auto‑correct case for THIS field
    const exists = findStationAbbrev(val);
    if (!exists) {
      input.style.setProperty('border', '4px solid #ec1c24', 'important');
      input.dataset.invalid = 'true';
      updateConfirmButtonState();
      return;
    }
    input.value = exists;                       // correct case
    input.style.setProperty('border', '4px solid #d2d2d2', 'important');
    input.dataset.invalid = '';

    // Now also correct the OTHER field if it has a value
    if (otherVal && lineData) {
      const otherCorrect = findStationAbbrev(otherVal);
      if (otherCorrect) {
        otherInput.value = otherCorrect;    // correct case in other field
      }
    }

    // After both fields have proper case, evaluate the whole route
    const newStartVal = inputStart.value.trim();
    const newEndVal = inputEnd.value.trim();

    if (newStartVal && newEndVal && lineData) {
      // Check if start and destination are identical
      if (newStartVal.toLowerCase() === newEndVal.toLowerCase()) {
        inputStart.style.setProperty('border', '4px solid #ec1c24', 'important');
        inputStart.dataset.invalid = 'true';
        inputEnd.style.setProperty('border', '4px solid #ec1c24', 'important');
        inputEnd.dataset.invalid = 'true';
        updateConfirmButtonState();
        return;
      }

      const possible = isRoutePossible(lineData.stations, newStartVal, newEndVal);
      if (!possible) {
        inputStart.style.setProperty('border', '4px solid #ec1c24', 'important');
        inputStart.dataset.invalid = 'true';
        inputEnd.style.setProperty('border', '4px solid #ec1c24', 'important');
        inputEnd.dataset.invalid = 'true';
      } else {
        inputStart.style.setProperty('border', '4px solid #d2d2d2', 'important');
        inputStart.dataset.invalid = '';
        inputEnd.style.setProperty('border', '4px solid #d2d2d2', 'important');
        inputEnd.dataset.invalid = '';
      }
    }

    updateConfirmButtonState();
  }

  function findStationAbbrev(abbrev) {
    if (!lineData) return null;
    const stations = lineData.stations;
    const lower = abbrev.toLowerCase();
    const found = stations.find(s => s.abbrev.toLowerCase() === lower);
    return found ? found.abbrev : null;
  }

  if (!isRemote) {
    inputLine.addEventListener('blur', validateLine);
    inputStart.addEventListener('blur', () => validateStation(inputStart, 'start'));
    inputEnd.addEventListener('blur', () => validateStation(inputEnd, 'end'));
    inputSkip.addEventListener('blur', () => validateStation(inputSkip, 'skip'));
    inputLine.addEventListener('input', () => { inputLine.dataset.invalid = ''; inputLine.style.setProperty('border', '4px solid #ffffff', 'important'); updateConfirmButtonState(); });
    inputStart.addEventListener('input', () => { inputStart.dataset.invalid = ''; inputStart.style.setProperty('border', '4px solid #ffffff', 'important'); updateConfirmButtonState(); });
    inputEnd.addEventListener('input', () => { inputEnd.dataset.invalid = ''; inputEnd.style.setProperty('border', '4px solid #ffffff', 'important'); updateConfirmButtonState(); });
    inputSkip.addEventListener('input', () => { inputSkip.dataset.invalid = ''; inputSkip.style.setProperty('border', '4px solid #ffffff', 'important'); updateConfirmButtonState(); });


    const inputFields = [inputLine, inputStart, inputEnd, inputSkip];
    inputFields.forEach(inp => {
      inp.addEventListener('focus', () => {
        inp.dataset.invalid = '';
        inp.style.setProperty('background-color', '#252525', 'important');
        inp.style.setProperty('color', '#ffffff', 'important');
        inp.style.setProperty('border', '4px solid #ffffff', 'important');
      });
      inp.addEventListener('blur', () => {
        if (inp.dataset.invalid === 'true') {
          inp.style.setProperty('border', '4px solid #ec1c24', 'important');
        } else {
          inp.style.setProperty('border', '4px solid #d2d2d2', 'important');
        }
        inp.style.setProperty('background-color', '#ffffff', 'important');
        inp.style.setProperty('color', '#252525', 'important');
      });
      inp.addEventListener('mouseout', () => {
        // Override the inline onmouseout – re‑apply red border if invalid
        if (inp.dataset.invalid === 'true') {
          inp.style.setProperty('border', '4px solid #ec1c24', 'important');
        }
      });
    });
  }

  // ---------- route management ----------

  function getPossibleDirections(stations, startAbbrev, endAbbrev) {
    const startStation = stations.find(s => s.abbrev.toLowerCase() === startAbbrev.toLowerCase());
    const endStation = stations.find(s => s.abbrev.toLowerCase() === endAbbrev.toLowerCase());
    if (!startStation || !endStation) return [];
    const dirs = [1, 2];
    return dirs.filter(d =>
      (startStation.directionPresence === 'both' || String(startStation.directionPresence) === String(d)) &&
      (endStation.directionPresence === 'both' || String(endStation.directionPresence) === String(d))
    );
  }

  function isRoutePossible(stations, startAbbrev, endAbbrev) {
    const startStation = stations.find(s => s.abbrev.toLowerCase() === startAbbrev.toLowerCase());
    const endStation = stations.find(s => s.abbrev.toLowerCase() === endAbbrev.toLowerCase());
    if (!startStation || !endStation) return false;

    const possibleDirs = getPossibleDirections(stations, startAbbrev, endAbbrev);
    if (possibleDirs.length === 0) return false;

    // Use the same direction as confirmRoute: based on original index order
    const startIdx = stations.findIndex(s => s.abbrev === startAbbrev);
    const endIdx = stations.findIndex(s => s.abbrev === endAbbrev);
    const direction = startIdx < endIdx ? 1 : 2;

    // The index‑based direction must be among the possible directions
    if (!possibleDirs.includes(direction)) return false;

    // Finally, check that both stations survive the direction‑presence filter
    const filtered = stations.filter(s =>
      s.directionPresence === 'both' ||
      String(s.directionPresence) === String(direction)
    );
    return filtered.some(s => s.abbrev === startAbbrev) &&
      filtered.some(s => s.abbrev === endAbbrev);
  }

  function updateConfirmButtonState() {
    const lineOk = inputLine.dataset.invalid !== 'true' && inputLine.value.trim() !== '';
    const startOk = inputStart.dataset.invalid !== 'true' && inputStart.value.trim() !== '';
    const endOk = inputEnd.dataset.invalid !== 'true' && inputEnd.value.trim() !== '';
    const skipOk = inputSkip.dataset.invalid !== 'true';
    if (lineOk && startOk && endOk && skipOk) {
      enableBtn(btnConfirm);
    } else {
      disableBtn(btnConfirm);
    }
  }

  async function confirmRoute() {
    if (inputLine.style.borderColor === '#ec1c24' ||
      inputStart.style.borderColor === '#ec1c24' ||
      inputEnd.style.borderColor === '#ec1c24' ||
      inputSkip.style.borderColor === '#ec1c24') return;
    const line = inputLine.value.trim();
    const start = inputStart.value.trim();
    const end = inputEnd.value.trim();
    if (!line || !start || !end) return;

    try {
      lineData = await loadLineJSON(line);
    } catch (e) { return; }
    lineData.lineFile = lineData.filePath;

    // Determine direction based on original index order
    const startIdx = lineData.stations.findIndex(s => s.abbrev === start);
    const endIdx = lineData.stations.findIndex(s => s.abbrev === end);
    direction = startIdx < endIdx ? 1 : 2;

    // The chosen direction must be valid for both stations
    const possibleDirs = getPossibleDirections(lineData.stations, start, end);
    if (!possibleDirs.includes(direction)) return;

    // Filter stations by direction presence
    const dirPresenceFiltered = lineData.stations.filter(s => {
      return s.directionPresence === 'both' ||
        String(s.directionPresence) === String(direction);
    });
    if (dirPresenceFiltered.length === 0) return;

    // Build ordered list for the chosen direction
    const fullOrdered = direction === 1
      ? [...dirPresenceFiltered]
      : [...dirPresenceFiltered].reverse();

    const startPos = fullOrdered.findIndex(s => s.abbrev === start);
    const endPos = fullOrdered.findIndex(s => s.abbrev === end);
    if (startPos === -1 || endPos === -1) return;
    if (startPos === endPos) return;

    const segment = fullOrdered.slice(startPos, endPos + 1);

    const skipRaw = inputSkip.value.trim();
    const isInclude = skipRaw.startsWith('!');

    let stationFilter;
    if (isInclude) {
      const stationPart = skipRaw.slice(1).trim();
      const includeSet = new Set(stationPart ? stationPart.split(/\s+/) : []);
      routeStations = segment.filter(s => includeSet.has(s.abbrev));
    } else {
      const skippedSet = new Set(skipRaw ? skipRaw.split(/\s+/) : []);
      routeStations = segment.filter(s => !skippedSet.has(s.abbrev));
    }

    if (!routeStations.find(s => s.abbrev === start) ||
      !routeStations.find(s => s.abbrev === end)) return;

    currentRouteIndex = routeStations.findIndex(s => s.abbrev === start);
    if (currentRouteIndex === -1) currentRouteIndex = 0;

    phase = 'normal';
    routeActive = true;
    exitsTimedOut = false;
    clearAllTimers();
    computeRouteSegmentColors();
    updateUIForActiveRoute();
    updateAllDisplays();
  }

  function resetRoute() {
    routeActive = false;
    lineData = null;
    routeStations = [];
    currentRouteIndex = 0;
    phase = 'normal';
    exitsTimedOut = false;
    currentVia = null;
    window._segmentColors = null; window._arrowColor = null;
    hideLiveConnections();
    clearAllTimers();

    // Information display – always present
    infoFallbackLayer.style.visibility = 'visible';
    simpleContainer.style.visibility = 'visible';
    exitsContainer.style.visibility = 'hidden';
    $$('.information-display-line-simple-station-name').forEach(el => el.style.visibility = 'visible');
    $$('.information-display-line-simple-station-additional-name').forEach(el => el.style.visibility = 'visible');
    $$('.information-display-line-simple-station-connections-rows').forEach(el => el.style.visibility = '');
    $$('.information-display-line-extended-station', extendedContainer).forEach(el => el.remove());
    extendedArrow.style.visibility = 'hidden';
    extendedDestination.textContent = '';

    // Direction display – only if present (main page)
    if (dirFallback) dirFallback.style.visibility = 'visible';
    if (dirDestination) {
      dirDestination.style.visibility = 'hidden';
      dirDestination.style.display = 'none';
    }
    if (nextStationDisplay) {
      nextStationDisplay.style.visibility = 'hidden';
      nextStationDisplay.style.display = 'none';
    }
    if (exitLeftArrow) exitLeftArrow.style.visibility = 'hidden';
    if (exitRightArrow) exitRightArrow.style.visibility = 'hidden';
    if (doorLightbar) doorLightbar.style.visibility = 'hidden';

    // Line icon
    if (infoLineIcon) infoLineIcon.src = '';
    if (dirDestLineIcon) dirDestLineIcon.style.visibility = 'hidden';
    if (dirDestName) dirDestName.textContent = '';

    // Clear input fields (main page only)
    if (!isRemote) {
      inputLine.value = '';
      inputStart.value = '';
      inputEnd.value = '';
      inputSkip.value = '';
      resetAllButtons();
      updateConfirmButtonState();
    }
  }

  function resetRouteKeepInputs() {
    routeActive = false;
    lineData = null;
    routeStations = [];
    currentRouteIndex = 0;
    phase = 'normal';
    exitsTimedOut = false;
    currentVia = null;
    window._segmentColors = null; window._arrowColor = null;
    hideLiveConnections();
    clearAllTimers();

    // Information display – always present
    infoFallbackLayer.style.visibility = 'visible';
    simpleContainer.style.visibility = 'visible';
    exitsContainer.style.visibility = 'hidden';
    $$('.information-display-line-simple-station-name').forEach(el => el.style.visibility = 'visible');
    $$('.information-display-line-simple-station-additional-name').forEach(el => el.style.visibility = 'visible');
    $$('.information-display-line-simple-station-connections-rows').forEach(el => el.style.visibility = '');
    $$('.information-display-line-extended-station', extendedContainer).forEach(el => el.remove());
    extendedArrow.style.visibility = 'hidden';
    extendedDestination.textContent = '';

    // Direction display – only if present (main page)
    if (dirFallback) dirFallback.style.visibility = 'visible';
    if (dirDestination) {
      dirDestination.style.visibility = 'hidden';
      dirDestination.style.display = 'none';
    }
    if (nextStationDisplay) {
      nextStationDisplay.style.visibility = 'hidden';
      nextStationDisplay.style.display = 'none';
    }
    if (exitLeftArrow) exitLeftArrow.style.visibility = 'hidden';
    if (exitRightArrow) exitRightArrow.style.visibility = 'hidden';
    if (doorLightbar) doorLightbar.style.visibility = 'hidden';

    // Line icon
    if (infoLineIcon) infoLineIcon.src = '';
    if (dirDestLineIcon) dirDestLineIcon.style.visibility = 'hidden';
    if (dirDestName) dirDestName.textContent = '';

    // Clear input fields (main page only)
    if (!isRemote) {
      resetAllButtons();
      updateConfirmButtonState();
      if (inputLine.value.trim() !== '') {
        validateLine();          // reloads line data and re‑checks everything
      } else {
        // Line is empty – just clear start/end/skip reds
        inputStart.style.setProperty('border', '4px solid #d2d2d2', 'important');
        inputStart.dataset.invalid = '';
        inputEnd.style.setProperty('border', '4px solid #d2d2d2', 'important');
        inputEnd.dataset.invalid = '';
        validateStation(inputSkip, 'skip');
      }
    }

    if (!isRemote && window.broadcastChannel) {
      window.broadcastChannel.postMessage({ type: 'removeScript' });
    }
  }

  function resetAllButtons() {
    enableBtn(inputLine); enableBtn(inputStart); enableBtn(inputEnd); enableBtn(inputSkip);
    disableBtn(btnConfirm);
    disableBtn(btnReset);
    disableBtn(btnForward); disableBtn(btnBackward);
    disableBtn(btnArrival); disableBtn(btnDoorRelease); disableBtn(btnDoorLock);
  }

  function updateUIForActiveRoute() {
    infoFallbackLayer.style.visibility = 'hidden';
    if (dirFallback) dirFallback.style.visibility = 'hidden';

    infoLineIcon.style.left = '';
    infoLineIcon.style.top = '';
    infoLineIcon.style.height = '';
    extendedArrow.style.left = '';
    extendedDestination.style.left = '';

    const alt = alternativeType();

    // ---- Information display ----
    if (alt) {
      // ---- Icon ----
      if (alt === 'suburban') {
        infoLineIcon.src = `visuals/service_icons/suburban_lines/${lineData.line}.svg`;
        infoLineIcon.style.left = '6px';
        infoLineIcon.style.top = '506px';
        infoLineIcon.style.height = '64px';
      } else {
        infoLineIcon.src = `visuals/service_icons/${alt}.svg`;
        if (alt === 'bus' || alt === 'ferry') {
          infoLineIcon.style.left = '6px';
          infoLineIcon.style.top = '506px';
          infoLineIcon.style.height = '64px';
        }
      }

      // Show/hide line‑number text
      const lineNumEl = document.querySelector('.information-display-line-extended-line-number');
      if (lineNumEl) {
        if (alt === 'suburban') {
          lineNumEl.textContent = '';
          lineNumEl.style.visibility = 'hidden';
        } else {
          lineNumEl.textContent = lineData.line;
          lineNumEl.style.visibility = 'visible';
        }
      }

      // Arrow/destination offsets
      const ARROW_OFFSET_SUBURBAN = 0;   // adjust as needed
      const ARROW_OFFSET_GENERIC = 86;
      const arrowLeft = parseFloat(getComputedStyle(extendedArrow).left) || 0;
      const destLeft = parseFloat(getComputedStyle(extendedDestination).left) || 0;
      if (alt === 'suburban') {
        extendedArrow.style.left = (arrowLeft + ARROW_OFFSET_SUBURBAN) + 'px';
        extendedDestination.style.left = (destLeft + ARROW_OFFSET_SUBURBAN) + 'px';
      } else {
        extendedArrow.style.left = (arrowLeft + ARROW_OFFSET_GENERIC) + 'px';
        extendedDestination.style.left = (destLeft + ARROW_OFFSET_GENERIC) + 'px';
      }

      // ---- Direction display ----
      if (alt === 'suburban') {
        // Show direction display with suburban icon
        if (dirDestination) {
          dirDestination.style.display = 'block';
          dirDestination.style.visibility = 'visible';
        }
        if (dirFallback) dirFallback.style.visibility = 'hidden';
        if (nextStationDisplay) {
          nextStationDisplay.style.display = 'none';
          nextStationDisplay.style.visibility = 'hidden';
        }
        // Suburban icon visible, subway icon hidden
        if (dirDestLineIconSuburban) {
          dirDestLineIconSuburban.src = `visuals/service_icons/suburban_lines/${lineData.line}.svg`;
          dirDestLineIconSuburban.style.visibility = 'visible';
        }
        if (dirDestLineIcon) dirDestLineIcon.style.visibility = 'hidden';
        if (dirDestName) {
          dirDestName.textContent = routeStations[routeStations.length - 1].name;
          fitDestinationText();
        }
        setExitArrows(false, false);
      } else {
        // Bus, tram, ferry – hide direction display
        if (dirDestination) dirDestination.style.display = 'none';
        if (dirFallback) dirFallback.style.visibility = 'visible';
        if (nextStationDisplay) {
          nextStationDisplay.style.display = 'none';
          nextStationDisplay.style.visibility = 'hidden';
        }
        setExitArrows(false, false);
      }
    } else {
      // Normal subway line
      infoLineIcon.src = `visuals/service_icons/subway_lines/${lineData.line}.svg`;
      // Hide line number element
      const lineNumEl = document.querySelector('.information-display-line-extended-line-number');
      if (lineNumEl) { lineNumEl.textContent = ''; lineNumEl.style.visibility = 'hidden'; }
      // Reset extended arrow/destination positions (assuming original left is 0 or not set)
      extendedArrow.style.left = '';
      extendedDestination.style.left = '';
      // Restore direction display (only on main page)
      if (!isRemote) {
        setDirDisplay('visibility', 'visible');
        setDirDisplay('display', 'block');
        setNextStationDisplay('visibility', 'hidden');
        setNextStationDisplay('display', 'none');
        if (dirDestLineIcon) {
          dirDestLineIcon.src = `visuals/service_icons/subway_lines/${lineData.line}.svg`;
          dirDestLineIcon.style.visibility = 'visible';
        }
        if (dirDestLineIconSuburban) dirDestLineIconSuburban.style.visibility = 'hidden';
        if (dirDestName) dirDestName.textContent = routeStations[routeStations.length - 1].name;
        fitDestinationText();
      }
    }

    extendedArrow.style.visibility = 'visible';
    extendedDestination.textContent = routeStations[routeStations.length - 1].name;

    // Buttons – only on main page
    if (!isRemote) {
      disableBtn(inputLine); disableBtn(inputStart); disableBtn(inputEnd); disableBtn(inputSkip);
      disableBtn(btnConfirm);
      enableBtn(btnReset);
      enableBtn(btnForward);
      enableBtn(btnBackward);
      disableBtn(btnArrival);
      disableBtn(btnDoorRelease);
      disableBtn(btnDoorLock);
      updateNavButtons();
      updatePositionButtonsLayout();
    }

    overlayImages.forEach(img => { img.src = currentOverlaySrc(); });
  }

  function updateNavButtons() {
    if (currentRouteIndex === 0) disableBtn(btnBackward); else enableBtn(btnBackward);
    if (currentRouteIndex === routeStations.length - 1) disableBtn(btnForward); else enableBtn(btnForward);
  }

  // ---------- movement & phases ----------
  function moveForward() {
    if (!routeActive) return;

    // Remote mode: always advance immediately
    if (isRemote) {
      if (currentRouteIndex >= routeStations.length - 1) return;
      currentRouteIndex++;
      currentVia = null;
      hideLiveConnections();
      clearAllTimers();               // also cancels auto‑close timer
      phase = 'normal';
      // Immediately hide exits and show simple line overview
      simpleContainer.style.visibility = 'visible';
      $$('.information-display-line-simple-station-name').forEach(el => el.style.visibility = 'visible');
      $$('.information-display-line-simple-station-additional-name').forEach(el => el.style.visibility = 'visible');
      $$('.information-display-line-simple-station-connections-rows').forEach(el => el.style.visibility = '');
      exitsContainer.style.visibility = 'hidden';
      computeRouteSegmentColors();
      updateAllDisplays();
      return;
    }

    // Main page logic
    if (phase === 'closing') {
      stopBlinkingAndNormalise();
      moveForward();
      return;
    }

    if (phase !== 'normal') return;
    if (currentRouteIndex >= routeStations.length - 1) return;

    currentRouteIndex++;
    exitsTimedOut = false;
    currentVia = null;               // <-- add this line
    hideLiveConnections();
    clearAllTimers();
    phase = 'normal';
    // … rest unchanged …

    nextStationDisplay.style.setProperty('display', 'none', 'important');
    nextStationDisplay.style.setProperty('visibility', 'hidden', 'important');
    dirDestination.style.setProperty('display', 'block', 'important');
    dirDestination.style.setProperty('visibility', 'visible', 'important');
    exitLeftArrow.style.visibility = 'hidden';
    exitRightArrow.style.visibility = 'hidden';
    exitSideContainer.style.display = 'none';

    computeRouteSegmentColors();
    updateAllDisplays();

    gongTimer = setTimeout(() => {
      showNextStationOnDirectionDisplay();
      startLiveConnectionsTimer();
      playSound(gongStandard);
      enableBtn(btnArrival);
      disableBtn(btnForward);
      disableBtn(btnBackward);
    }, 5000);

    enableBtn(btnForward);
    enableBtn(btnBackward);
    disableBtn(btnArrival);
    disableBtn(btnDoorRelease);
    disableBtn(btnDoorLock);
    updateNavButtons();
  }

  function moveForwardNoTimer() {
    if (!routeActive) return;

    // Main page logic (same as moveForward but no timer)
    if (phase === 'closing') {
      stopBlinkingAndNormalise();
      moveForwardNoTimer();
      return;
    }

    if (phase !== 'normal') return;
    if (currentRouteIndex >= routeStations.length - 1) return;

    currentRouteIndex++;
    exitsTimedOut = false;
    currentVia = null;
    hideLiveConnections();
    clearAllTimers();
    phase = 'normal';

    nextStationDisplay.style.setProperty('display', 'none', 'important');
    nextStationDisplay.style.setProperty('visibility', 'hidden', 'important');
    dirDestination.style.setProperty('display', 'block', 'important');
    dirDestination.style.setProperty('visibility', 'visible', 'important');
    exitLeftArrow.style.visibility = 'hidden';
    exitRightArrow.style.visibility = 'hidden';
    exitSideContainer.style.display = 'none';

    computeRouteSegmentColors();
    updateAllDisplays();

    enableBtn(btnForward);
    enableBtn(btnBackward);
    disableBtn(btnArrival);
    disableBtn(btnDoorRelease);
    disableBtn(btnDoorLock);
    updateNavButtons();
  }

  function moveBackward() {
    if (!routeActive) return;

    // Remote mode: always retreat immediately
    if (isRemote) {
      if (currentRouteIndex <= 0) return;
      currentRouteIndex--;
      currentVia = null;
      hideLiveConnections();
      clearAllTimers();
      phase = 'normal';
      // Immediately hide exits and show simple line overview
      simpleContainer.style.visibility = 'visible';
      $$('.information-display-line-simple-station-name').forEach(el => el.style.visibility = 'visible');
      $$('.information-display-line-simple-station-additional-name').forEach(el => el.style.visibility = 'visible');
      $$('.information-display-line-simple-station-connections-rows').forEach(el => el.style.visibility = '');
      exitsContainer.style.visibility = 'hidden';
      computeRouteSegmentColors();
      updateAllDisplays();
      return;
    }

    // Main page logic
    if (phase === 'closing') {
      stopBlinkingAndNormalise();
      moveBackward();
      return;
    }

    if (phase !== 'normal') return;
    if (currentRouteIndex <= 0) return;

    currentRouteIndex--;
    exitsTimedOut = false;
    currentVia = null;
    hideLiveConnections();
    clearAllTimers();
    phase = 'normal';

    nextStationDisplay.style.display = 'none';
    nextStationDisplay.style.visibility = 'hidden';
    dirDestination.style.display = 'block';
    dirDestination.style.visibility = 'visible';
    exitLeftArrow.style.visibility = 'hidden';
    exitRightArrow.style.visibility = 'hidden';
    exitSideContainer.style.display = 'none';

    computeRouteSegmentColors();
    updateAllDisplays();

    enableBtn(btnForward);
    enableBtn(btnBackward);
    disableBtn(btnArrival);
    disableBtn(btnDoorRelease);
    disableBtn(btnDoorLock);
    updateNavButtons();
  }

  function adjustStationNameScale(element) {
    element.style.marginLeft = '';
    element.style.marginRight = '';
    const naturalWidth = element.scrollWidth;
    element.style.transform = 'scaleX(0.95)';
    const visualWidth = naturalWidth * 0.95;
    const marginCompensation = (naturalWidth - visualWidth) / 2;
    element.style.marginLeft = `-${marginCompensation}px`;
    element.style.marginRight = `-${marginCompensation}px`;
  }

  function shortBeforeStop() {
    if (!routeActive || phase !== 'normal') return;
    if (gongTimer) { clearTimeout(gongTimer); gongTimer = null; }
    if (doorBlinkInterval) { clearInterval(doorBlinkInterval); doorBlinkInterval = null; }
    if (blinkStopTimer) { clearTimeout(blinkStopTimer); blinkStopTimer = null; }
    if (forwardPendingTimer) { clearTimeout(forwardPendingTimer); forwardPendingTimer = null; }
    if (doorAutoCloseTimer) { clearTimeout(doorAutoCloseTimer); doorAutoCloseTimer = null; }
    phase = 'arrival';
    exitsTimedOut = false;

    const cur = routeStations[currentRouteIndex];
    const exitSide = cur.exitSide[`direction${direction}`];
    const isTerminus = currentRouteIndex === routeStations.length - 1;

    let via;
    if (currentVia) {
      via = currentVia;                // remote command (or any preset)
    } else {
      via = isTerminus && exitSide?.terminus ? exitSide.terminus :
        exitSide?.via || '';
      if (via === 'random') {
        via = Math.random() < 0.5 ? 'left' : 'right';
      }
    }
    currentVia = via;

    // Exit‑side arrows (only on main page)
    if (exitSideContainer) {
      exitSideContainer.style.setProperty('display', 'block', 'important');
    }
    setExitArrows(via === 'left' || via === 'both', via === 'right' || via === 'both');

    // Destination display (only on main page)
    if (dirDestination) {
      dirDestination.style.setProperty('display', 'none', 'important');
      dirDestination.style.setProperty('visibility', 'hidden', 'important');
    }

    if (isTerminus && !isRemote) playSound(gongEnd);

    const showExitsOverview = shouldShowExits(via);
    if (showExitsOverview) {
      simpleContainer.style.visibility = 'hidden';
      $$('.information-display-line-simple-station-name').forEach(el => el.style.visibility = 'hidden');
      $$('.information-display-line-simple-station-additional-name').forEach(el => el.style.visibility = 'hidden');
      $$('.information-display-line-simple-station-connections-rows').forEach(el => el.style.visibility = 'hidden');
      exitsContainer.style.visibility = 'visible';
      populateExitsConnections();
    } else {
      simpleContainer.style.visibility = 'visible';
      $$('.information-display-line-simple-station-name').forEach(el => el.style.visibility = 'visible');
      $$('.information-display-line-simple-station-additional-name').forEach(el => el.style.visibility = 'visible');
      $$('.information-display-line-simple-station-connections-rows').forEach(el => el.style.visibility = '');
      exitsContainer.style.visibility = 'hidden';
    }

    if (!isRemote) {
      enableBtn(btnDoorRelease);
      disableBtn(btnArrival);
      disableBtn(btnForward);
      disableBtn(btnBackward);
      disableBtn(btnDoorLock);
    }
  }

  function doorRelease() {
    if (phase !== 'arrival') return;
    phase = 'doorReleased';
    if (doorLightbar) {
      doorLightbar.style.backgroundColor = '#58ff58';
      doorLightbar.style.visibility = 'visible';
      doorLightbar.style.opacity = '1';
    }
    // Always start the auto‑close timer (works on remote too)
    if (doorAutoCloseTimer) clearTimeout(doorAutoCloseTimer);
    doorAutoCloseTimer = setTimeout(autoCloseExits, 10000);

    if (!isRemote) {
      enableBtn(btnDoorLock);
      disableBtn(btnDoorRelease);
    }
  }

  function autoCloseExits() {
    if (doorAutoCloseTimer) { clearTimeout(doorAutoCloseTimer); doorAutoCloseTimer = null; }
    if (phase !== 'doorReleased' && phase !== 'closing') return;

    exitsTimedOut = true;     // prevent re‑appearance

    simpleContainer.style.visibility = 'visible';
    $$('.information-display-line-simple-station-name').forEach(el => el.style.visibility = 'visible');
    $$('.information-display-line-simple-station-additional-name').forEach(el => el.style.visibility = 'visible');
    $$('.information-display-line-simple-station-connections-rows').forEach(el => el.style.visibility = '');
    exitsContainer.style.visibility = 'hidden';

    nextStationDisplay.style.setProperty('display', 'none', 'important');
    nextStationDisplay.style.setProperty('visibility', 'hidden', 'important');
    dirDestination.style.setProperty('display', 'block', 'important');
    dirDestination.style.setProperty('visibility', 'visible', 'important');
    nextStationPage1.style.setProperty('display', 'none', 'important');
    nextStationPage1.style.setProperty('visibility', 'hidden', 'important');
    nextStationPage2.style.setProperty('display', 'none', 'important');
    nextStationPage2.style.setProperty('visibility', 'hidden', 'important');
    exitSideContainer.style.setProperty('display', 'none', 'important');
    exitLeftArrow.style.visibility = 'hidden';
    exitRightArrow.style.visibility = 'hidden';

    hideLiveConnections();
  }

  function doorLock() {
    if (phase !== 'doorReleased') return;
    phase = 'closing';
    if (!isRemote) {
      if (gongTimer) { clearTimeout(gongTimer); gongTimer = null; }
      if (doorBlinkInterval) { clearInterval(doorBlinkInterval); doorBlinkInterval = null; }
      if (blinkStopTimer) { clearTimeout(blinkStopTimer); blinkStopTimer = null; }
      if (forwardPendingTimer) { clearTimeout(forwardPendingTimer); forwardPendingTimer = null; }

      if (doorLightbar) {
        doorLightbar.style.backgroundColor = '#ff5858';
        doorLightbar.style.visibility = 'visible';
      }
      let blink = true;
      doorBlinkInterval = setInterval(() => {
        if (doorLightbar) doorLightbar.style.visibility = blink ? 'hidden' : 'visible';
        blink = !blink;
      }, 400);
      playSound(doorSound);
      blinkStopTimer = setTimeout(() => {
        if (doorBlinkInterval) { clearInterval(doorBlinkInterval); doorBlinkInterval = null; }
        if (doorLightbar) doorLightbar.style.visibility = 'hidden';
      }, 30000);

      enableBtn(btnForward);
      enableBtn(btnBackward);
      disableBtn(btnArrival);
      disableBtn(btnDoorRelease);
      disableBtn(btnDoorLock);
      updateNavButtons();
    }
  }

  function stopBlinkingAndNormalise() {
    if (doorBlinkInterval) { clearInterval(doorBlinkInterval); doorBlinkInterval = null; }
    if (blinkStopTimer) { clearTimeout(blinkStopTimer); blinkStopTimer = null; }
    if (forwardPendingTimer) { clearTimeout(forwardPendingTimer); forwardPendingTimer = null; }
    doorLightbar.style.visibility = 'hidden';
    phase = 'normal';

    simpleContainer.style.visibility = 'visible';
    $$('.information-display-line-simple-station-name').forEach(el => el.style.visibility = 'visible');
    $$('.information-display-line-simple-station-additional-name').forEach(el => el.style.visibility = 'visible');
    $$('.information-display-line-simple-station-connections-rows').forEach(el => el.style.visibility = '');
    exitsContainer.style.visibility = 'hidden';

    nextStationDisplay.style.setProperty('display', 'none', 'important');
    nextStationDisplay.style.setProperty('visibility', 'hidden', 'important');
    dirDestination.style.setProperty('display', 'block', 'important');
    dirDestination.style.setProperty('visibility', 'visible', 'important');
    nextStationPage1.style.setProperty('display', 'none', 'important');
    nextStationPage1.style.setProperty('visibility', 'hidden', 'important');
    nextStationPage2.style.setProperty('display', 'none', 'important');
    nextStationPage2.style.setProperty('visibility', 'hidden', 'important');
    exitSideContainer.style.setProperty('display', 'none', 'important');
    exitLeftArrow.style.visibility = 'hidden';
    exitRightArrow.style.visibility = 'hidden';

    enableBtn(btnForward);
    enableBtn(btnBackward);
    disableBtn(btnArrival);
    disableBtn(btnDoorRelease);
    disableBtn(btnDoorLock);
    updateAllDisplays();
    updateNavButtons();
  }

  // ---------- direction display ----------
  function showNextStationOnDirectionDisplay() {
    if (alternativeType() && alternativeType() !== 'suburban') return;
    if (!routeActive) return;
    const station = routeStations[currentRouteIndex];

    const lineSimple = station.connectingServices.lineSimple;
    const allServices = [...(lineSimple[0] || []), ...(lineSimple[1] || [])];
    const figureHTML = '<div style="width:154px; height:176px; display:flex; justify-content:center; align-items:center;"><img src="visuals/interface/connections_figure.svg" style="width:99px; flex-shrink:0;"></div>';
    const iconsHTML = allServices.map(s => serviceIconHTML(s, 'direction')).join('');

    const nameWidth = measureTextWidth(station.name, 160) * 0.95;
    const iconTotalWidth = allServices.reduce((sum, s) => sum + (s.startsWith('U') ? 260 : 155), 0) + (allServices.length > 0 ? 154 : 0);
    const totalWidth = nameWidth + iconTotalWidth + 40;

    if (pageLoopTimer) { clearInterval(pageLoopTimer); pageLoopTimer = null; }

    // Helper to measure the actual rendered width of an icon block
    const measureBlockWidth = (services) => {
      const html = `<div class="direction-display-next-station-connections">${figureHTML}${services.map(s => serviceIconHTML(s, 'direction')).join('')}</div>`;
      const tmp = document.createElement('div');
      tmp.style.position = 'absolute';
      tmp.style.visibility = 'hidden';
      tmp.style.display = 'flex';        // match the real container
      tmp.innerHTML = html;
      document.body.appendChild(tmp);
      const w = tmp.scrollWidth;
      document.body.removeChild(tmp);
      return w;
    };

    if (totalWidth > 1600 && allServices.length > 0) {
      // ----- Multi‑page layout (2 or 3 virtual pages) -----

      // Build station‑name page (always page 1)
      const page1HTML = `<div class="direction-display-next-station-name">${station.name}</div>`;
      nextStationPage1.innerHTML = page1HTML;

      // Fit the name if needed
      const page1Name = nextStationPage1.querySelector('.direction-display-next-station-name');
      if (page1Name) {
        nextStationPage1.style.setProperty('display', 'flex', 'important');
        nextStationPage1.style.setProperty('visibility', 'visible', 'important');
        fitNameToPage(page1Name, nextStationPage1, 160);
      }

      // Decide whether 2 or 3 pages are needed
      const fullWidth = measureBlockWidth(allServices);
      const MAX_WIDTH = 1600;   // container limit

      if (fullWidth <= MAX_WIDTH) {
        // ---- 2 pages: name + all icons ----
        const page2HTML = `<div class="direction-display-next-station-connections">${figureHTML}${iconsHTML}</div>`;
        nextStationPage2.innerHTML = page2HTML;
        nextStationPage2.style.setProperty('display', 'none', 'important');
        nextStationPage2.style.setProperty('visibility', 'hidden', 'important');

        let showPage1 = true;
        pageLoopTimer = setInterval(() => {
          showPage1 = !showPage1;
          nextStationPage1.style.setProperty('display', showPage1 ? 'flex' : 'none', 'important');
          nextStationPage1.style.setProperty('visibility', showPage1 ? 'visible' : 'hidden', 'important');
          nextStationPage2.style.setProperty('display', showPage1 ? 'none' : 'flex', 'important');
          nextStationPage2.style.setProperty('visibility', showPage1 ? 'hidden' : 'visible', 'important');
        }, 10000);

      } else {
        // ---- 3 pages: name, icons part 1, icons part 2 ----
        const group1 = [];
        const group2 = [];
        let accumulated = [];
        let splitDone = false;

        for (const s of allServices) {
          if (splitDone) {
            group2.push(s);
            continue;
          }
          accumulated.push(s);
          const w = measureBlockWidth(accumulated);
          if (w > MAX_WIDTH) {
            // Last icon caused overflow → move it to group2
            accumulated.pop();
            group1.push(...accumulated);
            group2.push(s);
            splitDone = true;
          }
        }
        // If split never happened (all icons fit, which shouldn't happen here),
        // put everything in group1 as a safety fallback.
        if (!splitDone) {
          group1.push(...allServices);
        }

        const buildIconPage = (services) =>
          `<div class="direction-display-next-station-connections">${figureHTML}${services.map(s => serviceIconHTML(s, 'direction')).join('')}</div>`;

        const page2HTML = buildIconPage(group1);
        const page3HTML = buildIconPage(group2);

        nextStationPage2.innerHTML = page2HTML;   // preload first icon group
        nextStationPage2.style.setProperty('display', 'none', 'important');
        nextStationPage2.style.setProperty('visibility', 'hidden', 'important');

        let currentPage = 1;   // 1 = name, 2 = icons group 1, 3 = icons group 2
        pageLoopTimer = setInterval(() => {
          currentPage = currentPage === 1 ? 2 : (currentPage === 2 ? 3 : 1);
          if (currentPage === 1) {
            nextStationPage1.style.setProperty('display', 'flex', 'important');
            nextStationPage1.style.setProperty('visibility', 'visible', 'important');
            nextStationPage2.style.setProperty('display', 'none', 'important');
            nextStationPage2.style.setProperty('visibility', 'hidden', 'important');
          } else if (currentPage === 2) {
            nextStationPage2.innerHTML = page2HTML;
            nextStationPage1.style.setProperty('display', 'none', 'important');
            nextStationPage1.style.setProperty('visibility', 'hidden', 'important');
            nextStationPage2.style.setProperty('display', 'flex', 'important');
            nextStationPage2.style.setProperty('visibility', 'visible', 'important');
          } else {
            nextStationPage2.innerHTML = page3HTML;
            nextStationPage1.style.setProperty('display', 'none', 'important');
            nextStationPage1.style.setProperty('visibility', 'hidden', 'important');
            nextStationPage2.style.setProperty('display', 'flex', 'important');
            nextStationPage2.style.setProperty('visibility', 'visible', 'important');
          }
        }, 10000);
      }

    } else {
      // ----- Single‑page layout (unchanged) -----
      if (allServices.length > 0) {
        nextStationPage1.innerHTML = `<div class="direction-display-next-station-name">${station.name}</div><div class="direction-display-next-station-connections">${figureHTML}${iconsHTML}</div>`;
        nextStationPage1.style.gap = '';
      } else {
        nextStationPage1.innerHTML = `<div class="direction-display-next-station-name">${station.name}</div>`;
        nextStationPage1.style.gap = '0';
      }
      nextStationPage2.innerHTML = '';

      nextStationPage1.style.setProperty('display', 'flex', 'important');
      nextStationPage1.style.setProperty('visibility', 'visible', 'important');
      nextStationPage2.style.setProperty('display', 'none', 'important');
      nextStationPage2.style.setProperty('visibility', 'hidden', 'important');

      if (allServices.length === 0) {
        const soloName = nextStationPage1.querySelector('.direction-display-next-station-name');
        if (soloName) {
          fitNameToPage(soloName, nextStationPage1, 160);
        }
      }
    }

    // Final display toggles (unchanged)
    nextStationDisplay.style.setProperty('display', 'flex', 'important');
    nextStationDisplay.style.setProperty('visibility', 'visible', 'important');
    dirDestination.style.setProperty('display', 'none', 'important');
    dirDestination.style.setProperty('visibility', 'hidden', 'important');
    exitSideContainer.style.setProperty('display', 'none', 'important');
    exitLeftArrow.style.visibility = 'hidden';
    exitRightArrow.style.visibility = 'hidden';
  }

  function fitTextToContainer(el, maxFontSize) {
    if (!el) return;
    let fontSize = maxFontSize;
    el.style.fontSize = fontSize + 'px';
    while (el.scrollWidth > el.clientWidth && fontSize > 30) {
      fontSize -= 2;
      el.style.fontSize = fontSize + 'px';
    }
  }

  function fitDestinationText() {
    fitTextToContainer(dirDestName, 160);
  }

  function getPrimaryColorForDisplay() {
    return Array.isArray(lineData.color) ? lineData.color[0] : lineData.color;
  }

  function getSecondaryColorForDisplay() {
    if (config.combinedLineDesign === 'realistic' && Array.isArray(lineData.color) && lineData.color.length >= 2) {
      return lineData.color[1];
    }
    return null;
  }

  // ---------- simple line overview ----------
  function updateSimpleLineOverview() {
    const stationDivs = $$('.information-display-line-simple-station');
    const remaining = routeStations.slice(currentRouteIndex, currentRouteIndex + 3);

    stationDivs.forEach((div, i) => {
      const station = remaining[i];
      const nameEl = $('.information-display-line-simple-station-name', div);
      const addNameEl = $('.information-display-line-simple-station-additional-name', div);
      const connContainer = $('.information-display-line-simple-station-connections', div);
      const rows = $$('.information-display-line-simple-station-connections-rows', connContainer);

      if (station) {
        const isTerminus = station === routeStations[routeStations.length - 1];
        div.classList.toggle('information-display-line-simple-station-last', isTerminus);

        div.style.visibility = 'visible';
        nameEl.textContent = station.name;
        nameEl.style.visibility = 'visible';
        addNameEl.textContent = station.additionalName || '';
        addNameEl.style.visibility = 'visible';

        if (station.additionalName) {
          if (i === 0) nameEl.style.top = '51px';
          else if (i === 1) nameEl.style.top = '225px';
          else nameEl.style.top = '329px';
        } else {
          if (i === 0) nameEl.style.top = '93px';
          else if (i === 1) nameEl.style.top = '250px';
          else nameEl.style.top = '354px';
        }

        const lineSimple = station.connectingServices.lineSimple;
        rows.forEach((row, idx) => {
          if (lineSimple[idx] && lineSimple[idx].length > 0) {
            row.style.display = 'flex';
            row.style.visibility = 'visible';
            row.innerHTML = lineSimple[idx].map(s => serviceIconHTML(s, 'simple')).join('');
          } else {
            row.style.display = 'none';
            row.innerHTML = '';
          }
        });
      } else {
        div.classList.remove('information-display-line-simple-station-last');
        div.style.visibility = 'hidden';
        nameEl.textContent = '';
        nameEl.style.visibility = 'hidden';
        addNameEl.textContent = '';
        addNameEl.style.visibility = 'hidden';
        rows.forEach(row => {
          row.innerHTML = '';
          row.style.display = 'none';
          row.style.visibility = 'hidden';
        });
      }
    });

    const stationsLeft = routeStations.length - currentRouteIndex;
    let frame;
    if (stationsLeft > 3) frame = 'beyond';
    else if (stationsLeft === 3) frame = '3';
    else if (stationsLeft === 2) frame = '2';
    else frame = '1';
    loadSimpleSVG(frame);
  }

  function loadSimpleSVG(frame) {
    const url = `visuals/interface/information_display/line_simple/${frame}.svg?t=${Date.now()}`;
    const primary = getPrimaryColorForDisplay();
    const secondary = getSecondaryColorForDisplay();
    const segColors = getSimpleLineSegmentColors(currentRouteIndex);
    loadSVGIntoShadow('line-simple', url, primary, segColors, secondary);
  }

  // ---------- extended line overview ----------
  function updateExtendedLineOverview() {
    if (!routeActive || routeStations.length === 0) return;
    const total = routeStations.length;
    const currentIdx = currentRouteIndex;

    $$('.information-display-line-extended-station', extendedContainer).forEach(el => el.remove());

    if (total <= 18) {
      renderStandardExtended(currentIdx, total);
    } else {
      renderBeyondExtended(currentIdx, total);
    }
  }

  function isR2L() {
    return (config.displaySide === 1) ? (direction === 2) : (direction === 1);
  }

  function alternativeType() {
    // returns 'tram' | 'bus' | 'ferry' | null
    if (!lineData || !lineData.alternative) return null;
    return lineData.alternative;
  }

  function updatePositionButtonsLayout() {
    if (isRemote) return;
    const vorneBtn = btnPosH;
    const hintenBtn = btnPosV;
    const origLeftVorne = '172px';
    const origLeftHinten = '452px';
    if (!isR2L()) {
      // L2R: front is on the right → swap button positions
      vorneBtn.style.left = origLeftHinten;
      hintenBtn.style.left = origLeftVorne;
    } else {
      // R2L: front is on the left → original positions
      vorneBtn.style.left = origLeftVorne;
      hintenBtn.style.left = origLeftHinten;
    }
  }

  function renderStandardExtended(currentIdx, total) {
    let positions;
    if (stationPositions && stationPositions[total.toString()]) {
      positions = stationPositions[total.toString()];
    } else {
      const leftMost = 144, rightMost = 1636;
      positions = [];
      for (let i = 0; i < total; i++) {
        positions.push(leftMost + (rightMost - leftMost) * i / (total - 1));
      }
    }

    const dirFolder = isR2L() ? 'R2L' : 'L2R';
    extendedFrameFile = `${total}/${dirFolder}/${currentIdx + 1}.svg`;

    routeStations.forEach((station, i) => {
      const posIndex = isR2L() ? (total - 1 - i) : i;
      const div = buildExtendedStationElement(station, i, currentIdx, positions[posIndex]);
      extendedContainer.appendChild(div);
    });
    const routeIdxs = Array.from({ length: total }, (_, i) => i);
    const segColors = getExtendedSegmentColors(routeIdxs, currentIdx + 1);
    loadExtendedSVG(extendedFrameFile, segColors);
  }

  function renderBeyondExtended(currentIdx, total) {
    const leftPositions = stationPositions.beyond.left;
    const middlePositions = stationPositions.beyond.middle;
    const rightPositions = stationPositions.beyond.right;
    const remaining = total - currentIdx;

    let positions, frameFile, visibleStations, targetSlot;
    const r2l = isR2L();

    if (!r2l) {
      if (currentIdx < 4) {
        positions = leftPositions;
        frameFile = `beyond/L2R/${currentIdx + 1}.svg`;
        targetSlot = currentIdx;
      } else if (remaining <= 15) {
        positions = rightPositions;
        frameFile = `beyond/L2R/${remaining}left.svg`;
        targetSlot = 18 - remaining;
      } else {
        positions = middlePositions;
        frameFile = 'beyond/L2R/midpoint.svg';
        targetSlot = 3;
      }

      const startSt = routeStations[0];
      const endSt = routeStations[total - 1];
      let sliceStart = currentIdx - (targetSlot - 1);
      sliceStart = Math.max(1, Math.min(total - 1 - 16, sliceStart));
      const slice = routeStations.slice(sliceStart, sliceStart + 16);
      visibleStations = [startSt, ...slice, endSt];

      visibleStations.forEach((station, i) => {
        const absIdx = routeStations.indexOf(station);
        const div = buildExtendedStationElement(station, absIdx, currentIdx, positions[i]);
        extendedContainer.appendChild(div);
      });
    } else {
      if (currentIdx < 4) {
        positions = rightPositions;
        frameFile = `beyond/R2L/${currentIdx + 1}.svg`;
        targetSlot = 17 - currentIdx;
      } else if (remaining <= 15) {
        positions = leftPositions;
        frameFile = `beyond/R2L/${remaining}left.svg`;
        targetSlot = remaining - 1;
      } else {
        positions = middlePositions;
        frameFile = 'beyond/R2L/midpoint.svg';
        targetSlot = 14;
      }

      const startSt = routeStations[0];
      const endSt = routeStations[total - 1];
      let s = targetSlot + currentIdx - 16;
      s = Math.max(1, Math.min(total - 1 - 16, s));
      const middleSlice = routeStations.slice(s, s + 16);
      const reversedMiddle = [...middleSlice].reverse();
      visibleStations = [endSt, ...reversedMiddle, startSt];

      visibleStations.forEach((station, i) => {
        const absIdx = routeStations.indexOf(station);
        const div = buildExtendedStationElement(station, absIdx, currentIdx, positions[i]);
        extendedContainer.appendChild(div);
      });
    }

    const routeIdxs = visibleStations.map(s => routeStations.indexOf(s));
    if (r2l) routeIdxs.reverse();
    let arrowSegment = targetSlot + 1;
    if (r2l) {
      // Mirror the segment number because the reversed routeIdxs maps
      // index 0 to the rightmost segment (segment 1), index 17 to leftmost (segment 18).
      // So we need to swap the arrow segment accordingly.
      arrowSegment = 18 - (arrowSegment - 1);
    }
    const segColors = getExtendedSegmentColors(routeIdxs, arrowSegment);
    if (segColors && window._segmentColors) {
      segColors['last'] = window._segmentColors.last;
    }
    loadExtendedSVG(frameFile, segColors);
  }

  function buildExtendedStationElement(station, absIdx, currentIdx, leftPx) {
    const div = document.createElement('div');
    div.className = 'information-display-line-extended-station';
    div.style.left = leftPx + 'px';
    const isPassed = absIdx < currentIdx;
    const isCurrentOrTerminal = (absIdx === currentIdx) || (absIdx === 0) || (absIdx === routeStations.length - 1);
    const passedColor = currentPassedColor();
    const color = isPassed ? passedColor : currentTextColor();
    const fontWeight = isCurrentOrTerminal ? '900' : 'bold';

    div.innerHTML = `
      <div class="information-display-line-extended-station-name" style="font-weight:${fontWeight};">${station.name}</div>
      <div class="information-display-line-extended-station-additional-name">${station.additionalName || ''}</div>
    `;

    const nameDiv = div.querySelector('.information-display-line-extended-station-name');
    const addNameDiv = div.querySelector('.information-display-line-extended-station-additional-name');
    if (nameDiv) nameDiv.style.setProperty('color', color, 'important');
    if (addNameDiv) addNameDiv.style.setProperty('color', isPassed ? passedColor : currentTextColor(), 'important');

    const lineExtended = station.connectingServices.lineExtended;
    for (let rowIdx = 0; rowIdx < 3; rowIdx++) {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'information-display-line-extended-station-connections';
      rowDiv.style.top = (31 + rowIdx * 27) + 'px';
      if (lineExtended[rowIdx] && lineExtended[rowIdx].length > 0) {
        const iconSize = isPassed ? 'grayscale' : 'extended';
        rowDiv.innerHTML = lineExtended[rowIdx].map(s => serviceIconHTML(s, iconSize)).join('');
      }
      div.appendChild(rowDiv);
    }
    return div;
  }

  function loadExtendedSVG(relativePath, segmentColors = null) {
    const url = `visuals/interface/information_display/line_extended/${relativePath}?t=${Date.now()}`;
    const primary = getPrimaryColorForDisplay();
    const secondary = getSecondaryColorForDisplay();
    loadSVGIntoShadow('line-extended', url, primary, segmentColors, secondary);
  }

  // ---------- SVG loader ----------
  async function loadSVGIntoShadow(containerId, url, colorHex, segmentColors = null, dotColorHex = null) {
    const host = document.getElementById(containerId);
    if (!host) return;
    try {
      const resp = await fetch(url);
      const svgText = await resp.text();
      let shadow = host.shadowRoot;
      if (!shadow) {
        shadow = host.attachShadow({ mode: 'open' });
      }
      shadow.innerHTML = svgText;
      const svg = shadow.querySelector('svg');
      if (svg) {
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
      }

      function applyFill(label, color) {
        let el = shadow.querySelector(`[inkscape\\:label="${label}"]`) || shadow.getElementById(label);
        if (el) {
          el.style.fill = color;
          if (el.tagName.toLowerCase() === 'g') {
            el.querySelectorAll('*').forEach(child => child.style.fill = color);
          }
        }
      }

      const labels = ['arrow-color', 'line-color', 'arrow-border', 'line-dots', 'dots-white', 'gray'];
      const isU4 = lineData && lineData.line === 'U4';

      labels.forEach(label => {
        let fillColor;
        if (label === 'arrow-border') {
          if (config.appearance === 'dark') {
            fillColor = '#000000';
          } else {
            fillColor = isU4 ? '#252525' : null;
          }
        } else if (label === 'line-dots') {
          if (dotColorHex) {
            fillColor = `#${dotColorHex}`;
          } else {
            fillColor = isU4 ? '#252525' : null;
          }
        } else if (label === 'dots-white') {
          fillColor = config.appearance === 'dark' ? '#0c0c0c' : '#f3f3f3';
        } else if (label === 'gray') {
          fillColor = config.appearance === 'dark' ? '#585858' : null;
        } else {
          fillColor = `#${colorHex}`;
        }

        if (fillColor) {
          applyFill(label, fillColor);
        }
      });

      // Multi‑colour segment handling
      if (segmentColors) {
        for (const [num, col] of Object.entries(segmentColors)) {
          if (num === 'arrow' || num === 'last') continue;
          applyFill(`line-segment-${num}-color`, col);
        }
        if (segmentColors['last']) {
          applyFill('line-segment-last-color', segmentColors['last']);
        }
        if (segmentColors['arrow']) {
          applyFill('arrow-color', segmentColors['arrow']);
        }
      }
    } catch (e) {
      console.error('SVG load error:', e);
    }
  }

  // ---------- exits / connections overlay (side‑aware) ----------
  function populateExitsConnections() {
    const station = routeStations[currentRouteIndex];
    if (!station) return;

    const stationNameEl = $('.information-display-exits-connections-station-name');
    const stationAdditionalEl = $('.information-display-exits-connections-station-additional-name');

    stationNameEl.textContent = station.name;
    stationAdditionalEl.textContent = station.additionalName || '';

    // Add a class when an additional name is present
    if (stationNameEl) {
      stationNameEl.classList.toggle('has-additional-name', !!station.additionalName);
    }

    const exitData = station.stationExits[`direction${direction}`];
    if (!exitData) return;

    const allPositions = ['frontEnd', 'frontUp', 'frontMiddle', 'middleUp', 'backMiddle', 'backUp', 'backEnd'];
    const posMap = { 1: 'frontUp', 2: 'middleUp', 3: 'backUp' };
    const currentPos = posMap[config.displayPosition] || 'middleUp';
    const curIndex = allPositions.indexOf(currentPos);

    const leftPositions = allPositions.slice(0, curIndex).filter(p => exitData[p]);
    const rightPositions = allPositions.slice(curIndex + 1).filter(p => exitData[p]);
    const centerPos = currentPos;

    const swapSides = (config.displaySide === 2);
    let screenLeftPositions, screenRightPositions;
    if (direction === 1) {
      if (swapSides) {
        screenLeftPositions = leftPositions;
        screenRightPositions = rightPositions;
      } else {
        screenLeftPositions = rightPositions;
        screenRightPositions = leftPositions;
      }
    } else {
      if (swapSides) {
        screenLeftPositions = rightPositions;
        screenRightPositions = leftPositions;
      } else {
        screenLeftPositions = leftPositions;
        screenRightPositions = rightPositions;
      }
    }

    // ---------- GLOBAL distance filter for every amenity string (except "exit") ----------
    const globalItems = [];
    const addItemsFromPos = (pos, side) => {
      if (!exitData[pos]) return;
      const [amenities] = exitData[pos];
      const dist = Math.abs(allPositions.indexOf(pos) - curIndex);
      amenities.forEach(item => {
        globalItems.push({ item, dist, side });
      });
    };
    screenLeftPositions.forEach(p => addItemsFromPos(p, 'left'));
    if (exitData[centerPos]) addItemsFromPos(centerPos, 'center');
    screenRightPositions.forEach(p => addItemsFromPos(p, 'right'));

    // Separate "exit" from other amenities
    const nonExitItems = globalItems.filter(x => x.item !== 'exit');
    const exitItems = globalItems.filter(x => x.item === 'exit');

    // Distance filter for non‑exit items
    const bestByString = new Map();   // item -> { item, dist, sides: Set }
    nonExitItems.forEach(({ item, dist, side }) => {
      const existing = bestByString.get(item);
      if (!existing || dist < existing.dist) {
        bestByString.set(item, { item, dist, sides: new Set([side]) });
      } else if (dist === existing.dist) {
        existing.sides.add(side);
      }
    });

    // Distribute surviving non‑exit items to sides
    const sideItems = { left: [], center: [], right: [] };
    for (const { item, sides } of bestByString.values()) {
      sides.forEach(side => sideItems[side].push(item));
    }

    // Always add "exit" to every side where it occurs (no distance filter)
    exitItems.forEach(({ side }) => {
      if (!sideItems[side].includes('exit')) {
        sideItems[side].push('exit');
      }
    });

    // ---------- helper to merge amenities for one side ----------
    function mergeAmenitiesForSide(items) {
      if (items.length === 0) return [];

      const letters = [];
      const liftsNumbered = [];
      const liftsPlain = [];
      const others = [];
      let hasExit = false;

      items.forEach(item => {
        if (item === 'exit') {
          hasExit = true;
        } else if (/^[A-Z]$/.test(item)) {
          letters.push(item);
        } else if (/^[A-Z]-[A-Z]$/.test(item)) {
          const [start, end] = item.split('-');
          for (let c = start.charCodeAt(0); c <= end.charCodeAt(0); c++) {
            letters.push(String.fromCharCode(c));
          }
        } else if (item.startsWith('lift')) {
          if (item.match(/^lift(\d+)$/)) liftsNumbered.push(item);
          else liftsPlain.push(item);
        } else {
          others.push(item);
        }
      });

      // Merge letters (incl. one‑letter gap between ranges)
      const mergedLetters = [];
      if (letters.length > 0) {
        const sorted = [...new Set(letters)].sort();
        const rawRanges = [];
        let start = sorted[0], end = sorted[0];
        for (let i = 1; i < sorted.length; i++) {
          if (sorted[i].charCodeAt(0) === end.charCodeAt(0) + 1) {
            end = sorted[i];
          } else {
            rawRanges.push({ start, end, isRange: true });
            start = sorted[i];
            end = sorted[i];
          }
        }
        rawRanges.push({ start, end, isRange: true });

        let i = 0;
        while (i < rawRanges.length) {
          const cur = rawRanges[i];
          if (i + 1 < rawRanges.length &&
            rawRanges[i + 1].isRange &&
            cur.isRange &&
            rawRanges[i + 1].start.charCodeAt(0) === cur.end.charCodeAt(0) + 2) {
            cur.end = rawRanges[i + 1].end;
            i++;
          }
          if (cur.start === cur.end) {
            mergedLetters.push(cur.start);
          } else if (cur.end.charCodeAt(0) - cur.start.charCodeAt(0) === 1) {
            mergedLetters.push(cur.start, cur.end);
          } else {
            mergedLetters.push(`${cur.start}-${cur.end}`);
          }
          i++;
        }
      }

      // Lifts
      let finalLifts = [...liftsNumbered, ...liftsPlain];

      const result = [];
      if (hasExit) result.push('exit');
      result.push(...mergedLetters);
      result.push(...finalLifts);
      const orderOthers = ['ramp', 'infocenter', 'WC'];
      orderOthers.forEach(item => {
        if (others.includes(item)) result.push(item);
      });
      return result;
    }

    // ---------- SERVICES (unchanged) ----------
    const allServices = [];
    if (exitData[centerPos]) {
      const [, serv] = exitData[centerPos];
      serv.forEach(s => allServices.push({ service: s, side: 'center', distance: 0 }));
    }
    screenLeftPositions.forEach(pos => {
      const [, serv] = exitData[pos];
      const dist = Math.abs(allPositions.indexOf(pos) - curIndex);
      serv.forEach(s => allServices.push({ service: s, side: 'left', distance: dist }));
    });
    screenRightPositions.forEach(pos => {
      const [, serv] = exitData[pos];
      const dist = Math.abs(allPositions.indexOf(pos) - curIndex);
      serv.forEach(s => allServices.push({ service: s, side: 'right', distance: dist }));
    });

    const bestByService = new Map();
    allServices.forEach(item => {
      const existing = bestByService.get(item.service);
      if (!existing || item.distance < existing.distance ||
        (item.distance === existing.distance && item.side === 'center')) {
        bestByService.set(item.service, { side: item.side, distance: item.distance });
      }
    });

    const servicesBySide = { left: [], center: [], right: [] };
    for (const [service, { side }] of bestByService) {
      servicesBySide[side].push(service);
    }

    const serviceOrder = ['fernverkehr', 'bahn', 'sbahn'];
    function sortServices(list) {
      return list.sort((a, b) => {
        if (a.startsWith('U') && b.startsWith('U')) {
          const numA = parseInt(a.slice(1), 10);
          const numB = parseInt(b.slice(1), 10);
          return numA - numB;
        }
        const idxA = serviceOrder.indexOf(a);
        const idxB = serviceOrder.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        const restOrder = ['tram', 'bus', 'jelbi', 'flughafen'];
        const iA = restOrder.indexOf(a);
        const iB = restOrder.indexOf(b);
        return iA - iB;
      });
    }

    const leftServices = sortServices(servicesBySide.left);
    const centerServices = sortServices(servicesBySide.center);
    const rightServices = sortServices(servicesBySide.right);

    // ---------- BUILD HTML (unchanged) ----------
    function buildSideHTML(amenitiesList, servicesList, isScreenLeft, isScreenRight) {
      let amenitiesHTML = '';
      const hasExit = amenitiesList.includes('exit');
      if (hasExit) {
        if (isScreenLeft) {
          amenitiesHTML += '<img src="visuals/interface/information_display/exit_details/exit_left.svg" class="information-display-exits-connections-exitrow-item">';
        } else if (isScreenRight) {
          amenitiesHTML += '<img src="visuals/interface/information_display/exit_details/exit_right.svg" class="information-display-exits-connections-exitrow-item">';
        }
      }
      amenitiesList.forEach(item => {
        if (item === 'exit') return;
        if (item === 'ramp') {
          amenitiesHTML += '<img src="visuals/interface/information_display/exit_details/ramp.svg" class="information-display-exits-connections-exitrow-item">';
        } else if (item === 'WC') {
          amenitiesHTML += '<img src="visuals/interface/information_display/exit_details/WC.svg" class="information-display-exits-connections-exitrow-item">';
        } else if (item === 'infocenter') {
          amenitiesHTML += '<img src="visuals/interface/information_display/exit_details/info_desk.svg" class="information-display-exits-connections-exitrow-item">';
        } else if (item.startsWith('lift')) {
          const match = item.match(/^lift(\d+)$/);
          if (match) {
            amenitiesHTML += `<div style="position:relative;"><img src="visuals/interface/information_display/exit_details/lift_number.svg" class="information-display-exits-connections-exitrow-item"><div class="information-display-exits-connections-exitrow-elevator-number">${match[1]}</div></div>`;
          } else {
            amenitiesHTML += '<img src="visuals/interface/information_display/exit_details/lift.svg" class="information-display-exits-connections-exitrow-item">';
          }
        } else if (/^[A-Z]-[A-Z]$/.test(item)) {
          amenitiesHTML += `<div class="information-display-exits-connections-exitrow-item-textbox-double"><div class="information-display-exits-connections-exitrow-item-textbox-text">${item.replace('-', ' - ')}</div></div>`;
        } else if (/^[A-Z]$/.test(item)) {
          amenitiesHTML += `<div class="information-display-exits-connections-exitrow-item-textbox-single"><div class="information-display-exits-connections-exitrow-item-textbox-text">${item}</div></div>`;
        }
      });

      const servicesHTML = servicesList.map(s => serviceIconHTML(s, 'exits')).join('');
      return { amenitiesHTML, servicesHTML };
    }

    // Center column
    const centerAmenities = mergeAmenitiesForSide(sideItems.center);
    let centerHTML = '';
    if (centerAmenities.includes('exit')) {
      centerHTML += '<img src="visuals/interface/information_display/exit_details/exit_up.svg" class="information-display-exits-connections-exitrow-item">';
    }
    centerAmenities.forEach(item => {
      if (item === 'exit') return;
      if (item === 'ramp') {
        centerHTML += '<img src="visuals/interface/information_display/exit_details/ramp.svg" class="information-display-exits-connections-exitrow-item">';
      } else if (item === 'WC') {
        centerHTML += '<img src="visuals/interface/information_display/exit_details/WC.svg" class="information-display-exits-connections-exitrow-item">';
      } else if (item === 'infocenter') {
        centerHTML += '<img src="visuals/interface/information_display/exit_details/info_desk.svg" class="information-display-exits-connections-exitrow-item">';
      } else if (item.startsWith('lift')) {
        const match = item.match(/^lift(\d+)$/);
        if (match) {
          centerHTML += `<div style="position:relative;"><img src="visuals/interface/information_display/exit_details/lift_number.svg" class="information-display-exits-connections-exitrow-item"><div class="information-display-exits-connections-exitrow-elevator-number">${match[1]}</div></div>`;
        } else {
          centerHTML += '<img src="visuals/interface/information_display/exit_details/lift.svg" class="information-display-exits-connections-exitrow-item">';
        }
      } else if (/^[A-Z]-[A-Z]$/.test(item)) {
        centerHTML += `<div class="information-display-exits-connections-exitrow-item-textbox-double"><div class="information-display-exits-connections-exitrow-item-textbox-text">${item.replace('-', ' - ')}</div></div>`;
      } else if (/^[A-Z]$/.test(item)) {
        centerHTML += `<div class="information-display-exits-connections-exitrow-item-textbox-single"><div class="information-display-exits-connections-exitrow-item-textbox-text">${item}</div></div>`;
      }
    });

    // Left column
    const leftAmenities = mergeAmenitiesForSide(sideItems.left);
    const leftSideHTML = buildSideHTML(leftAmenities, leftServices, true, false);

    // Right column
    let rightAmenities = mergeAmenitiesForSide(sideItems.right);

    // Keep exit letters in left-to-right order when the right row is visually mirrored.
    // Only reverse the letter items; all other amenities stay untouched.
    const isLetter = (item) => /^[A-Z]$/.test(item) || /^[A-Z]-[A-Z]$/.test(item);
    const letterIndices = [];
    rightAmenities.forEach((item, idx) => {
      if (isLetter(item)) letterIndices.push(idx);
    });

    if (letterIndices.length > 1) {
      const letters = letterIndices.map(i => rightAmenities[i]);
      letters.reverse();
      letterIndices.forEach((idx, i) => {
        rightAmenities[idx] = letters[i];
      });
    }

    const rightSideHTML = buildSideHTML(rightAmenities, rightServices, false, true);

    // Inject into DOM
    $('.information-display-exits-connections-exitrow-left').innerHTML = leftSideHTML.amenitiesHTML;
    $('.information-display-exits-connections-exitrow-center').innerHTML = centerHTML;
    $('.information-display-exits-connections-exitrow-right').innerHTML = rightSideHTML.amenitiesHTML;

    const leftArrow = $('.information-display-exits-connections-connectionrow-left-arrow');
    const rightArrow = $('.information-display-exits-connections-connectionrow-right-arrow');
    const leftConRow = $('.information-display-exits-connections-connectionrow-left');
    const centerConRow = $('.information-display-exits-connections-connectionrow-center');
    const rightConRow = $('.information-display-exits-connections-connectionrow-right');

    leftConRow.innerHTML = leftSideHTML.servicesHTML;

    // Build center service icons
    const centerIconHTML = centerServices.map(s => serviceIconHTML(s, 'exits')).join('');

    if (centerServices.length > 0) {
      centerConRow.innerHTML =
        `<div class="information-display-exits-connections-connectionrow-center-arrow" style="color:#ffffff;">↑</div>` +
        centerIconHTML;
    } else {
      centerConRow.innerHTML = '';
    }

    rightConRow.innerHTML = rightSideHTML.servicesHTML;

    leftArrow.style.display = leftSideHTML.servicesHTML ? 'block' : 'none';
    rightArrow.style.display = rightSideHTML.servicesHTML ? 'block' : 'none';
    leftConRow.style.display = leftSideHTML.servicesHTML ? 'flex' : 'none';
    rightConRow.style.display = rightSideHTML.servicesHTML ? 'flex' : 'none';
  }

  // ---------- master update ----------
  function updateAllDisplays() {
    if (!routeActive) return;

    updateSimpleLineOverview();
    updateExtendedLineOverview();
    if (!isRemote) fitDestinationText();

    // Ensure simple overview stays hidden if exits overview is currently visible
    // (fixes overlap on pop‑outs after config changes)
    if (exitsContainer && getComputedStyle(exitsContainer).visibility === 'visible') {
      simpleContainer.style.visibility = 'hidden';
      $$('.information-display-line-simple-station-name').forEach(el => el.style.visibility = 'hidden');
      $$('.information-display-line-simple-station-additional-name').forEach(el => el.style.visibility = 'hidden');
      $$('.information-display-line-simple-station-connections-rows').forEach(el => el.style.visibility = 'hidden');
    } else {
      simpleContainer.style.visibility = 'visible';
      $$('.information-display-line-simple-station-name').forEach(el => el.style.visibility = 'visible');
      $$('.information-display-line-simple-station-additional-name').forEach(el => el.style.visibility = 'visible');
      $$('.information-display-line-simple-station-connections-rows').forEach(el => el.style.visibility = '');
    }
  }

  function computeRouteSegmentColors() {
    window._segmentColors = null;
    window._arrowColor = null;

    if (!lineData || !routeStations.length) return;

    const rawColors = lineData.color;
    if (!Array.isArray(rawColors)) return;

    const colors = direction === 1 ? [...rawColors] : [...rawColors].reverse();

    const fullStations = direction === 1
      ? lineData.stations.filter(s => s.directionPresence === 'both' || String(s.directionPresence) === '1')
      : lineData.stations.filter(s => s.directionPresence === 'both' || String(s.directionPresence) === '2').reverse();

    const fullAfter = new Array(fullStations.length);
    let colorIdx = 0;
    for (let i = 0; i < fullStations.length; i++) {
      if (fullStations[i].changeover && colorIdx + 1 < colors.length) {
        colorIdx++;
      }
      fullAfter[i] = '#' + colors[Math.min(colorIdx, colors.length - 1)];
    }

    const routeLen = routeStations.length;
    const beforeColor = new Array(routeLen);
    const afterColor = new Array(routeLen);

    for (let r = 0; r < routeLen; r++) {
      const fullIdx = fullStations.indexOf(routeStations[r]);
      if (fullIdx === -1) continue;
      if (fullIdx === 0) {
        beforeColor[r] = '#' + colors[0];
      } else {
        beforeColor[r] = fullAfter[fullIdx - 1];
      }
      afterColor[r] = fullAfter[fullIdx];
    }

    if (config.combinedLineDesign === 'realistic' && Array.isArray(rawColors) && rawColors.length > 0) {
      const primaryHex = '#' + rawColors[0];
      for (let i = 0; i < routeLen; i++) {
        beforeColor[i] = primaryHex;
        afterColor[i] = primaryHex;
      }
      window._arrowColor = primaryHex;
    } else {
      window._arrowColor = beforeColor[currentRouteIndex] || ('#' + colors[0]);
    }

    window._segmentColors = {
      before: beforeColor,
      after: afterColor,
      last: beforeColor[routeLen - 1] || ('#' + colors[colors.length - 1])
    };
  }

  function getSimpleLineSegmentColors(currentIdx) {
    const sc = window._segmentColors;
    if (!sc) return null;

    const N = routeStations.length;
    const seg = {};

    // Arrow and segment 1 = colour before current station
    const arrowCol = window._arrowColor;
    seg[1] = arrowCol;
    seg['arrow'] = arrowCol;            // ← ensures the SVG arrow‑color element is updated

    // Segment 2 = colour between current and next station
    if (currentIdx < N - 1) {
      seg[2] = sc.after[currentIdx];
    } else {
      seg[2] = sc.before[currentIdx];
    }

    // Segment 3
    if (currentIdx + 1 < N) {
      seg[3] = sc.after[currentIdx + 1] || sc.before[currentIdx + 1];
    } else {
      seg[3] = sc.before[currentIdx];
    }

    // Segment 4 and 5 (when beyond)
    const stationsLeft = N - currentIdx;
    if (stationsLeft > 3) {
      // beyond.svg – show real colours
      seg[4] = sc.after[currentIdx + 2] || sc.before[currentIdx + 2];
      seg[5] = sc.last;                     // always the final colour of the route
    } else {
      const lastCol = sc.before[N - 1];
      seg[4] = lastCol;
      seg[5] = lastCol;
    }

    return seg;
  }

  function getExtendedSegmentColors(routeIdxs, arrowSegment) {
    const sc = window._segmentColors;
    if (!sc) return null;

    const seg = {};
    const len = routeIdxs.length;

    // Segment 1: before the first visible station
    if (len > 0) {
      const r0 = routeIdxs[0];
      seg[1] = (r0 >= 0 && r0 < routeStations.length) ? sc.before[r0] : sc.last;
    }

    // Segments 2 … len: between stations i-1 and i
    for (let i = 1; i < len; i++) {
      const prevRouteIdx = routeIdxs[i - 1];
      const segNum = i + 1;
      seg[segNum] = (prevRouteIdx >= 0 && prevRouteIdx < routeStations.length)
        ? sc.after[prevRouteIdx] : sc.last;
    }

    // Segment after the last visible station (if needed – midpoint/last segment)
    if (len > 0) {
      const lastRouteIdx = routeIdxs[len - 1];
      const lastAfter = (lastRouteIdx >= 0 && lastRouteIdx < routeStations.length)
        ? sc.after[lastRouteIdx] : sc.last;
      // This is not a specific segment number, but we'll use it for the 'last' key later.
      // We store it in a property for easy access.
      seg['_lastSegmentColor'] = lastAfter;
    }

    // Arrow colour (segment before the arrow dot)
    if (arrowSegment > 0 && arrowSegment <= len) {
      const routeIdx = routeIdxs[arrowSegment - 1];
      seg['arrow'] = (routeIdx >= 0 && routeIdx < routeStations.length)
        ? sc.before[routeIdx] : sc.last;
    }

    // Emergency rule: segments 1 and 2 always share the same colour
    if (seg[2] !== undefined) seg[1] = seg[2];

    return seg;
  }

  async function applyRemoteRoute(lineFile, start, end, skip, currentIdx) {
    try {
      lineData = await loadJSON(`data/lines/${lineFile}.json`);
    } catch (e) { return; }

    const stations = lineData.stations;
    const startStation = stations.find(s => s.abbrev === start);
    const endStation = stations.find(s => s.abbrev === end);
    if (!startStation || !endStation) return;

    const startIdx = stations.indexOf(startStation);
    const endIdx = stations.indexOf(endStation);
    direction = startIdx < endIdx ? 1 : 2;

    const dirPresenceFiltered = stations.filter(s =>
      s.directionPresence === 'both' ||
      String(s.directionPresence) === String(direction)
    );
    if (dirPresenceFiltered.length === 0) return;

    const fullOrdered = direction === 1
      ? [...dirPresenceFiltered]
      : [...dirPresenceFiltered].reverse();

    const startPos = fullOrdered.findIndex(s => s.abbrev === start);
    const endPos = fullOrdered.findIndex(s => s.abbrev === end);
    if (startPos === -1 || endPos === -1) return;
    if (startPos === endPos) return;

    const segment = fullOrdered.slice(startPos, endPos + 1);

    const skipRaw = skip ? String(skip).trim() : '';
    const isInclude = skipRaw.startsWith('!');

    if (isInclude) {
      const stationPart = skipRaw.slice(1).trim();
      const includeSet = new Set(stationPart ? stationPart.split(/\s+/) : []);
      routeStations = segment.filter(s => includeSet.has(s.abbrev));
    } else {
      const skippedSet = new Set(skipRaw ? skipRaw.split(/\s+/) : []);
      routeStations = segment.filter(s => !skippedSet.has(s.abbrev));
    }

    if (!routeStations.find(s => s.abbrev === start) ||
      !routeStations.find(s => s.abbrev === end)) return;

    currentRouteIndex = Math.min(currentIdx, routeStations.length - 1);
    phase = 'normal';
    routeActive = true;
    exitsTimedOut = false;
    clearAllTimers();

    infoFallbackLayer.style.visibility = 'hidden';
    simpleContainer.style.visibility = 'visible';
    exitsContainer.style.visibility = 'hidden';
    infoLineIcon.src = `visuals/service_icons/subway_lines/${lineData.line}.svg`;
    extendedArrow.style.visibility = 'visible';
    extendedDestination.textContent = routeStations[routeStations.length - 1].name;

    computeRouteSegmentColors();
    updateUIForActiveRoute();
    updateAllDisplays();
  }

  function getStateSnapshot() {
    const state = {
      line: routeActive ? lineData.line : null,
      lineFile: routeActive ? lineData.lineFile : null,
      start: routeActive ? routeStations[0].abbrev : null,
      end: routeActive ? routeStations[routeStations.length - 1].abbrev : null,
      skip: routeActive ? inputSkip.value : '',
      currentIdx: routeActive ? currentRouteIndex : 0,
      config: {
        displaySide: config.displaySide,
        displayPosition: config.displayPosition,
        alwaysShowExitsOverview: config.alwaysShowExitsOverview,
        fallbackLayer: config.fallbackLayer,
        appearance: config.appearance,
        showLiveConnectionsOverview: config.showLiveConnectionsOverview,
        combinedLineDesign: config.combinedLineDesign
      }
    };
    if (!routeActive) {
      state.line = null;
      state.start = null;
      state.end = null;
      state.skip = '';
      state.currentIdx = 0;
    }
    return state;
  }

  function getFullState() {
    if (!routeActive) {
      return {
        line: null, lineFile: null, start: null, end: null, skip: '', currentIdx: 0,
        config: {
          displaySide: config.displaySide,
          displayPosition: config.displayPosition,
          alwaysShowExitsOverview: config.alwaysShowExitsOverview,
          fallbackLayer: config.fallbackLayer,
          appearance: config.appearance,
          showLiveConnectionsOverview: config.showLiveConnectionsOverview,
          combinedLineDesign: config.combinedLineDesign
        }
      };
    }
    return {
      line: lineData.line,
      lineFile: lineData.lineFile || lineData.line,   // fallback for lines not yet re‑confirmed
      start: routeStations[0].abbrev,
      end: routeStations[routeStations.length - 1].abbrev,
      skip: inputSkip ? inputSkip.value : '',
      currentIdx: currentRouteIndex,
      config: {
        displaySide: config.displaySide,
        displayPosition: config.displayPosition,
        alwaysShowExitsOverview: config.alwaysShowExitsOverview,
        fallbackLayer: config.fallbackLayer,
        appearance: config.appearance,
        showLiveConnectionsOverview: config.showLiveConnectionsOverview,
        combinedLineDesign: config.combinedLineDesign
      }
    };
  }

  function getRouteState() {
    if (!routeActive) return null;
    return {
      line: lineData.line,
      lineFile: lineData.lineFile || lineData.line,   // fallback for lines not yet re‑confirmed
      start: routeStations[0].abbrev,
      end: routeStations[routeStations.length - 1].abbrev,
      skip: inputSkip ? inputSkip.value : '',
      currentIdx: currentRouteIndex
    };
  }

  function applyConfig(cfg) {
    config.displaySide = cfg.displaySide;
    config.displayPosition = cfg.displayPosition;
    config.alwaysShowExitsOverview = cfg.alwaysShowExitsOverview;
    config.fallbackLayer = cfg.fallbackLayer;
    config.appearance = cfg.appearance;
    config.showLiveConnectionsOverview = cfg.showLiveConnectionsOverview;
    config.combinedLineDesign = cfg.combinedLineDesign;
    applyConfigUI();
  }

  function applyAppearance(appearance) {
    config.appearance = appearance;

    const isDark = appearance === 'dark';
    document.body.classList.toggle('dark-mode', isDark);
    toggleDarkModeStyles(isDark);

    overlayImages.forEach(img => { img.src = currentOverlaySrc(); });

    if (!isRemote) {
      const setActive = (btn, active) => btn && (btn.style.border = active ? '4px solid #f0d722' : '');
      setActive(appearanceLightBtn, appearance === 'light');
      setActive(appearanceDarkBtn, appearance === 'dark');
    }

    updateLiveConnectionsGridSrc();
    updatePageIndicator();
    updateLiveConnectionTimes();

    if (routeActive) {
      // Rebuild extended line stations (colour update) + reload extended SVG with segment colours
      updateExtendedLineOverview();

      // Reload simple SVG (arrow‑border + segment colours)
      const stationsLeft = routeStations.length - currentRouteIndex;
      let simpleFrame;
      if (stationsLeft > 3) simpleFrame = 'beyond';
      else if (stationsLeft === 3) simpleFrame = '3';
      else if (stationsLeft === 2) simpleFrame = '2';
      else simpleFrame = '1';
      loadSimpleSVG(simpleFrame);
    }
  }

  function setCurrentVia(via) {
    currentVia = via;
  }

  function getCurrentVia() {
    return currentVia;
  }

  function showExitsRemote() {
    simpleContainer.style.visibility = 'hidden';
    $$('.information-display-line-simple-station-name').forEach(el => el.style.visibility = 'hidden');
    $$('.information-display-line-simple-station-additional-name').forEach(el => el.style.visibility = 'hidden');
    $$('.information-display-line-simple-station-connections-rows').forEach(el => el.style.visibility = 'hidden');
    exitsContainer.style.visibility = 'visible';
    populateExitsConnections();
  }

  function hideExitsRemote() {
    simpleContainer.style.visibility = 'visible';
    $$('.information-display-line-simple-station-name').forEach(el => el.style.visibility = 'visible');
    $$('.information-display-line-simple-station-additional-name').forEach(el => el.style.visibility = 'visible');
    $$('.information-display-line-simple-station-connections-rows').forEach(el => el.style.visibility = '');
    exitsContainer.style.visibility = 'hidden';
  }

  // ---------- init ----------
  async function init() {
    await loadConfig();

    try {
      localizationData = await loadJSON('data/localization/lang.json');
      applyLocalization();
    } catch (e) {
      console.error('Failed to load localization data:', e);
    }

    try {
      destinationFilter = await loadJSON('data/live_connections_destination_filter.json');
    } catch (e) {
      destinationFilter = {};
    }

    if (isRemote) {
      // Remote mode: no controls, only display setup
      infoFallbackLayer.style.visibility = 'visible';
      simpleContainer.style.visibility = 'visible';
      exitsContainer.style.visibility = 'hidden';
      dirFallback.style.visibility = 'visible';
      dirDestination.style.visibility = 'hidden';
      nextStationDisplay.style.visibility = 'hidden';
      exitLeftArrow.style.visibility = 'hidden';
      exitRightArrow.style.visibility = 'hidden';
      doorLightbar.style.visibility = 'hidden';
      extendedArrow.style.visibility = 'hidden';
      extendedDestination.textContent = '';
      return;
    }
    resetAllButtons();
    infoFallbackLayer.style.visibility = 'visible';
    simpleContainer.style.visibility = 'visible';
    exitsContainer.style.visibility = 'hidden';
    dirFallback.style.visibility = 'visible';
    dirDestination.style.visibility = 'hidden';
    dirDestination.style.display = 'none';
    nextStationDisplay.style.visibility = 'hidden';
    nextStationDisplay.style.display = 'none';
    exitLeftArrow.style.visibility = 'hidden';
    exitRightArrow.style.visibility = 'hidden';
    doorLightbar.style.visibility = 'hidden';
    extendedArrow.style.visibility = 'hidden';
    extendedDestination.textContent = '';

    if (!isRemote) {
      const configButtons = [btnSide1, btnSide2, btnPosH, btnPosM, btnPosV, btnAlwaysY, btnAlwaysN, btnFallback1, btnFallback2, btnFallback3, btnFallback4, appearanceLightBtn, appearanceDarkBtn];
    }
  }

  function applyConfigToggle(value) {
    config.showLiveConnectionsOverview = value;
    const lcContainer = document.getElementById('information-display-live-connections');
    if (lcContainer) {
      const lcActive = liveConnectionsInterval !== null;
      lcContainer.style.visibility = (value && lcActive) ? 'visible' : 'hidden';
      if (value && lcActive) {
        updateLiveConnectionsGridSrc();
        updatePageIndicator();
      }
    }
  }

  function applyCombinedLineDesign(value) {
    config.combinedLineDesign = value;
    if (routeActive) {
      computeRouteSegmentColors();   // recompute uniform colors if realistic
      updateAllDisplays();           // reload SVGs with new colors
    }
  }

  init().catch(err => console.error('Init error:', err));

  window.Simulator = {
    moveForward, moveForwardNoTimer, moveBackward, shortBeforeStop, doorRelease, doorLock,
    confirmRoute, resetRoute, applyRemoteRoute, getStateSnapshot,
    getFullState, getRouteState, applyConfig, applyAppearance,
    setCurrentVia, getCurrentVia, shouldShowExits, showExitsRemote, hideExitsRemote,
    showLiveConnectionsRemote, hideLiveConnections, applyCombinedLineDesign,
    applyConfigToggle
  };
})();