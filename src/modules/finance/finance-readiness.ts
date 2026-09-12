export type FinanceReadinessStatus = 'READY' | 'INCOMPLETE' | 'BLOCKED';
export type FinanceReadinessRequirementCode = 'FINANCIAL_PROFILE' | 'FISCAL_CONFIGURATION' | 'RECEIPT_SERIES' | 'INSTITUTION_LEGAL_PROFILE';
export type FinanceReadinessRequirement = Readonly<{ code: FinanceReadinessRequirementCode; state: 'COMPLETE' | 'MISSING' | 'BLOCKED' }>;
export type DocumentIssuanceReadiness = Readonly<{ status: 'READY'; documentType: string; requirements: readonly FinanceReadinessRequirement[] } | { status: 'BLOCKED'; documentType: string; reasonCode: string; requirements: readonly FinanceReadinessRequirement[] }>;
export type FinanceDocumentReadinessReason =
  | 'INSTITUTION_DATA_REQUIRED' | 'AGT_ONBOARDING_REQUIRED' | 'AGT_SIGNING_MATERIAL_REQUIRED' | 'AGT_PRODUCTION_SERIES_REQUIRED'
  | 'FISCAL_CONFIGURATION_REQUIRED' | 'LEGAL_PROFILE_REQUIRED' | 'FINANCIAL_PROFILE_REQUIRED' | 'SOURCE_NOT_ELIGIBLE'
  | 'DOCUMENT_PARTY_REQUIRED' | 'DOCUMENTARY_DATA_REQUIRED' | 'JURISDICTION_POLICY_UNAVAILABLE' | 'DOCUMENT_TYPE_UNSUPPORTED';
