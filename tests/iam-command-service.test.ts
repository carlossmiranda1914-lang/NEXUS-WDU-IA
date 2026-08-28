import assert from 'node:assert/strict';
import { grantInstitutionAccess } from '../src/modules/iam/iam-command-service.ts';
import { IamCommandError, type IamCommandPool } from '../src/modules/iam/iam-command-types.ts';

const institutionId = '11111111-1111-4111-8111-111111111111';
const actorPersonId = '22222222-2222-4222-8222-222222222222';
class ScriptedClient {
  statements: string[] = []; released = false;
  async query<T = any>(text: string, values?: readonly unknown[]) {
    const sql = text.replace(/\s+/g, ' ').trim(); this.statements.push(sql);
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql) || sql.startsWith('SELECT pg_advisory_xact_lock') || sql.startsWith('INSERT INTO iam_command_ledger') || sql.startsWith('UPDATE iam_command_ledger') || sql.startsWith('INSERT INTO iam_membership_events')) return { rows: [], rowCount: 1 } as { rows: T[]; rowCount: number };
    if (sql.startsWith('SELECT id FROM institutions WHERE id = $1 AND status = \'active\' FOR UPDATE')) return { rows: [{ id: institutionId }], rowCount: 1 } as { rows: T[]; rowCount: number };
    if (sql.startsWith('SELECT request_fingerprint')) return { rows: [], rowCount: 0 } as { rows: T[]; rowCount: number };
    if (sql.includes('FROM memberships m') && sql.includes('FOR UPDATE OF m, i')) return { rows: [{ id: 'actor-membership' }], rowCount: 1 } as { rows: T[]; rowCount: number };
    if (sql.startsWith('SELECT id FROM people')) return { rows: [{ id: '33333333-3333-4333-8333-333333333333' }], rowCount: 1 } as { rows: T[]; rowCount: number };
    if (sql.startsWith('SELECT id, person_id, institution_id, role, status, version FROM memberships WHERE institution_id')) return { rows: [], rowCount: 0 } as { rows: T[]; rowCount: number };
    if (sql.startsWith('INSERT INTO memberships')) return { rows: [{ id: 'membership-1', person_id: '33333333-3333-4333-8333-333333333333', institution_id: institutionId, role: 'teacher', status: 'active', version: 1 }], rowCount: 1 } as { rows: T[]; rowCount: number };
    throw new Error(`Unexpected SQL: ${sql}`);
  }
  release() { this.released = true; }
}
const client = new ScriptedClient();
const pool: IamCommandPool = { connect: async () => client };
const context = { personId: actorPersonId, personName: 'Admin', identityEmail: null, membershipId: 'actor-membership', institutionId, institutionName: 'A', institutionSlug: 'a', role: 'institution_admin' as const };
const result = await grantInstitutionAccess(pool, { context, target: { personId: '33333333-3333-4333-8333-333333333333' }, role: 'teacher', idempotencyKey: 'grant-command-001' });
assert.equal(result.resultCode, 'SUCCEEDED');
assert.equal(result.status, 'active');
assert.equal(client.statements[0], 'BEGIN');
assert.ok(client.statements.findIndex((sql) => sql.startsWith('SELECT id FROM institutions')) < client.statements.findIndex((sql) => sql.startsWith('SELECT pg_advisory_xact_lock')), 'Institution lifecycle lock must precede all other IAM locks.');
assert.ok(client.statements.findIndex((sql) => sql.includes('FROM memberships m') && sql.includes('FOR UPDATE OF m, i')) < client.statements.findIndex((sql) => sql.startsWith('SELECT request_fingerprint')), 'Actor authority must be revalidated before any ledger replay or reservation.');
assert.ok(client.statements.some((sql) => sql.startsWith('SELECT pg_advisory_xact_lock')));
assert.ok(client.statements.some((sql) => sql.startsWith('INSERT INTO iam_command_ledger')));
assert.ok(client.statements.some((sql) => sql.startsWith('INSERT INTO iam_membership_events')));
assert.ok(client.statements.includes('COMMIT'));
assert.ok(client.released);
await assert.rejects(() => grantInstitutionAccess(pool, { context: { ...context, role: 'teacher' }, target: { personId: '33333333-3333-4333-8333-333333333333' }, role: 'teacher', idempotencyKey: 'grant-command-002' }), (error: unknown) => error instanceof IamCommandError && error.code === 'UNAUTHORIZED');
console.log('IAM command service tests passed.');
