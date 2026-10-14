import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { memberHandle, sniffImage, validateExperience, validateMemberProfile } from "../src/lib/directory/member-validate.mjs";
import { memberPhotoUrl } from "../src/lib/supabase/member-commands.mjs";

test("member profile accepts a public name and rejects an email address", () => {
  const profile = validateMemberProfile({
    displayName: "Ava Cole",
    handle: "Ava Cole",
    town: "Reno",
    bio: "Lives in the 775.",
  });
  assert.equal(profile.handle, "ava-cole");
  assert.equal(profile.town, "Reno");
  assert.throws(
    () => validateMemberProfile({ displayName: "ava@example.com", handle: "ava", town: "Reno", bio: "" }),
    /invalid_member_profile/,
  );
});

test("experience requires a real listing, a rating, and twenty characters", () => {
  const experience = validateExperience({
    listingId: "122ffb82-8e39-4411-b8b2-9f93c3210e93",
    rating: 4,
    body: "The crew showed up when they said they would.",
    idempotencyKey: "exp-12345678",
  });
  assert.equal(experience.rating, 4);
  assert.throws(
    () =>
      validateExperience({
        listingId: "122ffb82-8e39-4411-b8b2-9f93c3210e93",
        rating: 6,
        body: "Too short.",
        idempotencyKey: "exp-12345678",
      }),
    /invalid_experience/,
  );
});

test("photos accept jpeg png and webp and reject anything else", () => {
  assert.equal(sniffImage(Uint8Array.of(0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0)).ext, "jpg");
  const png = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0);
  assert.equal(sniffImage(png).contentType, "image/png");
  const webp = Uint8Array.of(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50);
  assert.equal(sniffImage(webp).ext, "webp");
  assert.equal(sniffImage(Uint8Array.of(0x47, 0x49, 0x46, 0x38, 0, 0, 0, 0, 0, 0, 0, 0)), null);
  assert.equal(sniffImage(new Uint8Array(900_001)), null);
});

test("public photo urls stay on this product storage bucket", () => {
  const path = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/0.jpg";
  assert.equal(
    memberPhotoUrl("https://hcfryjrajqftcnnbnybj.supabase.co", path),
    `https://hcfryjrajqftcnnbnybj.supabase.co/storage/v1/object/public/member-photos/${path}`,
  );
  assert.equal(memberPhotoUrl("https://example.com", path), "");
  assert.equal(memberPhotoUrl("https://hcfryjrajqftcnnbnybj.supabase.co", "../secret"), "");
});

test("the public profile route is not nested under the sign-in editor", () => {
  const route = readFileSync(new URL("../src/routes/member_.$handle.tsx", import.meta.url), "utf8");
  const tree = readFileSync(new URL("../src/routeTree.gen.ts", import.meta.url), "utf8");
  assert.match(route, /createFileRoute\("\/member_\/\$handle"\)/);
  assert.match(
    tree,
    /id: '\/member_\/\$handle',\n {2}path: '\/member\/\$handle',\n {2}getParentRoute: \(\) => rootRouteImport,/,
  );
  assert.equal(tree.includes("from './routes/member.$handle'"), false);
});

test("the member migration does not grant listing authority", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/20261014190000_local_member_experiences.sql", import.meta.url),
    "utf8",
  );
  assert.equal(sql.includes("listing_participations"), false);
  assert.equal(sql.includes("owner_verified_at"), false);
  assert.equal(sql.includes("grant execute on function public.listing_experiences(text) to anon, authenticated"), true);
  assert.equal(sql.includes("revoke all on app.experience_reviews from public, anon, authenticated"), true);
  assert.match(memberHandle("  Reno Neighbor  "), /^reno-neighbor$/);
});
