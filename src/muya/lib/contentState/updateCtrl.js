import { tokenizer } from '../parser/parse'
import { conflict } from '../utils'
import { CLASS_OR_ID, DEFAULT_TURNDOWN_CONFIG } from '../config'

const INLINE_UPDATE_FRAGMENTS = [
  '^([*+-]\\s)', // Bullet list
  '^(\\[[x\\s]{1}\\]\\s)', // Task list
  '^(\\d+\\.\\s)', // Order list
  '^\\s{0,3}(#{1,6})(?=\\s{1,}|$)', // ATX heading
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
    // only first line block can update to other block
    if (block.type === 'span' && block.preSibling) return false
    if (block.type === 'span') {
      block = this.getParent(block)
    }
    const parent = this.getParent(block)
    const text = block.type === 'p' ? block.children.map(child => child.text).join('\n') : block.text
    const [match, bullet, tasklist, order, header, blockquote, hr] = text.match(INLINE_UPDATE_REG) || []

    switch (true) {
      case (hr && new Set(hr.split('').filter(i => /\S/.test(i))).size === 1):
        return this.updateHr(block, hr)

      case !!bullet:
        return this.updateList(block, 'bullet', bullet)

      // only `bullet` list item can be update to `task` list item
      case !!tasklist && parent && parent.listItemType === 'bullet':
        return this.updateTaskListItem(block, 'tasklist', tasklist)

      case !!order:
        return this.updateList(block, 'order', order)

      case !!header:
        return this.updateHeader(block, header, text)

      case !!blockquote:
        return this.updateBlockQuote(block)

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

  ContentState.prototype.updateList = function (block, type, marker = '') {
    // ensure the block is a paragraph
    if (block.type === 'span') {
      block = this.getParent(block)
    }
    const { preferLooseListItem } = this
    const parent = this.getParent(block)
    const preSibling = this.getPreSibling(block)
    const nextSibling = this.getNextSibling(block)
    const wrapperTag = type === 'order' ? 'ol' : 'ul' // `bullet` => `ul` and `order` => `ol`
    const { start, end } = this.cursor
    const startOffset = start.offset
    const endOffset = end.offset
    const newBlock = this.createBlock('li')
    block.children[0].text = block.children[0].text.substring(marker.length)
    newBlock.listItemType = type
    newBlock.isLooseListItem = preferLooseListItem

    if (type === 'task' || type === 'bullet') {
      const { bulletListMarker } = this
      const bulletListItemMarker = marker ? marker.charAt(0) : bulletListMarker
      newBlock.bulletListItemMarker = bulletListItemMarker
    }

    if (
      preSibling && preSibling.listType === type && this.checkSameLooseType(preSibling, preferLooseListItem) &&
      nextSibling && nextSibling.listType === type && this.checkSameLooseType(nextSibling, preferLooseListItem)
    ) {
      this.appendChild(preSibling, newBlock)
      const partChildren = nextSibling.children.splice(0)
      partChildren.forEach(b => this.appendChild(preSibling, b))
      this.removeBlock(nextSibling)
      this.removeBlock(block)
    } else if (preSibling && preSibling.type === wrapperTag && this.checkSameLooseType(preSibling, preferLooseListItem)) {
      this.appendChild(preSibling, newBlock)

      this.removeBlock(block)
    } else if (nextSibling && nextSibling.listType === type && this.checkSameLooseType(nextSibling, preferLooseListItem)) {
      this.insertBefore(newBlock, nextSibling.children[0])

      this.removeBlock(block)
    } else if (parent && parent.listType === type && this.checkSameLooseType(parent, preferLooseListItem)) {
      this.insertBefore(newBlock, block)

      this.removeBlock(block)
    } else {
      const listBlock = this.createBlock(wrapperTag)
      listBlock.listType = type
      if (wrapperTag === 'ol') {
        const start = marker.split('.')[0]
        listBlock.start = /^\d+$/.test(start) ? start : 1
      }
      this.appendChild(listBlock, newBlock)
      this.insertBefore(listBlock, block)
      this.removeBlock(block)
    }

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

  ContentState.prototype.updateHeader = function (block, header, text) {
    const newType = `h${header.length}`
    if (block.type !== newType) {
      block.headingStyle = DEFAULT_TURNDOWN_CONFIG.headingStyle
      block.type = newType
      block.text = text
      block.children.length = 0
      this.cursor.start.key = this.cursor.end.key = block.key
      return block
    }
    return null
  }

  ContentState.prototype.updateBlockQuote = function (block) {
    block.children[0].text = block.children[0].text.substring(1).trim()
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
