begin;

create function public.register_source_batch(
  requested_source_name text,
  requested_source_sha256 text,
  requested_workbook_row_count integer,
  requested_imported_by text,
  requested_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  batch private.source_batches%rowtype;
begin
  if requested_source_name is null or length(trim(requested_source_name)) < 1 then
    raise exception 'source name is required';
  end if;
  if requested_source_sha256 is null or requested_source_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'source sha256 is invalid';
  end if;
  if requested_workbook_row_count < 0 then
    raise exception 'workbook row count is invalid';
  end if;
  if requested_imported_by is null or length(trim(requested_imported_by)) < 1 then
    raise exception 'imported_by is required';
  end if;

  insert into private.source_batches (
    source_name,
    source_sha256,
    workbook_row_count,
    imported_by,
    notes
  ) values (
    trim(requested_source_name),
    requested_source_sha256,
    requested_workbook_row_count,
    trim(requested_imported_by),
    requested_notes
  )
  on conflict (source_sha256) do nothing;

  select * into strict batch
  from private.source_batches
  where source_sha256 = requested_source_sha256;

  if batch.source_name <> trim(requested_source_name)
     or batch.workbook_row_count <> requested_workbook_row_count then
    raise exception 'existing source batch metadata does not match';
  end if;

  return batch.id;
end;
$$;

create function public.ingest_source_rows(
  requested_batch_id uuid,
  requested_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  if requested_batch_id is null or not exists (
    select 1 from private.source_batches where id = requested_batch_id
  ) then
    raise exception 'source batch does not exist';
  end if;
  if jsonb_typeof(requested_rows) <> 'array'
     or jsonb_array_length(requested_rows) < 1
     or jsonb_array_length(requested_rows) > 500 then
    raise exception 'rows must be a JSON array containing 1 to 500 records';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(requested_rows) as candidate(
      worksheet text,
      source_row integer,
      source_business_id text,
      row_sha256 text,
      raw_payload jsonb
    )
    where candidate.worksheet is null
      or length(trim(candidate.worksheet)) = 0
      or candidate.source_row <= 1
      or candidate.row_sha256 !~ '^[a-f0-9]{64}$'
      or jsonb_typeof(candidate.raw_payload) <> 'object'
  ) then
    raise exception 'one or more source rows are invalid';
  end if;

  insert into private.source_listing_rows (
    batch_id,
    worksheet,
    source_row,
    source_business_id,
    row_sha256,
    raw_payload
  )
  select
    requested_batch_id,
    trim(source.worksheet),
    source.source_row,
    nullif(trim(source.source_business_id), ''),
    source.row_sha256,
    source.raw_payload
  from jsonb_to_recordset(requested_rows) as source(
    worksheet text,
    source_row integer,
    source_business_id text,
    row_sha256 text,
    raw_payload jsonb
  )
  on conflict (batch_id, worksheet, source_row) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.register_source_batch(text, text, integer, text, text)
  from public, anon, authenticated;
revoke all on function public.ingest_source_rows(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.register_source_batch(text, text, integer, text, text)
  to service_role;
grant execute on function public.ingest_source_rows(uuid, jsonb)
  to service_role;

comment on function public.register_source_batch(text, text, integer, text, text) is
  'Service-role-only idempotent registration for a licensed workbook receipt.';
comment on function public.ingest_source_rows(uuid, jsonb) is
  'Service-role-only append-only raw row ingestion in bounded batches.';

commit;
