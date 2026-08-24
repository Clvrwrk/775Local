begin;

create table app.category_crosswalks (
  id uuid primary key default extensions.gen_random_uuid(),
  version text not null,
  source_category text not null,
  source_group text,
  launch_category_slug text not null references app.categories(slug),
  rule_basis text not null,
  status text not null default 'active' check (status in ('draft', 'active', 'retired')),
  reviewed_by uuid references app.actors(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  unique (version, source_category),
  check (status <> 'active' or reviewed_at is not null)
);

create table app.listing_candidates (
  id uuid primary key default extensions.gen_random_uuid(),
  batch_id uuid not null references private.source_batches(id),
  source_row_id bigint not null references private.source_listing_rows(id),
  source_business_id text,
  normalized_name text not null,
  proposed_slug text not null check (proposed_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  business_email text,
  website_url text check (website_url is null or website_url ~ '^https://'),
  street_address text,
  city_slug text not null check (city_slug in ('reno', 'sparks')),
  postal_code text not null check (postal_code ~ '^89[0-9]{3}$'),
  latitude numeric(9,6),
  longitude numeric(9,6),
  google_place_id text,
  source_category text,
  launch_category_slug text references app.categories(slug),
  active_profile_status text not null default 'unverified'
    check (active_profile_status in ('unverified', 'active', 'temporarily_closed', 'closed_forever')),
  screening_status text not null default 'pending'
    check (screening_status in ('pending', 'eligible', 'ineligible', 'needs_review')),
  screening_reasons text[] not null default '{}',
  quality_score numeric(8,3),
  diversity_key text,
  selected_for_launch boolean not null default false,
  review_status text not null default 'pending'
    check (review_status in ('pending', 'in_review', 'accepted', 'rejected')),
  review_reason_codes text[] not null default '{}',
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'),
  reviewed_by uuid references app.actors(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (batch_id, source_row_id),
  unique (batch_id, proposed_slug),
  check (not selected_for_launch or review_status = 'accepted'),
  check ((review_status in ('accepted', 'rejected')) = (reviewed_at is not null))
);

create table app.listing_revisions (
  id bigint generated always as identity primary key,
  listing_id uuid not null references app.business_listings(id),
  candidate_id uuid references app.listing_candidates(id),
  revision_type text not null
    check (revision_type in ('created', 'proposed_change', 'approved_change', 'rejected_change', 'suspended', 'restored', 'removed')),
  before_values jsonb not null default '{}'::jsonb check (jsonb_typeof(before_values) = 'object'),
  after_values jsonb not null default '{}'::jsonb check (jsonb_typeof(after_values) = 'object'),
  reason_codes text[] not null default '{}',
  actor_id uuid references app.actors(id),
  occurred_at timestamptz not null default statement_timestamp()
);

create table app.publication_receipts (
  id uuid primary key default extensions.gen_random_uuid(),
  listing_id uuid not null references app.business_listings(id),
  candidate_id uuid not null references app.listing_candidates(id),
  source_batch_id uuid not null references private.source_batches(id),
  source_urls jsonb not null check (jsonb_typeof(source_urls) = 'array'),
  source_checked_at timestamptz not null,
  checks jsonb not null check (jsonb_typeof(checks) = 'object'),
  duplicate_decision text not null,
  entity_decision text not null,
  reviewer_id uuid not null references app.actors(id),
  outcome text not null check (outcome in ('published', 'rejected')),
  reason_codes text[] not null default '{}',
  before_values jsonb not null default '{}'::jsonb check (jsonb_typeof(before_values) = 'object'),
  after_values jsonb not null default '{}'::jsonb check (jsonb_typeof(after_values) = 'object'),
  rollback_reference text not null,
  created_at timestamptz not null default statement_timestamp()
);

create trigger listing_candidates_updated_at before update on app.listing_candidates
for each row execute function app.set_updated_at();

create trigger listing_revisions_append_only
before update or delete on app.listing_revisions
for each row execute function private.reject_mutation();

create trigger publication_receipts_append_only
before update or delete on app.publication_receipts
for each row execute function private.reject_mutation();

create index category_crosswalks_launch_category_idx
  on app.category_crosswalks (launch_category_slug, status);
create index listing_candidates_review_queue_idx
  on app.listing_candidates (review_status, city_slug, launch_category_slug, quality_score desc);
create index listing_candidates_source_row_idx on app.listing_candidates (source_row_id);
create index listing_candidates_reviewed_by_idx on app.listing_candidates (reviewed_by);
create index listing_revisions_listing_idx on app.listing_revisions (listing_id, occurred_at desc);
create index listing_revisions_candidate_idx on app.listing_revisions (candidate_id);
create index listing_revisions_actor_idx on app.listing_revisions (actor_id);
create index publication_receipts_listing_idx on app.publication_receipts (listing_id, created_at desc);
create index publication_receipts_candidate_idx on app.publication_receipts (candidate_id);
create index publication_receipts_batch_idx on app.publication_receipts (source_batch_id);
create index publication_receipts_reviewer_idx on app.publication_receipts (reviewer_id);

alter table app.category_crosswalks enable row level security;
alter table app.listing_candidates enable row level security;
alter table app.listing_revisions enable row level security;
alter table app.publication_receipts enable row level security;

create policy category_crosswalks_operator_all on app.category_crosswalks
for all to authenticated using (app.is_operator()) with check (app.is_operator());
create policy listing_candidates_operator_all on app.listing_candidates
for all to authenticated using (app.is_operator()) with check (app.is_operator());
create policy listing_revisions_operator_read on app.listing_revisions
for select to authenticated using (app.is_operator());
create policy publication_receipts_operator_read on app.publication_receipts
for select to authenticated using (app.is_operator());

grant select, insert, update, delete on app.category_crosswalks, app.listing_candidates
  to authenticated;
grant select on app.listing_revisions, app.publication_receipts to authenticated;
grant all on app.category_crosswalks, app.listing_candidates, app.listing_revisions,
  app.publication_receipts to service_role;
grant usage, select on all sequences in schema app to service_role;

-- Service-role automation may ingest immutable source rows, but the private
-- schema remains outside the anonymous/authenticated API surface.
grant usage on schema private to service_role;
grant select, insert on private.source_batches, private.source_listing_rows to service_role;
grant select, insert, update, delete on private.claim_proofs to service_role;

commit;
