# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Read `docs/` first.** The product brief, architecture, technical design and implementation
plan are the spec; this file says how the code works today and what will otherwise waste
time. The visual rules are itsmor's, and its `MAINTAINING.md` is the authority on them — see
[Design Tokens](#design-tokens).

## Project Overview

itsmor tools — small, private tools that run entirely in the browser, served from
`tools.itsmor.com`. The first is Convert, an image converter whose promise is _"Your files
never leave this tab — and you can check."_ A static Vite build with two pages; no server
code.

## Commands

```bash
pnpm dev           # Dev server at localhost:5173
pnpm dev:lan       # Same, exposed on the LAN, for testing from a phone on the same Wi-Fi
pnpm build         # Static build to dist/
pnpm preview       # Serve dist/
pnpm lint          # ESLint
pnpm format        # Prettier format all files
pnpm format:check  # Prettier validation
pnpm tokens:check  # Hex guard — see Design Tokens
pnpm typecheck     # tsc -b over the app and the Vite config
pnpm test          # Vitest
pnpm verify        # All of the above, in the order CI runs them
```

CI (`.github/workflows/checks.yml`) runs `verify`'s steps on every PR and on pushes to
`main`. Package manager is **pnpm**; `engines.node >= 22.18` matches itsmor and CI.

## Structure

```
index.html           the tools index, /
convert/index.html   the converter, /convert/
src/app/
  mount.tsx          fonts, styles and createRoot, shared by both entries
  styles.css         Tailwind, the token theme, fonts, focus ring, the hairline grid
  site.ts            the two outbound URLs
  components/        PageShell (grid, header, main, footer) and its parts, Logo
  index/             the index page and its ToolCard
  convert/           the converter page, DropZone, SupportedFormats
tools/               check-tokens.mjs and the hex finder it uses
tests/               Vitest units
public/              favicon.ico, from itsmor
```

Each HTML file is a Vite entry (`build.rolldownOptions.input`) and builds to its own
`index.html`, which S3 serves without rewrite rules. A new tool is a new directory with an
`index.html`, an entry under `src/app/`, an input in `vite.config.ts`, a card on the index,
and a line in `HTML_ENTRIES` in `tools/check-tokens.mjs`.

`src/engine/` and `src/lib/` from the technical design do not exist yet. Create them with
their first real file, not before.

## Design Tokens

**No hex colour literal lives in this repo's source.** Colours come from the published
[`@itsmor/tokens`](https://www.npmjs.com/package/@itsmor/tokens), the same package
itsmor.com reads:

- CSS: `styles.css` imports `@itsmor/tokens/theme.css`, a Tailwind v4 `@theme` block. That
  gives the utilities (`bg-background`, `text-text`, `text-lapis`, `text-terracotta`,
  `text-ink-2`, `text-ink-3`, `border-rule`, `border-rule-soft`, `bg-rail`) and
  `--grid-cell` and `--grid-line` on `:root`.
- TypeScript: `import { PALETTE, GRID_LINE, GRID_CELL, withAlpha } from "@itsmor/tokens"`
  where a colour has to be a string, such as canvas code.

`pnpm tokens:check` fails on any `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa` in a `.ts`,
`.tsx`, `.css` or `.html` file under `src/`, or in either HTML entry. It has no exemptions.
It was proven per itsmor `MAINTAINING.md` §5 by injecting live token values — not retired
ones — into a component's Tailwind class, `styles.css` and `convert/index.html`; each failed
with file, line and column, and the restored tree passed. **Re-prove it the same way after
touching the guard.** It skips `&#039;`-style character references and hex digits glued to
a word, so `issue#123` does not trip it; a CSS id selector made only of hex letters would.
`vite.config.ts` is outside its scope.

The contrast rules are itsmor's, measured on the cream ground:

- Text is `text`, `ink-2`, `ink-3` or `lapis`. **`opacity-70` is the floor for text**
  (`text-text/70`).
- **`terracotta` only at full opacity, on an untinted ground** — it is 4.57:1 with no
  headroom. Hover states, the focus ring and the selection colour; never under `opacity-*`.
- **`gold` and `amber` never carry text or state.** This repo does not use them.
- Prefer `lapis` for small mono labels.
- Interactive states use lapis or the ink inversion (`hover:bg-text hover:text-background`);
  the keyboard focus ring is a 2px terracotta outline, set globally in `styles.css`.

**`theme-color` comes from a Vite plugin, not the HTML.** An HTML literal would trip the
guard, so `vite.config.ts` injects `PALETTE.background` at build. The hex therefore appears
in `dist/`, which is expected.

**The grid is a CSS class, not an inline style.** `.hairline-grid` draws `--grid-line` every
`--grid-cell`, mirroring itsmor's `GridBackground`. Keep styling in classes and custom
properties: the CSP in the technical design is `style-src 'self'`.

## Fonts

Inter and IBM Plex Mono are self-hosted through Fontsource and imported in `mount.tsx`;
there is no request to any other origin, which the CSP will enforce. The families are named
`"Inter Variable"` and `"IBM Plex Mono"` in the `@theme` block. Inter's variable file covers
every weight and emits one `woff2` per subset into `dist/`; `unicode-range` means a browser
fetches only the subsets it renders. Plex Mono is imported as `latin-400` only — import any
other weight or subset explicitly before using it, or the browser synthesises it.

## Progressive Enhancement

The pages are client-rendered, so without JavaScript they show only the `<noscript>` line.
itsmor's "renders completely without JS" property cannot hold for a tool that converts in
the browser; the HTML still carries the title and description. What does hold is itsmor's
other rule: **no content behind an `opacity: 0` initial.** Motion is CSS only — colour
transitions, plus a padding shift and an arrow nudge on the tool card gated on
`motion-safe:`.

The drop zone is a `<label>` wrapping a visually hidden
`<input type="file" multiple accept="image/*">`, so keyboard, screen reader and the mobile
photo picker all reach it. Because the input is invisible, its focus ring is drawn on the
label through `has-focus-visible:`. "Drop images here" is hidden on coarse pointers. There
is no drop handling yet, so a file dropped on the page opens in the tab until phase 6 adds
it.

## Gotchas

- **TypeScript is pinned to 6.0.** `typescript-eslint` 8 supports `typescript <6.1`, and
  `pnpm add typescript` takes 7.x. Lift the pin when `typescript-eslint` widens its range.
- **pnpm 11 rejects packages published less than a day ago, even with
  `--frozen-lockfile`.** A fresh `@itsmor/tokens` publish therefore fails CI's install.
  `pnpm-workspace.yaml` exempts `@itsmor/tokens@0.1.1` for that reason. On the next token
  bump, replace the version there rather than adding a second line; once the pinned version
  is a day old, the entry can go.
- **Vite 8 builds with Rolldown.** `build.rollupOptions` is a deprecated alias; use
  `build.rolldownOptions`.
- **The shared chunk is named after a module, not after React.** `dist/assets/PageShell-*.js`
  is React plus the shell, because Rolldown names a shared chunk after one of its modules.
  It is about 70 KB gzipped, inside the 100 KB initial budget.
- **Headless Chrome's window has a minimum width of about 500px.** A `--window-size=390,…`
  screenshot is a 500px layout cropped to 390, and looks like horizontal overflow. To check a
  phone width, load the page in a 390px-wide `<iframe>` and screenshot that.
- **Prettier formats `docs/` too**, including padding table columns, as in itsmor.
- **Test on a phone over HTTPS, never plain HTTP.** WebKit runs JavaScript about 6.5× slower
  in a non-secure context, and a LAN address over HTTP is one: libheif took 30 s instead of
  0.6 s. `pnpm dev:lan` alone gives misleading timings; serve it with a certificate the phone
  trusts (mkcert's root CA installed as a profile).
- **iOS converts photos before the page sees them.** Choosing from Photos through
  `accept="image/*"` delivers a JPEG with GPS already removed. Don't assume a phone user's
  input is HEIC, and don't credit the tool for removing what was never there.

## Code Conventions

- Prettier: 2-space indent, trailing commas (es5), double quotes — `.prettierrc` is itsmor's
- One component per file, default export, props interface above it, as in itsmor
- Comments only for a constraint the code cannot show; anything longer belongs here
- Tests only for real logic. `tools/hex.mjs` is a pure function so the guard's matching is
  unit-tested in `tests/` while `check-tokens.mjs` only walks files
- Outbound links: the header mark returns to itsmor.com in the same tab; other external
  links open in a new tab with `rel="noopener noreferrer"`
