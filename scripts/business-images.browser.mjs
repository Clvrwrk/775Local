import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { chromium } from "playwright";
import { startMediaRuntime } from "./fixtures/business-images/runtime.mjs";
import { listing } from "./fixtures/business-images/db.mjs";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "artifacts/business-images");
await mkdir(output, { recursive: true });
const fixture = await mkdtemp(resolve(output, "browser-fixture-"));
let runtime, server, browser;
const results = [];
try {
  runtime = await startMediaRuntime();
  await writeFile(
    resolve(fixture, "index.html"),
    '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/fixture.tsx"></script></body></html>',
  );
  await writeFile(
    resolve(fixture, "fixture.css"),
    `@import "${resolve(root, "src/styles.css")}";\n@source "${resolve(root, "src")}";\n`,
  );
  await writeFile(
    resolve(fixture, "media-client.mjs"),
    `
const origin=location.origin;
const identity=()=>new URLSearchParams(location.search).get('as')??'';
export const uploadImage=({data})=>fetch(origin+'/fixture/upload',{method:'POST',headers:{'x-fixture-identity':identity()},body:data}).then(r=>r.json());
export const imageCommand=({data})=>fetch(origin+'/fixture/command',{method:'POST',headers:{'Content-Type':'application/json','x-fixture-identity':identity()},body:JSON.stringify(data)}).then(r=>r.json());
`,
  );
  await writeFile(
    resolve(fixture, "auth.mjs"),
    `export const useAuth=()=>({user:new URLSearchParams(location.search).get('as')?{id:'synthetic-user',email:'fixture@example.invalid'}:null,loading:false,signOut:async()=>{}});`,
  );
  await writeFile(
    resolve(fixture, "claims.mjs"),
    `export const claimWorkflow=async()=>({ok:false});export const getMyListingClaim=async()=>({ok:true,receipt:null});export const submitListingClaim=async()=>({ok:false});export const inquiryAvailability=async()=>({available:false,siteKey:''});`,
  );
  await writeFile(
    resolve(fixture, "fixture.tsx"),
    `
import React from 'react';import {createRoot} from 'react-dom/client';import {createRootRoute,createRoute,createRouter,RouterProvider} from '@tanstack/react-router';
import {BusinessImagePanel} from '@/components/directory/business-image-panel';import {SiteShell} from '@/components/layout/site-shell';import {ListingPage} from '@/components/directory/listing-page';import {mapDirectoryListing} from '@/lib/supabase/public-directory.mjs';import './fixture.css';
const origin=location.origin;const listing=${JSON.stringify(listing)};
const card=mapDirectoryListing({id:listing,stable_id:1,current_slug:'synthetic-business',display_name:'Synthetic Local Business',description:'Owned synthetic test imagery for a local business listing.',city_slug:'reno',postal_code:'89502',is_service_area:true,content_tier:'basic',category_slugs:['handyman']},{cityName:'Reno',categoryName:'Handyman'});
const root=createRootRoute();const studio=createRoute({getParentRoute:()=>root,path:'/studio/synthetic-business',component:()=> <SiteShell><main className="app-page p-4"><h1>Synthetic Local Business Studio</h1><BusinessImagePanel listingId={listing}/></main></SiteShell>});
const review=createRoute({getParentRoute:()=>root,path:'/review-images',component:()=> <SiteShell><main className="app-page p-4"><h1>Operator image review fixture</h1><BusinessImagePanel review/></main></SiteShell>});
const publicRoute=createRoute({getParentRoute:()=>root,path:'/biz/synthetic-business',loader:async()=>{const images=await fetch(origin+'/fixture/public?listingId='+listing).then(r=>r.json());return images.map(i=>({...i,url:i.url.replace('https://775directory.com',origin)}));},component:()=>{const images=publicRoute.useLoaderData();return <ListingPage biz={{...card,businessImages:images,email:'',lat:null,lng:null,categories:[],reviews:[],photos:[],services:[],faqs:[],projects:[],offer:null,caseStudies:[],caseStudiesStatus:'unavailable'}}/>;}});
const router=createRouter({routeTree:root.addChildren([studio,review,publicRoute])});createRoot(document.getElementById('root')!).render(<RouterProvider router={router}/>);
`,
  );
  server = await createServer({
    configFile: false,
    root: fixture,
    publicDir: resolve(root, "public"),
    plugins: [react(), tailwind()],
    resolve: {
      alias: [
        {
          find: "@/lib/directory/business-images",
          replacement: resolve(fixture, "media-client.mjs"),
        },
        {
          find: "@workos/authkit-tanstack-react-start/client",
          replacement: resolve(fixture, "auth.mjs"),
        },
        { find: "@/lib/directory/claims", replacement: resolve(fixture, "claims.mjs") },
        { find: "@/lib/directory/inquiries", replacement: resolve(fixture, "claims.mjs") },
        { find: "@", replacement: resolve(root, "src") },
      ],
    },
    server: {
      host: "127.0.0.1",
      port: 0,
      fs: { allow: [root] },
      proxy: { "/fixture/": runtime.origin, "/api/business-images": runtime.origin },
    },
  });
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ??
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    return route.abort();
  });
  const pixels = await sharp({
    create: { width: 120, height: 80, channels: 3, background: "#24786d" },
  })
    .png()
    .withExif({ IFD0: { Artist: "PRIVATE FIXTURE" } })
    .toBuffer();
  const upload = async (kind, alt, interrupt = false) => {
    await page.goto(origin + "/studio/synthetic-business?as=owner");
    await page.getByLabel("Image purpose", { exact: true }).selectOption(kind);
    await page
      .getByLabel("Image file (JPEG, PNG or WebP; maximum 2 MB)", { exact: true })
      .setInputFiles({ name: "synthetic.png", mimeType: "image/png", buffer: pixels });
    await page.getByLabel("Describe the image for visitors", { exact: true }).fill(alt);
    await page
      .getByLabel("Source and rights evidence", { exact: true })
      .fill("Created from owned synthetic pixels for local testing");
    await page
      .getByLabel(
        "I have authority to submit this image and permission for its public directory use.",
        { exact: true },
      )
      .check();
    if (interrupt) runtime.interruptStorage();
    await page.getByRole("button", { name: "Submit image for review", exact: true }).click();
    if (interrupt) {
      await page
        .getByText("The image action could not be confirmed. Retry to check its saved status.", {
          exact: true,
        })
        .waitFor();
      await page.reload();
      await page.getByRole("button", { name: "Resume upload", exact: true }).click();
      await page
        .getByText(
          "Resuming saved upload. Select the same original file and confirm its publication rights.",
          { exact: true },
        )
        .waitFor();
      await page
        .getByLabel("Image file (JPEG, PNG or WebP; maximum 2 MB)", { exact: true })
        .setInputFiles({ name: "synthetic.png", mimeType: "image/png", buffer: pixels });
      await page
        .getByLabel(
          "I have authority to submit this image and permission for its public directory use.",
          { exact: true },
        )
        .check();
      await page.getByRole("button", { name: "Submit image for review", exact: true }).click();
    }
    await page
      .getByText("Saved privately for Operator review. Your public listing has not changed.", {
        exact: true,
      })
      .waitFor();
    await page.reload();
    await page.getByText(alt, { exact: true }).waitFor();
  };
  await upload("image", "Synthetic teal photograph", true);
  results.push("upload, interrupted retry and refresh persisted");
  await page.screenshot({ path: resolve(output, "owner-pending-mobile.png"), fullPage: true });
  await page.goto(origin + "/studio/synthetic-business?as=other");
  await page
    .getByText("Your current listing role does not allow image submissions.", { exact: true })
    .waitFor();
  assert.equal(await page.getByText("Synthetic teal photograph", { exact: true }).count(), 0);
  results.push("cross-owner UI denied");
  await page.goto(origin + "/biz/synthetic-business");
  assert.equal(await page.getByAltText("Synthetic teal photograph", { exact: true }).count(), 0);
  results.push("pending image absent publicly");
  await page.goto(origin + "/review-images?as=stale");
  await page
    .getByText("Sign in again as an authorized Operator before reviewing images.", { exact: true })
    .waitFor();
  results.push("stale Operator UI denied");
  const approve = async (alt) => {
    await page.goto(origin + "/review-images?as=operator");
    await page.getByText(alt, { exact: true }).waitFor();
    await page.getByRole("button", { name: "Preview image", exact: true }).click();
    await page.getByAltText(alt, { exact: true }).waitFor();
    await page.getByLabel("Decision", { exact: true }).selectOption("approved");
    await page
      .getByLabel("Review reason", { exact: true })
      .fill("Synthetic image rights and business association verified");
    await page.getByRole("button", { name: "Save image decision", exact: true }).click();
    await page
      .getByText("Confirm publication rights and complete the image preview before approval.", {
        exact: true,
      })
      .waitFor();
    await page
      .getByLabel(
        "I verified publication rights and the image accurately represents this business.",
        { exact: true },
      )
      .check();
    await page.screenshot({
      path: resolve(
        output,
        "operator-preview-" + (alt.includes("logo") ? "logo" : "photo") + ".png",
      ),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Save image decision", exact: true }).click();
    await page.getByText("Image approved for this listing.", { exact: true }).waitFor();
  };
  await approve("Synthetic teal photograph");
  results.push("preview, rights gate and approval");
  await upload("logo", "Synthetic business logo");
  await approve("Synthetic business logo");
  results.push("separate logo upload and review");
  await page.goto(origin + "/biz/synthetic-business");
  await page.getByAltText("Synthetic teal photograph", { exact: true }).waitFor();
  await page.getByAltText("Synthetic business logo", { exact: true }).waitFor();
  const schema = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
  assert.equal(schema.image.length, 1);
  assert.notEqual(schema.logo, schema.image[0]);
  assert.equal(
    await page.getByLabel("Business photographs", { exact: true }).getByRole("img").count(),
    1,
  );
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: resolve(output, "published-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.reload();
  await page.getByAltText("Synthetic business logo", { exact: true }).waitFor();
  await page.screenshot({ path: resolve(output, "published-desktop.png"), fullPage: true });
  results.push("public mobile/desktop, accurate alt text and separate visible/schema logo/photo");
  assert.deepEqual(errors, []);
  assert.equal(
    (
      await runtime.db.query(
        "select count(*)::int as n from app.media_assets where status='approved'",
      )
    ).rows[0].n,
    2,
  );
  console.log("PASS " + results.length + " local Mac Chrome image journeys");
} catch (error) {
  for (const context of browser?.contexts() ?? [])
    for (const page of context.pages()) {
      await page.screenshot({ path: resolve(output, "failed-browser.png"), fullPage: true });
      await writeFile(
        resolve(output, "failed-browser.txt"),
        String(error) + "\n" + (await page.locator("body").innerText()),
      );
    }
  throw error;
} finally {
  await browser?.close();
  await server?.close();
  await runtime?.close();
  await rm(fixture, { recursive: true, force: true });
  await writeFile(
    resolve(output, "browser-results.json"),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        results,
        limits:
          "Installed Mac Chrome, headless; actual React components and image commands; synthetic auth transport, local PGlite PostgreSQL with RLS and storage HTTP/filesystem shim. No hosted JWT verification, bucket/provider acceptance or production changes.",
      },
      null,
      2,
    ) + "\n",
  );
}
