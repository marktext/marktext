import { tokenizer } from '../parser/'
import { conflict } from '../utils'
import { CLASS_OR_ID } from '../config'

const INLINE_UPDATE_FRAGMENTS = [
  '(?:^|\n) {0,3}([*+-] {1,4})', // Bullet list
  '(?:^|\n)(\\[[x ]{1}\\] {1,4})', // Task list
  '(?:^|\n) {0,3}(\\d{1,9}(?:\\.|\\)) {1,4})', // Order list
  '(?:^|\n) {0,3}(#{1,6})(?=\\s{1,}|$)', // ATX headings
  '^(?:[\\s\\S]+?)\\n {0,3}(\\={3,}|\\-{3,})(?= {1,}|$)', // Setext headings **match from beginning**
  '(?:^|\n) {0,3}(>).+', // Block quote
  '^( {4,})', // Indent code **match from beginning**
  '(?:^|\n) {0,3}((?:\\* *\\* *\\*|- *- *-|_ *_ *_)[ \\*\\-\\_]*)$' // Thematic break
]

const INLINE_UPDATE_REG = new RegExp(INLINE_UPDATE_FRAGMENTS.join('|'), 'i')

const updateCtrl = ContentState => {
  // handle task list item checkbox click
  ContentState.prototype.listItemCheckBoxClick = function (checkbox) {
    const { checked, id } = checkbox
    const block = this.getBlock(id)
    block.checked = checked
    checkbox.classList.toggle(CLASS_OR_ID.AG_CHECKBOX_CHECKED)
  }

  ContentState.prototype.checkSameMarkerOrDelimiter = function (list, markerOrDelimiter) {
    if (!/ol|ul/.test(list.type)) return false
    return list.children[0].bulletMarkerOrDelimiter === markerOrDelimiter
  }

  ContentState.prototype.checkNeedRender = function (cursor = this.cursor) {
    const { labels } = this.stateRender
    const { start: cStart, end: cEnd, anchor, focus } = cursor
    const startBlock = this.getBlock(cStart ? cStart.key : anchor.key)
    const endBlock = this.getBlock(cEnd ? cEnd.key : focus.key)
    const startOffset = cStart ? cStart.offset : anchor.offset
    const endOffset = cEnd ? cEnd.offset : focus.offset
    const NO_NEED_TOKEN_REG = /text|hard_line_break|soft_line_break/

    for (const token of tokenizer(startBlock.text, undefined, undefined, labels)) {
      if (NO_NEED_TOKEN_REG.test(token.type)) continue
      const { start, end } = token.range
      const textLen = startBlock.text.length
      if (
        conflict([Math.max(0, start - 1), Math.min(textLen, end + 1)], [startOffset, startOffset])
      ) {
        return true
      }
    }
    for (const token of tokenizer(endBlock.text, undefined, undefined, labels)) {
      if (NO_NEED_TOKEN_REG.test(token.type)) continue
      const { start, end } = token.range
      const textLen = endBlock.text.length
      if (
        conflict([Math.max(0, start - 1), Math.min(textLen, end + 1)], [endOffset, endOffset])
      ) {
        return true
      }
    }

    return false
  }

  /**
   * block must be span block.
   */
  ContentState.prototype.checkInlineUpdate = function (block) {
    // table cell can not have blocks in it
    if (/th|td|figure/.test(block.type)) return false
    if (/codeContent|languageInput/.test(block.functionType)) return false

    let line = null
    const { text } = block
    if (block.type === 'span') {
      line = block
      block = this.getParent(block)
    }
    const listItem = this.getParent(block)
    const [
      match, bullet, tasklist, order, atxHeader,
      setextHeader, blockquote, indentCode, hr
    ] = text.match(INLINE_UPDATE_REG) || []

    switch (true) {
      case (!!hr && new Set(hr.split('').filter(i => /\S/.test(i))).size === 1):
        return this.updateThematicBreak(block, hr, line)

      case !!bullet:
        return this.updateList(block, 'bullet', bullet, line)

      // only `bullet` list item can be update to `task` list item
      case !!tasklist && listItem && listItem.listItemType === 'bullet':
        return this.updateTaskListItem(block, 'tasklist', tasklist)

      case !!order:
        return this.updateList(block, 'order', order, line)

      case !!atxHeader:
        return this.updateAtxHeader(block, atxHeader, line)

      case !!setextHeader:
        return this.updateSetextHeader(block, setextHeader, line)

      case !!blockquote:
        return this.updateBlockQuote(block, line)

      case !!indentCode:
        return this.updateIndentCode(block, line)

      case !match:
      default:
        return this.updateToParagraph(block, line)
    }
  }

  // Thematic break
  ContentState.prototype.updateThematicBreak = function (block, marker, line) {
    // If the block is already thematic break, no need to update.
    if (block.type === 'hr') return null
    const text = line.text
    const lines = text.split('\n')
    const preParagraphLines = []
    let thematicLine = ''
    const postParagraphLines = []
    let thematicLineHasPushed = false
    for (const l of lines) {
      /* eslint-disable no-useless-escape */
      if (/ {0,3}(?:\* *\* *\*|- *- *-|_ *_ *_)[ \*\-\_]*$/.test(l) && !thematicLineHasPushed) {
      /* eslint-enable no-useless-escape */
        thematicLine = l
        thematicLineHasPushed = true
      } else if (!thematicLineHasPushed) {
        preParagraphLines.push(l)
      } else {
        postParagraphLines.push(l)
      }
    }

    const thematicBlock = this.createBlock('hr')
    const thematicLineBlock = this.createBlock('span', {
      text: thematicLine,
      functionType: 'thematicBreakLine'
    })
    this.appendChild(thematicBlock, thematicLineBlock)
    this.insertBefore(thematicBlock, block)
    if (preParagraphLines.length) {
      const preBlock = this.createBlockP(preParagraphLines.join('\n'))
      this.insertBefore(preBlock, thematicBlock)
    }
    if (postParagraphLines.length) {
      const postBlock = this.createBlockP(postParagraphLines.join('\n'))
      this.insertAfter(postBlock, thematicBlock)
    }

    this.removeBlock(block)
    const { start, end } = this.cursor
    const key = thematicBlock.children[0].key
    const preParagraphLength = preParagraphLines.reduce((acc, i) => acc + i.length + 1, 0) // Add one, because the `\n`
    const startOffset = start.offset - preParagraphLength
    const endOffset = end.offset - preParagraphLength
    this.cursor = {
      start: { key, offset: startOffset },
      end: { key, offset: endOffset }
    }
    return thematicBlock
  }

  ContentState.prototype.updateList = function (block, type, marker = '', line) {
    const cleanMarker = marker ? marker.trim() : null
    const { preferLooseListItem } = this.muya.options
    const wrapperTag = type === 'order' ? 'ol' : 'ul' // `bullet` => `ul` and `order` => `ol`
    const { start, end } = this.cursor
    const startOffset = start.offset
    const endOffset = end.offset
    const newListItemBlock = this.createBlock('li')
    const LIST_ITEM_REG = /^ {0,3}(?:[*+-]|\d{1,9}(?:\.|\))) {0,4}/
    const text = line.text
    const lines = text.split('\n')

    const preParagraphLines = []
    let listItemLines = []
    let isPushedListItemLine = false
    if (marker) {
      for (const l of lines) {
        if (LIST_ITEM_REG.test(l) && !isPushedListItemLine) {
          listItemLines.push(l.replace(LIST_ITEM_REG, ''))
          isPushedListItemLine = true
        } else if (!isPushedListItemLine) {
          preParagraphLines.push(l)
        } else {
          listItemLines.push(l)
        }
      }
    } else {
      // From front menu click.
      listItemLines = lines
    }

    const pBlock = this.createBlockP(listItemLines.join('\n'))
    this.insertBefore(pBlock, block)

    if (preParagraphLines.length > 0) {
      const preParagraphBlock = this.createBlockP(preParagraphLines.join('\n'))
      this.insertBefore(preParagraphBlock, pBlock)
    }

    this.removeBlock(block)

    // important!
    block = pBlock

    const preSibling = this.getPreSibling(block)
    const nextSibling = this.getNextSibling(block)
    newListItemBlock.listItemType = type
    newListItemBlock.isLooseListItem = preferLooseListItem

    let bulletMarkerOrDelimiter
    if (type === 'order') {
      bulletMarkerOrDelimiter = (cleanMarker && cleanMarker.length >= 2) ? cleanMarker.slice(-1) : '.'
    } else {
      const { bulletListMarker } = this.muya.options
      bulletMarkerOrDelimiter = marker ? marker.charAt(0) : bulletListMarker
    }
    newListItemBlock.bulletMarkerOrDelimiter = bulletMarkerOrDelimiter

    // Special cases for CommonMark 264 and 265: Changing the bullet or ordered list delimiter starts a new list.
    // Same list type or new list
    if (
      preSibling &&
      this.checkSameMarkerOrDelimiter(preSibling, bulletMarkerOrDelimiter) &&
      nextSibling &&
      this.checkSameMarkerOrDelimiter(nextSibling, bulletMarkerOrDelimiter)
    ) {
      this.appendChild(preSibling, newListItemBlock)
      const partChildren = nextSibling.children.splice(0)
      partChildren.forEach(b => this.appendChild(preSibling, b))
      this.removeBlock(nextSibling)
      this.removeBlock(block)
      const isLooseListItem = preSibling.children.some(c => c.isLooseListItem)
      preSibling.children.forEach(c => (c.isLooseListItem = isLooseListItem))
    } else if (
      preSibling &&
      this.checkSameMarkerOrDelimiter(preSibling, bulletMarkerOrDelimiter)
    ) {
      this.appendChild(preSibling, newListItemBlock)
      this.removeBlock(block)
      const isLooseListItem = preSibling.children.some(c => c.isLooseListItem)
      preSibling.children.forEach(c => (c.isLooseListItem = isLooseListItem))
    } else if (
      nextSibling &&
      this.checkSameMarkerOrDelimiter(nextSibling, bulletMarkerOrDelimiter)
    ) {
      this.insertBefore(newListItemBlock, nextSibling.children[0])
      this.removeBlock(block)
      const isLooseListItem = nextSibling.children.some(c => c.isLooseListItem)
      nextSibling.children.forEach(c => (c.isLooseListItem = isLooseListItem))
    } else {
      // Create a new list when changing list type, bullet or list delimiter
      const listBlock = this.createBlock(wrapperTag, {
        listType: type
      })

      if (wrapperTag === 'ol') {
        const start = cleanMarker ? cleanMarker.slice(0, -1) : 1
        listBlock.start = /^\d+$/.test(start) ? start : 1
      }

      this.appendChild(listBlock, newListItemBlock)
      this.insertBefore(listBlock, block)
      this.removeBlock(block)
    }

    // key point
    this.appendChild(newListItemBlock, block)
    const TASK_LIST_REG = /^\[[x ]\] {1,4}/i
    const listItemText = block.children[0].text
    const { key } = block.children[0]
    const delta = marker.length + preParagraphLines.join('\n').length + 1
    this.cursor = {
      start: {
        key,
        offset: Math.max(0, startOffset - delta)
      },
      end: {
        key,
        offset: Math.max(0, endOffset - delta)
      }
    }
    if (TASK_LIST_REG.test(listItemText)) {
      const [,, tasklist,,,,] = listItemText.match(INLINE_UPDATE_REG) || [] // eslint-disable-line comma-spacing
      return this.updateTaskListItem(block, 'tasklist', tasklist)
    } else {
      return block
    }
  }

  ContentState.prototype.updateTaskListItem = function (block, type, marker = '') {
    const { preferLooseListItem } = this.muya.options
    const parent = this.getParent(block)
    const grandpa = this.getParent(parent)
    const checked = /\[x\]\s/i.test(marker) // use `i` flag to ignore upper case or lower case
    const checkbox = this.createBlock('input', {
      checked
    })
    const { start, end } = this.cursor

    this.insertBefore(checkbox, block)
    block.children[0].text = block.children[0].text.substring(marker.length)
    parent.listItemType = 'task'
    parent.isLooseListItem = preferLooseListItem

    let taskListWrapper
    if (this.isOnlyChild(parent)) {
      grandpa.listType = 'task'
    } else if (this.isFirstChild(parent) || this.isLastChild(parent)) {
      taskListWrapper = this.createBlock('ul', {
        listType: 'task'
      })

      this.isFirstChild(parent) ? this.insertBefore(taskListWrapper, grandpa) : this.insertAfter(taskListWrapper, grandpa)
      this.removeBlock(parent)
      this.appendChild(taskListWrapper, parent)
    } else {
      taskListWrapper = this.createBlock('ul', {
        listType: 'task'
      })

      const bulletListWrapper = this.createBlock('ul', {
        listType: 'bullet'
      })

      let preSibling = this.getPreSibling(parent)
      while (preSibling) {
        this.removeBlock(preSibling)
        if (bulletListWrapper.children.length) {
          const firstChild = bulletListWrapper.children[0]
          this.insertBefore(preSibling, firstChild)
        } else {
          this.appendChild(bulletListWrapper, preSibling)
        }
        preSibling = this.getPreSibling(preSibling)
      }

      this.removeBlock(parent)
      this.appendChild(taskListWrapper, parent)
      this.insertBefore(taskListWrapper, grandpa)
      this.insertBefore(bulletListWrapper, taskListWrapper)
    }

    this.cursor = {
      start: {
        key: start.key,
        offset: Math.max(0, start.offset - marker.length)
      },
      end: {
        key: end.key,
        offset: Math.max(0, end.offset - marker.length)
      }
    }
    return taskListWrapper || grandpa
  }

  // ATX heading doesn't support soft line break and hard line break.
  ContentState.prototype.updateAtxHeader = function (block, header, line) {
    const newType = `h${header.length}`
    const headingStyle = 'atx'
    if (block.type === newType && block.headingStyle === headingStyle) {
      return null
    }
    const text = line.text
    const lines = text.split('\n')
    const preParagraphLines = []
    let atxLine = ''
    const postParagraphLines = []
    let atxLineHasPushed = false

    for (const l of lines) {
      if (/^ {0,3}#{1,6}(?=\s{1,}|$)/.test(l) && !atxLineHasPushed) {
        atxLine = l
        atxLineHasPushed = true
      } else if (!atxLineHasPushed) {
        preParagraphLines.push(l)
      } else {
        postParagraphLines.push(l)
      }
    }

    const atxBlock = this.createBlock(newType, {
      headingStyle
    })
    const atxLineBlock = this.createBlock('span', {
      text: atxLine,
      functionType: 'atxLine'
    })
    this.appendChild(atxBlock, atxLineBlock)
    this.insertBefore(atxBlock, block)
    if (preParagraphLines.length) {
      const preBlock = this.createBlockP(preParagraphLines.join('\n'))
      this.insertBefore(preBlock, atxBlock)
    }
    if (postParagraphLines.length) {
      const postBlock = this.createBlockP(postParagraphLines.join('\n'))
      this.insertAfter(postBlock, atxBlock)
    }

    this.removeBlock(block)

    const { start, end } = this.cursor
    const key = atxBlock.children[0].key
    this.cursor = {
      start: { key, offset: start.offset },
      end: { key, offset: end.offset }
    }
    return atxBlock
  }

  ContentState.prototype.updateSetextHeader = function (block, marker, line) {
    const newType = /=/.test(marker) ? 'h1' : 'h2'
    const headingStyle = 'setext'
    if (block.type === newType && block.headingStyle === headingStyle) {
      return null
    }

    const text = line.text
    const lines = text.split('\n')
    const setextLines = []
    const postParagraphLines = []
    let setextLineHasPushed = false

    for (const l of lines) {
      if (/^ {0,3}(?:={3,}|-{3,})(?= {1,}|$)/.test(l) && !setextLineHasPushed) {
        setextLineHasPushed = true
      } else if (!setextLineHasPushed) {
        setextLines.push(l)
      } else {
        postParagraphLines.push(l)
      }
    }

    const setextBlock = this.createBlock(newType, {
      headingStyle,
      marker
    })
    const setextLineBlock = this.createBlock('span', {
      text: setextLines.join('\n'),
      functionType: 'paragraphContent'
    })
    this.appendChild(setextBlock, setextLineBlock)
    this.insertBefore(setextBlock, block)

    if (postParagraphLines.length) {
      const postBlock = this.createBlockP(postParagraphLines.join('\n'))
      this.insertAfter(postBlock, setextBlock)
    }

    this.removeBlock(block)

    const key = setextBlock.children[0].key
    const offset = setextBlock.children[0].text.length

    this.cursor = {
      start: { key, offset },
      end: { key, offset }
    }

    return setextBlock
  }

  ContentState.prototype.updateBlockQuote = function (block, line) {
    const text = line.text
    const lines = text.split('\n')
    const preParagraphLines = []
    const quoteLines = []
    let quoteLinesHasPushed = false

    for (const l of lines) {
      if (/^ {0,3}>/.test(l) && !quoteLinesHasPushed) {
        quoteLinesHasPushed = true
        quoteLines.push(l.trimStart().substring(1).trimStart())
      } else if (!quoteLinesHasPushed) {
        preParagraphLines.push(l)
      } else {
        quoteLines.push(l)
      }
    }
    let quoteParagraphBlock
    if (/^h\d/.test(block.type)) {
      quoteParagraphBlock = this.createBlock(block.type, {
        headingStyle: block.headingStyle
      })
      if (block.headingStyle === 'setext') {
        quoteParagraphBlock.marker = block.marker
      }
      const headerContent = this.createBlock('span', {
        text: quoteLines.join('\n'),
        functionType: block.headingStyle === 'setext' ? 'paragraphContent' : 'atxLine'
      })
      this.appendChild(quoteParagraphBlock, headerContent)
    } else {
      quoteParagraphBlock = this.createBlockP(quoteLines.join('\n'))
    }

    const quoteBlock = this.createBlock('blockquote')
    this.appendChild(quoteBlock, quoteParagraphBlock)
    this.insertBefore(quoteBlock, block)

    if (preParagraphLines.length) {
      const preParagraphBlock = this.createBlockP(preParagraphLines.join('\n'))
      this.insertBefore(preParagraphBlock, quoteBlock)
    }

    this.removeBlock(block)

    const key = quoteParagraphBlock.children[0].key
    const { start, end } = this.cursor

    this.cursor = {
      start: { key, offset: Math.max(0, start.offset - 1) },
      end: { key, offset: Math.max(0, end.offset - 1) }
    }
    return quoteBlock
  }

  ContentState.prototype.updateIndentCode = function (block, line) {
    const lang = ''
    const codeBlock = this.createBlock('code', {
      lang
    })
    const inputBlock = this.createBlock('span', {
      functionType: 'languageInput'
    })
    const preBlock = this.createBlock('pre', {
      functionType: 'indentcode',
      lang
    })

    const text = line ? line.text : block.text

    const lines = text.split('\n')
    const codeLines = []
    const paragraphLines = []
    let canBeCodeLine = true

    for (const l of lines) {
      if (/^ {4,}/.test(l) && canBeCodeLine) {
        codeLines.push(l.replace(/^ {4}/, ''))
      } else {
        canBeCodeLine = false
        paragraphLines.push(l)
      }
    }
    const codeContent = this.createBlock('span', {
      text: codeLines.join('\n'),
      functionType: 'codeContent',
      lang
    })

    this.appendChild(codeBlock, codeContent)
    this.appendChild(preBlock, inputBlock)
    this.appendChild(preBlock, codeBlock)
    this.insertBefore(preBlock, block)

    if (paragraphLines.length > 0 && line) {
      const newLine = this.createBlock('span', {
        text: paragraphLines.join('\n')
      })
      this.insertBefore(newLine, line)
      this.removeBlock(line)
    } else {
      this.removeBlock(block)
    }

    const key = codeBlock.children[0].key
    const { start, end } = this.cursor
    this.cursor = {
      start: { key, offset: start.offset - 4 },
      end: { key, offset: end.offset - 4 }
    }
    return preBlock
  }

  ContentState.prototype.updateToParagraph = function (block, line) {
    if (/^h\d$/.test(block.type) && block.headingStyle === 'setext') {
      return null
    }

    const newType = 'p'
    if (block.type !== newType) {
      const newBlock = this.createBlockP(line.text)
      this.insertBefore(newBlock, block)
      this.removeBlock(block)
      const { start, end } = this.cursor
      const key = newBlock.children[0].key
      this.cursor = {
        start: { key, offset: start.offset },
        end: { key, offset: end.offset }
      }
      return block
    }
    return null
  }
}

export default updateCtrl
