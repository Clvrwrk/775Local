alter table businesses add column if not exists public_email boolean not null default false;
alter table businesses add column if not exists hide_street boolean not null default false;
alter table businesses add column if not exists claim_method text;

create table if not exists claim_proofs (
  id serial primary key,
  business_id int not null references businesses(id) on delete cascade,
  user_id text not null,
  method text not null,
  filename text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists claim_proofs_business_id_idx on claim_proofs (business_id);

update businesses set website = 'https://highsierrascreens.com' where slug = 'high-sierra-screens-reno' and website = '';
update businesses set website = 'https://biggestlittlescreens.com' where slug = 'biggest-little-screen-co' and website = '';
update businesses set website = 'https://railcityscreens.com' where slug = 'rail-city-screens' and website = '';
update businesses set website = 'https://carsonvalleyscreens.com' where slug = 'carson-valley-screens' and website = '';
update businesses set website = 'https://tahoescreenworks.com' where slug = 'tahoe-screen-works' and website = '';
update businesses set website = 'https://desertmeshelko.com' where slug = 'desert-mesh-elko' and website = '';
update businesses set website = 'https://capitalcoolhvac.com' where slug = 'capital-cool-carson' and website = '';
update businesses set website = 'https://truckeemeadowsair.com' where slug = 'truckee-meadows-air' and website = '';
update businesses set website = 'https://pipeandsage.com' where slug = 'pipe-and-sage-plumbing' and website = '';
update businesses set website = 'https://starhotelnv.com' where slug = 'star-hotel-elko' and website = '';
update businesses set website = 'https://louisbasque.com' where slug = 'louis-basque-reno' and website = '';
update businesses set email = 'shop@' || regexp_replace(website, '^https?://(www\.)?', '') where website <> '' and email like '%.example';
