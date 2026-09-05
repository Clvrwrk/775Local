-- Brand asset kinds on media, plus listing case studies (projects/clients).
--
-- Photo model: a logo is required for every listing (enforced in the app, surfaced
-- by public.directory_listing_assets.has_logo). Encouraged: horizontal and vertical
-- logo, favicon, owner headshot, storefront, wrapped vehicle. Recommended gallery
-- content: project before/after and product shots.
--
-- Case studies: Standard and Premium listings publish up to 3 case studies plus
-- 1 featured. Older ones are archived; an archived study can still be the featured
-- one and stays public while it is. Plan gating happens in the app until the
-- projection carries a plan column.

begin;

-- ---------------------------------------------------------------------------
-- Media kinds
-- ---------------------------------------------------------------------------
alter table app.media_assets drop constraint if exists media_assets_kind_check;
alter table app.media_assets add constraint media_assets_kind_check check (kind in (
  'logo',
  'logo_horizontal',
  'logo_vertical',
  'favicon',
  'owner_headshot',
  'storefront',
  'vehicle_wrap',
  'project',
  'product',
  'image',
  'video'
));

alter table app.media_assets
  add column if not exists caption text,
  add column if not exists sort_order integer not null default 0;

-- Before the singleton-slot index: keep one live row per (listing, kind) and
-- soft-delete the other duplicates so the index build cannot abort on live data.
-- Survivor preference: the row listing_content already points at (logo or hero),
-- then an approved row, then the newest. Soft-delete clears public_path to
-- satisfy the approved <=> public_path check.
with ranked as (
  select m.id, m.listing_id, m.kind,
         row_number() over (
           partition by m.listing_id, m.kind
           order by
             (lc.logo_media_id = m.id or lc.hero_media_id = m.id) desc nulls last,
             (m.status = 'approved') desc,
             m.created_at desc,
             m.id desc
         ) as rn
  from app.media_assets m
  left join app.listing_content lc on lc.listing_id = m.listing_id
  where m.kind in ('logo', 'logo_horizontal', 'logo_vertical', 'favicon', 'owner_headshot')
    and m.status in ('uploaded', 'scanning', 'pending_review', 'approved')
),
survivors as (
  select listing_id, kind, id as survivor_id from ranked where rn = 1
),
retired as (
  update app.media_assets m
  set status = 'deleted', public_path = null
  from ranked
  where ranked.id = m.id and ranked.rn > 1
  returning m.id, m.listing_id, m.kind
)
-- Repoint any listing_content reference (logo or hero) that landed on a retired row.
update app.listing_content lc
set logo_media_id = coalesce(
      (select s.survivor_id from retired r join survivors s on s.listing_id = r.listing_id and s.kind = r.kind
       where r.id = lc.logo_media_id),
      lc.logo_media_id),
    hero_media_id = coalesce(
      (select s.survivor_id from retired r join survivors s on s.listing_id = r.listing_id and s.kind = r.kind
       where r.id = lc.hero_media_id),
      lc.hero_media_id)
where exists (
  select 1 from retired r
  where r.listing_id = lc.listing_id and (r.id = lc.logo_media_id or r.id = lc.hero_media_id)
);

-- One live asset per singleton brand slot.
create unique index if not exists media_assets_one_per_brand_slot
  on app.media_assets (listing_id, kind)
  where kind in ('logo', 'logo_horizontal', 'logo_vertical', 'favicon', 'owner_headshot')
    and status in ('uploaded', 'scanning', 'pending_review', 'approved');

create index if not exists media_assets_listing_kind_sort
  on app.media_assets (listing_id, kind, sort_order);

comment on column app.media_assets.kind is
  'logo is required per listing. logo_horizontal, logo_vertical, favicon, owner_headshot are single slots; storefront, vehicle_wrap, project, product, image, video repeat.';

