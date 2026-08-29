import assert from 'node:assert/strict';
import {
  buildOperationalMetrics,
  getAttentionQueue,
  nextAction,
  pipelineCounts,
  recordsForView,
  type EnrollmentOperationalRecord,
} from '../src/modules/enrollments/enrollment-operations-model.ts';

const now = '2026-08-12T10:00:00.000Z';
const record = (id: string, status: EnrollmentOperationalRecord['status'], updated_at = now): EnrollmentOperationalRecord => ({
  id,
  student_ref: `opaque-${id}`,
  status,
  student_name: `Aluno ${id}`,
  guardian_name: null,
  offer_name: 'Ensino regular',
  academic_year_name: '2026/2027',
  created_at: now,
  updated_at,
});

const records = [
  record('1', 'draft'),
  record('2', 'under_review'),
  record('3', 'awaiting_documents'),
  record('4', 'validated'),
  record('5', 'blocked'),
  record('6', 'active'),
  record('7', 'cancelled'),
];

const metrics = buildOperationalMetrics(records);
assert.equal(metrics.find((item) => item.id === 'new')?.value, 1);
assert.equal(metrics.find((item) => item.id === 'inProgress')?.value, 4);
assert.equal(metrics.find((item) => item.id === 'attention')?.value, 2);
assert.equal(metrics.find((item) => item.id === 'ready')?.value, 1);

const pipeline = pipelineCounts(records);
assert.equal(pipeline.find((item) => item.id === 'entry')?.count, 1);
assert.equal(pipeline.find((item) => item.id === 'identity')?.count, null);
assert.equal(pipeline.find((item) => item.id === 'financial')?.count, null);
assert.equal(pipeline.find((item) => item.id === 'activation')?.count, 1);

const queue = getAttentionQueue(records);
assert.equal(queue[0].status, 'blocked');
assert.equal(queue[1].status, 'awaiting_documents');
assert.ok(!queue.some((item) => item.status === 'active'));
assert.ok(!queue.some((item) => item.status === 'cancelled'));

assert.deepEqual(recordsForView(records, 'entries').map((item) => item.status), ['draft']);
assert.deepEqual(recordsForView(records, 'students').map((item) => item.status), ['active']);
assert.ok(recordsForView(records, 'enrollments').every((item) => !['active', 'cancelled'].includes(item.status)));

assert.equal(nextAction(record('x', 'blocked')), 'Resolver bloqueio');
assert.equal(nextAction(record('x', 'active')), 'Abrir registo do aluno');

console.log('Enrollment operations model tests passed (17 assertions).');
