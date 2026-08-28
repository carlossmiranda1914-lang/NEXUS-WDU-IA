import assert from 'node:assert/strict';
import * as academic from '../src/modules/academic/academic-structure-api.ts';

assert.equal(typeof (academic as Record<string, unknown>).placeStudent, 'function');
assert.equal(typeof (academic as Record<string, unknown>).replaceStudentPlacement, 'function');
assert.equal(typeof (academic as Record<string, unknown>).listStudentPlacements, 'function');
console.log('[ACADEMIC-01-STUDENT-PLACEMENT-CONTRACT] placement command surface: PASS.');
