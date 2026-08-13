import { Client } from 'pg';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const BACKFILL_DRY_RUN_DATABASE_URL = 'BACKFILL_DRY_RUN_DATABASE_URL';
export const PRIVILEGED_LEGACY_EMAIL = 'carlossmiranda1914@gmail.com';

export type Classification =
  | 'AUTO_MIGRATABLE'
  | 'PLACEHOLDER_UID'
  | 'DUPLICATE_UID'
  | 'DUPLICATE_EMAIL'
  | 'UID_EMAIL_CONFLICT'
  | 'MISSING_REQUIRED_DATA'
  | 'DEMO_OR_TEST'
  | 'PRIVILEGED_LEGACY'
  | 'NEEDS_REVIEW';

export type ReasonCode =
  | 'EMAIL_TRIMMED'
  | 'EMAIL_CASE_NORMALIZED'
  | 'INVALID_EMAIL'
  | 'MISSING_EMAIL'
  | 'MISSING_NAME'
  | 'MISSING_UID'
  | 'PLACEHOLDER_UID'
  | 'DUPLICATE_UID'
  | 'DUPLICATE_EMAIL'
  | 'UID_EMAIL_CONFLICT'
  | 'DEMO_OR_TEST_EVIDENCE'
  | 'PRIVILEGED_LEGACY_BOOTSTRAP';

export interface LegacyUserRecord {
  id: unknown;
  uid: unknown;
  email: unknown;
  name: unknown;
  phone?: unknown;
  createdAt?: unknown;
}

export interface ClassifiedUser {
  userId: string;
  maskedEmail: string | null;
  normalizedEmail: string | null;
  classification: Classification;
  reasonCodes: ReasonCode[];
}

export type DryRunSummary = Record<
  'totalUsers' | 'autoMigratable' | 'placeholderUid' | 'duplicateUid' | 'duplicateEmail' |
  'uidEmailConflict' | 'missingRequiredData' | 'demoOrTest' | 'privilegedLegacy' | 'needsReview',
  number
>;

