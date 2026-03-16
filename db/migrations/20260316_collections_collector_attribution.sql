ALTER TABLE collections
ADD COLUMN IF NOT EXISTS collector_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'collections_collector_id_fkey'
  ) THEN
    ALTER TABLE collections
    ADD CONSTRAINT collections_collector_id_fkey
    FOREIGN KEY (collector_id)
    REFERENCES users (user_id)
    ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS collections_collector_id_idx
ON collections (collector_id);

UPDATE collections
SET collector_id = loan_records.collector_id
FROM loan_records
WHERE collections.loan_id = loan_records.loan_id
  AND collections.collector_id IS NULL
  AND loan_records.collector_id IS NOT NULL;
