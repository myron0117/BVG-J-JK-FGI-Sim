// js_directionDisplay.js – Standalone direction‑display pop‑out
(function () {
    'use strict';

    // ----- DOM references -----
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const dirDestination = $('.direction-display-destination');
    const dirDestName = $('.direction-display-destination-name');
    const dirDestLineIcon = $('.direction-display-destination-line-icon');
    const dirDestLineIconSub = $('.direction-display-destination-line-icon-suburban');
    const nextStationDisplay = $('.direction-display-next-station');
    const nextStationPage1 = $('.direction-display-next-station-page-1');
    const nextStationPage2 = $('.direction-display-next-station-page-2');
    const exitLeftArrow = $('.direction-display-next-station-exit-left');
    const exitRightArrow = $('.direction-display-next-station-exit-right');
    const exitSideContainer = $('.direction-display-next-station-exit-side');
    const dirFallback = $('.direction-display-fallback-layer');

    // ----- state -----
    let config = { appearance: 'light', displaySide: 1, displayPosition: 2 };
    let lineData = null;
    let routeStations = [];
    let direction = 1;
    let currentRouteIndex = 0;
    let routeActive = false;
    let currentVia = null;

    // Timers to mirror main page behaviour
    let gongTimer = null;          // 5 seconds after forward
    let autoCloseTimer = null;     // 10 seconds after door release
    let pageLoopTimer = null;      // page cycling for next-station

    // ----- helpers (copied from js_main.js) -----
    function measureTextWidth(text, fontSize, fontFamily = 'TransitPro') {
        const c = document.createElement('canvas');
        const ctx = c.getContext('2d');
        ctx.font = `bold ${fontSize}px ${fontFamily}, sans-serif`;
        return ctx.measureText(text).width;
    }

    function adjustStationNameScale(el) {
        el.style.marginLeft = ''; el.style.marginRight = '';
        const naturalWidth = el.scrollWidth;
        el.style.transform = 'scaleX(0.95)';
        const visualWidth = naturalWidth * 0.95;
        const margin = (naturalWidth - visualWidth) / 2;
        el.style.marginLeft = `-${margin}px`;
        el.style.marginRight = `-${margin}px`;
    }

    function fitNameToPage(nameEl, container, maxFontSize) {
        const text = nameEl.textContent;
        let fontSize = maxFontSize;
        const maxWidth = 1600;
        while (fontSize > 30 && measureTextWidth(text, fontSize) * 0.95 > maxWidth) {
            fontSize -= 2;
        }
        nameEl.style.fontSize = fontSize + 'px';
        adjustStationNameScale(nameEl);
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

    function setExitArrows(leftShow, rightShow) {
        if (exitLeftArrow) exitLeftArrow.style.visibility = leftShow ? 'visible' : 'hidden';
        if (exitRightArrow) exitRightArrow.style.visibility = rightShow ? 'visible' : 'hidden';
    }

    function clearTimers() {
        if (gongTimer) { clearTimeout(gongTimer); gongTimer = null; }
        if (autoCloseTimer) { clearTimeout(autoCloseTimer); autoCloseTimer = null; }
        if (pageLoopTimer) { clearInterval(pageLoopTimer); pageLoopTimer = null; }
    }

    // Full service icon HTML (direction size only)
    function serviceIconHTML(service, size) {
        if (service.startsWith('U')) {
            if (size === 'direction') return `<div style="width:260px;height:154px;display:flex;justify-content:center;align-items:center;"><img src="visuals/service_icons/subway_lines/${service}.svg" style="width:260px;"></div>`;
            return '';
        }
        if (service.startsWith('S')) {
            if (size === 'direction') return `<div style="width:280px;height:154px;display:flex;justify-content:center;align-items:center;"><img src="visuals/service_icons/suburban_lines/${service}.svg" style="width:308px;"></div>`;
            return '';
        }
        const map = {
            fernverkehr: { direction: `<div style="width:155px;height:154px;display:flex;justify-content:center;align-items:center;"><img src="visuals/service_icons/fernverkehr.svg" style="width:173px;"></div>` },
            bahn: { direction: `<div style="width:155px;height:154px;display:flex;justify-content:center;align-items:center;"><img src="visuals/service_icons/bahn.svg" style="width:211px;"></div>` },
            sbahn: { direction: `<div style="width:155px;height:154px;display:flex;justify-content:center;align-items:center;"><img src="visuals/service_icons/sbahn.svg" style="width:173px;"></div>` },
            tram: { direction: `<div style="width:155px;height:154px;display:flex;justify-content:center;align-items:center;"><img src="visuals/service_icons/tram.svg" style="width:173px;"></div>` },
            bus: { direction: `<div style="width:155px;height:154px;display:flex;justify-content:center;align-items:center;"><img src="visuals/service_icons/bus.svg" style="width:173px;"></div>` },
            jelbi: { direction: `<div style="width:154px;height:154px;display:flex;justify-content:center;align-items:center;"><img src="visuals/service_icons/jelbi.svg" style="width:154px;"></div>` },
            flughafen: { direction: `<div style="width:155px;height:154px;display:flex;justify-content:center;align-items:center;"><img src="visuals/service_icons/flughafen.svg" style="width:173px;"></div>` }
        };
        if (map[service] && map[service][size]) return map[service][size];
        return '';
    }

    // ----- Display update functions -----
    function updateDirectionDisplay() {
        if (!routeActive) {
            if (dirFallback) dirFallback.style.visibility = 'visible';
            if (dirDestination) {
                dirDestination.style.setProperty('display', 'none', 'important');
                dirDestination.style.setProperty('visibility', 'hidden', 'important');
            }
            if (dirDestLineIcon) {
                dirDestLineIcon.style.visibility = 'hidden';
                dirDestLineIcon.src = '';
            }
            if (dirDestLineIconSub) {
                dirDestLineIconSub.style.visibility = 'hidden';
                dirDestLineIconSub.src = '';
            }
            if (dirDestName) dirDestName.textContent = '';
            hideNextStationInternal();
            setExitArrows(false, false);
            if (exitSideContainer) exitSideContainer.style.display = 'none';
            return;
        }

        const isSuburban = lineData && lineData.alternative === 'suburban';
        const isAlternative = lineData && lineData.alternative;

        if (isAlternative && !isSuburban) {
            if (dirFallback) dirFallback.style.visibility = 'visible';
            if (dirDestination) { dirDestination.style.display = 'none'; }
            hideNextStationInternal();
            return;
        }

        if (dirFallback) dirFallback.style.visibility = 'hidden';
        if (dirDestination) {
            dirDestination.style.display = 'block';
            dirDestination.style.visibility = 'visible';
        }

        if (dirDestName) {
            dirDestName.textContent = routeStations[routeStations.length - 1].name;
            fitDestinationText();
        }

        if (dirDestLineIcon) {
            if (isSuburban) {
                dirDestLineIcon.style.visibility = 'hidden';
                if (dirDestLineIconSub) {
                    dirDestLineIconSub.src = `visuals/service_icons/suburban_lines/${lineData.line}.svg`;
                    dirDestLineIconSub.style.visibility = 'visible';
                }
            } else {
                dirDestLineIcon.src = `visuals/service_icons/subway_lines/${lineData.line}.svg`;
                dirDestLineIcon.style.visibility = 'visible';
                if (dirDestLineIconSub) dirDestLineIconSub.style.visibility = 'hidden';
            }
        }
    }

    // Full next‑station display (copied from js_main.js)
    function showNextStation() {
        if (!routeActive) return;
        const station = routeStations[currentRouteIndex];
        if (!station) return;

        const lineSimple = station.connectingServices?.lineSimple;
        const allServices = lineSimple ? [...(lineSimple[0] || []), ...(lineSimple[1] || [])] : [];
        const figureHTML = '<div style="width:154px;height:176px;display:flex;justify-content:center;align-items:center;"><img src="visuals/interface/connections_figure.svg" style="width:99px;"></div>';
        const iconsHTML = allServices.map(s => serviceIconHTML(s, 'direction')).join('');

        clearTimers();   // clear any pending page loop

        const nameWidth = measureTextWidth(station.name, 160) * 0.95;
        const iconTotalWidth = allServices.reduce((sum, s) => sum + (s.startsWith('U') ? 260 : 155), 0) + (allServices.length > 0 ? 154 : 0);
        const totalWidth = nameWidth + iconTotalWidth + 40;

        if (totalWidth > 1600 && allServices.length > 0) {
            const measureBlockWidth = (services) => {
                const html = `<div class="direction-display-next-station-connections">${figureHTML}${services.map(s => serviceIconHTML(s, 'direction')).join('')}</div>`;
                const tmp = document.createElement('div');
                tmp.style.position = 'absolute'; tmp.style.visibility = 'hidden'; tmp.style.display = 'flex';
                tmp.innerHTML = html;
                document.body.appendChild(tmp);
                const w = tmp.scrollWidth;
                document.body.removeChild(tmp);
                return w;
            };

            const page1HTML = `<div class="direction-display-next-station-name">${station.name}</div>`;
            nextStationPage1.innerHTML = page1HTML;
            const page1Name = nextStationPage1.querySelector('.direction-display-next-station-name');
            if (page1Name) {
                nextStationPage1.style.setProperty('display', 'flex', 'important');
                nextStationPage1.style.setProperty('visibility', 'visible', 'important');
                fitNameToPage(page1Name, nextStationPage1, 160);
            }

            const fullWidth = measureBlockWidth(allServices);
            const MAX_WIDTH = 1600;

            if (fullWidth <= MAX_WIDTH) {
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
                const group1 = [], group2 = [];
                let accumulated = [], splitDone = false;
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
                const buildPage = (svcs) => `<div class="direction-display-next-station-connections">${figureHTML}${svcs.map(s => serviceIconHTML(s, 'direction')).join('')}</div>`;
                const page2HTML = buildPage(group1);
                const page3HTML = buildPage(group2);
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
            if (allServices.length > 0) {
                nextStationPage1.innerHTML = `<div class="direction-display-next-station-name">${station.name}</div><div class="direction-display-next-station-connections">${figureHTML}${iconsHTML}</div>`;
            } else {
                nextStationPage1.innerHTML = `<div class="direction-display-next-station-name">${station.name}</div>`;
            }
            nextStationPage2.innerHTML = '';
            nextStationPage1.style.setProperty('display', 'flex', 'important');
            nextStationPage1.style.setProperty('visibility', 'visible', 'important');
            nextStationPage2.style.setProperty('display', 'none', 'important');
            nextStationPage2.style.setProperty('visibility', 'hidden', 'important');

            if (allServices.length === 0) {
                const soloName = nextStationPage1.querySelector('.direction-display-next-station-name');
                if (soloName) fitNameToPage(soloName, nextStationPage1, 160);
            }
        }

        nextStationDisplay.style.setProperty('display', 'flex', 'important');
        nextStationDisplay.style.setProperty('visibility', 'visible', 'important');
        dirDestination.style.setProperty('display', 'none', 'important');
        dirDestination.style.setProperty('visibility', 'hidden', 'important');

        // Exit arrows based on currentVia (set by arrival message)
        if (currentVia) {
            if (exitSideContainer) exitSideContainer.style.setProperty('display', 'block', 'important');
            setExitArrows(currentVia === 'left' || currentVia === 'both', currentVia === 'right' || currentVia === 'both');
        } else {
            setExitArrows(false, false);
            if (exitSideContainer) exitSideContainer.style.setProperty('display', 'none', 'important');
        }
    }

    function hideNextStationInternal() {
        if (pageLoopTimer) { clearInterval(pageLoopTimer); pageLoopTimer = null; }
        if (nextStationDisplay) {
            nextStationDisplay.style.setProperty('display', 'none', 'important');
            nextStationDisplay.style.setProperty('visibility', 'hidden', 'important');
        }
        if (dirDestination) {
            dirDestination.style.setProperty('display', 'block', 'important');
            dirDestination.style.setProperty('visibility', 'visible', 'important');
        }
        setExitArrows(false, false);
        if (exitSideContainer) exitSideContainer.style.setProperty('display', 'none', 'important');
    }

    // Public hide function that also clears auto-close timer
    function hideNextStation() {
        if (autoCloseTimer) { clearTimeout(autoCloseTimer); autoCloseTimer = null; }
        hideNextStationInternal();
    }

    // ----- Route handling -----
    async function applyRemoteRoute(lineFile, start, end, skip, currentIdx) {
        try {
            const resp = await fetch(`data/lines/${lineFile}.json?t=${Date.now()}`);
            lineData = await resp.json();
        } catch (e) { return; }

        const stations = lineData.stations;
        const startStation = stations.find(s => s.abbrev === start);
        const endStation = stations.find(s => s.abbrev === end);
        if (!startStation || !endStation) return;

        const startIdx = stations.indexOf(startStation);
        const endIdx = stations.indexOf(endStation);
        direction = startIdx < endIdx ? 1 : 2;

        const dirFiltered = stations.filter(s =>
            s.directionPresence === 'both' || String(s.directionPresence) === String(direction)
        );
        if (dirFiltered.length === 0) return;

        const ordered = direction === 1 ? [...dirFiltered] : [...dirFiltered].reverse();
        const startPos = ordered.findIndex(s => s.abbrev === start);
        const endPos = ordered.findIndex(s => s.abbrev === end);
        if (startPos === -1 || endPos === -1) return;
        const segment = ordered.slice(startPos, endPos + 1);

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
        if (!routeStations.find(s => s.abbrev === start) || !routeStations.find(s => s.abbrev === end)) return;

        currentRouteIndex = Math.min(currentIdx, routeStations.length - 1);
        routeActive = true;
        updateDirectionDisplay();
    }

    function moveForward() {
        if (!routeActive || currentRouteIndex >= routeStations.length - 1) return;
        currentRouteIndex++;
        currentVia = null;
        // Clear all timers (like main page does)
        clearTimers();
        // Hide next-station immediately
        hideNextStationInternal();
        updateDirectionDisplay();

        // Start 5‑second gong timer to show next station
        gongTimer = setTimeout(() => {
            showNextStation();
            gongTimer = null;
        }, 5000);
    }

    function moveBackward() {
        if (!routeActive || currentRouteIndex <= 0) return;
        currentRouteIndex--;
        clearTimers();
        hideNextStationInternal();
        updateDirectionDisplay();

        // Also start gong timer when going backward? The main page does not call showNextStationOnDirectionDisplay when moving backward? Let's check: In main page moveBackward, after moving backward, it does not call showNextStationOnDirectionDisplay. It only shows destination. So we should not start a gong timer. So only forward triggers the gong timer.
        // But what about the remote control backward? Not needed. We'll only do it for forward.
    }

    function resetDisplay() {
        routeActive = false;
        lineData = null;
        routeStations = [];
        currentRouteIndex = 0;
        currentVia = null;
        clearTimers();
        hideNextStationInternal();
        updateDirectionDisplay();
    }

    // ----- Appearance sync -----
    function applyAppearance(appearance) {
        config.appearance = appearance;
        document.body.classList.toggle('dark-mode', appearance === 'dark');
    }

    // ----- BroadcastChannel -----
    const ch = new BroadcastChannel('j-jk-fgi-broadcast');
    const urlParams = new URLSearchParams(location.search);
    const myId = urlParams.get('id') || 'unknown';
    document.title = 'J/JK FGI-Popout - ID: ' + myId;

    ch.onmessage = (e) => {
        handleMessage(e.data);
    };

    function handleMessage(msg) {
        if (msg.type === 'initialState' && msg.id === myId) {
            const s = msg.state;
            if (s.config) {
                config = { ...config, ...s.config };
                applyAppearance(config.appearance);
            }
            if (s.line) {
                applyRemoteRoute(s.lineFile || s.line, s.start, s.end, s.skip, s.currentIdx);
            }
        } else if (msg.type === 'routeUpdate') {
            const s = msg.state;
            if (s && s.line) {
                applyRemoteRoute(s.lineFile || s.line, s.start, s.end, s.skip, s.currentIdx);
            } else {
                resetDisplay();
            }
        } else if (msg.type === 'forward') {
            moveForward();
        } else if (msg.type === 'forwardNoTimer') {
            // Silent forward: no gong timer, no next-station preview after 5s
            if (routeActive && currentRouteIndex < routeStations.length - 1) {
                currentRouteIndex++;
                clearTimers();
                hideNextStation();
                updateDirectionDisplay();
            }
        } else if (msg.type === 'backward') {
            moveBackward();
        } else if (msg.type === 'arrival') {
            if (msg.via) currentVia = msg.via;
            // The next-station display should already be visible (gong timer already fired).
            // Just update exit arrows if needed.
            if (nextStationDisplay && nextStationDisplay.style.visibility !== 'hidden') {
                if (exitSideContainer) exitSideContainer.style.setProperty('display', 'block', 'important');
                setExitArrows(currentVia === 'left' || currentVia === 'both', currentVia === 'right' || currentVia === 'both');
            } else {
                // If for some reason next-station isn't visible yet, show it now.
                showNextStation();
            }
        } else if (msg.type === 'doorRelease') {
            // Start 10‑second auto‑close timer (direction display returns to destination after timeout)
            if (autoCloseTimer) clearTimeout(autoCloseTimer);
            autoCloseTimer = setTimeout(() => {
                hideNextStationInternal();
                autoCloseTimer = null;
            }, 10000);
        } else if (msg.type === 'doorLock') {
            // Do nothing – direction display remains unchanged until forward or auto‑close
        } else if (msg.type === 'removeScript') {
            resetDisplay();
        } else if (msg.type === 'appearanceChange') {
            applyAppearance(msg.appearance);
        }
    }

    // Request initial state
    ch.postMessage({ type: 'requestState', id: myId });
})();