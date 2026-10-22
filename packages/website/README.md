# MarkText Website

The official MarkText website and documentation, built with Next.js 15, React 19, TypeScript and Tailwind CSS. This package belongs to the root pnpm workspace.

## Development

Run from the repository root:

```sh
pnpm install
pnpm --filter marktext-website dev
```

The site runs at `http://localhost:3000`. Markdown documentation lives in `content/docs/`, static documentation assets in `public/docs/`, and the navigation registry in `src/lib/docs-nav.ts`.

See [Website development](content/docs/dev/WEBSITE.md) for authoring conventions, search-index generation, validation and Cloudflare preview commands.

## Checks and production preview

```sh
pnpm --filter marktext-website lint
pnpm --filter marktext-website type-check
pnpm --filter marktext-website docs:index
pnpm --filter marktext-website build
pnpm --filter marktext-website start
```

`prebuild` refreshes the GitHub project-information snapshot and documentation search index. Next.js output is written to `.next/`; Cloudflare output is written to `.open-next/`.

## Cloudflare runtime validation

Next.js is pinned to 15.5.27 because 16.4.0 loads `server/preview-props.json`
at startup, which OpenNext 1.20.10 does not inline into its Worker bundle.
The resulting `Unexpected loadManifest` exception returns HTTP 500 even when
the build and deployment succeed. Revisit this pin when the adapter supports
that manifest.

From the repository root, validate the built Worker before deploying:

```bash
pnpm --filter marktext-website run cf:build
pnpm --filter marktext-website run cf:smoke
```

The smoke test runs Wrangler locally on port 8788 and checks the homepage,
documentation, metadata, and search index. The website
deployment workflow runs it before uploading production or preview versions.

## Repository layout

```text
content/docs/        User and developer documentation
public/docs/         Documentation images and theme screenshots
scripts/             Search index, project information and Worker smoke checks
src/app/             Next.js routes, page layouts and styles
src/components/      Website and documentation UI
src/lib/             Markdown rendering, navigation, search and project data
next.config.mjs      Next.js configuration
wrangler.toml        Cloudflare Worker configuration
```

## Contributing

Submit changes against `develop`. Keep existing documentation URL slugs stable and run the package checks before submitting a PR. The project is licensed under [MIT](../../LICENSE).
