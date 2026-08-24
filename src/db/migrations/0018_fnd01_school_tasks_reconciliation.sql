-- FND-01 CP4: migration-owned School Tasks reconciliation. Never invent ownership.
DO $$
DECLARE row_count bigint; ownership_columns integer; missing_ownership bigint;
BEGIN
  IF to_regclass('school_tasks') IS NULL THEN
    CREATE TABLE school_tasks (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
      assigned_to TEXT NOT NULL DEFAULT 'Não atribuído', department TEXT NOT NULL DEFAULT 'Secretaria',
      priority TEXT NOT NULL DEFAULT 'Normal', status TEXT NOT NULL DEFAULT 'Pendente',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), due_date DATE NOT NULL, limit_date DATE NOT NULL,
      created_automatically BOOLEAN DEFAULT false, reference_id TEXT, reference_type TEXT, observations TEXT,
      history JSONB DEFAULT '[]'::jsonb, attachments JSONB DEFAULT '[]'::jsonb, updated_at TIMESTAMPTZ DEFAULT NOW(),
      created_by TEXT, executed_by TEXT, completed_by TEXT, completed_at TIMESTAMPTZ, dependencies JSONB DEFAULT '[]'::jsonb,
      is_deleted BOOLEAN NOT NULL DEFAULT false, deleted_at TIMESTAMPTZ, deleted_by TEXT,
      started_at TIMESTAMPTZ, first_response_at TIMESTAMPTZ, sla_deadline TIMESTAMPTZ, sla_status TEXT DEFAULT 'On Track',
      tenant_id TEXT NOT NULL, school_id TEXT NOT NULL, organization_id TEXT NOT NULL
    );
  ELSE
    SELECT count(*) INTO row_count FROM school_tasks;
    SELECT count(*) INTO ownership_columns FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'school_tasks'
        AND column_name IN ('tenant_id','school_id','organization_id');
    IF row_count > 0 THEN
      IF ownership_columns <> 3 THEN RAISE EXCEPTION 'school_tasks recovery/data classification required: existing rows lack complete ownership columns'; END IF;
      EXECUTE 'SELECT count(*) FROM school_tasks WHERE tenant_id IS NULL OR school_id IS NULL OR organization_id IS NULL' INTO missing_ownership;
      IF missing_ownership > 0 THEN RAISE EXCEPTION 'school_tasks recovery/data classification required: existing rows lack proven ownership'; END IF;
    ELSE
      ALTER TABLE school_tasks ADD COLUMN IF NOT EXISTS tenant_id TEXT;
      ALTER TABLE school_tasks ADD COLUMN IF NOT EXISTS school_id TEXT;
      ALTER TABLE school_tasks ADD COLUMN IF NOT EXISTS organization_id TEXT;
      ALTER TABLE school_tasks ALTER COLUMN tenant_id SET NOT NULL;
      ALTER TABLE school_tasks ALTER COLUMN school_id SET NOT NULL;
      ALTER TABLE school_tasks ALTER COLUMN organization_id SET NOT NULL;
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS task_versions (
  id SERIAL PRIMARY KEY, task_id TEXT NOT NULL, version INTEGER NOT NULL, snapshot JSONB NOT NULL,
  changed_by TEXT NOT NULL, changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), action TEXT NOT NULL,
  request_id TEXT, correlation_id TEXT, ip_address TEXT, user_agent TEXT, diff JSONB,
  CONSTRAINT task_versions_task_version_unique UNIQUE (task_id, version)
);
CREATE INDEX IF NOT EXISTS school_tasks_tenant_status_idx ON school_tasks (tenant_id, status);
CREATE INDEX IF NOT EXISTS school_tasks_tenant_deleted_idx ON school_tasks (tenant_id, is_deleted);
CREATE INDEX IF NOT EXISTS task_versions_task_id_version_idx ON task_versions (task_id, version DESC);
