import crypto from 'crypto';
import { captureEnrollmentDocumentPolicy } from './enrollment-document-snapshot.ts';

export interface TransactionQueryClient {
  query<T = any>(text: string, values?: readonly unknown[]): Promise<{ rows: T[]; rowCount?: number | null }>;
}

export interface TransactionPool {
  connect(): Promise<TransactionQueryClient & { release(): void }>;
}

export interface EnrollmentIdentityAuthorization {
  decisionId: string;
  caseKey: string;
}

export type EnrollmentIntakePersonDecision =
  | {
      kind: 'new_person';
      name: string;
      birthDate?: string | null;
      phone?: string | null;
      authorization?: EnrollmentIdentityAuthorization;
    }
  | {
      kind: 'reuse_person';
      personId: string;
      authorization?: EnrollmentIdentityAuthorization;
    };

export interface EnrollmentIntakeCommand {
  institutionId: string;
  actorPersonId: string;
  offerId: string;
  idempotencyKey: string;
  person: EnrollmentIntakePersonDecision;
}

export interface EnrollmentIntakeResult {
  enrollmentApplicationId: string;
  studentPersonId: string;
  studentProfileId: string;
  replayed: boolean;
}
export interface EnrollmentIntakeTestHooks { failAfter?: 'snapshot'; }

export class EnrollmentIntakeError extends Error {
  constructor(
    public readonly code:
      | 'INVALID_IDEMPOTENCY_KEY'
      | 'IDEMPOTENCY_KEY_REUSED'
      | 'OFFER_NOT_AVAILABLE'
      | 'PERSON_NOT_FOUND'
      | 'ENROLLMENT_ALREADY_EXISTS'
      | 'IDENTITY_DECISION_REQUIRED'
      | 'IDENTITY_DECISION_INVALID',
    message: string,
  ) {
    super(message);
    this.name = 'EnrollmentIntakeError';
  }
}

function normalizeOptionalText(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function validateIdempotencyKey(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 160) {
    throw new EnrollmentIntakeError('INVALID_IDEMPOTENCY_KEY', 'Idempotency key must contain between 8 and 160 characters.');
  }
  return normalized;
}

export function fingerprintEnrollmentIntake(command: EnrollmentIntakeCommand): string {
  const person = command.person.kind === 'new_person'
    ? {
        kind: command.person.kind,
        name: command.person.name.trim(),
        birthDate: normalizeOptionalText(command.person.birthDate),
        phone: normalizeOptionalText(command.person.phone),
        authorization: command.person.authorization ?? null,
      }
    : {
        kind: command.person.kind,
        personId: command.person.personId,
        authorization: command.person.authorization ?? null,
      };

  return crypto.createHash('sha256').update(JSON.stringify({
    institutionId: command.institutionId,
    actorPersonId: command.actorPersonId,
    offerId: command.offerId,
    person,
  })).digest('hex');
}

async function selectCompletedReplay(
  client: TransactionQueryClient,
  institutionId: string,
  idempotencyKey: string,
  requestFingerprint: string,
): Promise<EnrollmentIntakeResult | null> {
  const existing = await client.query<{
    request_fingerprint: string;
    status: string;
    enrollment_application_id: string | null;
    student_person_id: string | null;
    student_profile_id: string | null;
  }>(
    `SELECT c.request_fingerprint, c.status, c.enrollment_application_id,
            e.student_person_id, sp.id AS student_profile_id
       FROM enrollment_intake_commands c
       LEFT JOIN enrollment_applications e ON e.id = c.enrollment_application_id
       LEFT JOIN student_profiles sp
         ON sp.institution_id = c.institution_id AND sp.person_id = e.student_person_id
      WHERE c.institution_id = $1
        AND c.operation = 'enrollment_intake'
        AND c.idempotency_key = $2
      FOR UPDATE OF c`,
    [institutionId, idempotencyKey],
  );

  if (!existing.rowCount) return null;
  const row = existing.rows[0];
  if (row.request_fingerprint !== requestFingerprint) {
    throw new EnrollmentIntakeError('IDEMPOTENCY_KEY_REUSED', 'The idempotency key was already used with different input.');
  }
  if (row.status === 'completed' && row.enrollment_application_id && row.student_person_id && row.student_profile_id) {
    return {
      enrollmentApplicationId: row.enrollment_application_id,
      studentPersonId: row.student_person_id,
      studentProfileId: row.student_profile_id,
      replayed: true,
    };
  }
  return null;
}

