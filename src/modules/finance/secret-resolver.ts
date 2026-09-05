/**
 * NEXUS EDU IA — Server-Side Payment Provider Secret Resolver
 *
 * Resolves provider secret material (e.g. HMAC keys, API credentials)
 * based on secure server-side references (e.g. vault://, env://, or in-memory registry)
 * without ever exposing secret values in database rows, browser clients, or public projections.
 */

export interface SecretResolver {
  resolveSecret(secretReferenceId: string): Promise<string | null>;
}

export class DefaultSecretResolver implements SecretResolver {
  private readonly registry = new Map<string, string>();

  constructor(initialSecrets?: Record<string, string>) {
    if (initialSecrets) {
      for (const [ref, secret] of Object.entries(initialSecrets)) {
        this.registry.set(ref, secret);
      }
    }
  }

  registerSecret(secretReferenceId: string, secretValue: string): void {
    this.registry.set(secretReferenceId, secretValue);
  }

  async resolveSecret(secretReferenceId: string): Promise<string | null> {
    if (!secretReferenceId || typeof secretReferenceId !== 'string') {
      return null;
    }

    // 1. In-memory registry lookup (primary for testing and runtime secret stores)
    if (this.registry.has(secretReferenceId)) {
      return this.registry.get(secretReferenceId)!;
    }

    // 2. Direct environment variable lookup: env://VARIABLE_NAME
    if (secretReferenceId.startsWith('env://')) {
      const varName = secretReferenceId.slice(6);
      return process.env[varName] ?? null;
    }

    // 3. Fallback to process.env mapping by convention if set
    if (process.env[secretReferenceId]) {
      return process.env[secretReferenceId]!;
    }

    return null;
  }
}

export const defaultSecretResolver = new DefaultSecretResolver();
