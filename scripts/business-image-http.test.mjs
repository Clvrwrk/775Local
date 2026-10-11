import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { startMediaRuntime } from "./fixtures/business-images/runtime.mjs";
import { listing, actorIds } from "./fixtures/business-images/db.mjs";

export async function syntheticImage() {
  return sharp({ create: { width: 120, height: 80, channels: 3, background: "#24786d" } })
    .png()
    .withExif({ IFD0: { Artist: "PRIVATE SYNTHETIC TEST" } })
    .toBuffer();
}
export function imageForm(bytes, id = randomUUID(), kind = "image") {
  const f = new FormData();
  for (const [k, v] of Object.entries({
    id,
    listingId: listing,
    kind,
    alt: kind === "logo" ? "Synthetic business logo" : "Synthetic teal business photograph",
    rightsBasis: "owned",
    source: "Created from synthetic pixels for local testing",
    rightsAttested: "true",
  }))
    f.set(k, v);
  f.set("file", new File([new Uint8Array(bytes)], "synthetic.png", { type: "image/png" }));
  return f;
}
test("local HTTP upload/review with real PostgreSQL RLS and durable object bytes", async (t) => {
  const r = await startMediaRuntime();
  t.after(() => r.close());
  const bytes = await syntheticImage();
  const id = randomUUID();
  const upload = async (form, identity = "owner") =>
    (
      await fetch(r.origin + "/fixture/upload", {
        method: "POST",
        headers: { "x-fixture-identity": identity },
        body: form,
      })
    ).json();
  const command = async (data, identity = "owner") =>
    (
      await fetch(r.origin + "/fixture/command", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-fixture-identity": identity },
        body: JSON.stringify(data),
      })
    ).json();
  const publicImages = async () =>
    (await fetch(r.origin + "/fixture/public?listingId=" + listing)).json();
  await t.test("anonymous, cross-owner, recipient and unscoped manager cannot upload", async () => {
    for (const who of ["", "other", "recipient", "manager", "impersonated", "impersonated_id"])
      assert.equal((await upload(imageForm(bytes), who)).ok, false);
    assert.equal(
      (await r.db.query("select count(*)::int as n from app.media_assets")).rows[0].n,
      0,
    );
  });
  await t.test("owner uploads and repeats without duplicate rows or mutation", async () => {
    assert.equal((await upload(imageForm(bytes, id))).receipt.status, "pending_review");
    assert.equal((await upload(imageForm(bytes, id))).receipt.status, "pending_review");
    assert.equal(
      (await r.db.query("select count(*)::int as n from app.media_assets")).rows[0].n,
      1,
    );
    const clean = await readFile(join(r.directory, id, "sanitized.webp"));
    assert.equal((await sharp(clean).metadata()).exif, undefined);
    assert.equal(
      (
        await r.db.query(
          "select count(*)::int as n from app.audit_events where action='media.submitted'",
        )
      ).rows[0].n,
      1,
    );
  });
  await t.test(
    "refresh/relogin queries retain pending state and private originals never serve anonymously",
    async () => {
      const workspace = await command({ action: "workspace", id: listing });
      assert.equal(workspace.receipt[0].id, id);
      assert.equal(workspace.receipt[0].status, "pending_review");
      assert.deepEqual(await publicImages(), []);
      assert.equal((await fetch(r.origin + "/api/business-images/" + id)).status, 404);
      assert.equal(
        (
          await fetch(
            r.origin + "/storage/v1/object/authenticated/business-images/" + id + "/original",
          )
        ).status,
        403,
      );
      assert.equal((await command({ action: "preview", id }, "other")).ok, false);
      for (const who of ["impersonated", "impersonated_id"]) {
        assert.equal((await command({ action: "workspace", id: listing }, who)).ok, false);
        assert.equal(
          (
            await fetch(
              r.origin + "/storage/v1/object/authenticated/business-images/" + id + "/original",
              { headers: { Authorization: "Bearer " + who } },
            )
          ).status,
          403,
        );
      }
    },
  );
  await t.test(
    "owners and stale/wrong-org Operators cannot approve; rights confirmation is required",
    async () => {
      for (const who of ["owner", "stale", "wrong_org"])
        assert.equal(
          (
            await command(
              {
                action: "decide",
                id,
                decision: "approved",
                reason: "Owned image checked",
                rightsChecked: true,
              },
              who,
            )
          ).ok,
          false,
        );
      assert.equal(
        (
          await command(
            {
              action: "decide",
              id,
              decision: "approved",
              reason: "Owned image checked",
              rightsChecked: false,
            },
            "operator",
          )
        ).code,
        "review_incomplete",
      );
      assert.equal((await fetch(r.origin + "/api/business-images/" + id)).status, 404);
    },
  );
  await t.test(
    "Operator cannot bypass the server sanitizer by writing an approved object directly",
    async () => {
      for (const [mime, payload] of [
        ["image/png", bytes],
        ["image/webp", Buffer.from("not an image")],
      ]) {
        const response = await fetch(
          r.origin + "/storage/v1/object/business-images/" + id + "/approved.webp",
          {
            method: "POST",
            headers: { Authorization: "Bearer operator", "Content-Type": mime },
            body: payload,
          },
        );
        assert.equal(response.status, 400);
      }
      await assert.rejects(
        r.as("operator", (tx) =>
          tx.query(
            "select public.decide_business_image($1,'approved','Synthetic rights checked',true)",
            [id],
          ),
        ),
        /review_incomplete/,
      );
      r.setWriterConfigured(false);
      try {
        assert.equal(
          (
            await command(
              {
                action: "decide",
                id,
                decision: "approved",
                reason: "Synthetic rights checked",
                rightsChecked: true,
              },
              "operator",
            )
          ).code,
          "media_writer_not_configured",
        );
        assert.equal((await fetch(r.origin + "/api/business-images/" + id)).status, 404);
      } finally {
        r.setWriterConfigured(true);
      }
    },
  );
  await t.test(
    "review re-decodes original, ignores a tampered staged derivative and strips metadata",
    async () => {
      await writeFile(
        join(r.directory, id, "sanitized.webp"),
        Buffer.from('<svg onload="alert(1)"/>'),
      );
      const preview = await command({ action: "preview", id }, "operator");
      assert.ok(preview.receipt.dataUrl.startsWith("data:image/webp;base64,"));
      const decide = {
        action: "decide",
        id,
        decision: "approved",
        reason: "Synthetic rights and pixels checked",
        rightsChecked: true,
      };
      r.interruptDecision();
      assert.equal((await command(decide, "operator")).ok, false);
      assert.equal((await command(decide, "operator")).receipt.status, "approved");
      const response = await fetch(r.origin + "/api/business-images/" + id);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const meta = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
      assert.equal(meta.format, "webp");
      assert.equal(meta.exif, undefined);
      const published = await publicImages();
      assert.equal(published.length, 1);
      assert.equal(published[0].kind, "image");
      assert.equal(published[0].alt, "Synthetic teal business photograph");
      assert.equal(published[0].url, "/api/business-images/" + id);
      assert.equal(
        (await r.db.query("select public_path from app.media_assets where id=$1", [id])).rows[0]
          .public_path,
        "/api/business-images/" + id,
      );
      // Projection must not trust an old host-bound value from an earlier release.
      await r.db.query("update app.media_assets set public_path=$2 where id=$1", [
        id,
        "https://775directory.com/api/business-images/" + id,
      ]);
      assert.equal((await publicImages())[0].url, "/api/business-images/" + id);
      assert.equal(published[0].source, undefined);
      assert.equal(
        (
          await r.db.query(
            "select count(*)::int as n from app.audit_events where action='media.approved'",
          )
        ).rows[0].n,
        1,
      );
    },
  );
  await t.test(
    "baseline public media grants do not expose sidecar metadata to anonymous or owners",
    async () => {
      for (const identity of ["", "owner", "other", "operator"])
        assert.deepEqual(
          (
            await r.as(identity, (tx) =>
              tx.query(
                "select original_path,sha256,created_by,reviewed_by from app.media_assets where id=$1",
                [id],
              ),
            )
          ).rows,
          [],
        );
      assert.equal((await publicImages())[0].id, id);
    },
  );
  await t.test(
    "column-level legacy grants cannot edit managed approvals or inject reserved originals",
    async () => {
      await r.db.exec(
        "grant update(status,public_path),insert(id,listing_id,kind,original_path,media_type,byte_size,sha256,created_by) on app.media_assets to authenticated",
      );
      try {
        assert.deepEqual(
          (
            await r.as("owner", (tx) =>
              tx.query(
                "update app.media_assets set status='rejected',public_path=null where id=$1 returning id",
                [id],
              ),
            )
          ).rows,
          [],
        );
        const forged = randomUUID();
        await assert.rejects(
          r.as("owner", (tx) =>
            tx.query(
              "insert into app.media_assets(id,listing_id,kind,original_path,media_type,byte_size,sha256,created_by) values($1,$2,'image',$3,'image/png',100,$4,$5)",
              [forged, listing, forged + "/original", "0".repeat(64), actorIds.owner],
            ),
          ),
          /row-level security/,
        );
      } finally {
        await r.db.exec(
          "revoke update(status,public_path),insert(id,listing_id,kind,original_path,media_type,byte_size,sha256,created_by) on app.media_assets from authenticated",
        );
      }
    },
  );
  await t.test(
    "a logo is associated as a logo, not silently counted as a gallery image",
    async () => {
      const logo = randomUUID();
      assert.equal((await upload(imageForm(bytes, logo, "logo"))).ok, true);
      assert.equal(
        (
          await command(
            {
              action: "decide",
              id: logo,
              decision: "approved",
              reason: "Synthetic logo rights checked",
              rightsChecked: true,
            },
            "operator",
          )
        ).ok,
        true,
      );
      const p = await publicImages();
      assert.equal(p.filter((x) => x.kind === "logo").length, 1);
      assert.equal(p.filter((x) => x.kind === "image").length, 1);
      assert.equal(
        (
          await r.db.query("select logo_media_id from app.listing_content where listing_id=$1", [
            listing,
          ])
        ).rows[0].logo_media_id,
        logo,
      );
      assert.equal(
        (await upload(imageForm(bytes, randomUUID(), "logo"))).code,
        "media_limit_reached",
      );
    },
  );
  await t.test("interrupted upload confirmation retries to the same saved receipt", async () => {
    const next = randomUUID();
    r.interruptFinish();
    assert.equal((await upload(imageForm(bytes, next))).ok, false);
    assert.equal((await upload(imageForm(bytes, next))).receipt.status, "pending_review");
    const altered = imageForm(bytes, next);
    altered.set("alt", "Different description");
    assert.equal((await upload(altered)).code, "idempotency_conflict");
  });
  await t.test("rejection stays private with reason and 30-day quarantine", async () => {
    const reject = randomUUID();
    await upload(imageForm(bytes, reject));
    assert.equal(
      (
        await command(
          {
            action: "decide",
            id: reject,
            decision: "rejected",
            reason: "Rights are not verified",
            rightsChecked: false,
          },
          "operator",
        )
      ).ok,
      true,
    );
    assert.equal((await fetch(r.origin + "/api/business-images/" + reject)).status, 404);
    const row = (
      await r.db.query("select status,quarantine_until from app.media_assets where id=$1", [reject])
    ).rows[0];
    assert.equal(row.status, "rejected");
    assert.ok(row.quarantine_until > Date.now());
  });
  await t.test("parallel submissions cannot overrun the gallery quota", async () => {
    const responses = await Promise.all([upload(imageForm(bytes)), upload(imageForm(bytes))]);
    assert.equal(responses.filter((x) => x.ok).length, 1);
    assert.equal(responses.find((x) => !x.ok).code, "media_limit_reached");
  });
  await t.test("direct media approval and object replacement/deletion are denied", async () => {
    await r.db.exec(
      "create policy fixture_existing_broad_policy on storage.objects for all to anon,authenticated using(true) with check(true)",
    );
    assert.equal(
      (
        await r.as("owner", (tx) =>
          tx.query("update app.media_assets set status='approved' where id=$1 returning id", [id]),
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await r.as("owner", (tx) =>
          tx.query("delete from storage.objects where bucket_id='business-images' returning name"),
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await r.as("owner", (tx) =>
          tx.query(
            "update storage.objects set name='forged' where bucket_id='business-images' returning name",
          ),
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      r.as("owner", (tx) =>
        tx.query("insert into storage.objects(bucket_id,name) values('business-images',$1)", [
          randomUUID() + "/original",
        ]),
      ),
      /row-level security/,
    );
    assert.equal(
      (
        await r.as("", (tx) =>
          tx.query("delete from storage.objects where bucket_id='business-images' returning name"),
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await r.as("", (tx) =>
          tx.query(
            "update storage.objects set name='forged' where bucket_id='business-images' returning name",
          ),
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      r.as("", (tx) =>
        tx.query("insert into storage.objects(bucket_id,name) values('business-images',$1)", [
          randomUUID() + "/original",
        ]),
      ),
      /row-level security/,
    );
    await assert.rejects(
      r.as("", (tx) => tx.query("select public.business_image_workspace($1)", [listing])),
      /permission denied/,
    );
    await assert.rejects(
      r.as("owner", (tx) => tx.query("select * from app.business_image_submissions")),
      /permission denied/,
    );
  });
  await t.test(
    "ordinary legacy media keeps CRUD while every reserved original path stays protected",
    async () => {
      const legacy = randomUUID();
      const insert = (rowId, path) =>
        r.as("owner", (tx) =>
          tx.query(
            "insert into app.media_assets(id,listing_id,kind,original_path,media_type,byte_size,sha256,created_by) values($1,$2,'video',$3,'video/mp4',100,$4,$5) returning id",
            [rowId, listing, path, "0".repeat(64), actorIds.owner],
          ),
        );
      assert.equal(
        (await insert(legacy, "legacy-fixture/" + legacy + "/upload.mp4")).rows[0].id,
        legacy,
      );
      assert.equal(
        (
          await r.as("owner", (tx) =>
            tx.query("update app.media_assets set byte_size=101 where id=$1 returning byte_size", [
              legacy,
            ]),
          )
        ).rows[0].byte_size,
        101,
      );
      const other = randomUUID();
      for (const path of [
        legacy + "/original",
        other + "/original",
        other.toUpperCase() + "/original",
        other + "/ORIGINAL",
      ]) {
        await assert.rejects(insert(randomUUID(), path), /row-level security/);
        await assert.rejects(
          r.as("owner", (tx) =>
            tx.query("update app.media_assets set original_path=$2 where id=$1", [legacy, path]),
          ),
          /row-level security/,
        );
        await assert.rejects(
          r.as("owner", (tx) =>
            tx.query("update app.media_assets set id=$2,original_path=$3 where id=$1", [
              legacy,
              randomUUID(),
              path,
            ]),
          ),
          /row-level security/,
        );
      }
      for (const identity of ["owner", "operator"]) {
        assert.equal(
          (
            await r.as(identity, (tx) =>
              tx.query(
                "update app.media_assets set id=$2,original_path='legacy-forged' where id=$1 returning id",
                [id, randomUUID()],
              ),
            )
          ).rows.length,
          0,
        );
        assert.equal(
          (
            await r.as(identity, (tx) =>
              tx.query("delete from app.media_assets where id=$1 returning id", [id]),
            )
          ).rows.length,
          0,
        );
      }
      assert.equal(
        (
          await r.as("owner", (tx) =>
            tx.query("delete from app.media_assets where id=$1 returning id", [legacy]),
          )
        ).rows[0].id,
        legacy,
      );
    },
  );
  await t.test(
    "scoped delegation works and revocation/expiry immediately denies access",
    async () => {
      await r.db.query(
        `update app.listing_participations set authority_scope='{"media":"propose"}' where actor_id=$1`,
        [actorIds.manager],
      );
      assert.equal((await command({ action: "workspace", id: listing }, "manager")).ok, true);
      await r.db.query(
        `update app.listing_participations set expires_at=now()-interval '1 minute' where actor_id=$1`,
        [actorIds.manager],
      );
      assert.equal((await command({ action: "workspace", id: listing }, "manager")).ok, false);
      await r.db.query(
        `update app.listing_participations set status='revoked',revoked_at=now() where actor_id=$1`,
        [actorIds.owner],
      );
      assert.equal((await command({ action: "workspace", id: listing })).ok, false);
    },
  );
  await t.test("unpublishing the listing immediately stops public image access", async () => {
    await r.db.query(
      `update app.business_listings set publication_status='suspended',published_at=null where id=$1`,
      [listing],
    );
    assert.deepEqual(await publicImages(), []);
    assert.equal((await fetch(r.origin + "/api/business-images/" + id)).status, 404);
  });
});
