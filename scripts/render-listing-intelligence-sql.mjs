#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const [operation, file, ...rest] = process.argv.slice(2);
if (!operation || !file) {
  throw new Error("usage: OPERATION FILE [capture-id] [page-start] [page-count]");
}
const record = JSON.parse(await readFile(resolve(file), "utf8"));
const sqlText = (value) => `'${String(value).replaceAll("'", "''")}'`;
const nullableText = (value) => (value == null || value === "" ? "null" : sqlText(value));
const jsonb = (value) => `${sqlText(JSON.stringify(value))}::jsonb`;
const bool = (value) => (value ? "true" : "false");
const number = (value) => (value == null ? "null" : String(Number(value)));

if (operation === "register") {
  process.stdout.write(
    `select public.register_listing_intelligence_sources(${sqlText(record.requested_listing_id)}::uuid, ${jsonb(record.requested_sources)}) as sources;\n`,
  );
} else if (operation === "begin") {
  const p = record.begin;
  process.stdout.write(`select json_build_object('capture_id', public.begin_listing_source_capture(
    ${sqlText(p.requested_listing_id)}::uuid, ${sqlText(p.requested_idempotency_key)},
    ${sqlText(p.requested_source_url)}, ${sqlText(p.requested_source_kind)}, ${nullableText(p.requested_provider_job_id)},
    ${sqlText(p.requested_terminal_status)}, ${sqlText(p.requested_completeness_basis)},
    ${number(p.requested_expected_page_count)}, ${number(p.requested_discovered_page_count)}, ${number(p.requested_failed_page_count)},
    ${number(p.requested_page_limit)}, ${bool(p.requested_hit_page_limit)}, ${bool(p.requested_pagination_drained)},
    ${bool(p.requested_robots_respected)}, ${sqlText(p.requested_manifest_sha256)}, ${jsonb(p.requested_crawl_config)},
    ${jsonb(p.requested_completeness_blockers)}, ${number(p.requested_credits_used)},
    ${sqlText(p.requested_started_at)}::timestamptz, ${sqlText(p.requested_finished_at)}::timestamptz
  )) as result;\n`);
} else if (operation === "pages") {
  const captureId = Number(rest[0]);
  const start = Number(rest[1] ?? 0);
  const count = Number(rest[2] ?? 1);
  if (!Number.isInteger(captureId) || captureId < 1) throw new Error("valid capture id required");
  const pages = record.pages.slice(start, start + count);
  if (pages.length === 0 || pages.length > 25)
    throw new Error("page slice must contain 1 to 25 pages");
  process.stdout.write(
    `select public.ingest_listing_source_capture_pages(${captureId}::bigint, ${jsonb(pages)}) as inserted_pages;\n`,
  );
} else if (operation === "finalize") {
  const captureId = Number(rest[0]);
  if (!Number.isInteger(captureId) || captureId < 1) throw new Error("valid capture id required");
  const facts = structuredClone(record.finalize.requested_facts);
  if (facts.topServiceOffering == null) delete facts.topServiceOffering;
  process.stdout.write(
    `select public.finalize_listing_source_capture(${captureId}::bigint, ${sqlText(record.finalize.requested_extractor_version)}, ${jsonb(facts)}) as result;\n`,
  );
} else if (operation === "audit") {
  const p = record.payload;
  const captureId = p.requested_capture_id == null
    ? `(select id from private.listing_source_captures
       where listing_id = ${sqlText(p.requested_listing_id)}::uuid
         and source_url = ${sqlText(p.requested_target_url)}
         and source_kind = 'website'
         and ingestion_status = 'finalized'
       order by recorded_at desc, id desc limit 1)`
    : `${number(p.requested_capture_id)}::bigint`;
  process.stdout.write(`select json_build_object('audit_id', public.record_listing_seo_audit(
    ${sqlText(p.requested_listing_id)}::uuid, ${captureId},
    ${sqlText(p.requested_idempotency_key)}, ${sqlText(p.requested_target_url)}, ${nullableText(p.requested_provider_task_id)},
    ${sqlText(p.requested_terminal_status)}, ${number(p.requested_max_crawl_pages)}, ${number(p.requested_crawled_pages)},
    ${nullableText(p.requested_crawl_progress)}, ${number(p.requested_onpage_score)}, ${number(p.requested_cost_usd)},
    ${jsonb(p.requested_request_config)}, ${jsonb(p.requested_audit_summary)}, ${jsonb(p.requested_limitations)},
    ${jsonb(p.requested_artifacts)}, ${sqlText(p.requested_started_at)}::timestamptz, ${sqlText(p.requested_finished_at)}::timestamptz
  )) as result;\n`);
} else {
  throw new Error(`unknown operation: ${operation}`);
}
