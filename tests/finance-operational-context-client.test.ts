import assert from 'node:assert/strict';
import {
  FinanceOperationalContextClient,
  FinanceOperationalContextApiError,
} from '../src/modules/finance/finance-operational-context-client.ts';
import type { FinanceOperationalContext } from '../src/modules/finance/finance-operational-context-model.ts';

async function runTests() {
  const fakeContext: FinanceOperationalContext = {
    financialAccount: {
      id: '00000000-0000-0000-0000-000000000001',
      accountNumber: 'CTA-000001',
      name: 'Conta Test',
      status: 'active',
    },
    responsiblePerson: {
      personId: '00000000-0000-0000-0000-000000000002',
      displayName: 'Payer Test',
    },
    students: [
      {
        personId: '00000000-0000-0000-0000-000000000003',
        displayName: 'Student Test',
        enrollmentId: '00000000-0000-0000-0000-000000000004',
        enrollmentStatus: 'active',
      },
    ],
    openObligations: [
      {
        id: '00000000-0000-0000-0000-000000000005',
        description: 'Propina',
        amount: { amount: '150', currency: 'EUR' },
        effectiveAt: '2026-09-01T00:00:00.000Z',
        status: 'open',
      },
    ],
    confirmedUnallocatedPayments: [
      {
        id: '00000000-0000-0000-0000-000000000006',
        paymentReference: 'PAG-000001',
        amount: { amount: '50', currency: 'EUR' },
        method: 'cash',
        effectiveAt: '2026-09-02T00:00:00.000Z',
        status: 'confirmed',
        allocationStatus: 'unapplied',
      },
    ],
    history: [],
  };

  // 1. Successful fetch with Authorization header and encoded query param
  {
    let capturedUrl = '';
    let capturedHeaders: Record<string, string> = {};

    const mockFetch: typeof fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedHeaders = (init?.headers || {}) as Record<string, string>;
      return new Response(JSON.stringify(fakeContext), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new FinanceOperationalContextClient({
      fetcher: mockFetch,
      getToken: async () => 'test-token-123',
    });

    const result = await client.getByFinancialAccountId('00000000-0000-0000-0000-000000000001');

    assert.equal(
      capturedUrl,
      '/api/finance/operational-context?financialAccountId=00000000-0000-0000-0000-000000000001'
    );
    assert.equal(capturedHeaders.Authorization, 'Bearer test-token-123');
    assert.equal(result.financialAccount.accountNumber, 'CTA-000001');
    assert.equal(result.openObligations.length, 1);
    assert.equal(result.confirmedUnallocatedPayments.length, 1);
  }

  // 2. 401 Unauthorized handling
  {
    const mockFetch: typeof fetch = async () => {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new FinanceOperationalContextClient({
      fetcher: mockFetch,
      getToken: async () => null,
    });

    await assert.rejects(
      () => client.getByFinancialAccountId('00000000-0000-0000-0000-000000000001'),
      (err: any) => {
        return err instanceof FinanceOperationalContextApiError && err.status === 401;
      }
    );
  }

  // 3. 403 Forbidden handling
  {
    const mockFetch: typeof fetch = async () => {
      return new Response(JSON.stringify({ code: 'FINANCE_FORBIDDEN', error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new FinanceOperationalContextClient({
      fetcher: mockFetch,
      getToken: async () => 'student-token',
    });

    await assert.rejects(
      () => client.getByFinancialAccountId('00000000-0000-0000-0000-000000000001'),
      (err: any) => {
        return err instanceof FinanceOperationalContextApiError && err.status === 403 && err.code === 'FINANCE_FORBIDDEN';
      }
    );
  }

  // 4. 404 Not Found handling
  {
    const mockFetch: typeof fetch = async () => {
      return new Response(JSON.stringify({ code: 'FINANCIAL_ACCOUNT_NOT_FOUND', error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new FinanceOperationalContextClient({
      fetcher: mockFetch,
      getToken: async () => 'staff-token',
    });

    await assert.rejects(
      () => client.getByFinancialAccountId('00000000-0000-0000-0000-000000000001'),
      (err: any) => {
        return err instanceof FinanceOperationalContextApiError && err.status === 404;
      }
    );
  }

  // 5. Receiver safety test
  {
    const owner = {
      calls: 0,
      async nativeLikeFetch(this: typeof owner, _input: RequestInfo | URL, _init?: RequestInit) {
        assert.equal(this, owner, 'receiver lost');
        this.calls++;
        return new Response(JSON.stringify(fakeContext), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    };

    const bound = owner.nativeLikeFetch.bind(owner);
    const client = new FinanceOperationalContextClient({
      fetcher: bound,
      getToken: async () => 'staff-token',
    });

    await client.getByFinancialAccountId('00000000-0000-0000-0000-000000000001');
    assert.equal(owner.calls, 1);
  }

  // 6. listFinancialAccounts calls canonical /api/finance/financial-accounts
  {
    let capturedUrl = '';
    const mockFetch: typeof fetch = async (input) => {
      capturedUrl = String(input);
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new FinanceOperationalContextClient({
      fetcher: mockFetch,
      getToken: async () => 'staff-token',
    });

    await client.listFinancialAccounts('active');
    assert.equal(
      capturedUrl,
      '/api/finance/financial-accounts?status=active',
      'listFinancialAccounts must hit canonical /api/finance/financial-accounts route'
    );
  }

  // 7. getByStudentRef calls /api/finance/operational-context?studentRef=...
  {
    let capturedUrl = '';
    const mockFetch: typeof fetch = async (input) => {
      capturedUrl = String(input);
      return new Response(JSON.stringify(fakeContext), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new FinanceOperationalContextClient({
      fetcher: mockFetch,
      getToken: async () => 'staff-token',
    });

    await client.getByStudentRef('stu_1234567890123456789012');
    assert.equal(
      capturedUrl,
      '/api/finance/operational-context?studentRef=stu_1234567890123456789012',
      'getByStudentRef must hit /api/finance/operational-context with studentRef query parameter'
    );
  }

  // 8. getByEnrollmentId calls /api/finance/operational-context?enrollmentId=...
  {
    let capturedUrl = '';
    const mockFetch: typeof fetch = async (input) => {
      capturedUrl = String(input);
      return new Response(JSON.stringify(fakeContext), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new FinanceOperationalContextClient({
      fetcher: mockFetch,
      getToken: async () => 'staff-token',
    });

    await client.getByEnrollmentId('00000000-0000-0000-0000-000000000004');
    assert.equal(
      capturedUrl,
      '/api/finance/operational-context?enrollmentId=00000000-0000-0000-0000-000000000004',
      'getByEnrollmentId must hit /api/finance/operational-context with enrollmentId query parameter'
    );
  }

  // 9. getOperationalContext polymorphic delegation
  {
    let capturedUrl = '';
    const mockFetch: typeof fetch = async (input) => {
      capturedUrl = String(input);
      return new Response(JSON.stringify(fakeContext), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new FinanceOperationalContextClient({
      fetcher: mockFetch,
      getToken: async () => 'staff-token',
    });

    await client.getOperationalContext({ studentRef: 'stu_test123' });
    assert.equal(capturedUrl, '/api/finance/operational-context?studentRef=stu_test123');

    await client.getOperationalContext({ enrollmentId: 'enroll-123' });
    assert.equal(capturedUrl, '/api/finance/operational-context?enrollmentId=enroll-123');

    await client.getOperationalContext({ financialAccountId: 'acc-123' });
    assert.equal(capturedUrl, '/api/finance/operational-context?financialAccountId=acc-123');
  }

  console.log('FinanceOperationalContextClient tests passed successfully.');
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
