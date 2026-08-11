CREATE TABLE IF NOT EXISTS operational_logs (
  id SERIAL PRIMARY KEY,
  user_id TEXT,
  user_name TEXT NOT NULL DEFAULT 'System',
  user_role TEXT NOT NULL DEFAULT 'system',
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE operational_logs
  ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES institutions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS request_id TEXT,
  ADD COLUMN IF NOT EXISTS correlation_id TEXT,
  ADD COLUMN IF NOT EXISTS outcome TEXT NOT NULL DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS operational_logs_institution_created_idx
  ON operational_logs (institution_id, created_at DESC);

CREATE INDEX IF NOT EXISTS operational_logs_correlation_idx
  ON operational_logs (correlation_id)
  WHERE correlation_id IS NOT NULL;
