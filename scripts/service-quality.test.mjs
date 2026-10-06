import assert from "node:assert/strict";
import { test } from "node:test";
import { visibleServices } from "../src/lib/directory/presentation.mjs";
import { extractServiceCandidates } from "./enrichment-archive-lib.mjs";

const debris = [
  "Copyright 2026 — All rights reserved",
  "Powered by Website Builder",
  "Before",
  "After",
  "Hours of Operation",
  "Page not found",
  "404 error",
  "Call us at 775-555-0100",
  "Contact",
  "Get a free quote",
  "Join our team",
  "View our gallery",
  "Privacy Policy",
  "Multi-window discount",
  "Save 10% on multiple windows",
  "info@mysite.com",
  "KTPStudio",
  "Terms and Conditions",
];

test("published service display removes observed footer, navigation, error and promotion debris", () => {
  assert.deepEqual(visibleServices([...debris, "Screen Repair", "Window Screen Replacement"]), [
    "Screen Repair",
    "Window Screen Replacement",
  ]);
});

test("service deduplication normalizes spacing and case without rewriting supported wording", () => {
  assert.deepEqual(
    visibleServices(["  Screen   Repair ", "screen repair", "SCREEN REPAIR", "Door Repair"]),
    ["Screen Repair", "Door Repair"],
  );
});

test("archive candidates use the same conservative service rules without changing raw evidence", () => {
  const page = {
    url: "https://fixture.example/services",
    markdown: [...debris, "Screen Repair", "Window Screen Replacement"]
      .map((v) => `## ${v}`)
      .join("\n"),
  };
  const original = structuredClone(page);
  assert.deepEqual(
    extractServiceCandidates([page]).sort(),
    ["Screen Repair", "Window Screen Replacement"].sort(),
  );
  assert.deepEqual(page, original);
});

test("legitimate service names containing nearby keywords survive", () => {
  const values = [
    "Home Repair",
    "Home Remodeling",
    "Home Automation",
    "Gallery Wall Installation",
    "Services for Seniors",
    "After-hours Plumbing",
    "Window Installation",
    "Screen Door Repair",
    "Employment Law",
    "Insurance Restoration",
  ];
  assert.deepEqual(visibleServices(values), values);
});

test("archive acquisition preserves real service phrases adjacent to complete navigation labels", () => {
  const services = ["Home Repair", "Home Remodeling", "Gallery Wall Installation"];
  const page = {
    url: "https://fixture.example/services",
    markdown: ["Home", "Gallery", "Services", ...services, ...debris]
      .map((v) => `## ${v}`)
      .join("\n"),
  };
  assert.deepEqual(extractServiceCandidates([page]).sort(), [...services].sort());
});
