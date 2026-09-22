// CodeMirror "markdown-math" — GFM Markdown with math spans delegated to stex,
// so the `_` in `$\text{F}_\text{A}$` reads as a subscript rather than an
// emphasis delimiter (#4121). Which delimiters count follows whichever of
// pandoc's TeX math extensions the editor is reading (#5446); the flags arrive
// on the mode spec that sourceCode.vue passes to `setOption('mode', …)`.
import 'codemirror/mode/markdown/markdown'
import 'codemirror/mode/gfm/gfm'
import 'codemirror/mode/stex/stex'

// Each opener mirrors the Muya rule of the same name, plus a closer on this
// line: the multiplexer's state survives across lines, so an unguarded inline
// opener would flip the rest of the file into stex.
//
// `$…$` carries pandoc's three `tex_math_dollars` constraints (#5449), which
// keep "Revenue rose from $13B to $24B." prose. The backslash pairs differ in
// their escape rule, as they do in pandoc: inside `\(…\)` a backslash consumes
// the character behind it, while `\\(…\\)` ends at the first literal `\\)`.
// `(?<!\\)` is what stops the single-backslash rules claiming the second
// character of `\\(` / `\\[`, where the editor reads an escaped backslash.
const INLINE_MATH_OPEN = /\$(?!\$)(?=\S)(?=[^$\n]*?[^\s$\\]\$(?!\$|\d))/
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

// Display math legitimately spans lines, hence the bare openers above.
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

  // The defaults reproduce what this mode did before it took any flags, for a
  // caller still passing the bare name.
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

    // The multiplexer takes the first region matching at the cursor, so longer
    // openers come first: `` $` `` and `$$` before `$`, `\\(` before `\(`.
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
