ALTER TABLE borrower_docs
ADD COLUMN IF NOT EXISTS uploaded_by uuid,
ADD COLUMN IF NOT EXISTS original_filename text NOT NULL DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS mime_type text NOT NULL DEFAULT 'application/octet-stream',
ADD COLUMN IF NOT EXISTS file_size bigint NOT NULL DEFAULT 0;

ALTER TABLE borrower_docs
ALTER COLUMN original_filename DROP DEFAULT,
ALTER COLUMN mime_type DROP DEFAULT,
ALTER COLUMN file_size DROP DEFAULT;

ALTER TABLE loan_docs
ADD COLUMN IF NOT EXISTS uploaded_by uuid,
ADD COLUMN IF NOT EXISTS original_filename text NOT NULL DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS mime_type text NOT NULL DEFAULT 'application/octet-stream',
ADD COLUMN IF NOT EXISTS file_size bigint NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'borrower_docs_uploaded_by_fkey'
  ) THEN
    ALTER TABLE borrower_docs
    ADD CONSTRAINT borrower_docs_uploaded_by_fkey
    FOREIGN KEY (uploaded_by)
    REFERENCES users (user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'loan_docs_uploaded_by_fkey'
  ) THEN
    ALTER TABLE loan_docs
    ADD CONSTRAINT loan_docs_uploaded_by_fkey
    FOREIGN KEY (uploaded_by)
    REFERENCES users (user_id);
  END IF;
END $$;

ALTER TABLE loan_docs
ALTER COLUMN original_filename DROP DEFAULT,
ALTER COLUMN mime_type DROP DEFAULT,
ALTER COLUMN file_size DROP DEFAULT;
