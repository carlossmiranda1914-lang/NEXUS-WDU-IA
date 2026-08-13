import crypto from 'crypto';
import { captureEnrollmentDocumentPolicy } from './enrollment-document-snapshot.ts';

export interface TransactionQueryClient {
  query<T = any>(text: string, values?: readonly unknown[]): Promise<{ rows: T[]; rowCount?: number | null }>;
}

export class EnrollmentIntakeError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'EnrollmentIntakeError';
  }
}

export type EnrollmentIntakePersonCommand =
  | {
      kind: 'new_person';
      name: string;
      birthDate?: string | null;
      phone?: string | null;
      authorization?: { decisionId: string; caseId: string } | null;
    }
  | {
      kind: 'reuse_person';
      personId: string;
      authorization?: { decisionId: string; caseId: string } | null;
    };

export interface EnrollmentIntakeCommand {
  institutionId: string;
  actorPersonId: string;
  offerId: string;
  idempotencyKey: string;
  requestFingerprint?: string;
  person: EnrollmentIntakePersonCommand;
}

export interface EnrollmentIntakeResult {
  enrollmentId: string;
  studentPersonId: string;
  studentProfileId: string;
  idempotentReplay: boolean;
}

function normalizeOptionalText(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

export function fingerprintEnrollmentIntake(command: EnrollmentIntakeCommand): string {
  const canonical = stableJson({
    institutionId: command.institutionId,
    offerId: command.offerId,
    person: command.person,
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

async function requireApprovedIdentityDecision(
  client: TransactionQueryClient,
  institutionId: string,
  authorization: { decisionId: string; caseId: string },
  expectedDecision: 'CREATE_PERSON' | 'REUSE_PERSON',
  expectedPersonId?: string,
): Promise<void> {
  const decision = await client.query<{
    decision: string;
    candidate_person_id: string | null;
  }>(
    `SELECT d.decision, d.candidate_person_id
       FROM identity_resolution_decisions d
       INNER JOIN identity_resolution_cases c ON c.id = d.case_id
      WHERE d.id = $1
        AND d.case_id = $2
        AND d.institution_id = $3
        AND c.institution_id = $3
        AND d.status = 'approved'
        AND d.consumed_at IS NULL
      FOR UPDATE`,
    [authorization.decisionId, authorization.caseId, institutionId],
  );

  if (!decision.rowCount) {
    throw new EnrollmentIntakeError('IDENTITY_DECISION_REQUIRED', 'An approved identity resolution decision is required.');
  }

  const row = decision.rows[0];
  if (row.decision !== expectedDecision) {
    throw new EnrollmentIntakeError('IDENTITY_DECISION_MISMATCH', 'The approved identity decision does not match this intake action.');
  }
  if (expectedDecision === 'REUSE_PERSON' && expectedPersonId && row.candidate_person_id !== expectedPersonId) {
    throw new EnrollmentIntakeError('IDENTITY_DECISION_MISMATCH', 'The approved identity decision targets a different Person.');
  }

  await client.query(
    `UPDATE identity_resolution_decisions
        SET consumed_at = now()
      WHERE id = $1 AND institution_id = $2`,
    [authorization.decisionId, institutionId],
  );
}

export async function executeEnrollmentIntake(
  client: TransactionQueryClient,
  command: EnrollmentIntakeCommand,
): Promise<EnrollmentIntakeResult> {
  const idempotencyKey = command.idempotencyKey.trim();
  if (!idempotencyKey) {
    throw new EnrollmentIntakeError('IDEMPOTENCY_KEY_REQUIRED', 'An idempotency key is required.');
  }

  const requestFingerprint = command.requestFingerprint?.trim() || fingerprintEnrollmentIntake(command);

  await client.query('BEGIN');
  try {
    const previous = await client.query<{
      id: string;
      request_fingerprint: string;
      status: string;
      result_enrollment_id: string | null;
      result_student_person_id: string | null;
      result_student_profile_id: string | null;
    }>(
      `SELECT id, request_fingerprint, status, result_enrollment_id, result_student_person_id, result_student_profile_id
         FROM enrollment_intake_commands
        WHERE institution_id = $1
          AND operation = 'enrollment_intake'
          AND idempotency_key = $2
        FOR UPDATE`,
      [command.institutionId, idempotencyKey],
    );

    if (previous.rowCount) {
      const row = previous.rows[0];
      if (row.request_fingerprint !== requestFingerprint) {
        throw new EnrollmentIntakeError('IDEMPOTENCY_CONFLICT', 'This idempotency key was already used for a different request.');
      }
      if (
        row.status === 'completed' &&
        row.result_enrollment_id &&
        row.result_student_person_id &&
        row.result_student_profile_id
      ) {
        await client.query('COMMIT');
        return {
          enrollmentId: row.result_enrollment_id,
          studentPersonId: row.result_student_person_id,
          studentProfileId: row.result_student_profile_id,
          idempotentReplay: true,
        };
      }
      throw new EnrollmentIntakeError('IDEMPOTENCY_IN_PROGRESS', 'This intake command is already being processed.');
    }

    const offer = await client.query<{ academic_year_id: string }>(
      `SELECT academic_year_id
         FROM enrollment_offers
        WHERE id = $1 AND institution_id = $2 AND status = 'active'
        FOR SHARE`,
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
            SET status = 'completed',
                result_enrollment_id = $1,
                result_student_person_id = $2,
                result_student_profile_id = $3,
                completed_at = now()
          WHERE id = $4`,
        [enrollment.rows[0].id, studentPersonId, studentProfileId, commandRow.rows[0].id],
      );

      await client.query('COMMIT');
      return {
        enrollmentId: enrollment.rows[0].id,
        studentPersonId,
        studentProfileId,
        idempotentReplay: false,
      };
    } catch (error) {
      if (error instanceof EnrollmentIntakeError) throw error;
      const code = (error as { code?: string }).code;
      if (code === '23505') {
        throw new EnrollmentIntakeError('ENROLLMENT_ALREADY_EXISTS', 'An enrollment application already exists for this Person and offer.');
      }
      throw error;
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
