import Renderer from './renderer'
import InlineLexer from './inlineLexer'
/**
 * Parsing & Compiling
 */

function Parser (options) {
  this.tokens = []
  this.token = null
  this.options = options
  this.options.renderer = this.options.renderer || new Renderer()
  this.renderer = this.options.renderer
  this.renderer.options = this.options
}

/**
 * Parse Loop
 */

Parser.prototype.parse = function (src) {
  this.inline = new InlineLexer(src.links, this.options)
  this.tokens = src.reverse()

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
        this.token.text,
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
      // let flags
      let j

      // header
      cell = ''
      for (i = 0; i < this.token.header.length; i++) {
        // flags = {
        //   header: true,
        //   align: this.token.align[i]
        // }
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
      const { checked, listItemType, bulletListItemMarker } = this.token

      while (this.next().type !== 'list_item_end') {
        body += this.token.type === 'text' ? this.parseText() : this.tok()
      }

      return this.renderer.listitem(body, checked, listItemType, bulletListItemMarker, false)
    }
    case 'loose_item_start': {
      let body = ''
      const { checked, listItemType, bulletListItemMarker } = this.token

      while (this.next().type !== 'list_item_end') {
        body += this.tok()
      }

      return this.renderer.listitem(body, checked, listItemType, bulletListItemMarker, true)
    }
    case 'html': {
      const html = !this.token.pre && !this.options.pedantic
        ? this.inline.output(this.token.text)
        : this.token.text

      return this.renderer.html(html)
    }
    case 'paragraph': {
      return this.renderer.paragraph(this.inline.output(this.token.text))
    }
    case 'text': {
      return this.renderer.paragraph(this.parseText())
    }
  }
}

export default Parser
