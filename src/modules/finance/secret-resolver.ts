/**
 * NEXUS EDU IA — Server-Side Payment Provider Secret Resolver
 *
 * Resolves provider secret material (e.g. HMAC keys, API credentials)
 * based on secure server-side references strictly constrained to approved
 * payment-secret namespaces (e.g. env://NEXUS_PAYMENT_*, vault://*)
 * without ever exposing secret values in database rows, browser clients,
 * public projections, logs, or error messages.
 */

export const APPROVED_PAYMENT_ENV_PREFIX = 'env://NEXUS_PAYMENT_';
const APPROVED_ENV_PATTERN = /^env:\/\/NEXUS_PAYMENT_[A-Za-z0-9_]+$/;
const APPROVED_VAULT_PATTERN = /^vault:\/\/[a-zA-Z0-9_\-\.\/]+$/;

/**
 * Validates whether a secret reference belongs to an approved payment secret namespace.
 * Prevents arbitrary process.env leakage (e.g. DATABASE_URL, FIREBASE_PRIVATE_KEY, GEMINI_API_KEY).
 */
export function isApprovedPaymentSecretReference(secretReferenceId: string): boolean {
  if (!secretReferenceId || typeof secretReferenceId !== 'string') {
    return false;
  }
  const trimmed = secretReferenceId.trim();
  if (APPROVED_ENV_PATTERN.test(trimmed)) {
    return true;
  }
  if (APPROVED_VAULT_PATTERN.test(trimmed)) {
    return true;
  }
  return false;
}

export interface SecretResolver {
  resolveSecret(secretReferenceId: string): Promise<string | null>;
}

export class DefaultSecretResolver implements SecretResolver {
  private readonly registry = new Map<string, string>();

  constructor(initialSecrets?: Record<string, string>) {
    if (initialSecrets) {
      for (const [ref, secret] of Object.entries(initialSecrets)) {
        this.registerSecret(ref, secret);
      }
    }
  }

  registerSecret(secretReferenceId: string, secretValue: string): void {
    if (!isApprovedPaymentSecretReference(secretReferenceId)) {
      throw new Error(`Referência de segredo inválida ou fora do namespace aprovado: ${secretReferenceId}`);
    }
    this.registry.set(secretReferenceId, secretValue);
  }

  async resolveSecret(secretReferenceId: string): Promise<string | null> {
    if (!isApprovedPaymentSecretReference(secretReferenceId)) {
      return null;
    }

    // 1. In-memory registry lookup (primary for testing and injected vault providers)
    if (this.registry.has(secretReferenceId)) {
      return this.registry.get(secretReferenceId)!;
    }

    // 2. Direct environment variable lookup strictly within approved namespace: env://NEXUS_PAYMENT_*
    if (secretReferenceId.startsWith(APPROVED_PAYMENT_ENV_PREFIX)) {
      const varName = secretReferenceId.slice(6); // 'NEXUS_PAYMENT_...'
      return process.env[varName] ?? null;
    }

    return null;
  }
}

export const defaultSecretResolver = new DefaultSecretResolver();
