begin;

create table private.listing_intelligence_import_chunks (
  session_key text not null check (length(session_key) between 16 and 200),
  chunk_index integer not null check (chunk_index >= 0),
  chunk_base64 text not null check (length(chunk_base64) between 1 and 500000),
  created_at timestamptz not null default statement_timestamp(),
  primary key (session_key, chunk_index)
);

alter table private.listing_intelligence_import_chunks enable row level security;
revoke all on private.listing_intelligence_import_chunks from public, anon, authenticated;

create function public.stage_listing_intelligence_page_chunk(
  requested_session_key text,
  requested_chunk_index integer,
  requested_chunk_base64 text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  stored_chunk text;
begin
  if length(requested_session_key) not between 16 and 200
     or requested_chunk_index < 0
     or length(requested_chunk_base64) not between 1 and 500000
     or requested_chunk_base64 !~ '^[A-Za-z0-9+/=]+$' then
    raise exception 'invalid staged page chunk';
  end if;

  insert into private.listing_intelligence_import_chunks (
    session_key, chunk_index, chunk_base64
  ) values (
    requested_session_key, requested_chunk_index, requested_chunk_base64
  ) on conflict (session_key, chunk_index) do nothing;

  select chunk_base64 into strict stored_chunk
  from private.listing_intelligence_import_chunks
  where session_key = requested_session_key and chunk_index = requested_chunk_index;
  if stored_chunk <> requested_chunk_base64 then
    raise exception 'staged page chunk does not match';
  end if;
  return requested_chunk_index;
end;
$$;

create function public.finalize_listing_intelligence_staged_page(
  requested_capture_id bigint,
  requested_session_key text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  chunk_count integer;
  maximum_index integer;
  encoded_payload text;
  page_payload jsonb;
  inserted_count integer;
begin
  select count(*), max(chunk_index), string_agg(chunk_base64, '' order by chunk_index)
  into chunk_count, maximum_index, encoded_payload
  from private.listing_intelligence_import_chunks
  where session_key = requested_session_key;

  if chunk_count < 1 or maximum_index <> chunk_count - 1 then
    raise exception 'staged page chunks are incomplete';
  end if;

  page_payload := convert_from(decode(encoded_payload, 'base64'), 'UTF8')::jsonb;
  inserted_count := public.ingest_listing_source_capture_pages(
    requested_capture_id,
    jsonb_build_array(page_payload)
  );

  delete from private.listing_intelligence_import_chunks
  where session_key = requested_session_key;
  return inserted_count;
end;
$$;

revoke all on function public.stage_listing_intelligence_page_chunk(text, integer, text)
  from public, anon, authenticated;
revoke all on function public.finalize_listing_intelligence_staged_page(bigint, text)
  from public, anon, authenticated;
grant execute on function public.stage_listing_intelligence_page_chunk(text, integer, text)
  to service_role;
grant execute on function public.finalize_listing_intelligence_staged_page(bigint, text)
  to service_role;

comment on table private.listing_intelligence_import_chunks is
  'Ephemeral owner-only staging for lossless capture pages that exceed SQL transport limits.';

commit;
