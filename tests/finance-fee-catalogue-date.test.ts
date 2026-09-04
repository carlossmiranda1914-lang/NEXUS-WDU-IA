import assert from 'node:assert/strict';
import {
  toLocalDatetimeInputValue,
  parseLocalDatetimeInput,
  nextValidEffectiveFrom,
  formatDisplayDateTime,
  formatDisplayDate,
} from '../src/components/finance/fee-catalogue/fee-catalogue-date.ts';

// 1. toLocalDatetimeInputValue & parseLocalDatetimeInput round-trip
const testDate = new Date(2026, 8, 4, 18, 45, 0, 0); // Sept 4, 2026 18:45 local
const localStr = toLocalDatetimeInputValue(testDate);
assert.equal(localStr, '2026-09-04T18:45', 'Must format in YYYY-MM-DDTHH:mm format with local values');

const parsed = parseLocalDatetimeInput(localStr);
assert.equal(parsed.getFullYear(), 2026);
assert.equal(parsed.getMonth(), 8);
assert.equal(parsed.getDate(), 4);
assert.equal(parsed.getHours(), 18);
assert.equal(parsed.getMinutes(), 45);
assert.equal(parsed.getTime(), testDate.getTime());

// 2. Current version created in the past (common case)
const pastEffectiveIso = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
const now = new Date(2026, 8, 4, 19, 30, 15, 500); // 19:30:15.500
const proposedForPast = nextValidEffectiveFrom(pastEffectiveIso, now);

// Must be rounded up to next minute relative to now
assert.equal(proposedForPast, '2026-09-04T19:31');
const parsedProposedPast = parseLocalDatetimeInput(proposedForPast);
assert.ok(
  parsedProposedPast.getTime() > new Date(pastEffectiveIso).getTime(),
  'Proposed candidate must be strictly posterior to past effective date',
);

// 3. Current version created "now" with millisecond precision
const justNowDate = new Date(2026, 8, 4, 19, 30, 45, 999);
const justNowIso = justNowDate.toISOString();
const proposedForJustNow = nextValidEffectiveFrom(justNowIso, justNowDate);

const parsedProposedJustNow = parseLocalDatetimeInput(proposedForJustNow);
assert.ok(
  parsedProposedJustNow.getTime() > justNowDate.getTime(),
  'Proposed candidate must be strictly posterior even if version was created with sub-minute milliseconds',
);
assert.equal(proposedForJustNow, '2026-09-04T19:31');

// 4. Future-dated current version (e.g. effective in 10 days)
const futureEffectiveDate = new Date(2026, 8, 17, 10, 0, 0, 0); // Sept 17, 2026 10:00 local
const futureEffectiveIso = futureEffectiveDate.toISOString();
const nowBeforeFuture = new Date(2026, 8, 4, 12, 0, 0, 0);

const proposedForFuture = nextValidEffectiveFrom(futureEffectiveIso, nowBeforeFuture);
const parsedProposedFuture = parseLocalDatetimeInput(proposedForFuture);

assert.ok(
  parsedProposedFuture.getTime() > futureEffectiveDate.getTime(),
  'Proposed candidate must be strictly posterior to future effective date',
);
assert.equal(proposedForFuture, '2026-09-17T10:01');

// 5. Truncation to minute precision check
// If current is at 10:00:59.999, the next minute candidate at 10:01:00.000 must be > current
const endOfMinuteDate = new Date(2026, 8, 4, 10, 0, 59, 999);
const endOfMinuteIso = endOfMinuteDate.toISOString();
const proposedEndOfMinute = nextValidEffectiveFrom(endOfMinuteIso, endOfMinuteDate);
const parsedEndOfMinute = parseLocalDatetimeInput(proposedEndOfMinute);

assert.ok(
  parsedEndOfMinute.getTime() > endOfMinuteDate.getTime(),
  'Must exceed end of minute timestamp without collision',
);
assert.equal(proposedEndOfMinute, '2026-09-04T10:01');

// 6. Formatting utilities
assert.ok(formatDisplayDateTime(testDate.toISOString()).includes('04/09/2026'));
assert.ok(formatDisplayDate(testDate.toISOString()).includes('04/09/2026'));
assert.equal(formatDisplayDateTime(null), '—');
assert.equal(formatDisplayDate(null), '—');

console.log('Finance fee catalogue date utilities tests: PASS');
