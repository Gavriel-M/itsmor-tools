# 03 · Technical design

**Status:** draft, 23 Nov 2026 · **Previous:** [02 · Architecture](./02-architecture.md) ·
**Next:** [04 · Implementation plan](./04-implementation-plan.md)

## Repository layout

```
src/
  app/            UI: pages, components, hooks
  engine/
    scheduler.ts  queue, memory budget, cancellation
    worker.ts     the job runner, exposed via Comlink
    pipeline.ts   decode → orient → resize → encode, pure and unit-tested
    codecs/       registry.ts plus one module per codec, each lazily imported
    metadata.ts   what an input carries, for the report
  lib/            formatting, file-type sniffing, capability probes
public/           icons, manifest
docs/             these documents
tests/            vitest units, playwright e2e, fixture images
```

Two HTML entry points: `/` (the tools index) and `/convert/` (the converter). Each builds to
its own `index.html`, which S3 serves without rewrite rules.

## The job

```ts
type Job = {
  id: string;
  file: File;
  target: "image/jpeg" | "image/png" | "image/webp" | "image/avif";
  quality: number; // 0–1; ignored for PNG
  maxDimension?: number; // longest edge, px
};

type JobResult = {
  id: string;
  output: Blob;
  width: number;
  height: number;
  removed: MetadataItem[]; // for the report
  codecPath: "native" | "wasm";
  ms: number;
};
```

The `File` is passed to the worker without copying; the output `Blob` comes back the same
way. The main thread never holds decoded pixels.

## Pipeline, per job

1. **Sniff the type from bytes, not the name or MIME type.** Magic numbers: `FF D8 FF`
   (JPEG), `89 50 4E 47` (PNG), `RIFF…WEBP`, `ftyp` + `heic|heix|mif1` (HEIC),
   `ftyp` + `avif` (AVIF), `GIF8`, `BM`. A `.jpg` that is a HEIC is common from iPhone
   exports.
2. **Read metadata** with exifr, before anything discards it: GPS, make and model, date
   taken, software, orientation. This becomes the report.
3. **Estimate memory** from the header's dimensions and request admission from the
   scheduler.
4. **Decode.**
   - Native path: `createImageBitmap(blob, { imageOrientation: "from-image" })`, which also
     applies EXIF orientation.
   - Wasm path: the matching jSquash decoder, or libheif for HEIC, producing RGBA pixels.
     Orientation is applied by rotating the buffer.
5. **Resize** if `maxDimension` is set. Native: draw to an `OffscreenCanvas` at the target size
   with `imageSmoothingQuality = "high"`. Wasm: jSquash resize (Lanczos3).
