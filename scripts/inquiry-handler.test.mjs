import { test } from "node:test";
import assert from "node:assert/strict";
import { handleInquiry } from "../src/lib/directory/inquiry-handler.mjs";
const id = "83000000-0000-4000-8000-000000000001";
const env = {
  LOCAL775_INQUIRIES_ENABLED: "true",
  TURNSTILE_SECRET_KEY: "test-only",
  TURNSTILE_SITE_KEY: "test-public",
  INQUIRY_ABUSE_SECRET: "test-only-hash-key",
  SUPABASE_SERVICE_ROLE_KEY: "test-only-not-a-real-key",
  SUPABASE_PUBLISHABLE_KEY: "test-public-key",
  SUPABASE_URL: "https://test.supabase.co",
  LOCAL775_PUBLIC_ORIGIN: "https://775directory.com",
};
const data = {
  listingId: id,
  key: "83000000-0000-4000-8000-000000000002",
  name: "Test resident",
  email: "test@example.com",
  phone: "7753339880",
  zip: "89502",
  message: "Please help with a repair.",
  consent: true,
  token: "test-token",
  company: "",
};
const request = (body = data, origin = env.LOCAL775_PUBLIC_ORIGIN) =>
  new Request(origin + "/api/inquiries", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
test("disabled inquiries and cross-origin submissions never reach providers", async () => {
  const fetchImpl = () => {
    throw new Error("must not fetch");
  };
  assert.equal((await handleInquiry(request(), { env: {}, fetchImpl })).status, 503);
  assert.equal(
    (await handleInquiry(request(data, "https://evil.example"), { env, fetchImpl })).status,
    403,
  );
});
test("intake rejects missing consent, bots, malformed contacts and excessive bodies", async () => {
  for (const change of [
    { consent: false },
    { company: "spam" },
    { phone: "+117753339880" },
    { zip: "89431" },
    { token: "" },
    { name: "X".repeat(17000) },
  ]) {
    const response = await handleInquiry(request({ ...data, ...change }), {
      env,
      fetchImpl: () => {
        throw new Error("must not fetch");
      },
    });
    assert.ok([400, 413].includes(response.status));
  }
});
test("challenge failure, wrong hostname and wrong action cannot write a lead", async () => {
  for (const validation of [
    { success: false },
    { success: true, hostname: "evil.example", action: "reno-inquiry" },
    { success: true, hostname: "775directory.com", action: "other" },
  ]) {
    let calls = 0;
    const response = await handleInquiry(request(), {
      env,
      fetchImpl: async () => {
        calls++;
        return Response.json(validation);
      },
    });
    assert.equal(response.status, 400);
    assert.equal(calls, 1);
  }
});
test("accepted inquiry requires a durable receipt and never claims delivery", async () => {
  let body;
  const response = await handleInquiry(request(), {
    env,
    fetchImpl: async (url, init) => {
      if (String(url).includes("siteverify"))
        return Response.json({
          success: true,
          hostname: "775directory.com",
          action: "reno-inquiry",
        });
      body = JSON.parse(init.body);
      return Response.json({ id, status: "received" });
    },
  });
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { id, status: "received" });
  assert.equal(body.requested_payload.phone, "+17753339880");
  assert.match(body.requested_abuse_key, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(body).includes("test-token"), false);
});
test("database rejection never becomes a success or exposes provider details", async () => {
  const response = await handleInquiry(request(), {
    env,
    fetchImpl: async (url) =>
      String(url).includes("siteverify")
        ? Response.json({ success: true, hostname: "775directory.com", action: "reno-inquiry" })
        : Response.json({ message: "private destination secret" }, { status: 500 }),
  });
  assert.equal(response.status, 503);
  assert.equal((await response.text()).includes("private destination"), false);
});

test("missing or blank inquiry publishable key fails closed before provider calls", async () => {
  for (const key of [undefined, "", "  "]) {
    let calls = 0;
    const response = await handleInquiry(request(), {
      env: { ...env, SUPABASE_PUBLISHABLE_KEY: key },
      fetchImpl: async () => {
        calls++;
        throw new Error("must not fetch");
      },
    });
    assert.equal(response.status, 503);
    assert.equal(calls, 0);
  }
});
