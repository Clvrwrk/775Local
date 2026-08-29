begin;

create extension if not exists pgcrypto with schema extensions;

create schema if not exists app;
create schema if not exists private;

revoke all on schema app from public;
revoke all on schema private from public, anon, authenticated;
grant usage on schema app to anon, authenticated, service_role;

create function app.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = statement_timestamp();
  return new;
end;
$$;

create function private.reject_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'append-only record cannot be changed';
end;
$$;

create table private.source_batches (
  id uuid primary key default extensions.gen_random_uuid(),
  source_name text not null,
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  workbook_row_count integer not null check (workbook_row_count >= 0),
  imported_by text not null,
  imported_at timestamptz not null default statement_timestamp(),
  notes text,
  unique (source_sha256)
);

create table private.source_listing_rows (
  id bigint generated always as identity primary key,
  batch_id uuid not null references private.source_batches(id),
  worksheet text not null,
  source_row integer not null check (source_row > 0),
  source_business_id text,
  row_sha256 text not null check (row_sha256 ~ '^[a-f0-9]{64}$'),
  raw_payload jsonb not null check (jsonb_typeof(raw_payload) = 'object'),
  received_at timestamptz not null default statement_timestamp(),
  unique (batch_id, worksheet, source_row),
  unique (batch_id, row_sha256)
);

create trigger source_batches_append_only
before update or delete on private.source_batches
for each row execute function private.reject_mutation();

create trigger source_rows_append_only
before update or delete on private.source_listing_rows
for each row execute function private.reject_mutation();

