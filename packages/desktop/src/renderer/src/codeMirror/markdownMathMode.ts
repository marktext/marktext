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

// Open guards for the inline backslash forms, mirroring Muya's
// `inline_math_single_backslash` / `inline_math_double_backslash` rules with
// the same-line closer this view needs. The two escape rules differ, as they
// do in pandoc: inside `\(…\)` a backslash consumes the character behind it,
// so `\\` does not close the span, while `\\(…\\)` takes its closer
// literally and ends at the first `\\)`.
//
// `INLINE_MATH_OPEN` cannot be reused here: part of it requires the character
// before the closer not to be a backslash, and for `\)` that character is one.
//
// A `\\(` opener paired with a `\)` closer is read as single-backslash math
// when only that extension is on, where the editor sees an escaped backslash
// and no formula. The multiplexer searches a regexp against the rest of the
// line (`mltiplexMode.ts`), so a guard cannot see the backslash in front of it;
// the shape is invalid in both dialects and is not worth reworking shared code
// for. The well-formed `\\(…\\)` is unaffected — its closer reads as an
// escaped backslash under the single-backslash rule, leaving the span unclosed.
const SINGLE_INLINE_MATH_OPEN = /\\\((?=(?:[^\\\n]|\\[^)\n])+\\\))/
const DOUBLE_INLINE_MATH_OPEN = /\\\\\((?=(?:(?!\\\\\))[^\n])+\\\\\))/

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CodeMirrorLike = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = any

// The display and inline regions of one backslash extension, in the order the
// multiplexer must try them: the display opener `\[` and the inline opener `\(`
// differ in their second character, so either order works, but keeping display
// first matches how `$$` precedes `$`.
const backslashRegions = (
  stexMode: AnyObj,
  displayOpen: string,
  displayClose: string,
  inlineOpen: RegExp,
  inlineClose: string
): AnyObj[] => [
  {
    open: displayOpen,
    close: displayClose,
    mode: stexMode,
    delimStyle: 'formatting formatting-math formatting-math-block math-block',
    innerStyle: 'math math-block'
  },
  {
    open: inlineOpen,
    close: inlineClose,
    mode: stexMode,
    delimStyle: 'formatting formatting-math formatting-math-inline math-inline',
    innerStyle: 'math math-inline'
  }
]

const registerMarkdownMathMode = (CodeMirror: CodeMirrorLike): void => {
  if (CodeMirror.modes && Object.prototype.hasOwnProperty.call(CodeMirror.modes, 'markdown-math')) {
    return
  }

  // `parserConfig` is the mode spec the caller passed to `setOption('mode', …)`.
  // The defaults reproduce what this mode did before it took any flags, so a
  // caller still passing the bare string `'markdown-math'` is unaffected.
  CodeMirror.defineMode('markdown-math', function(config: AnyObj, parserConfig: AnyObj) {
    const {
      texMathDollars = true,
      texMathSingleBackslash = false,
      texMathDoubleBackslash = false
    } = parserConfig ?? {}

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

    // The double-backslash regions go first: the literal `\(` would otherwise
    // match at the second character of `\\(` and claim it for the single form.
    // Display math spans lines, so like `$$` it carries no lookahead guard.
    if (texMathDoubleBackslash) {
      regions.push(
        backslashRegions(stexMode, '\\\\[', '\\\\]', DOUBLE_INLINE_MATH_OPEN, '\\\\)')
      )
    }

    if (texMathSingleBackslash) {
      regions.push(backslashRegions(stexMode, '\\[', '\\]', SINGLE_INLINE_MATH_OPEN, '\\)'))
    }

    return CodeMirror.multiplexingMode(gfmMode, ...regions.flat())
  })
}

export default registerMarkdownMathMode
