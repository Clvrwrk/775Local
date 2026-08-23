create table if not exists cities (
  id serial primary key,
  slug text not null unique,
  name text not null,
  county text not null,
  region text not null,
  zip text not null,
  lat double precision not null,
  lng double precision not null,
  blurb text not null
);

create table if not exists categories (
  id serial primary key,
  slug text not null unique,
  name text not null,
  description text not null,
  synonyms text not null default '',
  icon text not null default 'map-pin'
);

create table if not exists businesses (
  id serial primary key,
  slug text not null unique,
  name text not null,
  tagline text not null default '',
  description text not null,
  phone text not null,
  email text not null default '',
  website text not null default '',
  street text not null,
  zip text not null,
  city_id int not null references cities(id),
  lat double precision,
  lng double precision,
  rating numeric(2,1) not null default 4.8,
  review_count int not null default 0,
  hours text not null default 'Mon–Fri 8am–5pm',
  featured boolean not null default false,
  verified boolean not null default true,
  claimed_by text,
  created_at timestamptz not null default now()
);

create index if not exists businesses_city_id_idx on businesses (city_id);
create index if not exists businesses_slug_idx on businesses (slug);
create index if not exists businesses_claimed_by_idx on businesses (claimed_by);

create table if not exists business_categories (
  business_id int not null references businesses(id) on delete cascade,
  category_id int not null references categories(id) on delete cascade,
  is_primary boolean not null default true,
  primary key (business_id, category_id)
);

create table if not exists reviews (
  id serial primary key,
  business_id int not null references businesses(id) on delete cascade,
  author text not null,
  rating int not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists leads (
  id serial primary key,
  business_id int not null references businesses(id) on delete cascade,
  name text not null,
  phone text not null default '',
  email text not null default '',
  zip text not null default '',
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists leads_business_id_idx on leads (business_id);

create table if not exists residents (
  id serial primary key,
  user_id text not null unique,
  display_name text not null default '',
  zip text not null,
  city_slug text not null,
  interests text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists residents_zip_idx on residents (zip);
create index if not exists residents_city_slug_idx on residents (city_slug);

create table if not exists campaigns (
  id serial primary key,
  user_id text not null,
  business_id int not null references businesses(id) on delete cascade,
  name text not null,
  channel text not null,
  city_slug text not null default '',
  category_slug text not null default '',
  message text not null,
  status text not null default 'sent',
  reach int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists campaigns_user_id_idx on campaigns (user_id);
