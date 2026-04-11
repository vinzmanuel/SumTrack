update public.audit_logs
set metadata = jsonb_set(
  metadata,
  '{incentiveKind}',
  to_jsonb(
    case entity_type
      when 'incentive_rule' then 'rule'
      when 'incentive_batch' then 'batch'
      when 'incentive_payout' then 'payout'
      else coalesce(metadata->>'incentiveKind', 'unknown')
    end
  ),
  true
)
where entity_type in ('incentive_rule', 'incentive_batch', 'incentive_payout');

update public.audit_logs
set entity_type = 'incentive'
where entity_type in ('incentive_rule', 'incentive_batch', 'incentive_payout');

alter table public.audit_logs
  drop constraint if exists audit_logs_entity_type_check;

alter table public.audit_logs
  add constraint audit_logs_entity_type_check check (
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
  );
