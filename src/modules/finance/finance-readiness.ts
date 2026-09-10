export type FinanceReadinessStatus = 'READY' | 'INCOMPLETE' | 'BLOCKED';
export type FinanceReadinessRequirementCode = 'FINANCIAL_PROFILE' | 'FISCAL_CONFIGURATION' | 'RECEIPT_SERIES';
export type FinanceReadinessRequirement = Readonly<{ code: FinanceReadinessRequirementCode; state: 'COMPLETE' | 'MISSING' | 'BLOCKED' }>;
export type FinanceReadinessProjection = Readonly<{
  module: 'FINANCE';
  status: FinanceReadinessStatus;
  requirements: readonly FinanceReadinessRequirement[];
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
  return Object.freeze({ module: 'FINANCE', status, requirements: Object.freeze(requirements), canManageConfiguration: input.canManageConfiguration });
}
