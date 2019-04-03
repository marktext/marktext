import marked from '../parser/marked'
import Prism from 'prismjs2'
import katex from 'katex'
import githubMarkdownCss from 'github-markdown-css/github-markdown.css'
import highlightCss from 'prismjs2/themes/prism.css'
import katexCss from 'katex/dist/katex.css'
import { EXPORT_DOMPURIFY_CONFIG } from '../config'
import { sanitize } from '../utils'
import { validEmoji } from '../ui/emojis'

export const getSanitizeHtml = markdown => {
  const html = marked(markdown)
  return sanitize(html, EXPORT_DOMPURIFY_CONFIG)
}

class ExportHtml {
  constructor (markdown) {
    this.markdown = markdown
  }

  // render pure html by marked
  renderHtml () {
    return marked(this.markdown, {
      highlight (code, lang) {
        // Language may be undefined (GH#591)
        if (!lang) {
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
      mathRenderer (math, displayMode) {
        return katex.renderToString(math, {
          displayMode
        })
      }
    })
  }

  /**
   * Get HTML with style
   *
   * @param {*} title Page title
   * @param {*} printOptimization Optimize HTML and CSS for printing
   */
  generate (title = '', printOptimization = false) {
    // WORKAROUND: Hide Prism.js style when exporting or printing. Otherwise the background color is white in the dark theme.
    const highlightCssStyle = printOptimization ? `@media print { ${highlightCss} }` : highlightCss
    const html = sanitize(this.renderHtml(), EXPORT_DOMPURIFY_CONFIG)
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
  ${katexCss}
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
