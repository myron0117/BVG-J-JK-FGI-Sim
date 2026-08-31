@echo off
chcp 65001 >nul
title Baureihe J/JK FGI-Simulator - Launcher
cd /d "%~dp0"

echo Baureihe J/JK FGI-Simulator
echo.
echo ----------------------------------------------------------------------------------------------------
echo.
echo Simulator wird gestartet...                       Simulator is starting...
echo.
echo.
echo.

REM -------------------------------
REM BVG REST API starten (Port 7003)
REM -------------------------------
pushd "content\bvg-rest-6.0.2"
start "J/JK BVG REST API" /min cmd /c "title J/JK FGI-Sim - bvg-rest-6.0.2 && set PORT=7003 && node ."
echo 'bvg-rest-6.0.2' für Live-Anschlüsse gestartet.   Launched 'bvg-rest-6.0.2' for live connections.
echo.
popd

REM -------------------------------
REM Python-Server starten
REM -------------------------------
start "J/JK FGI-Sim - Lokaler Server / Local Server" /min cmd /c "python content/server.py"
echo Lokaler Python-Server gestartet.                  Launched local Python server.
echo.

timeout /t 1 >nul

REM -------------------------------
REM Browser öffnen
REM -------------------------------
start "" http://127.0.0.1:7001/content/FahrgastinformationSimulator.html
echo Simulator im Browser geöffnet.                    Opened Simulator in browser.
echo.

REM -------------------------------
REM Hotkey-Control starten
REM -------------------------------
echo Erwarte Admin-Berechtigung für Tastatursteuerung. Awaiting administrator permissions for keyboard control.
echo.

timeout /t 1 >nul
for /f "delims=" %%i in ('where python') do set "PYTHON_FULL=%%i"

if exist "content\control.py" (

    powershell -NoProfile -Command "try { Start-Process -FilePath '%PYTHON_FULL%' -ArgumentList 'content\control.py' -WorkingDirectory '%cd%' -Verb RunAs -WindowStyle Minimized | Out-Null; exit 0 } catch { exit 1 }"

    if errorlevel 1 (
        echo Abgelehnt. Tastatursteuerung nicht verfügbar.     Rejected. Keyboard control unavailable.
        echo.
        echo ----------------------------------------------------------------------------------------------------
    ) else (
        echo Akzeptiert. Tastatursteuerung verfügbar.          Accepted. Keyboard control available.
        echo.
        echo ----------------------------------------------------------------------------------------------------
    )
) else (
    echo.
)

REM Launcher bleibt offen, bis der Nutzer alles beenden möchte.
echo.
echo Drücke eine Taste, um den Simulator zu beenden.   Press any key to shut down the Simulator.
pause >nul

echo.
echo (0/3) Beende 'bvg-rest-6.0.2'...                  (0/3) Shutting down 'bvg-rest-6.0.2'...
taskkill /FI "WINDOWTITLE eq J/JK FGI-Sim - bvg-rest-6.0.2*" /T /F >nul 2>&1
echo.
echo (1/3) 'bvg-rest-6.0.2' wurde beendet.             (1/3) 'bvg-rest-6.0.2' was shut down.

echo.
echo (1/3) Beende lokalen Python-Server...             (1/3) Shutting down local Python server...
taskkill /FI "WINDOWTITLE eq J/JK FGI-Sim - Lokaler Server / Local Server*" /T /F >nul 2>&1
echo.
echo (2/3) Lokaler Python-Server wurde beendet.        (2/3) Local Python server was shut down.

echo.
echo (2/3) Beende Tastatursteuerung...                 (2/3) Shutting down keyboard control...
timeout /t 1 >nul
if exist "content\shutdown.kb" del "content\shutdown.kb"
echo > "content\shutdown.kb"
rem Optional fallback, but may fail silently
taskkill /FI "WINDOWTITLE eq J/JK FGI-Sim - Tastatursteuerung / Keyboard Control*" /T /F >nul 2>&1
echo.
echo (3/3) Tastatursteuerung wurde beendet.            (3/3) Keyboard control was shut down.

echo.
echo ----------------------------------------------------------------------------------------------------
echo.
echo Alle Module wurden beendet.                       All modules were shut down.
echo.
echo Fenster schließt sich in 5 Sekunden automatisch.  Window closes automatically in 5 seconds.
timeout /t 5 >nul
exit