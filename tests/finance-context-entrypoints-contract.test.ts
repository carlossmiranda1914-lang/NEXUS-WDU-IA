import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const studentRecord = readFileSync(resolve('src/components/StudentRecordWorkspace.tsx'), 'utf8');
const enrollmentOps = readFileSync(resolve('src/components/EnrollmentOperationsWorkspace.tsx'), 'utf8');
const app = readFileSync(resolve('src/App.tsx'), 'utf8');
const financeWorkspace = readFileSync(resolve('src/components/finance/FinanceWorkspace.tsx'), 'utf8');

// 1. Student Record Workspace entry point must pass studentRef in detail
assert.ok(
  studentRecord.includes('Ver situação financeira'),
  'StudentRecordWorkspace must include a "Ver situação financeira" action button'
);
assert.match(
  studentRecord,
  /nexus-open-finance['"],\s*\{\s*detail:\s*\{\s*studentRef\s*\}\s*\}\)/,
  'StudentRecordWorkspace must dispatch nexus-open-finance with { studentRef } detail'
);
assert.ok(
  !studentRecord.includes("detail: {}"),
  'StudentRecordWorkspace must NOT dispatch empty detail {}'
);

// 2. Enrollment Operations Workspace entry point must pass studentRef in detail
assert.ok(
  enrollmentOps.includes('Ver situação financeira'),
  'EnrollmentOperationsWorkspace must include a "Ver situação financeira" entry point'
);
assert.match(
  enrollmentOps,
  /nexus-open-finance['"],\s*\{\s*detail:\s*\{\s*studentRef:\s*student\.studentRef\s*\}\s*\}\)/,
  'EnrollmentOperationsWorkspace must dispatch nexus-open-finance with { studentRef: student.studentRef } detail'
);
assert.ok(
  !enrollmentOps.includes("detail: {}"),
  'EnrollmentOperationsWorkspace must NOT dispatch empty detail {}'
);

// 3. App Shell integration
assert.ok(
  app.includes('nexus-open-finance'),
  'App.tsx must listen to the nexus-open-finance event'
);
assert.match(
  app,
  /initialContextQuery=\{financeContextQuery\}/,
  'App.tsx must pass initialContextQuery to FinanceWorkspace'
);
assert.match(
  financeWorkspace,
  /initialContextQuery=\{initialContextQuery\}/,
  'FinanceWorkspace must forward initialContextQuery to FinanceOperationalContextWorkspace'
);

// 4. Invariant: No financial calculation or authority in student/enrollment components
assert.equal(
  studentRecord.includes('finance_obligations') || studentRecord.includes('saldo') || studentRecord.includes('Money.from'),
  false,
  'StudentRecordWorkspace must not perform financial balance calculations or query financial tables'
);
assert.equal(
  enrollmentOps.includes('finance_obligations') || enrollmentOps.includes('Money.from'),
  false,
  'EnrollmentOperationsWorkspace must not perform financial balance calculations'
);

console.log('finance-context-entrypoints-contract: PASS');
