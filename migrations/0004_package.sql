create table if not exists listing_photos (
  id serial primary key,
  business_id int not null references businesses(id) on delete cascade,
  url text not null,
  caption text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists listing_photos_business_id_idx on listing_photos (business_id, sort_order, id);

create table if not exists offers (
  id serial primary key,
  business_id int not null unique references businesses(id) on delete cascade,
  title text not null,
  details text not null default '',
  code text not null default '',
  expires_on date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table campaigns add column if not exists included_offer text not null default '';
