import { createHash } from "node:crypto";
const MAX_BYTES = 5 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPES = new Set(["application/pdf", "image/png", "image/jpeg"]);
const digest = (/** @type {Uint8Array} */ bytes) =>
  createHash("sha256").update(bytes).digest("hex");
const failure = (/** @type {string} */ code) => ({ ok: false, code });
/** This continuation has no live adapters or activation flag. Magic bytes are only a prefilter.
 * Safe decoding and scanning are separate, required contracts; test fakes do not certify files.
 * @param {any} [options]
 */
export function createSyntheticProofService(options = {}) {
  const { gateway, objects, scanner, decoder, timeoutMs = 5000 } = options;
  const ready =
    [gateway, objects, scanner, decoder].every((x) => x?.mode === "synthetic") &&
    [
      gateway?.reserve,
      gateway?.acquire,
      gateway?.finish,
      gateway?.authorizeDownload,
      gateway?.describe,
      gateway?.leaseDeletions,
      gateway?.confirmDeletion,
      objects?.put,
      objects?.read,
      objects?.delete,
      objects?.tombstone,
      scanner?.scan,
      decoder?.validate,
    ].every((x) => typeof x === "function") &&
    objects?.supportsTombstones === true;
  /** @param {(signal: AbortSignal) => Promise<any>} run */
  async function bounded(run) {
    let timer;
    const controller = new AbortController();
    try {
      return await Promise.race([
        run(controller.signal),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(Error("timeout"));
          }, timeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    /** @param {any} input @param {Uint8Array} bytes @param {string} session */
    async submit(input, bytes, session) {
      if (!session) return failure("authentication_required");
      if (!ready) return failure("proof_service_unavailable");
      if (
        !input ||
        !UUID.test(input.claimId ?? "") ||
        !UUID.test(input.challenge ?? "") ||
        !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/.test(input.key ?? "") ||
        typeof input.explanation !== "string" ||
        input.explanation.trim().length < 20 ||
        input.explanation.trim().length > 4000 ||
        !TYPES.has(input.mediaType) ||
        !(bytes instanceof Uint8Array) ||
        bytes.length < 8 ||
        bytes.length > MAX_BYTES
      )
        return failure("invalid_claim_proof");
      const prefix = Buffer.from(bytes.subarray(0, 8));
      const matches =
        input.mediaType === "application/pdf"
          ? prefix.toString("ascii").startsWith("%PDF-")
          : input.mediaType === "image/png"
            ? prefix.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            : prefix[0] === 255 && prefix[1] === 216 && prefix[2] === 255;
      if (!matches) return failure("invalid_claim_proof");
      // Copy before any await so callers cannot replace the bytes after hashing/reservation.
      const immutableBytes = Uint8Array.from(bytes);
      const sha256 = digest(immutableBytes);
      /** @type {any} */
      let job;
      try {
        const reserved = await bounded(() =>
          gateway.reserve(session, { ...input, sha256, byteSize: immutableBytes.length }),
        );
        job = await bounded(() => gateway.acquire(reserved.id));
        if (job.mode !== "synthetic" || job.sha256 !== sha256 || job.mediaType !== input.mediaType)
          throw Error("invalid_job");
        if (job.status === "synthetic_clean")
          return {
            ok: true,
            receipt: { id: job.id, status: job.status, mode: "synthetic", idempotent: true },
          };
        if (job.status !== "processing" || !job.lease || !job.path)
          return failure("proof_processing_busy");
        // Adapter commits must atomically check cancellation and permanent path tombstones.
        await bounded((signal) =>
          objects.put(job.path, immutableBytes, sha256, { signal, lease: job.lease }),
        );
        const scan = await bounded((signal) =>
          scanner.scan(immutableBytes, { sha256, mediaType: input.mediaType, signal }),
        );
        const signaturesAt = Date.parse(scan?.signaturesAt);
        if (
          !scan ||
          scan.verdict !== "clean" ||
          scan.sha256 !== sha256 ||
          typeof scan.engine !== "string" ||
          scan.engine.length < 1 ||
          scan.engine.length > 80 ||
          typeof scan.version !== "string" ||
          scan.version.length < 1 ||
          scan.version.length > 80 ||
          !Number.isFinite(signaturesAt) ||
          signaturesAt > Date.now() + 60000 ||
          Date.now() - signaturesAt > 7 * 86400000
        ) {
          await bounded(() =>
            gateway.finish(job.id, job.lease, {
              status: scan?.verdict === "infected" ? "rejected" : "unavailable",
            }),
          );
          return failure("proof_processing_failed");
        }
        const decoded = await bounded((signal) =>
          decoder.validate(immutableBytes, { sha256, mediaType: input.mediaType, signal }),
        );
        const safeDimensions =
          input.mediaType === "application/pdf"
            ? Number.isInteger(decoded?.pages) && decoded.pages >= 1 && decoded.pages <= 20
            : Number.isInteger(decoded?.width) &&
              Number.isInteger(decoded?.height) &&
              decoded.width >= 1 &&
              decoded.height >= 1 &&
              decoded.width <= 8000 &&
              decoded.height <= 8000 &&
              decoded.width * decoded.height <= 20000000;
        if (
          decoded?.valid !== true ||
          decoded.sha256 !== sha256 ||
          decoded.mediaType !== input.mediaType ||
          !safeDimensions
        ) {
          await bounded(() => gateway.finish(job.id, job.lease, { status: "rejected" }));
          return failure("proof_processing_failed");
        }
        const receipt = await bounded(() =>
          gateway.finish(job.id, job.lease, {
            status: "synthetic_clean",
            sha256,
            engine: scan.engine,
            version: scan.version,
            signaturesAt: scan.signaturesAt,
            decoded:
              input.mediaType === "application/pdf"
                ? { pages: decoded.pages }
                : { width: decoded.width, height: decoded.height },
          }),
        );
        return { ok: true, receipt };
      } catch {
        if (job?.lease && job.mode === "synthetic") {
          try {
            await bounded(() => gateway.finish(job.id, job.lease, { status: "unavailable" }));
          } catch {
            /* lease expiry/retry retains quarantine */
          }
        }
        return failure("proof_processing_failed");
      }
    },
    /** @param {string} proofId @param {string} session */
    async download(proofId, session) {
      if (!session) return failure("authentication_required");
      if (!ready) return failure("proof_service_unavailable");
      try {
        const authorized = await bounded(() => gateway.authorizeDownload(session, proofId));
        const job = await bounded(() => gateway.describe(authorized.id));
        if (
          job.mode !== "synthetic" ||
          job.status !== "synthetic_clean" ||
          job.sha256 !== authorized.sha256 ||
          job.mediaType !== authorized.mediaType ||
          !TYPES.has(job.mediaType)
        )
          throw Error("unavailable");
        const bytes = await bounded((signal) => objects.read(job.path, { signal }));
        if (
          !(bytes instanceof Uint8Array) ||
          bytes.length > MAX_BYTES ||
          digest(bytes) !== job.sha256
        )
          throw Error("integrity");
        // Recheck after storage I/O to catch withdrawal, revocation, expiry and deletion races.
        await bounded(() => gateway.authorizeDownload(session, proofId));
        return { ok: true, bytes, mediaType: job.mediaType };
      } catch {
        return failure("proof_unavailable");
      }
    },
    async deleteDue() {
      if (!ready) return failure("proof_service_unavailable");
      let deleted = 0,
        failed = 0;
      try {
        const jobs = await bounded(() => gateway.leaseDeletions());
        if (!Array.isArray(jobs) || jobs.length > 100) throw Error("invalid_jobs");
        for (const job of jobs) {
          if (job.mode !== "synthetic" || !job.path || !job.lease) {
            failed++;
            continue;
          }
          try {
            // Tombstones must persist and atomically reject even late writes after timeout.
            await bounded((signal) => objects.tombstone(job.path, { signal }));
            await bounded((signal) => objects.delete(job.path, { signal })); // Already-absent is success.
            await bounded(() => gateway.confirmDeletion(job.id, job.lease));
            deleted++;
          } catch {
            failed++;
          }
        }
        return { ok: true, receipt: { deleted, failed, mode: "synthetic" } };
      } catch {
        return failure("proof_deletion_failed");
      }
    },
  };
}
/** Injectable HTTP seam for isolated local fixtures only; no app route activates it.
 * @param {Request} request @param {any} options
 */
export async function handleProofRequest(request, options) {
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'",
    "Referrer-Policy": "no-referrer",
  };
  const json = (/** @type {any} */ body, /** @type {number} */ status) =>
    Response.json(body, { status, headers });
  let session;
  try {
    session = await options.authenticate?.(request);
  } catch {
    /* closed */
  }
  if (!session) return json(failure("authentication_required"), 401);
  if (!options.service) return json(failure("proof_service_unavailable"), 503);
  if (request.method === "GET") {
    const result = await options.service.download(options.proofId, session);
    if (!result.ok) return json(result, 404);
    const extension =
      result.mediaType === "application/pdf"
        ? "pdf"
        : result.mediaType === "image/png"
          ? "png"
          : "jpg";
    return new Response(result.bytes, {
      headers: {
        ...headers,
        "Content-Type": result.mediaType,
        "Content-Disposition": `attachment; filename="synthetic-claim-proof.${extension}"`,
      },
    });
  }
  if (request.method !== "POST") return json(failure("method_not_allowed"), 405);
  const reader = request.body?.getReader();
  if (!reader) return json(failure("invalid_claim_proof"), 400);
  let size = 0;
  const chunks = [];
  const deadline = Date.now() + Math.max(1, Math.min(options.bodyTimeoutMs ?? 5000, 10000));
  let bodyTimer;
  try {
    while (true) {
      const chunk = await Promise.race([
        reader.read(),
        new Promise((_, reject) => {
          bodyTimer = setTimeout(
            () => reject(Error("body_timeout")),
            Math.max(0, deadline - Date.now()),
          );
        }),
      ]);
      clearTimeout(bodyTimer);
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > MAX_BYTES) {
        void reader.cancel().catch(() => {});
        return json(failure("invalid_claim_proof"), 413);
      }
      chunks.push(chunk.value);
    }
  } catch {
    void reader.cancel().catch(() => {});
    return json(failure("invalid_claim_proof"), 400);
  } finally {
    clearTimeout(bodyTimer);
  }
  const result = await options.service.submit(options.input, Buffer.concat(chunks), session);
  return json(result, result.ok ? 200 : 400);
}
