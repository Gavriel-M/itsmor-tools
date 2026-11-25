# 04 · Implementation plan

**Status:** in progress, updated 25 Nov 2026 · **Previous:** [03 · Technical design](./03-technical-design.md)

Ordered so the riskiest unknowns are measured first, and so each phase ends with something
that runs.

| #   | Phase                                          | Ends with                                                                                                   | Depends on                          | State       |
| --- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------- | ----------- |
| 0   | **Repo and docs**                              | This repo, public, with documents 01–04                                                                     | —                                   | Done        |
| 1   | **`@itsmor/tokens`** (itsmor PR `ITSMOR-0016`) | `packages/tokens` in the itsmor workspace, the guard moved to it, published to npm                          | npm org `itsmor`                    | Done        |
| 2   | **Spike: the hard paths**                      | A throwaway page converting a 24 MP P3 HEIC to JPEG and AVIF on an iPhone, with timings and colour compared | —                                   | Mostly done |
| 3   | **Scaffold**                                   | Vite, React, Tailwind, tokens, fonts, lint, format, CI; the empty page in itsmor's design                   | Phase 1 (or a temporary local link) | Done        |
| 4   | **Engine**                                     | Sniffing, worker, scheduler, native path, JPEG/PNG/WebP; unit tests                                         | 3                                   | Done        |
| 5   | **Wasm codecs**                                | HEIC decode, AVIF and WebP encode, the large-image path, the capability probe                               | 2, 4                                |             |
| 6   | **UI**                                         | Drop zone, queue, settings, results, before and after sizes, ZIP, metadata report                           | 4                                   |             |
| 7   | **Privacy and offline**                        | CSP in dev and preview, service worker, the privacy panel                                                   | 6                                   |             |
| 8   | **Hardening**                                  | Playwright across three engines, accessibility pass, performance budget, device test                        | 7                                   |             |
| 9   | **Deploy**                                     | `tools.itsmor.com/convert` live through CloudFront                                                          | AWS access, DNS                     |             |
| 10  | **Portfolio entry**                            | A card on itsmor.com `/work` and a line in the GitHub profile README                                        | 9                                   |             |

## Done so far

**Phase 0.** This repo is public at
[Gavriel-M/itsmor-tools](https://github.com/Gavriel-M/itsmor-tools) with documents 01–04.

**Phase 1.** `@itsmor/tokens` lives in `packages/tokens` in the itsmor workspace and is on
npm. [itsmor #17](https://github.com/Gavriel-M/itsmor/pull/17) moved the palette into the
package and the guard with it; [itsmor #18](https://github.com/Gavriel-M/itsmor/pull/18)
bumped it to 0.1.1, the first version published by the workflow through npm trusted
publishing, with provenance. 0.1.1 is the latest version. As built, the module is
`src/index.ts` and the stylesheet ships as `@itsmor/tokens/theme.css`, not the `tokens.ts`
and `tokens.css` named below; it also exports `GRID_CELL` and puts `--grid-cell` and
`--grid-line` on `:root`.

**Phase 2.** Measured on Chromium, WebKit and an iPhone; the findings and the decisions they
forced are in [05 · Spike findings](./05-spike-findings.md). Outstanding: the 24 MP sample and
two picker variants on the iPhone.

**Phase 3.** Vite multi-page build with `/` and `/convert/`, React 19, strict TypeScript,
Tailwind v4 reading `@itsmor/tokens` from npm rather than a local link, Inter and IBM Plex
Mono self-hosted through Fontsource, ESLint, Prettier, Vitest, a hex guard and CI. `/convert/`
is the empty page in itsmor's design: the promise, a drop zone that is a real file input, and
the formats. Selecting files does nothing yet; that is phase 6. How it fits together is in
[`CLAUDE.md`](../CLAUDE.md).

**Phase 4.** `src/engine/` converts JPEG, PNG, WebP, GIF, BMP, and HEIC where the browser
decodes it, to JPEG, PNG and WebP, behind one call: `createConverter().convert(job)`. Files
are sniffed by their bytes and sized from their headers on the main thread; a Comlink worker
pool decodes natively, resizes on a canvas and encodes JPEG with mozjpeg. The scheduler
holds the memory budget and the concurrency limit, and cancels by terminating the worker.
The report credits only what the input carried. Paths that need wasm — HEIC on Chromium,
WebP on Safari, images over the canvas limit — fail with a named error that phase 5
replaces by adding codecs; the P3 → sRGB matrix phase 5 needs is in place and tested.
93 engine unit tests run in Node and 36 engine tests in each of Chromium and WebKit, on
fixtures generated
by `tools/fixtures.sh`; every output is re-read with exifr. A 3.8 MP JPEG re-encodes in
about 0.56 s in Chromium and 0.65 s in WebKit on the Mac. The changes from the design are
recorded in [03 · Technical design](./03-technical-design.md).

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

| Item       | Needed by | What to do                                                        |
| ---------- | --------- | ----------------------------------------------------------------- |
| AWS access | Phase 9   | The profile used for itsmor, and where `itsmor.com` DNS is hosted |
