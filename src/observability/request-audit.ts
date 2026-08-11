export type AuditOutcome = 'success' | 'blocked' | 'failure';

export interface RequestAuditInput {
  method: string;
  statusCode: number;
  durationMs: number;
  routePattern?: string;
}

export function shouldAuditRequest(input: RequestAuditInput): boolean {
  return input.statusCode >= 400 || ['POST', 'PUT', 'PATCH', 'DELETE'].includes(input.method.toUpperCase());
}

export function outcomeForStatus(statusCode: number): AuditOutcome {
  if (statusCode >= 500) return 'failure';
  if (statusCode >= 400) return 'blocked';
  return 'success';
}

/** Uses the Express route pattern, never query parameters or request bodies. */
export function describeRequestForAudit(input: RequestAuditInput): string {
  const route = input.routePattern || '/api/unknown';
  return `Pedido ${input.method.toUpperCase()} ${route} terminou com HTTP ${input.statusCode} em ${input.durationMs}ms.`;
}
