import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyListingRow, launchCategoryFor } from "./listing-candidate.mjs";

const base = {
  title: "Example Heating",
  category: "HVAC contractor",
  group: "Home Services",
  additional_categories: "Heating contractor",
  street_address: "123 Main St",
  city: "Sparks",
  zip: "89431",
  phone: "+1 775-555-0100",
  domain: "exampleheating.com",
  url: "https://exampleheating.com",
  latitude: 39.53,
  longitude: -119.75,
  rating_value: 4.8,
  rating_votes_count: 120,
  is_claimed: true,
  place_id: "place-1",
  cid: "cid-1",
  work_time: JSON.stringify({ work_hours: { current_status: "open", timetable: {} } }),
  contact_info: JSON.stringify([
    { type: "mail", value: "hello@exampleheating.com", source: "backlinks" },
  ]),
  check_url: "https://example.invalid/check",
};

test("the category crosswalk excludes phone-screen repair from window screen repair", () => {
  assert.equal(
    launchCategoryFor({
      category: "Mobile phone repair shop",
      additional_categories: "Screen repair service",
      group: "Retail & Shopping",
    }),
    null,
  );
  assert.equal(
    launchCategoryFor({
      category: "Screen repair service",
      additional_categories: "Window installation service",
      group: "Home Services",
    }),
    "screen-repair",
  );
});

test("the category crosswalk consumes cached Excel formula results", () => {
  assert.equal(
    launchCategoryFor({
      category: "Mexican restaurant",
      group: {
        formula: "INDEX('Category Map'!B:B, 1)",
        result: "Restaurants & Food",
      },
    }),
    "restaurants",
  );
});

test("a fully evidenced row enters the private eligible review queue", () => {
  const candidate = classifyListingRow("businesses-89431", 2, base);
  assert.equal(candidate.launch_category_slug, "hvac");
  assert.equal(candidate.city_slug, "sparks");
  assert.equal(candidate.phone_e164, "+17755550100");
  assert.equal(candidate.business_email, "hello@exampleheating.com");
  assert.equal(candidate.screening_status, "eligible");
  assert.deepEqual(candidate.screening_reasons, []);
  assert.match(candidate.proposed_slug, /^example-heating-[a-f0-9]{8}$/);
  assert.equal(candidate.evidence.transform_version, "launch-candidate-v1");
});

test("closure and missing first-party contact evidence never become eligible", () => {
  const candidate = classifyListingRow("businesses-89431", 3, {
    ...base,
    is_claimed: false,
    phone: "702-555-0100",
    domain: null,
    url: null,
    contact_info: null,
    work_time: JSON.stringify({ work_hours: { current_status: "closed_forever" } }),
  });
  assert.equal(candidate.active_profile_status, "closed_forever");
  assert.equal(candidate.screening_status, "ineligible");
  assert.ok(candidate.screening_reasons.includes("closed_forever"));
  assert.ok(candidate.screening_reasons.includes("business_domain_email_missing"));
  assert.ok(candidate.screening_reasons.includes("non_775_phone"));
});

test("fringe geography is excluded instead of silently relabeled", () => {
  assert.equal(
    classifyListingRow("businesses-89436", 4, { ...base, city: "Spanish Springs" }),
    null,
  );
});
