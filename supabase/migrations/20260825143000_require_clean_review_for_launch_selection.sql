begin;

alter table app.listing_candidates
  add constraint listing_candidates_selected_only_after_clean_review
  check (
    not selected_for_launch
    or (
      review_status = 'accepted'
      and reviewed_by is not null
      and reviewed_at is not null
      and screening_status = 'eligible'
      and cardinality(screening_reasons) = 0
    )
  );

comment on constraint listing_candidates_selected_only_after_clean_review
  on app.listing_candidates is
  'Launch selection requires an attributable accepted human review and zero unresolved screening reasons.';

commit;
