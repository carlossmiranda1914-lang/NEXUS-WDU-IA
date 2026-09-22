/**
 * scripts/nexus-uat-modules.mjs
 * LOCAL UAT HARNESS v1 — Module Registry
 *
 * Minimum module→preflight/dependency mapping.
 * No generic plugin framework. Only what is required for the approved ACs.
 */

export const KNOWN_MODULES = {
  documents: {
    name: 'documents',
    description: 'Documents Foundation',
    envRequired: [
      'DOCUMENTS_STORAGE_PROVIDER',
      'DOCUMENTS_STORAGE_BUCKET',
      'DOCUMENTS_ACCESS_GRANT_TOKEN_KEY',
    ],
    dbTablesRequired: ['documents', 'document_versions', 'document_associations'],
  },
  finance: {
    name: 'finance',
    description: 'Finance',
    envRequired: [],
    dbTablesRequired: ['invoices'],
  },
  core: {
    name: 'core',
    description: 'Core runtime (no module-specific dependencies)',
    envRequired: [],
    dbTablesRequired: [],
  },
};

/**
 * @param {string} name
 * @returns {object|null}
 */
export function resolveModule(name) {
  if (!name) return null;
  return KNOWN_MODULES[name.toLowerCase()] ?? null;
}

/** @returns {string[]} */
export function listModules() {
  return Object.keys(KNOWN_MODULES);
}
