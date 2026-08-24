begin;

insert into app.categories (slug, name, description, is_launch_category)
values
  ('screen-repair', 'Screen Repair', 'Window, patio, door, and pet-screen repair.', true),
  ('hvac', 'HVAC', 'Heating, ventilation, and air-conditioning service.', true),
  ('plumbing', 'Plumbing', 'Plumbing repair, installation, and emergency service.', true),
  ('electrical', 'Electrical', 'Licensed electrical installation and repair.', true),
  ('auto-repair', 'Auto Repair', 'Vehicle repair and maintenance shops.', true),
  ('restaurants', 'Restaurants', 'Locally operated places to eat and drink.', true),
  ('dentists', 'Dentists', 'Dental practices and clinics.', true),
  ('handyman', 'Handyman', 'General home repair and maintenance services.', true),
  ('roofing', 'Roofing', 'Roof installation, inspection, and repair.', true),
  ('veterinarians', 'Veterinarians', 'Veterinary practices and animal hospitals.', true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  is_launch_category = excluded.is_launch_category;

commit;
