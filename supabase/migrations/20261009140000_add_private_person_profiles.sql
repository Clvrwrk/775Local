begin;

-- A person's private profile is independent of identity projection and listing authority.
create table app.person_profiles (
  actor_id uuid primary key references app.actors(id),
  display_name text not null check (length(btrim(display_name,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')) between 2 and 100),
  city text not null default '' check (city in ('','reno','sparks','other')),
  bio text not null default '' check (length(bio) <= 500),
  version integer not null check (version > 0),
  updated_at timestamptz not null default statement_timestamp()
);
alter table app.person_profiles enable row level security;
create policy profile_self_read on app.person_profiles for select to authenticated
  using (actor_id = app.current_actor_id());
revoke all on app.person_profiles from public, anon, authenticated;
grant select on app.person_profiles to authenticated;

create table private.profile_save_receipts (
  actor_id uuid not null references app.actors(id),
  idempotency_key text not null,
  request_hash text not null,
  version integer not null,
  created_at timestamptz not null default statement_timestamp(),
  primary key(actor_id,idempotency_key)
);
alter table private.profile_save_receipts enable row level security;
revoke all on private.profile_save_receipts from public, anon, authenticated;

create function public.get_my_profile() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid := app.current_actor_id();
begin
  if actor is null then raise exception 'authentication_required'; end if;
  return (select jsonb_build_object('displayName',display_name,'city',city,'bio',bio,'version',version)
    from app.person_profiles where actor_id=actor);
end;
$$;

create function public.save_my_profile(requested_payload jsonb, requested_version integer, requested_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid := app.current_actor_id();
  existing private.profile_save_receipts%rowtype;
  current_version integer;
  request_hash text;
begin
  if actor is null then raise exception 'authentication_required'; end if;
  if jsonb_typeof(requested_payload) is distinct from 'object'
    or requested_payload - array['displayName','city','bio'] <> '{}'::jsonb
    or jsonb_typeof(requested_payload->'displayName') is distinct from 'string'
    or jsonb_typeof(requested_payload->'city') is distinct from 'string'
    or jsonb_typeof(requested_payload->'bio') is distinct from 'string'
    or length(btrim(requested_payload->>'displayName',U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')) not between 2 and 100
    or requested_payload->>'displayName' ~ '[[:cntrl:]]'
    or length(requested_payload->>'bio') > 500
    or requested_payload->>'bio' ~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]'
    or requested_payload->>'city' not in ('','reno','sparks','other')
    or requested_version is null or requested_version not between 0 and 2147483646
    or requested_key is null or requested_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$'
    then raise exception 'invalid_profile'; end if;
  request_hash := encode(extensions.digest((requested_payload::text||':'||requested_version::text)::bytea,'sha256'),'hex');
  -- Serialize all writes for one actor, including concurrent first saves.
  perform pg_advisory_xact_lock(hashtextextended('person-profile:'||actor::text,0));
  select * into existing from private.profile_save_receipts
    where actor_id=actor and idempotency_key=requested_key;
  if found then
    if existing.request_hash<>request_hash then raise exception 'idempotency_conflict'; end if;
    return public.get_my_profile();
  end if;
  select version into current_version from app.person_profiles where actor_id=actor for update;
  if coalesce(current_version,0)<>requested_version then raise exception 'profile_changed'; end if;
  insert into app.person_profiles(actor_id,display_name,city,bio,version)
    values(actor,btrim(requested_payload->>'displayName',U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'),requested_payload->>'city',btrim(requested_payload->>'bio',U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'),requested_version+1)
    on conflict(actor_id) do update set display_name=excluded.display_name,city=excluded.city,
      bio=excluded.bio,version=excluded.version,updated_at=statement_timestamp();
  insert into private.profile_save_receipts(actor_id,idempotency_key,request_hash,version)
    values(actor,requested_key,request_hash,requested_version+1);
  -- Audit only the revision; personal content is neither logged nor sent to providers.
  insert into app.audit_events(actor_id,actor_kind,action,target_type,target_id,request_id,after_ref)
    values(actor,'resident','person_profile.saved','person_profile',actor::text,requested_key,
      jsonb_build_object('version',requested_version+1));
  return public.get_my_profile();
end;
$$;
revoke all on function public.get_my_profile(),public.save_my_profile(jsonb,integer,text) from public,anon;
grant execute on function public.get_my_profile(),public.save_my_profile(jsonb,integer,text) to authenticated;
commit;
