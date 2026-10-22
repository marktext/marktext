# Website Development

The project website and documentation live in `packages/website`, a Next.js 15 application using React 19, TypeScript and Tailwind CSS. It is a member of the pnpm workspace and has its own lint and type-check commands.

## Run locally

Install dependencies from the repository root, then start the site:

```sh
pnpm --filter marktext-website dev
```

The development server listens on port `3000`. The dev script creates the documentation search index if it is missing. After editing documentation, regenerate it explicitly to refresh search results:

```sh
pnpm --filter marktext-website docs:index
```

## Edit documentation

- Markdown pages live in `packages/website/content/docs/`.
- Images live in `packages/website/public/docs/assets/` or `public/docs/themeImages/`.
- `packages/website/src/lib/docs-nav.ts` registers page files, stable URL slugs, sidebar titles and search hints.
- `packages/website/src/lib/markdown.ts` renders Markdown, builds the page outline and rewrites relative document and image links.

Keep links relative to the source Markdown file. Registered `.md` links are mapped to their `/docs/` routes; image paths are served from `public/docs/`. When adding a page, register it in `docs-nav.ts` and link it from a relevant overview. Preserve existing slugs when changing page titles.

Document the behavior in code. Label development-only features with the target version, and keep historical release notes intact. Check commands against the relevant package scripts and preferences against `packages/desktop/src/main/preferences/schema.json`.

## Validate and build

```sh
pnpm --filter marktext-website lint
pnpm --filter marktext-website type-check
pnpm --filter marktext-website docs:index
pnpm --filter marktext-website build
```

Preview edited pages and check the sidebar, heading links, search results, tables, code blocks and images. Check relative links and anchors as well as compilation: a successful Next.js build does not establish that every documentation link works.

The build's `prebuild` script refreshes project information and the search index. Project information is fetched from GitHub; if fetching fails, the build keeps the checked-in snapshot values. Next.js writes its output to `packages/website/.next/`; `pnpm --filter marktext-website start` serves that production build.

## Cloudflare preview

The site uses OpenNext for Cloudflare Workers. `wrangler.toml` and the OpenNext configuration live in `packages/website/`.

```sh
pnpm --filter marktext-website cf:build
pnpm --filter marktext-website cf:smoke
pnpm --filter marktext-website cf:preview
```

The smoke check starts a local Worker on port `8788` and checks the homepage, documentation, metadata and search index. Use the local Worker preview to check deployment-specific behavior. Publishing uses the separate `cf:deploy` command and requires the project's Cloudflare credentials.
