import { ANGOLA_POLICY_EFFECTIVE_FROM, ANGOLA_POLICY_VERSION, angolaEvidenceManifest } from './angola-evidence-manifest.ts';

export type AngolaDocumentType = (typeof angolaEvidenceManifest.documentTypes)[number];
export type AngolaDocumentCapability = Readonly<{
  documentType: AngolaDocumentType;
  status: 'READY' | 'BLOCKED';
  reasonCode?: 'ANGOLA_POLICY_NOT_EFFECTIVE' | 'INSTITUTION_DATA_REQUIRED' | 'AGT_ONBOARDING_REQUIRED' | 'AGT_SIGNING_MATERIAL_REQUIRED' | 'AGT_PRODUCTION_SERIES_REQUIRED';
  policyVersion: typeof ANGOLA_POLICY_VERSION;
}>;

export type AngolaExternalInputs = Readonly<{
  institutionFacts?: boolean;
  agtOnboarding?: boolean;
  signingMaterial?: boolean;
  productionSeries?: boolean;
}>;

const blocked = (documentType: AngolaDocumentType, reasonCode: NonNullable<AngolaDocumentCapability['reasonCode']>): AngolaDocumentCapability =>
  Object.freeze({ documentType, status: 'BLOCKED', reasonCode, policyVersion: ANGOLA_POLICY_VERSION });

/**
 * Resolves public policy support independently from runtime enablement. A
 * capability can become READY only after every external authority is present.
 */
export function resolveAngolaDocumentCapability(
  documentType: AngolaDocumentType,
  at: Date,
  inputs: AngolaExternalInputs = {},
): AngolaDocumentCapability {
  if (!Number.isFinite(at.getTime()) || at < ANGOLA_POLICY_EFFECTIVE_FROM) return blocked(documentType, 'ANGOLA_POLICY_NOT_EFFECTIVE');
  if (!inputs.institutionFacts) return blocked(documentType, 'INSTITUTION_DATA_REQUIRED');
  if (!inputs.agtOnboarding) return blocked(documentType, 'AGT_ONBOARDING_REQUIRED');
  if (!inputs.signingMaterial) return blocked(documentType, 'AGT_SIGNING_MATERIAL_REQUIRED');
  if (!inputs.productionSeries) return blocked(documentType, 'AGT_PRODUCTION_SERIES_REQUIRED');
  return Object.freeze({ documentType, status: 'READY', policyVersion: ANGOLA_POLICY_VERSION });
}
