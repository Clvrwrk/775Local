import assert from "node:assert/strict";
import { test } from "node:test";
import {
  attachPublicPresentation,
  mapPublicPresentation,
  publicEmailHref,
  reviewedMediaForUrl,
} from "../src/lib/directory/public-presentation.mjs";
import { fetchPublicListingPresentation } from "../src/lib/supabase/public-directory.mjs";
import {
  listingPresentationSnapshot,
  applyReviewedListingPresentation,
} from "../src/lib/supabase/listing-presentation.mjs";
const id = "d3000000-0000-4000-8000-000000000001";
const logo = {
  id: "d4000000-0000-4000-8000-000000000001",
  url: "https://fixture.example/logo.png",
  kind: "logo",
  caption: "Official logo",
  sourceUrl: "https://fixture.example/about",
  sourceCredit: "Fixture Company",
};
const photo = {
  ...logo,
  id: "d4000000-0000-4000-8000-000000000002",
  url: "https://fixture.example/shop.png",
  kind: "storefront",
  caption: "Reviewed storefront",
};
const row = {
  listing_id: id,
  public_email: "office@fixture.example",
  email_source_url: "https://fixture.example/contact",
  email_checked_at: "2026-10-05T12:00:00Z",
  media: [logo, photo],
};
test("reviewed public projection preserves logo-first order, contacts and source credits", () => {
  const mapped = mapPublicPresentation(row);
  assert.equal(mapped.logoUrl, logo.url);
  assert.equal(mapped.coverUrl, logo.url);
  assert.equal(mapped.photos[0].kind, "logo");
  assert.equal(mapped.photos[1].sourceCredit, "Fixture Company");
  assert.equal(mapped.publicEmailAddress, row.public_email);
  assert.equal(mapped.publicEmailSourceUrl, row.email_source_url);
  assert.equal(
    publicEmailHref("office+reno@fixture.example"),
    "mailto:office%2Breno%40fixture.example",
  );
});
test("missing review data cannot copy private contacts, old uncredited photos, or invent a logo", () => {
  const cards = [
    {
      sourceId: id,
      publicEmail: true,
      email: "private@fixture.example",
      publicEmailAddress: "stale@fixture.example",
      coverUrl: photo.url,
      photos: [photo],
    },
  ];
  const [mapped] = attachPublicPresentation(cards, []);
  assert.equal(mapped.publicEmail, false);
  assert.equal(mapped.email, "");
  assert.equal(mapped.publicEmailAddress, "");
  assert.equal(mapped.coverUrl, null);
  assert.deepEqual(mapped.photos, []);
  assert.deepEqual(mapPublicPresentation({ ...row, media: [photo, logo] }).photos, []);
  assert.deepEqual(
    mapPublicPresentation({ ...row, media: [{ ...logo, sourceCredit: "" }, photo] }).photos,
    [],
  );
  assert.equal(mapPublicPresentation({ ...row, email_source_url: null }).publicEmailAddress, "");
  assert.equal(
    mapPublicPresentation({
      ...row,
      public_email: "hello@fixture.example\r\nBcc: private@evil.test",
    }).publicEmailAddress,
    "",
  );
  assert.equal(
    mapPublicPresentation({ ...row, public_email: "mailto:office@fixture.example" })
      .publicEmailAddress,
    "",
  );
});
test("credential URLs, signed-query URLs, scripts and private proof are never mapped as media", () => {
  for (const url of [
    "javascript:alert(1)",
    "http://fixture.example/a.png",
    "https://user:secret@fixture.example/a.png",
    "https://fixture.example/a.png?token=private",
    "https://fixture.example/a.png#private",
  ]) {
    assert.deepEqual(
      mapPublicPresentation({ ...row, media: [{ ...logo, url }, photo] }).photos,
      [],
    );
  }
  assert.doesNotMatch(
    JSON.stringify(
      mapPublicPresentation({
        ...row,
        proof: "private-evidence",
        rightsEvidenceSha256: "private-hash",
      }),
    ),
    /private-evidence|private-hash/,
  );
  assert.throws(
    () => attachPublicPresentation([{ sourceId: id }], [row, row]),
    /ambiguous_public_presentation/,
  );
});
test("optional projection is bounded, scoped, publishable-only and has no old/private fallback", async () => {
  let calls = 0;
  const env = {
    DIRECTORY_SUPABASE_URL: "https://public.supabase.co",
    DIRECTORY_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
    SUPABASE_URL: "https://protected.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_protected",
  };
  const result = await fetchPublicListingPresentation({
    listingIds: [id],
    env,
    fetchImpl: async (url, init) => {
      calls++;
      assert.equal(url.origin, "https://public.supabase.co");
      assert.equal(url.pathname, "/rest/v1/directory_listing_presentation");
      assert.equal(url.searchParams.get("listing_id"), `in.(${id})`);
      assert.doesNotMatch(url.search, /private|rights|receipt|reviewed_request/);
      assert.equal(init.headers.apikey, env.DIRECTORY_SUPABASE_PUBLISHABLE_KEY);
      return Response.json([row]);
    },
  });
  assert.equal(result.status, "available");
  assert.equal(calls, 1);
  for (const fetchImpl of [
    async () => Response.json({ message: "private provider detail" }, { status: 404 }),
    async () => Response.json([{ ...row, listing_id: "outside-scope" }]),
    async () => {
      throw Error("private transport");
    },
  ]) {
    assert.deepEqual(await fetchPublicListingPresentation({ listingIds: [id], env, fetchImpl }), {
      status: "unavailable",
      rows: [],
    });
  }
  assert.deepEqual(
    await fetchPublicListingPresentation({
      listingIds: [],
      env,
      fetchImpl: async () => assert.fail(),
    }),
    { status: "available", rows: [] },
  );
});
test("operator presentation adapters preserve actor-bound transport and reject actor/secret injection", async () => {
  const options = {
    env: {
      SUPABASE_URL: "https://fixture.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
    },
    accessToken: "synthetic-operator",
    fetchImpl: async (url, init) => {
      assert.equal(init.headers.Authorization, "Bearer synthetic-operator");
      assert.equal(new URL(url).pathname, "/rest/v1/rpc/listing_presentation_snapshot");
      assert.deepEqual(JSON.parse(init.body), { requested_listing_id: id });
      return Response.json({ version: "a".repeat(64) });
    },
  };
  assert.equal((await listingPresentationSnapshot({ listingId: id }, options)).ok, true);
  assert.equal(
    (
      await listingPresentationSnapshot(
        { listingId: id, actorId: id },
        { ...options, fetchImpl: async () => assert.fail() },
      )
    ).code,
    "invalid_operator_command",
  );
  assert.equal(
    (
      await applyReviewedListingPresentation(
        { listingId: id, presentation: { media: [] }, idempotencyKey: "short" },
        { ...options, fetchImpl: async () => assert.fail() },
      )
    ).code,
    "invalid_operator_command",
  );
});

test("nested project and case-study placements require the current reviewed logo and exact credited media", () => {
  assert.equal(reviewedMediaForUrl([logo, photo], photo.url, logo.url), photo);
  assert.equal(reviewedMediaForUrl([logo, photo], photo.url, null), null);
  assert.equal(reviewedMediaForUrl([], photo.url, null), null);
  assert.equal(
    reviewedMediaForUrl([logo, photo], "https://fixture.example/unreviewed.png", logo.url),
    null,
  );
  assert.equal(
    reviewedMediaForUrl([{ ...logo, sourceCredit: "" }, photo], photo.url, logo.url),
    null,
  );
});
