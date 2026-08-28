import type { PoolClient } from 'pg';
import type { InstitutionalContext } from '../../auth/institutional-context.ts';
import { resolvePersonForInstitution } from '../people/person-resolution-access.ts';
import { canManageEnrollment, type EnrollmentStatus } from './enrollment-policy.ts';
import {
  canEditEnrollmentRegistration,
  registrationReadiness,
  type RegistrationGuardian,
  type RegistrationPerson,
  type RegistrationReadiness,
} from './enrollment-registration-policy.ts';

export interface RegistrationQueryClient {
  query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number | null }>;
}

export interface RegistrationPool extends RegistrationQueryClient {
  connect(): Promise<PoolClient>;
}

export class EnrollmentRegistrationApiError extends Error {
  constructor(
    public readonly code: 'INVALID_INPUT' | 'NOT_FOUND' | 'FORBIDDEN' | 'IMMUTABLE' | 'AMBIGUOUS_GUARDIAN' | 'STALE_VERSION' | 'IDENTITY_COLLISION',
    message: string,
  ) {
    super(message);
    this.name = 'EnrollmentRegistrationApiError';
  }
}

type RegistrationRow = {
  id: string;
  status: EnrollmentStatus;
  registration_version: string;
  student_person_id: string;
  guardian_person_id: string | null;
  student_version: string;
  guardian_version: string | null;
  previous_school: string | null;
  enrollment_notes: string | null;
  student_number: string | null;
  student_name: string;
  student_birth_date: string | null;
  student_phone: string | null;
  student_whatsapp: string | null;
  student_email: string | null;
  student_national_id_number: string | null;
  student_gender: string | null;
  student_nationality: string | null;
  student_address_line: string | null;
  student_municipality: string | null;
  student_province: string | null;
  guardian_name: string | null;
  guardian_birth_date: string | null;
  guardian_phone: string | null;
  guardian_whatsapp: string | null;
  guardian_email: string | null;
  guardian_national_id_number: string | null;
  guardian_gender: string | null;
  guardian_nationality: string | null;
  guardian_address_line: string | null;
  guardian_municipality: string | null;
  guardian_province: string | null;
  guardian_relationship: string | null;
  guardian_is_primary: boolean | null;
  guardian_financial_responsible: boolean | null;
};

const REGISTRATION_SELECT = `
  SELECT e.id, e.status, e.registration_version, e.student_person_id, e.guardian_person_id,
         e.previous_school, e.enrollment_notes,
         sp.student_number,
         student.version::text AS student_version,
         student.name AS student_name,
         student.birth_date::text AS student_birth_date,
         student.phone AS student_phone,
         student.whatsapp AS student_whatsapp,
         student.email AS student_email,
         student.national_id_number AS student_national_id_number,
         student.gender AS student_gender,
         student.nationality AS student_nationality,
         student.address_line AS student_address_line,
         student.municipality AS student_municipality,
         student.province AS student_province,
         guardian.version::text AS guardian_version,
         guardian.name AS guardian_name,
         guardian.birth_date::text AS guardian_birth_date,
         guardian.phone AS guardian_phone,
         guardian.whatsapp AS guardian_whatsapp,
         guardian.email AS guardian_email,
         guardian.national_id_number AS guardian_national_id_number,
         guardian.gender AS guardian_gender,
         guardian.nationality AS guardian_nationality,
         guardian.address_line AS guardian_address_line,
         guardian.municipality AS guardian_municipality,
         guardian.province AS guardian_province,
         gr.relationship AS guardian_relationship,
         gr.is_primary AS guardian_is_primary,
         gr.financial_responsible AS guardian_financial_responsible
    FROM enrollment_applications e
    INNER JOIN people student ON student.id = e.student_person_id
    LEFT JOIN student_profiles sp ON sp.institution_id = e.institution_id AND sp.person_id = e.student_person_id
    LEFT JOIN people guardian ON guardian.id = e.guardian_person_id
    LEFT JOIN guardian_relationships gr
      ON gr.institution_id = e.institution_id
     AND gr.student_person_id = e.student_person_id
     AND gr.guardian_person_id = e.guardian_person_id
     AND gr.status = 'active'
   WHERE e.id = $1 AND e.institution_id = $2`;

function trimOrNull(value: unknown, max: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new EnrollmentRegistrationApiError('INVALID_INPUT', 'Um dos campos de texto é inválido.');
  const normalized = value.trim();
  if (normalized.length > max) throw new EnrollmentRegistrationApiError('INVALID_INPUT', 'Um dos campos excede o tamanho permitido.');
  return normalized || null;
}

