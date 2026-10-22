import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { chromium, firefox, webkit } from "playwright";

// Actual ListingPage, publicListing and CSS. Local synthetic media and signed-out
// auth/command fakes prevent hosted data, identity, email or provider activity.
const root = resolve(import.meta.dirname, "..");
const engine = process.env.PREMIUM_BROWSER_ENGINE || "chromium";
assert.ok(["chromium", "firefox", "webkit"].includes(engine), "Choose a supported browser engine");
const output = resolve(
  process.env.PREMIUM_BROWSER_OUTPUT ||
    resolve(root, "../../output/775-premium-template-browser-20261022"),
);
await mkdir(output, { recursive: true });
const fixture = await mkdtemp(resolve(tmpdir(), "775-premium-browser-"));
const results = [];
const defaultViewports = [
  { width: 320, height: 740 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 1000 },
];
const viewports = process.env.PREMIUM_BROWSER_WIDTHS
  ? [...new Set(process.env.PREMIUM_BROWSER_WIDTHS.split(",").map(Number))].map((width) => {
      assert.ok(
        Number.isInteger(width) && width >= 240 && width <= 3840,
        "Choose a valid viewport width",
      );
      return (
        defaultViewports.find((viewport) => viewport.width === width) || { width, height: 1024 }
      );
    })
  : defaultViewports;
const scenarios = [
  { key: "real-five", photos: 5, logo: "wide" },
  { key: "no-media", photos: 0, logo: "none" },
  { key: "one-photo", photos: 1, logo: "portrait" },
  { key: "two-photos", photos: 2, logo: "wide" },
  { key: "many-photos", photos: 7, logo: "portrait" },
  { key: "broken-all-photos", photos: 2, logo: "wide", brokenPhotos: true },
  { key: "broken-first-photo", photos: 5, logo: "wide", brokenFirst: true },
  { key: "delayed-opener-error", photos: 5, logo: "wide", delayedOpener: true },
  { key: "broken-logo", photos: 2, logo: "broken" },
  { key: "long-name-phone-only", photos: 5, logo: "wide", name: "long", contact: "phone" },
  {
    key: "unbroken-name-website-only",
    photos: 1,
    logo: "none",
    name: "unbroken",
    contact: "website",
  },
  { key: "no-contact", photos: 0, logo: "none", contact: "none" },
  { key: "unsafe-contact", photos: 0, logo: "none", contact: "unsafe" },
  { key: "hidden-street", photos: 2, logo: "wide", hiddenStreet: true },
  { key: "owner-only", photos: 2, logo: "wide", owner: true },
  { key: "checked-only", photos: 2, logo: "wide", checked: true },
  { key: "sponsored-only", photos: 2, logo: "wide", sponsored: true },
  {
    key: "owner-checked-sponsored",
    photos: 5,
    logo: "wide",
    owner: true,
    checked: true,
    sponsored: true,
  },
].filter(
  (scenario) =>
    !process.env.PREMIUM_BROWSER_CASES ||
    process.env.PREMIUM_BROWSER_CASES.split(",").includes(scenario.key),
);
assert.ok(
  viewports.length && scenarios.length,
  "The requested browser selection must contain cases",
);
let server;
let browser;

function localSvg(pathname) {
  const logo = pathname.includes("logo");
  const portrait = pathname.includes("portrait");
  const width = logo ? (portrait ? 160 : 440) : 1200;
  const height = logo ? (portrait ? 320 : 100) : 800;
  const colors = ["#32534b", "#9d8041", "#51616e", "#8e6251", "#646b46", "#745d7a", "#587471"];
  const index = Number(pathname.match(/photo-(\d+)/)?.[1] || 1) - 1;
  const fill = logo ? "#fffdf8" : colors[index % colors.length];
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
    width +
    '" height="' +
    height +
    '" viewBox="0 0 ' +
    width +
    " " +
    height +
    '"><rect width="100%" height="100%" fill="' +
    fill +
    '"/><rect x="10%" y="15%" width="80%" height="70%" fill="none" stroke="#c9a227" stroke-width="6"/><text x="50%" y="52%" text-anchor="middle" fill="' +
    (logo ? "#1c1a16" : "#fffdf8") +
    '" font-size="' +
    (logo ? 24 : 65) +
    '" font-family="Georgia">' +
    (logo ? "Synthetic identity" : "Synthetic photo " + (index + 1)) +
    "</text></svg>"
  );
}

