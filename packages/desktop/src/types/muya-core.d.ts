/* eslint-disable @typescript-eslint/no-explicit-any --
 * Type surface for the TypeScript muya engine published as `@muyajs/core`
 * (packages/muya), scoped to what the desktop consumes.
 *
 * Why a hand-written declaration instead of the package's own types: the
 * `@muyajs/core` package `exports` map points `.` at `./src/index.ts`, and it
 * ships no built `lib/types/*.d.ts` at install time. If vue-tsc resolved the
 * import to that source it would type-check the entire muya tree under the
 * desktop's program — where muya's own `src/types/global.d.ts` globals (e.g.
 * `Element.__MUYA_BLOCK__`) are absent — producing spurious errors. A `paths`
 * entry in tsconfig.base.json redirects `@muyajs/core` here, cutting the
 * dependency graph at the import boundary (the same shielding the legacy
 * `@marktext/muyajs` engine gets via `muya.d.ts`). Vite/electron-vite still
 * resolve the real runtime module via the package `exports` map at build time.
 *
 * Delete this file (and the `paths` entry) once `@muyajs/core` ships built
 * `lib/types/*.d.ts` and can be resolved as a normal typed dependency.
 */

declare module '@muyajs/core' {
  export interface ILocale {
    name: string
    resource: Record<string, string>
  }

  // Bundled locale objects.
  export const en: ILocale
  export const de: ILocale
  export const es: ILocale
  export const fr: ILocale
  export const ja: ILocale
  export const ko: ILocale
  export const pt: ILocale
  export const tr: ILocale
  export const zhCN: ILocale
  export const zhTW: ILocale

  export interface ITocItem {
    content: string
    lvl: number
    slug: string
    githubSlug: string
  }

  // The editor instance surface is kept permissive (`any`) — every member
  // that crosses the editor boundary was already `any` in editor.vue.
  export class Muya {
    static use(plugin: any, options?: Record<string, unknown>): void
    constructor(element: HTMLElement, options?: Record<string, unknown>)
    init(): void
    [key: string]: any
  }

  // UI plugins (constructors registered via `Muya.use`).
  export const CodeBlockLanguageSelector: any
  export const EmojiSelector: any
  export const FootnoteTool: any
  export const ImageEditTool: any
  export const ImagePathPicker: any
  export const ImageResizeBar: any
  export const ImageToolBar: any
  export const InlineFormatToolbar: any
  export const LinkTools: any
  export const ParagraphFrontButton: any
  export const ParagraphFrontMenu: any
  export const ParagraphQuickInsertMenu: any
  export const PreviewToolBar: any
  export const TableChessboard: any
  export const TableColumnToolbar: any
  export const TableDragBar: any
  export const TableRowColumMenu: any

  export class MarkdownToHtml {
    markdown: string
    constructor(markdown: string, muya?: unknown)
    renderHtml(): Promise<string>
    generate(options?: { title?: string; extraCSS?: string }): Promise<string>
  }

  export function renderToStaticHTML(...args: any[]): any

  // Utils.
  export function escapeHTML(str: string): string
  export function unescapeHTML(str: string): string
  export function sanitize(html: string, config?: any, isInline?: boolean): string
  export function generateGithubSlug(text: string): string
  export function getImageInfo(src: string): { isUnknownType: boolean; src: string; [key: string]: any }
  export function wordCount(markdown: string): {
    word: number
    paragraph: number
    character: number
    all: number
  }
}