function requiredName(value: unknown): string {
  const normalized = trimOrNull(value, 160);
  if (!normalized || normalized.length < 3) throw new EnrollmentRegistrationApiError('INVALID_INPUT', 'Indique o nome completo.');
  return normalized;
}

function dateOrNull(value: unknown): string | null {
  const normalized = trimOrNull(value, 10);
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized) || Number.isNaN(Date.parse(`${normalized}T00:00:00Z`))) {
    throw new EnrollmentRegistrationApiError('INVALID_INPUT', 'Data de nascimento inválida.');
  }
  return normalized;
}

function emailOrNull(value: unknown): string | null {
  const normalized = trimOrNull(value, 254);
  if (!normalized) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new EnrollmentRegistrationApiError('INVALID_INPUT', 'Endereço de email inválido.');
  }
  return normalized.toLowerCase();
}

function genderOrNull(value: unknown): string | null {
  const normalized = trimOrNull(value, 20);
  if (!normalized) return null;
  if (!['female', 'male', 'other', 'unspecified'].includes(normalized)) {
    throw new EnrollmentRegistrationApiError('INVALID_INPUT', 'Género inválido.');
  }
  return normalized;
}

function expectedVersion(value: unknown): bigint {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw new EnrollmentRegistrationApiError('INVALID_INPUT', 'É obrigatória uma versão válida para guardar o cadastro.');
  }
  return BigInt(value);
}

function personFromRow(row: RegistrationRow, prefix: 'student' | 'guardian'): RegistrationPerson {
  return {
    name: row[`${prefix}_name` as keyof RegistrationRow] as string | null,
    birthDate: row[`${prefix}_birth_date` as keyof RegistrationRow] as string | null,
    phone: row[`${prefix}_phone` as keyof RegistrationRow] as string | null,
    whatsapp: row[`${prefix}_whatsapp` as keyof RegistrationRow] as string | null,
    email: row[`${prefix}_email` as keyof RegistrationRow] as string | null,
    nationalIdNumber: row[`${prefix}_national_id_number` as keyof RegistrationRow] as string | null,
    gender: row[`${prefix}_gender` as keyof RegistrationRow] as string | null,
    nationality: row[`${prefix}_nationality` as keyof RegistrationRow] as string | null,
    addressLine: row[`${prefix}_address_line` as keyof RegistrationRow] as string | null,
    municipality: row[`${prefix}_municipality` as keyof RegistrationRow] as string | null,
    province: row[`${prefix}_province` as keyof RegistrationRow] as string | null,
  };
}

function mapRegistration(row: RegistrationRow) {
  const student = personFromRow(row, 'student');
  const guardian = row.guardian_person_id && row.guardian_name
    ? {
        ...personFromRow(row, 'guardian'),
        relationship: row.guardian_relationship,
        isPrimary: row.guardian_is_primary ?? true,
        financialResponsible: row.guardian_financial_responsible ?? false,
        version: row.guardian_version,
      }
    : null;
  const readiness = registrationReadiness(student, guardian as RegistrationGuardian | null);
  return {
    enrollmentId: row.id,
    registrationVersion: row.registration_version,
    status: row.status,
    editable: canEditEnrollmentRegistration(row.status),
    student: { ...student, studentNumber: row.student_number, version: row.student_version },
    guardian,
    enrollment: {
      previousSchool: row.previous_school,
      notes: row.enrollment_notes,
    },
    readiness,
  };
}

async function loadRow(client: RegistrationQueryClient, institutionId: string, enrollmentId: string): Promise<RegistrationRow | null> {
  const result = await client.query<RegistrationRow>(REGISTRATION_SELECT, [enrollmentId, institutionId]);
  return result.rowCount ? result.rows[0] : null;
}

export async function loadEnrollmentRegistration(
  client: RegistrationQueryClient,
  context: InstitutionalContext,
  enrollmentId: string,
) {
  if (!canManageEnrollment(context.role)) throw new EnrollmentRegistrationApiError('FORBIDDEN', 'O seu papel não pode gerir matrículas.');
  const row = await loadRow(client, context.institutionId, enrollmentId);
  if (!row) throw new EnrollmentRegistrationApiError('NOT_FOUND', 'Matrícula não encontrada nesta instituição.');
  return mapRegistration(row);
}

