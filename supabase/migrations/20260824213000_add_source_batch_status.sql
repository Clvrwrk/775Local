begin;

create function public.source_batch_status(requested_batch_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'batch_id', batch.id,
    'source_sha256', batch.source_sha256,
    'expected_row_count', batch.workbook_row_count,
    'stored_row_count', (
      select count(*) from private.source_listing_rows rows where rows.batch_id = batch.id
    ),
    'complete', (
      select count(*) from private.source_listing_rows rows where rows.batch_id = batch.id
    ) = batch.workbook_row_count,
    'worksheets', coalesce(
      (
        select jsonb_object_agg(counts.worksheet, counts.row_count)
        from (
          select rows.worksheet, count(*) as row_count
          from private.source_listing_rows rows
          where rows.batch_id = batch.id
          group by rows.worksheet
        ) counts
      ),
      '{}'::jsonb
    )
  )
  from private.source_batches batch
  where batch.id = requested_batch_id
$$;

revoke all on function public.source_batch_status(uuid) from public, anon, authenticated;
grant execute on function public.source_batch_status(uuid) to service_role;

comment on function public.source_batch_status(uuid) is
  'Service-role-only reconciliation receipt for immutable raw workbook ingestion.';

commit;
