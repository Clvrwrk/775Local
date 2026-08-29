begin;

alter table app.operator_grants
  add column workos_organization_id text;

alter table app.operator_grants
  add constraint operator_grants_active_org_required
  check (status <> 'active' or workos_organization_id is not null);

create or replace function public.sync_workos_actor(
  requested_workos_user_id text,
  requested_primary_email text,
  requested_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
begin
  if requested_workos_user_id !~ '^user_[A-Za-z0-9]+$' then
    raise exception 'invalid WorkOS user id';
  end if;
  if requested_primary_email is null or requested_primary_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid primary email';
  end if;

  insert into app.actors (workos_user_id, primary_email, display_name)
  values (
    requested_workos_user_id,
    lower(requested_primary_email),
    nullif(trim(requested_display_name), '')
  )
  on conflict (workos_user_id) do update
  set primary_email = excluded.primary_email,
      display_name = excluded.display_name,
      updated_at = statement_timestamp()
  returning id into actor_id;

  return actor_id;
end;
$$;

revoke all on function public.sync_workos_actor(text, text, text) from public, anon, authenticated;
grant execute on function public.sync_workos_actor(text, text, text) to service_role;

create or replace function app.is_operator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app.operator_grants og
    join app.actors a on a.id = og.actor_id
    where a.workos_user_id = (select auth.jwt()->>'sub')
      and a.status = 'active'
      and og.status = 'active'
      and og.mfa_required
      and lower(a.primary_email) = lower(og.allowlisted_email)
      and og.workos_organization_id = (select auth.jwt()->>'org_id')
      and (select auth.jwt()->'act') is null
      and (select auth.jwt()->>'impersonator_id') is null
  );
$$;

create function app.operator_recent_auth(max_age_seconds integer default 900)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.is_operator()
    and max_age_seconds between 1 and 900
    and coalesce((select auth.jwt()->>'auth_time'), '') ~ '^[0-9]+$'
    and extract(epoch from statement_timestamp())::bigint
      - ((select auth.jwt()->>'auth_time')::bigint) between 0 and max_age_seconds;
$$;

revoke all on function app.operator_recent_auth(integer) from public;
grant execute on function app.operator_recent_auth(integer) to authenticated, service_role;

commit;
