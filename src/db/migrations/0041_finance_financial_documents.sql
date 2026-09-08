CREATE TABLE finance_financial_document_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  code TEXT NOT NULL, next_sequence_number BIGINT NOT NULL DEFAULT 1 CHECK (next_sequence_number > 0),
  CONSTRAINT finance_financial_document_series_unique UNIQUE (institution_id, code),
  CONSTRAINT finance_financial_document_series_tenant_unique UNIQUE (institution_id, id)
);
CREATE TABLE finance_financial_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  document_type TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('draft','issued')), series_id UUID, sequence_number BIGINT,
  source_snapshot JSONB NOT NULL CHECK (jsonb_typeof(source_snapshot)='object'), corrects_document_id UUID, issued_at TIMESTAMPTZ,
  CONSTRAINT finance_financial_documents_series_fk FOREIGN KEY (institution_id,series_id) REFERENCES finance_financial_document_series(institution_id,id) ON DELETE RESTRICT,
  CONSTRAINT finance_financial_documents_correction_fk FOREIGN KEY (institution_id,corrects_document_id) REFERENCES finance_financial_documents(institution_id,id) ON DELETE RESTRICT,
  CONSTRAINT finance_financial_documents_number_unique UNIQUE (institution_id, series_id, sequence_number),
  CONSTRAINT finance_financial_documents_tenant_unique UNIQUE (institution_id,id)
);
CREATE TABLE finance_financial_document_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), institution_id UUID NOT NULL, document_id UUID NOT NULL, source_type TEXT NOT NULL, source_id UUID NOT NULL, snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot)='object'),
  CONSTRAINT finance_financial_document_sources_document_fk FOREIGN KEY (institution_id,document_id) REFERENCES finance_financial_documents(institution_id,id) ON DELETE RESTRICT
);
