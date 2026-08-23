import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";
import { ensureSeeded, ensurePackages } from "./seed";
import type { ListingPhoto, Offer } from "./types";

const PHOTO_CAP = { claimed: 6, featured: 12 } as const;

async function ready() {
  const sql = await getSql();
  await ensureSeeded(sql);
  await ensurePackages(sql);
  return sql;
}

async function ownedBiz(sql: Sql, userId: string, businessId: number) {
  const rows = await sql<{
    id: number;
    slug: string;
    featured: boolean;
    claimed_by: string | null;
    city_slug: string;
    category_slug: string;
  }>`
    select b.id, b.slug, b.featured, b.claimed_by,
           c.slug as city_slug, coalesce(cat.slug, '') as category_slug
    from businesses b
    join cities c on c.id = b.city_id
    left join business_categories bc on bc.business_id = b.id and bc.is_primary = true
    left join categories cat on cat.id = bc.category_id
    where b.id = ${businessId}
  `;
  const biz = rows[0];
  if (!biz || biz.claimed_by !== userId) throw new Error("You don’t own this listing.");
  return biz;
}

export function photoCap(featured: boolean) {
  return featured ? PHOTO_CAP.featured : PHOTO_CAP.claimed;
}

export const listOwnerPhotos = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((businessId: number) => businessId)
  .handler(async ({ context, data: businessId }) => {
    const sql = await ready();
    const biz = await ownedBiz(sql, context.userId, businessId);
    const photos = await sql<ListingPhoto>`
      select id, url, caption, sort_order as "sortOrder"
      from listing_photos where business_id = ${biz.id}
      order by sort_order, id
    `;
    return { photos, cap: photoCap(biz.featured), featured: biz.featured, slug: biz.slug };
  });

export const addListingPhoto = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    businessId: number;
    dataUrl: string;
    caption: string;
  }) => input)
  .handler(async ({ context, data }) => {
    const sql = await ready();
    const biz = await ownedBiz(sql, context.userId, data.businessId);
    const cap = photoCap(biz.featured);
    const count = await sql<{ n: number }>`
      select count(*)::int as n from listing_photos where business_id = ${biz.id}
    `;
    if ((count[0]?.n ?? 0) >= cap) {
      throw new Error(
        biz.featured
          ? "Featured listings cap at 12 photos."
          : "Claimed listings cap at 6 photos. Featured raises it to 12.",
      );
    }
    const match = data.dataUrl.match(/^data:(image\/(jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/i);
    if (!match) throw new Error("Use a JPG, PNG, or WebP photo.");
    const b64 = match[3]!.replace(/\s/g, "");
    if (b64.length > 900_000) throw new Error("Keep each photo under about 650KB.");
    const ext = match[2] === "jpeg" || match[2] === "jpg" ? "jpg" : match[2]!.toLowerCase();
    const { mkdir, writeFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const filename = `${biz.id}-${Date.now()}.${ext}`;
    await writeFile(path.join(dir, filename), Buffer.from(b64, "base64"));
    const url = `/uploads/${filename}`;
    const caption = data.caption.trim().slice(0, 80);
    const inserted = await sql<ListingPhoto>`
      insert into listing_photos (business_id, url, caption, sort_order)
      values (${biz.id}, ${url}, ${caption}, ${(count[0]?.n ?? 0) + 1})
      returning id, url, caption, sort_order as "sortOrder"
    `;
    return inserted[0]!;
  });

export const deleteListingPhoto = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { businessId: number; photoId: number }) => input)
  .handler(async ({ context, data }) => {
    const sql = await ready();
    const biz = await ownedBiz(sql, context.userId, data.businessId);
    await sql`
      delete from listing_photos
      where id = ${data.photoId} and business_id = ${biz.id}
    `;
    return { ok: true as const };
  });

export const saveOffer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    businessId: number;
    title: string;
    details: string;
    code: string;
    expiresOn: string;
    active: boolean;
  }) => input)
  .handler(async ({ context, data }) => {
    const sql = await ready();
    const biz = await ownedBiz(sql, context.userId, data.businessId);
    const title = data.title.trim();
    if (title.length < 4) throw new Error("Give the offer a short title.");
    const expires = data.expiresOn.trim() || null;
    await sql`
      insert into offers (business_id, title, details, code, expires_on, active)
      values (
        ${biz.id}, ${title}, ${data.details.trim().slice(0, 280)},
        ${data.code.trim().toUpperCase().slice(0, 24)}, ${expires}, ${data.active}
      )
      on conflict (business_id) do update set
        title = excluded.title,
        details = excluded.details,
        code = excluded.code,
        expires_on = excluded.expires_on,
        active = excluded.active
    `;
    return { ok: true as const };
  });

export const getOwnerOffer = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((businessId: number) => businessId)
  .handler(async ({ context, data: businessId }) => {
    const sql = await ready();
    const biz = await ownedBiz(sql, context.userId, businessId);
    const rows = await sql<Offer>`
      select id, business_id as "businessId", title, details, code,
             expires_on::text as "expiresOn", active
      from offers where business_id = ${biz.id}
    `;
    return { offer: rows[0] ?? null, featured: biz.featured, slug: biz.slug };
  });

export const setFeaturedPackage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { businessId: number; featured: boolean }) => input)
  .handler(async ({ context, data }) => {
    const sql = await ready();
    const biz = await ownedBiz(sql, context.userId, data.businessId);
    if (data.featured) {
      const cap = biz.city_slug === "reno" || biz.city_slug === "sparks" ? 2 : 1;
      const taken = await sql<{ n: number }>`
        select count(*)::int as n
        from businesses b
        join business_categories bc on bc.business_id = b.id and bc.is_primary = true
        join categories cat on cat.id = bc.category_id
        join cities c on c.id = b.city_id
        where b.featured = true
          and b.id <> ${biz.id}
          and c.slug = ${biz.city_slug}
          and cat.slug = ${biz.category_slug}
      `;
      if ((taken[0]?.n ?? 0) >= cap) {
        throw new Error(
          `Featured slot for ${biz.category_slug} in ${biz.city_slug} is full (${cap} max).`,
        );
      }
    }
    await sql`update businesses set featured = ${data.featured} where id = ${biz.id}`;
    return { featured: data.featured };
  });

export const listActiveOffers = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await ready();
  return sql<{
    businessId: number;
    slug: string;
    businessName: string;
    cityName: string;
    featured: boolean;
    title: string;
    details: string;
    code: string;
    expiresOn: string | null;
  }>`
    select o.business_id as "businessId", b.slug, b.name as "businessName",
           c.name as "cityName", b.featured, o.title, o.details, o.code,
           o.expires_on::text as "expiresOn"
    from offers o
    join businesses b on b.id = o.business_id
    join cities c on c.id = b.city_id
    where o.active = true
    order by b.featured desc, o.id desc
    limit 24
  `;
});
