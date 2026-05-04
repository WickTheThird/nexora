-- Site IDs: per-principal managed list of registered Revenue SIN numbers.
-- Mirrors Enagh's "Site IDs" page. The principal adds these once and they
-- become the dropdown options on every Job Card / payment submission.
--
-- Each row is scoped to a primary_id; the (primary_id, site_id) UNIQUE
-- constraint prevents duplicate SINs within one principal but allows the
-- same SIN to live under different principals in the rare case that two
-- developers share one Revenue contract registration.

CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  primary_id TEXT NOT NULL REFERENCES primaries(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL,
  project_name TEXT,
  address TEXT,
  notes TEXT,
  created_by TEXT REFERENCES users(id),
  archived_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (primary_id, site_id)
);

CREATE INDEX IF NOT EXISTS idx_sites_primary ON sites(primary_id);
CREATE INDEX IF NOT EXISTS idx_sites_active ON sites(primary_id) WHERE archived_at IS NULL;
