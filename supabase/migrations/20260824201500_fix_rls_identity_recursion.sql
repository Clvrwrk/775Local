begin;

-- These helpers are invoked from RLS policies on the same tables they inspect.
-- SECURITY DEFINER is required to prevent policy recursion. Execution remains
-- restricted to authenticated/service roles and each function has an empty
-- search_path with fully qualified object names.
create or replace function app.current_actor_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id
  from app.actors
  where workos_user_id = app.current_workos_user_id()
    and status = 'active'
$$;

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
    where og.actor_id = app.current_actor_id()
      and og.status = 'active'
      and og.mfa_required
      and lower(a.primary_email) = lower(og.allowlisted_email)
  )
$$;

create or replace function app.can_manage_listing(requested_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.is_operator() or exists (
    select 1
    from app.listing_participations lp
    where lp.actor_id = app.current_actor_id()
      and lp.listing_id = requested_listing_id
      and lp.role in ('business_owner', 'agency_representative')
      and lp.status = 'active'
      and (lp.starts_at is null or lp.starts_at <= statement_timestamp())
      and (lp.expires_at is null or lp.expires_at > statement_timestamp())
  )
$$;

revoke all on function app.current_actor_id() from public;
revoke all on function app.is_operator() from public;
revoke all on function app.can_manage_listing(uuid) from public;
grant execute on function app.current_actor_id() to authenticated, service_role;
grant execute on function app.is_operator() to authenticated, service_role;
grant execute on function app.can_manage_listing(uuid) to authenticated, service_role;

commit;
