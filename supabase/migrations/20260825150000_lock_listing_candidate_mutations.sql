begin;

drop policy if exists listing_candidates_operator_all on app.listing_candidates;

create policy listing_candidates_operator_read on app.listing_candidates
for select to authenticated using (app.is_operator());

revoke insert, update, delete on app.listing_candidates from authenticated;
grant select on app.listing_candidates to authenticated;

comment on table app.listing_candidates is
  'Private review queue. Authenticated Operators may read candidates; all mutations must use audited command functions with scoped grants.';

commit;
