# Muya browser demo

A Vite + TypeScript demo that consumes the local `@muyajs/core` workspace package.

Run from the MarkText repository root:

```sh
pnpm install
pnpm --filter muya-examples dev:demo
```

Vite prints the development URL (port 5173 by default). The demo imports Muya
source directly, so a library build is not required. Plugin registration and
editor initialization live in [`src/main.ts`](src/main.ts).

See the [Muya README](../README.md) for the editor API and package checks.
