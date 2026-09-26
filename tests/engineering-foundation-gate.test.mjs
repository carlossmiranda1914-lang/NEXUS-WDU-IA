import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = await mkdtemp(path.join(os.tmpdir(), 'nexus-engineering-gate-'));
const gate = path.resolve('scripts/engineering-foundation-gate.mjs');
const run = () => spawnSync(process.execPath, [gate, '--root', root], { encoding: 'utf8' });
try {
  await mkdir(path.join(root, 'src/modules/finance'), { recursive: true });
  await writeFile(path.join(root, 'engineering-foundation-baseline.json'), JSON.stringify({ serverInlineRouteCount: 1 }));
  await writeFile(path.join(root, 'server.ts'), "app.get('/historical', handler);\n");
  await writeFile(path.join(root, 'src/modules/finance/service.ts'), 'export const service = true;\n');
  let result = run();
  assert.equal(result.status, 0, result.stderr);

  await writeFile(path.join(root, 'server.ts'), "app.get('/historical', handler);\napp.post('/new', handler);\n");
  result = run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /NEW_INLINE_SERVER_ROUTE/);

  await writeFile(path.join(root, 'server.ts'), "app.get('/historical', handler);\n");
  await writeFile(path.join(root, 'src/modules/finance/service.ts'), "import x from '../documents/document-repository.ts';\n");
  result = run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /CROSS_DOMAIN_INFRASTRUCTURE_IMPORT/);

  await writeFile(path.join(root, 'src/modules/finance/service.ts'), "import { users } from '../../db/schema.ts';\n");
  result = run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /LEGACY_CONSUMER/);

  await writeFile(path.join(root, 'src/modules/finance/service.ts'), "import { students as learnerRows } from '../../db/schema.ts';\n");
  result = run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /LEGACY_CONSUMER/);

  await writeFile(path.join(root, 'src/modules/finance/service.ts'), "import {\n invoices\n} from '../../db/schema.ts';\n");
  result = run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /LEGACY_CONSUMER/);

  await writeFile(path.join(root, 'src/modules/finance/service.ts'), "import { schoolTasks } from '../../db/schema.ts';\n");
  result = run();
  assert.equal(result.status, 0, result.stderr);
} finally { await rm(root, { recursive: true, force: true }); }

console.log('[NEXUS] engineering foundation gate contract: PASS.');
