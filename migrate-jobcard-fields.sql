-- Group 1: add Job Card Type + Date Ending to primary_submissions, mirroring
-- Enagh's job card concept. Existing rows will have NULL — frontend treats
-- those as 'weekly' for back-compat.
ALTER TABLE primary_submissions ADD COLUMN job_card_type TEXT;
ALTER TABLE primary_submissions ADD COLUMN date_ending TEXT;