async function requireApprovedIdentityDecision(
  client: TransactionQueryClient,
  institutionId: string,
  authorization: EnrollmentIdentityAuthorization | undefined,
  expectedAction: 'CREATE_PERSON' | 'REUSE_PERSON',
  expectedCandidatePersonId?: string,
): Promise<void> {
  if (!authorization) {
    throw new EnrollmentIntakeError('IDENTITY_DECISION_REQUIRED', 'An approved identity decision is required for this intake.');
  }

  const approved = await client.query<{
    proposed_action: string;
    proposed_candidate_person_id: string | null;
  }>(
    `SELECT proposed_action, proposed_candidate_person_id
       FROM identity_resolution_decisions
      WHERE id = $1
        AND institution_id = $2
        AND case_key = $3
        AND status = 'approved'
      FOR UPDATE`,
    [authorization.decisionId, institutionId, authorization.caseKey],
  );

  if (!approved.rowCount || approved.rows[0].proposed_action !== expectedAction) {
    throw new EnrollmentIntakeError('IDENTITY_DECISION_INVALID', 'The identity decision is not approved for this action and institution.');
  }

  if (expectedAction === 'REUSE_PERSON' && approved.rows[0].proposed_candidate_person_id !== expectedCandidatePersonId) {
    throw new EnrollmentIntakeError('IDENTITY_DECISION_INVALID', 'The approved identity decision does not authorize this Person.');
  }
}

