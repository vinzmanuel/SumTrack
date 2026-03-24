UPDATE public.loan_records
SET status = lower(status)
WHERE status IS NOT NULL
  AND status <> lower(status);

ALTER TABLE public.loan_records
DROP CONSTRAINT IF EXISTS loan_records_status_check;

ALTER TABLE public.loan_records
ADD CONSTRAINT loan_records_status_check
CHECK (status IN ('active', 'overdue', 'completed', 'archived', 'abandoned'));

-- Daily loan-status reconciliation should run just after midnight Manila time.
-- Asia/Manila is UTC+08:00, so 12:05 AM Manila is 16:05 UTC on the previous day.
-- Replace <APP_BASE_URL> and <LOAN_STATUS_CRON_SECRET> before running in Supabase SQL editor.
DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid
  INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'sumtrack-daily-loan-status-reconciliation'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;
END $$;

SELECT cron.schedule(
  'sumtrack-daily-loan-status-reconciliation',
  '5 16 * * *',
  $$
  SELECT
    net.http_post(
      url := '<APP_BASE_URL>/dashboard/loans/status-reconciliation',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <LOAN_STATUS_CRON_SECRET>'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