async function verifyContactLayout(page, viewport) {
  const media = page.locator(".listing-gallery-premium, .listing-premium-no-photos");
  const contact = page.locator(".listing-premium-contact");
  const [mediaBox, contactBox] = await Promise.all([media.boundingBox(), contact.boundingBox()]);
  assert.ok(
    mediaBox && contactBox,
    "Premium media and contact surfaces must have visible geometry",
  );
  if (viewport.width < 1024) {
    assert.ok(
      contactBox.y >= mediaBox.y + mediaBox.height - 1,
      "Mobile and tablet contact card must stack below the business gallery or photo fallback",
    );
    assert.ok(
      Math.abs(contactBox.x - mediaBox.x) <= 1 && Math.abs(contactBox.width - mediaBox.width) <= 1,
      "Stacked media and contact card must occupy the same full column",
    );
  } else {
    assert.ok(
      contactBox.x >= mediaBox.x + mediaBox.width - 1,
      "Desktop contact card must sit beside the gallery or photo fallback",
    );
    assert.ok(
      Math.abs(contactBox.y - mediaBox.y) <= 1,
      "Desktop contact card and business media must align at the top",
    );
  }
  return {
    arrangement: viewport.width < 1024 ? "stacked" : "side-by-side",
    media: mediaBox,
    contact: contactBox,
  };
}

