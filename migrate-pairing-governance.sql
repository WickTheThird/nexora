-- Pairing governance: when admin assigns a subcontractor to a principal,
-- the principal must accept the pairing before the sub appears on their
-- Job Card auto-list. Mirrors a real-world contracts model: BC introduces
-- the operative; the principal decides if they're going to engage.
--
-- Column on subcontractors:
--   primary_link_status — null = no pairing, 'proposed' = waiting for
--   principal, 'active' = principal accepted, 'declined' = principal
--   declined (sub stays linked but doesn't appear on principal's Active
--   list; admin can reassign).
ALTER TABLE subcontractors ADD COLUMN primary_link_status TEXT;
ALTER TABLE subcontractors ADD COLUMN primary_link_proposed_at INTEGER;
ALTER TABLE subcontractors ADD COLUMN primary_link_decided_at INTEGER;
ALTER TABLE subcontractors ADD COLUMN primary_link_decided_by TEXT REFERENCES users(id);
ALTER TABLE subcontractors ADD COLUMN primary_link_declined_reason TEXT;

-- Backfill: any existing operative that already has a primary_id is
-- treated as already-accepted ('active'). Otherwise status stays NULL.
UPDATE subcontractors SET primary_link_status = 'active'
  WHERE primary_id IS NOT NULL AND primary_link_status IS NULL;
