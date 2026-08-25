begin;

create table app.candidate_review_receipts (
  id uuid primary key default extensions.gen_random_uuid(),
  candidate_id uuid not null unique references app.listing_candidates(id),
  idempotency_key text not null unique check (length(idempotency_key) between 8 and 200),
  request_fingerprint text not null check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  reviewer_id uuid not null references app.actors(id),
  outcome text not null check (outcome in ('accepted', 'rejected')),
  resolved_screening_reasons text[] not null default '{}',
  source_urls jsonb not null check (
    jsonb_typeof(source_urls) = 'array'
    and jsonb_array_length(source_urls) between 1 and 10
  ),
  source_checked_at timestamptz not null,
  checks jsonb not null check (jsonb_typeof(checks) = 'object'),
  duplicate_decision text not null check (
    duplicate_decision in ('no_duplicate', 'distinct_location', 'duplicate_rejected')
  ),
  entity_decisions jsonb not null check (jsonb_typeof(entity_decisions) = 'object'),
  reason_codes text[] not null check (cardinality(reason_codes) between 1 and 20),
  before_values jsonb not null check (jsonb_typeof(before_values) = 'object'),
  after_values jsonb not null check (jsonb_typeof(after_values) = 'object'),
  reviewed_candidate jsonb not null check (jsonb_typeof(reviewed_candidate) = 'object'),
  reviewed_candidate_fingerprint text not null check (
    reviewed_candidate_fingerprint ~ '^[a-f0-9]{64}$'
  ),
  created_at timestamptz not null default statement_timestamp()
);

create trigger candidate_review_receipts_append_only
before update or delete on app.candidate_review_receipts
for each row execute function private.reject_mutation();

create table app.launch_publication_batches (
  id uuid primary key default extensions.gen_random_uuid(),
  idempotency_key text not null unique check (length(idempotency_key) between 8 and 200),
  request_fingerprint text not null check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  publisher_id uuid not null references app.actors(id),
  candidate_count integer not null check (candidate_count = 100),
  status text not null default 'published' unique check (status = 'published'),
  published_at timestamptz not null default statement_timestamp()
);

create trigger launch_publication_batches_append_only
before update or delete on app.launch_publication_batches
for each row execute function private.reject_mutation();

create table app.listing_status_transition_receipts (
  id uuid primary key default extensions.gen_random_uuid(),
  listing_id uuid not null references app.business_listings(id),
  idempotency_key text not null unique check (length(idempotency_key) between 8 and 200),
  request_fingerprint text not null check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  actor_id uuid not null references app.actors(id),
  transition text not null check (transition in ('suspend', 'restore')),
  reason_codes text[] not null check (cardinality(reason_codes) between 1 and 20),
  before_values jsonb not null check (jsonb_typeof(before_values) = 'object'),
  after_values jsonb not null check (jsonb_typeof(after_values) = 'object'),
  created_at timestamptz not null default statement_timestamp()
);

create trigger listing_status_transition_receipts_append_only
before update or delete on app.listing_status_transition_receipts
for each row execute function private.reject_mutation();

alter table app.publication_receipts
  add column publication_batch_id uuid not null references app.launch_publication_batches(id),
  add column entity_decisions jsonb not null default '{}'::jsonb,
  add column reviewed_candidate_fingerprint text,
  add column published_by uuid references app.actors(id),
  add constraint publication_receipts_one_per_candidate unique (candidate_id),
  add constraint publication_receipts_one_per_listing unique (listing_id);

alter table app.publication_receipts alter column entity_decisions drop default;

alter table app.candidate_review_receipts enable row level security;
alter table app.launch_publication_batches enable row level security;
alter table app.listing_status_transition_receipts enable row level security;

create policy candidate_review_receipts_operator_read on app.candidate_review_receipts
for select to authenticated using (app.is_operator());

create policy launch_publication_batches_operator_read on app.launch_publication_batches
for select to authenticated using (app.is_operator());

create policy listing_status_transition_receipts_operator_read
on app.listing_status_transition_receipts
for select to authenticated using (app.is_operator());

grant select on app.candidate_review_receipts, app.launch_publication_batches,
  app.listing_status_transition_receipts to authenticated;

revoke all privileges on app.candidate_review_receipts, app.launch_publication_batches,
  app.listing_status_transition_receipts, app.listing_revisions, app.publication_receipts
  from service_role;
grant select on app.candidate_review_receipts, app.launch_publication_batches,
  app.listing_status_transition_receipts, app.listing_revisions, app.publication_receipts
  to service_role;

create function private.candidate_publication_snapshot(candidate app.listing_candidates)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'batch_id', candidate.batch_id,
    'source_row_id', candidate.source_row_id,
    'normalized_name', candidate.normalized_name,
    'proposed_slug', candidate.proposed_slug,
    'phone_e164', candidate.phone_e164,
    'business_email', candidate.business_email,
    'website_url', candidate.website_url,
    'street_address', candidate.street_address,
    'city_slug', candidate.city_slug,
    'postal_code', candidate.postal_code,
    'latitude', candidate.latitude,
    'longitude', candidate.longitude,
    'google_place_id', candidate.google_place_id,
    'launch_category_slug', candidate.launch_category_slug,
    'active_profile_status', candidate.active_profile_status,
    'screening_status', candidate.screening_status,
    'screening_reasons', candidate.screening_reasons
  );
