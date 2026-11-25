# 03 · Technical design

**Status:** draft, 23 Nov 2026; updated 25 Nov 2026 for the engine as built · **Previous:** [02 · Architecture](./02-architecture.md) ·
**Next:** [04 · Implementation plan](./04-implementation-plan.md)

## Repository layout

```
src/
  app/              UI: pages, components, hooks
  engine/
    index.ts        createConverter, the only module the UI imports
    inspect.ts      sniff.ts and dimensions.ts: format and size from the bytes
    plan.ts         path choice, output size, output names
    scheduler.ts    queue, memory budget, cancellation
    remote.ts       spawns a worker and wraps it with Comlink
    worker.ts       the job runner, exposed via Comlink
    pipeline.ts     decode → resize → encode, in the worker
    capabilities.ts the probes, run in the worker; samples/ holds their HEIC and AVIF
    codecs/         registry.ts (data), loaders.ts (lazy imports), one module per codec
    metadata.ts     what an input carries, read with exifr; report.ts maps it
    colour.ts       Display P3 → sRGB, for wasm-decoded pixels
    errors.ts       error codes and their messages
public/             icons, manifest
docs/               these documents
tests/              vitest units, vitest browser tests, generated fixture images
```

The sniffing and probes planned for `src/lib/` live in the engine; `src/lib/` will hold UI
formatting when it has some.

Two HTML entry points: `/` (the tools index) and `/convert/` (the converter). Each builds to
its own `index.html`, which S3 serves without rewrite rules.

## The job

```ts
type Job = {
  file: Blob;
  target: "jpeg" | "png" | "webp"; // "avif" arrives in phase 5
  quality: number; // 0–1; ignored for PNG
  maxDimension?: number; // longest edge, px
};

type JobResult = {
  output: Blob;
  width: number;
  height: number;
  metadata: {
    report: Record<
      "location" | "camera" | "lens" | "dateTaken" | "software",
      "removed" | "absent"
    >;
    colourProfile: string | null;
    orientation: number | null;
  };
  path: { decode: "native" | "wasm"; encode: "native" | "wasm" };
  ms: number; // time in the worker
};

const converter = createConverter();
const { result, cancel } = converter.convert(job); // result: Promise<JobResult>
converter.dispose();
```

Each `convert` returns its own handle, so a job needs no id. `result` rejects with a
`ConvertError` carrying a `code` and a plain-English `message`. The `Blob` is passed to the
worker without copying its bytes; the output `Blob` comes back the same way. The main thread
never holds decoded pixels.

## Pipeline, per job

On the main thread, from the first 256 KB of the file (all of it if the header runs longer):

1. **Sniff the type from bytes, not the name or MIME type.** Magic numbers: `FF D8 FF`
   (JPEG), `89 50 4E 47` (PNG), `RIFF…WEBP`, `GIF8`, `BM`, and for `ftyp` the major brand:
   `heic|heix|hevc|heim|heis` (HEIC), `avif|avis` (AVIF), or the generic `mif1|msf1`, read as
   AVIF if a compatible brand says so and as HEIC otherwise. A `.jpg` that is a HEIC is
   common from iPhone exports. Unknown bytes fail as `unsupported-input`.
2. **Read the dimensions from the header**: the JPEG SOF, PNG IHDR, GIF screen, BMP DIB,
   WebP VP8/VP8L/VP8X, or the largest HEIF `ispe`. No dimensions means `corrupt`.
3. **Plan the path** (below) and **request admission** from the scheduler with the
   reservation those dimensions imply.

In the worker:

1. **Read metadata** with exifr, in parallel with decoding: GPS, make and model, lens, date
   taken, software, plus orientation and the ICC profile's name. For WebP, exifr is given
   the `EXIF` chunk, which it cannot find by itself. Each report field is `removed` if the
   input had it and `absent` if not; orientation is applied to pixels, not reported.
2. **Decode.**
   - Native path: `createImageBitmap(blob, { imageOrientation: "from-image" })`, which also
     applies EXIF orientation. A failure here is `corrupt`.
   - Wasm path: the matching jSquash decoder, or libheif for HEIC, producing RGBA pixels.
     Orientation is applied by rotating the buffer.
3. **Resize** if `maxDimension` is set: fit the longest edge, keep the aspect ratio, never
   upscale. Native: draw to an `OffscreenCanvas` at the target size with
   `imageSmoothingQuality = "high"`, onto white when the target is JPEG, which has no alpha.
   Wasm: jSquash resize (Lanczos3).
