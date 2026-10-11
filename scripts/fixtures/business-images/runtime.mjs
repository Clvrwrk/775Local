import { createMediaDb } from "./db.mjs";
import {
  uploadBusinessImage,
  runBusinessImageCommand,
  serveBusinessImage,
  publishedBusinessImages,
} from "../../../src/lib/supabase/business-image-commands.mjs";
import { MAX_IMAGE_BYTES } from "../../../src/lib/directory/business-image-validation.mjs";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtemp, writeFile, readFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const rpcArgs = {
  begin_business_image: [
    "requested_id",
    "requested_listing_id",
    "requested_kind",
    "requested_alt",
    "requested_rights",
    "requested_source",
    "requested_sha",
    "requested_type",
    "requested_size",
    "requested_sanitized_sha",
    "requested_width",
    "requested_height",
  ],
  finish_business_image: ["requested_id"],
  business_image_workspace: ["requested_listing_id"],
  business_image_review_queue: [],
  inspect_business_image: ["requested_id"],
  decide_business_image: [
    "requested_id",
    "requested_decision",
    "requested_reason",
    "requested_rights_checked",
  ],
  published_business_images: ["requested_listing_id"],
  published_business_image: ["requested_id"],
};
export async function startMediaRuntime() {
  const { db, as } = await createMediaDb();
  const directory = await mkdtemp(join(tmpdir(), "775-image-fixture-"));
  let origin;
  let interruptFinish = false;
  let interruptDecision = false;
  let interruptStorage = false;
  let writerConfigured = true;
  const server = createServer(async (req, res) => {
    try {
      const chunks = [];
      let length = 0;
      for await (const chunk of req) {
        length += chunk.length;
        if (length > MAX_IMAGE_BYTES + 16 * 1024) {
          res.writeHead(413);
          res.end();
          return;
        }
        chunks.push(chunk);
      }
      const bytes = Buffer.concat(chunks);
      const url = new URL(req.url, origin);
      const identity =
        req.headers.apikey === "sb_secret_fixture_only_0000"
          ? "server_writer"
          : String(
              req.headers["x-fixture-identity"] ??
                req.headers.authorization?.replace(/^Bearer /, "") ??
                "",
            );
      if (url.pathname.startsWith("/rest/v1/rpc/")) {
        const rpc = url.pathname.split("/").at(-1);
        if (!Object.hasOwn(rpcArgs, rpc)) {
          res.writeHead(404);
          res.end();
          return;
        }
        const body = JSON.parse(bytes.toString() || "{}");
        const receipt = await as(
          identity,
          async (tx) =>
            (
              await tx.query(
                `select public.${rpc}(${rpcArgs[rpc].map((_, i) => "$" + (i + 1)).join(",")}) as receipt`,
                rpcArgs[rpc].map((k) => body[k]),
              )
            ).rows[0].receipt,
        );
        if (
          (rpc === "finish_business_image" && interruptFinish) ||
          (rpc === "decide_business_image" && interruptDecision)
        ) {
          interruptFinish = false;
          interruptDecision = false;
          res.destroy();
          return;
        }
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(receipt));
        return;
      }
      if (url.pathname.startsWith("/storage/v1/object/")) {
        const path = url.pathname.replace(
          /^\/storage\/v1\/object\/(authenticated\/)?business-images\//,
          "",
        );
        if (!/^[a-f0-9-]{36}\/(original|sanitized\.webp|approved\.webp)$/.test(path)) {
          res.writeHead(400);
          res.end();
          return;
        }
        if (req.method === "POST") {
          if (path.endsWith("/sanitized.webp") && interruptStorage) {
            interruptStorage = false;
            res.writeHead(503);
            res.end();
            return;
          }
          await as(identity, async (tx) => {
            await tx.query(
              `insert into storage.objects(bucket_id,name) values('business-images',$1)`,
              [path],
            );
            await mkdir(join(directory, path.split("/")[0]), { recursive: true });
            await writeFile(join(directory, path), bytes, { flag: "wx" });
          });
          res.end("{}");
          return;
        }
        const visible = await as(
          identity,
          async (tx) =>
            (
              await tx.query(
                `select name from storage.objects where bucket_id='business-images' and name=$1`,
                [path],
              )
            ).rows.length,
        );
        if (!visible) {
          res.writeHead(403);
          res.end();
          return;
        }
        res.setHeader("Content-Type", "image/webp");
        res.end(await readFile(join(directory, path)));
        return;
      }
      const options = {
        accessToken: identity,
        env: {
          SUPABASE_URL: "https://fixture.supabase.co",
          SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic_fixture_only",
          SUPABASE_MEDIA_WRITER_KEY: writerConfigured
            ? "sb_secret_fixture_only_0000"
            : "",
          BUSINESS_IMAGE_UPLOAD_ENABLED: "true",
        },
        fetchImpl: (target, init) => fetch(new URL(new URL(target).pathname, origin), init),
      };
      let result;
      if (url.pathname === "/fixture/upload") {
        const form = await new Request(origin, {
          method: "POST",
          headers: { "Content-Type": String(req.headers["content-type"]) },
          body: bytes,
        }).formData();
        result = await uploadBusinessImage(form, options);
      } else if (url.pathname === "/fixture/command")
        result = await runBusinessImageCommand(JSON.parse(bytes.toString()), options);
      else if (url.pathname === "/fixture/public")
        result = await publishedBusinessImages(url.searchParams.get("listingId"), options);
      else if (url.pathname.startsWith("/api/business-images/")) {
        const response = await serveBusinessImage(url.pathname.split("/").at(-1), options);
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
        return;
      } else {
        res.writeHead(404);
        res.end();
        return;
      }
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(error.code === "23505" ? 409 : 400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: error.message }));
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  origin = `http://127.0.0.1:${server.address().port}`;
  return {
    setWriterConfigured: (value) => {
      writerConfigured = value;
    },
    origin,
    db,
    as,
    directory,
    interruptFinish: () => {
      interruptFinish = true;
    },
    interruptDecision: () => {
      interruptDecision = true;
    },
    interruptStorage: () => {
      interruptStorage = true;
    },
    close: async () => {
      await new Promise((r) => server.close(r));
      await db.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}