create table app.actors (
  id uuid primary key default extensions.gen_random_uuid(),
  workos_user_id text not null unique,
  primary_email text,
  display_name text,
  status text not null default 'active' check (status in ('active', 'suspended', 'deleted')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create table app.businesses (
  id uuid primary key default extensions.gen_random_uuid(),
  canonical_name text not null check (length(trim(canonical_name)) between 2 and 200),
  status text not null default 'active' check (status in ('active', 'inactive', 'merged')),
  merged_into_id uuid references app.businesses(id),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check ((status = 'merged') = (merged_into_id is not null))
);

create table app.business_listings (
  id uuid primary key default extensions.gen_random_uuid(),
  stable_id bigint generated always as identity unique,
  business_id uuid not null references app.businesses(id),
  current_slug text not null check (current_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  display_name text not null check (length(trim(display_name)) between 2 and 200),
  tagline text,
  description text,
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  website_url text check (website_url is null or website_url ~ '^https://'),
  street_address text,
  city_slug text not null check (city_slug in ('reno', 'sparks')),
  region_code text not null default 'NV' check (region_code = 'NV'),
  postal_code text not null check (postal_code ~ '^89[0-9]{3}$'),
  latitude numeric(9,6),
  longitude numeric(9,6),
  is_service_area boolean not null default false,
  hide_street boolean not null default false,
  google_place_id text,
  publication_status text not null default 'draft'
    check (publication_status in ('draft', 'pending_review', 'published', 'suspended', 'removed', 'merged')),
  information_checked_at timestamptz,
  information_checked_by uuid references app.actors(id),
  owner_verified_at timestamptz,
  source_row_id bigint references private.source_listing_rows(id),
  published_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (not is_service_area or hide_street),
  check ((publication_status = 'published') = (published_at is not null))
);

create unique index business_listings_current_slug_unique
  on app.business_listings (lower(current_slug));

create table app.listing_slugs (
  slug text primary key check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  listing_id uuid not null references app.business_listings(id),
  is_current boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  retired_at timestamptz,
  check (is_current = (retired_at is null))
);

create unique index listing_slugs_one_current_per_listing
  on app.listing_slugs (listing_id) where is_current;

create table app.categories (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null unique,
  description text,
  is_launch_category boolean not null default false,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create table app.listing_categories (
  listing_id uuid not null references app.business_listings(id) on delete cascade,
  category_id uuid not null references app.categories(id),
  is_primary boolean not null default false,
  created_at timestamptz not null default statement_timestamp(),
  primary key (listing_id, category_id)
);

create unique index listing_categories_one_primary
  on app.listing_categories (listing_id) where is_primary;

create table app.listing_private_contacts (
  listing_id uuid primary key references app.business_listings(id) on delete cascade,
  business_email text,
  lead_email text,
  lead_phone_e164 text check (lead_phone_e164 is null or lead_phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  updated_at timestamptz not null default statement_timestamp()
);

create table app.listing_participations (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_id uuid not null references app.actors(id),
  listing_id uuid not null references app.business_listings(id),
  role text not null check (role in ('business_owner', 'agency_representative', 'lead_recipient')),
  status text not null default 'pending' check (status in ('pending', 'active', 'expired', 'revoked')),
  authority_scope jsonb not null default '{}'::jsonb check (jsonb_typeof(authority_scope) = 'object'),
  starts_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references app.actors(id),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (expires_at is null or starts_at is null or expires_at > starts_at),
  check ((status = 'revoked') = (revoked_at is not null))
);

create unique index listing_participations_active_role
  on app.listing_participations (actor_id, listing_id, role)
  where status in ('pending', 'active');

create table app.operator_grants (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_id uuid not null references app.actors(id),
  allowlisted_email text not null check (lower(allowlisted_email) = 'chussey@aia4.io'),
  permissions text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'active', 'revoked')),
  mfa_required boolean not null default true check (mfa_required),
  approved_by text,
  approved_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  unique (actor_id),
  check ((status = 'active') = (approved_at is not null))
);

create table app.claims (
  id uuid primary key default extensions.gen_random_uuid(),
  listing_id uuid not null references app.business_listings(id),
  claimant_actor_id uuid not null references app.actors(id),
  method text not null check (method in ('business_domain', 'document', 'storefront', 'vehicle', 'manual')),
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'needs_evidence', 'approved', 'rejected', 'withdrawn')),
  decision_reason text,
  submitted_at timestamptz,
  decided_at timestamptz,
  decided_by uuid references app.actors(id),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check ((status in ('approved', 'rejected')) = (decided_at is not null))
);

create unique index claims_one_open_per_actor_listing
  on app.claims (listing_id, claimant_actor_id)
  where status in ('draft', 'submitted', 'needs_evidence');

create table private.claim_proofs (
  id uuid primary key default extensions.gen_random_uuid(),
  claim_id uuid not null references app.claims(id) on delete cascade,
  storage_path text not null,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  media_type text not null,
  uploaded_at timestamptz not null default statement_timestamp(),
  delete_after timestamptz,
  deleted_at timestamptz,
  unique (storage_path)
);

create table app.listing_content (
  listing_id uuid primary key references app.business_listings(id) on delete cascade,
  about text,
  logo_media_id uuid,
  hero_media_id uuid,
  content_status text not null default 'draft' check (content_status in ('draft', 'pending_review', 'approved', 'rejected')),
  updated_by uuid references app.actors(id),
  updated_at timestamptz not null default statement_timestamp()
);

create table app.media_assets (
  id uuid primary key default extensions.gen_random_uuid(),
  listing_id uuid not null references app.business_listings(id),
  kind text not null check (kind in ('logo', 'image', 'video')),
  original_path text not null unique,
  public_path text unique,
  media_type text not null,
  byte_size bigint not null check (byte_size > 0),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  status text not null default 'uploaded'
    check (status in ('uploaded', 'scanning', 'pending_review', 'approved', 'rejected', 'quarantined', 'deleted')),
  quarantine_until timestamptz,
  created_by uuid references app.actors(id),
  reviewed_by uuid references app.actors(id),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check ((status = 'approved') = (public_path is not null))
);

alter table app.listing_content
  add constraint listing_content_logo_fk foreign key (logo_media_id) references app.media_assets(id),
  add constraint listing_content_hero_fk foreign key (hero_media_id) references app.media_assets(id);

create table app.offers (
  id uuid primary key default extensions.gen_random_uuid(),
  listing_id uuid not null references app.business_listings(id),
  title text not null,
  details text not null,
  redemption_code text,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'active', 'expired', 'rejected')),
  created_by uuid references app.actors(id),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create unique index offers_one_active_per_listing
  on app.offers (listing_id) where status = 'active';

