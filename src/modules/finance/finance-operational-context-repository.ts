import type { Pool, PoolClient } from 'pg';
import { Money } from './money.ts';
import type { InstitutionalContext } from '../../auth/institutional-context.ts';
import { FinancialAccountNotFoundError } from './financial-account-repository.ts';
import type {
  FinanceOperationalAccount,
  FinanceOperationalResponsiblePerson,
  FinanceOperationalStudent,
  FinanceOperationalObligation,
  FinanceOperationalPayment,
  FinanceOperationalHistoryItem,
  FinanceOperationalContext,
} from './finance-operational-context-model.ts';

interface AccountRow {
  id: string;
  institution_id: string;
  account_number: string;
  name: string;
  status: string;
}

interface ResponsiblePersonRow {
  person_id: string;
  person_name: string;
  role: string;
}

interface StudentRow {
  person_id: string;
  display_name: string;
  student_profile_id: string | null;
  student_number: string | null;
  enrollment_id: string | null;
  enrollment_status: string | null;
}

interface ObligationRow {
  id: string;
  fee_item_code: string;
  fee_item_name: string;
  amount: string | number;
  currency: string;
  effective_at: string | Date;
  due_at: string | Date | null;
  status: string;
  notes: string | null;
}

interface PaymentRow {
  id: string;
  payment_reference: string;
  amount: string | number;
  currency: string;
  method: string;
  effective_at: string | Date;
  payer_person_id: string | null;
  payer_person_name: string | null;
  status: string;
  allocation_status: string;
}

export class PostgresFinanceOperationalContextRepository {
  constructor(private readonly pool: Pool) {}

