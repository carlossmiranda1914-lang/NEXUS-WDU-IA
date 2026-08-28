import assert from 'node:assert/strict';
import * as academic from '../src/modules/academic/academic-structure-api.ts';

// Removing the temporal command surface must break this contract: callers must
// replace rather than overwrite assignments, and must be able to read history.
assert.equal(typeof (academic as Record<string, unknown>).replaceTeacher, 'function');
assert.equal(typeof (academic as Record<string, unknown>).listTeacherAssignments, 'function');
console.log('[ACADEMIC-01-TEACHER-ASSIGNMENT-CONTRACT] replacement/history commands: PASS.');
