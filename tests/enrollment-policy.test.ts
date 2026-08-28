import { canConfigureEnrollment, canManageEnrollment, canTransitionEnrollment, isEnrollmentStatus } from '../src/modules/enrollments/enrollment-policy.ts';

const failures: string[] = [];
function expect(condition: unknown, message: string) { if (!condition) failures.push(message); }

expect(canConfigureEnrollment('institution_admin'), 'Institution admin must configure enrollment.');
expect(canConfigureEnrollment('director'), 'Director must configure enrollment.');
expect(!canConfigureEnrollment('secretariat'), 'Secretariat must not configure enrollment.');

expect(canManageEnrollment('secretariat'), 'Secretaria deve poder gerir matrículas.');
expect(!canManageEnrollment('student'), 'Aluno não pode gerir matrículas.');
expect(canTransitionEnrollment('secretariat', 'draft', 'under_review'), 'Secretaria deve submeter rascunho para análise.');
expect(!canTransitionEnrollment('secretariat', 'validated', 'active'), 'Secretaria não pode ativar matrícula.');
expect(!canTransitionEnrollment('director', 'validated', 'active'), 'Direção deve ativar apenas pelo comando canónico, nunca por transição genérica.');
expect(!canTransitionEnrollment('teacher', 'under_review', 'validated'), 'Professor não pode validar matrícula.');
expect(!canTransitionEnrollment('director', 'cancelled', 'draft'), 'Matrícula cancelada não pode ser reaberta por transição implícita.');
expect(isEnrollmentStatus('awaiting_documents'), 'Estado válido deve ser reconhecido.');
expect(!isEnrollmentStatus('approved'), 'Estado legado não pode ser aceite.');

if (failures.length) throw new Error(failures.join('\n'));
console.log('Enrollment policy tests passed (9 assertions).');
