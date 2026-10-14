import test from "node:test";
import assert from "node:assert/strict";
import {
  createSyntheticProofService,
  handleProofRequest,
} from "../src/lib/directory/claim-proof-processing.mjs";
const input = {
  claimId: "10000000-0000-4000-8000-000000000001",
  challenge: "10000000-0000-4000-8000-000000000002",
  key: "proof-fixture-0001",
  mediaType: "application/pdf",
  explanation: "Synthetic authorization letter for this exact location.",
};
const bytes = Buffer.from("%PDF-1.7\nSynthetic fixture only\n%%EOF");
function fixture() {
  const calls = [];
  let record = {
    id: "proof-1",
    status: "processing",
    mode: "synthetic",
    path: "private-generated-key",
    lease: "lease-1",
    sha256: null,
    mediaType: "application/pdf",
  };
  const gateway = {
    mode: "synthetic",
    reserve: async (s, i) => {
      calls.push(["reserve", s, i]);
      record.sha256 = i.sha256;
      return { id: record.id };
    },
    acquire: async () => record,
    finish: async (id, lease, outcome) => {
      calls.push(["finish", outcome]);
      record = { ...record, status: outcome.status };
      return { id, status: record.status, mode: "synthetic" };
    },
    authorizeDownload: async () => ({
      id: record.id,
      sha256: record.sha256,
      mediaType: record.mediaType,
    }),
    describe: async () => record,
    leaseDeletions: async () => [{ ...record, lease: "delete-lease", mode: "synthetic" }],
    confirmDeletion: async () => {
      calls.push(["deleted"]);
      return true;
    },
  };
  const tombstones = new Set();
  const objects = {
    mode: "synthetic",
    supportsTombstones: true,
    tombstone: async (key) => {
      tombstones.add(key);
      calls.push(["tombstone"]);
    },
    put: async () => calls.push(["put"]),
    read: async () => bytes,
    delete: async () => calls.push(["delete"]),
  };
  const scanner = {
    mode: "synthetic",
    scan: async (b, { sha256 }) => ({
      verdict: "clean",
      sha256,
      engine: "fixture",
      version: "1",
      signaturesAt: new Date().toISOString(),
    }),
  };
  const decoder = {
    mode: "synthetic",
    validate: async (b, { sha256, mediaType }) => ({ valid: true, sha256, mediaType, pages: 1 }),
  };
  return {
    gateway,
    objects,
    scanner,
    decoder,
    calls,
    tombstones,
    get record() {
      return record;
    },
  };
}
test("proof service unavailable without explicit synthetic adapters; no side effects", async () => {
  const service = createSyntheticProofService();
  assert.deepEqual(await service.submit(input, bytes, "session"), {
    ok: false,
    code: "proof_service_unavailable",
  });
  assert.deepEqual(await service.deleteDue(), { ok: false, code: "proof_service_unavailable" });
});
test("synthetic clean receipt binds server-computed bytes and stays explicitly synthetic", async () => {
  const f = fixture();
  const r = await createSyntheticProofService(f).submit(input, bytes, "session");
  assert.equal(r.ok, true);
  assert.equal(r.receipt.status, "synthetic_clean");
  assert.equal(r.receipt.mode, "synthetic");
  assert.equal(f.calls[0][2].sha256.length, 64);
  assert.ok(f.calls.find((x) => x[0] === "put"));
});
test("unavailable, infected, stale, mismatched and incomplete scan receipts fail closed", async () => {
  for (const result of [
    null,
    { verdict: "infected" },
    { verdict: "clean", sha256: "0".repeat(64) },
    {
      verdict: "clean",
      sha256: "wrong",
      engine: "fixture",
      version: "1",
      signaturesAt: "2020-01-01",
    },
  ]) {
    const f = fixture();
    f.scanner.scan = async () => result;
    const r = await createSyntheticProofService(f).submit(input, bytes, "session");
    assert.equal(r.ok, false);
    assert.notEqual(f.record.status, "synthetic_clean");
    assert.ok(f.calls.find((x) => x[0] === "finish"));
  }
});
test("magic bytes alone do not establish safe decoding; malformed/oversize/type rejected", async () => {
  const f = fixture();
  f.decoder.validate = async () => ({ valid: false });
  assert.equal((await createSyntheticProofService(f).submit(input, bytes, "s")).ok, false);
  for (const [data, body] of [
    [input, Buffer.alloc(5 * 1024 * 1024 + 1)],
    [{ ...input, mediaType: "text/html" }, bytes],
    [input, Buffer.from("<script>bad</script>")],
  ]) {
    const f2 = fixture();
    assert.equal((await createSyntheticProofService(f2).submit(data, body, "s")).ok, false);
    assert.equal(f2.calls.length, 0);
  }
});
test("timeout does not finalize clean or expose adapter error details", async () => {
  const f = fixture();
  f.scanner.scan = () => new Promise(() => {});
  const r = await createSyntheticProofService({ ...f, timeoutMs: 5 }).submit(input, bytes, "s");
  assert.deepEqual(r, { ok: false, code: "proof_processing_failed" });
  assert.equal(f.record.status, "unavailable");
});
test("download requires authorization and integrity; redacts failures", async () => {
  const f = fixture();
  const service = createSyntheticProofService(f);
  await service.submit(input, bytes, "s");
  assert.equal((await service.download("proof-1", "s")).ok, true);
  f.gateway.authorizeDownload = async () => {
    throw Error("private claimant path");
  };
  assert.deepEqual(await service.download("proof-1", "other"), {
    ok: false,
    code: "proof_unavailable",
  });
});
test("deletion confirms only after object delete, retries and rejects non-synthetic jobs", async () => {
  const f = fixture();
  f.objects.delete = async () => {
    throw Error("private bucket failure");
  };
  const service = createSyntheticProofService(f);
  assert.equal((await service.deleteDue()).receipt.deleted, 0);
  assert.equal(
    f.calls.some((x) => x[0] === "deleted"),
    false,
  );
  f.objects.delete = async () => f.calls.push(["delete"]);
  assert.equal((await service.deleteDue()).receipt.deleted, 1);
  assert.ok(
    f.calls.findIndex((x) => x[0] === "delete") < f.calls.findIndex((x) => x[0] === "deleted"),
  );
  f.gateway.leaseDeletions = async () => [{ id: "real", mode: "live" }];
  assert.equal((await service.deleteDue()).receipt.deleted, 0);
});
test("HTTP boundary requires identity and never exposes proof bytes on failure", async () => {
  const req = new Request("http://localhost/proof", {
    method: "POST",
    headers: { "content-type": "application/pdf" },
    body: bytes,
  });
  const r = await handleProofRequest(req, {});
  assert.equal(r.status, 401);
  assert.equal((await r.json()).code, "authentication_required");
  const r2 = await handleProofRequest(new Request("http://localhost/proof", { method: "GET" }), {
    authenticate: async () => "s",
  });
  assert.equal(r2.status, 503);
  assert.match(r2.headers.get("cache-control"), /no-store/);
});

