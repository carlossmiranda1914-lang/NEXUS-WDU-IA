export const S02_SCHEMA_REQUIREMENTS = {
  people: [
    'id', 'name', 'birth_date', 'phone', 'email', 'whatsapp',
    'national_id_number', 'gender', 'nationality', 'address_line',
    'municipality', 'province',
  ],
  student_profiles: ['institution_id', 'person_id', 'public_ref', 'student_number', 'legacy_student_id'],
  enrollment_applications: [
    'institution_id', 'student_person_id', 'academic_year_id', 'offer_id',
    'document_policy_id', 'document_policy_captured_at', 'previous_school',
    'enrollment_notes',
  ],
  enrollment_intake_commands: [
    'institution_id', 'operation', 'idempotency_key', 'request_fingerprint',
    'status', 'enrollment_application_id', 'created_by',
  ],
  identity_resolution_decisions: [
    'institution_id', 'case_key', 'request_fingerprint', 'risk_level',
    'proposed_action', 'status', 'requested_by_person_id',
  ],
  enrollment_document_policies: ['institution_id', 'offer_id', 'version', 'status'],
  enrollment_document_requirements: ['institution_id', 'policy_id', 'document_type', 'required'],
  enrollment_documents: [
    'institution_id', 'enrollment_application_id', 'document_type', 'status',
    'required', 'source_requirement_id',
  ],
  guardian_relationships: [
    'institution_id', 'guardian_person_id', 'student_person_id', 'is_primary',
    'financial_responsible',
  ],
};

export async function inspectS02Schema(client) {
  const result = await client.query(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = ANY($1::text[])
      ORDER BY table_name, column_name`,
    [Object.keys(S02_SCHEMA_REQUIREMENTS)],
  );

  const actual = new Map();
  for (const row of result.rows) {
    const columns = actual.get(row.table_name) ?? new Set();
    columns.add(row.column_name);
    actual.set(row.table_name, columns);
  }

  const missing = [];
  for (const [table, requiredColumns] of Object.entries(S02_SCHEMA_REQUIREMENTS)) {
    const actualColumns = actual.get(table);
    if (!actualColumns) {
      missing.push(`${table}.*`);
      continue;
    }
    for (const column of requiredColumns) {
      if (!actualColumns.has(column)) missing.push(`${table}.${column}`);
    }
  }
  return missing;
}