create table app.leads (
  id uuid primary key default extensions.gen_random_uuid(),
  listing_id uuid not null references app.business_listings(id),
  idempotency_key text not null unique,
  resident_name text not null,
  resident_phone_e164 text,
  resident_email text,
  resident_postal_code text not null check (resident_postal_code ~ '^89[0-9]{3}$'),
  request_text text not null,
  contact_consent_at timestamptz not null,
  source_path text not null,
  source_context text not null,
  status text not null default 'submitted'
    check (status in ('submitted', 'queued', 'delivered', 'viewed', 'accepted', 'contacted', 'won', 'lost', 'spam', 'deleted')),
  duplicate_of_id uuid references app.leads(id),
  submitted_at timestamptz not null default statement_timestamp(),
  deleted_at timestamptz,
  updated_at timestamptz not null default statement_timestamp(),
  check (resident_phone_e164 is not null or resident_email is not null)
);

create index leads_listing_submitted_at on app.leads (listing_id, submitted_at desc);

create table app.lead_events (
  id bigint generated always as identity primary key,
  lead_id uuid not null references app.leads(id),
  event_type text not null
    check (event_type in ('submitted', 'queued', 'delivered', 'viewed', 'accepted', 'contacted', 'won', 'lost', 'spam', 'delivery_failed', 'deleted')),
  actor_id uuid references app.actors(id),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'),
  occurred_at timestamptz not null default statement_timestamp()
);

create table app.featured_entitlements (
  id uuid primary key default extensions.gen_random_uuid(),
  listing_id uuid not null references app.business_listings(id),
  status text not null check (status in ('pending', 'active', 'past_due', 'canceled', 'expired')),
  starts_at timestamptz,
  ends_at timestamptz,
  source_billing_event_id text,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create unique index featured_one_current_per_listing
  on app.featured_entitlements (listing_id)
  where status in ('pending', 'active', 'past_due');

create table app.billing_events (
  id bigint generated always as identity primary key,
  provider text not null check (provider in ('gohighlevel', 'stripe')),
  provider_event_id text not null,
  listing_id uuid references app.business_listings(id),
  event_type text not null,
  amount_cents integer,
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  occurred_at timestamptz not null,
  received_at timestamptz not null default statement_timestamp(),
  unique (provider, provider_event_id)
);

create table app.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references app.actors(id),
  actor_kind text not null check (actor_kind in ('resident', 'business_owner', 'agency_representative', 'operator', 'system', 'provider')),
  action text not null,
  target_type text not null,
  target_id text not null,
  reason text,
  before_ref jsonb,
  after_ref jsonb,
  request_id text,
  correlation_id text,
  occurred_at timestamptz not null default statement_timestamp()
);

create trigger audit_events_append_only
before update or delete on app.audit_events
for each row execute function private.reject_mutation();

