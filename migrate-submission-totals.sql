-- Round A3: store the totals the client computed at submit time so we
-- can prove "the user saw THIS total" forever, even if VAT or Less-Subs
-- settings change later. Also stores per-line VAT (sum of round(line *
-- vatRate)) which matches Revenue's preferred per-line rounding rather
-- than rounding-after-aggregation.
ALTER TABLE primary_submissions ADD COLUMN vat_amount_minor INTEGER;
ALTER TABLE primary_submissions ADD COLUMN less_subs_applied_minor INTEGER;
ALTER TABLE primary_submissions ADD COLUMN total_to_pay_minor INTEGER;
ALTER TABLE primary_submissions ADD COLUMN vat_rate_percent_snapshot REAL;

-- Per-line VAT (matches Revenue's per-line rounding rule).
ALTER TABLE primary_submission_items ADD COLUMN vat_amount_minor INTEGER;
