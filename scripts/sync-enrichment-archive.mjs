#!/usr/bin/env node
import { resolve } from "node:path";
import { buildEnrichmentSnapshot, summarizeEnrichmentSnapshot } from "./enrichment-archive-lib.mjs";
import { validateImportTarget } from "./import-listings-lib.mjs";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const expectedManifest =
  args
    .find((arg) => arg.startsWith("--expected-manifest="))
    ?.slice("--expected-manifest=".length) ?? "";
const rootArg = args.find((arg) => !arg.startsWith("--"));

if (!rootArg) {
  throw new Error(
    "Usage: node scripts/sync-enrichment-archive.mjs <artifact-root> [--apply --expected-manifest=<sha256>]",
  );
}

async function rpc(target, name, body) {
  const response = await fetch(new URL(`/rest/v1/rpc/${name}`, target.url), {
    method: "POST",
    headers: {
      apikey: target.serviceRoleKey,
      Authorization: `Bearer ${target.serviceRoleKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    throw new Error(`Preview enrichment RPC ${name} failed with HTTP ${response.status}.`);
  }
  return response.json();
}

const root = resolve(rootArg);
const snapshot = await buildEnrichmentSnapshot(root);
const summary = summarizeEnrichmentSnapshot(snapshot);

if (!apply) {
  console.log(JSON.stringify({ mode: "dry-run", sourceRoot: root, ...summary }, null, 2));
  process.exit(0);
}

if (!/^[a-f0-9]{64}$/.test(expectedManifest) || expectedManifest !== snapshot.manifestSha256) {
  throw new Error("--expected-manifest must exactly match the current artifact manifest.");
}

const target = validateImportTarget(process.env);
const snapshotId = await rpc(target, "register_enrichment_snapshot", {
  requested_manifest_sha256: snapshot.manifestSha256,
  requested_source_root: root,
  requested_artifact_count: snapshot.artifactCount,
  requested_profile_count: snapshot.profileCount,
  requested_total_bytes: snapshot.totalBytes,
  requested_filter_versions: snapshot.filterVersions,
  requested_captured_at: snapshot.capturedAt,
  requested_imported_by: process.env.IMPORT_ACTOR?.trim() || "codex-project-lead",
  requested_notes: {
    scope: "Private raw evidence archive and review-only seed profile proposals",
    proposalVersion: snapshot.proposalVersion,
    acceptedFilterVersion: "business-controlled-domain-v3",
    canonicalListingWrites: false,
    publicationWrites: false,
  },
});
if (!Number.isInteger(snapshotId)) throw new Error("Preview did not return a snapshot id.");

function statusMatchesSnapshot(status) {
  return (
    status?.complete === true &&
    status.manifest_sha256 === snapshot.manifestSha256 &&
    status.stored_artifact_count === snapshot.artifactCount &&
    status.stored_profile_count === snapshot.profileCount &&
    status.stored_total_bytes === snapshot.totalBytes
  );
}

const existingStatus = await rpc(target, "enrichment_snapshot_status", {
  requested_snapshot_id: snapshotId,
});
if (statusMatchesSnapshot(existingStatus)) {
  console.log(
    JSON.stringify(
      {
        mode: "apply",
        projectRef: target.projectRef,
        snapshotId,
        artifactLinksInsertedThisRun: 0,
        profilesInsertedThisRun: 0,
        ...summary,
        status: existingStatus,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

let artifactLinksInsertedThisRun = 0;
for (let offset = 0; offset < snapshot.artifacts.length; offset += 3) {
  const inserted = await rpc(target, "ingest_enrichment_artifacts", {
    requested_snapshot_id: snapshotId,
    requested_artifacts: snapshot.artifacts.slice(offset, offset + 3),
  });
  if (!Number.isInteger(inserted)) throw new Error("Preview returned an invalid artifact count.");
  artifactLinksInsertedThisRun += inserted;
}

let profilesInsertedThisRun = 0;
for (let offset = 0; offset < snapshot.profiles.length; offset += 50) {
  const inserted = await rpc(target, "ingest_enrichment_profiles", {
    requested_snapshot_id: snapshotId,
    requested_profiles: snapshot.profiles.slice(offset, offset + 50),
  });
  if (!Number.isInteger(inserted)) throw new Error("Preview returned an invalid profile count.");
  profilesInsertedThisRun += inserted;
}

const status = await rpc(target, "enrichment_snapshot_status", {
  requested_snapshot_id: snapshotId,
});
if (!statusMatchesSnapshot(status)) {
  throw new Error("Preview enrichment archive did not reconcile to the local manifest.");
}

console.log(
  JSON.stringify(
    {
      mode: "apply",
      projectRef: target.projectRef,
      snapshotId,
      artifactLinksInsertedThisRun,
      profilesInsertedThisRun,
      ...summary,
      status,
    },
    null,
    2,
  ),
);
