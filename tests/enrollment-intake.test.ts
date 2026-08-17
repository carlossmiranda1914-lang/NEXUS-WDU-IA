import {
  EnrollmentIntakeError,
  executeEnrollmentIntake,
  fingerprintEnrollmentIntake,
  type EnrollmentIntakeCommand,
  type TransactionPool,
} from '../src/modules/enrollments/enrollment-intake.ts';

const failures: string[] = [];
let assertions = 0;
function expect(condition: unknown, message: string) { assertions += 1; if (!condition) failures.push(message); }

class ScriptedClient {
  public readonly statements: string[] = [];
  public released = false;
  constructor(private readonly handler: (sql: string, values: readonly unknown[] | undefined) => any) {}
  async query<T = any>(text: string, values?: readonly unknown[]) {
    const compact = text.replace(/\s+/g, ' ').trim();
    this.statements.push(compact);
    return this.handler(compact, values) as { rows: T[]; rowCount?: number | null };
  }
  release() { this.released = true; }
}
function poolFor(client: ScriptedClient): TransactionPool { return { connect: async () => client }; }

const baseCommand: EnrollmentIntakeCommand = {
  institutionId: '11111111-1111-4111-8111-111111111111',
  actorPersonId: '22222222-2222-4222-8222-222222222222',
  offerId: '33333333-3333-4333-8333-333333333333',
  idempotencyKey: 'intake-2026-0001',
  person: { kind: 'new_person', name: '  Manuel António  ', birthDate: null, phone: null },
};

const fingerprintA = fingerprintEnrollmentIntake(baseCommand);
expect(fingerprintA === fingerprintEnrollmentIntake({ ...baseCommand }), 'Equivalent intake input must produce the same fingerprint.');
expect(/^[0-9a-f]{64}$/.test(fingerprintA), 'Fingerprint must be a SHA-256 hex digest.');

const happyClient = new ScriptedClient((sql) => {
  if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: null };
  if (sql.startsWith('SELECT pg_advisory_xact_lock')) return { rows: [{}], rowCount: 1 };
  if (sql.includes('FROM enrollment_intake_commands c')) return { rows: [], rowCount: 0 };
  if (sql.startsWith('SELECT id, request_fingerprint FROM enrollment_intake_commands')) return { rows: [], rowCount: 0 };
  if (sql.includes('FROM enrollment_offers o')) return { rows: [{ academic_year_id: 'year-1' }], rowCount: 1 };
  if (sql.startsWith('INSERT INTO enrollment_intake_commands')) return { rows: [{ id: 'command-1' }], rowCount: 1 };
  if (sql.startsWith('INSERT INTO people')) return { rows: [{ id: 'person-1' }], rowCount: 1 };
  if (sql.startsWith('INSERT INTO student_profiles')) return { rows: [{ id: 'profile-1' }], rowCount: 1 };
  if (sql.startsWith('INSERT INTO enrollment_applications')) return { rows: [{ id: 'enrollment-1' }], rowCount: 1 };
  if (sql.includes('FROM enrollment_document_policies')) return { rows: [], rowCount: 0 };
  if (sql.startsWith('INSERT INTO enrollment_processes')) return { rows: [], rowCount: 1 };
  if (sql.startsWith('INSERT INTO enrollment_events')) return { rows: [], rowCount: 1 };
  if (sql.startsWith('UPDATE enrollment_intake_commands')) return { rows: [], rowCount: 1 };
  throw new Error(`Unexpected SQL in happy path: ${sql}`);
});
const happyResult = await executeEnrollmentIntake(poolFor(happyClient), baseCommand);
expect(happyResult.enrollmentApplicationId === 'enrollment-1', 'New intake must return created enrollment id.');
expect(happyResult.studentPersonId === 'person-1', 'New intake must return created Person id.');
expect(happyResult.studentProfileId === 'profile-1', 'New intake must return created StudentProfile id.');
expect(happyClient.statements.some((sql) => sql.startsWith('INSERT INTO enrollment_processes')), 'New intake must create its 1:1 process in the same transaction.');
expect(happyResult.replayed === false, 'First successful execution must not be marked replayed.');
expect(happyClient.statements[0] === 'BEGIN', 'Intake must start a transaction before domain writes.');
expect(happyClient.statements.includes('COMMIT'), 'Successful intake must commit.');
expect(!happyClient.statements.includes('ROLLBACK'), 'Successful intake must not rollback.');
expect(happyClient.released, 'Database client must always be released.');

