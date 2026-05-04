-- Add closed_at column to subcontractors so principals can mark
-- operatives as "closed" (Enagh terminology) without affecting the
-- onboarding_status enum. The presence of a non-null value means the
-- operative is closed (no longer working under this principal); UI
-- buckets them in the "Closed" section. Reactivation = setting closed_at
-- back to NULL (which fires an admin re-confirmation).
ALTER TABLE subcontractors ADD COLUMN closed_at INTEGER;
