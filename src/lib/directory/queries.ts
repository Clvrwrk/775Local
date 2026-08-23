import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { domainMatchesListing } from "./domains";
import { ensurePackages, ensureSeeded } from "./seed";
import type {
  BusinessCard,
  BusinessDetail,
  CampaignRow,
  Category,
  City,
  LeadRow,
  ListingPhoto,
  Offer,
  ResidentRow,
} from "./types";

const CARD_SQL = `
  b.id, b.slug, b.name, b.tagline, b.description, b.phone, b.street, b.zip,
  b.rating::float as rating, b.review_count as "reviewCount", b.hours,
  b.featured, b.verified, c.slug as "citySlug", c.name as "cityName",
  coalesce(cat.name, '') as "primaryCategory",
  coalesce(cat.slug, '') as "primaryCategorySlug",
  b.claimed_by as "claimedBy",
  coalesce(b.website, '') as website,
  coalesce(b.public_email, false) as "publicEmail",
  coalesce(b.hide_street, false) as "hideStreet",
  (select p.url from listing_photos p where p.business_id = b.id order by p.sort_order, p.id limit 1) as "coverUrl"
`;

async function ready() {
  const sql = await getSql();
  await ensureSeeded(sql);
  await ensurePackages(sql);
  return sql;
}

export const listCities = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await ready();
  return sql<City>`
    select id, slug, name, county, region, zip, lat, lng, blurb
    from cities order by name
  `;
});

export const listCategories = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await ready();
  return sql<Category>`
    select id, slug, name, description, synonyms, icon
    from categories order by name
  `;
});

export const getCity = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const sql = await ready();
    const rows = await sql<City>`
      select id, slug, name, county, region, zip, lat, lng, blurb
      from cities where slug = ${slug}
    `;
    return rows[0] ?? null;
  });

export const getCategory = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const sql = await ready();
    const rows = await sql<Category>`
      select id, slug, name, description, synonyms, icon
      from categories where slug = ${slug}
    `;
    return rows[0] ?? null;
  });

export type SearchInput = {
  q?: string;
  city?: string;
  category?: string;
  unclaimed?: boolean;
};

export const searchBusinesses = createServerFn({ method: "GET" })
  .validator((input: SearchInput) => ({
    q: (input.q ?? "").trim(),
    city: (input.city ?? "").trim(),
    category: (input.category ?? "").trim(),
    unclaimed: Boolean(input.unclaimed),
  }))
  .handler(async ({ data }) => {
    const sql = await ready();
    const q = data.q.toLowerCase();
    let text = `
      select ${CARD_SQL}
      from businesses b
      join cities c on c.id = b.city_id
      left join business_categories bc on bc.business_id = b.id and bc.is_primary = true
      left join categories cat on cat.id = bc.category_id
      where 1=1
    `;
    const params: unknown[] = [];
    if (data.city) {
      params.push(data.city);
      text += ` and c.slug = $${params.length}`;
    }
    if (data.category) {
      params.push(data.category);
      text += ` and exists (
        select 1 from business_categories x
        join categories k on k.id = x.category_id
        where x.business_id = b.id and k.slug = $${params.length}
      )`;
    }
    if (data.unclaimed) {
      text += ` and b.claimed_by is null`;
    }
    if (q) {
      params.push(`%${q}%`);
      const p = `$${params.length}`;
      text += ` and (
        lower(b.name) like ${p}
        or lower(b.tagline) like ${p}
        or lower(b.description) like ${p}
        or lower(coalesce(cat.name,'')) like ${p}
        or lower(coalesce(cat.synonyms,'')) like ${p}
        or lower(c.name) like ${p}
      )`;
    }
    text += ` order by b.featured desc, b.rating desc, b.review_count desc`;
    if (data.unclaimed) text += ` limit 24`;
    return sql.query<BusinessCard>(text, params);
  });

export const getBusiness = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const sql = await ready();
    const rows = await sql.query<BusinessDetail>(
      `select ${CARD_SQL},
              b.email, b.lat, b.lng
       from businesses b
       join cities c on c.id = b.city_id
       left join business_categories bc on bc.business_id = b.id and bc.is_primary = true
       left join categories cat on cat.id = bc.category_id
       where b.slug = $1`,
      [slug],
    );
    const biz = rows[0];
    if (!biz) return null;
    const categories = await sql<{ slug: string; name: string }>`
      select k.slug, k.name
      from business_categories x
      join categories k on k.id = x.category_id
      where x.business_id = ${biz.id}
      order by x.is_primary desc, k.name
    `;
    const reviews = await sql<{
      id: number;
      author: string;
      rating: number;
      body: string;
    }>`
      select id, author, rating, body from reviews
      where business_id = ${biz.id}
      order by created_at desc
    `;
    const photos = await sql<ListingPhoto>`
      select id, url, caption, sort_order as "sortOrder"
      from listing_photos where business_id = ${biz.id}
      order by sort_order, id
    `;
    const offers = await sql<Offer>`
      select id, business_id as "businessId", title, details, code,
             expires_on::text as "expiresOn", active
      from offers where business_id = ${biz.id} and active = true
      limit 1
    `;
    return { ...biz, categories, reviews, photos, offer: offers[0] ?? null };
  });

