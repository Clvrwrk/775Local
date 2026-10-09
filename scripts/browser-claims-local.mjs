import assert from "node:assert/strict";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { chromium } from "playwright";
const root = process.cwd();
const fixture = resolve(root, "scripts/fixtures/claim-browser");
const server = await createServer({
  configFile: false,
  root,
  cacheDir: resolve(root, "node_modules/.vite-claim-fixture"),
  plugins: [tailwind(), react()],
  resolve: {
    alias: [
      { find: "@/lib/auth/use-current-user", replacement: resolve(fixture, "identity.ts") },
      {
        find: "@workos/authkit-tanstack-react-start/client",
        replacement: resolve(fixture, "identity.ts"),
      },
      { find: "@/lib/directory/claims", replacement: resolve(fixture, "commands.ts") },
      { find: "@/lib/directory/studio", replacement: resolve(fixture, "commands.ts") },
      { find: "@/lib/directory/profile", replacement: resolve(fixture, "commands.ts") },
      { find: "@/lib/directory/queries", replacement: resolve(fixture, "commands.ts") },
      { find: "@", replacement: resolve(root, "src") },
    ],
  },
  server: { host: "127.0.0.1", port: 8093, strictPort: true },
  appType: "custom",
});
// Serve the fixture HTML at application paths; only this test process has fake identity/commands.
server.middlewares.use(async (req, res, next) => {
  if (req.headers.accept?.includes("text/html") && !req.url?.startsWith("/@")) {
    const { readFileSync } = await import("node:fs");
    res.setHeader("Content-Type", "text/html");
    res.end(
      await server.transformIndexHtml(
        req.url,
        readFileSync(resolve(fixture, "index.html"), "utf8"),
      ),
    );
  } else next();
});
await server.listen();
let browser;
const results = [];
mkdirSync("artifacts/browser", { recursive: true });
try {
  browser = await chromium.launch({ headless: true });
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1280, height: 800 },
  ]) {
    const context = await browser.newContext({ viewport });
    await context.route("**/*", (route) =>
      new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort(),
    );
    async function pageFor(state, path = "/biz/fixture-shop") {
      const p = await context.newPage();
      await p.addInitScript((state) => {
        window.__fixture = state;
        if (localStorage.getItem("fixture-signed-out") === "true") window.__fixture.user = false;
      }, state);
      await p.goto("http://127.0.0.1:8093" + path);
      return p;
    }
    const page = await pageFor({ user: true, interruptEvidence: true });
    await page.getByLabel("Your authority").selectOption("listing_manager");
    const submit = page.getByRole("button", { name: "Submit work-email Claim" });
    await submit.dblclick();
    await page.getByRole("heading", { name: "Evidence for your manager claim" }).waitFor();
    assert.equal(
      await page.evaluate(() => window.__calls.length),
      1,
      "duplicate click creates one command",
    );
    await page.getByLabel("Evidence reference").fill("Synthetic registry reference 123");
    await page
      .getByLabel("Your role and this location")
      .fill("I am the authorized manager for this exact Reno location.");
    await page.getByRole("button", { name: "Send evidence for review" }).click();
    await page.getByText("Connection interrupted. Retry the same evidence").waitFor();
    await page.getByRole("button", { name: "Send evidence for review" }).click();
    await page.getByText("1 evidence reference(s) saved").waitFor();
    const evidenceCalls = await page.evaluate(() =>
      window.__calls.filter((x) => x.action === "evidence"),
    );
    assert.equal(evidenceCalls[0].key, evidenceCalls[1].key, "interrupted retry retains key");
    assert.equal(
      await page.getByRole("link", { name: "Open Studio" }).count(),
      0,
      "pending claim gives no Studio link",
    );
    await page.getByRole("button", { name: "Withdraw this claim" }).click();
    await page.getByText("Claim withdrawn", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Start a new claim with current evidence" }).click();
    await page.getByRole("button", { name: "Submit work-email Claim" }).click();
    await page.getByRole("heading", { name: "Evidence for your manager claim" }).waitFor();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      true,
    );
    await page.screenshot({
      path: `artifacts/browser/claim-${viewport.width}.png`,
      fullPage: true,
    });
    await page.close();
    const signedOut = await pageFor({ user: false });
    await signedOut.getByRole("link", { name: "Sign in to claim" }).click();
    assert.equal(new URL(signedOut.url()).searchParams.get("next"), "/biz/fixture-shop");
    assert.match(
      await signedOut
        .getByRole("link", { name: "Continue with email or Google" })
        .getAttribute("href"),
      /returnPathname=%2Fbiz%2Ffixture-shop/,
    );
    await signedOut.close();
    const historical = await pageFor({
      user: true,
      claim: { status: "approved", owner_authority: false, authority_active: false },
    });
    await historical.getByText("participation is no longer active", { exact: false }).waitFor();
    assert.equal(await historical.getByRole("link", { name: "Open Studio" }).count(), 0);
    await historical.close();
    const invite = await pageFor({ user: true }, "/invitation?token=" + "a".repeat(64));
    await invite.getByText("Synthetic Reno Shop", { exact: true }).waitFor();
    await invite.getByText("reno · listing manager", { exact: false }).waitFor();
    await invite.getByRole("button", { name: "Accept scoped invitation" }).dblclick();
    await invite.getByText("Invitation accepted.", { exact: false }).waitFor();
    assert.equal(
      await invite.evaluate(
        () => window.__calls.filter((x) => x.action === "acceptInvitation").length,
      ),
      1,
    );
    assert.equal(new URL(invite.url()).search, "");
    await invite.close();
    const review = await pageFor({ user: true }, "/review");
    await review.getByText("Requested role: listing manager").waitFor();
    assert.notEqual(
      await review.locator('option[value="approved"]').getAttribute("disabled"),
      null,
      "domain alone cannot approve",
    );
    await review.close();
    const request = await pageFor({ user: true }, "/list-your-business");
    await request.getByLabel("Business name", { exact: true }).fill("Synthetic Reno Shop");
    await request.getByLabel("Reno ZIP").fill("89502");
    await request.getByLabel("Public business phone").fill("7755550100");
    await request
      .getByLabel("What your business does")
      .fill("Synthetic home repair services for local tests.");
    await request.getByRole("button", { name: "Submit listing request" }).dblclick();
    await request.getByText("Request synthetic-request saved", { exact: false }).waitFor();
    assert.equal(await request.evaluate(() => window.__calls.length), 1);
    await request.close();
    const publication = await pageFor(
      { user: true, reviewRequests: true, interruptRequestReview: true },
      "/review",
    );
    await publication.getByRole("button", { name: "Review listing request", exact: true }).click();
    await publication.getByLabel("Request decision").selectOption("approved");
    await publication
      .getByLabel("Verified source URLs", { exact: false })
      .fill("https://fixture.example");
    await publication
      .getByLabel("Sources checked (UTC)")
      .fill(new Date(Date.now() - 3600000).toISOString().slice(0, 16));
    for (const checkbox of await publication
      .getByRole("group", { name: "Independent publication checks" })
      .getByRole("checkbox")
      .all())
      await checkbox.check();
    await publication
      .getByLabel("Decision reason (shared with requester)", { exact: true })
      .fill("Independent synthetic business review complete.");
    await publication.getByRole("button", { name: "Save request decision" }).dblclick();
    await publication
      .getByText("Connection interrupted. Retry the same decision", { exact: false })
      .waitFor();
    await publication.getByRole("button", { name: "Save request decision" }).click();
    await publication
      .getByText("Listing published. No business authority", { exact: false })
      .waitFor();
    const publicationCalls = await publication.evaluate(() =>
      window.__calls.filter((x) => x.action === "decideRequest"),
    );
    assert.equal(
      publicationCalls.length,
      2,
      "double click sends one interrupted attempt plus one retry",
    );
    assert.equal(
      publicationCalls[0].key,
      publicationCalls[1].key,
      "publication retry preserves receipt key",
    );
    assert.equal(
      await publication.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      true,
    );
    await publication.screenshot({
      path: `artifacts/browser/request-review-${viewport.width}.png`,
      fullPage: true,
    });
    await publication.close();
    for (const restriction of [{ duplicateRequest: true }, { reviewOnly: true }]) {
      const blocked = await pageFor(
        { user: true, reviewRequests: true, ...restriction },
        "/review",
      );
      await blocked.getByRole("button", { name: "Review listing request", exact: true }).click();
      await blocked.getByLabel("Request decision").waitFor();
      assert.notEqual(
        await blocked
          .locator('select[name="decision"] option[value="approved"]')
          .last()
          .getAttribute("disabled"),
        null,
      );
      await blocked.close();
    }
    const status = await pageFor(
      {
        user: true,
        requestStatuses: [
          {
            id: "status-fixture",
            name: "Synthetic Published Shop",
            status: "approved",
            slug: "fixture-shop",
          },
        ],
      },
      "/list-your-business",
    );
    await status.getByRole("link", { name: "View published listing" }).waitFor();
    assert.equal(await status.getByRole("link", { name: "Open Studio" }).count(), 0);
    await status.close();
    const profile = await pageFor(
      { user: true, actorId: "profile-a", interruptProfile: true },
      "/account",
    );
    await profile.getByLabel("Display name").fill("Synthetic Neighbor");
    await profile.getByLabel("City (optional)").selectOption("reno");
    await profile.getByLabel("Introduction (optional)").fill("Synthetic private introduction.");
    await profile.getByRole("button", { name: "Save profile", exact: true }).dblclick();
    await profile
      .getByText("Connection interrupted. Retry the same details", { exact: false })
      .waitFor();
    await profile.getByRole("button", { name: "Save profile", exact: true }).click();
    await profile.getByText("Your private profile is saved.").waitFor();
    const profileCalls = await profile.evaluate(() =>
      window.__calls.filter((x) => x.action === "save"),
    );
    assert.equal(profileCalls.length, 2);
    assert.equal(
      profileCalls[0].key,
      profileCalls[1].key,
      "response-loss retry retains profile key",
    );
    await profile.reload();
    await profile.evaluate(() => {
      window.__fixture.interruptProfile = false;
    });
    await profile.getByLabel("Display name").waitFor();
    assert.equal(await profile.getByLabel("Display name").inputValue(), "Synthetic Neighbor");
    assert.equal(
      await profile.getByLabel("Introduction (optional)").inputValue(),
      "Synthetic private introduction.",
    );
    assert.equal(
      await profile.getByText("No active listing access yet.", { exact: false }).count(),
      1,
    );
    const secondSession = await pageFor({ user: true, actorId: "profile-a" }, "/account");
    await secondSession.getByLabel("Display name").waitFor();
    assert.equal(await secondSession.getByLabel("Display name").inputValue(), "Synthetic Neighbor");
    await profile.getByLabel("Display name").fill("Updated Synthetic Neighbor");
    await profile.getByRole("button", { name: "Save profile", exact: true }).click();
    await profile.getByText("Your private profile is saved.").waitFor();
    await secondSession.getByLabel("Display name").fill("Stale Neighbor");
    await secondSession.getByRole("button", { name: "Save profile", exact: true }).click();
    await secondSession
      .getByText("Your profile changed in another session.", { exact: false })
      .waitFor();
    await secondSession.getByRole("button", { name: "Reload profile" }).click();
    await secondSession.waitForFunction(
      () => document.querySelector('[name="displayName"]')?.value === "Updated Synthetic Neighbor",
    );
    await secondSession.close();
    await profile.getByRole("button", { name: "Sign out", exact: true }).click();
    await profile.getByRole("heading", { name: "Join the 775" }).waitFor();
    assert.equal(await profile.getByLabel("Display name").count(), 0);
    await profile.evaluate(() => localStorage.removeItem("fixture-signed-out"));
    await profile.goto("http://127.0.0.1:8093/account");
    await profile.getByLabel("Display name").waitFor();
    assert.equal(
      await profile.getByLabel("Display name").inputValue(),
      "Updated Synthetic Neighbor",
    );
    await profile.evaluate(() => {
      window.__fixture.actorId = "profile-b";
      window.__fixture.interruptProfile = false;
      window.dispatchEvent(new Event("fixture-identity"));
    });
    await profile.waitForFunction(
      () => document.querySelector('[name="displayName"]')?.value === "Fixture Manager",
    );
    assert.equal(await profile.getByLabel("Introduction (optional)").inputValue(), "");
    await profile.getByLabel("Display name").fill("");
    await profile.getByRole("button", { name: "Save profile", exact: true }).click();
    assert.equal(await profile.getByLabel("Display name").evaluate((x) => x.validity.valueMissing), true);
    await profile.getByLabel("Display name").fill("Second Synthetic Neighbor");
    await profile.getByLabel("Display name").focus();
    await profile.keyboard.press("Tab");
    assert.equal(await profile.getByLabel("City (optional)").evaluate((x) => x === document.activeElement), true);
    await profile.keyboard.press("Tab");
    assert.equal(await profile.getByLabel("Introduction (optional)").evaluate((x) => x === document.activeElement), true);
    await profile.keyboard.press("Tab");
    assert.equal(await profile.getByRole("button", { name: "Save profile", exact: true }).evaluate((x) => x === document.activeElement), true);
    await profile.keyboard.press("Enter");
    await profile.getByText("Your private profile is saved.").waitFor();
    assert.equal(
      await profile.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      true,
    );
    await profile.evaluate(async () => { document.activeElement?.blur(); window.scrollTo(0, 0); await document.fonts.ready; });
    await profile.screenshot({
      path: `artifacts/browser/profile-${viewport.width}.png`,
      fullPage: true,
    });
    await profile.close();
    const owner = await pageFor({ user: true, owner: true, interruptProposal: true }, "/account");
    await owner.getByRole("link", { name: /Synthetic Reno Shop/ }).click();
    await owner.getByLabel("Business name", { exact: true }).fill("Synthetic Updated Shop");
    await owner.getByLabel("Business phone", { exact: true }).fill("invalid");
    await owner.getByRole("button", { name: "Submit changes for review" }).click();
    await owner.getByText("Connection interrupted. Retry to confirm", { exact: false }).waitFor();
    await owner.getByRole("button", { name: "Submit changes for review" }).click();
    await owner.getByText("Check the business name, description", { exact: false }).waitFor();
    await owner.getByLabel("Business phone", { exact: true }).fill("+17755550100");
    await owner
      .getByLabel("About your business")
      .fill("Synthetic edited business profile for review.");
    await owner
      .getByLabel("Services (one per line)")
      .fill("Synthetic repair\nSynthetic maintenance");
    await owner.getByRole("button", { name: "Submit changes for review" }).dblclick();
    await owner.getByText("Changes saved for review.", { exact: false }).waitFor();
    await owner.getByText("Pending review", { exact: false }).waitFor();
    const publicListing = await pageFor({ user: false }, "/biz/fixture-shop");
    await publicListing
      .getByRole("heading", { name: "Synthetic Reno Shop", exact: true })
      .waitFor();
    assert.equal(
      await publicListing.getByText("Synthetic Updated Shop").count(),
      0,
      "pending proposal remains private",
    );
    await publicListing.close();
    await owner.reload();
    await owner.getByText("Pending review", { exact: false }).waitFor();
    await owner.screenshot({
      path: `artifacts/browser/studio-${viewport.width}.png`,
      fullPage: true,
    });
    assert.equal(
      await owner.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      true,
    );
    await owner.close();
    for (const state of [{ user: true }, { user: true, owner: true }]) {
      const denied = await pageFor(
        state,
        state.owner ? "/studio/other-shop" : "/studio/fixture-shop",
      );
      await denied
        .getByText("Your account does not have the required listing permission.", { exact: false })
        .waitFor();
      assert.equal(
        await denied.getByRole("button", { name: "Submit changes for review" }).count(),
        0,
      );
      await denied.close();
    }
    const manager = await pageFor(
      { user: true, owner: true, role: "listing_manager", staleProposal: true },
      "/studio/fixture-shop",
    );
    await manager.getByLabel("Business name", { exact: true }).waitFor();
    assert.equal(await manager.getByRole("heading", { name: "Listing participants" }).count(), 0);
    await manager.getByRole("button", { name: "Submit changes for review" }).click();
    await manager.getByText("This listing changed. Reload Studio", { exact: false }).waitFor();
    await manager.close();
    const recipient = await pageFor(
      { user: true, owner: true, role: "lead_recipient" },
      "/studio/fixture-shop",
    );
    await recipient.getByRole("heading", { name: "Recipient access" }).waitFor();
    assert.equal(
      await recipient.getByRole("button", { name: "Submit changes for review" }).count(),
      0,
    );
    await recipient.close();
    await context.close();
    results.push({
      viewport,
      claimRole: "manager",
      duplicateClick: "pass",
      interruptedEvidenceRetry: "pass",
      withdrawAndRenew: "pass",
      signInReturn: "pass",
      expiredAuthority: "pass",
      invitationScopeAndAcceptance: "pass",
      domainApprovalBlocked: "pass",
      newListingRequest: "pass",
      manualPublication: "pass",
      duplicateAndPermissionBlock: "pass",
      publicationRetry: "pass",
      requesterStatus: "pass",
      privateProfileCreateEditRefresh: "pass",
      profileResponseLossReplay: "pass",
      profileSecondSessionAndStaleEdit: "pass",
      syntheticLogoutReloginAndIdentityIsolation: "pass",
      ownerPortalReviewPersistence: "pass",
      studioValidationAndCrossOwnerDenial: "pass",
      managerAndRecipientLeastPrivilege: "pass",
      profileKeyboardAndRequiredValidation: "pass",
    });
  }
  writeFileSync(
    "artifacts/browser/component-acceptance.json",
    JSON.stringify(
      {
        kind: "synthetic_component_acceptance",
        identity: "fake isolated fixture",
        providerEffects: "none; all external browser traffic blocked",
        hostedAcceptance: false,
        results,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(results));
} finally {
  await browser?.close();
  await server.close();
}
