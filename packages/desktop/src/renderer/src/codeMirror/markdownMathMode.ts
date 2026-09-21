// CodeMirror "markdown-math" — GFM Markdown with math spans delegated to stex,
// so the `_` in `$\text{F}_\text{A}$` reads as a subscript rather than an
// emphasis delimiter (#4121). Which delimiters count follows whichever of
// pandoc's TeX math extensions the editor is reading (#5446); the flags arrive
// on the mode spec that sourceCode.vue passes to `setOption('mode', …)`.
//
// Inner modes are imported eagerly so `getMode` resolves synchronously.
import 'codemirror/mode/markdown/markdown'
import 'codemirror/mode/gfm/gfm'
import 'codemirror/mode/stex/stex'

// Carries pandoc's three `tex_math_dollars` constraints, the ones #5449 gave
// the editor — non-space after the opener, non-space before the closer, no
// digit after it — so "Revenue rose from $13B to $24B." is prose in both views.
// Demanding a closer on this line is this view's own rule: the multiplexer's
// state survives across lines, so a stray `$` would otherwise flip the rest of
// the file into stex. The guard only gates *entry*; the closer is a plain `$`
// and leaves on the next one, since a closing regexp would need the text before
// it and `StringStream.match` does not expose that.
const INLINE_MATH_OPEN = /\$(?!\$)(?=\S)(?=[^$\n]*?[^\s$\\]\$(?!\$|\d))/

// Muya's `inline_math_single_backslash` / `inline_math_double_backslash` rules
// plus the same-line closer. Their escape rules differ, as they do in pandoc:
// inside `\(…\)` a backslash consumes the character behind it, so `\\` does not
// close, while `\\(…\\)` ends at the first literal `\\)`. `INLINE_MATH_OPEN` is
// no use here — it requires the character before the closer not to be a
// backslash, and for `\)` it is one.
//
// Every opener refuses a preceding backslash, so the single-backslash rules
// cannot claim the second character of `\\(` / `\\[`, where the editor reads an
// escaped backslash and no formula. The display openers need that guard more
// than the inline ones: spanning lines, they carry no closer lookahead to fall
// back on, and without it `\\[…\\]` highlighted whenever the single-backslash
// extension was on.
const SINGLE_INLINE_MATH_OPEN = /(?<!\\)\\\((?=(?:[^\\\n]|\\[^)\n])+\\\))/
const SINGLE_DISPLAY_MATH_OPEN = /(?<!\\)\\\[/
const DOUBLE_INLINE_MATH_OPEN = /(?<!\\)\\\\\((?=(?:(?!\\\\\))[^\n])+\\\\\))/
const DOUBLE_DISPLAY_MATH_OPEN = /(?<!\\)\\\\\[/

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CodeMirrorLike = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = any

// Display math legitimately spans lines, so it carries no lookahead guard —
// a per-line tokenizer cannot see its closer from the opener.
const mathRegions = (
  stexMode: AnyObj,
  displayOpen: string | RegExp,
  displayClose: string,
  inlineOpen: string | RegExp,
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

  // `parserConfig` is the mode spec. The defaults reproduce what this mode did
  // before it took any flags, for a caller still passing the bare name.
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

    // The multiplexer takes the first region matching at the cursor, so the
    // longer opener of each pair has to come first: `$$` before `$`, and `\\(`
    // before `\(`, which would otherwise match at its second character.
    const regions = []

    if (texMathDollars) {
      regions.push(mathRegions(stexMode, '$$', '$$', INLINE_MATH_OPEN, '$'))
    }

    if (texMathDoubleBackslash) {
      regions.push(
        mathRegions(stexMode, DOUBLE_DISPLAY_MATH_OPEN, '\\\\]', DOUBLE_INLINE_MATH_OPEN, '\\\\)')
      )
    }

    if (texMathSingleBackslash) {
      regions.push(
        mathRegions(stexMode, SINGLE_DISPLAY_MATH_OPEN, '\\]', SINGLE_INLINE_MATH_OPEN, '\\)')
      )
    }

    return CodeMirror.multiplexingMode(gfmMode, ...regions.flat())
  })
}

export default registerMarkdownMathMode
