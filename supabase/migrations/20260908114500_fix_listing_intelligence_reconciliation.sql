begin;

create or replace function public.reconcile_listing_intelligence_accounts()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  reconciled_count integer;
begin
  with latest as (
    select distinct on (audit.listing_id)
      audit.listing_id, audit.id, audit.terminal_status
    from private.listing_seo_audits audit
    order by audit.listing_id, audit.recorded_at desc, audit.id desc
  )
  update private.listing_intelligence_accounts account set
    latest_seo_audit_id = latest.id,
    seo_audit_status = latest.terminal_status,
    updated_at = statement_timestamp()
  from latest
  where latest.listing_id = account.listing_id;
  get diagnostics reconciled_count = row_count;
  return jsonb_build_object('reconciledAccounts', reconciled_count);
end;
$$;

commit;
