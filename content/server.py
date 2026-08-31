import asyncio
import threading
import websockets
import json
import urllib.parse
from http.server import SimpleHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn
import urllib.request
import os

# ---------- WebSocket relay ----------
connected_ws = set()

async def ws_handler(websocket):
    connected_ws.add(websocket)
    try:
        async for message in websocket:
            pass  # we don’t expect messages from the browser
    finally:
        connected_ws.remove(websocket)

async def ws_server():
    async with websockets.serve(ws_handler, "127.0.0.1", 7002):
        await asyncio.Future()  # run forever

def start_ws_server():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(ws_server())

# Start the WebSocket server in a daemon thread
ws_thread = threading.Thread(target=start_ws_server, daemon=True)
ws_thread.start()



class ThreadingServer(ThreadingMixIn, HTTPServer):
    pass

class Handler(SimpleHTTPRequestHandler):

    def do_POST(self):
        if self.path == '/save-config':
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b'Empty request')
                return
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body.decode('utf-8'))
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b'Invalid JSON')
                return

            # Ensure config directory exists
            os.makedirs('content/config', exist_ok=True)
            config_path = os.path.join('content', 'config', 'config.json')
            try:
                with open(config_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'ok'}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(f'Save failed: {e}'.encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'Not Found')
    
    def do_GET(self):
        # New: receive commands from hotkey script and relay to browsers
        if self.path.startswith('/command?'):
            qs = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(qs)
            cmd = params.get('cmd', [''])[0]
    
            if connected_ws:
                # broadcast the command to all WebSocket clients
                async def broadcast():
                    for ws in connected_ws:
                        await ws.send(cmd)
                asyncio.run(broadcast())

            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'ok')
            return

        # New endpoint: list available line files
        if self.path == '/list-lines':
            import os, json
            folder = 'content/data/lines'
            all_files = []
            for root, dirs, files in os.walk(folder):
                for f in files:
                    if f.endswith('.json'):
                        rel_path = os.path.relpath(os.path.join(root, f), folder).replace('\\', '/')
                        # remove .json extension
                        rel_path = rel_path[:-5]
                        all_files.append(rel_path)
            all_files = sorted(set(all_files))
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(all_files).encode('utf-8'))
            return

        super().do_GET()

server = ThreadingServer(("127.0.0.1", 7001), Handler)
print("Lokaler Server läuft auf URL: http://127.0.0.1:7001")
print("")
print("Um lokalen Server zu schließen, bitte dieses Fenster schließen.")
print("")
print("--------------------------------------------------------------------------------")
print("")
server.serve_forever()