import { readFile } from "node:fs/promises";
import { forecastEnrichmentDeadline } from "./seed-rollout-lib.mjs";

const args = new Map(
  process.argv
    .slice(2)
    .flatMap((value, index, all) => (value.startsWith("--") ? [[value, all[index + 1]]] : [])),
);
const queuePath = args.get("--queue");
const progressPath = args.get("--progress");
const deadline = args.get("--deadline");
if (!queuePath || !progressPath || !deadline)
  throw new Error("usage: --queue PATH --progress PATH --deadline ISO_DATE [--runs-per-day N]");

const [queue, progress] = await Promise.all([
  readFile(queuePath, "utf8").then(JSON.parse),
  readFile(progressPath, "utf8").then(JSON.parse),
]);
const forecast = forecastEnrichmentDeadline({
  categoryCount: Number(queue.categoryCount ?? queue.queue?.length ?? 0),
  completedCategoryCount: Number(
    progress.completedCategoryCount ?? progress.completedPriorities?.length ?? 0,
  ),
  batchSize: Number(args.get("--batch-size") ?? 20),
  runsPerDay: Number(args.get("--runs-per-day") ?? 1),
  from: new Date().toISOString(),
  deadline,
});
process.stdout.write(`${JSON.stringify(forecast, null, 2)}\n`);
if (!forecast.onTrack) process.exitCode = 2;