$$;

revoke all on function private.candidate_publication_snapshot(app.listing_candidates)
  from public, anon, authenticated, service_role;

create function public.review_listing_candidate(
  requested_candidate_id uuid,
  requested_decision jsonb,
  requested_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_actor uuid;
  target app.listing_candidates%rowtype;
  existing_receipt app.candidate_review_receipts%rowtype;
  receipt_id uuid;
  outcome text;
  resolved_reasons text[];
  source_urls text[];
  source_checked timestamptz;
  checks_value jsonb;
  duplicate_decision_value text;
  entity_decisions_value jsonb;
  reason_codes_value text[];
  normalized_decision jsonb;
  request_fingerprint_value text;
  before_values_value jsonb;
  after_values_value jsonb;
  reviewed_candidate_value jsonb;
  reviewed_candidate_fingerprint_value text;
begin
  if not app.operator_recent_auth(900) then
    raise exception 'recent Operator authentication is required';
  end if;

  current_actor := app.current_actor_id();
  if current_actor is null then
    raise exception 'Operator actor projection is required';
  end if;
  if not exists (
    select 1
    from app.operator_grants grant_record
    where grant_record.actor_id = current_actor
      and grant_record.status = 'active'
      and grant_record.permissions @> array['listing_review']
  ) then
    raise exception 'Operator listing_review permission is required';
  end if;

  if requested_candidate_id is null then
    raise exception 'candidate id is required';
  end if;
  if requested_idempotency_key is null
     or length(btrim(requested_idempotency_key)) not between 8 and 200 then
    raise exception 'idempotency key must contain 8 to 200 characters';
  end if;
  if requested_decision is null or jsonb_typeof(requested_decision) <> 'object' then
    raise exception 'candidate review decision must be a JSON object';
  end if;
  if not requested_decision ?& array[
    'outcome',
    'resolved_screening_reasons',
    'source_urls',
    'source_checked_at',
    'checks',
    'duplicate_decision',
    'entity_decisions',
    'reason_codes'
  ] then
    raise exception 'candidate review decision is missing required fields';
  end if;
  if exists (
    select 1
    from jsonb_object_keys(requested_decision) field_name
    where field_name not in (
      'outcome',
      'resolved_screening_reasons',
      'source_urls',
      'source_checked_at',
      'checks',
      'duplicate_decision',
      'entity_decisions',
      'reason_codes'
    )
  ) then
    raise exception 'candidate review decision contains unsupported fields';
  end if;
  if jsonb_typeof(requested_decision -> 'resolved_screening_reasons') <> 'array'
     or jsonb_typeof(requested_decision -> 'source_urls') <> 'array'
     or jsonb_typeof(requested_decision -> 'checks') <> 'object'
     or jsonb_typeof(requested_decision -> 'entity_decisions') <> 'object'
     or jsonb_typeof(requested_decision -> 'reason_codes') <> 'array' then
    raise exception 'candidate review decision fields have invalid types';
  end if;

  outcome := requested_decision ->> 'outcome';
  if outcome not in ('accepted', 'rejected') then
    raise exception 'candidate review outcome is invalid';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(requested_decision -> 'resolved_screening_reasons') value
    where jsonb_typeof(value) <> 'string'
  ) or exists (
    select 1
    from jsonb_array_elements(requested_decision -> 'source_urls') value
    where jsonb_typeof(value) <> 'string'
  ) or exists (
    select 1
    from jsonb_array_elements(requested_decision -> 'reason_codes') value
    where jsonb_typeof(value) <> 'string'
  ) then
    raise exception 'candidate review arrays must contain strings only';
  end if;

  resolved_reasons := array(
    select value
    from jsonb_array_elements_text(requested_decision -> 'resolved_screening_reasons') value
    order by value
  );
  source_urls := array(
    select value
    from jsonb_array_elements_text(requested_decision -> 'source_urls') value
    order by value
  );
  reason_codes_value := array(
    select value
    from jsonb_array_elements_text(requested_decision -> 'reason_codes') value
    order by value
  );

  if cardinality(resolved_reasons) <> (
    select count(distinct value)
    from unnest(resolved_reasons) value
  ) then
    raise exception 'resolved screening reasons must be unique';
  end if;
  if cardinality(source_urls) not between 1 and 10
     or cardinality(source_urls) <> (
       select count(distinct value) from unnest(source_urls) value
     )
     or exists (select 1 from unnest(source_urls) value where value !~ '^https://[^[:space:]]+$') then
    raise exception 'source URLs must contain 1 to 10 unique HTTPS URLs';
  end if;
  if cardinality(reason_codes_value) not between 1 and 20
     or cardinality(reason_codes_value) <> (
       select count(distinct value) from unnest(reason_codes_value) value
     )
     or exists (
       select 1 from unnest(reason_codes_value) value
       where value !~ '^[a-z0-9_]{1,80}$'
     ) then
    raise exception 'reason codes must contain 1 to 20 unique stable codes';
  end if;

  begin
    source_checked := (requested_decision ->> 'source_checked_at')::timestamptz;
  exception when others then
    raise exception 'source checked timestamp is invalid';
  end;
  if source_checked > statement_timestamp()
     or source_checked < statement_timestamp() - interval '30 days' then
    raise exception 'source checks must be current within 30 days';
  end if;

  checks_value := requested_decision -> 'checks';
  duplicate_decision_value := requested_decision ->> 'duplicate_decision';
  entity_decisions_value := requested_decision -> 'entity_decisions';
  if duplicate_decision_value not in ('no_duplicate', 'distinct_location', 'duplicate_rejected') then
    raise exception 'duplicate decision is invalid';
  end if;
  if not entity_decisions_value ?& array[
       'branch',
       'chain',
       'practitioner',
       'franchise',
       'service_area'
     ]
     or exists (
       select 1
       from jsonb_each(entity_decisions_value) field
       where field.key not in ('branch', 'chain', 'practitioner', 'franchise', 'service_area')
          or jsonb_typeof(field.value) <> 'string'
     )
     or entity_decisions_value ->> 'branch' not in ('not_branch', 'local_branch', 'national_branch')
     or entity_decisions_value ->> 'chain' not in ('not_chain', 'local_chain', 'national_chain')
     or entity_decisions_value ->> 'practitioner' not in (
       'not_practitioner',
       'group_practice',
       'individual_practitioner'
     )
     or entity_decisions_value ->> 'franchise' not in (
       'not_franchise',
       'locally_operated_franchise',
       'corporate_franchise'
     )
     or entity_decisions_value ->> 'service_area' not in (
       'fixed_location',
       'service_area_business'
     ) then
    raise exception 'entity decisions are invalid';
  end if;

  normalized_decision := jsonb_build_object(
    'outcome', outcome,
    'resolved_screening_reasons', to_jsonb(resolved_reasons),
    'source_urls', to_jsonb(source_urls),
    'source_checked_at', source_checked,
    'checks', checks_value,
    'duplicate_decision', duplicate_decision_value,
    'entity_decisions', entity_decisions_value,
    'reason_codes', to_jsonb(reason_codes_value)
  );
  request_fingerprint_value := encode(
    extensions.digest(
      jsonb_build_object(
        'candidate_id', requested_candidate_id,
        'decision', normalized_decision
      )::text,
      'sha256'
    ),
    'hex'
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('candidate-review:' || btrim(requested_idempotency_key), 0)
  );

  select * into existing_receipt
  from app.candidate_review_receipts
  where idempotency_key = btrim(requested_idempotency_key);
  if found then
    if existing_receipt.request_fingerprint <> request_fingerprint_value then
      raise exception 'idempotency key was already used for a different candidate review';
    end if;
    return existing_receipt.id;
  end if;

  select * into target
  from app.listing_candidates
  where id = requested_candidate_id
  for update;
  if not found then
    raise exception 'candidate does not exist';
  end if;
  if target.selected_for_launch
     or target.review_status in ('accepted', 'rejected')
     or exists (
       select 1 from app.candidate_review_receipts receipt
       where receipt.candidate_id = target.id
     ) then
    raise exception 'candidate already has a terminal review';
  end if;

  if outcome = 'accepted' then
    if target.screening_status not in ('eligible', 'needs_review')
       or target.active_profile_status <> 'active'
       or target.launch_category_slug is null
       or target.phone_e164 is null
       or target.phone_e164 !~ '^\+1775[0-9]{7}$'
       or target.website_url is null
       or target.business_email is null
       or target.google_place_id is null
       or (
         target.street_address is null
         and entity_decisions_value ->> 'service_area' <> 'service_area_business'
       ) then
      raise exception 'candidate does not meet the accepted publication evidence floor';
    end if;
    if not checks_value ?& array[
         'nap_verified',
         'category_verified',
         'active_status_verified',
         'source_urls_current'
       ]
       or exists (
         select 1
         from jsonb_each(checks_value) check_field
         where check_field.key not in (
           'nap_verified',
           'category_verified',
           'active_status_verified',
           'source_urls_current'
         ) or jsonb_typeof(check_field.value) <> 'boolean'
       )
       or coalesce((checks_value ->> 'nap_verified')::boolean, false) is not true
       or coalesce((checks_value ->> 'category_verified')::boolean, false) is not true
       or coalesce((checks_value ->> 'active_status_verified')::boolean, false) is not true
       or coalesce((checks_value ->> 'source_urls_current')::boolean, false) is not true then
      raise exception 'accepted review requires all publication checks';
    end if;
    if duplicate_decision_value not in ('no_duplicate', 'distinct_location')
       or entity_decisions_value ->> 'branch' = 'national_branch'
       or entity_decisions_value ->> 'chain' = 'national_chain'
       or entity_decisions_value ->> 'practitioner' = 'individual_practitioner'
       or entity_decisions_value ->> 'franchise' = 'corporate_franchise' then
      raise exception 'accepted review has an ineligible duplicate or entity decision';
    end if;
    if resolved_reasons is distinct from array(
      select reason from unnest(target.screening_reasons) reason order by reason
    ) then
      raise exception 'accepted review must explicitly resolve every screening reason';
    end if;
  elsif cardinality(resolved_reasons) <> 0 then
    raise exception 'rejected reviews cannot clear screening reasons';
  end if;

  before_values_value := jsonb_build_object(
    'review_status', target.review_status,
    'review_reason_codes', target.review_reason_codes,
    'screening_status', target.screening_status,
    'screening_reasons', target.screening_reasons,
    'reviewed_by', target.reviewed_by,
    'reviewed_at', target.reviewed_at
  );

  update app.listing_candidates candidate
  set
    review_status = outcome,
    review_reason_codes = reason_codes_value,
    screening_status = case when outcome = 'accepted' then 'eligible' else candidate.screening_status end,
    screening_reasons = case when outcome = 'accepted' then '{}' else candidate.screening_reasons end,
    reviewed_by = current_actor,
    reviewed_at = statement_timestamp(),
    updated_at = statement_timestamp()
  where candidate.id = target.id
  returning candidate.* into target;

  after_values_value := jsonb_build_object(
    'review_status', target.review_status,
    'review_reason_codes', target.review_reason_codes,
    'screening_status', target.screening_status,
    'screening_reasons', target.screening_reasons,
    'reviewed_by', target.reviewed_by,
    'reviewed_at', target.reviewed_at
  );
  reviewed_candidate_value := private.candidate_publication_snapshot(target);
  reviewed_candidate_fingerprint_value := encode(
    extensions.digest(reviewed_candidate_value::text, 'sha256'),
    'hex'
  );

  insert into app.candidate_review_receipts (
    candidate_id,
    idempotency_key,
    request_fingerprint,
    reviewer_id,
    outcome,
    resolved_screening_reasons,
    source_urls,
    source_checked_at,
    checks,
    duplicate_decision,
    entity_decisions,
    reason_codes,
    before_values,
    after_values,
    reviewed_candidate,
    reviewed_candidate_fingerprint
  ) values (
    target.id,
    btrim(requested_idempotency_key),
    request_fingerprint_value,
    current_actor,
    outcome,
    resolved_reasons,
    to_jsonb(source_urls),
    source_checked,
    checks_value,
    duplicate_decision_value,
    entity_decisions_value,
    reason_codes_value,
    before_values_value,
    after_values_value,
    reviewed_candidate_value,
    reviewed_candidate_fingerprint_value
  ) returning id into receipt_id;

  insert into app.audit_events (
    actor_id,
    actor_kind,
    action,
    target_type,
    target_id,
    reason,
    before_ref,
    after_ref,
    request_id,
    correlation_id
  ) values (
    current_actor,
    'operator',
    'listing_candidate_reviewed',
    'listing_candidate',
    target.id::text,
    array_to_string(reason_codes_value, ','),
    before_values_value,
    after_values_value || jsonb_build_object('review_receipt_id', receipt_id),
    btrim(requested_idempotency_key),
    receipt_id::text
  );

  return receipt_id;
