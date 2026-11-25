# itsmor tools

Small, private tools that run entirely in your browser. Part of [itsmor.com](https://www.itsmor.com).

## Convert

Convert images between JPEG, PNG, WebP, AVIF and HEIC, on your own machine.

**Your files never leave this tab — and you can check.** The page is served with a policy that
forbids it from sending data anywhere, it works offline, and it shows you a live count of
network requests made since you added a file. Photo metadata, including GPS location, is
removed from every output, and you are told what was removed.

> **Status:** scaffolded. The page and the tooling are in place; conversion is not built
> yet. See [`docs/`](./docs) for the product brief, architecture, technical design and
> implementation plan.

## Documents

1. [Product brief](./docs/01-product-brief.md) — the problem, the promise, the scope
2. [Architecture](./docs/02-architecture.md) — the shape of the system and why
3. [Technical design](./docs/03-technical-design.md) — the pipeline, the policy, the tests
4. [Implementation plan](./docs/04-implementation-plan.md) — the order of work

## Licence

[MIT](./LICENSE). Third-party licences, including libheif's LGPL-3.0, will be listed in
`THIRD_PARTY_NOTICES.md`.
