begin;

create function public.reconcile_listing_candidate_screening(
  requested_batch_id uuid,
  requested_candidates jsonb,
  requested_correlation_id text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_count integer;
begin
  if requested_batch_id is null or not exists (
    select 1 from private.source_batches where id = requested_batch_id
  ) then
    raise exception 'source batch does not exist';
  end if;
  if requested_correlation_id is null
     or btrim(requested_correlation_id) = ''
     or length(requested_correlation_id) > 200 then
    raise exception 'correlation id must contain 1 to 200 characters';
  end if;
  if requested_candidates is null
     or jsonb_typeof(requested_candidates) <> 'array'
     or jsonb_array_length(requested_candidates) < 1
     or jsonb_array_length(requested_candidates) > 500 then
    raise exception 'candidates must be a JSON array containing 1 to 500 records';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(requested_candidates) as requested(
      worksheet text,
      source_row integer,
      launch_category_slug text,
      screening_status text,
      screening_reasons jsonb,
      evidence jsonb
    )
    left join private.source_listing_rows source
      on source.batch_id = requested_batch_id
      and source.worksheet = requested.worksheet
      and source.source_row = requested.source_row
    left join app.listing_candidates target
      on target.batch_id = requested_batch_id
      and target.source_row_id = source.id
    where requested.worksheet is null
      or requested.source_row is null
      or requested.launch_category_slug is null
      or requested.screening_status is null
      or requested.screening_reasons is null
      or requested.evidence is null
      or target.id is null
      or requested.screening_status not in ('eligible', 'ineligible', 'needs_review')
      or jsonb_typeof(requested.screening_reasons) <> 'array'
      or jsonb_typeof(requested.evidence) <> 'object'
  ) then
    raise exception 'one or more screening candidates are invalid or missing';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(requested_candidates) as requested(screening_reasons jsonb)
    cross join lateral jsonb_array_elements(requested.screening_reasons) as reason(value)
    where jsonb_typeof(reason.value) <> 'string'
  ) then
    raise exception 'screening reasons must contain strings only';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(requested_candidates) as requested(
      worksheet text,
      source_row integer
    )
    group by requested.worksheet, requested.source_row
    having count(*) > 1
  ) then
    raise exception 'candidate source rows must be unique within a request';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(requested_candidates) as requested(
      worksheet text,
      source_row integer,
      launch_category_slug text,
      screening_status text,
      screening_reasons jsonb,
      evidence jsonb
    )
    join private.source_listing_rows source
      on source.batch_id = requested_batch_id
      and source.worksheet = requested.worksheet
      and source.source_row = requested.source_row
    join app.listing_candidates target
      on target.batch_id = requested_batch_id
      and target.source_row_id = source.id
    where (target.review_status <> 'pending' or target.selected_for_launch)
      and (
        target.launch_category_slug is distinct from requested.launch_category_slug
        or target.screening_status is distinct from requested.screening_status
        or target.screening_reasons is distinct from array(
          select jsonb_array_elements_text(requested.screening_reasons)
        )
        or target.evidence is distinct from (target.evidence || requested.evidence)
      )
  ) then
    raise exception 'reviewed or selected candidates cannot be reclassified';
  end if;

  with requested as (
    select *
    from jsonb_to_recordset(requested_candidates) as candidate(
      worksheet text,
      source_row integer,
      launch_category_slug text,
      screening_status text,
      screening_reasons jsonb,
      evidence jsonb
    )
  ), changes as (
    select
      target.id,
      requested.launch_category_slug,
      requested.screening_status,
      array(select jsonb_array_elements_text(requested.screening_reasons)) as screening_reasons,
      target.evidence || requested.evidence as evidence,
      jsonb_build_object(
        'launch_category_slug', target.launch_category_slug,
        'screening_status', target.screening_status,
        'screening_reasons', target.screening_reasons,
        'evidence', target.evidence
      ) as before_ref,
      jsonb_build_object(
        'launch_category_slug', requested.launch_category_slug,
        'screening_status', requested.screening_status,
        'screening_reasons', array(select jsonb_array_elements_text(requested.screening_reasons)),
        'evidence', target.evidence || requested.evidence
      ) as after_ref
    from requested
    join private.source_listing_rows source
      on source.batch_id = requested_batch_id
      and source.worksheet = requested.worksheet
      and source.source_row = requested.source_row
    join app.listing_candidates target
      on target.batch_id = requested_batch_id
      and target.source_row_id = source.id
    where target.review_status = 'pending'
      and not target.selected_for_launch
      and (
        target.launch_category_slug is distinct from requested.launch_category_slug
        or target.screening_status is distinct from requested.screening_status
        or target.screening_reasons is distinct from array(
          select jsonb_array_elements_text(requested.screening_reasons)
        )
        or target.evidence is distinct from (target.evidence || requested.evidence)
      )
  ), updated as (
    update app.listing_candidates target
    set
      launch_category_slug = changes.launch_category_slug,
      screening_status = changes.screening_status,
      screening_reasons = changes.screening_reasons,
      evidence = changes.evidence,
      updated_at = statement_timestamp()
    from changes
    where target.id = changes.id
    returning target.id
  )
  insert into app.audit_events (
    actor_kind,
    action,
    target_type,
    target_id,
    reason,
    before_ref,
    after_ref,
    request_id,
    correlation_id
  )
  select
    'system',
    'listing_candidate_screening_reconciled',
    'listing_candidate',
    changes.id::text,
    'deterministic import screening refresh',
    changes.before_ref,
    changes.after_ref,
    requested_correlation_id,
    requested_correlation_id
  from changes
  join updated on updated.id = changes.id;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

