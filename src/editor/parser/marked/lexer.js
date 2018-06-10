import { normal, gfm, tables } from './blockRules'
/**
 * Block Lexer
 */

function Lexer (options) {
  this.tokens = []
  this.tokens.links = {}
  this.options = options
  this.rules = normal

  if (this.options.gfm) {
    if (this.options.tables) {
      this.rules = tables
    } else {
      this.rules = gfm
    }
  }
}

/**
 * Preprocessing
 */

Lexer.prototype.lex = function (src) {
  src = src
    .replace(/\r\n|\r/g, '\n')
    .replace(/\t/g, '    ')
    .replace(/\u00a0/g, ' ')
    .replace(/\u2424/g, '\n')

  return this.token(src, true)
}

/**
 * Lexing
 */

Lexer.prototype.token = function (src, top, bq) {
  src = src.replace(/^ +$/gm, '')
  let loose
  let cap
  let bull
  let b
  let item
  let space
  let i
  let l
  let checked
  // Only check front matter at the begining of markdown file
  cap = this.rules.frontmatter.exec(src)
  if (!bq && top && cap) {
    src = src.substring(cap[0].length)
    this.tokens.push({
      type: 'frontmatter',
      text: cap[1]
    })
  }

  while (src) {
    // newline
    cap = this.rules.newline.exec(src)
    if (cap) {
      src = src.substring(cap[0].length)
      if (cap[0].length > 1) {
        this.tokens.push({
          type: 'space'
        })
      }
    }

    // code
    cap = this.rules.code.exec(src)
    if (cap) {
      src = src.substring(cap[0].length)
      cap = cap[0].replace(/^ {4}/gm, '')
      this.tokens.push({
        type: 'code',
        codeBlockStyle: 'indented',
        text: !this.options.pedantic ? cap.replace(/\n+$/, '') : cap
      })
      continue
    }

    // multiple line math
    cap = this.rules.multiplemath.exec(src)
    if (cap) {
      src = src.substring(cap[0].length)
      this.tokens.push({
        type: 'multiplemath',
        text: cap[1]
      })
    }

    // fences (gfm)
    cap = this.rules.fences.exec(src)
    if (cap) {
      src = src.substring(cap[0].length)
      this.tokens.push({
        type: 'code',
        codeBlockStyle: 'fenced',
        lang: cap[2],
        text: cap[3]
      })
      continue
    }

    // heading
    cap = this.rules.heading.exec(src)
    if (cap) {
      src = src.substring(cap[0].length)
      this.tokens.push({
        type: 'heading',
        headingStyle: 'atx',
        depth: cap[1].length,
        text: cap[2]
      })
      continue
    }

    // table no leading pipe (gfm)
    cap = this.rules.nptable.exec(src)
    if (top && cap) {
      src = src.substring(cap[0].length)

      item = {
        type: 'table',
        header: cap[1].replace(/^ *| *\| *$/g, '').split(/ *\| */),
        align: cap[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
        cells: cap[3].replace(/\n$/, '').split('\n')
      }

      for (i = 0; i < item.align.length; i++) {
        if (/^ *-+: *$/.test(item.align[i])) {
          item.align[i] = 'right'
        } else if (/^ *:-+: *$/.test(item.align[i])) {
          item.align[i] = 'center'
        } else if (/^ *:-+ *$/.test(item.align[i])) {
          item.align[i] = 'left'
        } else {
          item.align[i] = null
        }
      }

      for (i = 0; i < item.cells.length; i++) {
        item.cells[i] = item.cells[i].split(/ *\| */)
      }

      this.tokens.push(item)

      continue
    }

    // lheading
    cap = this.rules.lheading.exec(src)
    if (cap) {
      src = src.substring(cap[0].length)
      this.tokens.push({
        type: 'heading',
        headingStyle: 'setext',
        depth: cap[2] === '=' ? 1 : 2,
        text: cap[1]
      })
      continue
    }

    // hr
    cap = this.rules.hr.exec(src)
    if (cap) {
      src = src.substring(cap[0].length)
      this.tokens.push({
        type: 'hr'
      })
      continue
    }

    // blockquote
    cap = this.rules.blockquote.exec(src)
    if (cap) {
      src = src.substring(cap[0].length)

      this.tokens.push({
        type: 'blockquote_start'
      })

      cap = cap[0].replace(/^ *> ?/gm, '')

      // Pass `top` to keep the current
      // "toplevel" state. This is exactly
      // how markdown.pl works.
      this.token(cap, top, true)

      this.tokens.push({
        type: 'blockquote_end'
      })

      continue
    }

    // list
    cap = this.rules.tasklist.exec(src) || this.rules.orderlist.exec(src) || this.rules.bulletlist.exec(src)
    if (cap) {
      src = src.substring(cap[0].length)
      bull = cap[2]
      const ordered = bull.length > 1 && /\d/.test(bull)

      this.tokens.push({
        type: 'list_start',
        ordered,
        listType: bull.length > 1 ? (/\d/.test(bull) ? 'order' : 'task') : 'bullet',
        start: ordered ? +bull : ''
      })

      let next = false
      let prevNext = true
      let listItemIndices = []

      // Get each top-level item.
      cap = cap[0].match(this.rules.item)
      l = cap.length
      i = 0

      for (; i < l; i++) {
        const itemWithBullet = cap[i]
        item = itemWithBullet

        // Remove the list item's bullet
        // so it is seen as the next token.
        space = item.length
        item = item.replace(/^ *([*+-]|\d+\.) +/, '')

        if (this.options.gfm) {
          checked = this.rules.checkbox.exec(item)
          if (checked) {
            checked = checked[1] === 'x'
            item = item.replace(this.rules.checkbox, '')
          } else {
            checked = undefined
          }
        }

        // Outdent whatever the
        // list item contains. Hacky.
        if (~item.indexOf('\n ')) {
          space -= item.length
          item = !this.options.pedantic
            ? item.replace(new RegExp('^ {1,' + space + '}', 'gm'), '')
            : item.replace(/^ {1,4}/gm, '')
        }

        // Determine whether the next list item belongs here.
        // Backpedal if it does not belong in this list.
        if (this.options.smartLists && i !== l - 1) {
          b = this.rules.bullet.exec(cap[i + 1])[0]
          if (bull !== b && !(bull.length > 1 && b.length > 1)) {
            src = cap.slice(i + 1).join('\n') + src
            i = l - 1
          }
        }

        let prevItem = ''
        if (i === 0) {
          prevItem = item
        } else {
          prevItem = cap[i - 1]
        }

        // Determine whether item is loose or not. If previous item is loose
        // this item is also loose.
        loose = next = next || /^ *([*+-]|\d+\.) +\S+\n\n(?!\s*$)/.test(itemWithBullet)

        // Check if previous line ends with a new line.
        if (!loose && (i !== 0 || l > 1) && prevItem.length !== 0 && prevItem.charAt(prevItem.length - 1) === '\n') {
          loose = next = true
        }

        // A list is either loose or tight, so update previous list items.
        if (next && prevNext !== next) {
          for (const index of listItemIndices) {
            this.tokens[index].type = 'loose_item_start'
          }
          listItemIndices = []
        }
        prevNext = next

        if (!loose) {
          listItemIndices.push(this.tokens.length)
        }

        this.tokens.push({
          checked: checked,
          listItemType: bull.length > 1 ? (/\d/.test(bull) ? 'order' : 'task') : 'bullet',
          bulletListItemMarker: /\d/.test(bull) ? '' : bull.charAt(0),
          type: loose ? 'loose_item_start' : 'list_item_start'
        })

        // Recurse.
        this.token(item, false, bq)

        this.tokens.push({
          type: 'list_item_end'
        })
      }

      this.tokens.push({
        type: 'list_end'
      })

      continue
    }

    // html
    cap = this.rules.html.exec(src)
    if (cap) {
      src = src.substring(cap[0].length)
      this.tokens.push({
        type: this.options.sanitize ? 'paragraph' : 'html',
        pre: !this.options.sanitizer && (cap[1] === 'pre' || cap[1] === 'script' || cap[1] === 'style'),
        text: cap[0]
      })
      continue
    }

    // def
    cap = this.rules.def.exec(src)
    if (!bq && top && cap) {
      let text = ''
      while (cap) {
        src = src.substring(cap[0].length)
        this.tokens.links[cap[1].toLowerCase()] = {
          href: cap[2],
          title: cap[3]
        }
        text += cap[0]
        cap = this.rules.def.exec(src)
      }
      if (this.options.disableInline) {
        this.tokens.push({
          type: 'paragraph',
          text
        })
      }
      continue
    }

    // table (gfm)
    cap = this.rules.table.exec(src)
    if (cap) {
      src = src.substring(cap[0].length)

      item = {
        type: 'table',
        header: cap[1].replace(/^ *| *\| *$/g, '').split(/ *\| */),
        align: cap[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
        cells: cap[3].replace(/\n$/, '').split('\n')
      }

      for (i = 0; i < item.align.length; i++) {
        if (/^ *-+: *$/.test(item.align[i])) {
          item.align[i] = 'right'
        } else if (/^ *:-+: *$/.test(item.align[i])) {
          item.align[i] = 'center'
        } else if (/^ *:-+ *$/.test(item.align[i])) {
          item.align[i] = 'left'
        } else {
          item.align[i] = null
        }
      }

      for (i = 0; i < item.cells.length; i++) {
        item.cells[i] = item.cells[i]
          .replace(/^ *\| *| *\| *$/g, '')
          .split(/ *\| */)
      }

      this.tokens.push(item)

      continue
    }

    // top-level paragraph
    cap = this.rules.paragraph.exec(src)
    if (top && cap) {
      src = src.substring(cap[0].length)
      this.tokens.push({
        type: 'paragraph',
        text: cap[1].charAt(cap[1].length - 1) === '\n'
          ? cap[1].slice(0, -1)
          : cap[1]
      })
      continue
    }

    // text
    cap = this.rules.text.exec(src)
    if (cap) {
      // Top-level should never reach here.
      src = src.substring(cap[0].length)
      this.tokens.push({
        type: 'text',
        text: cap[0]
      })
      continue
    }

    if (src) {
      throw new Error('Infinite loop on byte: ' + src.charCodeAt(0))
    }
  }

  return this.tokens
}

export default Lexer
