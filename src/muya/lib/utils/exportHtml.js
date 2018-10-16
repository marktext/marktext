import marked from '../parser/marked'
import highlight from 'highlight.js'
import katex from 'katex'
import githubMarkdownCss from 'github-markdown-css/github-markdown.css'
import highlightCss from 'highlight.js/styles/default.css'
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
      highlight (code) {
        return highlight.highlightAuto(code).value
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
  // get html with style
  generate (filename = '') {
    const html = this.renderHtml()
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${filename}</title>
  <style>
  ${githubMarkdownCss}
  </style>
  <style>
  ${highlightCss}
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
