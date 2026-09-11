import { strict as assert } from 'node:assert';
import http from 'node:http';
import { once } from 'node:events';
import express from 'express';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import path from 'node:path';
import { discoverMigrations, runMigrations } from '../src/db/migration-runner.ts';
import { verifyApprovedTestConnection } from '../scripts/nexus-test-db-safety.mjs';
import { createRequireAuth } from '../src/middleware/auth.ts';
import { registerFeeCatalogueRoutes } from '../src/modules/finance/fee-catalogue-http.ts';
import { registerFeeTypeRoutes } from '../src/modules/finance/fee-type-http.ts';
import { registerFinancialAccountRoutes } from '../src/modules/finance/financial-account-http.ts';
import { registerFinancialObligationRoutes } from '../src/modules/finance/financial-obligation-http.ts';
import type { FinancialProfileStore } from '../src/modules/finance/financial-context.ts';

await verifyApprovedTestConnection();
const schema = `fin_f2_e2e_${randomUUID().replaceAll('-', '')}`;
const quote = (x: string) => `"${x}"`;
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${quote(schema)},public`,
});

const institutionA = '00000000-0000-0000-0000-000000000001';
const institutionB = '00000000-0000-0000-0000-000000000002';
const personA = '00000000-0000-0000-0000-000000000011';
const personB = '00000000-0000-0000-0000-000000000022';
const studentPersonA = '00000000-0000-0000-0000-000000000033';
const guardianPersonA = '00000000-0000-0000-0000-000000000044';

const tokenMap: Record<string, { uid: string; institutionId: string; personId: string; role: string }> = {
  'token-fin-a': { uid: 'uid-fin-a', institutionId: institutionA, personId: personA, role: 'financial' },
  'token-fin-b': { uid: 'uid-fin-b', institutionId: institutionB, personId: personB, role: 'financial' },
};

const profiles: FinancialProfileStore = {
  async resolveEffective(instId) {
    return {
      institutionId: instId,
      version: 1,
      effectiveFrom: new Date(Date.now() - 1000000000).toISOString(),
      effectiveTo: null,
      primaryJurisdiction: 'PRT',
      functionalCurrency: 'EUR',
      financialTimezone: 'Europe/Lisbon',
      monetaryPolicyVersion: '1',
      enabledCurrencies: ['EUR'],
    };
  },
};

async function runE2E() {
  const client = await pool.connect();
  let server: http.Server | undefined;

  try {
    await client.query(`CREATE SCHEMA ${quote(schema)}`);
    await client.query(`SET search_path TO ${quote(schema)},public`);
    await runMigrations(client, await discoverMigrations(path.resolve('src/db/migrations')));

    // Seed test institutions, people, memberships
    await client.query(`
      INSERT INTO institutions (id, name, slug) VALUES 
        ('${institutionA}', 'Colégio Nexus A', 'colegio-nexus-a'),
        ('${institutionB}', 'Colégio Nexus B', 'colegio-nexus-b')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO people (id, name, email) VALUES
        ('${personA}', 'Administrador Financeiro A', 'financeiro.a@test.local'),
        ('${personB}', 'Administrador Financeiro B', 'financeiro.b@test.local'),
        ('${studentPersonA}', 'Aluno Manuel Silva', 'manuel.silva@test.local'),
        ('${guardianPersonA}', 'Encarregada Teresa Silva', 'teresa.silva@test.local')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO memberships (institution_id, person_id, role, status) VALUES
        ('${institutionA}', '${personA}', 'financial', 'active'),
        ('${institutionA}', '${studentPersonA}', 'student', 'active'),
        ('${institutionA}', '${guardianPersonA}', 'parent', 'active'),
        ('${institutionB}', '${personB}', 'financial', 'active')
      ON CONFLICT DO NOTHING;
    `);

    const auth = createRequireAuth({
      verifyIdToken: async (token: string) => {
        const item = tokenMap[token];
        if (!item) throw new Error('Invalid test token');
        return { uid: item.uid, email: `${item.uid}@test.local` };
      },
      pool: pool as any,
      resolveInstitutionalContext: async (_executor: any, uid: string) => {
        const item = Object.values(tokenMap).find((x) => x.uid === uid);
        if (!item) return { kind: 'missing_membership' };
        return {
          kind: 'resolved',
          context: {
            institutionId: item.institutionId,
            personId: item.personId,
            personName: item.uid,
            identityEmail: `${item.uid}@test.local`,
            membershipId: '00000000-0000-0000-0000-000000000099',
            institutionName: 'Colégio Nexus',
            institutionSlug: 'colegio-nexus',
            role: item.role as any,
            permissions: ['financial'],
          },
        };
      },
    });

    const app = express();
    app.use(express.json());
    registerFeeCatalogueRoutes(app, pool, profiles, auth);
    registerFeeTypeRoutes(app, pool, auth);
    registerFinancialAccountRoutes(app, pool, auth);
    registerFinancialObligationRoutes(app, pool, profiles, auth);

    server = http.createServer(app);
    server.listen(0);
    await once(server, 'listening');
    const port = (server.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    const request = async (token: string | null, reqPath: string, options: any = {}) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${baseUrl}${reqPath}`, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      const body = await res.json().catch(() => ({}));
      return { status: res.status, body };
    };

    // 1. Authenticated Finance Actor -> GET eligible persons
    const personsRes = await request('token-fin-a', '/api/finance/financial-accounts/persons');
    assert.equal(personsRes.status, 200);
    assert.ok(Array.isArray(personsRes.body), 'Must return list of eligible persons');
    const selectedPerson = personsRes.body.find((p: any) => p.id === guardianPersonA);
    assert.ok(selectedPerson, 'Responsible person must be in eligible list');
    assert.equal(selectedPerson.name, 'Encarregada Teresa Silva');

    // 2. Create Financial Account from the UI contract: only { primaryPersonId }
    const idemKeyAcc = `idem-e2e-acc-${randomUUID()}`;
    const createAccRes = await request('token-fin-a', '/api/finance/financial-accounts', {
      method: 'POST',
      headers: { 'Idempotency-Key': idemKeyAcc },
      body: { primaryPersonId: selectedPerson.id }, // No manual technical name required
    });

    assert.equal(createAccRes.status, 201, 'Financial account creation must return 201');
    assert.ok(createAccRes.body.id, 'Account must have an id');
    assert.ok(createAccRes.body.accountNumber.startsWith('CTA-'), 'Account number must be canonical (CTA-XXXXXX)');
    assert.equal(createAccRes.body.name, 'Conta de Encarregada Teresa Silva', 'Name must be safely derived from Person context');
    assert.equal(createAccRes.body.status, 'active');
    assert.equal(createAccRes.body.primaryParty?.personId, guardianPersonA);
    assert.equal(createAccRes.body.primaryParty?.role, 'primary_debtor');

    const createdAccountId = createAccRes.body.id;
    const createdAccountNumber = createAccRes.body.accountNumber;

    // 3. Verify PostgreSQL database state directly
    const dbAcc = await client.query(
      `SELECT id, institution_id, account_number, name, status FROM finance_financial_accounts WHERE id = $1`,
      [createdAccountId],
    );
    assert.equal(dbAcc.rows.length, 1);
    assert.equal(dbAcc.rows[0].account_number, createdAccountNumber);

    const dbParty = await client.query(
      `SELECT person_id, role, status FROM finance_financial_account_parties WHERE financial_account_id = $1`,
      [createdAccountId],
    );
    assert.equal(dbParty.rows.length, 1);
    assert.equal(dbParty.rows[0].person_id, guardianPersonA);
    assert.equal(dbParty.rows[0].role, 'primary_debtor');
    assert.equal(dbParty.rows[0].status, 'active');

    // 4. Idempotency test: Replaying the create account command returns the same account
    const replayAccRes = await request('token-fin-a', '/api/finance/financial-accounts', {
      method: 'POST',
      headers: { 'Idempotency-Key': idemKeyAcc },
      body: { primaryPersonId: selectedPerson.id },
    });
    assert.equal(replayAccRes.status, 201);
    assert.equal(replayAccRes.body.id, createdAccountId);
    assert.equal(replayAccRes.body.accountNumber, createdAccountNumber);

    // 5. Account appears in UI projection list
    const listAccRes = await request('token-fin-a', '/api/finance/financial-accounts');
    assert.equal(listAccRes.status, 200);
    const listedAccount = listAccRes.body.find((a: any) => a.id === createdAccountId);
    assert.ok(listedAccount, 'Created account must appear in list');
    assert.equal(listedAccount.accountNumber, createdAccountNumber);
    assert.equal(listedAccount.primaryParty?.personName, 'Encarregada Teresa Silva');
    assert.equal(listedAccount.primaryParty?.role, 'primary_debtor');

    // 6. Tenant isolation and invalid Person protection
    // 6a. Tenant B person cannot be attached to Tenant A account (Fails closed)
    const crossTenantAccRes = await request('token-fin-a', '/api/finance/financial-accounts', {
      method: 'POST',
      headers: { 'Idempotency-Key': `idem-cross-${randomUUID()}` },
      body: { primaryPersonId: personB },
    });
    assert.equal(crossTenantAccRes.status, 422, 'Tenant B person must fail closed for Tenant A');

    // 6b. Non-existent person fails closed
    const fakePersonRes = await request('token-fin-a', '/api/finance/financial-accounts', {
      method: 'POST',
      headers: { 'Idempotency-Key': `idem-fake-${randomUUID()}` },
      body: { primaryPersonId: '00000000-0000-0000-0000-000000000999' },
    });
    assert.equal(fakePersonRes.status, 422, 'Non-existent person must fail closed');

    // 7. Setup Fee Catalogue item for obligation issuance
    const typeRes = await request('token-fin-a', '/api/finance/fee-types', {
      method: 'POST',
      headers: { 'Idempotency-Key': `idem-type-${randomUUID()}` },
      body: { displayName: 'Propina Regular E2E', codePrefix: 'PE2E' },
    });
    assert.equal(typeRes.status, 201);

    const feeRes = await request('token-fin-a', '/api/finance/fee-catalogue', {
      method: 'POST',
      headers: { 'Idempotency-Key': `idem-fee-${randomUUID()}` },
      body: {
        feeTypeId: typeRes.body.id,
        name: 'Propina 1º Trimestre E2E',
        amount: '150.00',
        currency: 'EUR',
        effectiveFrom: new Date(Date.now() - 100000).toISOString(),
      },
    });
    assert.equal(feeRes.status, 201);
    const feeItemId = feeRes.body.id;

    // 8. Issue Obligation using selected account + fee item
    const fixedDueAt = '2026-10-15T00:00:00.000Z';
    const idemKeyObl = `idem-e2e-obl-${randomUUID()}`;
    const issueOblRes = await request('token-fin-a', '/api/finance/obligations', {
      method: 'POST',
      headers: { 'Idempotency-Key': idemKeyObl },
      body: {
        financialAccountId: createdAccountId,
        feeCatalogueItemId: feeItemId,
        beneficiaryPersonId: studentPersonA,
        dueAt: fixedDueAt,
        sourceRef: 'Matrícula 2026/A',
      },
    });

    assert.equal(issueOblRes.status, 201, 'Obligation issuance must return 201');
    assert.equal(issueOblRes.body.status, 'open');
    assert.equal(issueOblRes.body.financialAccountId, createdAccountId);
    assert.equal(issueOblRes.body.accountNumber, createdAccountNumber);
    assert.equal(issueOblRes.body.beneficiaryPersonId, studentPersonA);
    assert.equal(issueOblRes.body.money.amount, '150');
    assert.equal(issueOblRes.body.money.currency, 'EUR');
    assert.equal(issueOblRes.body.feeCatalogueVersion, 1);
    const createdObligationId = issueOblRes.body.id;

    // 9. Replay obligation issuance is idempotent (same payload returns identical result)
    const replayOblRes = await request('token-fin-a', '/api/finance/obligations', {
      method: 'POST',
      headers: { 'Idempotency-Key': idemKeyObl },
      body: {
        financialAccountId: createdAccountId,
        feeCatalogueItemId: feeItemId,
        beneficiaryPersonId: studentPersonA,
        dueAt: fixedDueAt,
        sourceRef: 'Matrícula 2026/A',
      },
    });
    assert.equal(replayOblRes.status, 201);
    assert.equal(replayOblRes.body.id, createdObligationId);

    // 9b. Replaying same key with different payload detects conflict (409)
    const conflictOblRes = await request('token-fin-a', '/api/finance/obligations', {
      method: 'POST',
      headers: { 'Idempotency-Key': idemKeyObl },
      body: {
        financialAccountId: createdAccountId,
        feeCatalogueItemId: feeItemId,
        beneficiaryPersonId: studentPersonA,
        sourceRef: 'Payload diferente',
      },
    });
    assert.equal(conflictOblRes.status, 409, 'Fingerprint conflict must return 409');

    // 10. Verify Obligation appears in UI list query
    const listOblRes = await request('token-fin-a', '/api/finance/obligations');
    assert.equal(listOblRes.status, 200);
    const listedObl = listOblRes.body.find((o: any) => o.id === createdObligationId);
    assert.ok(listedObl, 'Issued obligation must appear in obligations list');
    assert.equal(listedObl.accountNumber, createdAccountNumber);
    assert.equal(listedObl.beneficiaryName, 'Aluno Manuel Silva');
    assert.equal(listedObl.feeItemName, 'Propina 1º Trimestre E2E');
    assert.equal(listedObl.money.amount, '150');
    assert.equal(listedObl.status, 'open');

    console.log('Finance F2 Real Flow UI -> HTTP -> PostgreSQL Integration: PASS');
  } finally {
    if (server) {
      server.closeAllConnections?.();
      server.close();
    }
    client.release();
    await pool.end();
  }
}

runE2E().catch((err) => {
  console.error('E2E integration test failed:', err);
  process.exit(1);
});
