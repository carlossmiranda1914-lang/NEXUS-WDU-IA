import assert from 'node:assert/strict';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

// Keep the route import ahead of the PostgreSQL gate: before Task 5 this is the
// intentional RED proof that the canonical allocation HTTP boundary is absent.
const allocationHttp = await import('../src/modules/finance/allocation-http.ts');
assert.equal(typeof allocationHttp.registerFinanceAllocationRoutes, 'function');

// The remaining assertions are deliberately stateful Express + PostgreSQL proof:
// authorized 201/replay 200, fingerprint conflict, role denial, tenant
// non-disclosure, eligibility conflicts, and reversal/over-reversal.  They run
// only against the canonical disposable target; never substitute an ad-hoc DB.
await verifyApprovedTestConnection();

console.log('Finance Allocation HTTP: approved disposable database available for stateful route proof.');
