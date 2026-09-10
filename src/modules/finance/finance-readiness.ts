export type FinanceReadinessStatus = 'READY' | 'INCOMPLETE' | 'BLOCKED';
export type FinanceReadinessRequirementCode = 'FINANCIAL_PROFILE' | 'FISCAL_CONFIGURATION' | 'RECEIPT_SERIES';
export type FinanceReadinessRequirement = Readonly<{ code: FinanceReadinessRequirementCode; state: 'COMPLETE' | 'MISSING' | 'BLOCKED' }>;
export type FinanceReadinessProjection = Readonly<{
  module: 'FINANCE';
  status: FinanceReadinessStatus;
  requirements: readonly FinanceReadinessRequirement[];
  receiptIssuance: Readonly<{ status: 'READY' } | { status: 'BLOCKED'; reasonCode: string }>;
  canManageConfiguration: boolean;
}>;

type Resolver = () => Promise<unknown>;
type ResolverResult = 'COMPLETE' | 'MISSING' | 'BLOCKED';

const isKnownMissingAuthority = (error: unknown) => {
  const message = error instanceof Error ? error.message : '';
  return /NOT_EFFECTIVE|NO_EFFECTIVE|NOT_FOUND/i.test(message);
};

const resolveRequirement = async (resolver: Resolver): Promise<ResolverResult> => {
  try {
    return (await resolver()) === null ? 'MISSING' : 'COMPLETE';
  } catch (error) {
    return isKnownMissingAuthority(error) ? 'MISSING' : 'BLOCKED';
  }
};

export async function resolveFinanceReadiness(input: {
  institutionId: string;
  at: Date;
  canManageConfiguration: boolean;
  resolveFinancialProfile: Resolver;
  resolveFiscalConfiguration: Resolver;
  resolveReceiptSeries: Resolver;
  resolveReceiptIssuance?: Resolver;
}): Promise<FinanceReadinessProjection> {
  const states = await Promise.all([
    resolveRequirement(input.resolveFinancialProfile),
    resolveRequirement(input.resolveFiscalConfiguration),
    resolveRequirement(input.resolveReceiptSeries),
  ]);
  const requirements: FinanceReadinessRequirement[] = [
    { code: 'FINANCIAL_PROFILE', state: states[0]! },
    { code: 'FISCAL_CONFIGURATION', state: states[1]! },
    { code: 'RECEIPT_SERIES', state: states[2]! },
  ];
  const status: FinanceReadinessStatus = requirements.some(item => item.state === 'BLOCKED')
    ? 'BLOCKED'
    : requirements.some(item => item.state === 'MISSING') ? 'INCOMPLETE' : 'READY';
  let receiptIssuance: FinanceReadinessProjection['receiptIssuance'] = { status: 'READY' };
  if (status !== 'READY') receiptIssuance = { status: 'BLOCKED', reasonCode: 'FINANCE_MODULE_NOT_READY' };
  else if (input.resolveReceiptIssuance) {
    try { await input.resolveReceiptIssuance(); }
    catch (error) { receiptIssuance = { status: 'BLOCKED', reasonCode: error instanceof Error ? error.message : 'RECEIPT_ISSUANCE_UNAVAILABLE' }; }
  }
  return Object.freeze({ module: 'FINANCE', status, requirements: Object.freeze(requirements), receiptIssuance: Object.freeze(receiptIssuance), canManageConfiguration: input.canManageConfiguration });
}