const replayClient = new ScriptedClient((sql) => {
  if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: null };
  if (sql.startsWith('SELECT pg_advisory_xact_lock')) return { rows: [{}], rowCount: 1 };
  if (sql.includes('FROM enrollment_intake_commands c')) return { rows: [{ request_fingerprint: fingerprintA, status: 'completed', enrollment_application_id: 'enrollment-1', student_person_id: 'person-1', student_profile_id: 'profile-1' }], rowCount: 1 };
  throw new Error(`Replay must not continue into domain writes: ${sql}`);
});
const replayResult = await executeEnrollmentIntake(poolFor(replayClient), baseCommand);
expect(replayResult.replayed === true, 'Same idempotency key and fingerprint must replay completed result.');
expect(replayResult.enrollmentApplicationId === 'enrollment-1', 'Replay must return the original enrollment id.');
expect(!replayClient.statements.some((sql) => sql.startsWith('INSERT INTO people')), 'Replay must not create a second Person.');
expect(!replayClient.statements.some((sql) => sql.startsWith('INSERT INTO enrollment_applications')), 'Replay must not create a second enrollment.');
expect(replayClient.statements.includes('COMMIT'), 'Replay must close the transaction successfully.');

const reuseClient = new ScriptedClient((sql, values) => {
  if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: null };
  if (sql.startsWith('SELECT pg_advisory_xact_lock')) return { rows: [{}], rowCount: 1 };
  if (sql.includes('FROM enrollment_intake_commands c')) return { rows: [], rowCount: 0 };
  if (sql.startsWith('SELECT id, request_fingerprint FROM enrollment_intake_commands')) return { rows: [], rowCount: 0 };
  if (sql.includes('FROM enrollment_offers o')) return { rows: [{ academic_year_id: 'year-1' }], rowCount: 1 };
  if (sql.startsWith('INSERT INTO enrollment_intake_commands')) return { rows: [{ id: 'command-2' }], rowCount: 1 };
  if (sql.includes('INNER JOIN student_profiles sp') && sql.includes('WHERE p.id = $1')) {
    expect(values?.[1] === baseCommand.institutionId, 'Person reuse query must be scoped to current institution.');
    return { rows: [{ person_id: 'person-existing', student_profile_id: 'profile-existing' }], rowCount: 1 };
  }
  if (sql.startsWith('INSERT INTO enrollment_applications')) return { rows: [{ id: 'enrollment-2' }], rowCount: 1 };
  if (sql.includes('FROM enrollment_document_policies')) return { rows: [], rowCount: 0 };
  if (sql.startsWith('INSERT INTO enrollment_processes')) return { rows: [], rowCount: 1 };
  if (sql.startsWith('INSERT INTO enrollment_events')) return { rows: [], rowCount: 1 };
  if (sql.startsWith('UPDATE enrollment_intake_commands')) return { rows: [], rowCount: 1 };
  throw new Error(`Unexpected SQL in reuse path: ${sql}`);
});
const reuseResult = await executeEnrollmentIntake(poolFor(reuseClient), { ...baseCommand, idempotencyKey: 'intake-2026-0002', person: { kind: 'reuse_person', personId: 'person-existing' } });
expect(reuseResult.studentPersonId === 'person-existing', 'Reuse path must preserve existing local Person id.');
expect(reuseResult.studentProfileId === 'profile-existing', 'Existing institutional StudentProfile must be reused.');
expect(!reuseClient.statements.some((sql) => sql.startsWith('INSERT INTO people')), 'Reuse path must not create a duplicate Person.');
expect(!reuseClient.statements.some((sql) => sql.startsWith('INSERT INTO student_profiles')), 'Local reuse must not create another StudentProfile.');