export async function getEnrollmentRegistrationReadiness(
  client: RegistrationQueryClient,
  institutionId: string,
  enrollmentId: string,
): Promise<RegistrationReadiness | null> {
  const row = await loadRow(client, institutionId, enrollmentId);
  if (!row) return null;
  const student = personFromRow(row, 'student');
  const guardian = row.guardian_person_id && row.guardian_name
    ? { ...personFromRow(row, 'guardian'), relationship: row.guardian_relationship }
    : null;
  return registrationReadiness(student, guardian);
}

async function findLocalGuardian(
  client: RegistrationQueryClient,
  institutionId: string,
  studentPersonId: string,
  identity: { nationalIdNumber: string | null; email: string | null; whatsapp: string | null; phone: string | null },
): Promise<string | null> {
  if (!identity.nationalIdNumber && !identity.email && !identity.whatsapp && !identity.phone) return null;
  const matches = await client.query<{ id: string }>(
    `SELECT DISTINCT p.id
       FROM people p
      WHERE p.id <> $2
        AND (
          ($3::text IS NOT NULL AND lower(p.national_id_number) = lower($3)) OR
          ($4::text IS NOT NULL AND lower(p.email) = lower($4)) OR
          ($5::text IS NOT NULL AND p.whatsapp = $5) OR
          ($6::text IS NOT NULL AND p.phone = $6)
        )
        AND (
          EXISTS (SELECT 1 FROM memberships m WHERE m.person_id = p.id AND m.institution_id = $1) OR
          EXISTS (SELECT 1 FROM student_profiles sp WHERE sp.person_id = p.id AND sp.institution_id = $1) OR
          EXISTS (SELECT 1 FROM guardian_relationships gr WHERE gr.guardian_person_id = p.id AND gr.institution_id = $1)
        )
      LIMIT 2`,
    [institutionId, studentPersonId, identity.nationalIdNumber, identity.email, identity.whatsapp, identity.phone],
  );
  if ((matches.rowCount ?? 0) > 1) {
    throw new EnrollmentRegistrationApiError('AMBIGUOUS_GUARDIAN', 'Encontrámos mais de um responsável local com os mesmos contactos. Reveja os dados antes de continuar.');
  }
  return matches.rows[0]?.id ?? null;
}

