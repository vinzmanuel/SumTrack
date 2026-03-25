-- Add truthful creation metadata for future Recent Activity support.
-- Existing rows are intentionally left NULL so we do not invent fake history.

alter table public.loan_records
  add column if not exists created_at timestamp;

alter table public.loan_records
  alter column created_at set default now();

alter table public.loan_records
  add column if not exists created_by uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'loan_records_created_by_fkey'
  ) then
    alter table public.loan_records
      add constraint loan_records_created_by_fkey
      foreign key (created_by)
      references public.users(user_id)
      on delete set null;
  end if;
end $$;

alter table public.collections
  add column if not exists created_at timestamp;

alter table public.collections
  alter column created_at set default now();
