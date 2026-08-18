import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import cors from 'cors';
import express from 'express';

const source = await readFile('server.ts', 'utf8');
assert(source.includes("allowedHeaders: ['Content-Type', 'Authorization', 'X-Institution-Id', 'Idempotency-Key', 'X-File-Name']"), 'Server CORS configuration must permit file upload headers.');
const app = express();
app.use(cors({ origin: true, methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], allowedHeaders: ['Content-Type', 'Authorization', 'X-Institution-Id', 'Idempotency-Key', 'X-File-Name'], credentials: true }));
app.options('/api/enrollments/:id/documents/:documentId/file', (_req, res) => res.sendStatus(204));
const server = http.createServer(app); await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
try {
  const port = (server.address() as any).port;
  const response = await fetch(`http://127.0.0.1:${port}/api/enrollments/a/documents/b/file`, { method: 'OPTIONS', headers: { Origin: 'https://app.example.test', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization, content-type, idempotency-key, x-file-name, x-institution-id' } });
  assert.equal(response.status, 204);
  assert.match(response.headers.get('access-control-allow-headers') || '', /Idempotency-Key/i); assert.match(response.headers.get('access-control-allow-headers') || '', /X-File-Name/i);
  console.log('[CORS-IDEMPOTENCY-HTTP] passed.');
} finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
