alter table public.audit_logs
  drop constraint if exists audit_logs_action_check;

alter table public.audit_logs
  add constraint audit_logs_action_check check (
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
      'user.details_updated',
      'user.role_changed',
      'assignment.branch_started',
      'assignment.branch_ended',
      'assignment.area_started',
      'assignment.area_ended',
      'user.promoted',
      'user.reassigned',
      'user.deleted',
      'loan.created',
      'loan.deleted',
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
  );
