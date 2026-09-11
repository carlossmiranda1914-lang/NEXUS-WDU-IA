import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Documents Events Architectural Boundary Fence (I7)', () => {
  const rootDir = path.resolve(__dirname, '..');

  it('should not contain global platform event infrastructure in common/shared packages', () => {
    const forbiddenSharedPaths = [
      path.join(rootDir, 'src', 'events'),
      path.join(rootDir, 'src', 'common', 'events'),
      path.join(rootDir, 'src', 'platform', 'events'),
    ];

    for (const forbidden of forbiddenSharedPaths) {
      assert.equal(
        fs.existsSync(forbidden),
        false,
        `Global event directory ${forbidden} must not exist — events are strictly Documents-owned`,
      );
    }
  });

  it('should confirm document event files exist strictly within documents module', () => {
    const expectedModuleFiles = [
      'document-event-model.ts',
      'document-event-repository.ts',
      'document-outbox-command.ts',
      'document-event-consumer.ts',
    ];

    for (const file of expectedModuleFiles) {
      const fullPath = path.join(rootDir, 'src', 'modules', 'documents', file);
      assert.ok(
        fs.existsSync(fullPath),
        `Expected documents event file ${file} must exist at ${fullPath}`,
      );
    }
  });

  it('should confirm migration 0037 defines document_outbox_events and document_event_consumer_ledger', () => {
    const migrationPath = path.join(
      rootDir,
      'src',
      'db',
      'migrations',
      '0037_documents_events_operational_integration.sql',
    );
    assert.ok(fs.existsSync(migrationPath), 'Migration 0037 must exist');

    const content = fs.readFileSync(migrationPath, 'utf-8');
    assert.ok(content.includes('CREATE TABLE IF NOT EXISTS document_outbox_events'));
    assert.ok(content.includes('CREATE TABLE IF NOT EXISTS document_event_consumer_ledger'));
    assert.ok(content.includes('institution_id'));
    assert.ok(content.includes('schema_version'));
    assert.ok(content.includes('status'));
  });

  it('should not modify forbidden files (Finance, IAM, Enrollments, Auth, Middleware, Server)', () => {
    const forbiddenFiles = [
      'server.ts',
      'src/db/schema.ts',
    ];

    for (const file of forbiddenFiles) {
      const fullPath = path.join(rootDir, file);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        assert.ok(
          !content.includes('document_outbox_events'),
          `Forbidden file ${file} should not reference document_outbox_events`,
        );
      }
    }
  });
});
