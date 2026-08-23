import type { Sql } from "@/lib/db";
import { BUSINESSES, CATEGORIES, CITIES } from "@/data/seed";

const PACKAGE_PHOTOS: { slug: string; url: string; caption: string }[] = [
  { slug: "high-sierra-screens-reno", url: "/media/shop.jpg", caption: "Storefront" },
  { slug: "high-sierra-screens-reno", url: "/media/washoe.jpg", caption: "Service area" },
  { slug: "high-sierra-screens-reno", url: "/media/carson.jpg", caption: "Valley jobs" },
  { slug: "biggest-little-screen-co", url: "/media/reno.jpg", caption: "Midtown" },
  { slug: "louis-basque-reno", url: "/media/shop.jpg", caption: "Dining room" },
  { slug: "louis-basque-reno", url: "/media/reno.jpg", caption: "Fourth Street" },
  { slug: "star-hotel-elko", url: "/media/elko.jpg", caption: "High desert" },
  { slug: "j-t-basque-gardnerville", url: "/media/carson.jpg", caption: "Carson Valley" },
  { slug: "truckee-meadows-air", url: "/media/reno.jpg", caption: "Truckee Meadows" },
  { slug: "meadows-vet", url: "/media/tahoe.jpg", caption: "Mt Rose corridor" },
  { slug: "pipe-and-sage-plumbing", url: "/media/shop.jpg", caption: "On the truck" },
  { slug: "capital-cool-carson", url: "/media/carson.jpg", caption: "Capitol jobs" },
];

const PACKAGE_OFFERS: { slug: string; title: string; details: string; code: string; expires: string }[] = [
  {
    slug: "high-sierra-screens-reno",
    title: "$25 off pet-mesh recut",
    details: "Cat went through the patio again? Mention 775 Directory this month.",
    code: "CAT775",
    expires: "2026-12-31",
  },
  {
    slug: "louis-basque-reno",
    title: "Tuesday Picon with the set",
    details: "Complimentary Picon punch with a lunch or dinner set. Dine-in.",
    code: "PICON",
    expires: "2026-11-30",
  },
  {
    slug: "truckee-meadows-air",
    title: "Pre-freeze tune-up $89",
    details: "Before the first hard freeze. Furnace check, filter, safety.",
    code: "FREEZE",
    expires: "2026-11-15",
  },
  {
    slug: "star-hotel-elko",
    title: "Family-style for two",
    details: "Second set of sides on us, Sunday–Thursday.",
    code: "RUBY",
    expires: "2026-12-31",
  },
];

export async function ensureSeeded(sql: Sql) {
  const rows = await sql<{ n: number }>`select count(*)::int as n from cities`;
  if ((rows[0]?.n ?? 0) > 0) return;

  for (const c of CITIES) {
    await sql`
      insert into cities (slug, name, county, region, zip, lat, lng, blurb)
      values (${c.slug}, ${c.name}, ${c.county}, ${c.region}, ${c.zip}, ${c.lat}, ${c.lng}, ${c.blurb})
    `;
  }

  for (const c of CATEGORIES) {
    await sql`
      insert into categories (slug, name, description, synonyms, icon)
      values (${c.slug}, ${c.name}, ${c.description}, ${c.synonyms}, ${c.icon})
    `;
  }

  const cityRows = await sql<{ id: number; slug: string }>`select id, slug from cities`;
  const catRows = await sql<{ id: number; slug: string }>`select id, slug from categories`;
  const cityId = Object.fromEntries(cityRows.map((r) => [r.slug, r.id]));
  const catId = Object.fromEntries(catRows.map((r) => [r.slug, r.id]));

  for (const b of BUSINESSES) {
    const cid = cityId[b.city];
    if (!cid) continue;
    const inserted = await sql<{ id: number }>`
      insert into businesses (
        slug, name, tagline, description, phone, email, website, street, zip,
        city_id, lat, lng, rating, review_count, hours, featured, verified
      ) values (
        ${b.slug}, ${b.name}, ${b.tagline}, ${b.description}, ${b.phone}, ${b.email},
        ${b.website}, ${b.street}, ${b.zip}, ${cid}, ${b.lat}, ${b.lng},
        ${b.rating}, ${b.reviewCount}, ${b.hours}, ${b.featured}, true
      ) returning id
    `;
    const bid = inserted[0]?.id;
    if (!bid) continue;
    for (const [i, slug] of b.categories.entries()) {
      const kid = catId[slug];
      if (!kid) continue;
      await sql`
        insert into business_categories (business_id, category_id, is_primary)
        values (${bid}, ${kid}, ${i === 0})
      `;
    }
    for (const r of b.reviews) {
      await sql`
        insert into reviews (business_id, author, rating, body)
        values (${bid}, ${r.author}, ${r.rating}, ${r.body})
      `;
    }
  }
}

export async function ensurePackages(sql: Sql) {
  try {
    await sql`select 1 from listing_photos limit 1`;
  } catch {
    return;
  }

  const grouped = new Map<string, { url: string; caption: string }[]>();
  for (const p of PACKAGE_PHOTOS) {
    const list = grouped.get(p.slug) ?? [];
    list.push(p);
    grouped.set(p.slug, list);
  }
  for (const [slug, list] of grouped) {
    for (const [i, p] of list.entries()) {
      await sql`
        insert into listing_photos (business_id, url, caption, sort_order)
        select b.id, ${p.url}, ${p.caption}, ${i}
        from businesses b
        where b.slug = ${slug}
          and not exists (
            select 1 from listing_photos x where x.business_id = b.id and x.url = ${p.url}
          )
      `;
    }
  }

  for (const o of PACKAGE_OFFERS) {
    await sql`
      insert into offers (business_id, title, details, code, expires_on, active)
      select b.id, ${o.title}, ${o.details}, ${o.code}, ${o.expires}::date, true
      from businesses b
      where b.slug = ${o.slug}
      on conflict (business_id) do nothing
    `;
  }
}
