# 05 · Spike findings

**Status:** 25 Nov 2026; two iPhone picker variants are outstanding ·
**Changes:** [03 · Technical design](./03-technical-design.md)

Phase 2 measured the paths the design was least sure of, before any engine code. The spike
page was throwaway and is not in this repo.

## Setup

- Samples: macOS wallpaper HEICs re-encoded by `sips` at 24 MP (5712 × 4284) and 12 MP
  (4032 × 3024), in Display P3 and in sRGB, with GPS, camera, lens, date and software written
  by exiftool.
- Pipeline per sample, in a module worker: sniff → exifr → native decode through a canvas →
  libheif decode → P3 → sRGB → mozjpeg → AVIF → exifr on every output.
- Engines: headless Chromium and WebKit on an M-series MacBook Pro; Safari on an iPhone
  (iOS 18.7, 4 cores) over HTTPS on the local network.
- Colour: every output compared with a reference that ColorSync converted to sRGB, by mean
  absolute error per channel and mean saturation.

## Speed, 12 MP P3 HEIC → JPEG

| Engine         | Native decode + encode | libheif + convert + mozjpeg | AVIF (single thread) |
| -------------- | ---------------------- | --------------------------- | -------------------- |
| Chromium, Mac  | cannot decode HEIC     | 1.7 s                       | 4.2 s                |
| WebKit, Mac    | 0.15 s                 | 1.8 s                       | 3.6 s                |
| Safari, iPhone | 0.45 s                 | 3.9 s                       | 8.1 s                |

At 24 MP on the Mac: native 0.35 s (WebKit), wasm 4.0–4.2 s, AVIF 7–8 s.

At 24 MP on the iPhone: native 0.84 s (0.33 s decode, 0.51 s encode), libheif + convert +
mozjpeg 8.5 s, AVIF 14.6 s. The full 5712 × 4284 `OffscreenCanvas` worked in the worker, so
the 16.7 MP iOS canvas limit did not apply; the engine's canvas probe gained a 25 MP step.

## Size

At "quality 0.85" the native encoder wrote 1.95 MB; mozjpeg at quality 85 wrote 0.53 MB, from
the same pixels. The two scales do not correspond.

## Colour

| Output                        | Mean abs. error | Saturation vs reference 123.5 |
| ----------------------------- | --------------- | ----------------------------- |
| libheif → JPEG, P3 left as is | 7.99 / 255      | 104.3 (−16%)                  |
| libheif → P3 → sRGB → JPEG    | 0.93 / 255      | 123.6                         |
| Native canvas → JPEG          | 0.90 / 255      | 123.8                         |
| sRGB control → JPEG           | 0.82 / 255      | 123.6                         |

The canvas converts to sRGB by itself. libheif does not; its pixels must be converted, and
the 3 × 3 matrix in linear light costs 70 ms at 12 MP on the Mac and 560 ms on the iPhone.

## Metadata

Every output, on every path and engine, carried none of the five fields the inputs had.

## The iPhone photo picker

With `accept="image/*"`, choosing a photo from Photos delivered a **JPEG** named by a UUID,
with **GPS already removed** and camera, lens, date and software kept. iOS converts HEIC
before the page sees it. Whether another `accept` value yields the original is outstanding.

## A testing trap

WebKit runs JavaScript about 6.5× slower in a non-secure context: a plain-HTTP page on the
local network is not one. libheif took 30 s instead of 0.6 s. Phone tests must use HTTPS.

## Decisions

1. **Decode natively where the engine can, encode JPEG with mozjpeg.** Native decode is fast
   and already sRGB; mozjpeg makes files 3.7× smaller. Read pixels back from the canvas and
   hand them to mozjpeg.
2. **libheif plus the P3 → sRGB matrix** where the engine cannot decode HEIC (Chromium,
   Firefox). The matrix applies when the input's ICC profile is Display P3.
3. **The metadata report credits only what this tool removed.** A field missing from the
   input is reported as already absent, not as removed.
4. **AVIF needs visible progress**, and multi-threaded encoding needs cross-origin isolation,
   which is a phase 7 decision.
5. **Device testing goes over HTTPS**; see `CLAUDE.md`.
