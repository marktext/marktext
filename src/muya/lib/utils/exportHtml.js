import marked from '../parser/marked'
import Prism from 'prismjs'
import katex from 'katex'
import mermaid from 'mermaid/dist/mermaid.core'
import flowchart from 'flowchart.js'
import Diagram from '../parser/render/sequence'
import vegaEmbed from 'vega-embed'
import githubMarkdownCss from 'github-markdown-css/github-markdown.css'
import highlightCss from 'prismjs/themes/prism.css'
import katexCss from 'katex/dist/katex.css'
import { EXPORT_DOMPURIFY_CONFIG } from '../config'
import { sanitize, unescapeHtml } from '../utils'
import { validEmoji } from '../ui/emojis'

export const getSanitizeHtml = markdown => {
  const html = marked(markdown)
  return sanitize(html, EXPORT_DOMPURIFY_CONFIG)
}

const DIAGRAM_TYPE = [
  'mermaid',
  'flowchart',
  'sequence',
  'vega-lite'
]

class ExportHtml {
  constructor (markdown, muya) {
    this.markdown = markdown
    this.muya = muya
    this.exportContainer = null
    this.mathRendererCalled = false
  }

  renderMermaid () {
    const codes = this.exportContainer.querySelectorAll('code.language-mermaid')
    for (const code of codes) {
      const preEle = code.parentNode
      const mermaidContainer = document.createElement('div')
      mermaidContainer.innerHTML = code.innerHTML
      mermaidContainer.classList.add('mermaid')
      preEle.replaceWith(mermaidContainer)
    }
    // We only export light theme, so set mermaid theme to `default`, in the future, we can choose whick theme to export.
    mermaid.initialize({
      theme: 'default'
    })
    mermaid.init(undefined, this.exportContainer.querySelectorAll('div.mermaid'))
    if (this.muya) {
      mermaid.initialize({
        theme: this.muya.options.mermaidTheme
      })
    }
  }

  async renderDiagram () {
    const selector = 'code.language-vega-lite, code.language-flowchart, code.language-sequence'
    const RENDER_MAP = {
      flowchart: flowchart,
      sequence: Diagram,
      'vega-lite': vegaEmbed
    }
    const codes = this.exportContainer.querySelectorAll(selector)
    for (const code of codes) {
      const rawCode = unescapeHtml(code.innerHTML)
      const functionType = /sequence/.test(code.className) ? 'sequence' : (/flowchart/.test(code.className) ? 'flowchart' : 'vega-lite')
      const render = RENDER_MAP[functionType]
      const preParent = code.parentNode
      const diagramContainer = document.createElement('div')
      diagramContainer.classList.add(functionType)
      preParent.replaceWith(diagramContainer)
      const options = {}
      if (functionType === 'sequence') {
        Object.assign(options, { theme: 'hand' })
      } else if (functionType === 'vega-lite') {
        Object.assign(options, {
          actions: false,
          tooltip: false,
          renderer: 'svg',
          theme: 'latimes' // only render light theme
        })
      }
      try {
        if (functionType === 'flowchart' || functionType === 'sequence') {
          const diagram = render.parse(rawCode)
          diagramContainer.innerHTML = ''
          diagram.drawSVG(diagramContainer, options)
        } if (functionType === 'vega-lite') {
          await render(diagramContainer, JSON.parse(rawCode), options)
        }
      } catch (err) {
        console.log(err)
        diagramContainer.innerHTML = '< Invalid Diagram >'
      }
    }
  }

  mathRenderer = (math, displayMode) => {
    this.mathRendererCalled = true
    return katex.renderToString(math, {
      displayMode
    })
  }

  // render pure html by marked
  async renderHtml () {
    this.mathRendererCalled = false
    let html = marked(this.markdown, {
      highlight (code, lang) {
        // Language may be undefined (GH#591)
        if (!lang) {
          return code
        }

        if (DIAGRAM_TYPE.includes(lang)) {
          return code
        }

        const grammar = Prism.languages[lang]
        if (!grammar) {
          console.warn(`Unable to find grammar for "${lang}".`)
          return code
        }
        return Prism.highlight(code, grammar, lang)
      },
      emojiRenderer (emoji) {
        const validate = validEmoji(emoji)
        if (validate) {
          return validate.emoji
        } else {
          return `:${emoji}:`
        }
      },
      mathRenderer: this.mathRenderer
    })
    html = sanitize(html, EXPORT_DOMPURIFY_CONFIG)
    const exportContainer = this.exportContainer = document.createElement('div')
    exportContainer.classList.add('ag-render-container')
    exportContainer.innerHTML = html
    document.body.appendChild(exportContainer)
    // render only render the light theme of mermaid and diragram...
    this.renderMermaid()
    await this.renderDiagram()
    let result = exportContainer.innerHTML
    exportContainer.remove()
    // hack to add arrow marker to output html
    const pathes = document.querySelectorAll('path[id^=raphael-marker-]')
    const def = '<defs style="-webkit-tap-highlight-color: rgba(0, 0, 0, 0);">'
    result = result.replace(def, () => {
      let str = ''
      for (const path of pathes) {
        str += path.outerHTML
      }
      return `${def}${str}`
    })
    this.exportContainer = null
    return result
  }

  /**
   * Get HTML with style
   *
   * @param {*} title Page title
   * @param {*} printOptimization Optimize HTML and CSS for printing
   */
  async generate (title = '', printOptimization = false, extraCss = '') {
    // WORKAROUND: Hide Prism.js style when exporting or printing. Otherwise the background color is white in the dark theme.
    const highlightCssStyle = printOptimization ? `@media print { ${highlightCss} }` : highlightCss
    const html = await this.renderHtml()
    const katexCssStyle = this.mathRendererCalled ? katexCss : ''
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
  ${githubMarkdownCss}
  </style>
  <style>
  ${highlightCssStyle}
  </style>
  <style>
  ${katexCssStyle}
  </style>
  <style>
    .markdown-body {
      box-sizing: border-box;
      min-width: 200px;
      max-width: 980px;
      margin: 0 auto;
      padding: 45px;
    }
    .markdown-body table {
      display: table;
    }
    .markdown-body li.task-list-item {
      list-style-type: none;
    }
    .markdown-body li > [type=checkbox] {
      margin: 0 0 0 -1.3em;
    }
    .markdown-body input[type="checkbox"] ~ p {
      margin-top: 0;
      display: inline-block;
    }
    @media (max-width: 767px) {
      .markdown-body {
        padding: 15px;
      }
    }
  </style>
  <style>${extraCss}</style>
</head>
<body>
  <article class="markdown-body">
  ${html}
  </article>
</body>
</html>`
  }
}

export default ExportHtml
