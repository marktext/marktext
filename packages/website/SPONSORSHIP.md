# Sponsorship

The homepage Support section introduces sponsorship without changing the download flow. `/sponsors` is a statically generated App Router page containing funding purposes, individual and corporate tiers, sponsor recognition, FAQs, and contact links. It uses existing theme tokens and components without additional dependencies or payment processing.

## Maintaining tiers and sponsors

Edit `src/lib/sponsorship.ts`. Corporate cards and the comparison table share the same tier data. Keep prices, names, descriptions, and benefits consistent with https://github.com/sponsors/marktext before publishing changes. GitHub subscriptions and payments remain on GitHub; every sponsorship CTA points to that page.

For a new company, confirm its sponsorship and agreement, review the supplied name, logo, and URL, then add a sponsor record. Store logos in `public/assets/` and record their intrinsic dimensions. Use `preserveColors` for logos whose colors or background must remain intact in dark mode. Select `home` and/or `sponsors` placements, the corporate tier, and the display order. Platinum displays before Gold and Community; order resolves placement within a tier. Empty tiers are not rendered.

Set `active` to false when recurring sponsorship ends. Permanent records remain visible regardless of `active`; do not remove them through recurring-sponsorship maintenance.

SerpApi's existing one-time agreement provides permanent homepage, GitHub README, and product-link recognition. Its record deliberately has `permanent: true`, `active: false`, and the separate `early` tier. Preserve `/assets/serpapi.png` and `https://serpapi.com/?utm_source=marktext`. Do not convert it into a recurring sponsor. README and release-note recognition are maintained manually outside this website data; SerpApi's existing README entry must remain.

## SEO and navigation

The page owns its absolute title, description, canonical, Open Graph, Twitter, and WebPage JSON-LD. Social metadata uses the existing 512×512 brand logo. `/sponsors` appears in the sitemap and is allowed by existing robots rules. Core content is server-rendered and visible without JavaScript. Nav, Brand, and Footer use `home={false}` on this page to route product anchors back to the homepage.

## Validation

Run from the repository root:

```sh
pnpm --filter marktext-website run lint
pnpm --filter marktext-website run type-check
pnpm --filter marktext-website run build
pnpm --filter marktext-website run cf:build
pnpm --filter marktext-website run cf:smoke
```

The Worker smoke checks cover the sponsorship route, key content and links, title, description, canonical, social metadata, a single H1, indexability, sitemap inclusion, and SerpApi preservation. Preview the site at desktop, 375px, and 320px widths in both themes; inspect card stacking, table wrapping, logo loading, keyboard focus, homepage-to-sponsors navigation, and content with JavaScript disabled. Confirm GitHub CTA destinations and the corporate mailto link. Logo approval, sponsorship status, and README/release-note placement remain a manual maintainer process.
