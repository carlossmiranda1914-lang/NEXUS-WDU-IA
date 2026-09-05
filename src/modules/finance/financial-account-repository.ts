import type { Pool } from 'pg';
import {
  FinancialAccount,
  FinancialAccountParty,
  FinancialAccountStatus,
  FinancialAccountValidationError,
  normalizeCreateFinancialAccount,
  normalizeUpdateFinancialAccount,
} from './financial-account-model.ts';
import type { InstitutionalContext } from '../../auth/institutional-context.ts';

export class FinancialAccountNotFoundError extends Error {
  readonly code = 'FINANCIAL_ACCOUNT_NOT_FOUND';
  constructor(message = 'Conta financeira não encontrada.') {
    super(message);
    this.name = 'FinancialAccountNotFoundError';
  }
}

export class FinancialAccountConflictError extends Error {
  readonly code = 'FINANCIAL_ACCOUNT_CONFLICT';
  constructor(message = 'Conflito de conta financeira.') {
    super(message);
    this.name = 'FinancialAccountConflictError';
  }
}

interface AccountRow {
  id: string;
  institution_id: string;
  account_number: string;
  name: string;
  status: string;
  created_at: string | Date;
  updated_at: string | Date;
  party_id?: string;
  person_id?: string;
  person_name?: string;
  party_role?: string;
  party_status?: string;
}

function mapAccount(row: AccountRow): FinancialAccount {
  return {
    id: String(row.id),
    institutionId: String(row.institution_id),
    accountNumber: String(row.account_number),
    name: String(row.name),
    status: row.status as FinancialAccountStatus,
    primaryParty: row.party_id && row.person_id
      ? {
          id: String(row.party_id),
          financialAccountId: String(row.id),
          personId: String(row.person_id),
          personName: row.person_name ? String(row.person_name) : undefined,
          role: 'primary_debtor',
          status: (row.party_status as 'active' | 'inactive') || 'active',
        }
      : undefined,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(String(row.created_at)).toISOString(),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(String(row.updated_at)).toISOString(),
  };
}

export class PostgresFinancialAccountRepository {
  constructor(private readonly pool: Pool) {}

  async list(actor: InstitutionalContext, status: FinancialAccountStatus | 'all' = 'all'): Promise<FinancialAccount[]> {
    const statusClause = status === 'all' ? '' : 'AND a.status = $2';
    const params = status === 'all' ? [actor.institutionId] : [actor.institutionId, status];

    const sql = `
      SELECT 
        a.id,
        a.institution_id,
        a.account_number,
        a.name,
        a.status,
        a.created_at,
        a.updated_at,
        p.id AS party_id,
        p.person_id,
        pe.name AS person_name,
        p.role AS party_role,
        p.status AS party_status
      FROM finance_financial_accounts a
      LEFT JOIN finance_financial_account_parties p 
        ON p.financial_account_id = a.id AND p.role = 'primary_debtor' AND p.status = 'active'
      LEFT JOIN people pe 
        ON pe.id = p.person_id
      WHERE a.institution_id = $1 ${statusClause}
      ORDER BY a.account_number ASC
    `;

    const res = await this.pool.query<AccountRow>(sql, params);
    return res.rows.map(mapAccount);
  }

