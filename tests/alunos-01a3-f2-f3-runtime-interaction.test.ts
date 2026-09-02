import assert from 'node:assert/strict';
import React from 'react';
// react-test-renderer is intentionally test-only and supplies the executable
// component interaction harness without a production dependency.
import { act, create } from 'react-test-renderer';
import EnrollmentOperationsWorkspace from '../src/components/EnrollmentOperationsWorkspace.tsx';
import { auth } from '../src/lib/firebase.ts';

const enrollmentId = 'enrollment-f2-f3-runtime';
const studentRef = 'stu_0123456789012345678901';
const originalFetch = globalThis.fetch;
const currentUserDescriptor = Object.getOwnPropertyDescriptor(auth, 'currentUser');

let recordVersion = 1;
let enrollmentStatus: 'draft' | 'validated' | 'active' = 'draft';
let activationRequest: Record<string, unknown> | null = null;
let openedStudentRef: string | null = null;

function response(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function record() {
  return {
    id: enrollmentId,
    status: enrollmentStatus,
    student_name: 'Aluno Runtime',
    guardian_name: 'Encarregada Runtime',
    offer_name: 'Ensino Geral',
    academic_year_name: '2026',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: `2026-01-0${recordVersion}T00:00:00.000Z`,
    lifecycle_version: String(recordVersion),
    registration_version: String(recordVersion),
  };
}

function processProjection() {
  const active = enrollmentStatus === 'active';
  return {
    process: {
      enrollmentId,
      enrollmentStatus,
      currentStage: 'P06',
      stages: [{
        key: 'P06',
        label: 'Decisão',
        status: active ? 'completed' : 'in_progress',
        blockerCode: null,
        action: null,
        evidence: { summary: active ? 'Ativação confirmada.' : 'Pronta para ativação.' },
      }],
      progress: { percent: active ? 100 : 90, completed: active ? 6 : 5, applicable: 6 },
      blockers: [],
      nextAction: null,
      assignedTo: null,
      version: recordVersion,
      timestamps: { startedAt: '2026-01-01T00:00:00.000Z', lastProgressAt: '2026-01-01T00:00:00.000Z', blockedAt: null, updatedAt: '2026-01-01T00:00:00.000Z' },
    },
  };
}

function registration() {
  return {
    registration: {
      enrollmentId,
      registrationVersion: String(recordVersion),
      status: enrollmentStatus,
      editable: enrollmentStatus !== 'active',
      student: { name: 'Aluno Runtime', birthDate: '2013-01-01', phone: '900000000', whatsapp: null, email: null, nationalIdNumber: null, gender: 'other', nationality: 'Angolana', addressLine: 'Rua', municipality: 'Luanda', province: 'Luanda', studentNumber: null, version: String(recordVersion) },
      guardian: { name: 'Encarregada Runtime', birthDate: '1980-01-01', phone: '911111111', whatsapp: null, email: null, nationalIdNumber: null, gender: 'female', nationality: 'Angolana', addressLine: 'Rua', municipality: 'Luanda', province: 'Luanda', relationship: 'Mãe', financialResponsible: true, version: String(recordVersion) },
      enrollment: { previousSchool: null, notes: null },
      readiness: { ready: true, missing: [] },
    },
  };
}

function textOf(node: any): string {
  return node.children.map((child) => typeof child === 'string' ? child : textOf(child)).join('');
}

function button(renderer: any, label: string): any {
  const found = renderer.root.findAll((node) => node.type === 'button' && textOf(node) === label);
  assert.equal(found.length, 1, `Expected exactly one rendered button labelled ${label}.`);
  return found[0];
}

function buttonContaining(renderer: any, text: string): any {
  const found = renderer.root.findAll((node) => node.type === 'button' && textOf(node).includes(text));
  assert.equal(found.length, 1, `Expected exactly one rendered button containing ${text}.`);
  return found[0];
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
}

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as any).requestAnimationFrame = (callback: FrameRequestCallback) => { callback(0); return 1; };
(globalThis as any).cancelAnimationFrame = () => undefined;
(globalThis as any).fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const path = typeof input === 'string' ? input : input.toString();
  if (path === '/api/enrollments/context') return response({ offers: [], institution: { name: 'Escola Runtime' }, permissions: { canActivateEnrollment: true } });
  if (path === '/api/enrollments') return response({ enrollments: [record()] });
  if (path === '/api/active-students') return response({ students: enrollmentStatus === 'active' ? [{ studentRef, displayName: 'Aluno Runtime', status: 'active', current: null }] : [] });
  if (path === `/api/enrollments/${enrollmentId}/process`) return response(processProjection());
  if (path === `/api/enrollments/${enrollmentId}/documents`) return response({ documents: [], readiness: { ready: false, reason: 'POLICY_NOT_CAPTURED', requiredCount: 0, pendingCount: 0, submittedCount: 0 }, configuration: { allowed: false } });
  if (path === `/api/enrollments/${enrollmentId}/registration` && (!init.method || init.method === 'GET')) return response(registration());
  if (path === `/api/enrollments/${enrollmentId}/registration` && init.method === 'PUT') {
    recordVersion = 2;
    // The controlled server refresh supplies the next canonical record. The
    // test does not infer this client-side; activation only becomes available
    // after the returned parent read says `validated`.
    enrollmentStatus = 'validated';
    return response(registration());
  }
  if (path === `/api/enrollments/${enrollmentId}/activate` && init.method === 'POST') {
    activationRequest = JSON.parse(String(init.body));
    assert.deepEqual(activationRequest, { expectedLifecycleVersion: '2', expectedRegistrationVersion: '2' }, 'Activation must use refreshed V2 versions from the still-open drawer.');
    enrollmentStatus = 'active';
    return response({ activation: { studentRef } }, 201);
  }
  throw new Error(`Unexpected runtime test request: ${init.method || 'GET'} ${path}`);
};

let renderer: any;
try {
  await auth.authStateReady();
  Object.defineProperty(auth, 'currentUser', {
    configurable: true,
    get: () => ({ getIdToken: async () => 'runtime-token' }),
  });
  await act(async () => {
    renderer = create(React.createElement(EnrollmentOperationsWorkspace, { onOpenStudentRecord: (value) => { openedStudentRef = value; } }));
    await settle();
  });
  assert.ok(renderer);

  await act(async () => {
    buttonContaining(renderer!, 'Aluno Runtime').props.onClick();
    await settle();
  });
  await act(async () => {
    button(renderer!, 'Guardar cadastro').props.onClick();
    await settle();
  });

  await act(async () => {
    button(renderer!, 'Ativar aluno').props.onClick();
    await settle();
  });
  assert.deepEqual(activationRequest, { expectedLifecycleVersion: '2', expectedRegistrationVersion: '2' }, 'F2: the V1 record must never be submitted after a same-drawer registration refresh.');

  assert.ok(button(renderer!, 'Abrir Registo do Aluno'), 'F3: an active process with no generic transition target must retain the handoff action.');
  await act(async () => {
    button(renderer!, 'Abrir Registo do Aluno').props.onClick();
    await settle();
  });
  assert.equal(openedStudentRef, studentRef, 'F3: the rendered handoff must use exactly the server-returned opaque studentRef.');
  console.log('[ALUNOS-01A.3] F2/F3 runtime same-drawer interaction: PASS.');
} finally {
  if (renderer) {
    await act(async () => {
      renderer!.unmount();
      await settle();
    });
  }
  globalThis.fetch = originalFetch;
  if (currentUserDescriptor) Object.defineProperty(auth, 'currentUser', currentUserDescriptor);
  else delete (auth as any).currentUser;
}
