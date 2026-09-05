import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** Bind an artifact root to one batch size before any receipt or provider work.
 * Legacy directories do not prove their original divisor. Bind those only after
 * an offline receipt inventory; never infer ownership from the current CLI flag.
 */
export async function ensureBatchLayout(root, batchSize) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 20)
    throw new Error("invalid batch size");
  const path = join(root, "batch-layout.json");
  const read = async () => JSON.parse(await readFile(path, "utf8"));
  let layout;
  try {
    layout = await read();
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const legacy = (await readdir(root)).some((name) => /^batch-\d+$/.test(name));
    if (legacy)
      throw new Error(
        "Existing legacy receipts require an offline inventory and batch-layout binding before resuming.",
      );
    layout = { schemaVersion: 1, batchSize };
    try {
      await writeFile(path, JSON.stringify(layout) + "\n", { flag: "wx", mode: 0o600 });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    layout = await read();
  }
  if (layout.schemaVersion !== 1 || layout.batchSize !== batchSize)
    throw new Error(
      "Batch layout mismatch: existing receipt ownership cannot be changed by --batch-size.",
    );
  return layout;
}
