import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureBatchLayout } from "./serp-batch-layout.mjs";
test("resumption cannot change a batch root layout or overwrite its binding", async () => {
  const root = await mkdtemp(join(tmpdir(), "serp-layout-"));
  try {
    await ensureBatchLayout(root, 5);
    const before = await readFile(join(root, "batch-layout.json"), "utf8");
    await assert.rejects(ensureBatchLayout(root, 20), /mismatch/);
    assert.equal(await readFile(join(root, "batch-layout.json"), "utf8"), before);
    assert.equal((await ensureBatchLayout(root, 5)).batchSize, 5);
  } finally {
    await rm(root, { recursive: true });
  }
});
test("legacy receipt roots cannot be silently remapped to a smaller batch size", async () => {
  const root = await mkdtemp(join(tmpdir(), "serp-layout-"));
  try {
    await mkdir(join(root, "batch-01"));
    await assert.rejects(ensureBatchLayout(root, 5), /legacy/);
    await assert.rejects(ensureBatchLayout(root, 20), /legacy/);
  } finally {
    await rm(root, { recursive: true });
  }
});

test("a new nested output root is created and bound before receipts", async () => {
  const base = await mkdtemp(join(tmpdir(), "serp-layout-"));
  try {
    const root = join(base, "new", "output");
    assert.equal((await ensureBatchLayout(root, 5)).batchSize, 5);
    await assert.rejects(ensureBatchLayout(root, 20), /mismatch/);
  } finally {
    await rm(base, { recursive: true });
  }
});
