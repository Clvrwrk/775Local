import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  ACCEPTED_ENRICHMENT_FILTER_VERSION,
  buildEnrichmentSnapshot,
  extractPhotoCandidates,
  summarizeEnrichmentSnapshot,
} from "./enrichment-archive-lib.mjs";

async function withFixture(run, { filterVersion = ACCEPTED_ENRICHMENT_FILTER_VERSION } = {}) {
  const root = await mkdtemp(join(tmpdir(), "local775-enrichment-archive-"));
  try {
    await mkdir(join(root, "batch-01", "listings"), { recursive: true });
    await mkdir(join(root, "batch-01", "superseded-listings"), { recursive: true });
    await writeFile(
      join(root, "category-queue.json"),
      `${JSON.stringify([{ priority: 1, category: "HVAC", slug: "hvac" }], null, 2)}\n`,
    );
    await writeFile(join(root, "progress.json"), '{"completedPriorities":[]}\n');
    await writeFile(
      join(root, "provider-ledger.jsonl"),
      '{"type":"website_crawl","status":"complete"}\n',
    );
    await writeFile(
      join(root, "batch-01", "hvac-search.json"),
      `${JSON.stringify(
        {
          category: { priority: 1, name: "HVAC", slug: "hvac" },
          filterVersion,
          results: [
            {
              serpRank: 1,
              title: "Acme Heating",
              url: "https://acme.example/services",
              domain: "acme.example",
            },
          ],
        },
        null,
        2,
      )}\n`,
    );
    const listing = {
      schemaVersion: 1,
      category: { priority: 1, name: "HVAC", slug: "hvac", group: "Home Services" },
      reviewStatus: "private_candidate",
      serp: {
        serpRank: 1,
        title: "Acme Heating",
        url: "https://acme.example/services",
        domain: "acme.example",
      },
      crawl: { provider: "firecrawl", pageCount: 2, pageLimit: 25 },
      evidence: {
        title: "Acme Heating & Cooling",
        phones: ["775-555-0100"],
        emails: ["service@acme.example"],
        hoursEvidence: "Monday 8am-5pm",
        sourceUrls: ["https://acme.example/services", "https://acme.example/about"],
      },
      sourcePages: [
        {
          url: "https://acme.example/services",
          title: "Services",
          markdown:
            "## Air Conditioning Repair\n\n## Furnace Installation\n\n![AC repair project](https://acme.example/uploads/ac-repair.jpg)\n\n![Spinner](https://cdn.userway.org/spinner.svg)",
        },
        {
          url: "https://acme.example/about",
          title: "About",
          markdown:
            "Acme Heating & Cooling has served Reno and Sparks since 1985. Our local technicians provide heating and cooling repairs for homes and businesses throughout the Truckee Meadows.\n\n![Acme logo](https://acme.example/uploads/acme-logo.png)",
        },
      ],
    };
    await writeFile(
      join(root, "batch-01", "listings", "hvac--acme.example.json"),
      `${JSON.stringify(listing, null, 2)}\n`,
    );
    await writeFile(
      join(root, "batch-01", "superseded-listings", "hvac--old.example.json"),
      `${JSON.stringify({ ...listing, serp: { ...listing.serp, domain: "old.example" } })}\n`,
    );
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("builds a byte-preserving snapshot and robust private seed profile", async () => {
  await withFixture(async (root) => {
    const snapshot = await buildEnrichmentSnapshot(root);
    assert.equal(snapshot.artifactCount, 6);
    assert.equal(snapshot.profileCount, 1);
    assert.deepEqual(snapshot.filterVersions, [ACCEPTED_ENRICHMENT_FILTER_VERSION]);
    assert.match(snapshot.manifestSha256, /^[a-f0-9]{64}$/);
    assert.equal(
      snapshot.totalBytes,
      snapshot.artifacts.reduce((sum, artifact) => sum + Buffer.byteLength(artifact.raw_text), 0),
    );

    const profile = snapshot.profiles[0];
    assert.equal(profile.evidence_status, "complete");
    assert.equal(profile.filter_version_accepted, true);
    assert.equal(profile.normalized_title, "Acme Heating & Cooling");
    assert.deepEqual(profile.phone_candidates, ["775-555-0100"]);
    assert.ok(profile.service_candidates.includes("Air Conditioning Repair"));
    assert.ok(profile.service_area_candidates.includes("Reno"));
    assert.ok(profile.description_candidate.includes("Acme Heating & Cooling provides"));
    assert.ok(profile.about_source_excerpt.includes("served Reno and Sparks since 1985"));
    assert.equal(profile.photo_candidates.length, 2);
    assert.equal(profile.photo_candidates[0].same_site, true);
    assert.ok(profile.completeness_score >= 90);

    const summary = summarizeEnrichmentSnapshot(snapshot);
    assert.equal(summary.profilesByEvidenceStatus.complete, 1);
    assert.equal(summary.acceptedFilterProfileCount, 1);
    assert.equal(summary.photoCandidateCount, 2);
    assert.equal(summary.canonicalListingWrites, false);
  });
});

test("preserves superseded raw evidence without turning it into a profile proposal", async () => {
  await withFixture(async (root) => {
    const snapshot = await buildEnrichmentSnapshot(root);
    const superseded = snapshot.artifacts.find((artifact) => artifact.is_superseded);
    assert.ok(superseded);
    assert.equal(superseded.artifact_kind, "listing_receipt");
    assert.equal(snapshot.profiles.length, 1);
    assert.notEqual(snapshot.profiles[0].domain, "old.example");
  });
});

test("filter-v2 evidence remains private and is never accepted for publication review", async () => {
  await withFixture(
    async (root) => {
      const snapshot = await buildEnrichmentSnapshot(root);
      assert.equal(snapshot.profiles[0].evidence_status, "complete");
      assert.equal(snapshot.profiles[0].filter_version_accepted, false);
      assert.equal(summarizeEnrichmentSnapshot(snapshot).acceptedFilterProfileCount, 0);
    },
    { filterVersion: "business-controlled-domain-v2" },
  );
});

test("photo extraction rejects widgets and retains exact source provenance", () => {
  const photos = extractPhotoCandidates(
    [
      {
        url: "https://shop.example/gallery",
        markdown:
          "![Project](https://shop.example/uploads/project.webp)\n![Spinner](https://cdn.userway.org/spin.svg)",
      },
    ],
    "shop.example",
  );
  assert.deepEqual(photos, [
    {
      image_url: "https://shop.example/uploads/project.webp",
      source_page_url: "https://shop.example/gallery",
      alt_text: "Project",
      role_candidate: "gallery",
      same_site: true,
      evidence_score: 110,
    },
  ]);
});

test("archive hashes original UTF-8 bytes and rejects invalid bytes without leaking payload", async () => {
  await withFixture(async (root) => {
    const { createHash } = await import("node:crypto");
    const bytes = Buffer.from('{"label":"Reno café"}\n');
    await writeFile(join(root, "progress.json"), bytes);
    const artifact = (await buildEnrichmentSnapshot(root)).artifacts.find(
      (a) => a.relative_path === "progress.json",
    );
    assert.equal(artifact.content_sha256, createHash("sha256").update(bytes).digest("hex"));
    assert.equal(artifact.byte_count, bytes.length);
    assert.deepEqual(Buffer.from(artifact.raw_text), bytes);
    await writeFile(join(root, "progress.json"), Buffer.from([0x7b, 0xff, 0x7d]));
    await assert.rejects(buildEnrichmentSnapshot(root), {
      message: "Artifact is not valid UTF-8: progress.json",
    });
    await writeFile(join(root, "progress.json"), "{private-provider-secret");
    await assert.rejects(buildEnrichmentSnapshot(root), {
      message: "Artifact is not valid JSON: progress.json",
    });
  });
});
