// CodeMirror "markdown-math" — a GFM-flavoured Markdown mode that delegates
// the contents of `$...$` (inline) and `$$...$$` (block) math spans to the
// stex (LaTeX) mode. Without this wrapper the standard markdown mode highlights
// `_` as emphasis delimiters even inside math, producing spurious italics for
// subscript expressions like `$\text{F}_\text{A} = \text{F}_\text{B}$` in the
// source view. See https://github.com/marktext/marktext/issues/4121.
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

// Open guard for inline `$…$`. Mirrors Muya's `inline_math` rule
// (`src/muya/lib/parser/rules.js`): require non-empty content with no inner
// `$`, last char before the closer not being `\`, and the closing `$` not
// followed by another `$` (which would be block math). This stops a single
// stray `$` (e.g. "$5 owed") from flipping the inner mode on forever and keeps
// the source-view tokenization aligned with the inline parse.
const INLINE_MATH_OPEN = /\$(?!\$)(?=[^$\n]*?[^$\\]\$(?!\$))/

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CodeMirrorLike = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = any

const registerMarkdownMathMode = (CodeMirror: CodeMirrorLike): void => {
  if (CodeMirror.modes && Object.prototype.hasOwnProperty.call(CodeMirror.modes, 'markdown-math')) {
    return
  }

  CodeMirror.defineMode('markdown-math', function(config: AnyObj) {
    const gfmMode = CodeMirror.getMode(config, {
      name: 'gfm',
      fencedCodeBlocks: true,
      strikethrough: true,
      taskLists: true
    })
    const stexMode = CodeMirror.getMode(config, 'stex')

    // `$$` must come before `$` so the longer delimiter is matched first.
    // Block math (`$$…$$`) intentionally has no lookahead guard: a matching
    // closer typically lives on a later line, which CodeMirror's per-line
    // tokenizer cannot see from the opener.
    return CodeMirror.multiplexingMode(
      gfmMode,
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
  })
}

export default registerMarkdownMathMode