export async function executeEnrollmentIntake(
  pool: TransactionPool,
  command: EnrollmentIntakeCommand,
  testHooks?: EnrollmentIntakeTestHooks,
): Promise<EnrollmentIntakeResult> {
  const idempotencyKey = validateIdempotencyKey(command.idempotencyKey);
  const requestFingerprint = fingerprintEnrollmentIntake(command);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`,
      [command.institutionId, `enrollment_intake:${idempotencyKey}`],
    );

    const replay = await selectCompletedReplay(client, command.institutionId, idempotencyKey, requestFingerprint);
    if (replay) {
      await client.query('COMMIT');
      return replay;
    }

    const existingCommand = await client.query<{ id: string; request_fingerprint: string }>(
      `SELECT id, request_fingerprint
         FROM enrollment_intake_commands
        WHERE institution_id = $1
          AND operation = 'enrollment_intake'
          AND idempotency_key = $2`,
      [command.institutionId, idempotencyKey],
    );
    if (existingCommand.rowCount) {
      if (existingCommand.rows[0].request_fingerprint !== requestFingerprint) {
        throw new EnrollmentIntakeError('IDEMPOTENCY_KEY_REUSED', 'The idempotency key was already used with different input.');
      }
      throw new EnrollmentIntakeError('IDEMPOTENCY_KEY_REUSED', 'The idempotency command is not in a reusable completed state.');
    }

    const offer = await client.query<{ academic_year_id: string }>(
      `SELECT o.academic_year_id
         FROM enrollment_offers o
         INNER JOIN academic_years y
           ON y.id = o.academic_year_id AND y.institution_id = o.institution_id
        WHERE o.id = $1
          AND o.institution_id = $2
          AND o.status = 'active'
          AND y.status = 'active'
        FOR UPDATE OF o`,
      [command.offerId, command.institutionId],
    );
    if (!offer.rowCount) {
      throw new EnrollmentIntakeError('OFFER_NOT_AVAILABLE', 'The enrollment offer is not available for this institution.');
    }

    const commandRow = await client.query<{ id: string }>(
      `INSERT INTO enrollment_intake_commands (
         institution_id, operation, idempotency_key, request_fingerprint, status, created_by
       ) VALUES ($1, 'enrollment_intake', $2, $3, 'pending', $4)
       RETURNING id`,
      [command.institutionId, idempotencyKey, requestFingerprint, command.actorPersonId],
    );

    let studentPersonId: string;
    let studentProfileId: string | undefined;

    if (command.person.kind === 'new_person') {
      if (command.person.authorization) {
        await requireApprovedIdentityDecision(
          client,
          command.institutionId,
          command.person.authorization,
          'CREATE_PERSON',
        );
      }

      const createdPerson = await client.query<{ id: string }>(
        `INSERT INTO people (name, birth_date, phone)
         VALUES ($1, $2::date, $3)
         RETURNING id`,
        [command.person.name.trim(), normalizeOptionalText(command.person.birthDate), normalizeOptionalText(command.person.phone)],
      );
      studentPersonId = createdPerson.rows[0].id;
    } else {
      const localPerson = await client.query<{ person_id: string; student_profile_id: string }>(
        `SELECT p.id AS person_id, sp.id AS student_profile_id
           FROM people p
           INNER JOIN student_profiles sp
             ON sp.person_id = p.id
            AND sp.institution_id = $2
          WHERE p.id = $1`,
        [command.person.personId, command.institutionId],
      );

      if (localPerson.rowCount) {
        studentPersonId = localPerson.rows[0].person_id;
        studentProfileId = localPerson.rows[0].student_profile_id;
      } else {
        // Preserve T4's fail-closed behavior for direct/untrusted reuse attempts:
        // without an explicit approved decision we do not probe global Person existence.
        if (!command.person.authorization) {
          throw new EnrollmentIntakeError('PERSON_NOT_FOUND', 'The selected Person is not available in this institution.');
        }

        await requireApprovedIdentityDecision(
          client,
          command.institutionId,
          command.person.authorization,
          'REUSE_PERSON',
          command.person.personId,
        );
        const existingPerson = await client.query<{ id: string }>(
          `SELECT id FROM people WHERE id = $1`,
          [command.person.personId],
        );
        if (!existingPerson.rowCount) {
          throw new EnrollmentIntakeError('PERSON_NOT_FOUND', 'The approved Person no longer exists.');
        }
        studentPersonId = existingPerson.rows[0].id;
      }
    }

    if (!studentProfileId) {
      const insertedProfile = await client.query<{ id: string }>(
        `INSERT INTO student_profiles (institution_id, person_id, status)
         VALUES ($1, $2, 'inactive')
         ON CONFLICT (institution_id, person_id) DO NOTHING
         RETURNING id`,
        [command.institutionId, studentPersonId],
      );
      studentProfileId = insertedProfile.rows[0]?.id;
      if (!studentProfileId) {
        const existingProfile = await client.query<{ id: string }>(
          `SELECT id FROM student_profiles WHERE institution_id = $1 AND person_id = $2`,
          [command.institutionId, studentPersonId],
        );
        studentProfileId = existingProfile.rows[0]?.id;
      }
    }

    try {
      const enrollment = await client.query<{ id: string }>(
        `INSERT INTO enrollment_applications (
           institution_id, student_person_id, academic_year_id, offer_id, created_by, updated_by
         ) VALUES ($1, $2, $3, $4, $5, $5)
         RETURNING id`,
        [command.institutionId, studentPersonId, offer.rows[0].academic_year_id, command.offerId, command.actorPersonId],
      );

      await captureEnrollmentDocumentPolicy(client, {
        institutionId: command.institutionId,
        offerId: command.offerId,
        enrollmentId: enrollment.rows[0].id,
      });
      if (testHooks?.failAfter === 'snapshot') throw new Error('injected intake snapshot failure');

      await client.query(
        `INSERT INTO enrollment_processes (
           enrollment_application_id, institution_id, current_stage, started_at,
           last_progress_at, projection_fingerprint
         ) VALUES ($1, $2, 'P02', now(), now(), 'intake:pending-reconciliation')`,
        [enrollment.rows[0].id, command.institutionId],
      );

      await client.query(
        `INSERT INTO enrollment_events (
           institution_id, enrollment_application_id, actor_person_id, event_type, metadata
         ) VALUES ($1, $2, $3, 'process_started', $4::jsonb)`,
        [command.institutionId, enrollment.rows[0].id, command.actorPersonId, JSON.stringify({ currentStage: 'P02', source: 'enrollment_intake' })],
      );

      await client.query(
        `INSERT INTO enrollment_events (
           institution_id, enrollment_application_id, actor_person_id, event_type, to_status, metadata
         ) VALUES ($1, $2, $3, 'created', 'draft', $4::jsonb)`,
        [
          command.institutionId,
          enrollment.rows[0].id,
          command.actorPersonId,
          JSON.stringify({
            source: 'student_person_resolution',
            idempotent: true,
            identityDecisionId: command.person.authorization?.decisionId ?? null,
          }),
        ],
      );

      await client.query(
        `UPDATE enrollment_intake_commands
            SET status = 'completed', enrollment_application_id = $1, updated_at = now()
          WHERE id = $2`,
        [enrollment.rows[0].id, commandRow.rows[0].id],
      );

      await client.query('COMMIT');
      return {
        enrollmentApplicationId: enrollment.rows[0].id,
        studentPersonId,
        studentProfileId: studentProfileId!,
        replayed: false,
      };
    } catch (error: any) {
      if (error?.code === '23505') {
        throw new EnrollmentIntakeError('ENROLLMENT_ALREADY_EXISTS', 'A non-cancelled enrollment already exists for this Person and academic year.');
      }
      throw error;
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
