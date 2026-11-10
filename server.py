"""
EasyTabManager Local Sync Server
Single source of truth: data/spaces.csv and data/bookmarks.csv
Provides REST endpoints to read and write directly to CSV files on disk.
When ready to push to GitHub, git status will show the updated CSV files!
"""

import http.server
import socketserver
import json
import csv
import os
import urllib.parse

PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
SPACES_CSV = os.path.join(DATA_DIR, 'spaces.csv')
BOOKMARKS_CSV = os.path.join(DATA_DIR, 'bookmarks.csv')

os.makedirs(DATA_DIR, exist_ok=True)

def read_csv(file_path):
    if not os.path.exists(file_path):
        return []
    with open(file_path, mode='r', encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)
        return list(reader)

def write_csv(file_path, fieldnames, rows):
    with open(file_path, mode='w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

class EasyTabManagerHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS and disable browser caching for dynamic CSV data
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        
        if parsed.path == '/api/status':
            self.send_json_response({'status': 'ok', 'mode': 'csv_server'})
            return

        if parsed.path == '/api/data':
            spaces = read_csv(SPACES_CSV)
            bookmarks = read_csv(BOOKMARKS_CSV)
            self.send_json_response({
                'spaces': spaces,
                'bookmarks': bookmarks
            })
            return

        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        
        if parsed.path == '/api/data':
            try:
                content_len = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_len)
                payload = json.loads(body.decode('utf-8'))
                
                spaces = payload.get('spaces', [])
                bookmarks = payload.get('bookmarks', [])

                # Write spaces.csv
                spaces_fieldnames = ['id', 'name', 'email', 'color', 'description']
                write_csv(SPACES_CSV, spaces_fieldnames, spaces)

                # Write bookmarks.csv
                bm_fieldnames = ['id', 'spaceId', 'name', 'url', 'createdAt', 'status']
                write_csv(BOOKMARKS_CSV, bm_fieldnames, bookmarks)

                self.send_json_response({'success': True, 'message': 'CSV files updated successfully'})
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': False, 'error': str(e)}).encode('utf-8'))
            return

        self.send_response(404)
        self.end_headers()

    def send_json_response(self, data):
        payload = json.dumps(data).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

if __name__ == '__main__':
    os.chdir(BASE_DIR)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), EasyTabManagerHandler) as httpd:
        print(f"============================================================")
        print(f" EasyTabManager CSV Server running at: http://localhost:{PORT}")
        print(f" Single Source of Truth: {DATA_DIR}")
        print(f" - spaces.csv")
        print(f" - bookmarks.csv")
        print(f"============================================================")
        print(f"Press Ctrl+C to stop the server.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")
