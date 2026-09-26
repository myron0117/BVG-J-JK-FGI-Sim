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

    function directionWrapperWidth(service) {
        if (service.startsWith('U')) return 260;
        if (service.startsWith('S')) return 280;
        if (service === 'jelbi') return 154;
        return 155;
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
            if (size === 'direction') return `<div style="width:260px;height:154px;display:flex;justify-content:center;align-items:center;"><img src="visuals/service_icons/subway_lines/${service}.svg" style="width:260px;flex-shrink:0;"></div>`;
            return '';
        }
        if (service.startsWith('S')) {
            if (size === 'direction') return `<div style="width:280px;height:154px;display:flex;justify-content:center;align-items:center;"><img src="visuals/service_icons/suburban_lines/${service}.svg" style="width:308px;flex-shrink:0;"></div>`;
            return '';
        }
        const map = {
            fernverkehr: { direction: `<div style="width:155px;height:154px;display:flex;justify-content:center;align-items:center;"><img src="visuals/service_icons/fernverkehr.svg" style="width:173px;flex-shrink:0;"></div>` },
            bahn: { direction: `<div style="width:155px;height:154px;display:flex;justify-content:center;align-items:center;"><img src="visuals/service_icons/bahn.svg" style="width:211px;flex-shrink:0;"></div>` },
            sbahn: { direction: `<div style="width:155px;height:154px;display:flex;justify-content:center;align-items:center;"><img src="visuals/service_icons/sbahn.svg" style="width:173px;flex-shrink:0;"></div>` },
            tram: { direction: `<div style="width:155px;height:154px;display:flex;justify-content:center;align-items:center;"><img src="visuals/service_icons/tram.svg" style="width:173px;flex-shrink:0;"></div>` },
            bus: { direction: `<div style="width:155px;height:154px;display:flex;justify-content:center;align-items:center;"><img src="visuals/service_icons/bus.svg" style="width:173px;flex-shrink:0;"></div>` },
            jelbi: { direction: `<div style="width:154px;height:154px;display:flex;justify-content:center;align-items:center;"><img src="visuals/service_icons/jelbi.svg" style="width:154px;flex-shrink:0;"></div>` },
            flughafen: { direction: `<div style="width:155px;height:154px;display:flex;justify-content:center;align-items:center;"><img src="visuals/service_icons/flughafen.svg" style="width:173px;flex-shrink:0;"></div>` }
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
        const isAlt = lineData && lineData.alternative;
        if (isAlt && isAlt !== 'suburban') return;
        if (!routeActive) return;
        const station = routeStations[currentRouteIndex];

        const lineSimple = station.connectingServices.lineSimple;
        const allServices = [...(lineSimple[0] || []), ...(lineSimple[1] || [])];
        const figureHTML = '<div style="width:154px;height:176px;display:flex;justify-content:center;align-items:center;"><img src="visuals/interface/connections_figure.svg" style="width:99px;flex-shrink:0;"></div>';
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
            const w = tmp.scrollWidth;
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
        dirDestination.style.setProperty('display', 'none', 'important');
        dirDestination.style.setProperty('visibility', 'hidden', 'important');
        if (currentVia) {
            if (exitSideContainer) exitSideContainer.style.setProperty('display', 'block', 'important');
            setExitArrows(currentVia === 'left' || currentVia === 'both',
                currentVia === 'right' || currentVia === 'both');
        } else {
            setExitArrows(false, false);
            if (exitSideContainer) exitSideContainer.style.setProperty('display', 'none', 'important');
        }

        applyDirectionCentering(nextStationPage1);
        applyDirectionCentering(nextStationPage2);
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
        hideNextStationInternal();
        if (nextStationPage1) { nextStationPage1.innerHTML = ''; nextStationPage1.style.transform = ''; }
        if (nextStationPage2) { nextStationPage2.innerHTML = ''; nextStationPage2.style.transform = ''; }
        currentVia = null;

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
        const skippedSet = new Set(skipRaw ? skipRaw.split(/\s+/) : []);
        routeStations = segment.filter(s => !skippedSet.has(s.abbrev));
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
        nextStationPage1.style.transform = '';
        nextStationPage2.style.transform = '';
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