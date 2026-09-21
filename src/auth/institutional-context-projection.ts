export type AuthoritativeInstitutionalProfile = {
  role: string;
  status?: string | null;
  institution?: { id?: string; name?: string; slug?: string } | null;
};

export type InstitutionalContextProjection = {
  role: string;
  status: string;
  institutionReference: string;
};

/**
 * Accepts only the backend profile projection. Browser storage and display
 * labels are intentionally not inputs to this boundary.
 */
export function projectInstitutionalContext(profile: AuthoritativeInstitutionalProfile): InstitutionalContextProjection | null {
  const institutionReference = profile.institution?.slug?.trim();
  if (!institutionReference) return null;
  return {
    role: profile.role,
    status: profile.status || 'active',
    institutionReference,
  };
}

/** A token refresh may retain context only for the already resolved identity. */
export function canRetainInstitutionalContext(resolvedUid: string | null, incomingUid: string): boolean {
  return resolvedUid === incomingUid;
}
