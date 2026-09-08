#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Determine the project root.
# If this script is inside content/, the root is one level up.
if [ -d "$SCRIPT_DIR/content" ]; then
    PROJECT_ROOT="$SCRIPT_DIR"
else
    PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
fi

cd "$PROJECT_ROOT"



echo Baureihe J/JK FGI-Simulator
echo
echo ----------------------------------------------------------------------------------------------------
echo
echo Abhängigkeiten werden überprüft...                Verifying dependencies...
echo

# --- Detect Python ---
if command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD="python3"
elif command -v python >/dev/null 2>&1; then
    PYTHON_CMD="python"
else
    echo Python nicht gefunden, oder eine veralterte       Python not found, or an older version is installed.
    echo Version ist installiert. Bitte installiere        Please install at least Python 3 to continue.
    echo mindestens Python 3 um fortzufahren.
    exit 1
fi
echo Python gefunden.                                  Python found.
echo

# --- Detect Node ---
if ! command -v node >/dev/null 2>&1; then
    echo Node.js wird für die Live-Anschlüsse benötigt.    Node.js is required for the live connections.
    echo Bitte installieren und dann erneut ausführen.     Please install and then try again.
    exit 1
fi

echo Node.js gefunden.                                 Node.js found.
echo

# --- Install Python dependencies if missing ---
if ! $PYTHON_CMD -c "import keyboard, requests, websockets" >/dev/null 2>&1; then
    $PYTHON_CMD -m pip install --upgrade pip
    $PYTHON_CMD -m pip install keyboard requests websockets
fi

echo
echo
echo
echo ----------------------------------------------------------------------------------------------------
echo
echo Simulator wird gestartet...                       Simulator is starting...
echo
echo
echo

# --- Start bvg-rest ---
(
    cd "content/bvg-rest-6.0.2"
    PORT=7003 node . >/tmp/jjk_bvg-rest.log 2>&1 &
    echo $! > /tmp/jjk_bvg-rest.pid
)
echo 'bvg-rest-6.0.2' für Live-Anschlüsse gestartet.   Launched 'bvg-rest-6.0.2' for live connections.
echo

# --- Start Python server ---
$PYTHON_CMD content/server.py >/tmp/jjk_server.log 2>&1 &
echo $! > /tmp/jjk_server.pid
echo Lokaler Python-Server gestartet.                  Launched local Python server.
echo

sleep 1

# --- Start hotkey control (optional) ---
if [ -f "content/control.py" ]; then
    $PYTHON_CMD content/control.py >/tmp/jjk_control.log 2>&1 &
    echo $! > /tmp/jjk_control.pid
    echo Tastatursteuerung verfügbar.                      Keyboard control available.
    echo.
fi

# --- Open browser ---
URL="http://127.0.0.1:7001/content/FahrgastinformationSimulator.html"
if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL"
    echo Simulator im Browser geöffnet.                    Opened Simulator in browser.
    echo
    echo ----------------------------------------------------------------------------------------------------
elif command -v open >/dev/null 2>&1; then
    open "$URL"
    echo Simulator im Browser geöffnet.                    Opened Simulator in browser.
    echo
    echo ----------------------------------------------------------------------------------------------------
else
    echo Bitte öffne folgenden Link in deinem Browser.     Please open the following link in your browser.
    echo $URL
    echo
    echo ----------------------------------------------------------------------------------------------------
fi

echo
echo Drücke eine Taste, um den Simulator zu beenden.   Press any key to shut down the Simulator.
read

# --- Stop ---
echo
echo (0/3) Beende 'bvg-rest-6.0.2'...                  (0/3) Shutting down 'bvg-rest-6.0.2'...
kill "$(cat /tmp/jjk_bvg-rest.pid)" 2>/dev/null || true
echo
echo (1/3) 'bvg-rest-6.0.2' wurde beendet.             (1/3) 'bvg-rest-6.0.2' was shut down.

echo
echo (1/3) Beende lokalen Python-Server...             (1/3) Shutting down local Python server...
kill "$(cat /tmp/jjk_server.pid)" 2>/dev/null || true
echo
echo (2/3) Lokaler Python-Server wurde beendet.        (2/3) Local Python server was shut down.



if [ -f /tmp/jjk_control.pid ]; then
    echo
    echo (2/3) Beende Tastatursteuerung...                 (2/3) Shutting down keyboard control...
    kill "$(cat /tmp/jjk_control.pid)" 2>/dev/null || true
    echo
    echo (3/3) Tastatursteuerung wurde beendet.            (3/3) Keyboard control was shut down.
fi

echo
echo ----------------------------------------------------------------------------------------------------
echo
echo Alle Module wurden beendet.                       All modules were shut down.
echo Dieses Fenster kann nun geschlossen werden.       This window may now be closed.