export const featuredBusinesses = createServerFn({ method: "GET" }).handler(
  async () => {
    const sql = await ready();
    return sql.query<BusinessCard>(
      `select ${CARD_SQL}
       from businesses b
       join cities c on c.id = b.city_id
       left join business_categories bc on bc.business_id = b.id and bc.is_primary = true
       left join categories cat on cat.id = bc.category_id
       where b.featured = true
       order by b.rating desc
       limit 8`,
    );
  },
);

export const submitLead = createServerFn({ method: "POST" })
  .validator((input: {
    businessId: number;
    name: string;
    phone: string;
    email: string;
    zip: string;
    message: string;
  }) => input)
  .handler(async ({ data }) => {
    const sql = await ready();
    const name = data.name.trim();
    const message = data.message.trim();
    if (!name || !message) throw new Error("Name and message are required.");
    await sql`
      insert into leads (business_id, name, phone, email, zip, message)
      values (${data.businessId}, ${name}, ${data.phone.trim()}, ${data.email.trim()}, ${data.zip.trim()}, ${message})
    `;
    return { ok: true as const };
  });

export const createListing = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    name: string;
    citySlug: string;
    categorySlug: string;
    phone: string;
    street: string;
    zip: string;
    description: string;
  }) => input)
  .handler(async ({ context, data }) => {
    const sql = await ready();
    const name = data.name.trim();
    if (name.length < 2) throw new Error("Business name is required.");
    const city = await sql<{ id: number }>`select id from cities where slug = ${data.citySlug}`;
    const cat = await sql<{ id: number }>`select id from categories where slug = ${data.categorySlug}`;
    if (!city[0] || !cat[0]) throw new Error("Choose a valid city and category.");
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 48);
    const slug = `${base || "listing"}-${Date.now().toString(36)}`;
    const inserted = await sql<{ id: number; slug: string }>`
      insert into businesses (
        slug, name, tagline, description, phone, street, zip, city_id,
        rating, review_count, hours, featured, verified, claimed_by
      ) values (
        ${slug}, ${name}, ${"Owner-listed on 775 Directory"}, ${data.description.trim() || "Newly listed local business."},
        ${data.phone.trim() || "7750000000"}, ${data.street.trim() || "Address coming soon"},
        ${data.zip.trim() || "89502"}, ${city[0].id},
        5.0, 0, ${"Hours listed by owner"}, false, true, ${context.userId}
      ) returning id, slug
    `;
    const row = inserted[0];
    if (!row) throw new Error("Could not create listing.");
    await sql`
      insert into business_categories (business_id, category_id, is_primary)
      values (${row.id}, ${cat[0].id}, true)
    `;
    return { slug: row.slug };
  });

export const claimListing = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    businessId: number;
    method: "domain" | "card" | "storefront" | "vehicle";
    filename: string;
  }) => ({
    businessId: input.businessId,
    method: input.method,
    filename: (input.filename ?? "").trim().slice(0, 180),
  }))
  .handler(async ({ context, data }) => {
    const sql = await ready();
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser();
    const email = session?.email ?? "";
    const rows = await sql<{
      id: number;
      slug: string;
      website: string;
      email: string;
      claimed_by: string | null;
    }>`
      select id, slug, coalesce(website,'') as website, coalesce(email,'') as email, claimed_by
      from businesses where id = ${data.businessId}
    `;
    const biz = rows[0];
    if (!biz) throw new Error("Listing not found.");
    if (biz.claimed_by) {
      if (biz.claimed_by === context.userId) return { slug: biz.slug, already: true as const };
      throw new Error("This listing is already claimed.");
    }

    const domainOk = domainMatchesListing(email, biz.website, biz.email);
    let method = data.method;
    if (domainOk) method = "domain";
    else if (method === "domain") {
      throw new Error("That email doesn’t match this shop’s website. Upload a card or a storefront / rig photo.");
    } else if (!data.filename) {
      throw new Error("Add a photo of your card, storefront, or service vehicle.");
    }

    const updated = await sql<{ slug: string }>`
      update businesses
      set claimed_by = ${context.userId},
          claim_method = ${method},
          verified = true
      where id = ${biz.id} and claimed_by is null
      returning slug
    `;
    if (!updated[0]) throw new Error("This listing is already claimed.");
    await sql`
      insert into claim_proofs (business_id, user_id, method, filename)
      values (${biz.id}, ${context.userId}, ${method}, ${method === "domain" ? email : data.filename})
    `;
    return { slug: updated[0].slug, already: false as const, method };
  });

