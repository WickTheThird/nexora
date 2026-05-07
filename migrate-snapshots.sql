-- Round A2 + A4: snapshot every value that affects money or appears on a
-- printed/audit document at the moment of issuance. Without snapshots,
-- editing the live VAT rate or admin fee or principal name silently
-- rewrites the past — auditors hate that.
--
-- All columns are nullable so the migration is non-breaking. New writes
-- populate them at insert time; reads should prefer snapshot value over
-- the live join when present.

-- ===== primary_invoices snapshots =====
ALTER TABLE primary_invoices ADD COLUMN principal_name_snapshot         TEXT;
ALTER TABLE primary_invoices ADD COLUMN principal_vat_snapshot          TEXT;
ALTER TABLE primary_invoices ADD COLUMN principal_address_snapshot      TEXT;
ALTER TABLE primary_invoices ADD COLUMN bc_name_snapshot                TEXT;
ALTER TABLE primary_invoices ADD COLUMN bc_vat_snapshot                 TEXT;
ALTER TABLE primary_invoices ADD COLUMN bc_address_snapshot             TEXT;
ALTER TABLE primary_invoices ADD COLUMN admin_fee_flat_minor_snapshot   INTEGER;
ALTER TABLE primary_invoices ADD COLUMN admin_fee_percent_snapshot      REAL;
ALTER TABLE primary_invoices ADD COLUMN vat_rate_percent_snapshot       REAL;

-- ===== payment_records snapshots (advices issued to subs) =====
ALTER TABLE payment_records ADD COLUMN sub_name_snapshot       TEXT;
ALTER TABLE payment_records ADD COLUMN sub_iban_snapshot       TEXT;
ALTER TABLE payment_records ADD COLUMN sub_bic_snapshot        TEXT;
ALTER TABLE payment_records ADD COLUMN sub_holder_snapshot     TEXT;
ALTER TABLE payment_records ADD COLUMN principal_name_snapshot TEXT;
ALTER TABLE payment_records ADD COLUMN site_id_snapshot        TEXT;
ALTER TABLE payment_records ADD COLUMN site_project_snapshot   TEXT;
ALTER TABLE payment_records ADD COLUMN site_address_snapshot   TEXT;

-- ===== primary_submission_items snapshots =====
ALTER TABLE primary_submission_items ADD COLUMN site_id_snapshot        TEXT;
ALTER TABLE primary_submission_items ADD COLUMN site_project_snapshot   TEXT;
ALTER TABLE primary_submission_items ADD COLUMN site_address_snapshot   TEXT;
ALTER TABLE primary_submission_items ADD COLUMN operative_name_snapshot TEXT;
ALTER TABLE primary_submission_items ADD COLUMN operative_rate_snapshot INTEGER;
