import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  sanitizeBusinessImage,
  validateImageDetails,
} from "../src/lib/directory/business-image-validation.mjs";

test("decodes owned synthetic pixels, re-encodes, resizes and strips metadata", async () => {
  const input = await sharp({
    create: { width: 2000, height: 800, channels: 3, background: "#24786d" },
  })
    .jpeg()
    .withExif({ IFD0: { Artist: "Private fixture author" } })
    .toBuffer();
  const result = await sanitizeBusinessImage(input, "image/jpeg");
  const metadata = await sharp(result.bytes).metadata();
  assert.equal(result.width, 1600);
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.icc, undefined);
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
});
test("rejects SVG, corrupt files, MIME spoofing, oversized files and animated images", async () => {
  await assert.rejects(
    sanitizeBusinessImage(Buffer.from("<svg/>"), "image/svg+xml"),
    /invalid_image/,
  );
  await assert.rejects(
    sanitizeBusinessImage(Buffer.from("not a png"), "image/png"),
    /invalid_image/,
  );
  await assert.rejects(sanitizeBusinessImage(Buffer.alloc(2097153), "image/png"), /invalid_image/);
  const png = await sharp({ create: { width: 32, height: 32, channels: 4, background: "red" } })
    .png()
    .toBuffer();
  await assert.rejects(sanitizeBusinessImage(png, "image/jpeg"), /invalid_image/);
  const pixels = Buffer.concat([Buffer.alloc(32 * 32 * 3, 50), Buffer.alloc(32 * 32 * 3, 230)]);
  const animated = await sharp(pixels, {
    raw: { width: 32, height: 64, pageHeight: 32, channels: 3 },
  })
    .webp({ delay: [100, 100] })
    .toBuffer();
  await assert.rejects(sanitizeBusinessImage(animated, "image/webp"), /invalid_image/);
});
test("requires an explicit separate kind, truthful alt text and rights attestation", () => {
  const valid = {
    id: "40000000-0000-4000-8000-000000000001",
    listingId: "40000000-0000-4000-8000-000000000002",
    kind: "logo",
    alt: "Synthetic business logo",
    rightsBasis: "owned",
    source: "Created by this business",
    rightsAttested: true,
  };
  assert.equal(validateImageDetails(valid).kind, "logo");
  for (const patch of [
    { kind: "video" },
    { alt: "" },
    { rightsBasis: "unknown" },
    { rightsAttested: false },
    { listingId: "../other" },
  ])
    assert.throws(() => validateImageDetails({ ...valid, ...patch }), /invalid_image_details/);
});
