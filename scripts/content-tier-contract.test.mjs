import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260830120000_add_content_tiers_and_category_counts.sql",
  import.meta.url,
);

test("content tier, verification, and sponsored placement remain independent public fields", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /content_tier in \('basic', 'standard', 'premium'\)/);
  assert.match(sql, /bl\.information_checked_at/);
  assert.match(sql, /bl\.owner_verified_at/);
  assert.match(sql, /as is_featured/);
});

test("empty categories cannot enter either public category projection", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /create or replace view public\.directory_categories/);
  assert.match(sql, /create or replace view public\.directory_city_categories/);
  assert.equal((sql.match(/having count\(distinct bl\.id\) > 0/g) ?? []).length, 2);
});

test("only approved content and rights-cleared media enter enhanced listing modules", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /content\.content_status = 'approved'/);
  assert.match(sql, /ma\.status = 'approved'/);
  assert.match(sql, /ma\.public_path/);
});