end;
$$;

create function public.publish_launch_selection(
  requested_candidate_ids uuid[],
  requested_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_actor uuid;
  normalized_candidate_ids uuid[];
  request_fingerprint_value text;
  existing_batch app.launch_publication_batches%rowtype;
  publication_batch_id_value uuid;
  candidate_record record;
  business_id_value uuid;
  listing_id_value uuid;
  category_id_value uuid;
  draft_values_value jsonb;
  pending_values_value jsonb;
  after_values_value jsonb;
begin
  if not app.operator_recent_auth(900) then
    raise exception 'recent Operator authentication is required';
  end if;

  current_actor := app.current_actor_id();
  if current_actor is null then
    raise exception 'Operator actor projection is required';
  end if;
  if not exists (
    select 1
    from app.operator_grants grant_record
    where grant_record.actor_id = current_actor
      and grant_record.status = 'active'
      and grant_record.permissions @> array['listing_publish']
  ) then
    raise exception 'Operator listing_publish permission is required';
  end if;
  if requested_idempotency_key is null
     or length(btrim(requested_idempotency_key)) not between 8 and 200 then
    raise exception 'idempotency key must contain 8 to 200 characters';
  end if;
  if requested_candidate_ids is null or cardinality(requested_candidate_ids) <> 100 then
    raise exception 'launch selection must contain exactly 100 candidates';
  end if;

  normalized_candidate_ids := array(
    select candidate_id from unnest(requested_candidate_ids) candidate_id order by candidate_id
  );
  request_fingerprint_value := encode(
    extensions.digest(to_jsonb(normalized_candidate_ids)::text, 'sha256'),
    'hex'
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('launch-publication:initial-100', 0)
  );

  select * into existing_batch
  from app.launch_publication_batches
  where idempotency_key = btrim(requested_idempotency_key);
  if found then
    if existing_batch.request_fingerprint <> request_fingerprint_value then
      raise exception 'idempotency key was already used for a different launch selection';
    end if;
    return jsonb_build_object(
      'publication_batch_id', existing_batch.id,
      'listing_count', existing_batch.candidate_count,
      'status', existing_batch.status
    );
  end if;

  if exists (select 1 from unnest(normalized_candidate_ids) candidate_id where candidate_id is null)
     or cardinality(normalized_candidate_ids) <> (
       select count(distinct candidate_id)
       from unnest(normalized_candidate_ids) candidate_id
     ) then
    raise exception 'launch selection candidate ids must be unique and non-null';
  end if;

  perform 1
  from app.listing_candidates candidate
  where candidate.id = any(normalized_candidate_ids)
  order by candidate.id
  for update;

  if (select count(*) from app.listing_candidates where id = any(normalized_candidate_ids)) <> 100 then
    raise exception 'one or more launch candidates do not exist';
  end if;
  if exists (select 1 from app.launch_publication_batches) then
    raise exception 'the launch selection has already been published';
  end if;
  if exists (
    select 1
    from app.listing_candidates candidate
    left join app.candidate_review_receipts review
      on review.candidate_id = candidate.id
    where candidate.id = any(normalized_candidate_ids)
      and (
        candidate.review_status <> 'accepted'
        or candidate.reviewed_by is null
        or candidate.reviewed_at is null
        or candidate.screening_status <> 'eligible'
        or cardinality(candidate.screening_reasons) <> 0
        or candidate.active_profile_status <> 'active'
        or candidate.selected_for_launch
        or candidate.launch_category_slug is null
        or review.outcome <> 'accepted'
        or review.duplicate_decision not in ('no_duplicate', 'distinct_location')
        or review.entity_decisions ->> 'branch' = 'national_branch'
        or review.entity_decisions ->> 'chain' = 'national_chain'
        or review.entity_decisions ->> 'practitioner' = 'individual_practitioner'
        or review.entity_decisions ->> 'franchise' = 'corporate_franchise'
        or private.candidate_publication_snapshot(candidate) <> review.reviewed_candidate
        or encode(
          extensions.digest(private.candidate_publication_snapshot(candidate)::text, 'sha256'),
          'hex'
        ) <> review.reviewed_candidate_fingerprint
      )
  ) then
    raise exception 'launch selection contains an unreviewed or ineligible candidate';
  end if;

  if (select count(*) from app.categories where is_launch_category) <> 10
     or exists (
       select 1
       from (
         select category.slug as category_slug, city.city_slug
         from app.categories category
         cross join (values ('reno'), ('sparks')) city(city_slug)
         where category.is_launch_category
       ) expected
       left join (
         select candidate.launch_category_slug, candidate.city_slug, count(*) as candidate_count
         from app.listing_candidates candidate
         where candidate.id = any(normalized_candidate_ids)
         group by candidate.launch_category_slug, candidate.city_slug
       ) actual
         on actual.launch_category_slug = expected.category_slug
         and actual.city_slug = expected.city_slug
       where coalesce(actual.candidate_count, 0) <> 5
     ) then
    raise exception 'launch selection must contain five candidates per launch category and city';
  end if;

  if exists (
    select 1
    from app.listing_candidates candidate
    join app.business_listings listing
      on lower(listing.current_slug) = lower(candidate.proposed_slug)
      or listing.source_row_id = candidate.source_row_id
      or (
        candidate.google_place_id is not null
        and listing.google_place_id = candidate.google_place_id
      )
    where candidate.id = any(normalized_candidate_ids)
  ) then
    raise exception 'launch selection conflicts with an existing Business Listing';
  end if;

  insert into app.launch_publication_batches (
    idempotency_key,
    request_fingerprint,
    publisher_id,
    candidate_count
  ) values (
    btrim(requested_idempotency_key),
    request_fingerprint_value,
    current_actor,
    100
  ) returning id into publication_batch_id_value;

  for candidate_record in
    select
      candidate.*,
      review.source_urls as review_source_urls,
      review.source_checked_at as review_source_checked_at,
      review.checks as review_checks,
      review.duplicate_decision as review_duplicate_decision,
      review.entity_decisions as review_entity_decisions,
      review.reason_codes as review_reason_codes,
      review.reviewer_id as review_reviewer_id,
      review.reviewed_candidate_fingerprint as review_candidate_fingerprint
    from app.listing_candidates candidate
    join app.candidate_review_receipts review on review.candidate_id = candidate.id
    where candidate.id = any(normalized_candidate_ids)
    order by candidate.city_slug, candidate.launch_category_slug, candidate.id
  loop
    business_id_value := extensions.gen_random_uuid();
    listing_id_value := extensions.gen_random_uuid();

    select id into category_id_value
    from app.categories
    where slug = candidate_record.launch_category_slug
      and is_launch_category;
    if category_id_value is null then
      raise exception 'launch category does not exist';
    end if;

    insert into app.businesses (id, canonical_name)
    values (business_id_value, candidate_record.normalized_name);

    insert into app.business_listings (
      id,
      business_id,
      current_slug,
      display_name,
      phone_e164,
      website_url,
      street_address,
      city_slug,
      postal_code,
      latitude,
      longitude,
      is_service_area,
      hide_street,
      google_place_id,
      publication_status,
      information_checked_at,
      information_checked_by,
      source_row_id
    ) values (
      listing_id_value,
      business_id_value,
      candidate_record.proposed_slug,
      candidate_record.normalized_name,
      candidate_record.phone_e164,
      candidate_record.website_url,
      case
        when candidate_record.review_entity_decisions ->> 'service_area' = 'service_area_business'
          then null
        else candidate_record.street_address
      end,
      candidate_record.city_slug,
      candidate_record.postal_code,
      case
        when candidate_record.review_entity_decisions ->> 'service_area' = 'service_area_business'
          then null
        else candidate_record.latitude
      end,
      case
        when candidate_record.review_entity_decisions ->> 'service_area' = 'service_area_business'
          then null
        else candidate_record.longitude
      end,
      candidate_record.review_entity_decisions ->> 'service_area' = 'service_area_business',
      candidate_record.review_entity_decisions ->> 'service_area' = 'service_area_business',
      candidate_record.google_place_id,
      'draft',
      candidate_record.review_source_checked_at,
      candidate_record.review_reviewer_id,
      candidate_record.source_row_id
    );

    insert into app.listing_slugs (slug, listing_id)
    values (candidate_record.proposed_slug, listing_id_value);

    insert into app.listing_categories (listing_id, category_id, is_primary)
    values (listing_id_value, category_id_value, true);

    if candidate_record.business_email is not null then
      insert into app.listing_private_contacts (listing_id, business_email)
      values (listing_id_value, candidate_record.business_email);
    end if;

    draft_values_value := jsonb_build_object(
      'business_id', business_id_value,
      'listing_id', listing_id_value,
      'current_slug', candidate_record.proposed_slug,
      'display_name', candidate_record.normalized_name,
      'phone_e164', candidate_record.phone_e164,
      'website_url', candidate_record.website_url,
      'street_address', case
        when candidate_record.review_entity_decisions ->> 'service_area' = 'service_area_business'
          then null
        else candidate_record.street_address
      end,
      'latitude', case
        when candidate_record.review_entity_decisions ->> 'service_area' = 'service_area_business'
          then null
        else candidate_record.latitude
      end,
      'longitude', case
        when candidate_record.review_entity_decisions ->> 'service_area' = 'service_area_business'
          then null
        else candidate_record.longitude
      end,
      'city_slug', candidate_record.city_slug,
      'postal_code', candidate_record.postal_code,
      'google_place_id', candidate_record.google_place_id,
      'launch_category_slug', candidate_record.launch_category_slug,
      'entity_decisions', candidate_record.review_entity_decisions,
      'publication_status', 'draft',
      'information_checked_at', candidate_record.review_source_checked_at,
      'reviewer_id', candidate_record.review_reviewer_id,
      'published_by', current_actor
    );

    insert into app.listing_revisions (
      listing_id,
      candidate_id,
      revision_type,
      before_values,
      after_values,
      reason_codes,
      actor_id
    ) values (
      listing_id_value,
      candidate_record.id,
      'created',
      '{}'::jsonb,
      draft_values_value,
      candidate_record.review_reason_codes,
      current_actor
    );

    update app.business_listings
    set publication_status = 'pending_review',
        updated_at = statement_timestamp()
    where id = listing_id_value;

    pending_values_value := draft_values_value || jsonb_build_object(
      'publication_status', 'pending_review'
    );

    insert into app.listing_revisions (
      listing_id,
      candidate_id,
      revision_type,
      before_values,
      after_values,
      reason_codes,
      actor_id
    ) values (
      listing_id_value,
      candidate_record.id,
      'proposed_change',
      draft_values_value,
      pending_values_value,
      candidate_record.review_reason_codes,
      current_actor
    );

    update app.business_listings
    set publication_status = 'published',
        published_at = statement_timestamp(),
        updated_at = statement_timestamp()
    where id = listing_id_value;

    after_values_value := pending_values_value || jsonb_build_object(
      'publication_status', 'published',
      'published_at', statement_timestamp()
    );

    insert into app.listing_revisions (
      listing_id,
      candidate_id,
      revision_type,
      before_values,
      after_values,
      reason_codes,
      actor_id
    ) values (
      listing_id_value,
      candidate_record.id,
      'approved_change',
      pending_values_value,
      after_values_value,
      candidate_record.review_reason_codes,
      current_actor
    );

    insert into app.publication_receipts (
      listing_id,
      candidate_id,
      source_batch_id,
      source_urls,
      source_checked_at,
      checks,
      duplicate_decision,
      entity_decision,
      entity_decisions,
      reviewer_id,
      reviewed_candidate_fingerprint,
      published_by,
      outcome,
      reason_codes,
      before_values,
      after_values,
      rollback_reference,
      publication_batch_id
    ) values (
      listing_id_value,
      candidate_record.id,
      candidate_record.batch_id,
      candidate_record.review_source_urls,
      candidate_record.review_source_checked_at,
      candidate_record.review_checks || jsonb_build_object('launch_balance_verified', true),
      candidate_record.review_duplicate_decision,
      case
        when candidate_record.review_entity_decisions ->> 'service_area' = 'service_area_business'
          then 'service_area_business'
        when candidate_record.review_entity_decisions ->> 'franchise' = 'locally_operated_franchise'
          then 'locally_operated_franchise'
        else 'independent_business'
      end,
      candidate_record.review_entity_decisions,
      candidate_record.review_reviewer_id,
      candidate_record.review_candidate_fingerprint,
      current_actor,
      'published',
      candidate_record.review_reason_codes,
      '{}'::jsonb,
      after_values_value,
      'rpc:transition_listing_publication_state:suspend:' || listing_id_value::text,
      publication_batch_id_value
    );

    update app.listing_candidates
    set selected_for_launch = true,
        updated_at = statement_timestamp()
    where id = candidate_record.id;

    insert into app.audit_events (
      actor_id,
      actor_kind,
      action,
      target_type,
      target_id,
      reason,
      before_ref,
      after_ref,
      request_id,
      correlation_id
    ) values (
      current_actor,
      'operator',
      'launch_listing_published',
      'business_listing',
      listing_id_value::text,
      array_to_string(candidate_record.review_reason_codes, ','),
      '{}'::jsonb,
      after_values_value || jsonb_build_object(
        'candidate_id', candidate_record.id,
        'publication_batch_id', publication_batch_id_value
      ),
      btrim(requested_idempotency_key),
      publication_batch_id_value::text
    );

    insert into app.integration_outbox (
      destination,
      event_type,
      aggregate_type,
      aggregate_id,
      idempotency_key,
      payload
    ) values (
      'gohighlevel',
      'business_listing.published',
      'business_listing',
      listing_id_value::text,
      'launch-publication:' || publication_batch_id_value::text || ':' || listing_id_value::text,
      jsonb_build_object(
        'listing_id', listing_id_value,
        'business_id', business_id_value,
        'candidate_id', candidate_record.id,
        'publication_batch_id', publication_batch_id_value,
        'publication_status', 'published'
      )
    );
  end loop;

  return jsonb_build_object(
    'publication_batch_id', publication_batch_id_value,
    'listing_count', 100,
    'status', 'published'
  );
end;
$$;

create function public.transition_listing_publication_state(
  requested_listing_id uuid,
  requested_transition text,
  requested_reason_codes text[],
  requested_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_actor uuid;
  target app.business_listings%rowtype;
  existing_receipt app.listing_status_transition_receipts%rowtype;
  receipt_id_value uuid;
  normalized_reason_codes text[];
  request_fingerprint_value text;
  before_values_value jsonb;
  after_values_value jsonb;
begin
  if not app.operator_recent_auth(900) then
    raise exception 'recent Operator authentication is required';
  end if;

  current_actor := app.current_actor_id();
  if current_actor is null then
    raise exception 'Operator actor projection is required';
  end if;
  if not exists (
    select 1
    from app.operator_grants grant_record
    where grant_record.actor_id = current_actor
      and grant_record.status = 'active'
      and grant_record.permissions @> array['listing_publish']
  ) then
    raise exception 'Operator listing_publish permission is required';
  end if;
  if requested_listing_id is null then
    raise exception 'listing id is required';
  end if;
  if requested_transition not in ('suspend', 'restore') then
    raise exception 'listing publication transition is invalid';
  end if;
  if requested_idempotency_key is null
     or length(btrim(requested_idempotency_key)) not between 8 and 200 then
    raise exception 'idempotency key must contain 8 to 200 characters';
  end if;

  normalized_reason_codes := array(
    select reason_code from unnest(requested_reason_codes) reason_code order by reason_code
  );
  if cardinality(normalized_reason_codes) not between 1 and 20
     or cardinality(normalized_reason_codes) <> (
       select count(distinct reason_code) from unnest(normalized_reason_codes) reason_code
     )
     or exists (
       select 1 from unnest(normalized_reason_codes) reason_code
       where reason_code !~ '^[a-z0-9_]{1,80}$'
     ) then
    raise exception 'reason codes must contain 1 to 20 unique stable codes';
  end if;

  request_fingerprint_value := encode(
    extensions.digest(
      jsonb_build_object(
        'listing_id', requested_listing_id,
        'transition', requested_transition,
        'reason_codes', normalized_reason_codes
      )::text,
      'sha256'
    ),
    'hex'
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'listing-publication-transition:' || btrim(requested_idempotency_key),
      0
    )
  );

  select * into existing_receipt
  from app.listing_status_transition_receipts
  where idempotency_key = btrim(requested_idempotency_key);
  if found then
    if existing_receipt.request_fingerprint <> request_fingerprint_value then
      raise exception 'idempotency key was already used for a different listing transition';
    end if;
    return existing_receipt.id;
  end if;

  select * into target
  from app.business_listings
  where id = requested_listing_id
  for update;
  if not found or not exists (
    select 1 from app.publication_receipts receipt where receipt.listing_id = requested_listing_id
  ) then
    raise exception 'published launch Listing does not exist';
  end if;
  if (requested_transition = 'suspend' and target.publication_status <> 'published')
     or (requested_transition = 'restore' and target.publication_status <> 'suspended') then
    raise exception 'listing publication transition is not allowed from the current state';
  end if;

  before_values_value := jsonb_build_object(
    'publication_status', target.publication_status,
    'published_at', target.published_at
  );

  update app.business_listings listing
  set publication_status = case
        when requested_transition = 'suspend' then 'suspended'
        else 'published'
      end,
      published_at = case
        when requested_transition = 'suspend' then null
        else statement_timestamp()
      end,
      updated_at = statement_timestamp()
  where listing.id = target.id
  returning jsonb_build_object(
    'publication_status', listing.publication_status,
    'published_at', listing.published_at
  ) into after_values_value;

  insert into app.listing_revisions (
    listing_id,
    revision_type,
    before_values,
    after_values,
    reason_codes,
    actor_id
  ) values (
    target.id,
    case when requested_transition = 'suspend' then 'suspended' else 'restored' end,
    before_values_value,
    after_values_value,
    normalized_reason_codes,
    current_actor
  );

  insert into app.listing_status_transition_receipts (
    listing_id,
    idempotency_key,
    request_fingerprint,
    actor_id,
    transition,
    reason_codes,
    before_values,
    after_values
  ) values (
    target.id,
    btrim(requested_idempotency_key),
    request_fingerprint_value,
    current_actor,
    requested_transition,
    normalized_reason_codes,
    before_values_value,
    after_values_value
  ) returning id into receipt_id_value;

  insert into app.audit_events (
    actor_id,
    actor_kind,
    action,
    target_type,
    target_id,
    reason,
    before_ref,
    after_ref,
    request_id,
    correlation_id
  ) values (
    current_actor,
    'operator',
    case
      when requested_transition = 'suspend' then 'business_listing_suspended'
      else 'business_listing_restored'
    end,
    'business_listing',
    target.id::text,
    array_to_string(normalized_reason_codes, ','),
    before_values_value,
    after_values_value || jsonb_build_object('transition_receipt_id', receipt_id_value),
    btrim(requested_idempotency_key),
    receipt_id_value::text
  );

  insert into app.integration_outbox (
    destination,
    event_type,
    aggregate_type,
    aggregate_id,
    idempotency_key,
    payload
  ) values (
    'gohighlevel',
    case
      when requested_transition = 'suspend' then 'business_listing.suspended'
      else 'business_listing.restored'
    end,
    'business_listing',
    target.id::text,
    'listing-transition:' || receipt_id_value::text,
    jsonb_build_object(
      'listing_id', target.id,
      'publication_status', after_values_value ->> 'publication_status',
      'transition_receipt_id', receipt_id_value
    )
  );

  return receipt_id_value;
end;
$$;

revoke all on function public.review_listing_candidate(uuid, jsonb, text)
  from public, anon, service_role;
revoke all on function public.publish_launch_selection(uuid[], text)
  from public, anon, service_role;
revoke all on function public.transition_listing_publication_state(uuid, text, text[], text)
  from public, anon, service_role;
grant execute on function public.review_listing_candidate(uuid, jsonb, text)
  to authenticated;
grant execute on function public.publish_launch_selection(uuid[], text)
  to authenticated;
grant execute on function public.transition_listing_publication_state(uuid, text, text[], text)
  to authenticated;

comment on function public.review_listing_candidate(uuid, jsonb, text) is
  'Recent-authenticated Operator command for one terminal, attributable, idempotent candidate review decision.';
comment on function public.publish_launch_selection(uuid[], text) is
  'Recent-authenticated Operator command that atomically publishes one balanced 100-Listing launch cohort with receipts.';
comment on function public.transition_listing_publication_state(uuid, text, text[], text) is
  'Recent-authenticated Operator rollback command for idempotent suspend and restore transitions on published launch Listings.';

commit;
