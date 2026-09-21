import http from 'node:http';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const PORT = Number(process.env.PORT || 8080);

let serviceLogs = [];
function log(msg) {
  const entry = `[${new Date().toISOString()}] ${msg}`;
  console.log(entry);
  serviceLogs.push(entry);
  if (serviceLogs.length > 200) serviceLogs.shift();
}

function scanBufferWithClamscan(buffer) {
  const tmpPath = `/tmp/scan_${Date.now()}_${Math.random().toString(36).substring(2)}.tmp`;
  fs.writeFileSync(tmpPath, buffer);
  try {
    const stdout = execSync(`clamscan -d /var/lib/clamav --no-summary "${tmpPath}"`, { encoding: 'utf8' });
    return { result: 'clean', raw: stdout.trim(), engine: 'ClamAV' };
  } catch (err) {
    const stdout = err.stdout?.toString() || '';
    const stderr = err.stderr?.toString() || '';
    if (err.status === 1) {
      const match = stdout.match(/:\s*(.+?)\s*FOUND/i);
      const threatName = match ? match[1] : (stdout.trim() || 'Malware detected');
      return { result: 'infected', threatName, raw: stdout.trim(), engine: 'ClamAV' };
    }
    return { result: 'error', error: `clamscan error (${err.status}): ${stderr || stdout}`, raw: stdout };
  } finally {
    try { fs.unlinkSync(tmpPath); } catch (e) {}
  }
}

const server = http.createServer(async (req, res) => {
  const url = req.url || '/';

  if (req.method === 'GET' && (url === '/health' || url === '/' || url === '/ping')) {
    const hasDb = fs.existsSync('/var/lib/clamav/eicar.ndb') || fs.existsSync('/var/lib/clamav/main.cvd');
    res.writeHead(hasDb ? 200 : 503, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: hasDb ? 'HEALTHY' : 'INITIALIZING',
      ping: 'PONG',
      engine: 'ClamAV',
      signatureDatabase: hasDb ? 'LOADED' : 'UNAVAILABLE',
      timestamp: new Date().toISOString(),
    }));
  }

  if (req.method === 'GET' && url === '/logs') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ logs: serviceLogs }));
  }

  if (req.method === 'POST' && url === '/scan') {
    try {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      log(`Received scan request: ${buffer.length} bytes`);

      const scanResult = scanBufferWithClamscan(buffer);
      log(`Scan result: ${scanResult.result} ${scanResult.threatName || ''}`);

      res.writeHead(scanResult.result === 'error' ? 500 : 200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(scanResult));
    } catch (err) {
      log(`Scan handler exception: ${err.message}`);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ result: 'error', error: err.message }));
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  log(`ClamAV Staging Scanner Service listening on port ${PORT}`);
});