async function verifyCase(page, viewport, scenario, pendingPhotos) {
  await page.goto(
    origin + "/biz/synthetic-listing?case=" + encodeURIComponent(JSON.stringify(scenario)),
    { waitUntil: scenario.delayedOpener ? "domcontentloaded" : "networkidle" },
  );
  await page.locator('[data-listing-tier="premium"]').waitFor();
  const expected = await page.evaluate(() => window.__premiumFixture.name);
  assert.deepEqual(
    await page.locator("h1").allTextContents(),
    [expected],
    "Visible premium H1 must contain only the actual business name",
  );
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
    "Premium page must fit the viewport",
  );
  const heading = page.locator(".listing-premium-heading");
  const contact = page.locator(".listing-premium-contact");
  await heading.waitFor();
  await contact.waitFor();
  const contactBox = await contact.boundingBox();
  assert.ok(
    contactBox && contactBox.width > 0 && contactBox.height > 0,
    "A defined contact card must be visible",
  );
  const hasPhone = !["website", "none", "unsafe"].includes(scenario.contact);
  const hasWebsite = !["phone", "none", "unsafe"].includes(scenario.contact);
  assert.equal(await contact.getByRole("link", { name: /^Call / }).count(), hasPhone ? 1 : 0);
  assert.equal(
    await contact.getByRole("link", { name: "Visit website" }).count(),
    hasWebsite ? 1 : 0,
  );
  assert.equal(await contact.locator('a[href=""],a[href="#"],a[href^="javascript:"]').count(), 0);
  if (!hasPhone && !hasWebsite) {
    assert.match(
      await contact.innerText(),
      /not listed|not available|unavailable|being checked|check back|contact details|no phone number or website has been published/i,
      "Missing contacts need an honest explanatory state",
    );
  }
  for (const link of await contact.locator('a[href^="https://"]').all()) {
    const rel = (await link.getAttribute("rel")) || "";
    assert.match(rel, /noopener/);
    assert.equal(/\bsponsored\b/.test(rel), Boolean(scenario.sponsored));
  }
  const trust = await contact.locator(".listing-premium-status").innerText();
  assert.match(trust, scenario.owner ? /Owner verified/ : /Unclaimed/);
  assert.match(trust, scenario.checked ? /Information checked/ : /Unverified/);
  assert.equal(
    (await page.getByText("Sponsored", { exact: true }).count()) > 0,
    Boolean(scenario.sponsored),
    "Sponsored status must stay independent of content tier",
  );
  const structured = (
    await page.locator('script[type="application/ld+json"]').allTextContents()
  ).join("");
  assert.doesNotMatch(structured, /aggregateRating|openingHours/);
  assert.match(
    await page.locator("body").innerText(),
    /Call or visit the business website for current hours/,
  );
  if (scenario.hiddenStreet) {
    assert.doesNotMatch(await page.locator("body").innerText(), /PRIVATE STREET MUST NOT APPEAR/);
    assert.doesNotMatch(structured, /PRIVATE STREET MUST NOT APPEAR/);
    assert.equal(await page.locator('a[href*="PRIVATE"]').count(), 0);
  }
  if (scenario.logo === "broken") {
    await page.waitForFunction(() => !document.querySelector(".listing-premium-logo img"));
  }
  const logoImages = page.locator(".listing-premium-logo img");
  for (const image of await logoImages.all()) {
    assert.equal(
      await image.evaluate((el) => getComputedStyle(el).objectFit),
      "contain",
      "Logo proportions must be preserved",
    );
    assert.equal(await image.evaluate((el) => el.complete && el.naturalWidth > 0), true);
  }
  if (scenario.logo === "none" || scenario.logo === "broken") {
    assert.equal(
      await logoImages.count(),
      0,
      "Absent logo must not become an invented business logo",
    );
  } else {
    assert.equal(await logoImages.count(), 1);
  }

  const gallery = page.locator(".listing-gallery-premium");
  if (await gallery.count()) await gallery.scrollIntoViewIfNeeded();
  if (scenario.delayedOpener) {
    const opener = gallery.getByRole("button").first();
    const original = await opener.elementHandle();
    await opener.focus();
    await page.keyboard.press("Enter");
    const viewer = page.getByRole("region", { name: "Selected business photo", exact: true });
    await viewer.waitFor();
    assert.match(await viewer.innerText(), /1\s+of\s+5/);
    await page.keyboard.press("ArrowRight");
    assert.match(await viewer.innerText(), /2\s+of\s+5/);
    assert.ok(pendingPhotos.length > 0, "First photo must still be awaiting its network result");
    await Promise.all(pendingPhotos.splice(0).map((route) => route.abort("failed")));
    await page.waitForFunction(
      () => !document.querySelector('.listing-gallery-premium img[src$="/photo-1.svg"]'),
    );
    assert.equal(await original.evaluate((element) => element.isConnected), false);
    assert.match(await viewer.innerText(), /1\s+of\s+4/);
    await page.keyboard.press("Escape");
    await viewer.waitFor({ state: "hidden" });
    assert.equal(
      await gallery.evaluate(
        (element) =>
          document.activeElement?.isConnected &&
          document.activeElement.matches("button") &&
          element.contains(document.activeElement),
      ),
      true,
      "Closing after the original image fails must focus a surviving gallery control",
    );
    return verifyContactLayout(page, viewport);
  }
  const usable = scenario.brokenPhotos ? 0 : scenario.photos - (scenario.brokenFirst ? 1 : 0);
  if (!usable) {
    await page.locator(".listing-premium-no-photos").waitFor();
    assert.equal(
      await page.locator(".listing-gallery-premium img").count(),
      0,
      "Absent photos must not become illustrative business-photo tiles",
    );
  } else {
    await gallery.waitFor();
    await page.waitForFunction(() => {
      const images = [...document.querySelectorAll(".listing-gallery-premium img")];
      return images.length > 0 && images.every((image) => image.complete && image.naturalWidth > 0);
    });
    assert.equal(await gallery.locator('img[src*="/category-art/"]').count(), 0);
    assert.equal(await gallery.locator('img[src*="/broken"]').count(), 0);
    for (const image of await gallery.locator("img").all()) {
      assert.equal(
        await image.evaluate((el) => getComputedStyle(el).objectFit),
        "cover",
        "Lead and thumbnail crops must share the photo treatment",
      );
      assert.ok(await image.getAttribute("alt"), "Business photographs need meaningful alt text");
    }
    const buttons = gallery.getByRole("button");
    assert.ok(
      (await buttons.count()) >= Math.min(usable, 2),
      "Gallery must expose keyboard-operable photo controls",
    );
    for (const button of await buttons.all()) {
      const box = await button.boundingBox();
      assert.ok(
        box && box.width >= 44 && box.height >= 44,
        "Gallery targets must be at least 44px",
      );
      assert.ok(await button.getAttribute("aria-label"), "Image controls need discernible names");
    }
    const trigger = buttons.first();
    await trigger.focus();
    await page.keyboard.press("Enter");
    const viewer = page.getByRole("region", { name: "Selected business photo", exact: true });
    await viewer.waitFor();
    assert.match(await viewer.innerText(), new RegExp("1\\s+of\\s+" + usable));
    assert.equal(
      await viewer.evaluate(
        (el) => el === document.activeElement || el.contains(document.activeElement),
      ),
      true,
      "Selected-photo region must receive keyboard focus",
    );
    for (const control of await viewer.getByRole("button").all()) {
      const box = await control.boundingBox();
      assert.ok(
        box && box.width >= 44 && box.height >= 44,
        "Photo-viewer controls must be at least 44px",
      );
    }
    if (usable > 1) {
      await page.keyboard.press("ArrowRight");
      assert.match(await viewer.innerText(), new RegExp("2\\s+of\\s+" + usable));
      await page.keyboard.press("ArrowLeft");
      assert.match(await viewer.innerText(), new RegExp("1\\s+of\\s+" + usable));
    }
    if (usable > 4) {
      for (let index = 2; index <= usable; index++) {
        await page.keyboard.press("ArrowRight");
        assert.match(await viewer.innerText(), new RegExp(index + "\\s+of\\s+" + usable));
      }
      assert.ok(
        (await viewer.locator("img").getAttribute("src")).endsWith(
          "/photo-" + scenario.photos + ".svg",
        ),
        "Photos beyond the four visible slots must be accessible through the viewer",
      );
    }
    await page.keyboard.press("Escape");
    await viewer.waitFor({ state: "hidden" });
    assert.equal(
      await trigger.evaluate((el) => el === document.activeElement),
      true,
      "Closing the viewer must return focus to its image control",
    );
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  return verifyContactLayout(page, viewport);
}