6. **Encode.**
   - JPEG: mozjpeg, from pixels read back off the canvas or out of the wasm decoder. The
     native encoder is 3.7× larger at a comparable setting
     ([05 · Spike findings](./05-spike-findings.md#size)).
   - PNG: `OffscreenCanvas.convertToBlob`. **Check the returned `blob.type`**: engines that
     do not support a type silently return PNG.
   - WebP: native where supported, jSquash otherwise.
   - AVIF: always jSquash.
   - Encoders write fresh files, so **no input metadata survives**. That is the guarantee the
     report rests on, and an e2e test re-reads every output with exifr to hold it.
7. **Return** the result and release the bitmap (`bitmap.close()`) at once.

### Choosing the path

```
pixels > canvasLimit (≈16.7 MP on iOS) ─► wasm, end to end
format not natively decodable          ─► wasm decode
target not natively encodable          ─► wasm encode
otherwise                              ─► native
```

`canvasLimit` is probed at startup: allocate a test canvas and check whether a pixel can be
read back.

## Scheduler

- Concurrency: `min(navigator.hardwareConcurrency - 1, 4)`; at most 2 when
  `navigator.deviceMemory <= 4` or on a touch-primary device.
- Memory budget: 256 MB on mobile, 1 GB otherwise. A job reserves
  `w × h × 4 × 2.5` (decoded pixels, plus resize and encode buffers) and waits if the
  reservation does not fit. One job larger than the whole budget still runs, alone.
- Cancellation: removing a file from the queue terminates its worker if it is running, and a
  fresh worker replaces it.
- Failure is per file, never per batch. Each error names the reason in words: _"This HEIC uses
  a feature the decoder doesn't support"_, not a stack trace.

## Codec registry

```ts
interface Codec {
  id: string;
  decodes?: Format[];
  encodes?: Format[];
  load(): Promise<void>; // dynamic import of JS glue plus wasm
}
```

Capabilities are probed once (encode a 1×1 image to each type, check `blob.type`) and cached
in `sessionStorage`. The UI uses the same probe to say when something will be slower: _"AVIF
is encoded in software here, so expect a few seconds per photo."_

## Content Security Policy

Served by a CloudFront response headers policy, not a `<meta>` tag, so it also covers the
service worker and wasm requests:

```
default-src 'none';
script-src 'self' 'wasm-unsafe-eval';
worker-src 'self';
connect-src 'self';
img-src 'self' blob: data:;
style-src 'self';
font-src 'self';
manifest-src 'self';
base-uri 'none';
form-action 'none';
frame-ancestors 'none';
```

`connect-src 'self'` is needed so the app can fetch its own codecs. No third-party origin
appears anywhere. Alongside it: `Referrer-Policy: no-referrer`,
`Permissions-Policy` denying camera, microphone and geolocation, and
`X-Content-Type-Options: nosniff`.

Tailwind and React emit no inline styles that need `'unsafe-inline'`; any dynamic style goes
through CSS custom properties set from a class, and the e2e suite fails on any CSP violation
report.

## The privacy panel

A small, always-visible panel:

- **Network requests since you added files: 0.** Counted with a `PerformanceObserver` on
  `resource` entries made after the first file is added, plus a service-worker hook that
  reports any fetch it handles. If the number ever moves, the panel shows what was requested.
- **Works offline:** a status that turns green once the service worker has precached
  everything, with a nudge to try it with Wi-Fi off.
- **How to check it yourself:** three lines pointing at the Network tab and the response's CSP
  header.

## Colour

iPhone photos are Display P3. Pixels drawn into a default canvas are converted to sRGB by the
browser; libheif returns pixels in the file's space. When the input's ICC profile is Display
P3, wasm-decoded pixels go through a P3 → sRGB matrix in linear light before encoding. v1
writes sRGB only, the space every viewer agrees on. Measured against ColorSync, both paths
match within compression noise; leaving P3 unconverted loses 16% of saturation
([05 · Spike findings](./05-spike-findings.md#colour)).

## Design system

- Colours, fonts and spacing come from `@itsmor/tokens`: `tokens.css` (a Tailwind v4 `@theme`
  block) and `tokens.ts` (the `PALETTE` object).
- The itsmor contrast rules apply as written: text in ink or lapis; terracotta only at full
  opacity; gold and amber are never text or state; `opacity-70` is the floor for text.
- The 4 rem grid, the hairline grid background, mono labels and bordered mono buttons follow
  itsmor's primitives. Interactive states use lapis; focus rings use terracotta, as itsmor does.
- `pnpm tokens:check` here fails if a hex literal appears anywhere under `src/`.

## Accessibility

- The drop zone is a real `<input type="file" multiple>` wrapped in a label, so it works with a
  keyboard, a screen reader and the mobile photo picker.
- Progress and completion are announced through one `aria-live="polite"` region, batched so a
  50-file run does not read out 50 lines.
- Every result reachable and downloadable by keyboard; reduced motion respected.

## Performance budget

| Metric                                | Budget          |
| ------------------------------------- | --------------- |
| Initial JS, gzipped                   | < 100 KB        |
| Largest Contentful Paint, 4G mobile   | < 1.5 s         |
| 12 MP HEIC → JPEG, mid-range laptop   | < 2 s           |
| Main-thread long tasks during a batch | none over 50 ms |

Codecs are excluded from the initial budget because they load on demand and are cached by the
service worker.

## Testing

- **Unit (Vitest):** type sniffing, path selection, scheduler admission, file naming, metadata
  mapping.
- **End to end (Playwright, Chromium + WebKit + Firefox):** every input × output pair with
  fixture images, including a portrait-orientation JPEG, a P3 HEIC, a 24 MP image, a mislabelled
  file and a corrupt one. Each run asserts that:
  - outputs decode and have the expected dimensions;
  - exifr finds no metadata in any output;
  - no request left the origin, and none happened after files were added;
  - no CSP violation was reported.
- **Manual on real devices** before each release: an iPhone (Safari) and a mid-range Android
  (Chrome).

## Deployment

- S3 bucket, private, read through CloudFront with Origin Access Control.
- CloudFront: an ACM certificate (us-east-1) for `tools.itsmor.com`, the response headers
  policy above, and a `/` → `/convert/` redirect while there is only one tool.
- Caching follows itsmor's `deploy.sh`: hashed assets for a year, HTML and the service worker
  with `max-age=0, must-revalidate`.
- GitHub Actions deploys `main` through OIDC to an IAM role scoped to this bucket and
  distribution. No long-lived keys.

## Open risks

| Risk                                           | Mitigation                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------- |
| libheif cannot decode some newer HEIC variants | Safari uses its native decoder first; the error names the limitation      |
| iOS kills the tab on large batches             | Memory budget, sequential processing on mobile, an honest limit in the UI |
| Colour shifts on P3 photos                     | Device test in phase 2, not at the end                                    |
| AVIF encoding is slow in wasm                  | Default speed setting tuned for ~1–3 s per 12 MP; progress shown          |
| A token change in itsmor breaks this UI        | Pinned package version; Renovate-style bump PRs                           |
