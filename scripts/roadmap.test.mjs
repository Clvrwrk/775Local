import assert from "node:assert/strict";
import { test } from "node:test";
import { publicRoadmap, feedbackPayload } from "../src/lib/directory/roadmap.mjs";
import { submitFeedback } from "../src/lib/supabase/feedback-commands.mjs";
const input = {
  kind: "bug",
  title: "Search result issue",
  details: "Synthetic search results do not load after selecting a category.",
  consent: true,
  key: "feedback-fixture-0001",
  company: "",
};
test("roadmap returns only curated public fields and claims no release or dates", () => {
  const entries = publicRoadmap();
  assert.ok(entries.length >= 5);
  assert.ok(entries.every((x) => x.status !== "released"));
  const [entry] = publicRoadmap([
    {
      ...entries[0],
      contact: "private@example.test",
      comments: "private",
      securityReport: "private",
      issueId: "private",
    },
  ]);
  assert.deepEqual(Object.keys(entry).sort(), ["slug", "status", "summary", "title"]);
  assert.throws(() => publicRoadmap([{ ...entry, status: "secret" }]), /invalid_curated/);
});
test("feedback validates bounded text, consent, retry identity and no files/contact fields", () => {
  assert.equal(feedbackPayload(input).payload.kind, "bug");
  for (const patch of [
    { consent: false },
    { kind: "security" },
    { title: "a" },
    { details: "short" },
    { details: "a".repeat(3001) },
    { title: "hello\u0000world" },
    { email: "private@example.test" },
    { file: "private" },
    { company: "spam" },
    { key: "bad" },
  ])
    assert.throws(() => feedbackPayload({ ...input, ...patch }), /invalid_feedback/);
});
test("feedback uses only protected authenticated target, sanitizes errors and rejects incomplete receipts", async () => {
  const options = {
    accessToken: "fixture-token",
    env: {
      SUPABASE_URL: "https://fixture.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_123456789",
    },
    fetchImpl: async (url, init) => {
      assert.equal(url.pathname, "/rest/v1/rpc/submit_directory_feedback");
      assert.equal(init.headers.Authorization, "Bearer fixture-token");
      assert.equal(JSON.parse(init.body).requested_payload.consent, true);
      return Response.json({
        id: "b6000000-0000-4000-8000-000000000001",
        status: "pending_review",
      });
    },
  };
  assert.equal((await submitFeedback(input, options)).ok, true);
  assert.equal(
    (
      await submitFeedback(input, {
        ...options,
        accessToken: "",
        fetchImpl: async () => assert.fail("no unauthenticated provider call"),
      })
    ).code,
    "authentication_required",
  );
  assert.equal(
    (
      await submitFeedback(input, {
        ...options,
        fetchImpl: async () =>
          Response.json({ message: "secret database detail" }, { status: 500 }),
      })
    ).code,
    "feedback_not_confirmed",
  );
  assert.equal(
    (
      await submitFeedback(input, {
        ...options,
        fetchImpl: async () => Response.json({ message: "feedback_rate_limited" }, { status: 400 }),
      })
    ).code,
    "feedback_rate_limited",
  );
  assert.equal(
    (
      await submitFeedback(input, {
        ...options,
        fetchImpl: async () => Response.json({ status: "delivered" }),
      })
    ).code,
    "feedback_not_confirmed",
  );
});
