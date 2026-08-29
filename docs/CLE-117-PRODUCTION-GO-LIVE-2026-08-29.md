# CLE-117 Production Go-Live Receipt — 2026-08-29

## Outcome

`https://775directory.com` is live on Vercel Production with the canonical-host, crawler, sitemap, and honest empty-state contracts enforced. This receipt does not claim that Google has indexed the domain, that any Business Listing has been published, or that Claim/outreach is complete.

## Reviewed repository lineage

- [PR #4](https://github.com/Clvrwrk/775Local/pull/4), merged as `17e780895fa60cbfc61c535387b65604d56bee78`: consolidated launch surface, indexability thresholds, truthful metadata/legal copy, and bounded sitemap.
- [PR #5](https://github.com/Clvrwrk/775Local/pull/5), merged as `76d8d4db254861aff76e561ee6fd41119dd06017`: canonical `www` redirect and `noindex` header for public Vercel aliases.
- [PR #6](https://github.com/Clvrwrk/775Local/pull/6), merged as `0d6065f9dc42c735594d22f7b2fbdc710e08a51d`: public IndexNow key, bounded sitemap submission, failure receipts, and the 10,000-URL provider limit.

The final PR #6 fixed point passed the hosted Foundation Gate, Vercel deployment, Greptile review, and CodeRabbit review with every review thread resolved. Local Node 24 tests passed, with TypeScript, ESLint, Prettier, secret scanning, and diff checks clean.

## Production and DNS evidence

- Vercel deployment: `dpl_GjXh6XffwxNfKUVT5udZXmsPpH3G`
- Deployment URL: `https://reno-local-directory-81us35r2i-cleverwork.vercel.app`
- Production aliases: `https://775directory.com`, `https://www.775directory.com`, and Vercel project aliases.
- Cloudflare pre-change snapshot: `/private/tmp/local775-cloudflare-before.json`
- Changed records: apex and `www` only, from Namecheap forwarding/parking to the Vercel DNS target.
- Preserved records: five registrar MX records and the SPF TXT record.
- Live apex: HTTP 200 from Vercel.
- Live `www` path/query probe: HTTP 308 to the same apex path/query.
- Public DNS: apex and `www` resolve to Vercel.

## Crawl and indexing evidence

- `https://775directory.com/robots.txt`: HTTP 200, public crawl allowed, private/runtime paths excluded, apex sitemap declared.
- `https://775directory.com/sitemap.xml`: HTTP 200 with exactly six currently eligible canonical URLs.
- `https://775directory.com/738605bcc41cbc13f8943448c1bdae49.txt`: HTTP 200 and exact repository-key match.
- IndexNow submitted at `2026-08-29T15:44:31.313Z`: six URLs, HTTP 202, accepted `true`, no response body, no failure.
- Google Search Console: authenticated account has no `sc-domain:775directory.com` property. Direct sitemap submission returned HTTP 403 for insufficient property permission. The connector blocks property creation unless its server environment explicitly enables that operation, and the browser control bridge could not establish its trusted runtime. Google submission and confirmed indexing remain blocked, not complete.

IndexNow URL set:

1. `https://775directory.com/`
2. `https://775directory.com/about`
3. `https://775directory.com/categories`
4. `https://775directory.com/cities`
5. `https://775directory.com/privacy`
6. `https://775directory.com/terms`

## Visual acceptance

- Desktop and mobile home-page probes returned HTTP 200.
- Title: `775Directory | Find local businesses in Northern Nevada`
- Canonical: `https://775directory.com/`
- No horizontal overflow.
- Zero browser console errors and page errors.
- Desktop screenshot: `/Users/chussey/.codex/visualizations/2026/08/28/01a04941-cdab-7911-bf13-d22f79733112/local775-live-desktop.png`
- Mobile screenshot: `/Users/chussey/.codex/visualizations/2026/08/28/01a04941-cdab-7911-bf13-d22f79733112/local775-live-mobile.png`

## Retained boundaries and blockers

- Supabase Production was not migrated or written.
- No candidate was selected and no Business Listing was published.
- Public Listing/discovery leaves remain empty or `noindex` until reviewed-listing thresholds are satisfied.
- CLE-104 remains the reviewed-publication dependency.
- CLE-106 still needs human-assisted callback, session, Actor projection, and negative Operator-authorization acceptance.
- CLE-107 Claim completion and CAT-82 seed outreach remain blocked by CLE-104 and CLE-106. No seed message was sent.

## Accounting

`CAT-81 ↔ CLE-117 ↔ this repository receipt ↔ /Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/CODEX/docs/linear/teams/CLE/2026-08-29-local775-production-go-live.md`

Status: the public launch and IndexNow submission are complete. Google Search Console ownership/submission, confirmed indexing, Listing publication, Claim completion, and outreach are explicitly incomplete.
