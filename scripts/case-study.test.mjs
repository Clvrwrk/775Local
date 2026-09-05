import assert from "node:assert/strict";
import test from "node:test";
import { buildCaseStudyUrl, fetchListingCaseStudies, mapCaseStudy, mediaUrl } from "../src/lib/supabase/public-directory.mjs";

test("buildCaseStudyUrl targets the public projection for one listing by slug", () => {
  const url = buildCaseStudyUrl("https://example.supabase.co", "high-sierra-screens-reno");
  assert.equal(url.pathname, "/rest/v1/directory_case_studies");
  assert.equal(url.searchParams.get("listing_slug"), "eq.high-sierra-screens-reno");
  assert.equal(url.searchParams.get("order"), "is_featured.desc,published_at.desc");
  assert.throws(() => buildCaseStudyUrl("https://example.supabase.co", "not a slug"));
});

test("fetchListingCaseStudies never throws and returns [] on failure", async () => {
  const env = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_PUBLISHABLE_KEY: "k" };
  const failing = await fetchListingCaseStudies({ listingSlug: "s", env, fetchImpl: async () => { throw new Error("down"); } });
  assert.deepEqual(failing, []);
  const bad = await fetchListingCaseStudies({ listingSlug: "s", env, fetchImpl: async () => new Response("nope", { status: 500 }) });
  assert.deepEqual(bad, []);
  const ok = await fetchListingCaseStudies({ listingSlug: "s", env, fetchImpl: async () => new Response(JSON.stringify([{ id: "1", slug: "a", title: "T", client_need: "n", approach: "a", results: "r" }])) });
  assert.equal(ok.length, 1);
});

test("mediaUrl resolves storage paths and passes absolute urls through", () => {
  assert.equal(mediaUrl("https://x.supabase.co/", "listing-media/a.jpg"), "https://x.supabase.co/storage/v1/object/public/listing-media/a.jpg");
  assert.equal(mediaUrl("https://x.supabase.co", "https://cdn.example/a.jpg"), "https://cdn.example/a.jpg");
  assert.equal(mediaUrl("https://x.supabase.co", null), "");
});

test("mapCaseStudy keeps the required narrative and drops malformed metrics", () => {
  const study = mapCaseStudy(
    {
      id: "c1",
      slug: "patio-rescreen",
      title: "Patio rescreen",
      client_need: "Two torn panels",
      approach: "Recut pet mesh",
      results: "Cat stayed inside",
      metrics: [{ label: "Panels", before: 0, after: 2 }, "junk", { before: 1 }],
      testimonial_quote: "Great work",
      testimonial_author: "Maya R.",
      testimonial_rating: "5",
      before_path: "m/before.jpg",
      after_path: "m/after.jpg",
      is_featured: true,
      published_at: "2026-09-01T00:00:00Z",
    },
    "https://x.supabase.co",
  );
  assert.equal(study.clientNeed, "Two torn panels");
  assert.deepEqual(study.metrics, [{ label: "Panels", before: "0", after: "2", unit: "" }]);
  assert.equal(study.testimonial?.rating, 5);
  assert.equal(study.beforeUrl, "https://x.supabase.co/storage/v1/object/public/m/before.jpg");
  assert.equal(study.featured, true);
});

test("mapCaseStudy returns no testimonial without a quote", () => {
  const study = mapCaseStudy({ id: "c2", slug: "s", title: "T", client_need: "n", approach: "a", results: "r", metrics: null });
  assert.equal(study.testimonial, null);
  assert.deepEqual(study.metrics, []);
});