export async function saveEnrollmentRegistration(
  pool: RegistrationPool,
  context: InstitutionalContext,
  enrollmentId: string,
  body: any,
) {
  if (!canManageEnrollment(context.role)) throw new EnrollmentRegistrationApiError('FORBIDDEN', 'O seu papel não pode gerir matrículas.');
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new EnrollmentRegistrationApiError('INVALID_INPUT', 'Cadastro de matrícula inválido.');
  if (!body.student || typeof body.student !== 'object' || Array.isArray(body.student)) throw new EnrollmentRegistrationApiError('INVALID_INPUT', 'Indique os dados do aluno.');
  const expectedRegistrationVersion = expectedVersion(body.expectedRegistrationVersion);
  const expectedStudentVersion = expectedVersion(body.student.expectedVersion);

  const student = {
    name: requiredName(body.student.name),
    birthDate: dateOrNull(body.student.birthDate),
    phone: trimOrNull(body.student.phone, 40),
    whatsapp: trimOrNull(body.student.whatsapp, 40),
    email: emailOrNull(body.student.email),
    nationalIdNumber: trimOrNull(body.student.nationalIdNumber, 80),
    gender: genderOrNull(body.student.gender),
    nationality: trimOrNull(body.student.nationality, 80),
    addressLine: trimOrNull(body.student.addressLine, 240),
    municipality: trimOrNull(body.student.municipality, 120),
    province: trimOrNull(body.student.province, 120),
    studentNumber: trimOrNull(body.student.studentNumber, 80),
  };

  const guardianInput = body.guardian && typeof body.guardian === 'object' && !Array.isArray(body.guardian) && trimOrNull(body.guardian.name, 160)
    ? {
        expectedVersion: body.guardian.expectedVersion,
        name: requiredName(body.guardian.name),
        birthDate: dateOrNull(body.guardian.birthDate),
        phone: trimOrNull(body.guardian.phone, 40),
        whatsapp: trimOrNull(body.guardian.whatsapp, 40),
        email: emailOrNull(body.guardian.email),
        nationalIdNumber: trimOrNull(body.guardian.nationalIdNumber, 80),
        gender: genderOrNull(body.guardian.gender),
        nationality: trimOrNull(body.guardian.nationality, 80),
        addressLine: trimOrNull(body.guardian.addressLine, 240),
        municipality: trimOrNull(body.guardian.municipality, 120),
        province: trimOrNull(body.guardian.province, 120),
        relationship: trimOrNull(body.guardian.relationship, 80),
        financialResponsible: Boolean(body.guardian.financialResponsible),
      }
    : null;

  const previousSchool = trimOrNull(body.enrollment?.previousSchool, 200);
  const notes = trimOrNull(body.enrollment?.notes, 1000);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const locked = await client.query<{ status: EnrollmentStatus; registration_version: string; student_person_id: string; guardian_person_id: string | null }>(
      `SELECT status, registration_version, student_person_id, guardian_person_id
         FROM enrollment_applications
        WHERE id = $1 AND institution_id = $2
        FOR UPDATE`,
      [enrollmentId, context.institutionId],
    );
    if (!locked.rowCount) throw new EnrollmentRegistrationApiError('NOT_FOUND', 'Matrícula não encontrada nesta instituição.');
    const application = locked.rows[0];
    if (BigInt(application.registration_version) !== expectedRegistrationVersion) {
      throw new EnrollmentRegistrationApiError('STALE_VERSION', 'O registo foi alterado entretanto. Recarregue e reveja antes de submeter novamente.');
    }
    if (!canEditEnrollmentRegistration(application.status)) {
      throw new EnrollmentRegistrationApiError('IMMUTABLE', 'Este processo já não aceita alterações ao cadastro.');
    }
    const lockedStudent = await client.query<{ version: string }>(
      'SELECT version FROM people WHERE id = $1 FOR UPDATE',
      [application.student_person_id],
    );
    if (!lockedStudent.rowCount || BigInt(lockedStudent.rows[0].version) !== expectedStudentVersion) {
      throw new EnrollmentRegistrationApiError('STALE_VERSION', 'O registo foi alterado entretanto. Recarregue e reveja antes de submeter novamente.');
    }
    const currentStudent = await client.query<{ national_id_number: string | null }>(
      'SELECT national_id_number FROM people WHERE id = $1',
      [application.student_person_id],
    );
    const studentMaterialChanged = currentStudent.rows[0]?.national_id_number !== student.nationalIdNumber;
    if (studentMaterialChanged) {
      const resolution = await resolvePersonForInstitution(client, context.institutionId, {
        name: student.name,
        birthDate: student.birthDate,
        phone: student.phone,
        nationalIdNumber: student.nationalIdNumber,
      });
      if (resolution.status !== 'NO_MATCH' && resolution.candidatePersonId !== application.student_person_id) {
        throw new EnrollmentRegistrationApiError('IDENTITY_COLLISION', 'Não foi possível validar a identidade para esta alteração. Reveja os dados antes de continuar.');
      }
    }

    await client.query(
      `UPDATE people
          SET name = $1, birth_date = $2::date, phone = $3, whatsapp = $4, email = $5,
              national_id_number = $6, gender = $7, nationality = $8,
              address_line = $9, municipality = $10, province = $11, version = version + 1, updated_at = now()
        WHERE id = $12`,
      [student.name, student.birthDate, student.phone, student.whatsapp, student.email, student.nationalIdNumber,
        student.gender, student.nationality, student.addressLine, student.municipality, student.province, application.student_person_id],
    );

    await client.query(
      `UPDATE student_profiles
          SET student_number = $1, updated_at = now()
        WHERE institution_id = $2 AND person_id = $3`,
      [student.studentNumber, context.institutionId, application.student_person_id],
    );

    let guardianPersonId = application.guardian_person_id;
    if (guardianInput) {
      if (guardianPersonId) {
        const guardianVersion = expectedVersion(guardianInput.expectedVersion);
        const lockedGuardian = await client.query<{ version: string; national_id_number: string | null }>(
          'SELECT version, national_id_number FROM people WHERE id = $1 FOR UPDATE',
          [guardianPersonId],
        );
        if (!lockedGuardian.rowCount || BigInt(lockedGuardian.rows[0].version) !== guardianVersion) {
          throw new EnrollmentRegistrationApiError('STALE_VERSION', 'O registo foi alterado entretanto. Recarregue e reveja antes de submeter novamente.');
        }
        if (lockedGuardian.rows[0].national_id_number !== guardianInput.nationalIdNumber) {
          const resolution = await resolvePersonForInstitution(client, context.institutionId, {
            name: guardianInput.name,
            birthDate: guardianInput.birthDate,
            phone: guardianInput.phone,
            nationalIdNumber: guardianInput.nationalIdNumber,
          });
          if (resolution.status !== 'NO_MATCH' && resolution.candidatePersonId !== guardianPersonId) {
            throw new EnrollmentRegistrationApiError('IDENTITY_COLLISION', 'Não foi possível validar a identidade para esta alteração. Reveja os dados antes de continuar.');
          }
        }
      }
      if (!guardianPersonId) {
        guardianPersonId = await findLocalGuardian(client, context.institutionId, application.student_person_id, guardianInput);
      }
      if (!guardianPersonId) {
        const createdGuardian = await client.query<{ id: string }>(
          `INSERT INTO people
            (name, birth_date, phone, whatsapp, email, national_id_number, gender, nationality, address_line, municipality, province)
           VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id`,
          [guardianInput.name, guardianInput.birthDate, guardianInput.phone, guardianInput.whatsapp, guardianInput.email,
            guardianInput.nationalIdNumber, guardianInput.gender, guardianInput.nationality, guardianInput.addressLine,
            guardianInput.municipality, guardianInput.province],
        );
        guardianPersonId = createdGuardian.rows[0].id;
      } else {
        await client.query(
          `UPDATE people
              SET name = $1, birth_date = $2::date, phone = $3, whatsapp = $4, email = $5,
                  national_id_number = $6, gender = $7, nationality = $8,
                  address_line = $9, municipality = $10, province = $11, version = version + 1, updated_at = now()
            WHERE id = $12`,
          [guardianInput.name, guardianInput.birthDate, guardianInput.phone, guardianInput.whatsapp, guardianInput.email,
            guardianInput.nationalIdNumber, guardianInput.gender, guardianInput.nationality, guardianInput.addressLine,
            guardianInput.municipality, guardianInput.province, guardianPersonId],
        );
      }

      await client.query(
        `UPDATE guardian_relationships
            SET is_primary = false, updated_at = now()
          WHERE institution_id = $1 AND student_person_id = $2 AND guardian_person_id <> $3 AND status = 'active'`,
        [context.institutionId, application.student_person_id, guardianPersonId],
      );
      await client.query(
        `INSERT INTO guardian_relationships
          (institution_id, guardian_person_id, student_person_id, relationship, status, is_primary, financial_responsible)
         VALUES ($1, $2, $3, $4, 'active', true, $5)
         ON CONFLICT (institution_id, guardian_person_id, student_person_id)
         DO UPDATE SET relationship = EXCLUDED.relationship, status = 'active', is_primary = true,
                       financial_responsible = EXCLUDED.financial_responsible, updated_at = now()`,
        [context.institutionId, guardianPersonId, application.student_person_id, guardianInput.relationship || 'Responsável', guardianInput.financialResponsible],
      );
    }

    await client.query(
      `UPDATE enrollment_applications
              SET guardian_person_id = COALESCE($1::uuid, guardian_person_id),
              previous_school = $2, enrollment_notes = $3,
              updated_by = $4, registration_version = registration_version + 1,
              lifecycle_version = lifecycle_version + 1, updated_at = now()
        WHERE id = $5 AND institution_id = $6`,
      [guardianPersonId, previousSchool, notes, context.personId, enrollmentId, context.institutionId],
    );

    const updatedRow = await loadRow(client, context.institutionId, enrollmentId);
    if (!updatedRow) throw new EnrollmentRegistrationApiError('NOT_FOUND', 'Matrícula não encontrada após atualização.');
    const registration = mapRegistration(updatedRow);
    await client.query(
      `INSERT INTO enrollment_events
        (institution_id, enrollment_application_id, actor_person_id, event_type, metadata)
       VALUES ($1, $2, $3, 'registration_updated', $4::jsonb)`,
      [context.institutionId, enrollmentId, context.personId, JSON.stringify({
        operation: 'registration_updated',
        result: 'success',
        categories: [studentMaterialChanged ? 'identity_material' : 'profile_only'],
        previousVersions: { registration: application.registration_version, student: lockedStudent.rows[0].version },
        newVersions: { registration: registration.registrationVersion, student: registration.student.version },
      })],
    );
    await client.query('COMMIT');
    return registration;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
