// Type surface for the TypeScript muya engine published as `@muyajs/core`
// (packages/muya), scoped to exactly what the desktop consumes today.
//
// Why a hand-written declaration instead of the package's own types: the
// `@muyajs/core` package `exports` map points `.` at `./src/index.ts`, and it
// ships no built `lib/types/*.d.ts`. If vue-tsc resolved the import to that
// source it would type-check the entire muya tree under the desktop's program,
// where muya's own `src/types/global.d.ts` globals (e.g.
// `Element.__MUYA_BLOCK__`) are absent — producing spurious errors. A
// `paths` entry in tsconfig.base.json redirects `@muyajs/core` here, cutting
// the dependency graph at the import boundary (the same shielding the legacy
// `@marktext/muyajs` engine gets via `muya.d.ts`). Vite/electron-vite still
// resolve the real runtime module via the package `exports` map at build time.
//
// Delete this file (and the `paths` entry) once `@muyajs/core` ships built
// `lib/types/*.d.ts` and can be resolved as a normal typed dependency.

declare module '@muyajs/core' {
  export function escapeHTML(str: string): string
  export function unescapeHTML(str: string): string

  export function wordCount(markdown: string): {
    word: number
    paragraph: number
    character: number
    all: number
  }

  export class MarkdownToHtml {
    markdown: string
    constructor(markdown: string, muya?: unknown)
    renderHtml(): Promise<string>
  }
}
