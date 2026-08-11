import { InstitutionalContext, QueryExecutor } from './institutional-context.ts';

/**
 * Resolves legacy resource identifiers owned by the active institution.
 * An empty result is an intentional deny-by-default boundary.
 */
export async function resolveInstitutionOwnedResourceIds(
  executor: QueryExecutor,
  context: InstitutionalContext,
  resourceType: string,
): Promise<string[]> {
  const result = await executor.query(
    `SELECT resource_id
     FROM institution_resource_ownership
     WHERE institution_id = $1 AND resource_type = $2`,
    [context.institutionId, resourceType],
  );

  return (result.rows as Array<{ resource_id: string }>).map((row) => row.resource_id);
}

export function isInstitutionOwned(resourceId: string | number, ownedResourceIds: readonly string[]): boolean {
  return ownedResourceIds.includes(String(resourceId));
}
