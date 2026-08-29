import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

async function config() {
  return JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
}

test("www permanently redirects to the canonical apex without affecting apex requests", async () => {
  const value = await config();
  const redirect = value.redirects.find((entry) => entry.destination === "https://775directory.com/:path*");
  assert.deepEqual(redirect, {
    source: "/:path*",
    destination: "https://775directory.com/:path*",
    permanent: true,
    has: [{ type: "host", value: "www.775directory.com" }],
  });
});

test("public vercel.app aliases are explicitly noindex", async () => {
  const value = await config();
  const rule = value.headers.find((entry) => entry.has?.some((condition) => condition.type === "host"));
  assert.deepEqual(rule.headers, [{ key: "X-Robots-Tag", value: "noindex" }]);
  assert.equal(rule.has[0].value, ".*\\.vercel\\.app");
});
