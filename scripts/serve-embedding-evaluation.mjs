import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const root = process.cwd();
const allowed = new Set(['/tests/manual/embedding-evaluation.html', '/src/utils/cdn.js', '/src/constants.js']);
http.createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (!allowed.has(pathname)) {
        res.writeHead(404).end();
        return;
    }
    try {
        const text = await fs.readFile(path.join(root, pathname));
        res.setHeader('Content-Type', pathname.endsWith('.html') ? 'text/html' : 'text/javascript');
        res.end(text);
    } catch {
        res.writeHead(500).end();
    }
}).listen(8791, '127.0.0.1', () => console.log('Evaluation server listening on localhost:8791'));
