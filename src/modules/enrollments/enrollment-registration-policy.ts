import type { EnrollmentStatus } from './enrollment-policy.ts';

export type RegistrationPerson = {
  name?: string | null;
  birthDate?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  nationalIdNumber?: string | null;
  gender?: string | null;
  nationality?: string | null;
  addressLine?: string | null;
  municipality?: string | null;
  province?: string | null;
};

export type RegistrationGuardian = RegistrationPerson & {
  relationship?: string | null;
};

export type RegistrationReadiness = {
  ready: boolean;
  missing: string[];
};

const MUTABLE_STATUSES: EnrollmentStatus[] = ['draft', 'under_review', 'awaiting_documents', 'blocked'];

export function canEditEnrollmentRegistration(status: EnrollmentStatus): boolean {
  return MUTABLE_STATUSES.includes(status);
}

function hasText(value: unknown, minimum = 1): boolean {
  return typeof value === 'string' && value.trim().length >= minimum;
}

function hasContact(person: RegistrationPerson): boolean {
  return hasText(person.phone) || hasText(person.whatsapp) || hasText(person.email);
}

export function registrationReadiness(student: RegistrationPerson, guardian: RegistrationGuardian | null): RegistrationReadiness {
  const missing: string[] = [];
  if (!hasText(student.name, 3)) missing.push('student.name');
  if (!hasText(student.birthDate, 10)) missing.push('student.birthDate');
  if (!hasText(student.gender)) missing.push('student.gender');
  if (!hasText(student.nationality, 2)) missing.push('student.nationality');
  if (!hasText(student.province, 2)) missing.push('student.province');
  if (!hasText(student.municipality, 2)) missing.push('student.municipality');
  if (!hasText(student.addressLine, 3)) missing.push('student.addressLine');
  if (!hasContact(student)) missing.push('student.contact');

  if (!guardian) {
    missing.push('guardian');
  } else {
    if (!hasText(guardian.name, 3)) missing.push('guardian.name');
    if (!hasText(guardian.relationship, 2)) missing.push('guardian.relationship');
    if (!hasContact(guardian)) missing.push('guardian.contact');
  }

  return { ready: missing.length === 0, missing };
}

export const REGISTRATION_FIELD_LABELS: Record<string, string> = {
  'student.name': 'nome completo do aluno',
  'student.birthDate': 'data de nascimento',
  'student.gender': 'género',
  'student.nationality': 'nacionalidade',
  'student.province': 'província',
  'student.municipality': 'município',
  'student.addressLine': 'morada',
  'student.contact': 'contacto do aluno',
  guardian: 'encarregado/responsável',
  'guardian.name': 'nome do encarregado',
  'guardian.relationship': 'relação com o aluno',
  'guardian.contact': 'contacto do encarregado',
};
