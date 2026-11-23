# 01 · Product brief

**Status:** accepted, 23 Nov 2026 · **Next:** [02 · Architecture](./02-architecture.md)

## The problem

Converting a photo usually means uploading it to a server you know nothing about. The most
common case is an iPhone HEIC that a form, a printer or a colleague cannot open. The file
carries the GPS location of where it was taken, and the converter keeps a copy.

None of that is necessary. A modern browser can decode and encode every format involved on
the user's own machine.

## The promise

> **Your files never leave this tab — and you can check.**

Not a claim in a footer. The page is served with a policy that forbids it from sending data
anywhere, it works with the network switched off, and it shows the user a live count of
network requests made since they added a file. That count stays at zero.

## Who it is for

| Reader | Arrives from | Decides | What answers it |
|---|---|---|---|
| Someone with a HEIC that will not open | A search | *Can I trust this with my photo?* | The promise, visible before the drop zone; a fast, obvious result |
| A visitor from itsmor.com | The portfolio | *Is the craft real?* | The privacy proof, the polish, and a public repo that holds up |
| An engineer reading the code | GitHub | *Does the public work hold up?* | Small, typed, tested code; these documents |

## v1 scope

**Images only.** One tool, done well.

| | Formats |
|---|---|
| **In** | JPEG, PNG, WebP, AVIF, HEIC/HEIF, GIF (first frame), BMP |
| **Out** | JPEG, PNG, WebP, AVIF |

- Batch: drop many files, convert all, download one by one or as a ZIP.
- Settings: output format, quality, optional maximum dimension.
- Before and after size for every file.
- **Metadata report.** Every output is written without metadata. The user is told what was
  removed, per file: *GPS location removed · Camera model removed · Date taken removed*.
- Works on mobile, with limits stated honestly rather than discovered as a crash.

## Not in v1

PDF, audio, video, office documents, editing, accounts, cloud storage, analytics of any
kind. Office documents are out for good: faithful DOCX→PDF in a browser needs a 100 MB+
LibreOffice build.

## What success looks like

1. After the first visit, the tool converts with the network off.
2. DevTools shows no request leaving the origin, ever, and none at all once files are added.
3. A 12 MP iPhone HEIC converts to JPEG in under 2 s on a mid-range laptop.
4. Lighthouse 100 for accessibility and best practices; initial JS under 100 KB gzipped.
5. It looks like it belongs to itsmor.com: same tokens, same type, same grid.

## Where it lives

`tools.itsmor.com/convert` — its own repo, bucket and CloudFront distribution. A path on
itsmor.com is ruled out: the portfolio's deploy syncs its bucket with `--delete`, and the
headers this tool may need would constrain the portfolio's pages. The `tools.` host leaves
room for a second tool without a new domain.

## Decisions taken

| Question | Decision |
|---|---|
| Hosting | Subdomain, separate repo |
| Scope | Images only |
| Positioning | Verifiable privacy |
| Design tokens | Public `@itsmor/tokens` package, published from the itsmor workspace |
| Stack | Vite, React 19, TypeScript, Tailwind v4 |
| Licence | MIT; no GPL dependencies |
| Mobile | First class |
| Metadata | Removed by default and reported |
