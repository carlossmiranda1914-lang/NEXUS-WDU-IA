export type InstitutionLegalProfile = Readonly<{
  id: string; institutionId: string; version: number; legalName: string; taxIdentifier: string | null;
  registeredAddress: Readonly<{ countryCode: string; line1: string; line2?: string | null; locality?: string | null; administrativeArea?: string | null; postalCode?: string | null }>;
  legalEmail: string | null; legalPhone: string | null; logoAssetReference: string | null; effectiveFrom: Date; effectiveTo: Date | null;
}>;

type Queryable = { query<T = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<{ rows: T[] }> };
type CreateInput = Omit<InstitutionLegalProfile, 'id' | 'version' | 'effectiveTo' | 'legalEmail' | 'legalPhone' | 'logoAssetReference'> & Partial<Pick<InstitutionLegalProfile, 'legalEmail' | 'legalPhone' | 'logoAssetReference'>>;
type Row = { id: string; institution_id: string; version: number; legal_name: string; tax_identifier: string | null; registered_address: InstitutionLegalProfile['registeredAddress']; legal_email: string | null; legal_phone: string | null; logo_asset_reference: string | null; effective_from: Date; effective_to: Date | null };

const map = (row: Row): InstitutionLegalProfile => ({ id: row.id, institutionId: row.institution_id, version: row.version, legalName: row.legal_name, taxIdentifier: row.tax_identifier, registeredAddress: row.registered_address, legalEmail: row.legal_email, legalPhone: row.legal_phone, logoAssetReference: row.logo_asset_reference, effectiveFrom: row.effective_from, effectiveTo: row.effective_to });

export class InstitutionLegalProfileRepository {
  constructor(private readonly db: Queryable) {}
  async resolveEffective(institutionId: string, at: Date): Promise<InstitutionLegalProfile | null> {
    const result = await this.db.query<Row>('SELECT * FROM institution_legal_profiles WHERE institution_id=$1 AND effective_from <= $2 AND (effective_to IS NULL OR effective_to > $2) ORDER BY version DESC LIMIT 1', [institutionId, at]);
    return result.rows[0] ? map(result.rows[0]) : null;
  }
  async createVersion(input: CreateInput): Promise<InstitutionLegalProfile> {
    await this.db.query('UPDATE institution_legal_profiles SET effective_to=$2 WHERE institution_id=$1 AND effective_to IS NULL AND effective_from < $2', [input.institutionId, input.effectiveFrom]);
    const result = await this.db.query<Row>('INSERT INTO institution_legal_profiles(institution_id,version,legal_name,tax_identifier,registered_address,legal_email,legal_phone,logo_asset_reference,effective_from) VALUES($1,(SELECT COALESCE(MAX(version),0)+1 FROM institution_legal_profiles WHERE institution_id=$1),$2,$3,$4,$5,$6,$7,$8) RETURNING *', [input.institutionId, input.legalName, input.taxIdentifier, input.registeredAddress, input.legalEmail ?? null, input.legalPhone ?? null, input.logoAssetReference ?? null, input.effectiveFrom]);
    return map(result.rows[0]);
  }
}
