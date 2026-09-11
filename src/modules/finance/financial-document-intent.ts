export type DocumentIntentStorage = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Keeps an acknowledged browser intent stable across a page reload so a retry
 * reaches the server with the same idempotency key.
 */
export function resolvePersistentDocumentIntentKey(
  storage: DocumentIntentStorage | null,
  intent: string,
  create: () => string,
): string {
  if (!storage) return create();
  const existing = storage.getItem(intent);
  if (existing) return existing;
  const key = create();
  storage.setItem(intent, key);
  return key;
}

export function browserDocumentIntentStorage(): DocumentIntentStorage | null {
  return typeof window === 'undefined' ? null : window.sessionStorage;
}
