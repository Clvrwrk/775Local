import assert from "node:assert/strict";
import { test } from "node:test";
import {
  telephoneHref,
  safeWebsite,
  visibleServices,
  visibleProjects,
} from "../src/lib/directory/presentation.mjs";
import { pilotFilters, categoryForQuery } from "../src/lib/directory/pilot.mjs";

test("telephone links preserve E.164 and normalize local numbers without double-prefixing", () => {
  for (const input of ["+17753339880", "7753339880", "(775) 333-9880", "1 775 333 9880"]) {
    assert.equal(telephoneHref(input), "tel:+17753339880");
  }
  for (const input of [
    "+117753339880",
    "",
    "javascript:alert(1)",
    "775",
    "0000000000",
    "7753339880 ext 12",
  ]) {
    assert.equal(telephoneHref(input), null);
  }
  assert.equal(telephoneHref("+442079460123"), "tel:+442079460123");
});

test("public destinations reject executable and credential-bearing URLs", () => {
  assert.equal(safeWebsite("https://example.com/contact"), "https://example.com/contact");
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,hi",
    "https://name:secret@example.com",
    "/relative",
  ])
    assert.equal(safeWebsite(url), null);
});

test("pilot discovery is Reno-only without rewriting a requested historical listing", () => {
  assert.equal(pilotFilters({}).city, "reno");
  assert.equal(pilotFilters({ city: "sparks" }).city, "reno");
  assert.equal(pilotFilters({ slug: "existing-sparks-business" }).city, undefined);
  assert.equal(pilotFilters({ q: "repair" }).q, "repair");
});

test("exact service aliases resolve without consuming arbitrary business-name queries", () => {
  assert.equal(categoryForQuery("AC repair"), "hvac");
  assert.equal(categoryForQuery("plumber"), "plumbing");
  assert.equal(categoryForQuery("Dirty Plumber"), null);
});

test("navigation fragments and empty project shells do not become business services", () => {
  assert.deepEqual(
    visibleServices([
      "Our Mission",
      "Why choose us",
      "Drain cleaning",
      "Drain cleaning",
      "Call to schedule a Service Estimate",
    ]),
    ["Drain cleaning"],
  );
  assert.deepEqual(
    visibleProjects([
      { title: "Gallery" },
      { title: "Kitchen repair", description: "Repaired a leaking fixture" },
    ]),
    [{ title: "Kitchen repair", description: "Repaired a leaking fixture" }],
  );
});
