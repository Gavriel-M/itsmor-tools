# 02 · Architecture

**Status:** accepted, 23 Nov 2026 · **Previous:** [01 · Product brief](./01-product-brief.md) ·
**Next:** [03 · Technical design](./03-technical-design.md)

## Shape

A static site. No server code, no API, no database. Everything after the first load runs in
the visitor's browser.

```
            ┌──────────────────────── browser tab ────────────────────────┐
 files ───► │  UI (React)  ──jobs──►  scheduler  ──►  worker pool (1–4)   │
            │      ▲                      │              │ decode         │
            │      └──── results ◄────────┘              │ resize         │
            │                                            │ encode         │
            │  service worker: precached app + codecs    └─ codecs (wasm) │
            └─────────────────────────────────────────────────────────────┘
                  ▲ first load only
   tools.itsmor.com ── CloudFront (CSP, cache) ── S3 bucket
```

## Components

| Component          | Owns                                                                     | Does not own           |
| ------------------ | ------------------------------------------------------------------------ | ---------------------- |
| **UI**             | Drop zone, queue, settings, results, privacy panel                       | Any pixel work         |
| **Scheduler**      | Job queue, concurrency, memory budget, cancellation                      | Codecs                 |
| **Worker**         | One job at a time: decode → orient → resize → encode, plus metadata read | UI state               |
| **Codec registry** | Which decoder and encoder serve a format in this browser; lazy loading   | Policy                 |
| **Service worker** | Precache of app shell and every codec; offline                           | Anything user-supplied |

All pixel work happens off the main thread, so the UI stays at 60 fps while a batch runs.

## Decisions and why

### A worker pool sized by memory, not by cores

A decoded image costs `width × height × 4` bytes. A 24 MP iPhone photo is 98 MB before
encoding buffers; four in parallel on a phone is how a tab dies. The scheduler admits a job
only if its estimated pixel memory fits a budget (≈ 256 MB on mobile, ≈ 1 GB on desktop),
and pool size is `min(hardwareConcurrency − 1, 4)`, dropping to 1–2 on mobile.

### Native first, WebAssembly where the platform falls short

The browser's own codecs are fastest and cost nothing to download, but coverage is uneven:

| Need                        | Native gap                  | WebAssembly fill                                             |
| --------------------------- | --------------------------- | ------------------------------------------------------------ |
| Decode HEIC                 | Only Safari decodes it      | `libheif-js`                                                 |
| Encode WebP                 | Safari silently returns PNG | jSquash WebP                                                 |
| Encode AVIF                 | Not exposed by canvas       | jSquash AVIF                                                 |
| Images over ~16.7 MP on iOS | Canvas area limit           | Pure-wasm decode, resize and encode, never touching a canvas |

The registry probes capabilities once at startup and picks per format. Codecs are fetched
on first use, so a JPEG→PNG user never downloads an AVIF encoder.

### Privacy is enforced by headers, not by good intentions

CloudFront attaches a Content Security Policy whose `connect-src` is `'self'`, with no
third-party origin anywhere in the policy. Even a compromised dependency cannot send a
file out. Fonts are self-hosted. There are no analytics. Details in
[03 · Technical design](./03-technical-design.md#content-security-policy).

### Offline by construction

A service worker precaches the app and every codec on first visit. That is what makes
"turn your Wi-Fi off and try it" a demo rather than a hope.

### A separate origin

`tools.itsmor.com` gets its own bucket and distribution. Its CSP, its service worker, and any
future cross-origin isolation headers stay on its origin and cannot affect itsmor.com.

### One palette, from one package

The tool reads its colours from `@itsmor/tokens`, published from the itsmor workspace where
`src/lib/tokens.ts` is guarded today. No hex literal lives in this repo; CI fails if one
appears. The package is public — the tokens are already public in the itsmor repo, and a
private package would stop anyone from installing this one.

## Stack

| Layer      | Choice                                           | Reason                                                       |
| ---------- | ------------------------------------------------ | ------------------------------------------------------------ |
| Build      | Vite                                             | First-class workers and wasm; multi-page output S3 can serve |
| UI         | React 19, TypeScript (strict)                    | Matches itsmor                                               |
| Styles     | Tailwind v4, `@itsmor/tokens`                    | Same utilities and values as itsmor                          |
| Fonts      | Inter, IBM Plex Mono, self-hosted via Fontsource | CSP forbids Google Fonts                                     |
| Worker RPC | Comlink                                          | Typed calls instead of hand-rolled `postMessage`             |
| Metadata   | exifr                                            | Reads EXIF, GPS, XMP from JPEG and HEIC; MIT                 |
| ZIP        | fflate                                           | Small, fast, MIT, runs in a worker                           |
| Offline    | vite-plugin-pwa (Workbox)                        | Precache manifest generated from the build                   |
| Tests      | Vitest, Playwright (Chromium, WebKit, Firefox)   | Unit plus real-engine codec coverage                         |

## Licences

The repo is MIT. Every dependency is MIT, Apache-2.0 or BSD, with one exception:
**libheif (LGPL-3.0)**, the only open HEIC decoder. LGPL is compatible with an MIT app when
the library ships as a separate, replaceable module; it is loaded as its own wasm file, and
`THIRD_PARTY_NOTICES.md` carries its licence and source link. No GPL code is used, which
rules out ffmpeg builds that include x264.
