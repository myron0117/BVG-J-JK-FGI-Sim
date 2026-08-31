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
    os.system("title J/JK FGI-Sim - Tastatursteuerung / Keyboard Control")
    MAPPING_FILE = os.path.join(SCRIPT_DIR, "data", "control_input", "mapping.json")
    BASE_URL = "http://127.0.0.1:7001"

    print(f"Loading mapping from: {MAPPING_FILE}")
    with open(MAPPING_FILE, "r") as f:
        mapping = json.load(f)
    print("Mapping loaded successfully.")

    # ---- state ----
    forward_held = False
    forward_timer = None

    def send_command(cmd):
        try:
            requests.get(f"{BASE_URL}/command?cmd={cmd}", timeout=0.5)
            print(f"Sent: {cmd}")
        except Exception as e:
            print(f"Error sending {cmd}: {e}")

    def start_forward_timer():
        global forward_timer
        cancel_forward_timer()
        forward_timer = threading.Timer(3.0, lambda: send_command("forward"))
        forward_timer.start()

    def cancel_forward_timer():
        global forward_timer
        if forward_timer is not None:
            forward_timer.cancel()
            forward_timer = None

    # ---- hotkey callbacks for forward (hold-to-trigger) ----
    def on_forward_press(e):
        global forward_held
        if not forward_held:
            forward_held = True
            cancel_forward_timer()
            start_forward_timer()

    def on_forward_release(e):
        global forward_held
        forward_held = False
        cancel_forward_timer()

    # ---- register hotkeys from mapping.json ----
    cmd_map = {
        "doorsLeft": "arrivalLeft",
        "doorsRight": "arrivalRight",
        "stopConfirmation": "doorRelease",
        "doorClosure": "doorLock"
    }

    for action, key in mapping.items():
        if action == "forward":
            keyboard.on_press_key(key, on_forward_press, suppress=False)
            keyboard.on_release_key(key, on_forward_release, suppress=False)
        else:
            server_cmd = cmd_map.get(action, action)
            # Use a default argument to capture the current value of server_cmd
            keyboard.add_hotkey(key, lambda c=server_cmd: send_command(c))

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