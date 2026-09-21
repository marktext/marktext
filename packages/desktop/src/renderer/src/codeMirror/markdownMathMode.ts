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
// GitHub's inline math, pandoc's `tex_math_gfm` — mirrors Muya's
// `inline_math_gfm` rule with the same-line closer. It opens on `$` like the
// dollar rule, so it has to be offered first or `$` would take the span with
// the backticks inside it, which is what the source view used to show.
const GFM_INLINE_MATH_OPEN = /\$`(?=(?:[^`\\\n]|\\.)+`\$)/

const SINGLE_INLINE_MATH_OPEN = /(?<!\\)\\\((?=(?:[^\\\n]|\\[^)\n])+\\\))/
const SINGLE_DISPLAY_MATH_OPEN = /(?<!\\)\\\[/
const DOUBLE_INLINE_MATH_OPEN = /(?<!\\)\\\\\((?=(?:(?!\\\\\))[^\n])+\\\\\))/
const DOUBLE_DISPLAY_MATH_OPEN = /(?<!\\)\\\\\[/

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CodeMirrorLike = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = any

const inlineRegion = (stexMode: AnyObj, open: string | RegExp, close: string): AnyObj => ({
  open,
  close,
  mode: stexMode,
  delimStyle: 'formatting formatting-math formatting-math-inline math-inline',
  innerStyle: 'math math-inline'
})

// Display math legitimately spans lines, so it carries no lookahead guard —
// a per-line tokenizer cannot see its closer from the opener.
const displayRegion = (stexMode: AnyObj, open: string | RegExp, close: string): AnyObj => ({
  open,
  close,
  mode: stexMode,
  delimStyle: 'formatting formatting-math formatting-math-block math-block',
  innerStyle: 'math math-block'
})

const registerMarkdownMathMode = (CodeMirror: CodeMirrorLike): void => {
  if (CodeMirror.modes && Object.prototype.hasOwnProperty.call(CodeMirror.modes, 'markdown-math')) {
    return
  }

  // `parserConfig` is the mode spec. The defaults reproduce what this mode did
  // before it took any flags, for a caller still passing the bare name.
  CodeMirror.defineMode('markdown-math', function(config: AnyObj, parserConfig: AnyObj) {
    const {
      texMathDollars = true,
      texMathGfm = false,
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
    // longer opener has to come first: `` $` `` before `$`, `$$` before `$`,
    // and `\\(` before `\(`, which would otherwise match at its second
    // character.
    const regions: AnyObj[] = []

    if (texMathGfm) {
      regions.push(inlineRegion(stexMode, GFM_INLINE_MATH_OPEN, '`$'))
    }

    if (texMathDollars) {
      regions.push(
        displayRegion(stexMode, '$$', '$$'),
        inlineRegion(stexMode, INLINE_MATH_OPEN, '$')
      )
    }

    if (texMathDoubleBackslash) {
      regions.push(
        displayRegion(stexMode, DOUBLE_DISPLAY_MATH_OPEN, '\\\\]'),
        inlineRegion(stexMode, DOUBLE_INLINE_MATH_OPEN, '\\\\)')
      )
    }

    if (texMathSingleBackslash) {
      regions.push(
        displayRegion(stexMode, SINGLE_DISPLAY_MATH_OPEN, '\\]'),
        inlineRegion(stexMode, SINGLE_INLINE_MATH_OPEN, '\\)')
      )
    }

    return CodeMirror.multiplexingMode(gfmMode, ...regions)
  })
}

export default registerMarkdownMathMode