test("decoder enforces twenty PDF pages and twenty megapixels", async () => {
  const f = fixture();
  const validate = f.decoder.validate;
  f.decoder.validate = async (...args) => ({ ...(await validate(...args)), pages: 21 });
  assert.equal((await createSyntheticProofService(f).submit(input, bytes, "s")).ok, false);
  const image = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  f.decoder.validate = async (b, { sha256, mediaType }) => ({
    valid: true,
    sha256,
    mediaType,
    width: 5000,
    height: 4001,
  });
  assert.equal(
    (await createSyntheticProofService(f).submit({ ...input, mediaType: "image/png" }, image, "s"))
      .ok,
    false,
  );
});
test("timeout aborts write; deletion tombstone prevents a delayed orphan", async () => {
  const f = fixture();
  const stored = new Map();
  let release, signal;
  f.objects.put = (key, b, hash, context) =>
    new Promise((resolve, reject) => {
      signal = context.signal;
      release = () => {
        if (signal.aborted || f.tombstones.has(key)) {
          reject(Error("cancelled"));
          return;
        }
        stored.set(key, b);
        resolve();
      };
    });
  f.objects.delete = async (key) => {
    stored.delete(key);
    f.calls.push(["delete"]);
  };
  const service = createSyntheticProofService({ ...f, timeoutMs: 5 });
  assert.equal((await service.submit(input, bytes, "s")).ok, false);
  assert.equal(signal.aborted, true);
  assert.equal((await service.deleteDue()).receipt.deleted, 1);
  release();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(stored.size, 0);
  assert.ok(
    f.calls.findIndex((x) => x[0] === "tombstone") < f.calls.findIndex((x) => x[0] === "delete"),
  );
  f.objects.supportsTombstones = false;
  assert.equal(
    (await createSyntheticProofService(f).submit(input, bytes, "s")).code,
    "proof_service_unavailable",
  );
});
test("HTTP body deadline cancels a stalled stream without submitting", async () => {
  let cancelled = false,
    submitted = false;
  const body = new ReadableStream({
    cancel() {
      cancelled = true;
    },
  });
  const r = await handleProofRequest(
    new Request("http://localhost/proof", { method: "POST", body, duplex: "half" }),
    {
      authenticate: async () => "s",
      bodyTimeoutMs: 5,
      service: {
        submit: async () => {
          submitted = true;
          return { ok: true };
        },
      },
    },
  );
  assert.equal(r.status, 400);
  assert.equal(cancelled, true);
  assert.equal(submitted, false);
});
