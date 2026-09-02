import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import EnrollmentLifecycleActions from '../src/components/EnrollmentLifecycleActions.tsx';
import { reconcileSelectedEnrollmentRecord } from '../src/components/EnrollmentOperationsWorkspace.tsx';

const initial = { id: 'enrollment-1', lifecycle_version: '1', registration_version: '1' } as any;
const refreshed = { ...initial, lifecycle_version: '2', registration_version: '2' } as any;

assert.equal(
  reconcileSelectedEnrollmentRecord(initial, [refreshed]),
  refreshed,
  'A drawer that remains open after a server-confirmed registration save must use the refreshed server versions for activation.',
);

const activeMarkup = renderToStaticMarkup(
  createElement(EnrollmentLifecycleActions, {
    status: 'active',
    light: true,
    canActivate: false,
    onTransition: async () => undefined,
    activatedStudentRef: 'stu_0123456789012345678901',
    onOpenStudentRecord: () => undefined,
  }),
);
assert.match(
  activeMarkup,
  /Abrir Registo do Aluno/,
  'A terminal active process with a server-returned opaque student reference must preserve the Student Record handoff.',
);

console.log('[ALUNOS-01A.3] F2/F3 drawer continuity RED/GREEN contract: PASS.');
