import keyboard
import requests
import json
import time
import threading
import sys
import traceback
import os

try:
    # ---- configuration ----
    SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
    SENTINEL_FILE = os.path.join(SCRIPT_DIR, 'shutdown.kb')
    if os.name == 'nt':
        os.system("title J/JK FGI-Sim - Tastatursteuerung / Keyboard Control")
    MAPPING_FILE = os.path.join(SCRIPT_DIR, "data", "control_input", "mapping.json")
    BASE_URL = "http://127.0.0.1:7001"

    # ---- mapping-json action name → server command ----
    CMD_MAP = {
        "doorsLeft":        "arrivalLeft",
        "doorsRight":       "arrivalRight",
        "doorClosure":      "doorLock",
        "stopConfirmation": "doorRelease",
    }

    # ---- shared state ----
    mapping = {}
    mapping_mtime = 0
    mapping_lock = threading.Lock()

    forward_held = False
    forward_timer = None
    forward_lock = threading.Lock()

    # ---- commands ----
    def send_command(cmd):
        try:
            requests.get(f"{BASE_URL}/command?cmd={cmd}", timeout=0.5)
            print(f"Sent: {cmd}")
        except Exception as e:
            print(f"Error sending {cmd}: {e}")

    def start_forward_hold():
        global forward_held, forward_timer
        with forward_lock:
            if forward_held:
                return
            forward_held = True
            if forward_timer is not None:
                forward_timer.cancel()
            forward_timer = threading.Timer(3.0, lambda: send_command("forward"))
            forward_timer.start()

    def end_forward_hold():
        global forward_held, forward_timer
        with forward_lock:
            forward_held = False
            if forward_timer is not None:
                forward_timer.cancel()
                forward_timer = None

    # ---- mapping loader / watcher ----
    def load_mapping():
        global mapping, mapping_mtime
        try:
            with open(MAPPING_FILE, "r", encoding="utf-8") as f:
                new_map = json.load(f)
            with mapping_lock:
                mapping = new_map
            mapping_mtime = os.path.getmtime(MAPPING_FILE)
            print(f"[mapping] loaded: {mapping}")
        except FileNotFoundError:
            print(f"[mapping] waiting for {MAPPING_FILE} to appear...")
        except Exception as e:
            print(f"[mapping] load failed: {e}")

    def watch_mapping():
        while True:
            try:
                m = os.path.getmtime(MAPPING_FILE)
                if m != mapping_mtime:
                    print("[mapping] change detected")
                    load_mapping()
            except FileNotFoundError:
                pass
            except Exception as e:
                print(f"[mapping] watcher error: {e}")
            time.sleep(0.5)

    CODE_TO_SCAN = {
        "Insert":    82, "Delete":   83,
        "Home":      71, "End":      79,
        "PageUp":    73, "PageDown": 81,
        "ArrowUp":   72, "ArrowDown": 80,
        "ArrowLeft": 75, "ArrowRight": 77,
        "Escape":    1,  "Tab":      15,
        "Space":     57, "Enter":    28,
        "F1":  59, "F2":  60, "F3":  61, "F4":  62,
        "F5":  63, "F6":  64, "F7":  65, "F8":  66,
        "F9":  67, "F10": 68, "F11": 87, "F12": 88,
    }

    def key_to_action(name, scan_code):
        with mapping_lock:
            # 1) plain keys (letters, digits, punctuation) → match by name
            if name:
                for action, bound in mapping.items():
                    if bound == name:
                        return action
            # 2) special keys → match by physical scan code
            for action, bound in mapping.items():
                if isinstance(bound, str) and bound.startswith("code:"):
                    expected = CODE_TO_SCAN.get(bound[5:])
                    if expected is not None and expected == scan_code:
                        return action
        return None
    
    def on_key_event(e):
        action = key_to_action(e.name, e.scan_code)
        if action is None:
            return
        # ... existing forward-hold / send_command logic unchanged

        if action == "forward":
            if e.event_type == keyboard.KEY_DOWN:
                start_forward_hold()
            elif e.event_type == keyboard.KEY_UP:
                end_forward_hold()
            return

        if e.event_type == keyboard.KEY_DOWN:
            server_cmd = CMD_MAP.get(action, action)
            send_command(server_cmd)

    # ---- startup ----
    print(f"Mapping file: {MAPPING_FILE}")
    load_mapping()
    threading.Thread(target=watch_mapping, daemon=True).start()

    keyboard.hook(on_key_event)

    print("Hotkey listener active. Press Ctrl+C to stop.")
    try:
        while True:
            time.sleep(1)
            if os.path.exists(SENTINEL_FILE):
                os.remove(SENTINEL_FILE)
                break
    except KeyboardInterrupt:
        pass

except Exception:
    traceback.print_exc()
    input("An error occurred. Press Enter to exit...")