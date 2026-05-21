// CodeMirror "markdown-math" — a Markdown mode that delegates the contents of
// `$...$` (inline) and `$$...$$` (block) math spans to the stex (LaTeX) mode.
// Without this wrapper the plain Markdown mode highlights `_` as emphasis
// delimiters even inside math, producing spurious italics for subscript
// expressions like `$\text{F}_\text{A} = \text{F}_\text{B}$` in the source
// view. See https://github.com/marktext/marktext/issues/4121.
//
// Both inner modes must be loaded eagerly here so that `getMode` resolves
// them synchronously at the time the wrapper is instantiated.
import 'codemirror/mode/markdown/markdown'
import 'codemirror/mode/stex/stex'

const registerMarkdownMathMode = (CodeMirror) => {
  if (CodeMirror.modes && Object.prototype.hasOwnProperty.call(CodeMirror.modes, 'markdown-math')) {
    return
  }

  CodeMirror.defineMode('markdown-math', function(config) {
    const markdownMode = CodeMirror.getMode(config, {
      name: 'markdown',
      fencedCodeBlocks: true,
      strikethrough: true,
      taskLists: true
    })
    const stexMode = CodeMirror.getMode(config, 'stex')

    // `$$` must come before `$` so the longer delimiter is matched first.
    return CodeMirror.multiplexingMode(
      markdownMode,
      {
        open: '$$',
        close: '$$',
        mode: stexMode,
        delimStyle: 'formatting formatting-math formatting-math-block math-block',
        innerStyle: 'math math-block'
      },
      {
        open: '$',
        close: '$',
        mode: stexMode,
        delimStyle: 'formatting formatting-math formatting-math-inline math-inline',
        innerStyle: 'math math-inline'
      }
    )
  })
}

export default registerMarkdownMathMode
