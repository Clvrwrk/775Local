begin;

create or replace function public.enrichment_snapshot_status(requested_snapshot_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with snapshot as (
    select *
    from private.enrichment_snapshots
    where id = requested_snapshot_id
  ), artifact_status as (
    select
      count(*) as artifact_count,
      coalesce(sum(raw.byte_count), 0) as total_bytes
    from private.enrichment_snapshot_artifacts member
    join private.enrichment_raw_artifacts raw on raw.id = member.artifact_id
    where member.snapshot_id = requested_snapshot_id
  ), profile_status as (
    select
      count(*) as profile_count,
      count(*) filter (where evidence_status = 'complete') as complete_profile_count,
      count(*) filter (where filter_version_accepted) as accepted_filter_profile_count
    from app.listing_enrichment_profiles
    where snapshot_id = requested_snapshot_id
  ), photo_status as (
    select count(*) as photo_count
    from app.listing_enrichment_photo_candidates photo
    join app.listing_enrichment_profiles profile on profile.id = photo.profile_id
    where profile.snapshot_id = requested_snapshot_id
  )
  select jsonb_build_object(
    'snapshot_id', snapshot.id,
    'manifest_sha256', snapshot.manifest_sha256,
    'expected_artifact_count', snapshot.artifact_count,
    'stored_artifact_count', artifact_status.artifact_count,
    'expected_profile_count', snapshot.profile_count,
    'stored_profile_count', profile_status.profile_count,
    'stored_photo_count', photo_status.photo_count,
    'expected_total_bytes', snapshot.total_bytes,
    'stored_total_bytes', artifact_status.total_bytes,
    'complete_profile_count', profile_status.complete_profile_count,
    'accepted_filter_profile_count', profile_status.accepted_filter_profile_count,
    'complete',
      artifact_status.artifact_count = snapshot.artifact_count
      and profile_status.profile_count = snapshot.profile_count
      and artifact_status.total_bytes = snapshot.total_bytes
  )
  from snapshot
  cross join artifact_status
  cross join profile_status
  cross join photo_status
$$;

revoke all on function public.enrichment_snapshot_status(bigint)
  from public, anon, authenticated;
grant execute on function public.enrichment_snapshot_status(bigint)
  to service_role;

commit;
