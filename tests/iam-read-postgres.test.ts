import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { readApprovedTestTarget } from '../scripts/nexus-test-db-safety.mjs';
import { IamReadError, listInstitutionMemberships } from '../src/modules/iam/iam-read-service.ts';

const { connectionString } = readApprovedTestTarget(); const schemaName = `nexus_iamread_${Date.now()}_${randomUUID().replaceAll('-', '').slice(0, 10)}`; const schemaIdentifier = `"${schemaName}"`;
const migrations = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations'); const setupPool = new pg.Pool({ connectionString }); let client: pg.PoolClient | undefined; let pool: pg.Pool | undefined;
const institutionA = randomUUID(), institutionB = randomUUID(), adminA = randomUUID(), adminB = randomUUID(), personA1 = randomUUID(), personA2 = randomUUID(), personB = randomUUID();
const context = { personId: adminA, personName: 'Admin', identityEmail: null, membershipId: randomUUID(), institutionId: institutionA, institutionName: 'A', institutionSlug: 'a', role: 'institution_admin' as const };
try {
  client = await setupPool.connect(); await client.query(`CREATE SCHEMA ${schemaIdentifier}`); await client.query(`SET search_path TO ${schemaIdentifier}`);
  for (const file of (await readdir(migrations)).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort()) await client.query(await readFile(path.join(migrations, file), 'utf8'));
  pool = new pg.Pool({ connectionString, options: `-c search_path=${schemaName}` });
  await client.query(`INSERT INTO institutions (id,name,slug,status) VALUES ($1,'A','a','active'),($2,'B','b','active')`, [institutionA, institutionB]);
  await client.query(`INSERT INTO people (id,name) VALUES ($1,'Admin A'),($2,'Admin B'),($3,'Ana'),($4,'Bruno'),($5,'Other')`, [adminA, adminB, personA1, personA2, personB]);
  await client.query(`INSERT INTO memberships (id,person_id,institution_id,role,status,approved_at) VALUES ($1,$2,$3,'institution_admin','active',now()),($4,$5,$3,'teacher','active',now()),($6,$7,$3,'teacher','pending',null),($8,$9,$10,'institution_admin','active',now()),($11,$12,$10,'teacher','active',now())`, [context.membershipId, adminA, institutionA, randomUUID(), personA1, randomUUID(), personA2, randomUUID(), adminB, institutionB, randomUUID(), personB]);
  const first = await listInstitutionMemberships(pool as any, context, { limit: 1 }); assert.equal(first.memberships.length, 1); assert.equal(first.summary.activeInstitutionAdminCount, 1); assert.ok(first.page.nextCursor);
  const second = await listInstitutionMemberships(pool as any, context, { limit: 10, cursor: first.page.nextCursor! }); assert.equal(second.memberships.some((item) => item.id === first.memberships[0].id), false); assert.equal([...first.memberships, ...second.memberships].length, 3); assert.equal([...first.memberships, ...second.memberships].every((item) => Object.keys(item.person).length === 1 && typeof item.person.displayName === 'string'), true);
  const pending = await listInstitutionMemberships(pool as any, context, { status: 'pending', limit: 10 }); assert.equal(pending.memberships.length, 1); assert.equal(pending.memberships[0].status, 'pending');
  await assert.rejects(() => listInstitutionMemberships(pool as any, context, { cursor: Buffer.from(randomUUID(), 'utf8').toString('base64url') }), (error: unknown) => error instanceof IamReadError && error.code === 'INVALID_CURSOR');
  await assert.rejects(() => listInstitutionMemberships(pool as any, { ...context, role: 'teacher' }, {}), (error: unknown) => error instanceof IamReadError && error.code === 'UNAUTHORIZED');
  console.log('IAM read PostgreSQL tests passed.');
} finally { if (pool) await pool.end(); if (client) { await client.query(`DROP SCHEMA IF EXISTS ${schemaIdentifier} CASCADE`).catch(() => undefined); client.release(); } await setupPool.end(); }