const crossInstitutionClient = new ScriptedClient((sql) => {
  if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: null };
  if (sql.startsWith('SELECT pg_advisory_xact_lock')) return { rows: [{}], rowCount: 1 };
  if (sql.includes('FROM enrollment_intake_commands c')) return { rows: [], rowCount: 0 };
  if (sql.startsWith('SELECT id, request_fingerprint FROM enrollment_intake_commands')) return { rows: [], rowCount: 0 };
  if (sql.includes('FROM enrollment_offers o')) return { rows: [{ academic_year_id: 'year-1' }], rowCount: 1 };
  if (sql.startsWith('INSERT INTO enrollment_intake_commands')) return { rows: [{ id: 'command-x' }], rowCount: 1 };
  if (sql.includes('INNER JOIN student_profiles sp') && sql.includes('WHERE p.id = $1')) return { rows: [], rowCount: 0 };
  throw new Error(`Unexpected SQL in cross-institution path: ${sql}`);
});
let crossInstitutionError: unknown;
try {
  await executeEnrollmentIntake(poolFor(crossInstitutionClient), { ...baseCommand, idempotencyKey: 'intake-2026-000x', person: { kind: 'reuse_person', personId: 'external-person' } });
} catch (error) { crossInstitutionError = error; }
expect(crossInstitutionError instanceof EnrollmentIntakeError, 'External Person without local StudentProfile must be rejected.');
expect((crossInstitutionError as EnrollmentIntakeError).code === 'PERSON_NOT_FOUND', 'Cross-institution reuse must fail closed without revealing external existence.');
expect(crossInstitutionClient.statements.includes('ROLLBACK'), 'Rejected external reuse must rollback command reservation.');
expect(!crossInstitutionClient.statements.some((sql) => sql.startsWith('SELECT id FROM people WHERE id = $1')), 'Rejected external reuse must not probe global Person existence.');
expect(!crossInstitutionClient.statements.some((sql) => sql.startsWith('INSERT INTO enrollment_applications')), 'Rejected external reuse must never create enrollment.');

const rollbackClient = new ScriptedClient((sql) => {
  if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: null };
  if (sql.startsWith('SELECT pg_advisory_xact_lock')) return { rows: [{}], rowCount: 1 };
  if (sql.includes('FROM enrollment_intake_commands c')) return { rows: [], rowCount: 0 };
  if (sql.startsWith('SELECT id, request_fingerprint FROM enrollment_intake_commands')) return { rows: [], rowCount: 0 };
  if (sql.includes('FROM enrollment_offers o')) return { rows: [{ academic_year_id: 'year-1' }], rowCount: 1 };
  if (sql.startsWith('INSERT INTO enrollment_intake_commands')) return { rows: [{ id: 'command-3' }], rowCount: 1 };
  if (sql.startsWith('INSERT INTO people')) return { rows: [{ id: 'person-3' }], rowCount: 1 };
  if (sql.startsWith('INSERT INTO student_profiles')) return { rows: [{ id: 'profile-3' }], rowCount: 1 };
  if (sql.startsWith('INSERT INTO enrollment_applications')) throw new Error('simulated enrollment insert failure');
  throw new Error(`Unexpected SQL in rollback path: ${sql}`);
});
let rollbackError: unknown;
try { await executeEnrollmentIntake(poolFor(rollbackClient), { ...baseCommand, idempotencyKey: 'intake-2026-0003' }); } catch (error) { rollbackError = error; }
expect(rollbackError instanceof Error, 'Domain failure must be propagated to caller.');
expect(rollbackClient.statements.includes('ROLLBACK'), 'Failure after Person/Profile creation must rollback the entire transaction.');
expect(!rollbackClient.statements.includes('COMMIT'), 'Failed intake must never commit a partial state.');
expect(rollbackClient.released, 'Failed transaction must still release the database client.');

const conflictFingerprint = fingerprintEnrollmentIntake({ ...baseCommand, person: { kind: 'new_person', name: 'Outra Pessoa', birthDate: null, phone: null } });
const conflictClient = new ScriptedClient((sql) => {
  if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: null };
  if (sql.startsWith('SELECT pg_advisory_xact_lock')) return { rows: [{}], rowCount: 1 };
  if (sql.includes('FROM enrollment_intake_commands c')) return { rows: [{ request_fingerprint: conflictFingerprint, status: 'completed', enrollment_application_id: 'enrollment-other', student_person_id: 'person-other', student_profile_id: 'profile-other' }], rowCount: 1 };
  throw new Error(`Unexpected SQL in key-conflict path: ${sql}`);
});
let keyConflict: unknown;
try { await executeEnrollmentIntake(poolFor(conflictClient), baseCommand); } catch (error) { keyConflict = error; }
expect(keyConflict instanceof EnrollmentIntakeError, 'Reusing an idempotency key with different input must raise a domain error.');
expect((keyConflict as EnrollmentIntakeError).code === 'IDEMPOTENCY_KEY_REUSED', 'Different input under same key must be rejected explicitly.');
expect(conflictClient.statements.includes('ROLLBACK'), 'Idempotency mismatch must rollback and make no changes.');

if (failures.length) throw new Error(failures.join('\n'));
console.log(`Enrollment intake tests passed (${assertions} assertions).`);
