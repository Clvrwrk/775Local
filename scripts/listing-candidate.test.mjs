import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyListingRow,
  launchCategoriesFor,
  launchCategoryFor,
} from "./listing-candidate.mjs";

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
  assert.equal(candidate.evidence.transform_version, "launch-candidate-v2");
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

test("ambiguous launch categories fail closed into review", () => {
  const row = {
    ...base,
    category: "HVAC contractor",
    additional_categories: "Electrician",
  };
  assert.deepEqual(launchCategoriesFor(row), ["hvac", "electrical"]);
  const candidate = classifyListingRow("businesses-89431", 5, row);
  assert.equal(candidate.screening_status, "needs_review");
  assert.ok(candidate.screening_reasons.includes("launch_category_ambiguity"));
  assert.deepEqual(candidate.evidence.launch_category_matches, ["hvac", "electrical"]);

  const screenRepair = classifyListingRow("businesses-89431", 8, {
    ...base,
    additional_categories: "Window screen repair service",
  });
  assert.equal(screenRepair.launch_category_slug, "hvac");
  assert.equal(screenRepair.screening_status, "needs_review");
  assert.deepEqual(screenRepair.evidence.launch_category_matches, ["hvac", "screen-repair"]);

  const restaurant = classifyListingRow("businesses-89431", 9, {
    ...base,
    additional_categories: "Restaurant",
  });
  assert.equal(restaurant.launch_category_slug, "hvac");
  assert.equal(restaurant.screening_status, "needs_review");
  assert.deepEqual(restaurant.evidence.launch_category_matches, ["hvac", "restaurants"]);

  assert.equal(
    classifyListingRow("businesses-89431", 10, {
      ...base,
      category: "General contractor",
      additional_categories: "Electrician",
    }),
    null,
  );
});

test("practitioner and service-area entity risks require review", () => {
  const practitioner = classifyListingRow("businesses-89431", 6, {
    ...base,
    title: "Example Dental",
    category: "Dentist",
    additional_categories: "Dental clinic",
  });
  assert.equal(practitioner.screening_status, "needs_review");
  assert.ok(practitioner.screening_reasons.includes("practitioner_entity_review"));

  const serviceArea = classifyListingRow("businesses-89431", 7, {
    ...base,
    street_address: null,
  });
  assert.equal(serviceArea.screening_status, "needs_review");
  assert.ok(serviceArea.screening_reasons.includes("service_area_address_review"));
});
