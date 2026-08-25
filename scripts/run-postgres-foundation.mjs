import { spawn } from 'node:child_process';
import { verifyApprovedTestConnection } from './nexus-test-db-safety.mjs';

await verifyApprovedTestConnection();
if (process.env.CI !== 'true' && process.env.TEST_DATABASE_LOCAL_AUTHORIZED !== 'true') throw new Error('CP4 local PostgreSQL execution requires TEST_DATABASE_LOCAL_AUTHORIZED=true.');
if (!process.env.TEST_DATABASE_URL || process.env.TEST_DATABASE_URL === process.env.DATABASE_URL || process.env.TEST_DATABASE_CONFIRMATION !== 'NEXUS_TEST_DATABASE') throw new Error('CP4 requires an explicit isolated TEST_DATABASE_URL.');
const gates = [
  ['bootstrap', ['npm', 'run', 'test:database:setup']],
  ['migration-isolation', ['npm', 'run', 'test:migrations:isolated']],
  ['migration-ledger-rollback', ['npm', 'run', 'test:fnd01:cp2:postgres']],
  ['school-tasks-history-isolation', ['npm', 'run', 'test:fnd01:cp4:postgres']],
  ['enrollment-intake', ['npm', 'run', 'test:enrollment-intake-api:postgres']],
  ['enrollment-history', ['npx', 'tsx', 'tests/enrollment-history-postgres.test.ts']],
  ['enrollment-documents', ['npx', 'tsx', 'tests/secretariat-s02-3-document-postgres.test.ts']],
  ['process-reconciliation', ['npm', 'run', 'test:secretariat-s03:postgres']],
];
for (const [name, command] of gates) {
  console.log(`postgres-foundation: ${name}`);
  const status = await new Promise(resolve => { const child = spawn(command[0], command.slice(1), { cwd: process.cwd(), shell: process.platform === 'win32', stdio: 'inherit' }); const timer = setTimeout(() => { child.kill(); resolve(1); }, 180000); child.once('error', () => { clearTimeout(timer); resolve(1); }); child.once('exit', code => { clearTimeout(timer); resolve(code ?? 1); }); });
  if (status !== 0) { console.error(`postgres-foundation failed: ${name}`); process.exit(status); }
}
console.log('postgres-foundation: PASS.');
