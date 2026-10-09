import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    await page.route("**/*", (route) =>
      ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname)
        ? route.continue()
        : route.abort(),
    );
    await page.goto("http://127.0.0.1:8080/account");
    await page.getByRole("heading", { name: "Join the 775" }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get("next"), "/account");
    await page.goto("http://127.0.0.1:8080/login?next=%2Fstudio%2Ffixture-shop");
    await page.getByRole("link", { name: "Continue with email or Google" }).click();
    await page.getByRole("alert").filter({ hasText: "Sign-in is not configured" }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get("next"), "/studio/fixture-shop");
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `artifacts/browser/login-${width}.png`, fullPage: true });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      true,
    );
    results.push({ width, anonymousAccountRedirect: "pass", unconfiguredSignIn: "fails_closed", returnPath: "preserved" });
    await page.close();
  }
  writeFileSync(
    "artifacts/browser/auth-local.json",
    JSON.stringify(
      {
        kind: "actual_local_app_unconfigured_auth",
        authenticated: false,
        externalEffects: "none",
        results,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
