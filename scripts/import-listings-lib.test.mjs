import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeCellValue,
  rowReceipt,
  validateImportTarget,
} from "./import-listings-lib.mjs";

test("row receipts are stable across object key order", () => {
  const first = rowReceipt("businesses-89431", 2, { title: "A", phone: "+17755550100" });
  const second = rowReceipt("businesses-89431", 2, { phone: "+17755550100", title: "A" });
  assert.equal(first.row_sha256, second.row_sha256);
  assert.match(first.row_sha256, /^[a-f0-9]{64}$/);
  assert.equal(first.source_row, 2);
});

test("cell normalization stays JSON-safe and deterministic", () => {
  assert.equal(normalizeCellValue(new Date("2026-08-24T20:00:00Z")), "2026-08-24T20:00:00.000Z");
  assert.equal(normalizeCellValue({ text: "Example", hyperlink: "https://example.com" }), "Example");
  assert.equal(normalizeCellValue(undefined), null);
});

test("apply mode requires an exact preview project match and rejects production", () => {
  const valid = validateImportTarget({
    IMPORT_TARGET: "preview",
    SUPABASE_URL: "https://previewref.supabase.co",
    PREVIEW_SUPABASE_PROJECT_REF: "previewref",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key-with-sufficient-length",
  });
  assert.equal(valid.projectRef, "previewref");

  assert.throws(
    () => validateImportTarget({
      IMPORT_TARGET: "production",
      SUPABASE_URL: "https://prod-ref.supabase.co",
      PREVIEW_SUPABASE_PROJECT_REF: "prod-ref",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key-with-sufficient-length",
    }),
    /preview/,
  );
  assert.throws(
    () => validateImportTarget({
      IMPORT_TARGET: "preview",
      SUPABASE_URL: "https://wrongref.supabase.co",
      PREVIEW_SUPABASE_PROJECT_REF: "previewref",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key-with-sufficient-length",
    }),
    /does not match/,
  );
});
