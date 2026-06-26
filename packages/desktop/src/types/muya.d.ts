/* eslint-disable @typescript-eslint/no-explicit-any --
 * Bridge to the legacy JavaScript muya/ tree. Every member is intentionally
 * `any` because the underlying src/muya/ source is .js and won't be re-typed
 * before the upstream TS muya (https://github.com/marktext/muya) replaces it.
 * Delete this file the day upstream lands; see packages/website/content/docs/dev/TYPESCRIPT.md.
 */

// We declare every muya path that's imported from outside src/muya/. This
// cuts the dependency graph at the boundary: TypeScript no longer follows
// imports into the legacy JS source, so e.g. inferred types from dompurify
// don't leak through.

declare module 'muya/lib' {
  const Muya: any
  export default Muya
}

declare module 'muya/lib/utils' {
  export function escapeHTML(s: string): string
  export function unescapeHTML(s: string): string
  export function getImageInfo(src: string): {
    isUnknownType: boolean
    src: string
    [key: string]: any
  }
  export function wordCount(text: string): {
    word: number
    character: number
    paragraph: number
    all: number
  }
}

declare module 'muya/lib/utils/dompurify' {
  const runSanitize: (html: string, options?: any) => string
  export default runSanitize
}

declare module 'muya/lib/utils/exportHtml' {
  const ExportHtml: any
  export default ExportHtml
}

declare module 'muya/lib/utils/exportMarkdown' {
  const ExportMarkdown: any
  export default ExportMarkdown
}

declare module 'muya/lib/parser/marked/slugger' {
  const Slugger: any
  export default Slugger
}

declare module 'muya/lib/parser/marked' {
  export const Lexer: any
}

declare module 'muya/lib/parser' {
  export const tokenizer: any
  export const generator: any
}

declare module 'muya/lib/contentState' {
  const contentState: any
  export default contentState
}

declare module 'muya/lib/eventHandler/event' {
  const event: any
  export default event
}

declare module 'muya/lib/config' {
  export const MUYA_DEFAULT_OPTION: any
}

declare module 'muya/lib/marktext/spellchecker.js' {
  export function extractWord(...args: any[]): any
}

// muya/lib/ui/* — every overlay component that editor.vue mounts onto Muya.
declare module 'muya/lib/ui/tablePicker' {
  const x: any
  export default x
}
declare module 'muya/lib/ui/quickInsert' {
  const x: any
  export default x
}
declare module 'muya/lib/ui/codePicker' {
  const x: any
  export default x
}
declare module 'muya/lib/ui/emojiPicker' {
  const x: any
  export default x
}
declare module 'muya/lib/ui/imagePicker' {
  const x: any
  export default x
}
declare module 'muya/lib/ui/imageSelector' {
  const x: any
  export default x
}
declare module 'muya/lib/ui/imageToolbar' {
  const x: any
  export default x
}
declare module 'muya/lib/ui/transformer' {
  const x: any
  export default x
}
declare module 'muya/lib/ui/formatPicker' {
  const x: any
  export default x
}
declare module 'muya/lib/ui/linkTools' {
  const x: any
  export default x
}
declare module 'muya/lib/ui/footnoteTool' {
  const x: any
  export default x
}
declare module 'muya/lib/ui/tableTools' {
  const x: any
  export default x
}
declare module 'muya/lib/ui/frontMenu' {
  const x: any
  export default x
}
declare module 'muya/lib/ui/fileIcons' {
  const x: any
  export default x
}
