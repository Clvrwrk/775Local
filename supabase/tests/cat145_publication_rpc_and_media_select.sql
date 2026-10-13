begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(15);

select extensions.ok(
  not has_function_privilege('anon', 'public.review_listing_candidate(uuid,jsonb,text)', 'execute'),
  'anon cannot execute review_listing_candidate'
);
select extensions.ok(
  not has_function_privilege('authenticated', 'public.review_listing_candidate(uuid,jsonb,text)', 'execute'),
  'authenticated cannot execute review_listing_candidate'
);
select extensions.ok(
  not has_function_privilege('anon', 'public.publish_launch_selection(uuid[],text)', 'execute'),
  'anon cannot execute publish_launch_selection'
);
select extensions.ok(
  not has_function_privilege('authenticated', 'public.publish_launch_selection(uuid[],text)', 'execute'),
  'authenticated cannot execute publish_launch_selection'
);
select extensions.ok(
  not has_function_privilege('anon', 'public.transition_listing_publication_state(uuid,text,text[],text)', 'execute'),
  'anon cannot execute transition_listing_publication_state'
);
select extensions.ok(
  not has_function_privilege('authenticated', 'public.transition_listing_publication_state(uuid,text,text[],text)', 'execute'),
  'authenticated cannot execute transition_listing_publication_state'
);
select extensions.ok(
  not has_function_privilege('service_role', 'public.review_listing_candidate(uuid,jsonb,text)', 'execute'),
  'service role still cannot execute review_listing_candidate'
);

select extensions.ok(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'app'
      and tablename = 'media_assets'
      and policyname = 'media_manage_authorized'
  ),
  'media_manage_authorized no longer overlaps SELECT'
);
select extensions.ok(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'app'
      and tablename = 'media_assets'
      and policyname = 'media_read_public_approved'
  ),
  'duplicate media_read_public_approved policy is gone'
);
select extensions.is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'app'
      and tablename = 'media_assets'
      and cmd = 'SELECT'
      and 'authenticated' = any (roles)
  ),
  1,
  'authenticated has one media SELECT policy'
);
select extensions.is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'app'
      and tablename = 'media_assets'
      and cmd = 'SELECT'
      and 'anon' = any (roles)
  ),
  1,
  'anon has one media SELECT policy'
);
select extensions.ok(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'app'
      and tablename = 'media_assets'
      and policyname = 'media_read_approved_public'
      and 'authenticated' = any (roles)
  ),
  'public media read is anon only'
);
select extensions.ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'app'
      and tablename = 'media_assets'
      and policyname = 'media_read_authenticated'
      and cmd = 'SELECT'
      and 'authenticated' = any (roles)
      and qual like '%can_manage_listing%'
      and qual like '%approved%'
  ),
  'authenticated media read keeps the public row and the manager row'
);
select extensions.is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'app'
      and tablename = 'media_assets'
      and policyname in (
        'media_insert_authorized',
        'media_update_authorized',
        'media_delete_authorized'
      )
      and 'authenticated' = any (roles)
  ),
  3,
  'authenticated media writes stay on can_manage_listing policies'
);
select extensions.ok(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'app'
      and tablename = 'media_assets'
      and cmd = 'SELECT'
      and 'anon' = any (roles)
      and 'authenticated' = any (roles)
  ),
  'no media SELECT policy targets both anon and authenticated'
);

select * from extensions.finish();
rollback;