export interface DryRunReport {
  summary: DryRunSummary;
  records: ClassifiedUser[];
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function normalizeEmail(value: unknown): string | null {
  const normalized = text(value).trim().toLowerCase();
  return normalized || null;
}

export function maskEmail(value: string | null): string | null {
  if (!value) return null;
  const [local, domain] = value.split('@');
  if (!local || !domain) return '***';
  return `${local.slice(0, 1)}***@${domain}`;
}

function isValidEmail(value: string | null): boolean {
  return value !== null && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isPlaceholderUid(uid: string): boolean {
  return /^uid_/i.test(uid.trim());
}

function hasDemoOrTestEvidence(user: LegacyUserRecord, normalizedEmail: string | null): boolean {
  const evidence = [text(user.uid), text(user.name), normalizedEmail || ''].join(' ').toLowerCase();
  return /(^|[^a-z0-9])(demo|test)([^a-z0-9]|$)|\.test$/.test(evidence);
}

function classificationFor(reasons: Set<ReasonCode>): Classification {
  // Priority makes every record auditable even when several anomalies coexist.
  if (reasons.has('PRIVILEGED_LEGACY_BOOTSTRAP')) return 'PRIVILEGED_LEGACY';
  if (reasons.has('DEMO_OR_TEST_EVIDENCE')) return 'DEMO_OR_TEST';
  if (reasons.has('MISSING_UID') || reasons.has('MISSING_EMAIL') || reasons.has('MISSING_NAME') || reasons.has('INVALID_EMAIL')) return 'MISSING_REQUIRED_DATA';
  if (reasons.has('PLACEHOLDER_UID')) return 'PLACEHOLDER_UID';
  if (reasons.has('UID_EMAIL_CONFLICT')) return 'UID_EMAIL_CONFLICT';
  if (reasons.has('DUPLICATE_UID')) return 'DUPLICATE_UID';
  if (reasons.has('DUPLICATE_EMAIL')) return 'DUPLICATE_EMAIL';
  return 'AUTO_MIGRATABLE';
}

function emptySummary(): DryRunSummary {
  return {
    totalUsers: 0, autoMigratable: 0, placeholderUid: 0, duplicateUid: 0, duplicateEmail: 0,
    uidEmailConflict: 0, missingRequiredData: 0, demoOrTest: 0, privilegedLegacy: 0, needsReview: 0,
  };
}

function summaryKey(classification: Classification): keyof Omit<DryRunSummary, 'totalUsers'> {
  const keys: Record<Classification, keyof Omit<DryRunSummary, 'totalUsers'>> = {
    AUTO_MIGRATABLE: 'autoMigratable', PLACEHOLDER_UID: 'placeholderUid', DUPLICATE_UID: 'duplicateUid',
    DUPLICATE_EMAIL: 'duplicateEmail', UID_EMAIL_CONFLICT: 'uidEmailConflict',
    MISSING_REQUIRED_DATA: 'missingRequiredData', DEMO_OR_TEST: 'demoOrTest',
    PRIVILEGED_LEGACY: 'privilegedLegacy', NEEDS_REVIEW: 'needsReview',
  };
  return keys[classification];
}

export function classifyLegacyUsers(users: readonly LegacyUserRecord[]): DryRunReport {
  const normalized = users.map((user) => ({ user, uid: text(user.uid).trim(), email: normalizeEmail(user.email) }));
  const uidToEmails = new Map<string, Set<string>>();
  const emailToUids = new Map<string, Set<string>>();
  const uidCounts = new Map<string, number>();
  const emailCounts = new Map<string, number>();

  for (const record of normalized) {
    if (record.uid) {
      uidCounts.set(record.uid, (uidCounts.get(record.uid) || 0) + 1);
      if (!uidToEmails.has(record.uid)) uidToEmails.set(record.uid, new Set());
      if (record.email) uidToEmails.get(record.uid)!.add(record.email);
    }
    if (record.email) {
      emailCounts.set(record.email, (emailCounts.get(record.email) || 0) + 1);
      if (!emailToUids.has(record.email)) emailToUids.set(record.email, new Set());
      if (record.uid) emailToUids.get(record.email)!.add(record.uid);
    }
  }

  const summary = emptySummary();
  const records = normalized.map(({ user, uid, email }) => {
    const reasons = new Set<ReasonCode>();
    const originalEmail = text(user.email);
    if (originalEmail && originalEmail !== originalEmail.trim()) reasons.add('EMAIL_TRIMMED');
    if (originalEmail && originalEmail.trim() !== originalEmail.trim().toLowerCase()) reasons.add('EMAIL_CASE_NORMALIZED');
    if (!uid) reasons.add('MISSING_UID');
    if (uid && isPlaceholderUid(uid)) reasons.add('PLACEHOLDER_UID');
    if (!email) reasons.add('MISSING_EMAIL');
    else if (!isValidEmail(email)) reasons.add('INVALID_EMAIL');
    if (!text(user.name).trim()) reasons.add('MISSING_NAME');
    if (uid && (uidCounts.get(uid) || 0) > 1) reasons.add('DUPLICATE_UID');
    if (email && (emailCounts.get(email) || 0) > 1) reasons.add('DUPLICATE_EMAIL');
    if ((uid && (uidToEmails.get(uid)?.size || 0) > 1) || (email && (emailToUids.get(email)?.size || 0) > 1)) reasons.add('UID_EMAIL_CONFLICT');
    if (email === PRIVILEGED_LEGACY_EMAIL) reasons.add('PRIVILEGED_LEGACY_BOOTSTRAP');
    if (hasDemoOrTestEvidence(user, email)) reasons.add('DEMO_OR_TEST_EVIDENCE');

    const classification = classificationFor(reasons);
    summary.totalUsers++;
    summary[summaryKey(classification)]++;
    return {
      userId: String(user.id),
      maskedEmail: maskEmail(email),
      normalizedEmail: email,
      classification,
      reasonCodes: [...reasons].sort(),
    };
  });

  return { summary, records };
}

/**
 * Opens a transaction that PostgreSQL itself marks read-only, then executes the
 * single SELECT needed for classification. This module deliberately has no
 * write API and no apply mode.
 */
export async function readOnlyDryRun(databaseUrl: string): Promise<DryRunReport> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const result = await client.query(`
      SELECT id, uid, email, name, phone, created_at AS "createdAt"
      FROM users
      ORDER BY id
    `);
    await client.query('ROLLBACK');
    return classifyLegacyUsers(result.rows);
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env[BACKFILL_DRY_RUN_DATABASE_URL];
  if (!databaseUrl) {
    console.log('DATA CLASSIFICATION BLOCKED — READ-ONLY DATABASE ACCESS NOT GUARANTEED');
    return;
  }

  const report = await readOnlyDryRun(databaseUrl);
  const problematic = report.records.filter((record) => record.classification !== 'AUTO_MIGRATABLE');
  console.log(JSON.stringify({ summary: report.summary, problematic }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    console.error('DATA CLASSIFICATION BLOCKED — READ-ONLY DATABASE ACCESS FAILED');
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exitCode = 1;
  });
}
