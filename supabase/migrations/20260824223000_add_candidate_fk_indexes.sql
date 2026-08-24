create index if not exists category_crosswalks_reviewed_by_idx
  on app.category_crosswalks (reviewed_by)
  where reviewed_by is not null;

create index if not exists listing_candidates_launch_category_idx
  on app.listing_candidates (launch_category_slug);
