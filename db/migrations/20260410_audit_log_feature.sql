create table if not exists public.audit_logs (
  audit_log_id bigint generated always as identity primary key,
  occurred_at timestamp with time zone not null default now(),
  actor_type text not null default 'user',
  actor_user_id uuid null,
  actor_company_id varchar(80) null,
  actor_display_name text null,
  actor_role_name varchar(80) null,
  action varchar(120) not null,
  entity_type varchar(80) not null,
  entity_id varchar(160) null,
  branch_id integer null,
  branch_scope integer[] not null default '{}'::integer[],
  target_user_id uuid null,
  target_company_id varchar(80) null,
  target_display_name text null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  ip_address varchar(120) null,
  user_agent text null,
  constraint audit_logs_actor_user_id_fkey foreign key (actor_user_id) references public.users(user_id) on delete set null,
  constraint audit_logs_branch_id_fkey foreign key (branch_id) references public.branch(branch_id) on delete set null,
  constraint audit_logs_target_user_id_fkey foreign key (target_user_id) references public.users(user_id) on delete set null,
  constraint audit_logs_actor_type_check check (actor_type in ('user', 'system')),
  constraint audit_logs_actor_consistency_check check (
    (actor_type = 'system') or (actor_type = 'user' and actor_user_id is not null)
  ),
  constraint audit_logs_action_check check (
    action in (
      'auth.login_succeeded',
      'auth.login_failed',
      'auth.logout',
      'auth.otp_sent',
      'auth.otp_verified',
      'auth.otp_failed',
      'auth.password_reset_requested',
      'auth.password_reset_completed',
      'user.created',
      'user.deactivated',
      'user.reactivated',
      'user.role_changed',
      'assignment.branch_started',
      'assignment.branch_ended',
      'assignment.area_started',
      'assignment.area_ended',
      'user.promoted',
      'user.reassigned',
      'loan.created',
      'loan.status_changed_manual',
      'loan.status_changed_system',
      'loan.collector_changed',
      'collection.recorded',
      'expense.created',
      'document.uploaded',
      'document.deleted',
      'document.replaced',
      'report.generated',
      'report.exported',
      'report.generated_system_monthly',
      'incentive.rule_created',
      'incentive.batch_finalized',
      'incentive.payout_recorded',
      'incentive.report_generated'
    )
  ),
  constraint audit_logs_entity_type_check check (
    entity_type in (
      'auth',
      'user',
      'assignment',
      'loan',
      'collection',
      'expense',
      'document',
      'report',
      'incentive'
    )
  )
);

create index if not exists audit_logs_occurred_at_idx
  on public.audit_logs (occurred_at);

create index if not exists audit_logs_action_occurred_at_idx
  on public.audit_logs (action, occurred_at);

create index if not exists audit_logs_entity_lookup_idx
  on public.audit_logs (entity_type, entity_id);

create index if not exists audit_logs_actor_user_occurred_at_idx
  on public.audit_logs (actor_user_id, occurred_at);

create index if not exists audit_logs_target_user_occurred_at_idx
  on public.audit_logs (target_user_id, occurred_at);

create index if not exists audit_logs_branch_occurred_at_idx
  on public.audit_logs (branch_id, occurred_at);

create index if not exists audit_logs_branch_scope_gin_idx
  on public.audit_logs using gin (branch_scope);
