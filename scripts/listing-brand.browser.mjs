import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { chromium } from "playwright";

// Actual ListingPage/SiteShell/CSS, with signed-in/out AuthKit and command fakes.
// No user profile, hosted data, mail, proof uploads or provider calls.
const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "artifacts/release-audit");
await mkdir(output, { recursive: true });
const fixture = await mkdtemp(resolve(output, "location-browser-fixture-"));
let server, browser;
const results = [];
try {
  await writeFile(
    resolve(fixture, "index.html"),
    '<html><body><div id="root"></div><script type="module" src="/fixture.tsx"></script></body></html>',
  );
  await writeFile(
    resolve(fixture, "auth.mjs"),
    'export const useAuth=()=>({user:sessionStorage.getItem("signedIn")==="yes"?{id:"synthetic-user",firstName:"Test",lastName:"User",email:"test@example.invalid"}:null,loading:false,signOut:async()=>{}});',
  );
  await writeFile(
    resolve(fixture, "commands.mjs"),
    'export const claimWorkflow=async()=>({ok:false}); export const getMyListingClaim=async()=>null; export const submitListingClaim=async()=>({ok:false}); export const inquiryAvailability=async()=>({available:false,siteKey:""});',
  );
  await writeFile(
    resolve(fixture, "fixture.css"),
    `@import "${resolve(root, "src/styles.css")}";\n@source "${resolve(root, "src")}";\n`,
  );
  await writeFile(
    resolve(fixture, "fixture.tsx"),
    `
import React from "react";
import { createRoot } from "react-dom/client";
import { createRouter, createRootRoute, createRoute, RouterProvider } from "@tanstack/react-router";
import { SiteShell } from "@/components/layout/site-shell";
import { ListingPage } from "@/components/directory/listing-page";
import { mapDirectoryListing } from "@/lib/supabase/public-directory.mjs";
import "./fixture.css";
const physical=new URLSearchParams(location.search).get("physical")==="yes";
const card=mapDirectoryListing({id:"40000000-0000-4000-8000-000000000001",stable_id:1,current_slug:"synthetic-listing",display_name:"Synthetic Local Business",description:"Verified synthetic business description for local browser tests.",phone_e164:"+17755550100",website_url:"https://fixture.example",city_slug:"reno",street_address:physical?"1757 Synthetic Avenue":null,postal_code:physical?"89431":null,is_service_area:!physical,address_locality:physical?"Sparks":null,service_area_names:["Reno","Sparks"],content_tier:"standard",services:["Home Repair","Home Remodeling","Gallery Wall Installation","Home","Gallery"],hours_text:"Office hours: Monday–Friday 9am–4pm.",category_slugs:["handyman"]},{cityName:"Reno",categoryName:"Handyman"});
const biz={...card,photos:[],faqs:[],projects:[],reviews:[],offers:[],offer:null,caseStudies:[],caseStudiesStatus:"unavailable",email:"",lat:null,lng:null};
const rootRoute=createRootRoute();
const route=createRoute({getParentRoute:()=>rootRoute,path:"/biz/synthetic-listing",component:()=> <ListingPage biz={biz} />});
const homeRoute=createRoute({getParentRoute:()=>rootRoute,path:"/",component:()=> <SiteShell><h1>Directory home fixture</h1></SiteShell>});
const router=createRouter({routeTree:rootRoute.addChildren([route,homeRoute])});
createRoot(document.getElementById("root")!).render(<RouterProvider router={router}/>);
`,
  );
  server = await createServer({
    configFile: false,
    root: fixture,
    publicDir: resolve(root, "public"),
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: [
        {
          find: "@workos/authkit-tanstack-react-start/client",
          replacement: resolve(fixture, "auth.mjs"),
        },
        { find: "@/lib/directory/claims", replacement: resolve(fixture, "commands.mjs") },
        { find: "@/lib/directory/inquiries", replacement: resolve(fixture, "commands.mjs") },
        { find: "@", replacement: resolve(root, "src") },
      ],
    },
    server: {
      host: "127.0.0.1",
      port: process.env.LISTING_BRAND_SERVE_ONLY ? 8080 : 0,
      fs: { allow: [root] },
    },
  });
  await server.listen();
  const address = server.httpServer.address();
  const origin = `http://127.0.0.1:${address.port}`;
  if (process.env.LISTING_BRAND_SERVE_ONLY) {
    console.log(`Synthetic brand fixture ready at ${origin}/biz/synthetic-listing`);
    await new Promise(() => {});
  }
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}),
  });
  for (const viewport of [
    { width: 320, height: 740 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1180, height: 757 },
    { width: 1280, height: 800 },
  ]) {
    for (const physical of [false, true]) {
      for (const signedIn of [false, true]) {
        const page = await browser.newPage({ viewport });
        await page.addInitScript(
          (value) => sessionStorage.setItem("signedIn", value ? "yes" : "no"),
          signedIn,
        );
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.route("**/*", (route) =>
          new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
        );
        await page.goto(`${origin}/biz/synthetic-listing?physical=${physical ? "yes" : "no"}`, {
          waitUntil: "networkidle",
        });
        await page
          .getByRole("heading", { name: "Synthetic Local Business", exact: true })
          .waitFor();
        const home = page.getByRole("link", { name: "775Directory home", exact: true });
        const homeBox = await home.boundingBox();
        assert.ok(
          homeBox && homeBox.width >= 130 && homeBox.height >= 44,
          "Home target must be visible and tappable",
        );
        const authBox = await page
          .getByRole(signedIn ? "button" : "link", {
            name: signedIn ? "Sign out" : "Sign in",
            exact: true,
          })
          .boundingBox();
        assert.ok(
          authBox && homeBox.x + homeBox.width <= authBox.x,
          "Brand and auth controls must not overlap",
        );
        const wordmark = home.getByAltText("775Directory", { exact: true });
        assert.equal(await wordmark.isVisible(), true);
        const logoBox = await wordmark.boundingBox();
        assert.ok(
          logoBox && logoBox.width >= 130 && logoBox.height > 20,
          "Loaded logo must have rendered dimensions",
        );
        assert.equal(await home.getAttribute("href"), "/");
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
        );
        if (viewport.width === 390) {
          assert.equal(
            await page
              .getByRole("navigation", { name: "Mobile navigation" })
              .evaluate((el) => getComputedStyle(el).position),
            "fixed",
          );
          assert.equal(
            await page
              .locator('nav[aria-label="Mobile navigation"] > div')
              .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length),
            4,
          );
        }
        assert.ok(
          await page
            .locator('img[alt="775Directory"]')
            .first()
            .evaluate((el) => el.complete && el.naturalWidth > 0),
        );
        await home.focus();
        await page.keyboard.press("Enter");
        await page.getByRole("heading", { name: "Directory home fixture" }).waitFor();
        const homeWordmark = page.getByRole("link", { name: "775Directory home", exact: true });
        assert.ok((await homeWordmark.boundingBox())?.width >= 130);
        await page.goBack();
        await page
          .getByRole("heading", { name: "Synthetic Local Business", exact: true })
          .waitFor();
        await page.getByRole("link", { name: "775Directory home", exact: true }).click();
        await page.getByRole("heading", { name: "Directory home fixture" }).waitFor();
        await page.goBack();
        await page
          .getByRole("heading", { name: "Synthetic Local Business", exact: true })
          .waitFor();
        assert.deepEqual(errors, []);
        const name = `listing-brand-${viewport.width}-${physical ? "physical" : "service"}`;
        await page.screenshot({
          path: resolve(output, `${name}-${signedIn ? "signed-in" : "signed-out"}.png`),
          fullPage: true,
        });
        results.push({
          viewport,
          physical,
          signedIn,
          passed: true,
          screenshot: `${name}-${signedIn ? "signed-in" : "signed-out"}.png`,
        });
        await page.close();
      }
    }
  }
  console.log(`PASS ${results.length} isolated Chromium mobile/desktop cases`);
} finally {
  await browser?.close();
  await server?.close();
  await rm(fixture, { recursive: true, force: true });
  await writeFile(
    resolve(output, "listing-brand-browser-20261010.json"),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        results,
        limits:
          "Synthetic ListingPage and home SiteShell with signed-in/out auth and command fakes; Chromium only, external fonts blocked, no hosted authentication or database acceptance.",
      },
      null,
      2,
    ) + "\n",
  );
}
