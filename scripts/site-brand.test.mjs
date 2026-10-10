import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("home brand has an explicitly sized flex item and a visible wordmark on every viewport", async () => {
  const shell = await read("src/components/layout/site-shell.tsx");
  const css = await read("src/styles.css");
  assert.match(shell, /to="\/" className="site-brand" aria-label="775Directory home"/);
  assert.match(shell, /<BrandLogo className="site-brand-logo" \/>/);
  assert.match(css, /\.site-brand\s*\{[^}]*width:\s*160px;[^}]*flex:\s*0 0 160px;/s);
  assert.match(css, /\.site-brand-logo\s*\{[^}]*width:\s*100%;[^}]*height:\s*auto;/s);
  assert.doesNotMatch(css, /\.listing-shell > header img\s*\{[^}]*width:\s*auto;/s);
});

test("brand wordmark dimensions match the source asset aspect ratio", async () => {
  const logo = await read("src/components/brand/logo.tsx");
  const svg = await read("public/brand/775directory-lockup-horizontal.svg");
  assert.match(svg, /viewBox="0 0 267 48"/);
  assert.match(logo, /width="267"\s+height="48"/);
});