-- ---------------------------------------------------------------------------
-- Case studies
-- ---------------------------------------------------------------------------
create table app.case_studies (
  id uuid primary key default extensions.gen_random_uuid(),
  listing_id uuid not null references app.business_listings(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 3 and 120),
  summary text check (summary is null or char_length(summary) <= 300),

  -- The client. client_name stays private; testimonial_author is the public credit.
  client_name text,
  client_type text check (client_type in ('homeowner', 'business', 'property_manager', 'hoa', 'public_sector', 'other')),
  client_location text check (client_location is null or client_location !~ '^\s*\d'),
  client_consented boolean not null default false,
  client_consented_at timestamptz,

  -- Project facts (all optional).
  project_type text,
  started_on date,
  completed_on date,
  investment_range text,
  materials text,
  crew_size smallint check (crew_size is null or crew_size > 0),

  -- Required narrative: what they needed, what the shop did, what came of it.
  client_need text not null check (char_length(client_need) >= 20),
  approach text not null check (char_length(approach) >= 20),
  results text not null check (char_length(results) >= 20),

  -- Optional narrative.
  challenges text,
  timeline_note text,
  lessons text,
  future_plans text,

  -- [{"label": "Panels replaced", "before": "0", "after": "6", "unit": ""}]
  metrics jsonb not null default '[]'::jsonb check (jsonb_typeof(metrics) = 'array'),

  testimonial_quote text,
  testimonial_author text,
  testimonial_role text,
  testimonial_rating smallint check (testimonial_rating is null or testimonial_rating between 1 and 5),

  -- Required photos.
  before_media_id uuid not null references app.media_assets(id),
  after_media_id uuid not null references app.media_assets(id),

  status text not null default 'draft'
    check (status in ('draft', 'pending_review', 'published', 'archived', 'rejected')),
  is_featured boolean not null default false,
  published_at timestamptz,
  archived_at timestamptz,

  created_by uuid references app.actors(id),
  updated_by uuid references app.actors(id),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),

  unique (listing_id, slug),
  check (before_media_id <> after_media_id),
  check (completed_on is null or started_on is null or completed_on >= started_on),
  check (not is_featured or status in ('published', 'archived')),
  check (status <> 'published' or published_at is not null),
  check (status <> 'archived' or archived_at is not null),
  check (testimonial_quote is null or testimonial_author is not null)
);

comment on table app.case_studies is
  'Projects/clients for a listing. Public when published, or archived and featured. Up to 3 published plus 1 featured per listing (trigger).';

create unique index case_studies_one_featured_per_listing
  on app.case_studies (listing_id) where is_featured;
create index case_studies_listing_status
  on app.case_studies (listing_id, status, published_at desc);

-- Extra photos and documents beyond the required before/after pair.
create table app.case_study_media (
  case_study_id uuid not null references app.case_studies(id) on delete cascade,
  media_id uuid not null references app.media_assets(id),
  role text not null check (role in ('before', 'during', 'after', 'detail', 'document')),
  caption text,
  sort_order integer not null default 0,
  primary key (case_study_id, media_id)
);

create index case_study_media_order on app.case_study_media (case_study_id, sort_order);

create function app.enforce_case_study_media_listing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from app.case_studies cs
    join app.media_assets m on m.id = new.media_id
    where cs.id = new.case_study_id and m.listing_id = cs.listing_id
  ) then
    raise exception 'Case study media must belong to the same listing.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger case_study_media_same_listing
before insert or update on app.case_study_media
for each row execute function app.enforce_case_study_media_listing();

-- Slot and publication rules.
-- security definer so RLS cannot hide a media row and turn a check into NULL.
create function app.enforce_case_study_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_row app.media_assets%rowtype;
  after_row app.media_assets%rowtype;
  live_count integer;
begin
  begin
    select * into strict before_row from app.media_assets where id = new.before_media_id;
    select * into strict after_row from app.media_assets where id = new.after_media_id;
  exception when no_data_found then
    raise exception 'Case study photos must exist.' using errcode = 'check_violation';
  end;

  if before_row.listing_id <> new.listing_id or after_row.listing_id <> new.listing_id then
    raise exception 'Case study photos must belong to the same listing.' using errcode = 'check_violation';
  end if;

  -- Every publicly visible state needs consent: published, or archived-but-featured.
  if new.status = 'published' or (new.status = 'archived' and new.is_featured) then
    if not new.client_consented then
      raise exception 'The client''s permission is required while a case study is public. Unfeature or unpublish it first.' using errcode = 'check_violation';
    end if;
    if before_row.status <> 'approved' or after_row.status <> 'approved' then
      raise exception 'Before and after photos must be approved while a case study is public.' using errcode = 'check_violation';
    end if;
  end if;

  if new.status = 'published' then
    if not new.is_featured then
      -- Serialize concurrent publishes for one listing.
      perform 1 from app.business_listings bl where bl.id = new.listing_id for update;
      select count(*) into live_count
      from app.case_studies cs
      where cs.listing_id = new.listing_id
        and cs.status = 'published'
        and not cs.is_featured
        and cs.id <> new.id;
      if live_count >= 3 then
        raise exception 'A listing shows at most 3 case studies plus 1 featured. Archive one first.' using errcode = 'check_violation';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger case_studies_enforce_rules
before insert or update on app.case_studies
for each row execute function app.enforce_case_study_rules();

create trigger case_studies_updated_at before update on app.case_studies
for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table app.case_studies enable row level security;
alter table app.case_study_media enable row level security;

-- Anonymous readers never touch app.can_manage_listing (anon cannot execute it).
create policy case_studies_read_public on app.case_studies for select to anon, authenticated
using (
  (status = 'published' or (status = 'archived' and is_featured))
  and exists (
    select 1 from app.business_listings bl
    where bl.id = case_studies.listing_id and bl.publication_status = 'published'
  )
);