  async getByFinancialAccountId(
    actor: InstitutionalContext,
    financialAccountId: string,
    client: Pool | PoolClient = this.pool
  ): Promise<FinanceOperationalContext> {
    // 1. Verify account belongs to actor.institutionId
    const accountSql = `
      SELECT id, institution_id, account_number, name, status
      FROM finance_financial_accounts
      WHERE institution_id = $1 AND id = $2
    `;
    const accountRes = await client.query<AccountRow>(accountSql, [actor.institutionId, financialAccountId]);
    if (!accountRes.rows[0]) {
      throw new FinancialAccountNotFoundError();
    }
    const accRow = accountRes.rows[0];
    const financialAccount: FinanceOperationalAccount = {
      id: String(accRow.id),
      accountNumber: String(accRow.account_number),
      name: String(accRow.name),
      status: String(accRow.status),
    };

    // 2. Primary responsible person
    const respSql = `
      SELECT p.person_id, pe.name AS person_name, p.role
      FROM finance_financial_account_parties p
      JOIN people pe ON pe.id = p.person_id
      WHERE p.institution_id = $1 AND p.financial_account_id = $2 AND p.role = 'primary_debtor' AND p.status = 'active'
      LIMIT 1
    `;
    const respRes = await client.query<ResponsiblePersonRow>(respSql, [actor.institutionId, financialAccountId]);
    let responsiblePerson: FinanceOperationalResponsiblePerson | null = null;
    if (respRes.rows[0]) {
      responsiblePerson = {
        personId: String(respRes.rows[0].person_id),
        displayName: String(respRes.rows[0].person_name),
        role: String(respRes.rows[0].role),
      };
    }

    // 3. Associated students
    const studentsSql = `
      WITH account_student_people AS (
        SELECT p.person_id
        FROM finance_financial_account_parties p
        WHERE p.institution_id = $1 AND p.financial_account_id = $2 AND p.status = 'active'
        UNION
        SELECT gr.student_person_id AS person_id
        FROM finance_financial_account_parties p
        JOIN guardian_relationships gr
          ON gr.guardian_person_id = p.person_id
         AND gr.institution_id = p.institution_id
         AND gr.status = 'active'
        WHERE p.institution_id = $1 AND p.financial_account_id = $2 AND p.status = 'active'
        UNION
        SELECT o.beneficiary_person_id AS person_id
        FROM finance_obligations o
        WHERE o.institution_id = $1 AND o.financial_account_id = $2 AND o.beneficiary_person_id IS NOT NULL
      )
      SELECT
        asp.person_id,
        pe.name AS display_name,
        sp.id AS student_profile_id,
        sp.student_number,
        ea.id AS enrollment_id,
        ea.status AS enrollment_status
      FROM account_student_people asp
      JOIN people pe ON pe.id = asp.person_id
      LEFT JOIN student_profiles sp ON sp.person_id = asp.person_id AND sp.institution_id = $1
      LEFT JOIN LATERAL (
        SELECT e.id, e.status
        FROM enrollment_applications e
        WHERE e.institution_id = $1 AND e.student_person_id = asp.person_id
        ORDER BY e.created_at DESC
        LIMIT 1
      ) ea ON true
      WHERE sp.id IS NOT NULL OR ea.id IS NOT NULL
      ORDER BY pe.name ASC
    `;
    const studentsRes = await client.query<StudentRow>(studentsSql, [actor.institutionId, financialAccountId]);
    const students: FinanceOperationalStudent[] = studentsRes.rows.map((r) => ({
      personId: String(r.person_id),
      displayName: String(r.display_name),
      studentId: r.student_profile_id ? String(r.student_profile_id) : undefined,
      enrollmentId: r.enrollment_id ? String(r.enrollment_id) : undefined,
      enrollmentStatus: r.enrollment_status ? String(r.enrollment_status) : undefined,
    }));

    // 4. Open obligations
    const obligationsSql = `
      SELECT
        o.id,
        o.amount,
        o.currency,
        o.effective_at,
        o.due_at,
        o.status,
        o.notes,
        fci.code AS fee_item_code,
        fcv.name AS fee_item_name
      FROM finance_obligations o
      JOIN finance_fee_catalogue_items fci
        ON (fci.institution_id = o.institution_id AND fci.id = o.fee_catalogue_item_id)
      JOIN finance_fee_catalogue_versions fcv
        ON (fcv.institution_id = o.institution_id AND fcv.item_id = o.fee_catalogue_item_id AND fcv.version = o.fee_catalogue_version)
      WHERE o.institution_id = $1 AND o.financial_account_id = $2 AND o.status = 'open'
      ORDER BY o.due_at ASC NULLS LAST, o.created_at DESC
    `;
    const obligationsRes = await client.query<ObligationRow>(obligationsSql, [actor.institutionId, financialAccountId]);
    const openObligations: FinanceOperationalObligation[] = obligationsRes.rows.map((row) => {
      const desc = row.fee_item_name ? `${row.fee_item_name} (${row.fee_item_code})` : row.fee_item_code;
      return {
        id: String(row.id),
        description: desc,
        feeItemCode: String(row.fee_item_code),
        feeItemName: String(row.fee_item_name),
        amount: {
          amount: Money.parse(String(row.amount), String(row.currency)).canonicalAmount(),
          currency: String(row.currency),
        },
        effectiveAt:
          row.effective_at instanceof Date
            ? row.effective_at.toISOString()
            : new Date(String(row.effective_at)).toISOString(),
        dueAt: row.due_at
          ? row.due_at instanceof Date
            ? row.due_at.toISOString()
            : new Date(String(row.due_at)).toISOString()
          : null,
        status: String(row.status),
        notes: row.notes ? String(row.notes) : null,
      };
    });

    // 5. Confirmed unallocated payments
    const paymentsSql = `
      SELECT
        p.id,
        p.payment_reference,
        p.amount,
        p.currency,
        p.method,
        p.effective_at,
        p.payer_person_id,
        p.status,
        p.allocation_status,
        pe.name AS payer_person_name
      FROM finance_payments p
      LEFT JOIN people pe ON pe.id = p.payer_person_id
      WHERE p.institution_id = $1
        AND p.financial_account_id = $2
        AND p.status = 'confirmed'
        AND p.allocation_status = 'unapplied'
      ORDER BY p.effective_at DESC, p.created_at DESC
    `;
    const paymentsRes = await client.query<PaymentRow>(paymentsSql, [actor.institutionId, financialAccountId]);
    const confirmedUnallocatedPayments: FinanceOperationalPayment[] = paymentsRes.rows.map((row) => ({
      id: String(row.id),
      paymentReference: String(row.payment_reference),
      amount: {
        amount: Money.parse(String(row.amount), String(row.currency)).canonicalAmount(),
        currency: String(row.currency),
      },
      method: String(row.method),
      effectiveAt:
        row.effective_at instanceof Date
          ? row.effective_at.toISOString()
          : new Date(String(row.effective_at)).toISOString(),
      payerPersonId: row.payer_person_id ? String(row.payer_person_id) : undefined,
      payerPersonName: row.payer_person_name ? String(row.payer_person_name) : undefined,
      status: String(row.status),
      allocationStatus: String(row.allocation_status),
    }));

    // 6. History composition (all obligations + all payments)
    const allObligationsSql = `
      SELECT
        o.id,
        o.amount,
        o.currency,
        o.effective_at,
        o.due_at,
        o.status,
        o.notes,
        fci.code AS fee_item_code,
        fcv.name AS fee_item_name
      FROM finance_obligations o
      JOIN finance_fee_catalogue_items fci
        ON (fci.institution_id = o.institution_id AND fci.id = o.fee_catalogue_item_id)
      JOIN finance_fee_catalogue_versions fcv
        ON (fcv.institution_id = o.institution_id AND fcv.item_id = o.fee_catalogue_item_id AND fcv.version = o.fee_catalogue_version)
      WHERE o.institution_id = $1 AND o.financial_account_id = $2
    `;
    const allObligationsRes = await client.query<ObligationRow>(allObligationsSql, [
      actor.institutionId,
      financialAccountId,
    ]);

    const allPaymentsSql = `
      SELECT
        p.id,
        p.payment_reference,
        p.amount,
        p.currency,
        p.method,
        p.effective_at,
        p.payer_person_id,
        p.status,
        p.allocation_status,
        pe.name AS payer_person_name
      FROM finance_payments p
      LEFT JOIN people pe ON pe.id = p.payer_person_id
      WHERE p.institution_id = $1 AND p.financial_account_id = $2
    `;
    const allPaymentsRes = await client.query<PaymentRow>(allPaymentsSql, [actor.institutionId, financialAccountId]);

    const history: FinanceOperationalHistoryItem[] = [];

    for (const row of allObligationsRes.rows) {
      const desc = row.fee_item_name ? `${row.fee_item_name} (${row.fee_item_code})` : row.fee_item_code;
      const effectiveAt =
        row.effective_at instanceof Date
          ? row.effective_at.toISOString()
          : new Date(String(row.effective_at)).toISOString();
      const obligation: FinanceOperationalObligation = {
        id: String(row.id),
        description: desc,
        feeItemCode: String(row.fee_item_code),
        feeItemName: String(row.fee_item_name),
        amount: {
          amount: Money.parse(String(row.amount), String(row.currency)).canonicalAmount(),
          currency: String(row.currency),
        },
        effectiveAt,
        dueAt: row.due_at
          ? row.due_at instanceof Date
            ? row.due_at.toISOString()
            : new Date(String(row.due_at)).toISOString()
          : null,
        status: String(row.status),
        notes: row.notes ? String(row.notes) : null,
      };
      history.push({
        kind: 'obligation',
        id: obligation.id,
        occurredAt: effectiveAt,
        obligation,
      });
    }

    for (const row of allPaymentsRes.rows) {
      const effectiveAt =
        row.effective_at instanceof Date
          ? row.effective_at.toISOString()
          : new Date(String(row.effective_at)).toISOString();
      const payment: FinanceOperationalPayment = {
        id: String(row.id),
        paymentReference: String(row.payment_reference),
        amount: {
          amount: Money.parse(String(row.amount), String(row.currency)).canonicalAmount(),
          currency: String(row.currency),
        },
        method: String(row.method),
        effectiveAt,
        payerPersonId: row.payer_person_id ? String(row.payer_person_id) : undefined,
        payerPersonName: row.payer_person_name ? String(row.payer_person_name) : undefined,
        status: String(row.status),
        allocationStatus: String(row.allocation_status),
      };
      history.push({
        kind: 'payment',
        id: payment.id,
        occurredAt: effectiveAt,
        payment,
      });
    }

    // Sort history deterministically: occurredAt DESC, id DESC
    history.sort((a, b) => {
      const timeComp = new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
      if (timeComp !== 0) return timeComp;
      return b.id.localeCompare(a.id);
    });

    return {
      financialAccount,
      responsiblePerson,
      students,
      openObligations,
      confirmedUnallocatedPayments,
      history,
    };
  }
}
