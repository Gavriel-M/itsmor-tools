# 04 · Implementation plan

**Status:** draft, 23 Nov 2026 · **Previous:** [03 · Technical design](./03-technical-design.md)

Ordered so the riskiest unknowns are measured first, and so each phase ends with something
that runs.

| # | Phase | Ends with | Depends on |
|---|---|---|---|
| 0 | **Repo and docs** | This repo, public, with documents 01–04 | — |
| 1 | **`@itsmor/tokens`** (itsmor PR `ITSMOR-0016`) | `packages/tokens` in the itsmor workspace, the guard moved to it, published to npm | npm org `itsmor` |
| 2 | **Spike: the hard paths** | A throwaway page converting a 24 MP P3 HEIC to JPEG and AVIF on an iPhone, with timings and colour compared | — |
| 3 | **Scaffold** | Vite, React, Tailwind, tokens, fonts, lint, format, CI; the empty page in itsmor's design | Phase 1 (or a temporary local link) |
| 4 | **Engine** | Sniffing, worker, scheduler, native path, JPEG/PNG/WebP; unit tests | 3 |
| 5 | **Wasm codecs** | HEIC decode, AVIF and WebP encode, the large-image path, the capability probe | 2, 4 |
| 6 | **UI** | Drop zone, queue, settings, results, before and after sizes, ZIP, metadata report | 4 |
| 7 | **Privacy and offline** | CSP in dev and preview, service worker, the privacy panel | 6 |
| 8 | **Hardening** | Playwright across three engines, accessibility pass, performance budget, device test | 7 |
| 9 | **Deploy** | `tools.itsmor.com/convert` live through CloudFront | AWS access, DNS |
| 10 | **Portfolio entry** | A card on itsmor.com `/work` and a line in the GitHub profile README | 9 |

## Phase 1 in detail

The itsmor guard (`pnpm tokens:check`) asserts that every palette hex lives in
`src/lib/tokens.ts`. Moving the source of truth into a package changes that invariant, so
the PR must:

1. Create `packages/tokens` with `src/tokens.ts` (the current `PALETTE`, `DARK_BANNER`,
   `GRID_LINE`, `withAlpha`) and a build emitting `tokens.js`, `tokens.d.ts` and
   `tokens.css` (the `@theme` block).
2. Make `src/lib/tokens.ts` re-export from the package, so no import site in itsmor changes.
3. Point `tools/check-tokens.mjs` and `tools/gen-tokens.mjs` at the package, and keep the
   location-based exemption as `MAINTAINING.md` requires. A new hex anywhere else must still
   fail.
4. Add a publish workflow (manual dispatch, npm provenance) for `@itsmor/tokens`.

## Blocked on you

| Item | Needed by | What to do |
|---|---|---|
| npm org `itsmor` | Phase 1 publish | `npm login`, then create the free org at npmjs.com/org/create |
| AWS access | Phase 9 | The profile used for itsmor, and where `itsmor.com` DNS is hosted |