let origin;
try {
  await writeFile(
    resolve(fixture, "index.html"),
    '<html><body><div id="root"></div><script type="module" src="/fixture.tsx"></script></body></html>',
  );
  await writeFile(
    resolve(fixture, "fixture.tsx"),
    'import React from "react";\nimport { createRoot } from "react-dom/client";\nimport { createRouter, createRootRoute, createRoute, RouterProvider } from "@tanstack/react-router";\nimport { ListingPage } from "@/components/directory/listing-page";\nimport { publicListing } from "@/lib/directory/public-listing.mjs";\nimport "./fixture.css";\nconst options=JSON.parse(new URLSearchParams(location.search).get("case") || "{}");\nconst name=options.name==="long"\n ? "Sierra and Silver Home Services, Restoration, Repair and Maintenance of Greater Reno and the Surrounding Community"\n : options.name==="unbroken" ? "NorthernNevada"+"Business".repeat(24) : "Synthetic Local Business";\nconst photo=(i)=>location.origin+"/fixture-assets/"+(options.brokenPhotos||(options.brokenFirst&&i===1)?"broken-"+i:"photo-"+i)+".svg";\nconst logo=options.logo==="none"?null:location.origin+"/fixture-assets/logo-"+(options.logo||"wide")+".svg";\nconst card=publicListing({\n id:"40000000-0000-4000-8000-000000000001",stable_id:1,current_slug:"synthetic-listing",\n display_name:name,tagline:"Local service information for Reno.",description:"Synthetic business description used only for isolated browser verification.",\n phone_e164:options.contact==="unsafe"?"not a phone":["website","none"].includes(options.contact)?"":"+17755550100",\n website_url:options.contact==="unsafe"?"javascript:alert(1)":["phone","none"].includes(options.contact)?"":"https://fixture.example",\n city_slug:"reno",street_address:options.hiddenStreet?null:"1757 Synthetic Avenue",postal_code:"89501",is_service_area:Boolean(options.hiddenStreet),\n content_tier:options.tier||"premium",owner_verified_at:options.owner?"2026-10-20T00:00:00Z":null,\n information_checked_at:options.checked?"2026-10-20T00:00:00Z":null,is_featured:Boolean(options.sponsored),\n category_slugs:["handyman"],primary_category_slug:"handyman",primary_category_name:"Handyman",\n services:["Home repair","Window repair"],faqs:[],projects:[],\n photo_urls:Array.from({length:options.photos??5},(_,i)=>photo(i+1)),logo_url:logo\n},{cityName:"Reno",categoryName:"Handyman"});\nconst biz={...card,caseStudies:[],caseStudiesStatus:"available",email:"",reviews:[],offer:null};\nif(options.hiddenStreet){biz.street="PRIVATE STREET MUST NOT APPEAR";biz.hideStreet=true;}\nwindow.__premiumFixture={name,options};\nconst rootRoute=createRootRoute();\nconst route=createRoute({getParentRoute:()=>rootRoute,path:"/biz/synthetic-listing",component:()=> <ListingPage biz={biz} />});\nconst home=createRoute({getParentRoute:()=>rootRoute,path:"/",component:()=> <h1>Directory home fixture</h1>});\nconst router=createRouter({routeTree:rootRoute.addChildren([route,home])});\ncreateRoot(document.getElementById("root")!).render(<RouterProvider router={router}/>);\n',
  );
  await writeFile(
    resolve(fixture, "fixture.css"),
    '@import "' + resolve(root, "src/styles.css") + '";\n@source "' + resolve(root, "src") + '";\n',
  );
  await writeFile(
    resolve(fixture, "auth.mjs"),
    "export const useAuth=()=>({user:null,loading:false,signOut:async()=>{}});",
  );
  await writeFile(
    resolve(fixture, "commands.mjs"),
    'export const claimWorkflow=async()=>({ok:false});export const getMyListingClaim=async()=>({ok:true,receipt:null});export const submitListingClaim=async()=>({ok:false});export const inquiryAvailability=async()=>({available:false,siteKey:""});export const getMyLocalMember=async()=>({ok:true,member:{profile:null,experiences:[]}});export const attachExperiencePhoto=async()=>({ok:false});export const submitExperience=async()=>({ok:false});',
  );
  server = await createServer({
    configFile: false,
    root: fixture,
    cacheDir: resolve(fixture, ".vite"),
    publicDir: resolve(root, "public"),
    plugins: [
      {
        name: "isolated-premium-assets",
        configureServer(vite) {
          vite.middlewares.use((req, res, next) => {
            if (!req.url?.startsWith("/fixture-assets/")) return next();
            if (req.url.includes("broken")) {
              res.statusCode = 404;
              res.end("Synthetic missing asset");
            } else {
              res.setHeader("Content-Type", "image/svg+xml");
              res.end(localSvg(req.url));
            }
          });
        },
      },
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: [
        { find: "react", replacement: resolve(root, "node_modules/react") },
        { find: "react-dom", replacement: resolve(root, "node_modules/react-dom") },
        {
          find: "@tanstack/react-router",
          replacement: resolve(root, "node_modules/@tanstack/react-router"),
        },
        {
          find: "@workos/authkit-tanstack-react-start/client",
          replacement: resolve(fixture, "auth.mjs"),
        },
        { find: "@/lib/directory/claims", replacement: resolve(fixture, "commands.mjs") },
        { find: "@/lib/directory/inquiries", replacement: resolve(fixture, "commands.mjs") },
        { find: "@/lib/directory/members", replacement: resolve(fixture, "commands.mjs") },
        { find: "@", replacement: resolve(root, "src") },
      ],
    },
    server: { host: "127.0.0.1", port: 0, fs: { allow: [root, fixture] } },
  });
  await server.listen();
  origin = "http://127.0.0.1:" + server.httpServer.address().port;
  if (process.env.PREMIUM_BROWSER_SERVE_ONLY) {
    console.log(
      origin + "/biz/synthetic-listing?case=" + encodeURIComponent(JSON.stringify(scenarios[0])),
    );
    await new Promise(() => {});
  }
  browser = await { chromium, firefox, webkit }[engine].launch({
    headless: true,
    ...(engine === "chromium" && process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}),
  });
  for (const viewport of viewports) {
    for (const scenario of scenarios) {
      const page = await browser.newPage({ viewport });
      page.setDefaultTimeout(10000);
      const errors = [];
      const pendingPhotos = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) return route.abort();
        if (scenario.delayedOpener && url.pathname === "/fixture-assets/photo-1.svg") {
          pendingPhotos.push(route);
          return;
        }
        return route.continue();
      });
      const result = { viewport, scenario: scenario.key, passed: false };
      try {
        result.layout = await verifyCase(page, viewport, scenario, pendingPhotos);
        assert.deepEqual(errors, [], "Rendered component must not throw");
        result.passed = true;
      } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
        result.overflow = await page.evaluate(() =>
          [...document.querySelectorAll("body *")]
            .map((element) => ({
              tag: element.tagName,
              className: typeof element.className === "string" ? element.className : "",
              parent: element.parentElement?.className,
              right: Math.round(element.getBoundingClientRect().right),
              left: Math.round(element.getBoundingClientRect().left),
              text: element.children.length ? "" : element.textContent?.slice(0, 80),
            }))
            .filter((element) => element.right > innerWidth + 1 || element.left < -1)
            .sort((a, b) => b.right - a.right)
            .slice(0, 12),
        );
        throw error;
      } finally {
        if (
          !result.passed ||
          ["real-five", "no-media", "long-name-phone-only", "broken-logo"].includes(scenario.key)
        ) {
          const filename = "premium-" + viewport.width + "-" + scenario.key + ".png";
          await page.evaluate(async () => {
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
            window.scrollTo(0, 0);
            await new Promise(requestAnimationFrame);
            await new Promise(requestAnimationFrame);
          });
          result.screenshotScroll = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
          await page
            .screenshot({ path: resolve(output, filename), fullPage: true, animations: "disabled" })
            .catch(() => {});
          result.screenshot = filename;
        }
        results.push(result);
        await page.close();
      }
    }
    console.log("PASS premium viewport " + viewport.width + " (" + scenarios.length + " cases)");
  }
  console.log("PASS " + results.length + " isolated premium desktop/mobile cases");
} finally {
  await browser?.close();
  await server?.close();
  await rm(fixture, { recursive: true, force: true });
  await writeFile(
    resolve(output, "premium-listing-browser.json"),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        engine,
        results,
        limits:
          "Actual ListingPage/publicListing/CSS with synthetic local assets and signed-out auth/command fakes; external requests blocked. No hosted authentication/database/provider/Claim/inquiry mutations.",
      },
      null,
      2,
    ) + "\n",
  );
}
