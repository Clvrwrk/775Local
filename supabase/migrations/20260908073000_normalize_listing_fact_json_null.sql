begin;

-- Persistent Preview received the ledger before the clean-install function
-- normalized JSON null to SQL NULL. Keep ingestion fail-closed while making
-- old and new clients safe during the forward-only rollout.
create function private.normalize_listing_fact_json_null()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.top_service_offering = 'null'::jsonb then
    new.top_service_offering = null;
  end if;
  return new;
end;
$$;

create trigger listing_source_fact_sets_normalize_json_null
before insert on private.listing_source_fact_sets
for each row execute function private.normalize_listing_fact_json_null();

commit;
