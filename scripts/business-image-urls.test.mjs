import test from "node:test";
import assert from "node:assert/strict";
import { isManagedBusinessImageUrl } from "../src/lib/directory/business-image-urls.mjs";

const path = "/api/business-images/40000000-0000-4000-8000-000000000001";
test("managed root-relative media resolves on Preview and production origins", () => {
  for (const origin of ["https://preview-fixture.vercel.app", "https://775directory.com"]) {
    const url = new URL(path, origin + "/biz/synthetic-business");
    assert.equal(url.origin, origin);
    assert.equal(url.pathname, path);
  }
});
test("gallery de-duplication recognizes relative and historical absolute managed paths", () => {
  for (const value of [
    path,
    "https://775directory.com" + path,
    "https://preview-fixture.vercel.app" + path,
  ])
    assert.equal(isManagedBusinessImageUrl(value), true);
  for (const value of [
    "https://fixture.invalid/ordinary-photo.webp",
    "/api/business-images/not-a-uuid",
    "javascript:" + path,
  ])
    assert.equal(isManagedBusinessImageUrl(value), false);
});
