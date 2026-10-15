begin;

-- CAT-145 source only. 775-20 does not apply this file to a hosted database.
--
-- The three publication commands are SECURITY DEFINER with search_path = '' and
-- an operator predicate. Anon and service_role already lack EXECUTE. This
-- migration also revokes authenticated, which is the role the signed-in
-- operator HTTP caller uses. Do not apply it until that caller moves off
-- authenticated.
--
-- app.media_assets had overlapping permissive SELECT policies for authenticated:
-- media_manage_authorized (FOR ALL), media_read_approved_public, and the
-- duplicate media_read_public_approved from the brand migration.
-- This split matches app.offers in 20260824195800. One SELECT policy per role.
-- Truth table, unchanged:
--   anon SELECT: approved media on a published listing
--   authenticated SELECT: that public read, or app.can_manage_listing
--   authenticated write: app.can_manage_listing
-- Anon still does not call app.can_manage_listing.

drop policy if exists media_manage_authorized on app.media_assets;
drop policy if exists media_read_approved_public on app.media_assets;
drop policy if exists media_read_public_approved on app.media_assets;

create policy media_read_approved_public on app.media_assets
for select to anon
using (
  status = 'approved'
  and exists (
    select 1
    from app.business_listings bl
    where bl.id = media_assets.listing_id
      and bl.publication_status = 'published'
  )
);

create policy media_read_authenticated on app.media_assets
for select to authenticated
using (
  (
    status = 'approved'
    and exists (
      select 1
      from app.business_listings bl
      where bl.id = media_assets.listing_id
        and bl.publication_status = 'published'
    )
  )
  or app.can_manage_listing(listing_id)
);

create policy media_insert_authorized on app.media_assets
for insert to authenticated
with check (app.can_manage_listing(listing_id));

create policy media_update_authorized on app.media_assets
for update to authenticated
using (app.can_manage_listing(listing_id))
with check (app.can_manage_listing(listing_id));

create policy media_delete_authorized on app.media_assets
for delete to authenticated
using (app.can_manage_listing(listing_id));

revoke all on function public.review_listing_candidate(uuid, jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function public.publish_launch_selection(uuid[], text)
  from public, anon, authenticated, service_role;
revoke all on function public.transition_listing_publication_state(uuid, text, text[], text)
  from public, anon, authenticated, service_role;

comment on function public.review_listing_candidate(uuid, jsonb, text) is
  'CAT-145 source hold. EXECUTE revoked from anon and authenticated. Operator predicate remains. Not a hosted apply.';
comment on function public.publish_launch_selection(uuid[], text) is
  'CAT-145 source hold. EXECUTE revoked from anon and authenticated. Operator predicate remains. Not a hosted apply.';
comment on function public.transition_listing_publication_state(uuid, text, text[], text) is
  'CAT-145 source hold. EXECUTE revoked from anon and authenticated. Operator predicate remains. Not a hosted apply.';

commit;
