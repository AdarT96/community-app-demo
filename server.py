import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError


def load_env(path='.env'):
    if not os.path.exists(path):
        return
    with open(path, 'r', encoding='utf-8') as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, val = line.split('=', 1)
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = val


class AppHandler(SimpleHTTPRequestHandler):
    def _send_json(self, status, payload):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path != '/api/gemini':
            self._send_json(404, {'error': 'Not Found'})
            return

        api_key = os.environ.get('GEMINI_API_KEY', '')
        if not api_key:
            self._send_json(500, {'error': 'GEMINI_API_KEY is not configured on server'})
            return

        try:
            content_len = int(self.headers.get('Content-Length', '0'))
            raw = self.rfile.read(content_len) if content_len > 0 else b'{}'
            data = json.loads(raw.decode('utf-8'))
        except Exception:
            self._send_json(400, {'error': 'Invalid JSON body'})
            return

        query = data.get('query')
        system_prompt = data.get('systemPrompt', '')
        model = data.get('model', 'gemini-2.0-flash')

        if not query or not isinstance(query, str):
            self._send_json(400, {'error': 'Missing query'})
            return

        url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}'
        body = {
            'system_instruction': {'parts': [{'text': str(system_prompt)}]},
            'contents': [{'parts': [{'text': query}]}],
            'generationConfig': {'temperature': 0.3, 'maxOutputTokens': 600}
        }

        req = Request(
            url,
            data=json.dumps(body).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )

        try:
            with urlopen(req, timeout=30) as resp:
                gemini_data = json.loads(resp.read().decode('utf-8'))
                text = ''
                candidates = gemini_data.get('candidates') or []
                if candidates:
                    parts = ((candidates[0].get('content') or {}).get('parts') or [])
                    if parts:
                        text = parts[0].get('text', '')
                self._send_json(200, {'text': text})
        except HTTPError as e:
            try:
                err_payload = json.loads(e.read().decode('utf-8'))
                err_msg = (err_payload.get('error') or {}).get('message') or f'Gemini request failed ({e.code})'
            except Exception:
                err_msg = f'Gemini request failed ({e.code})'
            self._send_json(e.code, {'error': err_msg})
        except Exception as e:
            self._send_json(500, {'error': str(e)})


if __name__ == '__main__':
    load_env('.env')
    port = int(os.environ.get('PORT', '3000'))
    server = ThreadingHTTPServer(('0.0.0.0', port), AppHandler)
    print(f'Server running on http://localhost:{port}')
    server.serve_forever()
