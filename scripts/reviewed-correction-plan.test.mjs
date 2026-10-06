import assert from "node:assert/strict";
import { test } from "node:test";
import { applyReviewedListingCorrection } from "../src/lib/supabase/listing-corrections.mjs";
import { prepareReviewedCorrectionPlan } from "./reviewed-correction-plan.mjs";
const targetRef = "dpxeldzunfxmjahgvjhm";
const inventory = Array.from({ length: 100 }, (_, i) => ({
  slug: `fixture-${i}`,
  domain: `fixture${i}.example`,
}));
const targetSnapshots = inventory.map((row, i) => ({
  ...row,
  targetRef,
  listing_id: `40000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  version: "a".repeat(64),
  values: { hours_text: null, services: ["Home Repair"] },
}));
const draft = {
  ...inventory[0],
  artifactSha256: "b".repeat(64),
  certificateSha256: "c".repeat(64),
  changes: { hours_text: "Office hours: Monday–Friday 9am–4pm." },
  fieldProvenance: {
    hours_text: {
      state: "verified",
      url: "https://fixture0.example/contact",
      artifactSha256: "b".repeat(64),
      checkedAt: "2026-10-03T15:00:00Z",
      reason: "Synthetic first-party hours",
    },
  },
};

test("exact 100 plan holds 99 unknown records, preserves scope and binds one correction to target version", () => {
  const input = { targetRef, inventory, targetSnapshots, reviewedDrafts: [draft] };
  const plan = prepareReviewedCorrectionPlan(input);
  assert.equal(plan.total, 100);
  assert.equal(
    plan.entries.filter((e) => e.status === "held_missing_reviewed_evidence").length,
    99,
  );
  const entry = plan.entries[0];
  assert.deepEqual(entry.before, { hours_text: null });
  assert.deepEqual(entry.after, draft.changes);
  assert.equal(entry.command.listingId, targetSnapshots[0].listing_id);
  assert.equal(entry.command.correction.expectedVersion, targetSnapshots[0].version);
  assert.equal(entry.independentCertificateSha256, draft.certificateSha256);
  assert.ok(entry.unknowns.includes("street_address"));
  assert.deepEqual(
    prepareReviewedCorrectionPlan(input),
    plan,
    "duplicate preparation is deterministic and effect-free",
  );
});

test("missing records, ambiguous slugs, cross-target UUIDs and domain conflicts abstain", () => {
  const input = { targetRef, inventory, targetSnapshots, reviewedDrafts: [draft] };
  for (const partial of [
    { inventory: inventory.slice(0, 95) },
    { inventory: [...inventory.slice(0, 99), inventory[0]] },
    {
      targetSnapshots: targetSnapshots.map((r, i) =>
        i === 0 ? { ...r, targetRef: "otherpreviewproject1" } : r,
      ),
    },
    {
      targetSnapshots: targetSnapshots.map((r, i) =>
        i === 0 ? { ...r, domain: "lookalike.example" } : r,
      ),
    },
    { reviewedDrafts: [{ ...draft, changes: { owner_verified_at: "now" } }] },
    { reviewedDrafts: [{ ...draft, fieldProvenance: {} }] },
  ])
    assert.throws(() => prepareReviewedCorrectionPlan({ ...input, ...partial }));
});

test("unchanged values are no-ops; unknown evidence never erases unrelated fields", () => {
  const plan = prepareReviewedCorrectionPlan({
    targetRef,
    inventory,
    targetSnapshots,
    reviewedDrafts: [{ ...draft, changes: { hours_text: null } }],
  });
  assert.equal(plan.entries[0].status, "no_change");
  assert.equal(plan.entries[0].command, null);
  assert.deepEqual(plan.entries[0].after, {});
  assert.deepEqual(targetSnapshots[0].values.services, ["Home Repair"]);
});

function revealInput() {
  const values = {
    ...targetSnapshots[0].values,
    hide_street: true,
    is_service_area: true,
    street_address: "1757 Synthetic Avenue",
    postal_code: "89431",
    address_locality: null,
  };
  const changes = {
    hide_street: false,
    is_service_area: false,
    street_address: values.street_address,
    postal_code: values.postal_code,
    address_locality: "Sparks",
  };
  return {
    targetRef,
    inventory,
    targetSnapshots: targetSnapshots.map((r, i) => (i === 0 ? { ...r, values } : r)),
    reviewedDrafts: [
      {
        ...draft,
        changes,
        fieldProvenance: Object.fromEntries(
          Object.keys(changes).map((f) => [f, { ...draft.fieldProvenance.hours_text }]),
        ),
      },
    ],
  };
}

test("address reveal retains explicitly reviewed unchanged street/postal values through the user RPC", async () => {
  const input = revealInput();
  const entry = prepareReviewedCorrectionPlan(input).entries[0];
  assert.deepEqual(entry.command.correction.changes, input.reviewedDrafts[0].changes);
  assert.deepEqual(
    entry.command.correction.fieldProvenance,
    input.reviewedDrafts[0].fieldProvenance,
  );
  assert.equal(entry.before.street_address, input.targetSnapshots[0].values.street_address);
  assert.equal(entry.before.postal_code, input.targetSnapshots[0].values.postal_code);
  let calls = 0;
  const result = await applyReviewedListingCorrection(entry.command, {
    accessToken: "synthetic.user.jwt",
    env: {
      SUPABASE_URL: "https://fixture.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic",
    },
    fetchImpl: async (url, init) => {
      calls++;
      assert.equal(
        String(url),
        "https://fixture.supabase.co/rest/v1/rpc/apply_reviewed_listing_correction",
      );
      const body = JSON.parse(init.body);
      assert.deepEqual(body.requested_correction.changes, input.reviewedDrafts[0].changes);
      assert.deepEqual(
        body.requested_correction.fieldProvenance,
        input.reviewedDrafts[0].fieldProvenance,
      );
      assert.equal(body.requested_listing_id, input.targetSnapshots[0].listing_id);
      return Response.json({ receiptId: "synthetic-receipt", idempotent: false });
    },
  });
  assert.equal(result.ok, true);
  assert.equal(calls, 1);
});

test("address reveal never borrows hidden fields or missing provenance from a snapshot", () => {
  for (const field of ["street_address", "postal_code", "address_locality"]) {
    const missingValue = revealInput();
    delete missingValue.reviewedDrafts[0].changes[field];
    assert.throws(
      () => prepareReviewedCorrectionPlan(missingValue),
      /correction_address_evidence_required/,
    );
    const missingEvidence = revealInput();
    delete missingEvidence.reviewedDrafts[0].fieldProvenance[field];
    assert.throws(() => prepareReviewedCorrectionPlan(missingEvidence), /field_evidence_required/);
  }
});

test("service-area to storefront reveal retains independently reviewed stored address fields", () => {
  const input = revealInput();
  input.targetSnapshots[0].values.hide_street = false;
  delete input.reviewedDrafts[0].changes.hide_street;
  delete input.reviewedDrafts[0].fieldProvenance.hide_street;
  const entry = prepareReviewedCorrectionPlan(input).entries[0];
  assert.deepEqual(entry.command.correction.changes, input.reviewedDrafts[0].changes);
  assert.deepEqual(
    entry.command.correction.fieldProvenance,
    input.reviewedDrafts[0].fieldProvenance,
  );
});

test("independent reviewed About and explicit empty-module cleanup are prepared without flattening", () => {
  const changes = {
    description: "Exact reviewed short summary.",
    content_about: "Exact independently reviewed longer About for this business.",
    projects: [],
    faqs: [],
  };
  const fieldProvenance = Object.fromEntries(
    Object.keys(changes).map((f) => [f, { ...draft.fieldProvenance.hours_text }]),
  );
  const input = {
    targetRef,
    inventory,
    targetSnapshots,
    reviewedDrafts: [{ ...draft, changes, fieldProvenance }],
  };
  const entry = prepareReviewedCorrectionPlan(input).entries[0];
  assert.deepEqual(entry.command.correction.changes, changes);
  assert.notEqual(
    entry.command.correction.changes.description,
    entry.command.correction.changes.content_about,
  );
  for (const field of ["projects", "faqs"])
    assert.throws(
      () =>
        prepareReviewedCorrectionPlan({
          ...input,
          reviewedDrafts: [{ ...input.reviewedDrafts[0], changes: { ...changes, [field]: [{}] } }],
        }),
      /correction_clear_only_field/,
    );
});

test("rollback guidance requires fresh review for each changed public-copy field", () => {
  for (const [field, value] of Object.entries({
    description: "New exact short summary.",
    content_about: "New separately reviewed About text.",
    projects: [],
    faqs: [],
  })) {
    const entry = prepareReviewedCorrectionPlan({
      targetRef,
      inventory,
      targetSnapshots,
      reviewedDrafts: [
        {
          ...draft,
          changes: { [field]: value },
          fieldProvenance: { [field]: draft.fieldProvenance.hours_text },
        },
      ],
    }).entries[0];
    assert.match(entry.rollback, /fresh.*review/i, field);
    assert.doesNotMatch(entry.rollback, /Use returned receiptId\/version/, field);
  }
});

test("noncopy rollback guidance stays available when supplied copy is unchanged", () => {
  const summary = "Existing reviewed short summary.";
  const entry = prepareReviewedCorrectionPlan({
    targetRef,
    inventory,
    targetSnapshots: targetSnapshots.map((row, i) =>
      i === 0 ? { ...row, values: { ...row.values, description: summary } } : row,
    ),
    reviewedDrafts: [{ ...draft, changes: { ...draft.changes, description: summary } }],
  }).entries[0];
  assert.deepEqual(Object.keys(entry.command.correction.changes), ["hours_text"]);
  assert.match(entry.rollback, /Use returned receiptId\/version with protected rollback RPC/);
});
