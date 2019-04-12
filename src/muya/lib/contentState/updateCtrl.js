import { tokenizer } from '../parser/'
import { conflict } from '../utils'
import { CLASS_OR_ID } from '../config'

const INLINE_UPDATE_FRAGMENTS = [
  '^([*+-]\\s)', // Bullet list
  '^(\\[[x\\s]{1}\\]\\s)', // Task list
  '^(\\d{1,9}(?:\\.|\\))\\s)', // Order list
  '^\\s{0,3}(#{1,6})(?=\\s{1,}|$)', // ATX headings
  '^\\s{0,3}(\\={3,}|\\-{3,})(?=\\s{1,}|$)', // Setext headings
  '^(>).+', // Block quote
  '^\\s{0,3}((?:\\*\\s*\\*\\s*\\*|-\\s*-\\s*-|_\\s*_\\s*_)[\\s\\*\\-\\_]*)$' // Thematic break
]

const INLINE_UPDATE_REG = new RegExp(INLINE_UPDATE_FRAGMENTS.join('|'), 'i')

const updateCtrl = ContentState => {
  // handle task list item checkbox click
  ContentState.prototype.listItemCheckBoxClick = function (checkbox) {
    const { checked, id } = checkbox
    const block = this.getBlock(id)
    block.checked = checked
    checkbox.classList.toggle(CLASS_OR_ID['AG_CHECKBOX_CHECKED'])
    // this.render()
  }

  ContentState.prototype.checkSameLooseType = function (list, isLooseType) {
    return list.children[0].isLooseListItem === isLooseType
  }

  ContentState.prototype.checkSameMarkerOrDelimiter = function (list, markerOrDelimiter) {
    if (!/ol|ul/.test(list.type)) return false
    return list.children[0].bulletMarkerOrDelimiter === markerOrDelimiter
  }

  ContentState.prototype.checkNeedRender = function (cursor = this.cursor) {
    const { start: cStart, end: cEnd } = cursor
    const startBlock = this.getBlock(cStart.key)
    const endBlock = this.getBlock(cEnd.key)
    const startOffset = cStart.offset
    const endOffset = cEnd.offset

    for (const token of tokenizer(startBlock.text)) {
      if (token.type === 'text') continue
      const { start, end } = token.range
      const textLen = startBlock.text.length
      if (
        conflict([Math.max(0, start - 1), Math.min(textLen, end + 1)], [startOffset, startOffset])
      ) {
        return true
      }
    }
    for (const token of tokenizer(endBlock.text)) {
      if (token.type === 'text') continue
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

  ContentState.prototype.checkInlineUpdate = function (block) {
    // table cell can not have blocks in it
    if (/th|td|figure/.test(block.type)) return false
    if (/codeLine|languageInput/.test(block.functionType)) return false
    // line in paragraph can also update to other block. So comment bellow code.
    // if (block.type === 'span' && block.preSibling) return false
    const hasPreLine = !!(block.type === 'span' && block.preSibling)
    let line = null
    const { text } = block
    if (block.type === 'span') {
      line = block
      block = this.getParent(block)
    }
    const parent = this.getParent(block)
    const [match, bullet, tasklist, order, atxHeader, setextHeader, blockquote, hr] = text.match(INLINE_UPDATE_REG) || []

    switch (true) {
      case (
        (!!hr && new Set(hr.split('').filter(i => /\S/.test(i))).size === 1) ||
        (!!setextHeader && !hasPreLine)
      ):
        return this.updateHr(block, hr || setextHeader)

      case !!bullet:
        return this.updateList(block, 'bullet', bullet, line)

      // only `bullet` list item can be update to `task` list item
      case !!tasklist && parent && parent.listItemType === 'bullet':
        return this.updateTaskListItem(block, 'tasklist', tasklist)

      case !!order:
        return this.updateList(block, 'order', order, line)

      case !!atxHeader:
        return this.updateAtxHeader(block, atxHeader, line)

      case !!setextHeader && hasPreLine:
        return this.updateSetextHeader(block, setextHeader, line)

      case !!blockquote:
        return this.updateBlockQuote(block, line)

      case !match:
      default:
        return this.updateToParagraph(block)
    }
  }

  // thematic break
  ContentState.prototype.updateHr = function (block, marker) {
    if (block.type !== 'hr') {
      block.type = 'hr'
      block.text = marker
      block.children.length = 0
      const { key } = block
      this.cursor.start.key = this.cursor.end.key = key
      return block
    }
    return null
  }

  ContentState.prototype.updateList = function (block, type, marker = '', line) {
    if (block.type === 'span') {
      block = this.getParent(block)
    }

    const cleanMarker = marker ? marker.trim() : null
    const { preferLooseListItem } = this
    const parent = this.getParent(block)
    const wrapperTag = type === 'order' ? 'ol' : 'ul' // `bullet` => `ul` and `order` => `ol`
    const { start, end } = this.cursor
    const startOffset = start.offset
    const endOffset = end.offset
    const newBlock = this.createBlock('li')

    if (/^h\d$/.test(block.type)) {
      delete block.marker
      delete block.headingStyle
      block.type = 'p'
      block.children = []
      const line = this.createBlock('span', block.text.substring(marker.length))
      block.text = ''
      this.appendChild(block, line)
    } else {
      line.text = line.text.substring(marker.length)
      const paragraphBefore = this.createBlock('p')
      const index = block.children.indexOf(line)
      if (index !== 0) {
        const removeCache = []
        for (const child of block.children) {
          if (child === line) break
          removeCache.push(child)
        }
        removeCache.forEach(c => {
          this.removeBlock(c)
          this.appendChild(paragraphBefore, c)
        })
        this.insertBefore(paragraphBefore, block)
      }
    }

    const preSibling = this.getPreSibling(block)
    const nextSibling = this.getNextSibling(block)
    newBlock.listItemType = type
    newBlock.isLooseListItem = preferLooseListItem

    let bulletMarkerOrDelimiter
    if (type === 'order') {
      bulletMarkerOrDelimiter = (cleanMarker && cleanMarker.length >= 2) ? cleanMarker.slice(-1) : '.'
    } else {
      const { bulletListMarker } = this
      bulletMarkerOrDelimiter = marker ? marker.charAt(0) : bulletListMarker
    }
    newBlock.bulletMarkerOrDelimiter = bulletMarkerOrDelimiter

    // Special cases for CommonMark 264 and 265: Changing the bullet or ordered list delimiter starts a new list.
    // Same list type or new list
    if (
      preSibling &&
      this.checkSameMarkerOrDelimiter(preSibling, bulletMarkerOrDelimiter) &&
      nextSibling &&
      this.checkSameMarkerOrDelimiter(nextSibling, bulletMarkerOrDelimiter)
    ) {
      this.appendChild(preSibling, newBlock)
      const partChildren = nextSibling.children.splice(0)
      partChildren.forEach(b => this.appendChild(preSibling, b))
      this.removeBlock(nextSibling)
      this.removeBlock(block)
      const isLooseListItem = preSibling.children.some(c => c.isLooseListItem)
      preSibling.children.forEach(c => c.isLooseListItem = isLooseListItem)
    } else if (
      preSibling &&
      this.checkSameMarkerOrDelimiter(preSibling, bulletMarkerOrDelimiter)
    ) {
      this.appendChild(preSibling, newBlock)
      this.removeBlock(block)
      const isLooseListItem = preSibling.children.some(c => c.isLooseListItem)
      preSibling.children.forEach(c => c.isLooseListItem = isLooseListItem)
    } else if (
      nextSibling &&
      this.checkSameMarkerOrDelimiter(nextSibling, bulletMarkerOrDelimiter)
    ) {
      this.insertBefore(newBlock, nextSibling.children[0])
      this.removeBlock(block)
      const isLooseListItem = nextSibling.children.some(c => c.isLooseListItem)
      nextSibling.children.forEach(c => c.isLooseListItem = isLooseListItem)
    } else if (
      // todo@jocs remove this if in 0.15.xx
      parent &&
      parent.listType === type &&
      this.checkSameLooseType(parent, preferLooseListItem)
    ) {
      this.insertBefore(newBlock, block)
      this.removeBlock(block)
    } else {
      // Create a new list when changing list type, bullet or list delimiter
      const listBlock = this.createBlock(wrapperTag)
      listBlock.listType = type
      if (wrapperTag === 'ol') {
        const start = cleanMarker ? cleanMarker.slice(0, -1) : 1
        listBlock.start = /^\d+$/.test(start) ? start : 1
      }
      this.appendChild(listBlock, newBlock)
      this.insertBefore(listBlock, block)
      this.removeBlock(block)
    }

    // key point
    this.appendChild(newBlock, block)
    const TASK_LIST_REG = /^\[[x ]\] /i
    const listItemText = block.children[0].text
    if (TASK_LIST_REG.test(listItemText)) {
      const [,,tasklist,,,,] = listItemText.match(INLINE_UPDATE_REG) || []
      return this.updateTaskListItem(block, 'tasklist', tasklist)
    } else {
      const { key } = block.children[0]
      this.cursor = {
        start: {
          key,
          offset: Math.max(0, startOffset - marker.length)
        },
        end: {
          key,
          offset: Math.max(0, endOffset - marker.length)
        }
      }
      return block
    }
  }

  ContentState.prototype.updateTaskListItem = function (block, type, marker = '') {
    if (block.type === 'span') {
      block = this.getParent(block)
    }

    const { preferLooseListItem } = this
    const parent = this.getParent(block)
    const grandpa = this.getParent(parent)
    const checked = /\[x\]\s/i.test(marker) // use `i` flag to ignore upper case or lower case
    const checkbox = this.createBlock('input')
    const { start, end } = this.cursor

    checkbox.checked = checked
    this.insertBefore(checkbox, block)
    block.children[0].text = block.children[0].text.substring(marker.length)
    parent.listItemType = 'task'
    parent.isLooseListItem = preferLooseListItem

    let taskListWrapper
    if (this.isOnlyChild(parent)) {
      grandpa.listType = 'task'
    } else if (this.isFirstChild(parent) || this.isLastChild(parent)) {
      taskListWrapper = this.createBlock('ul')
      taskListWrapper.listType = 'task'
      this.isFirstChild(parent) ? this.insertBefore(taskListWrapper, grandpa) : this.insertAfter(taskListWrapper, grandpa)
      this.removeBlock(parent)
      this.appendChild(taskListWrapper, parent)
    } else {
      taskListWrapper = this.createBlock('ul')
      taskListWrapper.listType = 'task'
      const bulletListWrapper = this.createBlock('ul')
      bulletListWrapper.listType = 'bullet'

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

  ContentState.prototype.updateAtxHeader = function (block, header, line) {
    const newType = `h${header.length}`
    const text = line ? line.text : block.text
    if (line) {
      const index = block.children.indexOf(line)
      const header = this.createBlock(newType, text)
      header.headingStyle = 'atx'
      this.insertBefore(header, block)
      const paragraphBefore = this.createBlock('p')
      const paragraphAfter = this.createBlock('p')
      let i = 0
      const len = block.children.length
      for (i; i < len; i++) {
        const child = block.children[i]
        if (i < index) {
          this.appendChild(paragraphBefore, child)
        } else if (i > index) {
          this.appendChild(paragraphAfter, child)
        }
      }
      if (paragraphBefore.children.length) {
        this.insertBefore(paragraphBefore, header)
      }
      if (paragraphAfter.children.length) {
        this.insertAfter(paragraphAfter, header)
      }
      this.removeBlock(block)
      this.cursor.start.key = this.cursor.end.key = header.key
      return header
    } else {
      if (block.type === newType && block.headingStyle === 'atx') {
        return null
      }
      block.headingStyle = 'atx'
      block.type = newType
      block.text = text
      block.children.length = 0
      this.cursor.start.key = this.cursor.end.key = block.key
      return block
    }
  }

  ContentState.prototype.updateSetextHeader = function (block, marker, line) {
    const newType = /=/.test(marker) ? 'h1' : 'h2'
    const header = this.createBlock(newType)
    header.headingStyle = 'setext'
    header.marker = marker
    const index = block.children.indexOf(line)
    let i = 0
    let text = ''
    for (i; i < index; i++) {
      text += `${block.children[i].text}\n`
    }
    header.text = text.trimRight()
    this.insertBefore(header, block)
    if (line.nextSibling) {
      const removedCache = []
      for (const child of block.children) {
        removedCache.push(child)
        if (child === line) {
          break 
        }
      }
      removedCache.forEach(child => this.removeBlock(child))
    } else {
      this.removeBlock(block)
    }
    this.cursor.start.key = this.cursor.end.key = header.key
    this.cursor.start.offset = this.cursor.end.offset = header.text.length
    return header
  }

  ContentState.prototype.updateBlockQuote = function (block, line) {
    if (line && !this.isFirstChild(line)) {
      const paragraphBefore = this.createBlock('p')
      const removeCache = []
      for (const child of block.children) {
        if (child === line) break
        removeCache.push(child)
      }
      removeCache.forEach(c => {
        this.removeBlock(c)
        this.appendChild(paragraphBefore, c)
      })
      this.insertBefore(paragraphBefore, block)
    }
    if (!line && /^h\d/.test(block.type)) {
      block.text = block.text.substring(1).trim()
      delete block.headingStyle
      delete block.marker
      block.type = 'p'
      block.children = []
      const line = this.createBlock('span', block.text.substring(1))
      block.text = ''
      this.appendChild(block, line)
    } else {
      line.text = line.text.substring(1).trim()
    }
    const quoteBlock = this.createBlock('blockquote')
    this.insertBefore(quoteBlock, block)
    this.removeBlock(block)
    this.appendChild(quoteBlock, block)

    const { start, end } = this.cursor
    this.cursor = {
      start: {
        key: start.key,
        offset: start.offset - 1
      },
      end: {
        key: end.key,
        offset: end.offset - 1
      }
    }
    return quoteBlock
  }

  ContentState.prototype.updateToParagraph = function (block) {
    if (/^h\d$/.test(block.type) && block.headingStyle === 'setext') {
      return null
    }
    const newType = 'p'
    if (block.type !== newType) {
      block.type = newType // updateP
      const newLine = this.createBlock('span', block.text)
      this.appendChild(block, newLine)
      block.text = ''
      this.cursor.start.key = this.cursor.end.key = newLine.key
      return block
    }
    return null
  }

  ContentState.prototype.updateCodeBlocks = function (block) {
    const codeBlock = this.getParent(block)
    const preBlock = this.getParent(codeBlock)
    const code = codeBlock.children.map(line => line.text).join('\n')
    this.codeBlocks.set(preBlock.key, code)
  }
}

export default updateCtrl
