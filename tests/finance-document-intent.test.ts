import assert from 'node:assert/strict';
import { resolvePersistentDocumentIntentKey } from '../src/modules/finance/financial-document-intent.ts';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const storage = new MemoryStorage();
const first = resolvePersistentDocumentIntentKey(storage, 'receipt:payment-7:series-rec', () => 'receipt-intent-1');
const afterReload = resolvePersistentDocumentIntentKey(storage, 'receipt:payment-7:series-rec', () => 'receipt-intent-2');

assert.equal(first, 'receipt-intent-1');
assert.equal(afterReload, 'receipt-intent-1', 'a retried browser intent must retain its original idempotency key after a reload');
console.log('FINANCE_DOCUMENT_PERSISTENT_INTENT=PASS');
