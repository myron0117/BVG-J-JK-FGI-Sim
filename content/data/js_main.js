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
  let inputLineData = null;
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
  let autoCloseConsumed = false;

  let directionDisplayRevealTimer = null;

  let exitsIconsRevealedThisVisit = false;
  let exitsIconsDelayTimer = null;
  let randomViaCache = new Map();   // station abbrev -> 'left' | 'right'

  let liveConnectionsTimer = null;      // 10‑second timer for showing the overview
  let liveConnectionsInterval = null;   // 10‑second page cycling
  let liveConnectionsTimeInterval = null; // periodic time update
  let liveConnectionsData = null;       // fetched departures
  let liveConnectionsPages = [];        // array of arrays (each page up to 12 services)
  let liveConnectionsCurrentPage = 0;
  let liveConnectionsStationId = null;  // cache the station ID
  let liveConnectionsRefreshInterval = null;   // 1 s fetch + re-render
  let liveConnectionsEpoch = 0;   // bumped whenever we want in-flight work to be discarded
  let liveConnectionsCycleInterval = null;   // remembers the currently running cycle period
  let liveConnectionsVisible = false;
  let liveConnectionsWindowActive = false;

  // Per-station initial "loading" delay for the live-connections services
  let liveConnectionsInitialDelayPlayedThisVisit = false;
  let liveConnectionsInitialDelayTimer = null;

  // Roll-in animation (30ms stagger per cell)
  let liveConnectionsAnimationTimers = [];

  // Signature of the currently displayed page, for change detection
  let liveConnectionsLastSignature = null;

  let warningTextMode = 'full';                // 'full' | 'half'
  let routeWarnings = new Map();               // abbrev -> warning object
  let liveConnectionsServices = [];            // flat list of service entries
  let liveConnectionsWarningText = null;       // { de, en } | null
  let liveConnectionsIsHalf = false;
  let liveConnectionsPageInterval = 7000;

  let extendedStations = [];
  let extendedFrameFile = '';
  let extendedPositions = [];
  let stationPositions = null;

  let currentEndMarker = '';

  let currentKeybinds = {
    forward: 'a',
    doorsLeft: 'insert',
    doorsRight: 'page up',
    doorClosure: 'home'
  };

  let keybindEditorActive = false;
  let keybindEditorIndex = 0;
  let keybindEditorDraft = null;

  // ---------- simple-line flicker (cosmetic realism) ----------
  // IRL the display occasionally loses sync for a frame or two: station names
  // and connection icons blink out and reappear immediately. Tends to happen
  // around phase changes (arrival, doors, departure). Everything is tunable;
  // set SIMPLE_FLICKER_ENABLED = false to disable, or nudge the constants
  // below if the effect feels too frequent / too rare in your simulator.

  const SIMPLE_FLICKER_ENABLED = true;
  const SIMPLE_FLICKER_DURATION_MS = 50;      // how long elements stay hidden

  // Baseline: one flicker every [MIN, MAX] ms, randomized.
  const SIMPLE_FLICKER_INTERVAL_MIN_MS = 20000;
  const SIMPLE_FLICKER_INTERVAL_MAX_MS = 30000;

  // Burst: extra flickers right after phase changes / while stopped.
  const SIMPLE_FLICKER_BURST_CHANCE = 0.2;        // 0..1, probability per event
  const SIMPLE_FLICKER_BURST_COUNT_MIN = 1;       // flickers per burst
  const SIMPLE_FLICKER_BURST_COUNT_MAX = 2;
  const SIMPLE_FLICKER_BURST_GAP_MIN_MS = 5000;   // spacing inside a burst
  const SIMPLE_FLICKER_BURST_GAP_MAX_MS = 10000;

  const SIMPLE_FLICKER_SELECTORS = [
    '.information-display-line-simple-station-name',
    '.information-display-line-simple-station-additional-name',
    '.information-display-line-simple-station-connections-rows'
  ];

  const SIMPLE_FLICKER_BURST_COOLDOWN_MS = 5000;

  // Cosmetic transition delays when entering/leaving the route display.
  // Fallback → Route: brief blank (pure white/black) before the route renders.
  // Route → Fallback: same in reverse, shorter.
  const FALLBACK_TO_ROUTE_DELAY_MS = 800;
  const ROUTE_TO_FALLBACK_DELAY_MS = 200;

  let displayTransitionActive = false;

  let simpleFlickerLoopTimer = null;
  let simpleFlickerHideTimer = null;
  let simpleFlickerBurstTimers = [];
  let simpleFlickerLastBurstAt = 0;

  const KEYBIND_FUNCTIONS = [
    { key: 'forward', labelDe: 'Beschleunigung', labelEn: 'acceleration' },
    { key: 'doorsLeft', labelDe: 'Türfreigabe links', labelEn: 'left door release' },
    { key: 'doorsRight', labelDe: 'Türfreigabe rechts', labelEn: 'right door release' },
    { key: 'doorClosure', labelDe: 'Türen schließen', labelEn: 'close doors' }
  ];

  const gongStandard = new Audio('audio/BVG_Gong_Standard.wav');
  const gongEnd = new Audio('audio/BVG_Gong_Endstation.wav');
  const doorSound = new Audio('audio/METRO_Türschlusssignal_Außen_2.wav');

  // ---------- live connections destination filtering ----------
  // Substrings removed from every destination text, regardless of length.
  const DESTINATION_ALWAYS_REMOVE = ['(Berlin)', '⟳', '⟲'];

  // If the destination is too wide, crop from the earliest match of one of these
  // patterns (the match itself and everything after it is discarded).
  const DESTINATION_CROP_PATTERNS = [
    / - /,        // " - " (with surrounding spaces; protects hyphenated names)
    /\//,         // "/"
    /\bvia\b/i,   // "via" as a whole word, case-insensitive
    /->/,         // "->"
    /,/           // ","
  ];

  // Maximum width of a destination string before cropping is attempted.
  const DESTINATION_MAX_WIDTH_PX = 640;

  // Must match the actual CSS font-size for
  // .information-display-live-connections-service-destination
  const DESTINATION_FONT_SIZE_PX = 40;

  // ---------- helpers ----------
  const disableBtn = (btn) => { if (!btn) return; btn.style.opacity = '0.2'; btn.style.pointerEvents = 'none'; };
  const enableBtn = (btn) => { if (!btn) return; btn.style.opacity = '1'; btn.style.pointerEvents = 'auto'; };

  function currentTextColor() {
    return config && config.appearance === 'dark' ? '#ffffff' : '#252525';
  }

  function currentPassedColor() {
    return config && config.appearance === 'dark' ? '#585858' : '#8c8c8c';
  }

  function clearAllTimers(skipDoorTimers = false) {
    if (gongTimer) { clearTimeout(gongTimer); gongTimer = null; }
    if (pageLoopTimer) { clearInterval(pageLoopTimer); pageLoopTimer = null; }
    if (!skipDoorTimers) {
      if (doorBlinkInterval) { clearInterval(doorBlinkInterval); doorBlinkInterval = null; }
      if (blinkStopTimer) { clearTimeout(blinkStopTimer); blinkStopTimer = null; }
      if (forwardPendingTimer) { clearTimeout(forwardPendingTimer); forwardPendingTimer = null; }
      if (doorAutoCloseTimer) { clearTimeout(doorAutoCloseTimer); doorAutoCloseTimer = null; }
    }
  }

  function clearRoutingTimers() {
    if (gongTimer) { clearTimeout(gongTimer); gongTimer = null; }
    if (pageLoopTimer) { clearInterval(pageLoopTimer); pageLoopTimer = null; }
  }

  function updateDoorButtonAvailability() {
    // At origin (or no route at all) the train is "parked", so release is valid.
    const atOriginOrIdle = !routeActive || currentRouteIndex === 0;

    const releaseAvailable =
      phase === 'arrival' ||
      phase === 'closing' ||
      (phase === 'normal' && atOriginOrIdle);

    if (releaseAvailable) enableBtn(btnDoorRelease); else disableBtn(btnDoorRelease);
    if (phase === 'doorReleased') enableBtn(btnDoorLock); else disableBtn(btnDoorLock);
  }

  function remoteDoorAction(viaHint) {
    if (phase === 'normal') {
      if (btnArrival && btnArrival.style.pointerEvents !== 'none') {
        if (viaHint === 'left' || viaHint === 'right') currentVia = viaHint;
        window.send('arrival');
      }
      return;
    }
    if (phase === 'arrival' || phase === 'closing') {
      window.send('doorRelease');
      return;
    }
    // doorReleased: no-op — closing is still bound to doorLock (its own key).
  }

  function applySimpleFlickerHide() {
    SIMPLE_FLICKER_SELECTORS.forEach(sel => {
      $$(sel).forEach(el => { el.style.opacity = '0'; });
    });
  }

  function applySimpleFlickerShow() {
    SIMPLE_FLICKER_SELECTORS.forEach(sel => {
      $$(sel).forEach(el => { el.style.opacity = ''; });
    });
  }

  function doSimpleFlicker() {
    if (!SIMPLE_FLICKER_ENABLED) return;
    if (!routeActive) return;
    const simple = document.getElementById('information-display-line-simple');
    if (!simple || simple.style.visibility === 'hidden') return;   // exits overview showing
    if (simpleFlickerHideTimer) return;                             // already mid-flicker

    applySimpleFlickerHide();
    simpleFlickerHideTimer = setTimeout(() => {
      simpleFlickerHideTimer = null;
      applySimpleFlickerShow();
    }, SIMPLE_FLICKER_DURATION_MS);
  }

  function scheduleNextSimpleFlicker() {
    if (simpleFlickerLoopTimer) { clearTimeout(simpleFlickerLoopTimer); simpleFlickerLoopTimer = null; }
    if (!SIMPLE_FLICKER_ENABLED) return;
    const gap = SIMPLE_FLICKER_INTERVAL_MIN_MS +
      Math.random() * (SIMPLE_FLICKER_INTERVAL_MAX_MS - SIMPLE_FLICKER_INTERVAL_MIN_MS);
    simpleFlickerLoopTimer = setTimeout(() => {
      doSimpleFlicker();
      scheduleNextSimpleFlicker();
    }, gap);
  }

  function triggerSimpleFlickerBurst() {
    if (!SIMPLE_FLICKER_ENABLED) return;

    // Cooldown: during the 5s gong window after a forward/backward, further
    // bursts are dropped so rapid-forwarding doesn't stack flickers.
    const now = Date.now();
    if (now - simpleFlickerLastBurstAt < SIMPLE_FLICKER_BURST_COOLDOWN_MS) return;
    simpleFlickerLastBurstAt = now;

    if (Math.random() > SIMPLE_FLICKER_BURST_CHANCE) return;
    const n = SIMPLE_FLICKER_BURST_COUNT_MIN +
      Math.floor(Math.random() *
        (SIMPLE_FLICKER_BURST_COUNT_MAX - SIMPLE_FLICKER_BURST_COUNT_MIN + 1));
    let delay = 0;
    for (let i = 0; i < n; i++) {
      delay += SIMPLE_FLICKER_BURST_GAP_MIN_MS +
        Math.random() * (SIMPLE_FLICKER_BURST_GAP_MAX_MS - SIMPLE_FLICKER_BURST_GAP_MIN_MS);
      const t = setTimeout(() => {
        doSimpleFlicker();
        simpleFlickerBurstTimers = simpleFlickerBurstTimers.filter(x => x !== t);
      }, delay);
      simpleFlickerBurstTimers.push(t);
    }
  }

  function startSimpleFlickerLoop() {
    if (!SIMPLE_FLICKER_ENABLED) return;
    scheduleNextSimpleFlicker();
  }

  function getOrCreatePureBgOverlay(containerSelector, id) {
    let overlay = document.getElementById(id);
    if (!overlay) {
      const container = document.querySelector(containerSelector);
      if (!container) return null;
      const cs = getComputedStyle(container);
      if (cs.position === 'static') container.style.position = 'relative';
      overlay = document.createElement('div');
      overlay.id = id;
      overlay.style.cssText =
        'position:absolute;inset:0;z-index:2147483647;display:none;pointer-events:none;';
      container.appendChild(overlay);
    }
    return overlay;
  }

  function showPureBackground() {
    const isDark = config && config.appearance === 'dark';
    const color = isDark ? '#000000' : '#ffffff';
    const info = getOrCreatePureBgOverlay('.information-display', 'info-pure-bg');
    if (info) {
      info.style.backgroundColor = color;
      info.style.display = 'block';
    }
  }

  function hidePureBackground() {
    const info = document.getElementById('info-pure-bg');
    if (info) info.style.display = 'none';
  }

  async function fetchDepartures(stationId) {
    try {
      const resp = await fetch(`http://127.0.0.1:7003/stops/${stationId}/departures?duration=60`);
      if (!resp.ok) throw new Error('API error');
      return await resp.json();
    } catch (e) {
      console.error('Failed to fetch departures:', e);
      return null;
    }
  }

  // Express line names ("ICE1004", "IC2045") are longer than U/S/tram/bus
  // line names, so they start at 32px instead of the usual line-text size.
  // Step down to 28px and 24px before giving up; compensate the drop in
  // visual weight with 2px / 4px of downward shift, on top of a constant
  // 10px nudge that keeps the shorter 32px text vertically centred in the
  // row relative to the icon and destination text.
  function resolveExpressLineName(rawLineName) {
    const EMPTY = { text: '', fontSize: 32, offsetY: 10 };
    if (!rawLineName) return EMPTY;

    const text = String(rawLineName).replace(/\s+/g, '');
    if (!text) return EMPTY;

    // Line text is bold in both modes (no dark-mode override exists for it).
    const WIDTH_LIMIT = 100;

    let width = measureTextWidth(text, 32, 'TransitPro', 'bold');
    if (width <= WIDTH_LIMIT) return { text, fontSize: 32, offsetY: 10 };

    width = measureTextWidth(text, 28, 'TransitPro', 'bold');
    if (width <= WIDTH_LIMIT) return { text, fontSize: 28, offsetY: 12 };

    return { text, fontSize: 24, offsetY: 14 };
  }

  function processDepartures(departuresJson) {
    if (!departuresJson || !departuresJson.departures) return [];

    const currentLine = (lineData && lineData.line) ? lineData.line.toUpperCase() : '';
    const currentProduct = (lineData && lineData.alternative === 'suburban') ? 'suburban' : 'subway';

    const now = Date.now();

    const filtered = departuresJson.departures.filter(d => {
      const product = d.line && d.line.product;
      if (!product) return false;
      const name = (d.line && d.line.name) || '';
      if (product === currentProduct && name.toUpperCase() === currentLine) return false;

      // Skip anything without a timestamp, or anything that would render as "0'"
      // on screen (i.e. has already departed).
      if (!d.when) return false;
      const departureTime = new Date(d.when).getTime();
      if (departureTime <= now) return false;

      return true;
    });

    // 2. Product order
    // const productOrder = { regional: 1, suburban: 2, subway: 3, tram: 4, bus: 5 };

    // 3. Group by product
    const groups = {};
    filtered.forEach(d => {
      const product = d.line.product;
      if (!groups[product]) groups[product] = [];
      groups[product].push(d);
    });

    // 4. Within each product, sort by line name (custom for S‑Bahn)
    const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

    // const compareLineNames = (nameA, nameB, product) => {
    //   if (product === 'suburban') {
    //     const extract = (name) => {
    //       const match = name.match(/(\d+)/);
    //       if (!match) return { primary: Infinity, full: Infinity };
    //       const full = parseInt(match[1], 10);
    //       const primary = parseInt(match[1][0], 10);
    //       return { primary, full };
    //     };
    //     const a = extract(nameA);
    //     const b = extract(nameB);
    //     if (a.primary !== b.primary) return a.primary - b.primary;
    //     return a.full - b.full;
    //   }
    //   return collator.compare(nameA, nameB);
    // };

    const compareLineNames = (nameA, nameB, product) => {
      if (product === 'suburban') {
        // IRL sort is on the full number, not the first digit:
        // S1 < S2 < S3 < … < S15 < S25 < S26 < …
        const extract = (name) => {
          const match = name.match(/(\d+)/);
          if (!match) return Infinity;
          return parseInt(match[1], 10);
        };
        return extract(nameA) - extract(nameB);
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
    // Express (IC/ICE) above everything; ferry below bus.
    ['express', 'regional', 'suburban', 'subway', 'tram', 'bus', 'ferry'].forEach(product => {
      if (groups[product]) sorted.push(...groups[product]);
    });

    // 8. Split into pages of 12
    const pages = [];
    for (let i = 0; i < sorted.length; i += 12) {
      pages.push(sorted.slice(i, i + 12));
    }
    return pages;
  }

  function resolveViaForCurrentStation() {
    if (currentVia) return currentVia;
    const cur = routeStations[currentRouteIndex];
    if (!cur) return '';
    const exitSide = cur.exitSide[`direction${direction}`];
    const isTerminus = currentRouteIndex === routeStations.length - 1;
    let via = isTerminus && exitSide?.terminus
      ? exitSide.terminus
      : (exitSide?.via || '');
    if (via === 'random') {
      // Per-trip cache, keyed by station abbreviation. The pick survives
      // currentVia being cleared by any code path, so early-show and arrival
      // always agree. Cleared only on trip reset (resetRoute / resetRouteKeepInputs).
      if (!randomViaCache.has(cur.abbrev)) {
        randomViaCache.set(cur.abbrev, Math.random() < 0.5 ? 'left' : 'right');
      }
      via = randomViaCache.get(cur.abbrev);
    }
    currentVia = via;
    return via;
  }

  function resetExitsIconDelay() {
    if (exitsIconsDelayTimer) {
      clearTimeout(exitsIconsDelayTimer);
      exitsIconsDelayTimer = null;
    }
    exitsIconsRevealedThisVisit = false;
  }

  function maybeShowExitsEarly() {
    if (!routeActive) return;
    if (config.appearance !== 'dark') return;
    if (phase !== 'normal') return;
    if (!liveConnectionsWindowActive) return;
    if (exitsTimedOut) return;
    if (!exitsContainer) return;
    if (exitsContainer.style.visibility === 'visible') return;   // already shown

    const via = resolveViaForCurrentStation();
    if (!shouldShowExits(via)) return;

    showExitsRemote();   // works on main page and pop-outs
  }

  function resetLiveConnectionsInitialDelay() {
    if (liveConnectionsInitialDelayTimer) {
      clearTimeout(liveConnectionsInitialDelayTimer);
      liveConnectionsInitialDelayTimer = null;
    }
    liveConnectionsInitialDelayPlayedThisVisit = false;
    liveConnectionsLastSignature = null;
  }

  function cancelServiceAnimation() {
    for (const t of liveConnectionsAnimationTimers) clearTimeout(t);
    liveConnectionsAnimationTimers = [];
  }

  function startServiceAnimation() {
    cancelServiceAnimation();
    const lcContainer = document.getElementById('information-display-live-connections');
    if (!lcContainer) return;
    const rows = lcContainer.querySelectorAll('.information-display-live-connections-service');
    if (rows.length === 0) return;

    // Hide everything, then stagger-reveal: 1st at 30ms, 2nd at 60ms, …
    rows.forEach(row => { row.style.visibility = 'hidden'; });
    const STEP_MS = 30;
    rows.forEach((row, i) => {
      const t = setTimeout(() => {
        row.style.visibility = '';
      }, (i + 1) * STEP_MS);
      liveConnectionsAnimationTimers.push(t);
    });
  }

  // Stable fingerprint of one page's visible services. Minutes (rounded) are
  // included so a minute tick counts as a change; the raw ISO timestamp is
  // not, so small API jitter between refetches doesn't trigger animation.
  function computePageSignature(pageIdx) {
    const page = liveConnectionsPages[pageIdx];
    if (!page) return 'none';
    if (page.kind === 'warning') return 'warning';
    if (!page.items || page.items.length === 0) return 'empty';
    return page.items.map(d => {
      const lineName = (d.line && d.line.name) || '';
      const dir = d.direction || '';
      const minutes = d.when ? Math.ceil((new Date(d.when).getTime() - Date.now()) / 60000) : 0;
      return `${lineName}|${dir}|${minutes}`;
    }).join('||');
  }

  function startLiveConnectionsTimer() {
    if (isRemote) return;
    if (liveConnectionsTimer) clearTimeout(liveConnectionsTimer);
    liveConnectionsTimer = setTimeout(async () => {
      liveConnectionsTimer = null;
      liveConnectionsVisible = true;
      liveConnectionsWindowActive = true;   // NEW
      await showLiveConnections();
      // NEW: keep the refresh loop alive while the window is active, even
      // if the first fetch was empty (so service icons appear as soon as
      // the API has content, and pop-outs stay in sync via the broadcast).
      if (!liveConnectionsWindowActive) return;
      if (liveConnectionsRefreshInterval) clearInterval(liveConnectionsRefreshInterval);
      liveConnectionsRefreshInterval = setInterval(showLiveConnections, 2000);
    }, 10000);
  }

  function computeLiveConnectionsPlan() {
    const station = routeStations[currentRouteIndex];
    const warning = station ? routeWarnings.get(station.abbrev) : null;
    const services = liveConnectionsServices;

    const pages = [];
    let warningText = null;
    let isHalf = false;
    let pageInterval = 7000;
    const MAX_PAGES = 3;

    if (!warning) {
      for (let i = 0; i < services.length && pages.length < MAX_PAGES; i += 12) {
        pages.push({ kind: 'services', items: services.slice(i, i + 12) });
      }
      return { pages, warningText, isHalf, pageInterval };
    }

    warningText = buildWarningText(warning);

    if (warningTextMode === 'half') {
      isHalf = true;
      pageInterval = 5000;
      for (let i = 0; i < services.length && pages.length < 5; i += 6) {
        pages.push({ kind: 'services', items: services.slice(i, i + 6) });
      }
      if (pages.length === 0) pages.push({ kind: 'services', items: [] });
    } else {
      pages.push({ kind: 'warning' });
      for (let i = 0; i < services.length && pages.length < MAX_PAGES; i += 12) {
        pages.push({ kind: 'services', items: services.slice(i, i + 12) });
      }
    }

    return { pages, warningText, isHalf, pageInterval };
  }

  function refreshLiveConnectionsPlan() {
    const plan = computeLiveConnectionsPlan();
    liveConnectionsPages = plan.pages;
    liveConnectionsWarningText = plan.warningText;
    liveConnectionsIsHalf = plan.isHalf;
    liveConnectionsPageInterval = plan.pageInterval;
    if (liveConnectionsCurrentPage >= liveConnectionsPages.length) {
      liveConnectionsCurrentPage = 0;
    }
    return plan;
  }

  function startLiveConnectionsCycle(intervalMs) {
    if (liveConnectionsInterval && liveConnectionsCycleInterval === intervalMs) return;
    if (liveConnectionsInterval) clearInterval(liveConnectionsInterval);
    liveConnectionsCycleInterval = intervalMs;
    liveConnectionsInterval = setInterval(() => {
      if (liveConnectionsPages.length <= 1) return;
      // Cancel any running roll-in; the flip starts fresh.
      cancelServiceAnimation();
      liveConnectionsCurrentPage = (liveConnectionsCurrentPage + 1) % liveConnectionsPages.length;
      liveConnectionsLastSignature = computePageSignature(liveConnectionsCurrentPage);
      renderLiveConnectionsPage(liveConnectionsCurrentPage, true);
      updatePageIndicator();
    }, intervalMs);
  }

  function restartLiveConnectionsIfVisible() {
    const lc = document.getElementById('information-display-live-connections');
    if (!lc || lc.style.visibility !== 'visible') return;
    refreshLiveConnectionsPlan();
    liveConnectionsCurrentPage = 0;
    renderLiveConnectionsPage(0, false);
    liveConnectionsLastSignature = computePageSignature(0);
    updatePageIndicator();
    startLiveConnectionsCycle(liveConnectionsPageInterval);

    // Tell pop-outs to reset page and take the new mode immediately.
    if (!isRemote && window.broadcastChannel) {
      window.broadcastChannel.postMessage({
        type: 'liveConnections',
        pages: liveConnectionsPages,
        warningText: liveConnectionsWarningText,
        isHalf: liveConnectionsIsHalf,
        pageInterval: liveConnectionsPageInterval,
        restart: true
      });
    }
  }

  // Current visual state: 'full' on the warning page, 'half' when services share
  // the display with a half-warning, 'none' otherwise.
  function currentWarningDisplayMode() {
    const page = liveConnectionsPages[liveConnectionsCurrentPage];
    if (page && page.kind === 'warning') return 'full';
    if (liveConnectionsIsHalf) return 'half';
    return 'none';
  }

  function setWarningDisplay(mode) {
    const header = document.querySelector('.information-display-live-connections-header');
    const fullDe = document.querySelector('.information-display-live-connections-warning-text-full-de');
    const fullEn = document.querySelector('.information-display-live-connections-warning-text-full-en');
    const halfDe = document.querySelector('.information-display-live-connections-warning-text-half-de');
    const halfEn = document.querySelector('.information-display-live-connections-warning-text-half-en');

    if (header) {
      // Only touch display. Never visibility: an inline visibility:visible on a
      // child overrides visibility:hidden on the parent and leaves the header
      // floating on screen whenever the panel itself is hidden.
      header.style.display = (mode === 'full') ? 'none' : '';
    }

    const showFull = (mode === 'full');
    const showHalf = (mode === 'half');

    if (fullDe) fullDe.style.display = showFull ? '' : 'none';
    if (fullEn) fullEn.style.display = showFull ? '' : 'none';
    if (halfDe) halfDe.style.display = showHalf ? '' : 'none';
    if (halfEn) halfEn.style.display = showHalf ? '' : 'none';
  }

  function applyWarningTextToDom(texts) {
    const t = texts || { de: '', en: '' };
    const fullDe = document.querySelector('.information-display-live-connections-warning-text-full-de');
    const fullEn = document.querySelector('.information-display-live-connections-warning-text-full-en');
    const halfDe = document.querySelector('.information-display-live-connections-warning-text-half-de');
    const halfEn = document.querySelector('.information-display-live-connections-warning-text-half-en');
    if (fullDe) fullDe.textContent = t.de;
    if (fullEn) fullEn.textContent = t.en;
    if (halfDe) halfDe.textContent = t.de;
    if (halfEn) halfEn.textContent = t.en;
  }

  async function showLiveConnections() {
    if (!routeActive) return;
    if (!liveConnectionsWindowActive) return;

    const station = routeStations[currentRouteIndex];
    const stationId = station && station.apiID;
    if (!stationId) return;

    const myEpoch = liveConnectionsEpoch;

    const json = await fetchDepartures(stationId);

    // Discard the whole cycle if we were hidden while the fetch was in flight,
    // or if the epoch advanced (route reset, new station, mode toggle).
    if (myEpoch !== liveConnectionsEpoch) return;
    if (!liveConnectionsVisible) return;
    if (!routeActive) return;

    liveConnectionsData = json;
    liveConnectionsServices = processDepartures(json).flat();
    liveConnectionsStationId = stationId;

    const plan = refreshLiveConnectionsPlan();

    if (liveConnectionsPages.length === 0) {
      hideLiveConnections(true);
      return;
    }

    if (liveConnectionsCurrentPage >= liveConnectionsPages.length) {
      liveConnectionsCurrentPage = 0;
    }

    // --- Animation decision ---
    const newSignature = computePageSignature(liveConnectionsCurrentPage);
    const contentChanged = newSignature !== liveConnectionsLastSignature;
    liveConnectionsLastSignature = newSignature;

    const firstFrame = !liveConnectionsInitialDelayPlayedThisVisit;
    if (firstFrame) liveConnectionsInitialDelayPlayedThisVisit = true;

    if (firstFrame) {
      const firstPageIsWarning = liveConnectionsPages[0] && liveConnectionsPages[0].kind === 'warning';
      if (firstPageIsWarning) {
        // Warning page shows first — "processing" already had time to run.
        renderLiveConnectionsPage(liveConnectionsCurrentPage, true);
      } else {
        // Hide services, reveal after delay.
        renderLiveConnectionsPage(liveConnectionsCurrentPage, false, true);
        const pageCount = liveConnectionsPages.length;
        const delayMs = liveConnectionsIsHalf ? pageCount * 500 : pageCount * 1000;
        if (liveConnectionsInitialDelayTimer) clearTimeout(liveConnectionsInitialDelayTimer);
        liveConnectionsInitialDelayTimer = setTimeout(() => {
          liveConnectionsInitialDelayTimer = null;
          startServiceAnimation();
        }, delayMs);
      }
    } else if (contentChanged) {
      if (liveConnectionsInitialDelayTimer) {
        // Still inside the initial delay — re-render hidden, the pending
        // delay timer will do the reveal.
        renderLiveConnectionsPage(liveConnectionsCurrentPage, false, true);
      } else {
        renderLiveConnectionsPage(liveConnectionsCurrentPage, true);
      }
    }
    // else: nothing changed on the current page → no re-render, no animation.

    updatePageIndicator();

    const lcContainer = document.getElementById('information-display-live-connections');
    if (lcContainer) {
      lcContainer.style.visibility = config.showLiveConnectionsOverview ? 'visible' : 'hidden';
    }
    updateLiveConnectionsGridSrc();

    if (!isRemote && window.broadcastChannel) {
      window.broadcastChannel.postMessage({
        type: 'liveConnections',
        pages: liveConnectionsPages,
        warningText: liveConnectionsWarningText,
        isHalf: liveConnectionsIsHalf,
        pageInterval: liveConnectionsPageInterval,
        via: resolveViaForCurrentStation()
      });
    }

    startLiveConnectionsCycle(plan.pageInterval);

    maybeShowExitsEarly();
  }

  function hideLiveConnections(keepWindow = false) {
    liveConnectionsEpoch++;
    liveConnectionsVisible = false;
    liveConnectionsWindowActive = keepWindow;   // NEW — sets or clears window

    cancelServiceAnimation();
    if (liveConnectionsInitialDelayTimer) {
      clearTimeout(liveConnectionsInitialDelayTimer);
      liveConnectionsInitialDelayTimer = null;
    }
    liveConnectionsLastSignature = null;

    const lcContainer = document.getElementById('information-display-live-connections');
    if (lcContainer) lcContainer.style.visibility = 'hidden';

    setWarningDisplay('none');
    updateLiveConnectionsGridSrc();

    // Leaving the window: nuke everything. Staying in the window (empty pages):
    // leave the 2s refresh loop running so we keep polling.
    if (!keepWindow) {
      if (liveConnectionsTimer) { clearTimeout(liveConnectionsTimer); liveConnectionsTimer = null; }
      if (liveConnectionsRefreshInterval) { clearInterval(liveConnectionsRefreshInterval); liveConnectionsRefreshInterval = null; }
    }
    if (liveConnectionsInterval) { clearInterval(liveConnectionsInterval); liveConnectionsInterval = null; }
    liveConnectionsCycleInterval = null;
    if (liveConnectionsTimeInterval) { clearInterval(liveConnectionsTimeInterval); liveConnectionsTimeInterval = null; }

    liveConnectionsCurrentPage = 0;
    liveConnectionsStationId = null;
    liveConnectionsData = null;
    liveConnectionsPages = [];
    liveConnectionsServices = [];
    liveConnectionsWarningText = null;
    liveConnectionsIsHalf = false;
    liveConnectionsPageInterval = 7000;

    // NEW — window is still active (empty pages): fire the exits early-show now
    if (keepWindow) maybeShowExitsEarly();

    if (!isRemote && window.broadcastChannel) {
      window.broadcastChannel.postMessage({ type: 'hideLiveConnections', keepWindow });   // NEW — propagate
    }
  }

  function renderLiveConnectionsPage(pageIdx, animate = false, hideImmediately = false) {
    const lcContainer = document.getElementById('information-display-live-connections');
    if (!lcContainer) return;

    // Any pending roll-in animation belongs to the previous DOM and must go.
    cancelServiceAnimation();

    const page = liveConnectionsPages[pageIdx];

    // --- 1. Update visuals (grid image, header, warning text) first. ---
    if (!page) {
      setWarningDisplay('none');
      updateLiveConnectionsGridSrc();
    } else if (page.kind === 'warning') {
      setWarningDisplay('full');
      applyWarningTextToDom(liveConnectionsWarningText);
      updateLiveConnectionsGridSrc();
    } else {
      setWarningDisplay(liveConnectionsIsHalf ? 'half' : 'none');
      if (liveConnectionsIsHalf) applyWarningTextToDom(liveConnectionsWarningText);
      updateLiveConnectionsGridSrc();
    }

    // --- 2. Then swap the service rows in one batch. ---
    const oldRows = lcContainer.querySelectorAll('.information-display-live-connections-service');
    oldRows.forEach(el => el.remove());

    if (page && page.kind !== 'warning' && page.items && page.items.length > 0) {
      const html = buildLiveConnectionsPage(page.items);
      const indicatorRow = lcContainer.querySelector('.information-display-live-connections-page-indicator-row');
      if (indicatorRow) {
        indicatorRow.insertAdjacentHTML('afterend', html);
      } else {
        lcContainer.insertAdjacentHTML('beforeend', html);
      }
    }

    // --- 3. Initial-delay support: hide all freshly inserted rows. ---
    if (hideImmediately) {
      const rows = lcContainer.querySelectorAll('.information-display-live-connections-service');
      rows.forEach(row => { row.style.visibility = 'hidden'; });
    }

    // --- 4. Roll-in animation. ---
    if (animate) {
      startServiceAnimation();
    }
  }

  function updatePageIndicator() {
    const lcContainer = document.getElementById('information-display-live-connections');
    if (!lcContainer) return;
    const indicators = lcContainer.querySelectorAll('.information-display-live-connections-page-indicator');
    const totalPages = liveConnectionsPages.length;

    const isWarningPage = currentWarningDisplayMode() === 'full';
    const useDark = isWarningPage || config.appearance === 'dark';

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
      img.src = `visuals/interface/information_display/connections_overview/page_indicator_${filled}_${useDark ? 'dark' : 'light'}.svg`;
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
      express: { left: '29px', top: '20px', height: '44px', iconFolder: null },
      suburban: { left: '29px', top: '20px', height: '40px', iconFolder: 'suburban_lines' },
      subway: { left: '32px', top: '21px', height: '39px', iconFolder: 'subway_lines' },
      tram: { left: '31px', top: '22px', height: '40px', iconFolder: null },
      bus: { left: '29px', top: '20px', height: '44px', iconFolder: null },
      ferry: { left: '29px', top: '20px', height: '44px', iconFolder: null },
    };

    const tops = [580, 662, 746, 830, 914, 998];
    const layout = [];
    if (liveConnectionsIsHalf) {
      for (let i = 0; i < 6; i++) {
        layout.push({ left: '960px', top: tops[i] + 'px' });
      }
    } else {
      for (let i = 0; i < 12; i++) {
        layout.push({
          left: i < 6 ? '0px' : '960px',
          top: i < 6 ? tops[i] + 'px' : tops[i - 6] + 'px'
        });
      }
    }

    let html = '';
    pageServices.forEach((d, idx) => {
      if (idx >= 12) return;
      const product = d.line && d.line.product;
      const lineName = (d.line && d.line.name) || '';
      const dest = resolveDestinationText(d.direction || '');
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
                    <div class="information-display-live-connections-service-destination" style="font-size:${dest.fontSize}px;${dest.offsetY ? ` transform:translateY(${dest.offsetY}px);` : ''}">${dest.text}</div>
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
                    <div class="information-display-live-connections-service-destination" style="font-size:${dest.fontSize}px;${dest.offsetY ? ` transform:translateY(${dest.offsetY}px);` : ''}">${dest.text}</div>
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
                    <div class="information-display-live-connections-service-destination" style="font-size:${dest.fontSize}px;${dest.offsetY ? ` transform:translateY(${dest.offsetY}px);` : ''}">${dest.text}</div>
                    <div class="information-display-live-connections-service-time" data-when="${when}">${formatLiveMinutes(minutes)}</div>
                </div>`;
      } else if (product === 'express') {
        const ico = iconPositions.express;
        const lineInfo = resolveExpressLineName(lineName);
        html += `
                <div class="information-display-live-connections-service" style="left:${pos.left}; top:${pos.top};">
                    <div class="information-display-live-connections-service-regional-box" style="display:none;"></div>
                    <div class="information-display-live-connections-service-regional-line" style="display:none;"></div>
                    <img class="information-display-live-connections-service-icon" src="visuals/service_icons/fernverkehr.svg" style="left:${ico.left}; top:${ico.top}; height:${ico.height};">
                    <div class="information-display-live-connections-service-line" style="font-size:${lineInfo.fontSize}px; transform:translateY(${lineInfo.offsetY}px);">${lineInfo.text}</div>
                    <div class="information-display-live-connections-service-destination" style="font-size:${dest.fontSize}px;${dest.offsetY ? ` transform:translateY(${dest.offsetY}px);` : ''}">${dest.text}</div>
                    <div class="information-display-live-connections-service-time" data-when="${when}">${formatLiveMinutes(minutes)}</div>
                </div>`;
      } else if (product === 'ferry') {
        const ico = iconPositions.ferry;
        html += `
                <div class="information-display-live-connections-service" style="left:${pos.left}; top:${pos.top};">
                    <div class="information-display-live-connections-service-regional-box" style="display:none;"></div>
                    <div class="information-display-live-connections-service-regional-line" style="display:none;"></div>
                    <img class="information-display-live-connections-service-icon" src="visuals/service_icons/ferry.svg" style="left:${ico.left}; top:${ico.top}; height:${ico.height};">
                    <div class="information-display-live-connections-service-line">${lineName}</div>
                    <div class="information-display-live-connections-service-destination" style="font-size:${dest.fontSize}px;${dest.offsetY ? ` transform:translateY(${dest.offsetY}px);` : ''}">${dest.text}</div>
                    <div class="information-display-live-connections-service-time" data-when="${when}">${formatLiveMinutes(minutes)}</div>
                </div>`;
      }
    });
    return html;
  }

  function resolveDestinationText(rawText) {
    if (!rawText) return { text: '', fontSize: DESTINATION_FONT_SIZE_PX, offsetY: 0 };

    let text = String(rawText);

    // Permanent removals always apply, regardless of the final size.
    for (const token of DESTINATION_ALWAYS_REMOVE) {
      text = text.split(token).join('');
    }
    text = text.trim();

    const isDark = config && config.appearance === 'dark';
    const fontWeight = isDark ? 'normal' : 'bold';

    // Step 1 — base size (40px)
    let width = measureTextWidth(text, DESTINATION_FONT_SIZE_PX, 'TransitPro', fontWeight);
    if (width <= DESTINATION_MAX_WIDTH_PX) {
      return { text, fontSize: DESTINATION_FONT_SIZE_PX, offsetY: 0 };
    }

    // Step 2 — first reduction (36px); nudge down 2px to stay visually centred.
    width = measureTextWidth(text, 36, 'TransitPro', fontWeight);
    if (width <= DESTINATION_MAX_WIDTH_PX) {
      return { text, fontSize: 36, offsetY: 2 };
    }

    // Step 3 — second (last) reduction (32px); nudge down 4px.
    width = measureTextWidth(text, 32, 'TransitPro', fontWeight);
    if (width <= DESTINATION_MAX_WIDTH_PX) {
      return { text, fontSize: 32, offsetY: 4 };
    }

    // Step 4 — fallback: crop at the earliest separator. Rendered at 32px with
    // a 4px offset; may still overflow (same "return as-is" behaviour as before,
    // pending documentation of the real system).
    let earliestIdx = -1;
    for (const pattern of DESTINATION_CROP_PATTERNS) {
      const m = pattern.exec(text);
      if (m && (earliestIdx === -1 || m.index < earliestIdx)) {
        earliestIdx = m.index;
      }
    }
    if (earliestIdx > 0) {
      text = text.substring(0, earliestIdx).trim();
    }
    return { text, fontSize: 32, offsetY: 4 };
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

  // Returns the grid image src for the current page/mode, honouring warnings.
  function computeGridSrc() {
    const mode = currentWarningDisplayMode();
    if (mode === 'full') {
      return 'visuals/interface/information_display/connections_overview/warning/warning_full_default.svg';
    }
    if (mode === 'half') {
      const isDark = config.appearance === 'dark';
      return `visuals/interface/information_display/connections_overview/warning/warning_half_default_${isDark ? 'dark' : 'light'}.svg`;
    }
    return liveConnectionsGridSrc();
  }

  function updateLiveConnectionsGridSrc() {
    const gridImg = document.querySelector('.information-display-live-connections-grid');
    if (gridImg) gridImg.src = computeGridSrc();
  }

  function showLiveConnectionsRemote(payload) {
    const { pages, warningText, isHalf, pageInterval, restart, via } = payload || {};
    if (!pages || pages.length === 0) {
      hideLiveConnections(true);
      return;
    }

    // NEW — adopt the main page's via so early-show and arrival agree.
    // The keybind override still wins on arrival because it fires
    // shortBeforeStop *after* this in the same message loop.
    if (via === 'left' || via === 'right' || via === 'both') {
      currentVia = via;
    }

    liveConnectionsVisible = true;
    liveConnectionsWindowActive = true;

    liveConnectionsPages = pages;
    liveConnectionsWarningText = warningText || null;
    liveConnectionsIsHalf = !!isHalf;
    liveConnectionsPageInterval = pageInterval || 7000;

    if (restart) {
      // Config-driven (warning-mode change). Re-render immediately, no animation,
      // and don't re-trigger the initial delay — the pop-out already saw the station.
      if (liveConnectionsInitialDelayTimer) {
        clearTimeout(liveConnectionsInitialDelayTimer);
        liveConnectionsInitialDelayTimer = null;
      }
      liveConnectionsInitialDelayPlayedThisVisit = true;
      cancelServiceAnimation();
      liveConnectionsCurrentPage = 0;
      renderLiveConnectionsPage(0, false);
      liveConnectionsLastSignature = computePageSignature(0);
    } else {
      if (liveConnectionsCurrentPage >= liveConnectionsPages.length) {
        liveConnectionsCurrentPage = 0;
      }

      const newSignature = computePageSignature(liveConnectionsCurrentPage);
      const contentChanged = newSignature !== liveConnectionsLastSignature;
      liveConnectionsLastSignature = newSignature;

      const firstFrame = !liveConnectionsInitialDelayPlayedThisVisit;
      if (firstFrame) liveConnectionsInitialDelayPlayedThisVisit = true;

      if (firstFrame) {
        const firstPageIsWarning = liveConnectionsPages[0] && liveConnectionsPages[0].kind === 'warning';
        if (firstPageIsWarning) {
          renderLiveConnectionsPage(liveConnectionsCurrentPage, true);
        } else {
          renderLiveConnectionsPage(liveConnectionsCurrentPage, false, true);
          const pageCount = liveConnectionsPages.length;
          const delayMs = liveConnectionsIsHalf ? pageCount * 500 : pageCount * 1000;
          if (liveConnectionsInitialDelayTimer) clearTimeout(liveConnectionsInitialDelayTimer);
          liveConnectionsInitialDelayTimer = setTimeout(() => {
            liveConnectionsInitialDelayTimer = null;
            startServiceAnimation();
          }, delayMs);
        }
      } else if (contentChanged) {
        if (liveConnectionsInitialDelayTimer) {
          renderLiveConnectionsPage(liveConnectionsCurrentPage, false, true);
        } else {
          renderLiveConnectionsPage(liveConnectionsCurrentPage, true);
        }
      }
    }

    updatePageIndicator();

    const lcContainer = document.getElementById('information-display-live-connections');
    if (lcContainer) lcContainer.style.visibility = config.showLiveConnectionsOverview ? 'visible' : 'hidden';
    updateLiveConnectionsGridSrc();

    startLiveConnectionsCycle(liveConnectionsPageInterval);

    maybeShowExitsEarly();
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

  function measureTextWidth(text, fontSize, fontFamily = 'TransitPro', fontWeight = 'bold') {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}, sans-serif`;
    return ctx.measureText(text).width;
  }

  // Shift a direction-display page so its *visual* content is centred on the page.
  // Measures the actual painted bounds of the name text and each icon image,
  // which correctly accounts for icons that overflow their flex wrappers.
  function applyDirectionCentering(pageEl) {
    if (!pageEl) return;

    // Temporarily force-show pageEl and any hidden ancestors so we can measure.
    // (A hidden element returns zero rects, which would silently make the
    // correction do nothing.)
    const restore = [];
    let el = pageEl;
    while (el && el !== document.body) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') {
        restore.push({ el, display: el.style.display, visibility: el.style.visibility });
        el.style.setProperty('display', 'flex', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
      }
      el = el.parentElement;
    }

    // Reset any previous transform so we measure the untransformed layout.
    pageEl.style.transform = '';

    const nameEl = pageEl.querySelector('.direction-display-next-station-name');
    const connEl = pageEl.querySelector('.direction-display-next-station-connections');

    let visualLeft = null;
    let visualRight = null;

    if (nameEl) {
      const r = nameEl.getBoundingClientRect();
      if (r.width > 0 || r.height > 0) {
        visualLeft = r.left;
        visualRight = r.right;
      }
    }
    if (connEl) {
      // Use the <img> rects, not the wrapper rects. An <img> that overflows
      // its flex wrapper reports its real painted bounds via this API.
      connEl.querySelectorAll('img').forEach(img => {
        const r = img.getBoundingClientRect();
        if (visualLeft === null || r.left < visualLeft) visualLeft = r.left;
        if (visualRight === null || r.right > visualRight) visualRight = r.right;
      });
    }

    if (visualLeft !== null && visualRight !== null) {
      const pr = pageEl.getBoundingClientRect();
      const layoutCenter = pr.left + pr.width / 2;
      const visualCenter = (visualLeft + visualRight) / 2;
      const visualShift = layoutCenter - visualCenter;

      // getBoundingClientRect() reports *visual* pixels (post zoom/transform),
      // but translateX() on this element is interpreted in *local* pixels and
      // then scaled by any ancestor zoom/transform. Dividing by the effective
      // scale converts the visual shift back into the local pixel space so it
      // lands exactly where it should after scaling.
      const layoutWidth = pageEl.offsetWidth;
      const scale = (layoutWidth > 0 && pr.width > 0) ? (pr.width / layoutWidth) : 1;
      const localShift = visualShift / scale;

      if (Math.abs(localShift) > 0.25) {
        pageEl.style.transform = `translateX(${localShift}px)`;
      }
    }

    // Restore ancestors in reverse.
    for (let i = restore.length - 1; i >= 0; i--) {
      const a = restore[i];
      a.el.style.setProperty('display', a.display || '', 'important');
      a.el.style.setProperty('visibility', a.visibility || '', 'important');
    }
  }

  function directionWrapperWidth(service) {
    if (service.startsWith('U')) return 260;
    if (service.startsWith('S')) return 308;
    if (service === 'jelbi') return 154;
    if (service === 'bahn') return 211;
    return 173;   // fernverkehr, sbahn, tram, bus, flughafen
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
    // In dark mode, use the brighter grayscale variant for passed-line icons.
    const grayFolder = (config && config.appearance === 'dark') ? 'grayscale_dark' : 'grayscale';

    if (service.startsWith('U')) {
      if (size === 'simple') {
        return `<div style="width:52px; height:31px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/subway_lines/${service}.svg" style="width:52px; flex-shrink:0;"></div>`;
      } else if (size === 'extended' || size === 'grayscale') {
        const base = size === 'grayscale' ? `visuals/service_icons/${grayFolder}/subway_lines/` : 'visuals/service_icons/subway_lines/';
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
        const base = size === 'grayscale' ? `visuals/service_icons/${grayFolder}/suburban_lines/` : 'visuals/service_icons/suburban_lines/';
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
        grayscale: `<div style="width:17px; height:15px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/${grayFolder}/fernverkehr.svg" style="width:17px; flex-shrink:0;"></div>`,
        exits: `<div style="width:52px; height:52px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/fernverkehr.svg" style="width:58px; flex-shrink:0;"></div>`,
        direction: `<div style="width:155px; height:154px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/fernverkehr.svg" style="width:173px; flex-shrink:0;"></div>`
      },
      bahn: {
        simple: `<div style="width:30px; height:31px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/bahn.svg" style="width:42px; flex-shrink:0;"></div>`,
        extended: `<div style="width:21px; height:15px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/bahn.svg" style="width:21px; flex-shrink:0;"></div>`,
        grayscale: `<div style="width:21px; height:15px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/${grayFolder}/bahn.svg" style="width:21px; flex-shrink:0;"></div>`,
        exits: `<div style="width:53px; height:52px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/bahn.svg" style="width:71px; flex-shrink:0;"></div>`,
        direction: `<div style="width:155px; height:154px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/bahn.svg" style="width:211px; flex-shrink:0;"></div>`
      },
      sbahn: {
        simple: `<div style="width:31px; height:31px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/sbahn.svg" style="width:35px; flex-shrink:0;"></div>`,
        extended: `<div style="width:17px; height:15px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/sbahn.svg" style="width:17px; flex-shrink:0;"></div>`,
        grayscale: `<div style="width:17px; height:15px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/${grayFolder}/sbahn.svg" style="width:17px; flex-shrink:0;"></div>`,
        exits: `<div style="width:52px; height:52px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/sbahn.svg" style="width:58px; flex-shrink:0;"></div>`,
        direction: `<div style="width:155px; height:154px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/sbahn.svg" style="width:173px; flex-shrink:0;"></div>`
      },
      jelbi: {
        simple: `<div style="width:31px; height:31px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/jelbi.svg" style="width:31px; flex-shrink:0;"></div>`,
        extended: `<div style="width:15px; height:15px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/jelbi.svg" style="width:15px; flex-shrink:0;"></div>`,
        grayscale: `<div style="width:15px; height:15px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/${grayFolder}/jelbi.svg" style="width:15px; flex-shrink:0;"></div>`,
        exits: `<div style="width:52px; height:52px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/jelbi.svg" style="width:52px; flex-shrink:0;"></div>`,
        direction: `<div style="width:154px; height:154px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/jelbi.svg" style="width:154px; flex-shrink:0;"></div>`
      },
      flughafen: {
        simple: `<div style="width:31px; height:31px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/flughafen.svg" style="width:35px; flex-shrink:0;"></div>`,
        extended: `<div style="width:17px; height:15px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/flughafen.svg" style="width:17px; flex-shrink:0;"></div>`,
        grayscale: `<div style="width:17px; height:15px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/${grayFolder}/flughafen.svg" style="width:17px; flex-shrink:0;"></div>`,
        exits: `<div style="width:52px; height:52px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/flughafen.svg" style="width:58px; flex-shrink:0;"></div>`,
        direction: `<div style="width:155px; height:154px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/flughafen.svg" style="width:173px; flex-shrink:0;"></div>`
      },
      tram: { exits: `<div style="width:52px; height:52px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/tram.svg" style="width:52px; flex-shrink:0;"></div>` },
      bus: {
        simple: `<div style="width:31px; height:31px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/bus.svg" style="width:35px; flex-shrink:0;"></div>`,
        extended: `<div style="width:17px; height:15px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/bus.svg" style="width:17px; flex-shrink:0;"></div>`,
        grayscale: `<div style="width:17px; height:15px; display:flex; justify-content:center; align-items:center;"><img src="visuals/service_icons/${grayFolder}/bus.svg" style="width:17px; flex-shrink:0;"></div>`,
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
        appearance: 'dark',
        combinedLineDesign: 'alternative',
        warningTextMode: 'full'
      };
    }
    try {
      stationPositions = await loadJSON('data/extended_line_station_positions.json');
    } catch (e) {
      console.error('Station positions file missing');
    }

    warningTextMode = config.warningTextMode === 'half' ? 'half' : 'full';

    applyConfigUI();
    if (!isRemote) updateConfirmButtonState();
  }

  // ---------- keybind editor ----------
  async function loadKeybinds() {
    try {
      const r = await fetch('data/control_input/mapping.json?t=' + Date.now());
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      if (data && typeof data === 'object') Object.assign(currentKeybinds, data);
    } catch (e) {
      // defaults stand
    }
  }

  function isModifierOnly(e) {
    return ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'NumLock', 'ScrollLock', 'OS'].includes(e.key);
  }

  function normalizeKey(e) {
    const k = e.key;
    if (k.length === 1) return k.toLowerCase();
    const named = {
      ' ': 'space', 'Space': 'space',
      'Escape': 'escape', 'Esc': 'escape',
      'Enter': 'enter', 'Tab': 'tab',
      'Backspace': 'backspace', 'Delete': 'delete',
      'Insert': 'insert', 'Home': 'home', 'End': 'end',
      'PageUp': 'page up', 'PageDown': 'page down',
      'ArrowUp': 'up', 'ArrowDown': 'down',
      'ArrowLeft': 'left', 'ArrowRight': 'right',
      'PrintScreen': 'print screen',
      'Pause': 'pause', 'ContextMenu': 'menu'
    };
    if (named[k]) return named[k];
    if (/^F\d{1,2}$/.test(k)) return k.toLowerCase();
    return k.toLowerCase();
  }

  function openKeybindEditor() {
    if (keybindEditorActive) return;
    keybindEditorActive = true;
    keybindEditorIndex = 0;
    keybindEditorDraft = Object.assign({}, currentKeybinds);
    const overlay = document.getElementById('configuration-remote-control-keybinds');
    if (overlay) overlay.style.display = 'block';
    updateKeybindEditorUI();
    document.addEventListener('keydown', handleKeybindEditorKey, true);
  }

  function updateKeybindEditorUI() {
    const fn = KEYBIND_FUNCTIONS[keybindEditorIndex];
    if (!fn) return;
    const lang = (config && config.language) || 'de';
    const funcLabel = document.getElementById('lang-configuration-remote-control-keybinds-function');
    const counterLabel = document.getElementById('lang-configuration-remote-control-keybinds-counter');
    if (funcLabel) funcLabel.textContent = (lang === 'en') ? fn.labelEn : fn.labelDe;
    if (counterLabel) counterLabel.textContent = `${keybindEditorIndex + 1}/${KEYBIND_FUNCTIONS.length}`;
  }

  function handleKeybindEditorKey(e) {
    if (!keybindEditorActive) return;
    e.preventDefault();
    e.stopPropagation();
    if (isModifierOnly(e)) return;
    const key = normalizeKey(e);
    if (!key) return;
    const fn = KEYBIND_FUNCTIONS[keybindEditorIndex];
    if (!fn) return;
    keybindEditorDraft[fn.key] = key;
    keybindEditorIndex++;
    if (keybindEditorIndex >= KEYBIND_FUNCTIONS.length) {
      closeKeybindEditor(true);
    } else {
      updateKeybindEditorUI();
    }
  }

  function closeKeybindEditor(save) {
    document.removeEventListener('keydown', handleKeybindEditorKey, true);
    const overlay = document.getElementById('configuration-remote-control-keybinds');
    if (overlay) overlay.style.display = 'none';
    keybindEditorActive = false;

    if (save && keybindEditorDraft) {
      Object.assign(currentKeybinds, keybindEditorDraft);
      saveKeybindsToServer(currentKeybinds);
    }
    keybindEditorDraft = null;
    keybindEditorIndex = 0;
  }

  async function saveKeybindsToServer(kb) {
    try {
      const r = await fetch('/save-keybinds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kb)
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      console.log('[J/JK] keybinds saved:', kb);
    } catch (err) {
      console.warn('[J/JK] keybinds save failed:', err);
    }
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
    setActive($('#configWarningTextFullButton'), config.warningTextMode === 'full');
    setActive($('#configWarningTextHalfButton'), config.warningTextMode === 'half');

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
          combinedLineDesign: config.combinedLineDesign,
          warningTextMode: config.warningTextMode
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

      const btnWarningFull = $('#configWarningTextFullButton');
      const btnWarningHalf = $('#configWarningTextHalfButton');
      if (btnWarningFull) btnWarningFull.onclick = () => {
        config.warningTextMode = 'full';
        warningTextMode = 'full';
        applyConfigUI();
        restartLiveConnectionsIfVisible();
      };
      if (btnWarningHalf) btnWarningHalf.onclick = () => {
        config.warningTextMode = 'half';
        warningTextMode = 'half';
        applyConfigUI();
        restartLiveConnectionsIfVisible();
      };
    }



    const srcMap = {
      1: 'visuals/interface/information_display/fallback_layer/network_map.svg',
      2: 'visuals/interface/information_display/fallback_layer/bvg_logo.svg',
      3: 'visuals/interface/information_display/fallback_layer/feedback_j.svg',
      4: 'visuals/interface/information_display/fallback_layer/fahrinfo_app.svg'
    };
    infoFallbackLayer.src = srcMap[config.fallbackLayer] || '';

    // Refresh displays immediately when config changes
    if (routeActive) {
      computeRouteSegmentColors();
      updateAllDisplays();
      if (!isRemote && currentRouteIndex > 0 && (phase === 'arrival' || phase === 'doorReleased' || phase === 'closing')) {
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

    // Keep early-show exits in sync with the current appearance, phase, via,
    // display side and display position. Always re-populate while visible so
    // the position toggle takes effect immediately.
    if (phase === 'normal' && liveConnectionsWindowActive && !exitsTimedOut) {
      const via = resolveViaForCurrentStation();
      const wantShow = config.appearance === 'dark' && shouldShowExits(via);
      if (wantShow) {
        showExitsRemote();
      } else if (exitsContainer.style.visibility === 'visible') {
        hideExitsRemote();
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
    if (displayTransitionActive) showPureBackground();

    const lcEl = document.getElementById('information-display-live-connections');
    if (lcEl && lcEl.style.visibility === 'visible') {
      refreshLiveConnectionsPlan();
      renderLiveConnectionsPage(liveConnectionsCurrentPage, false);
      liveConnectionsLastSignature = computePageSignature(liveConnectionsCurrentPage);
      updatePageIndicator();
    }

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
                .dark-mode #line-extended-gaps.is-beyond { visibility: visible !important; }
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

    const btnStartEndSwap = $('#routeStartEndSwapButton');
    if (btnStartEndSwap) {
      btnStartEndSwap.addEventListener('click', () => {
        const temp = inputStart.value;
        inputStart.value = inputEnd.value;
        inputEnd.value = temp;
        // Re-validate both fields
        validateStation(inputStart, 'start');
        validateStation(inputEnd, 'end');
        updateConfirmButtonState();
      });
    }

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

    const btnRemoteSettings = document.getElementById('configRemoteControlSettingsButton');
    if (btnRemoteSettings) {
      btnRemoteSettings.onclick = null;
      btnRemoteSettings.addEventListener('click', openKeybindEditor);
    }
    const btnRemoteSettingsCancel = document.getElementById('configRemoteControlSettingsCancelButton');
    if (btnRemoteSettingsCancel) {
      btnRemoteSettingsCancel.onclick = null;
      btnRemoteSettingsCancel.addEventListener('click', () => closeKeybindEditor(false));
    }
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
          // Context-sensitive: first press = arrival (left side override),
          // second press (while in arrival) = door release, closing = reopen.
          remoteDoorAction('left');
          break;

        case 'arrivalRight':
          remoteDoorAction('right');
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
    if (!val) {
      inputLineData = null;
      inputLine.style.setProperty('border', '4px solid #d2d2d2', 'important');
      inputLine.dataset.invalid = '';
      updateConfirmButtonState();
      return;
    }

    const upper = val.toUpperCase();
    inputLine.value = upper;

    try {
      inputLineData = await loadLineJSON(upper);
      inputLineData.lineFile = inputLineData.filePath;
      inputLine.style.setProperty('border', '4px solid #d2d2d2', 'important');
      inputLine.dataset.invalid = '';
    } catch (e) {
      inputLineData = null;
      inputLine.style.setProperty('border', '4px solid #ec1c24', 'important');
      inputLine.dataset.invalid = 'true';
    }

    validateStation(inputStart, 'start');
    validateStation(inputEnd, 'end');
    validateStation(inputSkip, 'skip');
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
      const tokens = input.value.trim().split(/\s+/).filter(t => t);

      // Establish the effective route endpoints for the skip check.
      const startRaw = inputStart.value.trim().replace(/[.!]$/, '');
      const endRaw = inputEnd.value.trim().replace(/[.!]$/, '');
      const endpointSet = new Set();
      if (startRaw) endpointSet.add(startRaw.toUpperCase());
      if (endRaw) endpointSet.add(endRaw.toUpperCase());

      let allValid = true;
      let hasEndpoint = false;
      const correctedTokens = tokens.map(t => {
        const p = parseStationToken(t);
        if (!p) { allValid = false; return t; }
        const correct = findStationAbbrev(p.abbrev);
        if (!correct) { allValid = false; return t; }
        if (endpointSet.has(correct.toUpperCase())) hasEndpoint = true;
        return correct + p.marker;
      });

      if (!allValid || hasEndpoint) {
        inputSkip.style.setProperty('border', '4px solid #ec1c24', 'important');
        inputSkip.dataset.invalid = 'true';
        updateConfirmButtonState();
        return;
      }

      inputSkip.value = correctedTokens.join(' ');
      inputSkip.style.setProperty('border', '4px solid #d2d2d2', 'important');
      inputSkip.dataset.invalid = '';
      updateConfirmButtonState();
      return;
    }

    const p = parseStationToken(val);
    const bare = p ? p.abbrev : val;
    const marker = p ? p.marker : '';

    const exists = findStationAbbrev(bare);
    if (!exists) {
      input.style.setProperty('border', '4px solid #ec1c24', 'important');
      input.dataset.invalid = 'true';
      updateConfirmButtonState();
      return;
    }
    input.value = exists + marker;
    input.style.setProperty('border', '4px solid #d2d2d2', 'important');
    input.dataset.invalid = '';

    const otherInput = (type === 'start') ? inputEnd : inputStart;
    const otherRaw = otherInput.value.trim();
    if (otherRaw && inputLineData) {
      const op = parseStationToken(otherRaw);
      if (op) {
        const otherCorrect = findStationAbbrev(op.abbrev);
        if (otherCorrect) otherInput.value = otherCorrect + op.marker;
      }
    }

    const newStartVal = inputStart.value.trim().replace(/[.!]$/, '');
    const newEndVal = inputEnd.value.trim().replace(/[.!]$/, '');

    if (newStartVal && newEndVal && inputLineData) {
      if (newStartVal.toLowerCase() === newEndVal.toLowerCase()) {
        inputStart.style.setProperty('border', '4px solid #ec1c24', 'important');
        inputStart.dataset.invalid = 'true';
        inputEnd.style.setProperty('border', '4px solid #ec1c24', 'important');
        inputEnd.dataset.invalid = 'true';
        updateConfirmButtonState();
        return;
      }

      const possible = isRoutePossible(inputLineData.stations, newStartVal, newEndVal);
      if (!possible) {
        inputStart.style.setProperty('border', '4px solid #ec1c24', 'important');
        inputStart.dataset.invalid = 'true';
        inputEnd.style.setProperty('border', '4px solid #ec1c24', 'important');
        inputEnd.dataset.invalid = 'true';
        updateConfirmButtonState();
        return;
      }

      inputStart.style.setProperty('border', '4px solid #d2d2d2', 'important');
      inputStart.dataset.invalid = '';
      inputEnd.style.setProperty('border', '4px solid #d2d2d2', 'important');
      inputEnd.dataset.invalid = '';

      // Reject "!" on the end field when the end IS the true terminus.
      if (type === 'end' && inputEnd.value.trim().endsWith('!')) {
        const dirInfo = getDirectionInfo(inputLineData, newStartVal, newEndVal);
        if (dirInfo) {
          const trueTerminus = dirInfo.fullOrdered[dirInfo.fullOrdered.length - 1];
          if (trueTerminus && trueTerminus.abbrev.toLowerCase() === newEndVal.toLowerCase()) {
            inputEnd.style.setProperty('border', '4px solid #ec1c24', 'important');
            inputEnd.dataset.invalid = 'true';
          }
        }
      }
    }

    updateConfirmButtonState();
  }

  function findStationAbbrev(abbrev) {
    if (!inputLineData) return null;
    const stations = inputLineData.stations;
    const lower = abbrev.toLowerCase();
    const found = stations.find(s => s.abbrev.toLowerCase() === lower);
    return found ? found.abbrev : null;
  }

  function parseStationToken(token) {
    if (!token) return null;
    const m = String(token).trim().match(/^([A-Za-z]+)([.!]?)$/);
    if (!m) return null;
    return { abbrev: m[1], marker: m[2] };
  }

  function getDirectionInfo(lineData, startAbbrev, endAbbrev) {
    const startStation = lineData.stations.find(s => s.abbrev.toLowerCase() === startAbbrev.toLowerCase());
    const endStation = lineData.stations.find(s => s.abbrev.toLowerCase() === endAbbrev.toLowerCase());
    if (!startStation || !endStation) return null;
    const startIdx = lineData.stations.indexOf(startStation);
    const endIdx = lineData.stations.indexOf(endStation);
    const dir = startIdx < endIdx ? 1 : 2;
    const filtered = lineData.stations.filter(s =>
      s.directionPresence === 'both' || String(s.directionPresence) === String(dir)
    );
    const fullOrdered = dir === 1 ? [...filtered] : [...filtered].reverse();
    return { dir, fullOrdered };
  }

  function getStationDisplayName(station, lang) {
    if (!station) return '';
    if (lang === 'en' && station.abbrev === 'HBF' && station.additionalName) {
      return station.additionalName;
    }
    return station.name;
  }

  function buildRouteWarnings(endAbbrev, endMarker, segment, skippedSet, skipMarkers, fullOrdered) {
    const warnings = new Map();

    // --- Terminus-bus warning (attached to the terminus station) ---
    if (endMarker === '!') {
      const endPos = fullOrdered.findIndex(s => s.abbrev === endAbbrev);
      const trueTerminus = fullOrdered[fullOrdered.length - 1];
      if (endPos !== -1 && endPos < fullOrdered.length - 1 && trueTerminus) {
        warnings.set(endAbbrev, { kind: 'terminus-bus', trueTerminus });
      }
    }

    // Resolve each skip once so we can run two passes without recomputing.
    const skips = [];
    for (const [skipAbbrev, marker] of skipMarkers) {
      const segIdx = segment.findIndex(s => s.abbrev === skipAbbrev);
      if (segIdx === -1) continue;
      const kind = marker === '.' ? 'skip-return' : (marker === '!' ? 'skip-complete' : null);
      if (!kind) continue;
      skips.push({ segIdx, kind, skipped: segment[segIdx] });
    }

    const findBeforeIdx = (segIdx) => {
      let i = segIdx - 1;
      while (i >= 0 && skippedSet.has(segment[i].abbrev)) i--;
      return i;
    };
    const findAfterIdx = (segIdx) => {
      let i = segIdx + 1;
      while (i < segment.length && skippedSet.has(segment[i].abbrev)) i++;
      return i;
    };

    // Pass 1: "before" warnings — attached to the station just before the skip.
    // These take priority; the actionable "next stop is skipped" message.
    for (const { segIdx, kind, skipped } of skips) {
      const beforeIdx = findBeforeIdx(segIdx);
      if (beforeIdx < 0) continue;
      const before = segment[beforeIdx];
      if (warnings.has(before.abbrev)) continue;

      const afterIdx = findAfterIdx(segIdx);
      const following = afterIdx < segment.length ? segment[afterIdx] : segment[segment.length - 1];

      warnings.set(before.abbrev, { kind, skipped, following, position: 'before' });
    }

    // Pass 2: "after" warnings — attached to the station after the skip.
    // Only fill stations that don't already have a warning.
    for (const { segIdx, kind, skipped } of skips) {
      const afterIdx = findAfterIdx(segIdx);
      if (afterIdx >= segment.length) continue;
      const after = segment[afterIdx];
      if (warnings.has(after.abbrev)) continue;

      warnings.set(after.abbrev, { kind, skipped, following: after, position: 'after' });
    }

    return warnings;
  }

  function buildWarningText(warning) {
    if (!warning) return null;

    const nameDe = (station) => getStationDisplayName(station, 'de');
    const nameEn = (station) => getStationDisplayName(station, 'en');

    if (warning.kind === 'terminus-bus') {
      return {
        de: `Bauarbeiten: Diese Fahrt endet hier! Zur Weiterfahrt Richtung ${nameDe(warning.trueTerminus)} nutzen Sie bitte den Bus-Ersatzverkehr. Weitere Informationen erhalten Sie am Bahnhof.`,
        en: `Construction works: This train terminates here! To continue towards ${nameEn(warning.trueTerminus)}, please use the replacement bus service. More information available at the platform.`
      };
    }
    if (warning.kind === 'skip-return') {
      if (warning.position === 'after') {
        return {
          de: `Bauarbeiten: Dieser Zug hält nicht am Bahnhof ${nameDe(warning.skipped)}. Um diesen Bahnhof zu erreichen, steigen Sie bitte an diesem Halt aus und nutzen den Gegenzug.`,
          en: `Construction works: This train does not stop at station ${nameEn(warning.skipped)}. To reach this station, please alight at this stop and use the opposite train.`
        };
      }
      return {
        de: `Bauarbeiten: Dieser Zug hält nicht am Bahnhof ${nameDe(warning.skipped)}. Um diesen Bahnhof zu erreichen, nutzen Sie bitte am folgenden Halt den Gegenzug.`,
        en: `Construction works: This train does not stop at station ${nameEn(warning.skipped)}. To reach this station, please use the opposite train at the following stop.`
      };
    }
    if (warning.kind === 'skip-complete') {
      return {
        de: `Bauarbeiten: Dieser Zug hält nicht am Bahnhof ${nameDe(warning.skipped)}. Um diesen Bahnhof zu erreichen nutzen Sie bitte den Busverkehr. Weitere Informationen auf BVG.de`,
        en: `Construction works: This train does not stop at station ${nameEn(warning.skipped)}. To reach this station, please use the bus service. More information on BVG.de`
      };
    }
    return null;
  }

  if (!isRemote) {
    inputLine.addEventListener('blur', validateLine);
    inputStart.addEventListener('blur', () => { validateStation(inputStart, 'start'); validateStation(inputSkip, 'skip'); });
    inputEnd.addEventListener('blur', () => { validateStation(inputEnd, 'end'); validateStation(inputSkip, 'skip'); });
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

  async function confirmRoute(forceInstant = false) {
    if (displayTransitionActive) return;
    if (inputLine.style.borderColor === '#ec1c24' ||
      inputStart.style.borderColor === '#ec1c24' ||
      inputEnd.style.borderColor === '#ec1c24' ||
      inputSkip.style.borderColor === '#ec1c24') return;
    const line = inputLine.value.trim();
    const startRaw = inputStart.value.trim().replace(/[.!]$/, '');
    const endParsed = parseStationToken(inputEnd.value.trim());
    const end = endParsed ? endParsed.abbrev : inputEnd.value.trim();
    const endMarker = endParsed ? endParsed.marker : '';
    currentEndMarker = endMarker;

    if (!line || !startRaw || !end) return;

    try {
      lineData = await loadLineJSON(line);
    } catch (e) { return; }
    lineData.lineFile = lineData.filePath;

    const dirInfo = getDirectionInfo(lineData, startRaw, end);
    if (!dirInfo) return;
    direction = dirInfo.dir;
    const fullOrdered = dirInfo.fullOrdered;

    const possibleDirs = getPossibleDirections(lineData.stations, startRaw, end);
    if (!possibleDirs.includes(direction)) return;

    const dirPresenceFiltered = lineData.stations.filter(s =>
      s.directionPresence === 'both' || String(s.directionPresence) === String(direction));
    if (dirPresenceFiltered.length === 0) return;

    const startPos = fullOrdered.findIndex(s => s.abbrev === startRaw);
    const endPos = fullOrdered.findIndex(s => s.abbrev === end);
    if (startPos === -1 || endPos === -1 || startPos === endPos) return;

    const segment = fullOrdered.slice(startPos, endPos + 1);

    const skipTokens = inputSkip.value.trim().split(/\s+/).filter(t => t);
    const skippedSet = new Set();
    const skipMarkers = new Map();
    for (const t of skipTokens) {
      const p = parseStationToken(t);
      if (!p) continue;
      skippedSet.add(p.abbrev);
      if (p.marker) skipMarkers.set(p.abbrev, p.marker);
    }

    routeStations = segment.filter(s => !skippedSet.has(s.abbrev));
    if (!routeStations.find(s => s.abbrev === startRaw) ||
      !routeStations.find(s => s.abbrev === end)) return;

    currentRouteIndex = routeStations.findIndex(s => s.abbrev === startRaw);
    if (currentRouteIndex === -1) currentRouteIndex = 0;

    routeWarnings = buildRouteWarnings(end, endMarker, segment, skippedSet, skipMarkers, fullOrdered);

    const wasRouteActive = routeActive;
    const playTransition = !wasRouteActive && !forceInstant;

    if (playTransition) {
      displayTransitionActive = true;
      showPureBackground();
      // NOTE: no await here. The pure bg only covers the info display, so the
      // direction display updates below are visible immediately. We wait at
      // the end instead, right before hiding the overlay.
    }

    // Preserve open doors AND the closing state; otherwise reset to normal.
    if (phase !== 'doorReleased' && phase !== 'closing') {
      phase = 'normal';
    }
    routeActive = true;
    exitsTimedOut = false;
    resetExitsIconDelay();
    resetLiveConnectionsInitialDelay();
    clearRoutingTimers();

    // Tear down anything left over from the previous route's station.
    hideLiveConnections();
    simpleContainer.style.visibility = 'visible';
    $$('.information-display-line-simple-station-name').forEach(el => el.style.visibility = 'visible');
    $$('.information-display-line-simple-station-additional-name').forEach(el => el.style.visibility = 'visible');
    $$('.information-display-line-simple-station-connections-rows').forEach(el => el.style.visibility = '');
    exitsContainer.style.visibility = 'hidden';

    computeRouteSegmentColors();
    updateDoorButtonAvailability();
    updateUIForActiveRoute();
    updateAllDisplays();

    // Broadcast immediately so pop-outs update the direction display right
    // away, and can start their own info-display transition in sync.
    if (!isRemote && window.broadcastChannel && routeActive) {
      const route = getRouteState();
      if (route) {
        window.broadcastChannel.postMessage({
          type: 'routeUpdate',
          state: route,
          transition: playTransition ? 'fallbackToRoute' : null
        });
      }
    }

    if (playTransition) {
      await new Promise(r => setTimeout(r, FALLBACK_TO_ROUTE_DELAY_MS));
      hidePureBackground();
      displayTransitionActive = false;
    }
  }

  function resetRoute() {
    if (displayTransitionActive) return;

    const playTransition = routeActive;
    if (playTransition) {
      displayTransitionActive = true;
      showPureBackground();
    }

    performResetRoute();

    if (playTransition) {
      setTimeout(() => {
        hidePureBackground();
        displayTransitionActive = false;
      }, ROUTE_TO_FALLBACK_DELAY_MS);
    }
  }

  function performResetRoute() {
    const doorPhaseActive = (phase === 'doorReleased' || phase === 'closing');
    routeActive = false;
    lineData = null;
    routeStations = [];
    currentRouteIndex = 0;
    if (!doorPhaseActive) phase = 'normal';
    exitsTimedOut = false;
    currentVia = null;
    randomViaCache.clear();
    resetExitsIconDelay();
    resetLiveConnectionsInitialDelay();
    if (nextStationPage1) nextStationPage1.style.transform = '';
    if (nextStationPage2) nextStationPage2.style.transform = '';
    window._segmentColors = null; window._arrowColor = null;
    routeWarnings = new Map();
    currentEndMarker = '';
    hideLiveConnections();
    clearAllTimers(doorPhaseActive);

    // Information display – always present
    infoFallbackLayer.style.visibility = 'visible';
    simpleContainer.style.visibility = 'visible';
    exitsContainer.style.visibility = 'hidden';
    $$('.information-display-line-simple-station-name').forEach(el => el.style.visibility = 'visible');
    $$('.information-display-line-simple-station-additional-name').forEach(el => el.style.visibility = 'visible');
    $$('.information-display-line-simple-station-connections-rows').forEach(el => el.style.visibility = '');
    $$('.information-display-line-extended-station', extendedContainer).forEach(el => el.remove());
    const gapEl = document.getElementById('line-extended-gaps');
    if (gapEl) gapEl.classList.remove('is-beyond');
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
    if (doorLightbar && !doorPhaseActive) doorLightbar.style.visibility = 'hidden';

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
    if (displayTransitionActive) return;

    const playTransition = routeActive;
    if (playTransition) {
      displayTransitionActive = true;
      showPureBackground();
    }

    performResetRouteKeepInputs();

    if (playTransition) {
      setTimeout(() => {
        hidePureBackground();
        displayTransitionActive = false;
      }, ROUTE_TO_FALLBACK_DELAY_MS);
    }
  }

  function performResetRouteKeepInputs() {
    const doorPhaseActive = (phase === 'doorReleased' || phase === 'closing');
    routeActive = false;
    lineData = null;
    routeStations = [];
    currentRouteIndex = 0;
    if (!doorPhaseActive) phase = 'normal';
    exitsTimedOut = false;
    currentVia = null;
    randomViaCache.clear();
    resetExitsIconDelay();
    resetLiveConnectionsInitialDelay();
    if (nextStationPage1) nextStationPage1.style.transform = '';
    if (nextStationPage2) nextStationPage2.style.transform = '';
    window._segmentColors = null; window._arrowColor = null;
    routeWarnings = new Map();
    currentEndMarker = '';
    hideLiveConnections();
    clearAllTimers(doorPhaseActive);

    // Information display – always present
    infoFallbackLayer.style.visibility = 'visible';
    simpleContainer.style.visibility = 'visible';
    exitsContainer.style.visibility = 'hidden';
    $$('.information-display-line-simple-station-name').forEach(el => el.style.visibility = 'visible');
    $$('.information-display-line-simple-station-additional-name').forEach(el => el.style.visibility = 'visible');
    $$('.information-display-line-simple-station-connections-rows').forEach(el => el.style.visibility = '');
    $$('.information-display-line-extended-station', extendedContainer).forEach(el => el.remove());
    const gapEl = document.getElementById('line-extended-gaps');
    if (gapEl) gapEl.classList.remove('is-beyond');
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
    if (doorLightbar && !doorPhaseActive) doorLightbar.style.visibility = 'hidden';

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
    disableBtn(btnArrival);
    updateDoorButtonAvailability();
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
      enableBtn(inputLine); enableBtn(inputStart); enableBtn(inputEnd); enableBtn(inputSkip);
      enableBtn(btnConfirm);   // confirmation validity handled by updateConfirmButtonState
      enableBtn(btnReset);
      enableBtn(btnForward);
      enableBtn(btnBackward);
      disableBtn(btnArrival);
      updateDoorButtonAvailability();
      updateNavButtons();
      updatePositionButtonsLayout();
    }

    overlayImages.forEach(img => { img.src = currentOverlaySrc(); });
  }

  function updateNavButtons() {
    const movementOk = routeActive && (phase === 'normal' || phase === 'closing');
    if (movementOk && currentRouteIndex < routeStations.length - 1) enableBtn(btnForward); else disableBtn(btnForward);
    if (movementOk && currentRouteIndex > 0) enableBtn(btnBackward); else disableBtn(btnBackward);
  }

  // ---------- movement & phases ----------
  function moveForward() {
    if (!routeActive) return;

    // Remote mode: always advance immediately
    if (isRemote) {
      if (currentRouteIndex >= routeStations.length - 1) return;
      currentRouteIndex++;
      currentVia = null;
      resetExitsIconDelay();
      resetLiveConnectionsInitialDelay();
      hideLiveConnections();
      clearAllTimers();
      phase = 'normal';
      updateDoorButtonAvailability();
      // Immediately hide exits and show simple line overview
      simpleContainer.style.visibility = 'visible';
      $$('.information-display-line-simple-station-name').forEach(el => el.style.visibility = 'visible');
      $$('.information-display-line-simple-station-additional-name').forEach(el => el.style.visibility = 'visible');
      $$('.information-display-line-simple-station-connections-rows').forEach(el => el.style.visibility = '');
      exitsContainer.style.visibility = 'hidden';
      computeRouteSegmentColors();
      updateAllDisplays();
      triggerSimpleFlickerBurst();
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
    currentVia = null;
    resetExitsIconDelay();
    resetLiveConnectionsInitialDelay();
    hideLiveConnections();
    clearAllTimers();
    phase = 'normal';
    updateDoorButtonAvailability();
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
    updateNavButtons();
    triggerSimpleFlickerBurst();
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
    resetExitsIconDelay();
    resetLiveConnectionsInitialDelay();
    hideLiveConnections();
    clearAllTimers();
    phase = 'normal';
    updateDoorButtonAvailability();

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
    updateNavButtons();
  }

  function moveBackward() {
    if (!routeActive) return;

    // Remote mode: always retreat immediately
    if (isRemote) {
      if (currentRouteIndex <= 0) return;
      currentRouteIndex--;
      currentVia = null;
      resetExitsIconDelay();
      resetLiveConnectionsInitialDelay();
      hideLiveConnections();
      clearAllTimers();
      phase = 'normal';
      updateDoorButtonAvailability();
      // Immediately hide exits and show simple line overview
      simpleContainer.style.visibility = 'visible';
      $$('.information-display-line-simple-station-name').forEach(el => el.style.visibility = 'visible');
      $$('.information-display-line-simple-station-additional-name').forEach(el => el.style.visibility = 'visible');
      $$('.information-display-line-simple-station-connections-rows').forEach(el => el.style.visibility = '');
      exitsContainer.style.visibility = 'hidden';
      computeRouteSegmentColors();
      updateAllDisplays();
      triggerSimpleFlickerBurst();
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
    resetExitsIconDelay();
    resetLiveConnectionsInitialDelay();
    hideLiveConnections();
    clearAllTimers();
    phase = 'normal';
    updateDoorButtonAvailability();

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
    updateNavButtons();
    triggerSimpleFlickerBurst();
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
    triggerSimpleFlickerBurst();
    autoCloseConsumed = false;
    exitsTimedOut = false;

    const isTerminus = currentRouteIndex === routeStations.length - 1;
    const via = resolveViaForCurrentStation();
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
      updateDoorButtonAvailability();
      disableBtn(btnArrival);
      disableBtn(btnForward);
      disableBtn(btnBackward);
    }
  }

  function doorRelease() {
    const atOriginOrIdle = !routeActive || currentRouteIndex === 0;
    const allowed =
      phase === 'arrival' ||
      phase === 'closing' ||
      (phase === 'normal' && atOriginOrIdle);
    if (!allowed) return;

    // Stop any active closing blink cycle
    if (doorBlinkInterval) { clearInterval(doorBlinkInterval); doorBlinkInterval = null; }
    if (blinkStopTimer) { clearTimeout(blinkStopTimer); blinkStopTimer = null; }
    if (forwardPendingTimer) { clearTimeout(forwardPendingTimer); forwardPendingTimer = null; }

    phase = 'doorReleased';
    triggerSimpleFlickerBurst();

    if (doorLightbar) {
      doorLightbar.style.backgroundColor = '#58ff58';
      doorLightbar.style.visibility = 'visible';
      doorLightbar.style.opacity = '1';
    }

    if (!autoCloseConsumed) {
      if (doorAutoCloseTimer) clearTimeout(doorAutoCloseTimer);
      doorAutoCloseTimer = setTimeout(autoCloseExits, 10000);
      autoCloseConsumed = true;
    }

    if (!isRemote) {
      updateDoorButtonAvailability();
      updateNavButtons();   // disables forward/backward while doors open
    }
  }

  function autoCloseExits() {
    if (doorAutoCloseTimer) { clearTimeout(doorAutoCloseTimer); doorAutoCloseTimer = null; }
    // if (phase !== 'doorReleased' && phase !== 'closing') return;

    if (!routeActive) return;

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
    triggerSimpleFlickerBurst();
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

      updateDoorButtonAvailability();
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

    disableBtn(btnArrival);
    updateDoorButtonAvailability();
    updateNavButtons();
    updateAllDisplays();
  }

  // ---------- direction display ----------
  function showNextStationOnDirectionDisplay() {
    if (alternativeType() && alternativeType() !== 'suburban') return;
    if (!routeActive) return;
    const station = routeStations[currentRouteIndex];

    if (directionDisplayRevealTimer) {          // NEW
      clearTimeout(directionDisplayRevealTimer);
      directionDisplayRevealTimer = null;
    }

    const lineSimple = station.connectingServices.lineSimple;
    const allServices = [...(lineSimple[0] || []), ...(lineSimple[1] || [])];
    const figureHTML = '<div style="width:154px; height:176px; display:flex; justify-content:center; align-items:center;"><img src="visuals/interface/connections_figure.svg" style="width:99px; flex-shrink:0;"></div>';
    const iconsHTML = allServices.map(s => serviceIconHTML(s, 'direction')).join('');

    const nameWidth = measureTextWidth(station.name, 160) * 0.95;
    const iconTotalWidth = allServices.reduce((sum, s) => sum + directionWrapperWidth(s), 0) + (allServices.length > 0 ? 154 : 0);
    const totalWidth = nameWidth + iconTotalWidth + 40;

    if (pageLoopTimer) { clearInterval(pageLoopTimer); pageLoopTimer = null; }

    // Reset any previous centering shifts before rebuilding.
    nextStationPage1.style.transform = '';
    nextStationPage2.style.transform = '';

    const measureBlockWidth = (services) => {
      const html = `<div class="direction-display-next-station-connections">${figureHTML}${services.map(s => serviceIconHTML(s, 'direction')).join('')}</div>`;
      const tmp = document.createElement('div');
      tmp.style.position = 'absolute';
      tmp.style.visibility = 'hidden';
      tmp.style.display = 'flex';
      tmp.innerHTML = html;
      document.body.appendChild(tmp);
      // Use the <img> rects. scrollWidth only reports the layout width and
      // therefore misses the overflow that makes a row wider than it looks.
      const imgs = tmp.querySelectorAll('img');
      let left = Infinity, right = -Infinity;
      imgs.forEach(img => {
        const r = img.getBoundingClientRect();
        if (r.left < left) left = r.left;
        if (r.right > right) right = r.right;
      });
      const w = (right > left) ? (right - left) : tmp.scrollWidth;
      document.body.removeChild(tmp);
      return w;
    };

    if (totalWidth > 1600 && allServices.length > 0) {
      // ----- Multi-page layout (2 or 3 virtual pages) -----

      // Build station-name page (always page 1).
      nextStationPage1.innerHTML = `<div class="direction-display-next-station-name">${station.name}</div>`;
      const page1Name = nextStationPage1.querySelector('.direction-display-next-station-name');
      if (page1Name) {
        nextStationPage1.style.setProperty('display', 'flex', 'important');
        nextStationPage1.style.setProperty('visibility', 'visible', 'important');
        fitNameToPage(page1Name, nextStationPage1, 160);
      }

      const fullWidth = measureBlockWidth(allServices);
      const MAX_WIDTH = 1600;

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
          if (!showPage1) applyDirectionCentering(nextStationPage2);
        }, 10000);

      } else {
        // ---- 3 pages: name, icons part 1, icons part 2 ----
        const group1 = [];
        const group2 = [];
        let accumulated = [];
        let splitDone = false;

        for (const s of allServices) {
          if (splitDone) { group2.push(s); continue; }
          accumulated.push(s);
          if (measureBlockWidth(accumulated) > MAX_WIDTH) {
            accumulated.pop();
            group1.push(...accumulated);
            group2.push(s);
            splitDone = true;
          }
        }
        if (!splitDone) group1.push(...allServices);

        const buildIconPage = (services) =>
          `<div class="direction-display-next-station-connections">${figureHTML}${services.map(s => serviceIconHTML(s, 'direction')).join('')}</div>`;

        const page2HTML = buildIconPage(group1);
        const page3HTML = buildIconPage(group2);

        nextStationPage2.innerHTML = page2HTML;
        nextStationPage2.style.setProperty('display', 'none', 'important');
        nextStationPage2.style.setProperty('visibility', 'hidden', 'important');

        let currentPage = 1;
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
            applyDirectionCentering(nextStationPage2);
          } else {
            nextStationPage2.innerHTML = page3HTML;
            nextStationPage1.style.setProperty('display', 'none', 'important');
            nextStationPage1.style.setProperty('visibility', 'hidden', 'important');
            nextStationPage2.style.setProperty('display', 'flex', 'important');
            nextStationPage2.style.setProperty('visibility', 'visible', 'important');
            applyDirectionCentering(nextStationPage2);
          }
        }, 10000);
      }

    } else {
      // ----- Single-page layout -----
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

    // Final display toggles.
    nextStationDisplay.style.setProperty('display', 'flex', 'important');
    nextStationDisplay.style.setProperty('visibility', 'visible', 'important');
    nextStationDisplay.style.opacity = '0';
    dirDestination.style.setProperty('display', 'none', 'important');
    dirDestination.style.setProperty('visibility', 'hidden', 'important');
    exitSideContainer.style.setProperty('display', 'none', 'important');
    exitLeftArrow.style.visibility = 'hidden';
    exitRightArrow.style.visibility = 'hidden';

    // Now that everything is in its final shown/hidden state, run the centering
    // pass on each page (the helper temporarily reveals hidden pages to measure).
    applyDirectionCentering(nextStationPage1);
    applyDirectionCentering(nextStationPage2);

    // NEW — 50ms of emptiness, then reveal name + connection icons.
    directionDisplayRevealTimer = setTimeout(() => {
      directionDisplayRevealTimer = null;
      nextStationDisplay.style.opacity = '';
    }, 50);
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

    // NEW: mark the gap element so the dark-mode CSS can gate on it.
    const gapEl = document.getElementById('line-extended-gaps');
    if (gapEl) gapEl.classList.toggle('is-beyond', total > 18);

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
          fillColor = config.appearance === 'dark' ? '#000000' : '#f3f3f3';
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
          amenitiesHTML += '<img src="visuals/interface/information_display/exit_details/wc.svg" class="information-display-exits-connections-exitrow-item">';
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
        centerHTML += '<img src="visuals/interface/information_display/exit_details/wc.svg" class="information-display-exits-connections-exitrow-item">';
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

    // Cosmetic delay: on the first show of the exits overview for this station
    // visit, hide the three service-icon rows AND the left/right text-arrows
    // for 1–3 s to mimic the hardware loading its service icons. Subsequent
    // re-populations within the same visit (config toggles, dark/light switch,
    // etc.) are immediate.
    //
    // The center ↑ arrow is generated inline inside centerConRow.innerHTML, so
    // it's already covered by hiding centerConRow.
    if (!exitsIconsRevealedThisVisit) {
      leftConRow.style.visibility = 'hidden';
      centerConRow.style.visibility = 'hidden';
      rightConRow.style.visibility = 'hidden';
      leftArrow.style.visibility = 'hidden';
      rightArrow.style.visibility = 'hidden';

      if (!exitsIconsDelayTimer) {
        const delayMs = 1000 + Math.random() * 2000;
        exitsIconsDelayTimer = setTimeout(() => {
          exitsIconsDelayTimer = null;
          exitsIconsRevealedThisVisit = true;
          ['left', 'center', 'right'].forEach(side => {
            const row = $(`.information-display-exits-connections-connectionrow-${side}`);
            if (row) row.style.visibility = '';
          });
          const la = $('.information-display-exits-connections-connectionrow-left-arrow');
          const ra = $('.information-display-exits-connections-connectionrow-right-arrow');
          if (la) la.style.visibility = '';
          if (ra) ra.style.visibility = '';
        }, delayMs);
      }
    } else {
      leftConRow.style.visibility = '';
      centerConRow.style.visibility = '';
      rightConRow.style.visibility = '';
      leftArrow.style.visibility = '';
      rightArrow.style.visibility = '';
    }
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

  async function applyRemoteRoute(lineFile, start, end, skip, currentIdx, endMarker, transition) {
    const wasRouteActive = routeActive;
    const playTransition = (transition === 'fallbackToRoute') && !wasRouteActive;

    if (playTransition) {
      displayTransitionActive = true;
      showPureBackground();
    }

    try {
      lineData = await loadJSON(`data/lines/${lineFile}.json`);
    } catch (e) {
      if (playTransition) { hidePureBackground(); displayTransitionActive = false; }
      return;
    }

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

    // Parse the skip tokens with markers, same as confirmRoute.
    const skipTokens = (skip ? String(skip).trim() : '').split(/\s+/).filter(t => t);
    const skippedSet = new Set();
    const skipMarkers = new Map();
    for (const t of skipTokens) {
      const p = parseStationToken(t);
      if (!p) continue;
      skippedSet.add(p.abbrev);
      if (p.marker) skipMarkers.set(p.abbrev, p.marker);
    }

    routeStations = segment.filter(s => !skippedSet.has(s.abbrev));

    if (!routeStations.find(s => s.abbrev === start) ||
      !routeStations.find(s => s.abbrev === end)) return;

    // Rebuild warnings on the pop-out side too.
    routeWarnings = buildRouteWarnings(
      end, endMarker || '', segment, skippedSet, skipMarkers, fullOrdered
    );

    currentRouteIndex = Math.min(currentIdx, routeStations.length - 1);
    phase = 'normal';
    routeActive = true;
    currentVia = null;
    exitsTimedOut = false;
    resetExitsIconDelay();
    resetLiveConnectionsInitialDelay();
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
    triggerSimpleFlickerBurst();

    if (playTransition) {
      setTimeout(() => {
        hidePureBackground();
        displayTransitionActive = false;
      }, FALLBACK_TO_ROUTE_DELAY_MS);
    }
  }

  function getStateSnapshot() {
    const state = {
      line: routeActive ? lineData.line : null,
      lineFile: routeActive ? lineData.lineFile : null,
      start: routeActive ? routeStations[0].abbrev : null,
      end: routeActive ? routeStations[routeStations.length - 1].abbrev : null,
      skip: routeActive ? inputSkip.value : '',
      currentIdx: routeActive ? currentRouteIndex : 0,
      endMarker: currentEndMarker,
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
      endMarker: currentEndMarker,
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
      lineFile: lineData.lineFile || lineData.line,
      start: routeStations[0].abbrev,
      end: routeStations[routeStations.length - 1].abbrev,
      skip: inputSkip ? inputSkip.value : '',
      currentIdx: currentRouteIndex,
      endMarker: currentEndMarker
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
    config.warningTextMode = cfg.warningTextMode || 'full';
    warningTextMode = config.warningTextMode === 'half' ? 'half' : 'full';
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

    if (phase === 'normal' && liveConnectionsWindowActive && !exitsTimedOut) {
      const via = resolveViaForCurrentStation();
      const wantShow = appearance === 'dark' && shouldShowExits(via);
      if (wantShow) {
        showExitsRemote();
      } else if (exitsContainer.style.visibility === 'visible') {
        hideExitsRemote();
      }
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

    if (!isRemote) updateDoorButtonAvailability();

    await loadConfig();
    await loadKeybinds();

    try {
      localizationData = await loadJSON('data/localization/lang.json');
      applyLocalization();
    } catch (e) {
      console.error('Failed to load localization data:', e);
    }

    [
      'visuals/interface/information_display/connections_overview/warning/warning_full_default.svg',
      'visuals/interface/information_display/connections_overview/warning/warning_half_default_light.svg',
      'visuals/interface/information_display/connections_overview/warning/warning_half_default_dark.svg'
    ].forEach(u => { const img = new Image(); img.src = u; });

    startSimpleFlickerLoop();

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