import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const studentRecord = readFileSync(resolve('src/components/StudentRecordWorkspace.tsx'), 'utf8');
const enrollmentOps = readFileSync(resolve('src/components/EnrollmentOperationsWorkspace.tsx'), 'utf8');
const app = readFileSync(resolve('src/App.tsx'), 'utf8');

// 1. Student Record Workspace entry point
assert.ok(
  studentRecord.includes('Ver situação financeira'),
  'StudentRecordWorkspace must include a "Ver situação financeira" action button'
);
assert.ok(
  studentRecord.includes('nexus-open-finance'),
  'StudentRecordWorkspace must dispatch the nexus-open-finance event to navigate to Finance'
);

// 2. Enrollment Operations Workspace entry point
assert.ok(
  enrollmentOps.includes('Ver situação financeira'),
  'EnrollmentOperationsWorkspace must include a "Ver situação financeira" entry point'
);
assert.ok(
  enrollmentOps.includes('nexus-open-finance'),
  'EnrollmentOperationsWorkspace must dispatch the nexus-open-finance event to navigate to Finance'
);

// 3. App Shell integration
assert.ok(
  app.includes('nexus-open-finance'),
  'App.tsx must listen to the nexus-open-finance event'
);
assert.ok(
  app.includes('initialFinancialAccountId'),
  'App.tsx must pass initialFinancialAccountId to FinanceWorkspace'
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