create policy case_studies_read_managed on app.case_studies for select to authenticated
using (app.can_manage_listing(listing_id));

create policy case_studies_manage_authorized on app.case_studies for all to authenticated
using (app.can_manage_listing(listing_id)) with check (app.can_manage_listing(listing_id));

create policy case_study_media_read_public on app.case_study_media for select to anon, authenticated
using (exists (
  select 1 from app.case_studies cs
  where cs.id = case_study_media.case_study_id
    and (cs.status = 'published' or (cs.status = 'archived' and cs.is_featured))
    and exists (
      select 1 from app.business_listings bl
      where bl.id = cs.listing_id and bl.publication_status = 'published'
    )
));

create policy case_study_media_read_managed on app.case_study_media for select to authenticated
using (exists (
  select 1 from app.case_studies cs
  where cs.id = case_study_media.case_study_id and app.can_manage_listing(cs.listing_id)
));

create policy case_study_media_manage_authorized on app.case_study_media for all to authenticated
using (exists (
  select 1 from app.case_studies cs where cs.id = case_study_media.case_study_id and app.can_manage_listing(cs.listing_id)
))
with check (exists (
  select 1 from app.case_studies cs where cs.id = case_study_media.case_study_id and app.can_manage_listing(cs.listing_id)
));

-- Approved media on published listings is publicly readable so the projections can join it.
create policy media_read_public_approved on app.media_assets for select to anon, authenticated
using (
  status = 'approved'
  and exists (
    select 1 from app.business_listings bl
    where bl.id = media_assets.listing_id and bl.publication_status = 'published'
  )
);

-- Anonymous readers get only the columns the public projections need; client_name,
-- consent fields, storage internals and actor ids stay off the anon grant.
grant select (
  id, listing_id, slug, title, summary, client_type, client_location, project_type,
  started_on, completed_on, investment_range, materials, crew_size,
  client_need, approach, results, challenges, timeline_note, lessons, future_plans, metrics,
  testimonial_quote, testimonial_author, testimonial_role, testimonial_rating,
  before_media_id, after_media_id, status, is_featured, published_at
) on app.case_studies to anon;
grant select (case_study_id, media_id, role, caption, sort_order) on app.case_study_media to anon;
grant select (id, listing_id, kind, public_path, media_type, caption, sort_order, status) on app.media_assets to anon;
grant select on app.case_studies, app.case_study_media, app.media_assets to authenticated;
grant select, insert, update, delete on app.case_studies, app.case_study_media to authenticated;

-- ---------------------------------------------------------------------------
-- Public projections
-- ---------------------------------------------------------------------------
create or replace view public.directory_case_studies
with (security_invoker = true)
as
select
  cs.id,
  bl.stable_id as listing_stable_id,
  bl.current_slug as listing_slug,
  cs.slug,
  cs.title,
  cs.summary,
  cs.client_type,
  cs.client_location,
  cs.project_type,
  cs.started_on,
  cs.completed_on,
  cs.investment_range,
  cs.materials,
  cs.crew_size,
  cs.client_need,
  cs.approach,
  cs.results,
  cs.challenges,
  cs.timeline_note,
  cs.lessons,
  cs.future_plans,
  cs.metrics,
  cs.testimonial_quote,
  cs.testimonial_author,
  cs.testimonial_role,
  cs.testimonial_rating,
  b.public_path as before_path,
  a.public_path as after_path,
  cs.status,
  cs.is_featured,
  cs.published_at
from app.case_studies cs
join app.business_listings bl on bl.id = cs.listing_id and bl.publication_status = 'published'
join app.media_assets b on b.id = cs.before_media_id and b.status = 'approved'
join app.media_assets a on a.id = cs.after_media_id and a.status = 'approved'
where cs.status = 'published' or (cs.status = 'archived' and cs.is_featured);

revoke all on public.directory_case_studies from public;
grant select on public.directory_case_studies to anon, authenticated;

comment on view public.directory_case_studies is
  'Public case studies for published listings. Excludes client_name and every draft, pending, rejected or non-featured archived study.';

create or replace view public.directory_listing_assets
with (security_invoker = true)
as
select
  bl.stable_id as listing_stable_id,
  bl.current_slug as listing_slug,
  m.id,
  m.kind,
  m.public_path,
  m.media_type,
  m.caption,
  m.sort_order,
  bool_or(m.kind = 'logo') over (partition by m.listing_id) as has_logo
from app.media_assets m
join app.business_listings bl on bl.id = m.listing_id and bl.publication_status = 'published'
where m.status = 'approved';

revoke all on public.directory_listing_assets from public;
grant select on public.directory_listing_assets to anon, authenticated;

comment on view public.directory_listing_assets is
  'Approved brand assets and gallery media for published listings, with has_logo for the required-logo rule.';

commit;