export const myListings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await ready();
    return sql.query<BusinessCard>(
      `select ${CARD_SQL}
       from businesses b
       join cities c on c.id = b.city_id
       left join business_categories bc on bc.business_id = b.id and bc.is_primary = true
       left join categories cat on cat.id = bc.category_id
       where b.claimed_by = $1
       order by b.created_at desc`,
      [context.userId],
    );
  });

export const myLeads = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await ready();
    return sql<LeadRow>`
      select l.id, l.business_id as "businessId", b.name as "businessName",
             l.name, l.phone, l.email, l.zip, l.message,
             l.created_at::text as "createdAt"
      from leads l
      join businesses b on b.id = l.business_id
      where b.claimed_by = ${context.userId}
      order by l.created_at desc
      limit 50
    `;
  });

export const getResident = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await ready();
    const rows = await sql<ResidentRow>`
      select display_name as "displayName", zip, city_slug as "citySlug", interests
      from residents where user_id = ${context.userId}
    `;
    return rows[0] ?? null;
  });

export const saveResident = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    displayName: string;
    zip: string;
    citySlug: string;
    interests: string;
  }) => input)
  .handler(async ({ context, data }) => {
    const sql = await ready();
    const zip = data.zip.replace(/\D/g, "").slice(0, 5);
    if (zip.length !== 5) throw new Error("Enter a 5-digit ZIP.");
    await sql`
      insert into residents (user_id, display_name, zip, city_slug, interests)
      values (${context.userId}, ${data.displayName.trim()}, ${zip}, ${data.citySlug}, ${data.interests})
      on conflict (user_id) do update set
        display_name = excluded.display_name,
        zip = excluded.zip,
        city_slug = excluded.city_slug,
        interests = excluded.interests
    `;
    return { ok: true as const };
  });

export const myCampaigns = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await ready();
    return sql<CampaignRow>`
      select c.id, c.name, c.channel, c.city_slug as "citySlug",
             c.category_slug as "categorySlug", c.message, c.status, c.reach,
             c.created_at::text as "createdAt", b.name as "businessName",
             coalesce(c.included_offer, '') as "includedOffer"
      from campaigns c
      join businesses b on b.id = c.business_id
      where c.user_id = ${context.userId}
      order by c.created_at desc
    `;
  });

export const sendCampaign = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    businessId: number;
    name: string;
    channel: "virtual" | "direct_mail";
    citySlug: string;
    categorySlug: string;
    message: string;
    includeOffer?: boolean;
  }) => input)
  .handler(async ({ context, data }) => {
    const sql = await ready();
    const owned = await sql<{ id: number; featured: boolean }>`
      select id, featured from businesses where id = ${data.businessId} and claimed_by = ${context.userId}
    `;
    if (!owned[0]) throw new Error("You can only mail from a listing you own.");
    const msg = data.message.trim();
    if (msg.length < 8) throw new Error("Write a short message for the card.");
    const insert = owned[0].featured && data.includeOffer !== false;
    let offerLine = "";
    if (insert) {
      const off = await sql<{ title: string; code: string }>`
        select title, code from offers where business_id = ${data.businessId} and active = true
      `;
      if (off[0]) {
        offerLine = off[0].code
          ? `${off[0].title} · code ${off[0].code}`
          : off[0].title;
      }
    }
    const card = offerLine ? `${msg}\n\nOffer: ${offerLine}` : msg;
    const matched = await sql<{ n: number }>`
      select count(*)::int as n from residents
      where (${data.citySlug} = '' or city_slug = ${data.citySlug})
        and (${data.categorySlug} = '' or interests like ${"%" + data.categorySlug + "%"})
    `;
    const reach = Math.max(matched[0]?.n ?? 0, data.channel === "direct_mail" ? 120 : 40);
    await sql`
      insert into campaigns (user_id, business_id, name, channel, city_slug, category_slug, message, status, reach, included_offer)
      values (
        ${context.userId}, ${data.businessId}, ${data.name.trim() || "Neighborhood drop"},
        ${data.channel}, ${data.citySlug}, ${data.categorySlug}, ${card}, ${"sent"}, ${reach}, ${offerLine}
      )
    `;
    return { reach, includedOffer: offerLine };
  });
