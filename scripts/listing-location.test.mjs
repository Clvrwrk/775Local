import assert from "node:assert/strict";
import { test } from "node:test";
import { listingLocationStructuredData } from "../src/lib/directory/structured-data.mjs";

test("service-area discovery never creates a physical address", () => {
  for (const street of [undefined, "", "  ", "Service area"]) {
    assert.deepEqual(listingLocationStructuredData({ street, cityName: "Reno", zip: "89501" }), {
      areaServed: "Reno, Nevada",
    });
  }
});

test("hidden residential addresses stay absent from all location metadata", () => {
  assert.deepEqual(
    listingLocationStructuredData({
      street: "123 Private Lane",
      hideStreet: true,
      cityName: "Reno",
      zip: "89501",
    }),
    { areaServed: "Reno, Nevada" },
  );
});

test("physical locality is independent from the discovery or service-area city", () => {
  const actual = listingLocationStructuredData({
    street: "1757 Shaber Ave",
    cityName: "Reno",
    zip: "89431",
    verifiedAddressLocality: "Sparks",
  });
  assert.equal(actual.address.addressLocality, "Sparks");
  assert.equal(actual.address.streetAddress, "1757 Shaber Ave");
  assert.equal(actual.address.postalCode, "89431");
  assert.equal(actual.areaServed, undefined);
});

test("unverified physical locality is omitted rather than inferred from discovery", () => {
  const actual = listingLocationStructuredData({
    street: "7025 Longley Lane Suite 40",
    cityName: "Reno",
    zip: "89511",
  });
  assert.equal(actual.address.addressLocality, undefined);
  assert.equal(actual.address.streetAddress, "7025 Longley Lane Suite 40");
});

test("unknown location and invalid postal codes are omitted", () => {
  assert.deepEqual(listingLocationStructuredData({}), {});
  const actual = listingLocationStructuredData({
    street: "1 Main Street",
    zip: "call for an appointment",
  });
  assert.equal(actual.address.postalCode, undefined);
});
