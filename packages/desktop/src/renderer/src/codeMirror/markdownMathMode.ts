// CodeMirror "markdown-math" — a GFM-flavoured Markdown mode that delegates
// the contents of math spans to the stex (LaTeX) mode. Without this wrapper the
// standard markdown mode highlights `_` as emphasis delimiters even inside math,
// producing spurious italics for subscript expressions like
// `$\text{F}_\text{A} = \text{F}_\text{B}$` in the source view.
// See https://github.com/marktext/marktext/issues/4121.
//
// Which delimiters count is not fixed: the mode mirrors whichever of pandoc's
// TeX math extensions the editor is currently reading (#5446), so the source
// view and the WYSIWYG view never disagree about what is a formula. The flags
// arrive on the mode spec — `setOption('mode', { name: 'markdown-math', … })`
// in sourceCode.vue — which CodeMirror hands to the factory below.
//
// The outer mode is `gfm` to preserve the tables / autolinks / task lists
// styling the previous `setMode(cm, 'markdown')` call resolved to via
// `codeMirror/modes.js` (which maps "markdown" → `gfm` / `text/x-gfm`).
//
// All inner modes are loaded eagerly so `getMode` resolves synchronously at
// the time the wrapper is instantiated. `gfm` itself depends on `markdown`.
import 'codemirror/mode/markdown/markdown'
import 'codemirror/mode/gfm/gfm'
import 'codemirror/mode/stex/stex'

// Open guard for inline `$…$`, mirroring Muya's `inline_math` rule
// (`packages/muya/src/inlineRenderer/rules.ts`) so the source view and the
// editor agree on what is a formula. It carries pandoc's three
// `tex_math_dollars` constraints, which #5449 gave the editor: a non-space
// right after the opener, a non-space right before the closer, and no digit
// right after the closer — so "Revenue rose from $13B to $24B." is prose in
// both views. Requiring a closer on this line is on top of those, and stops a
// stray `$` (e.g. "$5 owed") from flipping the inner mode on forever.
//
// The guard only decides whether to *enter* stex. The region's closer is the
// plain string `$`, so it leaves on the next one without re-checking those
// constraints; a closer regexp would need the text before it, which
// `StringStream.match` does not expose.
const INLINE_MATH_OPEN = /\$(?!\$)(?=\S)(?=[^$\n]*?[^\s$\\]\$(?!\$|\d))/

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CodeMirrorLike = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = any

const registerMarkdownMathMode = (CodeMirror: CodeMirrorLike): void => {
  if (CodeMirror.modes && Object.prototype.hasOwnProperty.call(CodeMirror.modes, 'markdown-math')) {
    return
  }

  // `parserConfig` is the mode spec the caller passed to `setOption('mode', …)`.
  // The defaults reproduce what this mode did before it took any flags, so a
  // caller still passing the bare string `'markdown-math'` is unaffected.
  CodeMirror.defineMode('markdown-math', function(config: AnyObj, parserConfig: AnyObj) {
    const { texMathDollars = true } = parserConfig ?? {}

    const gfmMode = CodeMirror.getMode(config, {
      name: 'gfm',
      fencedCodeBlocks: true,
      strikethrough: true,
      taskLists: true
    })
    const stexMode = CodeMirror.getMode(config, 'stex')

    const regions = []

    if (texMathDollars) {
      // `$$` must come before `$` so the longer delimiter is matched first.
      // Block math (`$$…$$`) intentionally has no lookahead guard: a matching
      // closer typically lives on a later line, which CodeMirror's per-line
      // tokenizer cannot see from the opener.
      regions.push(
        {
          open: '$$',
          close: '$$',
          mode: stexMode,
          delimStyle: 'formatting formatting-math formatting-math-block math-block',
          innerStyle: 'math math-block'
        },
        {
          open: INLINE_MATH_OPEN,
          close: '$',
          mode: stexMode,
          delimStyle: 'formatting formatting-math formatting-math-inline math-inline',
          innerStyle: 'math math-inline'
        }
      )
    }

    return CodeMirror.multiplexingMode(gfmMode, ...regions)
  })
}

export default registerMarkdownMathMode
