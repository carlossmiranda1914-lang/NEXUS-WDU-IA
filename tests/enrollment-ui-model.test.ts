import { enrollmentResolutionUi } from '../src/modules/enrollments/enrollment-ui-model.ts';

const failures: string[] = [];
let assertions = 0;
function expect(condition: unknown, message: string) { assertions += 1; if (!condition) failures.push(message); }

const noMatch = enrollmentResolutionUi({ status: 'NO_MATCH', candidateCount: 0 });
expect(noMatch.canStart === true, 'NO_MATCH with backend confirmation must allow normal intake.');
expect(noMatch.requiresReview === false, 'NO_MATCH must not invent a review requirement.');

const local = enrollmentResolutionUi({ status: 'LOCAL_MATCH', candidateCount: 1, candidatePersonId: 'local-person' });
expect(local.canStart === true, 'LOCAL_MATCH must allow intake without duplicate Person creation.');
expect(local.title.includes('nesta escola'), 'LOCAL_MATCH must use institutional, non-technical language.');

const restricted = enrollmentResolutionUi({ status: 'RESTRICTED_POSSIBLE_MATCH', candidateCount: 1 });
expect(restricted.canStart === false, 'Restricted match must never allow immediate intake.');
expect(restricted.requiresReview === true, 'Restricted match must require authorized confirmation.');
expect(!restricted.description.toLowerCase().includes('person id'), 'Restricted copy must not expose global Person identifiers.');
expect(!restricted.description.toLowerCase().includes('instituição de origem'), 'Restricted copy must not reveal candidate origin.');

const multiple = enrollmentResolutionUi({ status: 'MULTIPLE_MATCHES', candidateCount: 2, localCandidates: [{ personId: 'a', name: 'A', birthDate: null }] });
expect(multiple.canStart === false, 'MULTIPLE_MATCHES must never auto-start intake.');
expect(multiple.showLocalCandidates === true, 'Multiple local candidates may be shown for explicit review.');

const review = enrollmentResolutionUi({ status: 'REVIEW_REQUIRED', candidateCount: 0 });
expect(review.canStart === false, 'REVIEW_REQUIRED must stay fail-closed.');
expect(review.requiresReview === true, 'REVIEW_REQUIRED must remain in review.');

const reusable = enrollmentResolutionUi({ status: 'REUSABLE_MATCH', candidateCount: 1 });
expect(reusable.canStart === false, 'Cross-institution reusable match must not start without authority.');
expect(reusable.requiresReview === true, 'Reusable external match requires authorized confirmation.');

if (failures.length) throw new Error(failures.join('\n'));
console.log(`Enrollment UI model tests passed (${assertions} assertions).`);