create or replace function public.listing_candidate_batch_status(requested_batch_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'batch_id', requested_batch_id,
    'candidate_count', coalesce(sum(grouped.candidate_count), 0),
    'transform_current_count', coalesce(sum(grouped.transform_current_count), 0),
    'risk_current_count', coalesce(sum(grouped.risk_current_count), 0),
    'eligible_count', coalesce(sum(grouped.eligible_count), 0),
    'needs_review_count', coalesce(sum(grouped.needs_review_count), 0),
    'ineligible_count', coalesce(sum(grouped.ineligible_count), 0),
    'selected_count', coalesce(sum(grouped.selected_count), 0),
    'matrix', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'city', grouped.city_slug,
          'category', grouped.launch_category_slug,
          'candidate_count', grouped.candidate_count,
          'transform_current_count', grouped.transform_current_count,
          'risk_current_count', grouped.risk_current_count,
          'eligible_count', grouped.eligible_count,
          'needs_review_count', grouped.needs_review_count,
          'ineligible_count', grouped.ineligible_count,
          'selected_count', grouped.selected_count
        ) order by grouped.city_slug, grouped.launch_category_slug
      ) filter (where grouped.city_slug is not null),
      '[]'::jsonb
    )
  )
  from (
    select
      city_slug,
      launch_category_slug,
      count(*) as candidate_count,
      count(*) filter (
        where evidence ->> 'transform_version' = 'launch-candidate-v2'
      ) as transform_current_count,
      count(*) filter (
        where evidence ->> 'corpus_review_risk_version' = 'entity-risk-v1'
      ) as risk_current_count,
      count(*) filter (where screening_status = 'eligible') as eligible_count,
      count(*) filter (where screening_status = 'needs_review') as needs_review_count,
      count(*) filter (where screening_status = 'ineligible') as ineligible_count,
      count(*) filter (where selected_for_launch) as selected_count
    from app.listing_candidates
    where batch_id = requested_batch_id
    group by city_slug, launch_category_slug
  ) grouped
$$;

revoke all on function public.reconcile_listing_candidate_screening(uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.reconcile_listing_candidate_screening(uuid, jsonb, text)
  to service_role;

comment on function public.reconcile_listing_candidate_screening(uuid, jsonb, text) is
  'Service-role-only idempotent, audited screening refresh for pending, unselected private candidates.';

commit;
