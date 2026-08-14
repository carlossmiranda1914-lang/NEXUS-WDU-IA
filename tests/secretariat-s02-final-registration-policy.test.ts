import {
  canEditEnrollmentRegistration,
  registrationReadiness,
} from '../src/modules/enrollments/enrollment-registration-policy.ts';

let assertions = 0;
const assert = (condition: unknown, message: string) => { assertions += 1; if (!condition) throw new Error(message); };

const completeStudent = {
  name: 'Ana Manuel',
  birthDate: '2012-05-04',
  whatsapp: '923000000',
  gender: 'female',
  nationality: 'Angolana',
  province: 'Luanda',
  municipality: 'Talatona',
  addressLine: 'Rua 1, Casa 2',
};
const completeGuardian = {
  name: 'Maria Manuel',
  relationship: 'Mãe',
  phone: '923111111',
};

assert(canEditEnrollmentRegistration('draft'), 'Draft registration must be editable.');
assert(canEditEnrollmentRegistration('under_review'), 'Under-review registration must be editable.');
assert(canEditEnrollmentRegistration('awaiting_documents'), 'Awaiting-documents registration must be editable.');
assert(canEditEnrollmentRegistration('blocked'), 'Blocked registration must be editable.');
assert(!canEditEnrollmentRegistration('validated'), 'Validated registration must be read-only.');
assert(!canEditEnrollmentRegistration('active'), 'Active registration must be read-only.');
assert(!canEditEnrollmentRegistration('cancelled'), 'Cancelled registration must be read-only.');

const complete = registrationReadiness(completeStudent, completeGuardian);
assert(complete.ready, 'Complete student and guardian data must be ready.');
assert(complete.missing.length === 0, 'Ready registration must have no missing fields.');

const withoutGuardian = registrationReadiness(completeStudent, null);
assert(!withoutGuardian.ready && withoutGuardian.missing.includes('guardian'), 'Guardian must be required before validation.');

const withoutAddress = registrationReadiness({ ...completeStudent, addressLine: '' }, completeGuardian);
assert(!withoutAddress.ready && withoutAddress.missing.includes('student.addressLine'), 'Student address must be required.');

const withoutStudentContact = registrationReadiness({ ...completeStudent, whatsapp: '' }, completeGuardian);
assert(!withoutStudentContact.ready && withoutStudentContact.missing.includes('student.contact'), 'Student needs at least one contact channel.');

const emailOnly = registrationReadiness({ ...completeStudent, whatsapp: '', email: 'ana@example.com' }, completeGuardian);
assert(emailOnly.ready, 'Email alone must satisfy the student contact requirement.');

const guardianWithoutContact = registrationReadiness(completeStudent, { ...completeGuardian, phone: '' });
assert(!guardianWithoutContact.ready && guardianWithoutContact.missing.includes('guardian.contact'), 'Guardian needs at least one contact channel.');

console.log(`Secretariat S02 final registration policy passed (${assertions} assertions).`);