4. **Encode.**
   - JPEG: mozjpeg, from pixels read back off the canvas or out of the wasm decoder. The
     native encoder is 3.7× larger at a comparable setting
     ([05 · Spike findings](./05-spike-findings.md#size)).
   - PNG: `OffscreenCanvas.convertToBlob`. **Check the returned `blob.type`**: engines that
     do not support a type silently return PNG.
   - WebP: native where supported, jSquash otherwise (phase 5; until then
     `encode-unsupported`).
   - AVIF: always jSquash (phase 5).
   - Encoders write fresh files, so **no input metadata survives**. That is the guarantee the
     report rests on, and a browser test re-reads every output with exifr to hold it. The
     encoders' own technical tags are fresh, not inherited: WebKit's PNG encoder writes
     colour space and pixel size, Chromium's WebP encoder an sRGB profile.
5. **Return** the result and release the bitmap (`bitmap.close()`) at once.

### Choosing the path

```
pixels > canvasLimit (probed)         ─► wasm, end to end
format not natively decodable          ─► wasm decode
target is JPEG                         ─► mozjpeg from canvas pixels
target not natively encodable          ─► wasm encode
otherwise                              ─► native
```

`pixels` is the output size, the canvas the native path actually allocates. A path whose
codec is not in the registry fails before any worker starts: `too-large`,
`decode-unsupported` or `encode-unsupported`. Phase 5 fills those paths by adding codecs.

`canvasLimit` is probed once per session: allocate a canvas of 100, 50, 25, 16.7 and 4.2 MP
in turn and keep the first whose far corner pixel reads back. The often-quoted 16.7 MP iOS
limit did not hold for an `OffscreenCanvas` in a worker on iOS 18.7, which took 24.5 MP
([05](./05-spike-findings.md)); the 25 MP step keeps such phones on the native path.

## Scheduler

- Concurrency: `min(navigator.hardwareConcurrency - 1, 4)`, at least 1; at most 2 when
  `navigator.deviceMemory <= 4` or on a touch-primary device (`pointer: coarse`).
- Memory budget: 256 MB under the same two conditions, 1 GB otherwise. A job reserves
  `w × h × 4 × 2.5` (decoded pixels, plus resize and encode buffers) and waits if the
  reservation does not fit. One job larger than the whole budget still runs, alone. The queue
  is strictly first in, first out, so a large job is never starved by small ones behind it.
- Workers are created on demand and reused while idle.
- Cancellation: removing a file from the queue terminates its worker if it is running, and a
  fresh worker replaces it when the next job starts. A job not yet admitted is just dropped.
- Failure is per file, never per batch. Each error names the reason in words, not a stack
  trace:

| Code                 | Message                                              |
| -------------------- | ---------------------------------------------------- |
| `unsupported-input`  | This file isn't an image format Convert can read.    |
| `corrupt`            | This file looks damaged, so it couldn't be read.     |
| `decode-unsupported` | This browser can't open this kind of image yet.      |
| `encode-unsupported` | This browser can't save to this format yet.          |
| `too-large`          | This image is too large for this browser to convert. |
| `cancelled`          | The conversion was cancelled.                        |
| `failed`             | Something went wrong converting this file.           |

The worker returns failures as data, `{ ok: false, code }`, because Comlink does not carry
custom error fields across.

## Codec registry

```ts
const DECODERS = [
  { id: "native", path: "native", formats: INPUT_FORMATS },
] as const;
const ENCODERS = [
  { id: "canvas", path: "native", formats: ["png", "webp"] },
  { id: "mozjpeg", path: "wasm", formats: ["jpeg"] },
] as const;
```

The registry is data, read by the planner on the main thread. A separate worker-only map
from each id to a dynamic import (`codecs/loaders.ts`) does the loading, so the main thread
never bundles a codec; its types make an entry without a loader a compile error. Phase 5
adds entries for libheif, jSquash WebP and AVIF, and jSquash resize.

Capabilities are probed once per session in a short-lived worker (encode a 1×1 image to
each type and check `blob.type`; the canvas limit above) and cached in `sessionStorage`.
Native HEIC and AVIF decoding is decided on the first job of that format, by decoding a
16 × 16 sample bundled with the worker; deciding from the user's own file would mistake a
corrupt file for an unsupported format. The UI uses the same probe to say when something
will be slower: _"AVIF is encoded in software here, so expect a few seconds per photo."_

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
P3, wasm-decoded pixels go through a P3 → sRGB matrix in linear light before encoding
(`colour.ts`, with lookup tables for both transfer curves). v1
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

- **Unit (Vitest, Node):** type sniffing, header dimensions, path selection, scheduler
  admission and cancellation with fake workers, file naming, metadata mapping against the
  fixtures, the P3 matrix.
- **Engine in the browser (Vitest browser mode, Playwright, Chromium + WebKit):** the real
  worker, end to end. Every input × output; EXIF orientation; `maxDimension`; alpha flattened
  for JPEG; a Display P3 JPEG within a mean error of 3/255 of its ColorSync sRGB reference;
  the report's removed and absent; typed errors for corrupt and unsupported input; and
  cancellation. Every output is re-read with exifr. Fixtures are generated by
  `tools/fixtures.sh`, never taken from photographs.
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
