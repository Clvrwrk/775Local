import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  indexNowPayload,
  runIndexNowSubmission,
  sitemapUrls,
  submitIndexNow,
} from "./submit-indexnow.mjs";

test("IndexNow publishes a valid same-host key and submits only sitemap canonicals", async () => {
  const { renderSitemap } = await import("../src/lib/directory/sitemap.mjs");
  const sitemap = renderSitemap([]);
  const urls = sitemapUrls(sitemap);
  const payload = indexNowPayload(urls);
  const keyFile = await readFile(new URL(`../public/${payload.key}.txt`, import.meta.url), "utf8");

  assert.equal(keyFile.trim(), payload.key);
  assert.match(payload.key, /^[a-f0-9]{32}$/);
  assert.equal(payload.host, "775directory.com");
  assert.equal(payload.keyLocation, `https://775directory.com/${payload.key}.txt`);
  assert.ok(urls.length > 0);
  assert.ok(urls.every((url) => url.startsWith("https://775directory.com/")));
  assert.deepEqual(urls, [...new Set(urls)]);
});

test("IndexNow refuses an empty sitemap", () => {
  assert.throws(() => indexNowPayload([]), /did not contain any canonical URLs/);
});

test("IndexNow enforces the 10,000 URL provider limit", () => {
  const urls = Array.from(
    { length: 10_000 },
    (_, index) => `https://775directory.com/indexnow-boundary-${index}`,
  );

  assert.equal(indexNowPayload(urls).urlList.length, 10_000);
  assert.throws(
    () => indexNowPayload([...urls, "https://775directory.com/indexnow-over-limit"]),
    /at most 10000 URLs per request/,
  );
});

test("IndexNow preserves a failure receipt when the provider request rejects", async () => {
  const urls = ["https://775directory.com/"];
  const receipt = await submitIndexNow(urls, {
    fetchImpl: async () => {
      throw new Error("provider unavailable");
    },
    now: () => new Date("2026-08-29T15:30:00.000Z"),
  });

  assert.deepEqual(receipt, {
    submittedAt: "2026-08-29T15:30:00.000Z",
    endpoint: "https://api.indexnow.org/indexnow",
    host: "775directory.com",
    keyLocation: "https://775directory.com/738605bcc41cbc13f8943448c1bdae49.txt",
    urlCount: 1,
    urlList: urls,
    status: null,
    accepted: false,
    responseBody: null,
    failure: "request_or_response_read_failed",
  });
});

test("IndexNow preserves a failure receipt when the sitemap is empty", async () => {
  const receipt = await runIndexNowSubmission({
    readFileImpl: async () => "<urlset></urlset>",
    now: () => new Date("2026-08-29T15:35:00.000Z"),
  });

  assert.deepEqual(receipt, {
    submittedAt: "2026-08-29T15:35:00.000Z",
    endpoint: "https://api.indexnow.org/indexnow",
    host: "775directory.com",
    keyLocation: "https://775directory.com/738605bcc41cbc13f8943448c1bdae49.txt",
    urlCount: 0,
    urlList: [],
    status: null,
    accepted: false,
    responseBody: null,
    failure: "sitemap_read_or_validation_failed",
  });
});

test("sitemap fetch failures retain their stage and never submit to IndexNow", async () => {
  for (const response of [null, new Response("unavailable", { status: 503 })]) {
    let calls = 0;
    const receipt = await runIndexNowSubmission({
      fetchImpl: async (url) => {
        calls++;
        assert.equal(url, "https://775directory.com/sitemap.xml");
        if (!response) throw new Error("private transport details");
        return response;
      },
    });
    assert.equal(calls, 1);
    assert.equal(receipt.failure, "sitemap_fetch_failed");
    assert.equal(receipt.accepted, false);
  }
  const receipt = await runIndexNowSubmission({
    fetchImpl: async () => new Response("<urlset></urlset>"),
  });
  assert.equal(receipt.failure, "sitemap_read_or_validation_failed");
});
