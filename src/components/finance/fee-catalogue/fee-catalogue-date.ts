/**
 * Canonical Date and Time Utilities for Fee Catalogue UI & Scheduling.
 *
 * Enforces minute-precision safety for HTML datetime-local inputs and guarantees
 * that automatically proposed next versions are strictly posterior to active versions.
 */

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * Converts a Date into a `YYYY-MM-DDTHH:mm` string based on local wall-clock time.
 * Avoids naive `toISOString().slice(0, 16)` which converts to UTC and causes offset shifts.
 */
export function toLocalDatetimeInputValue(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const min = pad2(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

/**
 * Parses a `YYYY-MM-DDTHH:mm` string as a local Date.
 */
export function parseLocalDatetimeInput(value: string): Date {
  const [datePart, timePart = '00:00'] = value.split('T');
  const [yyyy, mm, dd] = datePart.split('-').map(Number);
  const [hh, min] = timePart.split(':').map(Number);
  return new Date(yyyy, mm - 1, dd, hh || 0, min || 0, 0, 0);
}

/**
 * Computes the canonical next valid effective date string formatted for `<input type="datetime-local">`.
 *
 * Rules:
 * 1. Must be strictly greater than `currentEffectiveFrom` in timestamp value:
 *    `parsed(candidate).getTime() > new Date(currentEffectiveFrom).getTime()`
 * 2. If `currentEffectiveFrom` is in the past, defaults to current time (rounded up to the next minute boundary).
 * 3. If `currentEffectiveFrom` is in the future, defaults to `currentEffectiveFrom` + 1 hour (or smallest safe minute boundary).
 * 4. Truncation to minute precision by the datetime-local input is accounted for to prevent timestamp collision.
 */
export function nextValidEffectiveFrom(currentEffectiveFromIso: string, now: Date = new Date()): string {
  const current = new Date(currentEffectiveFromIso);
  const currentMs = current.getTime();

  // If currentEffectiveFrom is invalid, fall back to now rounded to next minute
  if (Number.isNaN(currentMs)) {
    const fallback = new Date(Math.floor(now.getTime() / 60000) * 60000 + 60000);
    return toLocalDatetimeInputValue(fallback);
  }

  // Calculate candidate: next minute from now OR next minute from currentEffectiveFrom
  const nowMs = now.getTime();
  const nowNextMinute = Math.floor(nowMs / 60000) * 60000 + 60000;
  const currentNextMinute = Math.floor(currentMs / 60000) * 60000 + 60000;

  let candidateMs = Math.max(nowNextMinute, currentNextMinute);
  let candidateDate = new Date(candidateMs);

  // Validate that after formatting to YYYY-MM-DDTHH:mm and parsing back, it remains strictly posterior
  let formatted = toLocalDatetimeInputValue(candidateDate);
  let parsed = parseLocalDatetimeInput(formatted);

  while (parsed.getTime() <= currentMs) {
    candidateMs += 60000; // Add 1 minute
    candidateDate = new Date(candidateMs);
    formatted = toLocalDatetimeInputValue(candidateDate);
    parsed = parseLocalDatetimeInput(formatted);
  }

  return formatted;
}

/**
 * Formats an ISO string to a localized date and time string in Portuguese.
 */
export function formatDisplayDateTime(isoString?: string | null): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formats an ISO string to a localized date string in Portuguese.
 */
export function formatDisplayDate(isoString?: string | null): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
