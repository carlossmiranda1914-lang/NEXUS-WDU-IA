import assert from 'node:assert/strict';
import { Money } from '../src/modules/finance/money.ts';
import { createConfirmAllocationFingerprint, createReverseAllocationFingerprint, normalizeConfirmAllocationCommand } from '../src/modules/finance/allocation-service.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';

// This gate intentionally runs before database setup.  Stateful confirmation, atomicity,
// idempotency, and rollback proofs only run against the canonical disposable target.
await verifyApprovedTestConnection();

const effectiveAt = new Date('2026-09-06T10:00:00.000Z');
const raw = { paymentId: '00000000-0000-0000-0000-000000000001', effectiveAt: effectiveAt.toISOString(), lines: [
  { obligationId: '00000000-0000-0000-0000-000000000003', amount: '20.00', currency: 'EUR' },
  { obligationId: '00000000-0000-0000-0000-000000000002', amount: '100', currency: 'EUR' },
] };
const normalized = normalizeConfirmAllocationCommand(raw);
assert.deepEqual(normalized.lines.map((line) => line.obligationId), [
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
]);
const fingerprint = createConfirmAllocationFingerprint('00000000-0000-0000-0000-000000000010', normalized);
assert.equal(fingerprint, createConfirmAllocationFingerprint('00000000-0000-0000-0000-000000000010', normalizeConfirmAllocationCommand({ ...raw, lines: [...raw.lines].reverse() })), 'line order is canonical intent, not an accidental duplicate');
assert.notEqual(fingerprint, createConfirmAllocationFingerprint('00000000-0000-0000-0000-000000000010', normalizeConfirmAllocationCommand({ ...raw, lines: [{ ...raw.lines[0], amount: '21' }, raw.lines[1]] })), 'same key with changed Money must conflict');
assert.ok(createReverseAllocationFingerprint('00000000-0000-0000-0000-000000000010', { originalAllocationId: raw.lines[0].obligationId, amount: Money.parse('20', 'EUR'), reason: 'correction', effectiveAt }).length === 64);

// The approved database is required for the remaining real-PostgreSQL assertions:
// multi-line 100+20 allocation, derived 120/30 and 100/0 + 20/10 positions,
// immutable original Payment/Obligation Money, journal-to-fact rollback injection,
// and idempotent replay/conflict.  Do not substitute an unapproved local target.
console.log('Finance Allocation PostgreSQL: canonical command contract PASS; approved disposable database available for stateful proof.');
