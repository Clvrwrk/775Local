import assert from "node:assert/strict";
import { test } from "node:test";
import {
  telephoneHref,
  safeWebsite,
  listingDescription,
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

test("dummy latin is replaced with a sentence from the listing", () => {
  const cleaned = listingDescription({
    name: "Reno Fine Dining",
    primaryCategory: "Restaurants",
    cityName: "Reno",
    description:
      "Consectetur adipisicing elit. Cum debitis, ipsum est ipsam vitae vel, quam in sint reprehenderit.",
  });
  assert.equal(
    cleaned,
    "Reno Fine Dining is listed for restaurants in Reno. Contact the business for current service details.",
  );
  assert.equal(
    listingDescription({
      name: "Burke Roofing",
      primaryCategory: "Roofing",
      cityName: "Reno",
      description: "Burke Roofing replaces and repairs roofs in Reno.",
    }),
    "Burke Roofing replaces and repairs roofs in Reno.",
  );
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
      "(775) 367-7900",
      "Call 775-296-8988 or complete the form below.",
      "Phone (775) 853-3444 Fax (775) 853-3441",
      "Hours of Operation",
      "Monday:7:30-5:00",
      "Saturday:Closed",
      "Monday - Friday 7:30AM - 5:30PM",
      "11:00 AM - 09:00 PM",
      "9 AM - 5 PM",
      "Monday September 7th",
      "7111 S. Virgina Șt. Reno, NV 89511",
      "1121 Corporate Blvd, Reno, NV 89502",
      "225 E Prater Way",
      "450 E Plumb Ln",
      "590 N Virginia St",
      "225 E Prater Way • (775) 356-7500",
      "Reno",
      "Sparks",
      "Reno, NV",
      "01 . Reno, NV",
      "Roof Maintenance and Roof Repair in Reno",
      "Vino Reno",
      "Provide same-day repairs",
      "After Hours",
      "Sunday open mic",
    ]),
    [
      "Drain cleaning",
      "Roof Maintenance and Roof Repair in Reno",
      "Vino Reno",
      "Provide same-day repairs",
      "After Hours",
      "Sunday open mic",
    ],
  );
  assert.deepEqual(
    visibleProjects([
      { title: "Gallery" },
      { title: "Kitchen repair", description: "Repaired a leaking fixture" },
    ]),
    [{ title: "Kitchen repair", description: "Repaired a leaking fixture" }],
  );
});
