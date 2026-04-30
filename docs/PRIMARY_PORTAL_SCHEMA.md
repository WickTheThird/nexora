# Primary Portal — Schema Migration

Run **one statement at a time** in the D1 console.

## Add `primary_id` to users

```sql
ALTER TABLE users ADD COLUMN primary_id TEXT REFERENCES primaries(id);
```

```sql
CREATE INDEX IF NOT EXISTS idx_users_primary ON users(primary_id);
```

## Verify

```sql
SELECT name FROM pragma_table_info('users') WHERE name = 'primary_id';
```

Should return one row: `primary_id`.

```sql
SELECT type, name, sql FROM sqlite_master WHERE name = 'idx_users_primary';
```

Should return the index definition.

That's it. The `users.role` column already exists as TEXT — no constraint widening needed for the new `'primary'` role value (the column has no CHECK constraint on the role).
