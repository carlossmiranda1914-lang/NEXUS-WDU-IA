import { readFile } from 'node:fs/promises';

const controller = await readFile('src/modules/enrollments/enrollment.controller.ts', 'utf8');
const policy = await readFile('src/modules/enrollments/enrollment-policy.ts', 'utf8');
const activation = await readFile('src/modules/enrollments/enrollment-activation-api.ts', 'utf8');
const failures: string[] = [];

if (!controller.includes("app.post('/api/enrollments/:id/transitions'")) failures.push('transition endpoint missing');
if (!controller.includes('institution_id = $2 FOR UPDATE')) failures.push('transition must lock institution-scoped record');
if (!controller.includes('canTransitionEnrollment(context.role, from, target)')) failures.push('transition must enforce policy');
if (!controller.includes("'status_changed'")) failures.push('transition must write audit event');
if (!controller.includes('actor_person_id')) failures.push('transition audit must include actor');
if (policy.includes("validated: ['active'")) failures.push('generic transition policy must not allow active');
if (!activation.includes("return role === 'institution_admin' || role === 'director';")) failures.push('canonical activation must remain leadership-only');
if (!policy.includes("draft: ['under_review', 'cancelled']")) failures.push('draft transition contract changed unexpectedly');

if (failures.length) throw new Error(failures.join('\n'));
console.log('Secretariat S02.2 backend contract passed (7 assertions).');
