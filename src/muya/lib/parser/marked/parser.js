import Renderer from './renderer'
import InlineLexer from './inlineLexer'
import Slugger from './slugger'
import TextRenderer from './textRenderer'
import defaultOptions from './options'

/**
 * Parsing & Compiling
 */

function Parser (options) {
  this.tokens = []
  this.token = null
  this.footnotes = null
  this.footnoteIdentifier = ''
  this.options = options || defaultOptions
  this.options.renderer = this.options.renderer || new Renderer()
  this.renderer = this.options.renderer
  this.renderer.options = this.options
  this.slugger = new Slugger()
}

/**
 * Parse Loop
 */

Parser.prototype.parse = function (src) {
  this.inline = new InlineLexer(src.links, src.footnotes, this.options)
  // use an InlineLexer with a TextRenderer to extract pure text
  this.inlineText = new InlineLexer(
    src.links,
    src.footnotes,
    Object.assign({}, this.options, { renderer: new TextRenderer() })
  )
  this.tokens = src.reverse()
  this.footnotes = src.footnotes
  let out = ''
  while (this.next()) {
    out += this.tok()
  }

  return out
}

/**
 * Next Token
 */

Parser.prototype.next = function () {
  this.token = this.tokens.pop()
  return this.token
}

/**
 * Preview Next Token
 */

Parser.prototype.peek = function () {
  return this.tokens[this.tokens.length - 1] || 0
}

/**
 * Parse Text Tokens
 */

Parser.prototype.parseText = function () {
  let body = this.token.text

  while (this.peek().type === 'text') {
    body += '\n' + this.next().text
  }

  return this.inline.output(body)
}

/**
 * Parse Current Token
 */

Parser.prototype.tok = function () {
  switch (this.token.type) {
    case 'frontmatter': {
      return this.renderer.frontmatter(this.token.text)
    }
    case 'space': {
      return ''
    }
    case 'hr': {
      return this.renderer.hr()
    }
    case 'heading': {
      return this.renderer.heading(
        this.inline.output(this.token.text),
        this.token.depth,
        unescape(this.inlineText.output(this.token.text)),
        this.slugger,
        this.token.headingStyle
      )
    }
    case 'multiplemath': {
      const { text } = this.token
      return this.renderer.multiplemath(text)
    }
    case 'code': {
      const { codeBlockStyle, text, lang, escaped } = this.token
      return this.renderer.code(text, lang, escaped, codeBlockStyle)
    }
    case 'table': {
      let header = ''
      let body = ''
      let i
      let row
      let cell
      let j

      // header
      cell = ''
      for (i = 0; i < this.token.header.length; i++) {
        cell += this.renderer.tablecell(
          this.inline.output(this.token.header[i]), {
            header: true,
            align: this.token.align[i]
          }
        )
      }
      header += this.renderer.tablerow(cell)

      for (i = 0; i < this.token.cells.length; i++) {
        row = this.token.cells[i]

        cell = ''
        for (j = 0; j < row.length; j++) {
          cell += this.renderer.tablecell(
            this.inline.output(row[j]), {
              header: false,
              align: this.token.align[j]
            }
          )
        }

        body += this.renderer.tablerow(cell)
      }
      return this.renderer.table(header, body)
    }
    case 'blockquote_start': {
      let body = ''

      while (this.next().type !== 'blockquote_end') {
        body += this.tok()
      }

      return this.renderer.blockquote(body)
    }
    // All the tokens will be footnotes if it after a footnote_start token. Because we put all footnote token at the end.
    case 'footnote_start': {
      let body = ''
      let itemBody = ''
      this.footnoteIdentifier = this.token.identifier
      while (this.next()) {
        if (this.token.type === 'footnote_end') {
          const footnoteInfo = this.footnotes[this.footnoteIdentifier]
          body += this.renderer.footnoteItem(itemBody, footnoteInfo)
          this.footnoteIdentifier = ''
          itemBody = ''
        } else if (this.token.type === 'footnote_start') {
          this.footnoteIdentifier = this.token.identifier
          itemBody = ''
        } else {
          itemBody += this.tok()
        }
      }
      return this.renderer.footnote(body)
    }
    case 'list_start': {
      let body = ''
      let taskList = false
      const { ordered, start } = this.token

      while (this.next().type !== 'list_end') {
        if (this.token.checked !== undefined) {
          taskList = true
        }

        body += this.tok()
      }

      return this.renderer.list(body, ordered, start, taskList)
    }
    case 'list_item_start': {
      let body = ''
      const { checked } = this.token

      while (this.next().type !== 'list_item_end') {
        body += this.token.type === 'text' ? this.parseText() : this.tok()
      }

      return this.renderer.listitem(body, checked)
    }
    case 'loose_item_start': {
      let body = ''
      const { checked } = this.token

      while (this.next().type !== 'list_item_end') {
        body += this.tok()
      }

      return this.renderer.listitem(body, checked)
    }
    case 'html': {
      // TODO parse inline content if parameter markdown=1
      return this.renderer.html(this.token.text)
    }
    case 'paragraph': {
      return this.renderer.paragraph(this.inline.output(this.token.text))
    }
    case 'text': {
      return this.renderer.paragraph(this.parseText())
    }
    case 'toc': {
      return this.renderer.toc()
    }
    default: {
      const errMsg = 'Token with "' + this.token.type + '" type was not found.'
      if (this.options.silent) {
        console.error(errMsg)
      } else {
        throw new Error(errMsg)
      }
    }
  }
}

export default Parser
