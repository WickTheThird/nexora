-- Round A5: void + credit-note flow.
--
-- For Revenue audit purposes, a numbered invoice that's been issued
-- CANNOT be deleted or have its number reused. Mistakes are corrected
-- two ways:
--   (a) VOID — the invoice stays in the sequence with status 'cancelled'
--       and a void_reason. PDF watermark "VOID". Sequence unbroken.
--   (b) CREDIT NOTE — a sibling document with its own number sequence
--       (BC-{shortname}-CN-{year}-{NNN}) that credits all or part of an
--       earlier invoice. Original invoice stays issued; net is zero.
--
-- We add the void metadata to primary_invoices and create a parallel
-- table for credit notes. Keep the columns nullable so the migration
-- doesn't break existing rows.

-- Void metadata on primary_invoices
ALTER TABLE primary_invoices ADD COLUMN voided_at         INTEGER;
ALTER TABLE primary_invoices ADD COLUMN voided_by         TEXT REFERENCES users(id);
ALTER TABLE primary_invoices ADD COLUMN void_reason       TEXT;

-- Credit notes
CREATE TABLE IF NOT EXISTS primary_credit_notes (
  id               TEXT PRIMARY KEY,
  primary_id       TEXT NOT NULL REFERENCES primaries(id) ON DELETE RESTRICT,
  -- The invoice this credit note credits. Required.
  invoice_id       TEXT NOT NULL REFERENCES primary_invoices(id) ON DELETE RESTRICT,
  credit_note_number TEXT NOT NULL,
  -- Amounts CREDITED (positive numbers). Subtract from the original invoice
  -- net to compute the residual amount the principal still owes.
  gross_minor      INTEGER NOT NULL,
  vat_minor        INTEGER NOT NULL DEFAULT 0,
  total_minor      INTEGER NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'EUR',
  reason           TEXT,
  status           TEXT NOT NULL DEFAULT 'issued'
    CHECK (status IN ('issued','sent','applied','cancelled')),
  issued_at        TEXT NOT NULL,
  created_at       INTEGER NOT NULL,
  created_by       TEXT REFERENCES users(id),
  -- Snapshots — same rationale as invoice snapshots (don't let live edits
  -- rewrite the credit note's appearance).
  principal_name_snapshot TEXT,
  bc_name_snapshot        TEXT
);
CREATE INDEX IF NOT EXISTS idx_credit_notes_primary ON primary_credit_notes(primary_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice ON primary_credit_notes(invoice_id);
