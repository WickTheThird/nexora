# 3-Tier Schema Migration

Run **one statement at a time** in the D1 console.

## 1. Primaries table (top tier - developers / main contractors)

```sql
CREATE TABLE IF NOT EXISTS primaries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  address TEXT,
  vat TEXT,
  phone TEXT,
  notes TEXT,
  archived_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

```sql
CREATE INDEX IF NOT EXISTS idx_primaries_name ON primaries(name);
```

## 2. Link subcontractors and timesheets to a primary (default association + per-timesheet override)

```sql
ALTER TABLE subcontractors ADD COLUMN primary_id TEXT REFERENCES primaries(id);
```

```sql
ALTER TABLE timesheets ADD COLUMN primary_id TEXT REFERENCES primaries(id);
```

```sql
ALTER TABLE payment_records ADD COLUMN primary_id TEXT REFERENCES primaries(id);
```

```sql
CREATE INDEX IF NOT EXISTS idx_subcontractors_primary ON subcontractors(primary_id);
```

```sql
CREATE INDEX IF NOT EXISTS idx_timesheets_primary ON timesheets(primary_id);
```

## 3. Primary invoices (BC → primary direction)

```sql
CREATE TABLE IF NOT EXISTS primary_invoices (
  id TEXT PRIMARY KEY,
  primary_id TEXT NOT NULL REFERENCES primaries(id) ON DELETE RESTRICT,
  invoice_number TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  gross_minor INTEGER NOT NULL,
  markup_minor INTEGER NOT NULL DEFAULT 0,
  net_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','cancelled')),
  notes TEXT,
  issued_at TEXT NOT NULL,
  sent_at INTEGER,
  paid_at INTEGER,
  created_at INTEGER NOT NULL,
  created_by TEXT REFERENCES users(id)
);
```

```sql
CREATE INDEX IF NOT EXISTS idx_primary_invoices_primary ON primary_invoices(primary_id);
```

```sql
CREATE INDEX IF NOT EXISTS idx_primary_invoices_status ON primary_invoices(status);
```

## 4. Verification

After all statements run, this should return 4 rows:

```sql
SELECT name FROM sqlite_master WHERE type='table' AND name IN ('primaries','primary_invoices','timesheets','payment_records');
```

And these `pragma_table_info` checks should each show `primary_id`:

```sql
SELECT name FROM pragma_table_info('subcontractors') WHERE name = 'primary_id';
SELECT name FROM pragma_table_info('timesheets')     WHERE name = 'primary_id';
SELECT name FROM pragma_table_info('payment_records') WHERE name = 'primary_id';
```