create table app.integration_outbox (
  id uuid primary key default extensions.gen_random_uuid(),
  destination text not null check (destination in ('gohighlevel', 'email', 'sms', 'sentry', 'linear')),
  event_type text not null,
  aggregate_type text not null,
  aggregate_id text not null,
  idempotency_key text not null unique,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  status text not null default 'pending' check (status in ('pending', 'processing', 'delivered', 'retry', 'dead_letter', 'canceled')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default statement_timestamp(),
  delivered_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create index integration_outbox_dispatch
  on app.integration_outbox (status, available_at)
  where status in ('pending', 'retry');

create table app.integration_inbox (
  id uuid primary key default extensions.gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  signature_verified boolean not null,
  received_payload jsonb not null check (jsonb_typeof(received_payload) = 'object'),
  status text not null default 'received' check (status in ('received', 'processed', 'rejected', 'failed')),
  received_at timestamptz not null default statement_timestamp(),
  processed_at timestamptz,
  unique (provider, provider_event_id)
);

create table app.product_events (
  id bigint generated always as identity primary key,
  event_name text not null,
  pseudonymous_actor_id text,
  listing_id uuid references app.business_listings(id),
  properties jsonb not null default '{}'::jsonb check (jsonb_typeof(properties) = 'object'),
  occurred_at timestamptz not null default statement_timestamp()
);

create index business_listings_public_lookup
  on app.business_listings (city_slug, publication_status, stable_id);
create index business_listings_place_id
  on app.business_listings (google_place_id) where google_place_id is not null;
create index listing_participations_listing_status
  on app.listing_participations (listing_id, status);
create index claims_listing_status on app.claims (listing_id, status);

create trigger actors_updated_at before update on app.actors
for each row execute function app.set_updated_at();
create trigger businesses_updated_at before update on app.businesses
for each row execute function app.set_updated_at();
create trigger listings_updated_at before update on app.business_listings
for each row execute function app.set_updated_at();
create trigger categories_updated_at before update on app.categories
for each row execute function app.set_updated_at();
create trigger participations_updated_at before update on app.listing_participations
for each row execute function app.set_updated_at();
create trigger claims_updated_at before update on app.claims
for each row execute function app.set_updated_at();
create trigger offers_updated_at before update on app.offers
for each row execute function app.set_updated_at();
create trigger leads_updated_at before update on app.leads
for each row execute function app.set_updated_at();
create trigger featured_updated_at before update on app.featured_entitlements
for each row execute function app.set_updated_at();
create trigger outbox_updated_at before update on app.integration_outbox
for each row execute function app.set_updated_at();

create function app.current_workos_user_id()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(auth.jwt() ->> 'sub', '')
$$;

create function app.current_actor_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select id from app.actors where workos_user_id = app.current_workos_user_id() and status = 'active'
$$;

create function app.is_operator()
returns boolean
language sql
stable
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

create function app.can_manage_listing(requested_listing_id uuid)
returns boolean
language sql
stable
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

revoke all on function app.current_workos_user_id() from public;
revoke all on function app.current_actor_id() from public;
revoke all on function app.is_operator() from public;
revoke all on function app.can_manage_listing(uuid) from public;
grant execute on function app.current_workos_user_id() to authenticated, service_role;
grant execute on function app.current_actor_id() to authenticated, service_role;
grant execute on function app.is_operator() to authenticated, service_role;
grant execute on function app.can_manage_listing(uuid) to authenticated, service_role;

alter table app.actors enable row level security;
alter table app.businesses enable row level security;
alter table app.business_listings enable row level security;
alter table app.listing_slugs enable row level security;
alter table app.categories enable row level security;
alter table app.listing_categories enable row level security;
alter table app.listing_private_contacts enable row level security;
alter table app.listing_participations enable row level security;
alter table app.operator_grants enable row level security;
alter table app.claims enable row level security;
alter table app.listing_content enable row level security;
alter table app.media_assets enable row level security;
alter table app.offers enable row level security;
alter table app.leads enable row level security;
alter table app.lead_events enable row level security;
alter table app.featured_entitlements enable row level security;
alter table app.billing_events enable row level security;
alter table app.audit_events enable row level security;
alter table app.integration_outbox enable row level security;
alter table app.integration_inbox enable row level security;
alter table app.product_events enable row level security;

create policy actors_read_self on app.actors for select to authenticated
using (id = app.current_actor_id() or app.is_operator());

create policy listings_read_published on app.business_listings for select to anon, authenticated
using (publication_status = 'published' or app.can_manage_listing(id));

create policy listings_manage_authorized on app.business_listings for update to authenticated
using (app.can_manage_listing(id)) with check (app.can_manage_listing(id));

create policy businesses_read_for_public_listing on app.businesses for select to anon, authenticated
using (exists (
  select 1 from app.business_listings bl
  where bl.business_id = businesses.id
    and (bl.publication_status = 'published' or app.can_manage_listing(bl.id))
));

create policy listing_slugs_read_public on app.listing_slugs for select to anon, authenticated
using (exists (
  select 1 from app.business_listings bl
  where bl.id = listing_slugs.listing_id
    and (bl.publication_status = 'published' or app.can_manage_listing(bl.id))
));

create policy categories_read_all on app.categories for select to anon, authenticated using (true);

create policy listing_categories_read_public on app.listing_categories for select to anon, authenticated
using (exists (
  select 1 from app.business_listings bl
  where bl.id = listing_categories.listing_id
    and (bl.publication_status = 'published' or app.can_manage_listing(bl.id))
));

create policy private_contacts_manage_authorized on app.listing_private_contacts
for all to authenticated using (app.can_manage_listing(listing_id)) with check (app.can_manage_listing(listing_id));

create policy participations_read_authorized on app.listing_participations for select to authenticated
using (actor_id = app.current_actor_id() or app.can_manage_listing(listing_id));

create policy operator_grants_read_self on app.operator_grants for select to authenticated
using (actor_id = app.current_actor_id() or app.is_operator());

create policy claims_read_authorized on app.claims for select to authenticated
using (claimant_actor_id = app.current_actor_id() or app.is_operator());

create policy claims_create_self on app.claims for insert to authenticated
with check (claimant_actor_id = app.current_actor_id());

create policy claims_update_self_draft on app.claims for update to authenticated
using (claimant_actor_id = app.current_actor_id() and status in ('draft', 'needs_evidence'))
with check (claimant_actor_id = app.current_actor_id() and status in ('draft', 'submitted', 'withdrawn'));

create policy listing_content_read_public on app.listing_content for select to anon, authenticated
using (exists (
  select 1 from app.business_listings bl
  where bl.id = listing_content.listing_id
    and (bl.publication_status = 'published' or app.can_manage_listing(bl.id))
));

create policy listing_content_manage_authorized on app.listing_content for all to authenticated
using (app.can_manage_listing(listing_id)) with check (app.can_manage_listing(listing_id));

create policy media_manage_authorized on app.media_assets for all to authenticated
using (app.can_manage_listing(listing_id)) with check (app.can_manage_listing(listing_id));

create policy offers_read_active on app.offers for select to anon, authenticated
using (status = 'active' and exists (
  select 1 from app.business_listings bl where bl.id = offers.listing_id and bl.publication_status = 'published'
));

create policy offers_manage_authorized on app.offers for all to authenticated
using (app.can_manage_listing(listing_id)) with check (app.can_manage_listing(listing_id));

create policy leads_read_authorized on app.leads for select to authenticated
using (app.can_manage_listing(listing_id));

create policy lead_events_read_authorized on app.lead_events for select to authenticated
using (exists (
  select 1 from app.leads l where l.id = lead_events.lead_id and app.can_manage_listing(l.listing_id)
));

create policy featured_read_public on app.featured_entitlements for select to anon, authenticated
using (status = 'active' and (ends_at is null or ends_at > statement_timestamp()));

create policy billing_read_operator on app.billing_events for select to authenticated using (app.is_operator());
create policy audit_read_operator on app.audit_events for select to authenticated using (app.is_operator());
create policy outbox_read_operator on app.integration_outbox for select to authenticated using (app.is_operator());
create policy inbox_read_operator on app.integration_inbox for select to authenticated using (app.is_operator());
create policy product_events_read_operator on app.product_events for select to authenticated using (app.is_operator());

grant select on app.businesses, app.business_listings, app.listing_slugs, app.categories,
  app.listing_categories, app.listing_content, app.offers, app.featured_entitlements
  to anon, authenticated;
grant select, update on app.actors to authenticated;
grant select, insert, update on app.claims to authenticated;
grant select, insert, update, delete on app.listing_private_contacts, app.listing_content,
  app.media_assets, app.offers to authenticated;
grant select on app.listing_participations, app.operator_grants, app.leads, app.lead_events,
  app.billing_events, app.audit_events, app.integration_outbox, app.integration_inbox, app.product_events
  to authenticated;
grant usage, select on all sequences in schema app to authenticated, service_role;

create or replace view public.directory_listings
with (security_invoker = true)
as
select
  bl.id,
  bl.stable_id,
  bl.current_slug,
  bl.display_name,
  bl.tagline,
  bl.description,
  bl.phone_e164,
  bl.website_url,
  case when bl.hide_street then null else bl.street_address end as street_address,
  bl.city_slug,
  bl.region_code,
  bl.postal_code,
  bl.latitude,
  bl.longitude,
  bl.is_service_area,
  bl.google_place_id,
  bl.information_checked_at,
  bl.owner_verified_at,
  bl.published_at,
  coalesce(array_agg(distinct c.slug) filter (where c.slug is not null), '{}') as category_slugs,
  exists (
    select 1 from app.featured_entitlements fe
    where fe.listing_id = bl.id
      and fe.status = 'active'
      and (fe.ends_at is null or fe.ends_at > statement_timestamp())
  ) as is_featured,
  o.title as offer_title,
  o.details as offer_details,
  o.redemption_code as offer_code,
  o.ends_at as offer_ends_at
from app.business_listings bl
left join app.listing_categories lc on lc.listing_id = bl.id
left join app.categories c on c.id = lc.category_id
left join app.offers o on o.listing_id = bl.id and o.status = 'active'
where bl.publication_status = 'published'
group by bl.id, o.id;

revoke all on public.directory_listings from public;
grant select on public.directory_listings to anon, authenticated;

comment on view public.directory_listings is
  'The only anonymous directory projection. It excludes private emails, Claim Proof, Lead data, residential evidence, billing detail, and provider payloads.';

commit;
