import React from "react";
import { createRoot } from "react-dom/client";
import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  Outlet,
} from "@tanstack/react-router";
import { ClaimListingPanel } from "../../../src/components/directory/claim-listing";
import { Route as Invitation } from "../../../src/routes/invitation";
import { Route as Review } from "../../../src/routes/review";
import { Route as Login } from "../../../src/routes/login";
import { Route as ListingRequest } from "../../../src/routes/list-your-business";
import { Route as Account } from "../../../src/routes/account";
import { Route as Studio } from "../../../src/routes/studio.$slug";
import "../../../src/styles.css";
window.__calls = [];
const root = createRootRoute({ component: () => <Outlet /> });
const biz = createRoute({
  getParentRoute: () => root,
  path: "/biz/$slug",
  component: () => (
    <main className="mx-auto max-w-lg p-4">
      <h1 className="font-display text-3xl">Synthetic Reno Shop</h1>
      <ClaimListingPanel
        listingId="b1000000-0000-4000-8000-000000000001"
        businessName="Synthetic Reno Shop"
        slug="fixture-shop"
        ownerVerified={false}
        website="https://fixture.example"
        listingEmail=""
      />
    </main>
  ),
});
const invitation = Invitation.update({ getParentRoute: () => root, path: "/invitation" });
const review = Review.update({ getParentRoute: () => root, path: "/review" });
const login = Login.update({ getParentRoute: () => root, path: "/login" });
const request = ListingRequest.update({ getParentRoute: () => root, path: "/list-your-business" });
const account = Account.update({ getParentRoute: () => root, path: "/account" });
const studio = Studio.update({ getParentRoute: () => root, path: "/studio/$slug" });
const routeTree = root.addChildren([biz, invitation, review, login, request, account, studio]);
createRoot(document.getElementById("root")!).render(
  <RouterProvider router={createRouter({ routeTree })} />,
);