export type FinanceDocumentReadiness = Readonly<{
  documentType: string;
  status: 'READY' | 'BLOCKED';
  reasonCode?: FinanceDocumentReadinessReason;
  prerequisites: Readonly<Record<string, boolean>>;
}>;
export type FinanceReadinessProjection = Readonly<{
  module: 'FINANCE';
  status: FinanceReadinessStatus;
  requirements: readonly FinanceReadinessRequirement[];
  receiptIssuance: DocumentIssuanceReadiness;
  canManageConfiguration: boolean;
  localPrerequisitesComplete: boolean;
  jurisdictionPolicyAvailable: boolean;
  fiscalConfigurationAvailable: boolean;
  seriesConfigurationAvailable: boolean;
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

/**
 * Resolves one document's operational readiness from server-derived facts.
 * This deliberately is part of the existing Finance readiness authority: it
 * has no client-selected institution, adapter, series, or credential inputs.
 */
export function resolveFinanceDocumentReadiness(input: {
  documentType: string;
  primaryJurisdiction: string | null;
  legalProfilePresent: boolean;
  financialProfilePresent: boolean;
  institutionFactsPresent: boolean;
  agtOnboardingPresent: boolean;
  signingMaterialPresent: boolean;
  fiscalConfigurationPresent: boolean;
  productionSeriesDocumentTypes: readonly string[];
  sourceEligible?: boolean;
  documentPartiesResolved?: boolean;
  documentaryDataComplete?: boolean;
}): FinanceDocumentReadiness {
  const prerequisites = Object.freeze({
    legalProfile: input.legalProfilePresent,
    financialProfile: input.financialProfilePresent,
    jurisdictionPolicy: isAngolaProductionJurisdiction(input.primaryJurisdiction),
    institutionFacts: input.institutionFactsPresent,
    agtOnboarding: input.agtOnboardingPresent,
    signingMaterial: input.signingMaterialPresent,
    fiscalConfiguration: input.fiscalConfigurationPresent,
    productionSeries: input.productionSeriesDocumentTypes.includes(input.documentType),
    sourceEligible: input.sourceEligible ?? true,
    documentParties: input.documentPartiesResolved ?? true,
    documentaryData: input.documentaryDataComplete ?? true,
  });
  const blocked = (reasonCode: FinanceDocumentReadinessReason): FinanceDocumentReadiness => Object.freeze({ documentType: input.documentType, status: 'BLOCKED', reasonCode, prerequisites });
  if (!input.legalProfilePresent) return blocked('LEGAL_PROFILE_REQUIRED');
  if (!input.financialProfilePresent) return blocked('FINANCIAL_PROFILE_REQUIRED');
  if (!isAngolaProductionJurisdiction(input.primaryJurisdiction)) return blocked('JURISDICTION_POLICY_UNAVAILABLE');
  if (!isAngolaDocumentType(input.documentType)) return blocked('DOCUMENT_TYPE_UNSUPPORTED');
  const policy = resolveAngolaDocumentCapability(input.documentType, new Date(), {
    institutionFacts: input.institutionFactsPresent,
    agtOnboarding: input.agtOnboardingPresent,
    signingMaterial: input.signingMaterialPresent,
    productionSeries: true,
  });
  if (policy.status === 'BLOCKED') return blocked(policy.reasonCode);
  if (!input.fiscalConfigurationPresent) return blocked('FISCAL_CONFIGURATION_REQUIRED');
  if (!input.productionSeriesDocumentTypes.includes(input.documentType)) return blocked('AGT_PRODUCTION_SERIES_REQUIRED');
  if (input.sourceEligible === false) return blocked('SOURCE_NOT_ELIGIBLE');
  if (input.documentPartiesResolved === false) return blocked('DOCUMENT_PARTY_REQUIRED');
  if (input.documentaryDataComplete === false) return blocked('DOCUMENTARY_DATA_REQUIRED');
  return Object.freeze({ documentType: input.documentType, status: 'READY', prerequisites });
}

export async function resolveFinanceReadiness(input: {
  institutionId: string;
  at: Date;
  canManageConfiguration: boolean;
  resolveFinancialProfile: Resolver;
  resolveFiscalConfiguration: Resolver;
  resolveReceiptSeries: Resolver;
  resolveInstitutionLegalProfile?: Resolver;
  resolveReceiptIssuance?: Resolver;
  isJurisdictionPolicyAvailable?: (profile: unknown) => boolean;
}): Promise<FinanceReadinessProjection> {
  const financialProfile = await resolveRequirement(input.resolveFinancialProfile);
  const legalProfile = input.resolveInstitutionLegalProfile ? await resolveRequirement(input.resolveInstitutionLegalProfile) : 'COMPLETE';
  const resolvedProfile = financialProfile === 'COMPLETE' ? await input.resolveFinancialProfile() : null;
  const localPrerequisitesComplete = financialProfile === 'COMPLETE' && legalProfile === 'COMPLETE';
  const jurisdictionPolicyAvailable = localPrerequisitesComplete && (input.isJurisdictionPolicyAvailable ? input.isJurisdictionPolicyAvailable(resolvedProfile) : true);
  const fiscalState: ResolverResult = !jurisdictionPolicyAvailable && localPrerequisitesComplete ? 'BLOCKED' : await resolveRequirement(input.resolveFiscalConfiguration);
  const seriesState: ResolverResult = !jurisdictionPolicyAvailable && localPrerequisitesComplete ? 'BLOCKED' : await resolveRequirement(input.resolveReceiptSeries);
  const requirements: FinanceReadinessRequirement[] = [
    ...(input.resolveInstitutionLegalProfile ? [{ code: 'INSTITUTION_LEGAL_PROFILE' as const, state: legalProfile }] : []),
    { code: 'FINANCIAL_PROFILE', state: financialProfile },
    { code: 'FISCAL_CONFIGURATION', state: fiscalState },
    { code: 'RECEIPT_SERIES', state: seriesState },
  ];
  const status: FinanceReadinessStatus = requirements.some(item => item.state === 'BLOCKED')
    ? 'BLOCKED'
    : requirements.some(item => item.state === 'MISSING') ? 'INCOMPLETE' : 'READY';
  const documentaryRequirements: FinanceReadinessRequirement[] = [...requirements];
  let receiptIssuance: DocumentIssuanceReadiness = { status: 'READY', documentType: 'receipt', requirements: Object.freeze(documentaryRequirements) };
  if (!jurisdictionPolicyAvailable && localPrerequisitesComplete) receiptIssuance = { status: 'BLOCKED', documentType: 'receipt', reasonCode: 'JURISDICTION_POLICY_UNAVAILABLE', requirements: Object.freeze(documentaryRequirements) };
  else if (documentaryRequirements.some(item => item.code === 'INSTITUTION_LEGAL_PROFILE' && item.state !== 'COMPLETE')) receiptIssuance = { status: 'BLOCKED', documentType: 'receipt', reasonCode: 'INSTITUTION_LEGAL_PROFILE_REQUIRED', requirements: Object.freeze(documentaryRequirements) };
  else if (status !== 'READY') receiptIssuance = { status: 'BLOCKED', documentType: 'receipt', reasonCode: 'FINANCE_MODULE_NOT_READY', requirements: Object.freeze(documentaryRequirements) };
  else if (input.resolveReceiptIssuance) {
    try { await input.resolveReceiptIssuance(); }
    catch (error) { receiptIssuance = { status: 'BLOCKED', documentType: 'receipt', reasonCode: error instanceof Error ? error.message : 'RECEIPT_ISSUANCE_UNAVAILABLE', requirements: Object.freeze(documentaryRequirements) }; }
  }
  return Object.freeze({ module: 'FINANCE', status, requirements: Object.freeze(requirements), receiptIssuance: Object.freeze(receiptIssuance), canManageConfiguration: input.canManageConfiguration, localPrerequisitesComplete, jurisdictionPolicyAvailable, fiscalConfigurationAvailable: jurisdictionPolicyAvailable, seriesConfigurationAvailable: jurisdictionPolicyAvailable });
}
import { isAngolaDocumentType, isAngolaProductionJurisdiction, resolveAngolaDocumentCapability } from './jurisdictions/angola/angola-document-policy.ts';