  async getById(actor: InstitutionalContext, id: string): Promise<FinancialAccount> {
    const sql = `
      SELECT 
        a.id,
        a.institution_id,
        a.account_number,
        a.name,
        a.status,
        a.created_at,
        a.updated_at,
        p.id AS party_id,
        p.person_id,
        pe.name AS person_name,
        p.role AS party_role,
        p.status AS party_status
      FROM finance_financial_accounts a
      LEFT JOIN finance_financial_account_parties p 
        ON p.financial_account_id = a.id AND p.role = 'primary_debtor'
      LEFT JOIN people pe 
        ON pe.id = p.person_id
      WHERE a.institution_id = $1 AND a.id = $2
    `;

    const res = await this.pool.query<AccountRow>(sql, [actor.institutionId, id]);
    if (!res.rows[0]) {
      throw new FinancialAccountNotFoundError();
    }

    const account = mapAccount(res.rows[0]);

    // Load all parties
    const partiesRes = await this.pool.query<{
      id: string;
      financial_account_id: string;
      person_id: string;
      person_name: string | null;
      role: string;
      status: string;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT p.id, p.financial_account_id, p.person_id, pe.name AS person_name, p.role, p.status, p.created_at, p.updated_at
       FROM finance_financial_account_parties p
       LEFT JOIN people pe ON pe.id = p.person_id
       WHERE p.institution_id = $1 AND p.financial_account_id = $2
       ORDER BY p.created_at ASC`,
      [actor.institutionId, id],
    );

    account.parties = partiesRes.rows.map((r) => ({
      id: String(r.id),
      financialAccountId: String(r.financial_account_id),
      personId: String(r.person_id),
      personName: r.person_name ? String(r.person_name) : undefined,
      role: r.role as any,
      status: r.status as any,
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : new Date(String(r.created_at)).toISOString(),
      updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : new Date(String(r.updated_at)).toISOString(),
    }));

    return account;
  }

  async create(actor: InstitutionalContext, rawInput: unknown, idempotencyKey: string): Promise<FinancialAccount> {
    const input = normalizeCreateFinancialAccount(rawInput);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Verify person exists
      const personRes = await client.query('SELECT id, name FROM people WHERE id = $1', [input.primaryPersonId]);
      if (!personRes.rows[0]) {
        throw new FinancialAccountValidationError('Pessoa responsável não encontrada.');
      }
      const personName = String(personRes.rows[0].name);

      // Increment sequence atomically
      const counterRes = await client.query<{ last_sequence: number }>(
        `INSERT INTO finance_financial_account_counters (institution_id, last_sequence, updated_at)
         VALUES ($1, 1, NOW())
         ON CONFLICT (institution_id)
         DO UPDATE SET last_sequence = finance_financial_account_counters.last_sequence + 1, updated_at = NOW()
         RETURNING last_sequence`,
        [actor.institutionId],
      );
      const seq = counterRes.rows[0].last_sequence;
      const accountNumber = `CTA-${String(seq).padStart(6, '0')}`;

      // Insert account
      const accountRes = await client.query<AccountRow>(
        `INSERT INTO finance_financial_accounts (institution_id, account_number, name, status)
         VALUES ($1, $2, $3, 'active')
         RETURNING id, institution_id, account_number, name, status, created_at, updated_at`,
        [actor.institutionId, accountNumber, input.name],
      );
      const acc = accountRes.rows[0];

      // Insert primary responsible party
      const partyRes = await client.query<{ id: string }>(
        `INSERT INTO finance_financial_account_parties (institution_id, financial_account_id, person_id, role, status)
         VALUES ($1, $2, $3, 'primary_debtor', 'active')
         RETURNING id`,
        [actor.institutionId, acc.id, input.primaryPersonId],
      );

      await client.query('COMMIT');

      return {
        id: String(acc.id),
        institutionId: String(acc.institution_id),
        accountNumber: String(acc.account_number),
        name: String(acc.name),
        status: 'active',
        primaryParty: {
          id: String(partyRes.rows[0].id),
          financialAccountId: String(acc.id),
          personId: input.primaryPersonId,
          personName,
          role: 'primary_debtor',
          status: 'active',
        },
        createdAt: acc.created_at instanceof Date ? acc.created_at.toISOString() : new Date(String(acc.created_at)).toISOString(),
        updatedAt: acc.updated_at instanceof Date ? acc.updated_at.toISOString() : new Date(String(acc.updated_at)).toISOString(),
      };
    } catch (e: any) {
      await client.query('ROLLBACK');
      if (e.code === '23505') {
        throw new FinancialAccountConflictError('Já existe uma conta financeira com este número ou dados nesta instituição.');
      }
      throw e;
    } finally {
      client.release();
    }
  }

  async update(actor: InstitutionalContext, id: string, rawInput: unknown): Promise<FinancialAccount> {
    const input = normalizeUpdateFinancialAccount(rawInput);
    if (!input.name) {
      return this.getById(actor, id);
    }

    const res = await this.pool.query<AccountRow>(
      `UPDATE finance_financial_accounts 
       SET name = $3, updated_at = NOW() 
       WHERE institution_id = $1 AND id = $2 
       RETURNING id, institution_id, account_number, name, status, created_at, updated_at`,
      [actor.institutionId, id, input.name],
    );
    if (!res.rows[0]) {
      throw new FinancialAccountNotFoundError();
    }
    return this.getById(actor, id);
  }

  async setStatus(actor: InstitutionalContext, id: string, status: FinancialAccountStatus): Promise<FinancialAccount> {
    const res = await this.pool.query<AccountRow>(
      `UPDATE finance_financial_accounts 
       SET status = $3, updated_at = NOW() 
       WHERE institution_id = $1 AND id = $2 
       RETURNING id, institution_id, account_number, name, status, created_at, updated_at`,
      [actor.institutionId, id, status],
    );
    if (!res.rows[0]) {
      throw new FinancialAccountNotFoundError();
    }
    return this.getById(actor, id);
  }
}
