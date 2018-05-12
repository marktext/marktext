import selection from '../selection'
import { tokenizer } from '../parser/parse'
import { conflict, isMetaKey } from '../utils'
import { getTextContent } from '../utils/domManipulate'
import { CLASS_OR_ID, EVENT_KEYS } from '../config'

const INLINE_UPDATE_FREGMENTS = [
  '^([*+-]\\s)', // Bullet list
  '^(\\[[x\\s]{1}\\]\\s)', // Task list
  '^(\\d+\\.\\s)', // Order list
  '^\\s{0,3}(#{1,6})(?=\\s{1,}|$)', // ATX heading
  '^(>).+', // Block quote
  '^\\s{0,3}((?:\\*\\s*\\*\\s*\\*|-\\s*-\\s*-|_\\s*_\\s*_)[\\s\\*\\-\\_]*)$' // Thematic break
]

const INLINE_UPDATE_REG = new RegExp(INLINE_UPDATE_FREGMENTS.join('|'), 'i')

let lastCursor = null

const updateCtrl = ContentState => {
  // handle task list item checkbox click
  ContentState.prototype.listItemCheckBoxClick = function (checkbox) {
    const { checked, id } = checkbox
    const block = this.getBlock(id)
    block.checked = checked
    this.render()
  }

  ContentState.prototype.checkSameLooseType = function (list, isLooseType) {
    return list.children[0].isLooseListItem === isLooseType
  }

  ContentState.prototype.checkNeedRender = function (block) {
    const { start: cStart, end: cEnd } = this.cursor
    const startOffset = cStart.offset
    const endOffset = cEnd.offset
    const tokens = tokenizer(block.text)
    const textLen = block.text.length

    for (const token of tokens) {
      if (token.type === 'text') continue
      const { start, end } = token.range
      if (
        conflict([Math.max(0, start - 1), Math.min(textLen, end + 1)], [startOffset, startOffset]) ||
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

    const key = block.children[0].key
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
    return newBlock
  }

  ContentState.prototype.updateTaskListItem = function (block, type, marker = '') {
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

  ContentState.prototype.updateState = function (event) {
    const { floatBox } = this
    const { start, end } = selection.getCursorRange()
    const key = start.key
    const block = this.getBlock(key)

    // bugfix: #67 problem 1
    if (block && block.icon) return event.preventDefault()

    if (isMetaKey(event)) {
      return
    }

    if (event.type === 'keyup' && (event.key === EVENT_KEYS.ArrowUp || event.key === EVENT_KEYS.ArrowDown) && floatBox.show) {
      return
    }

    if (event.type === 'click' && start.key !== end.key) {
      setTimeout(() => {
        this.updateState(event)
      })
    }

    const { start: oldStart, end: oldEnd } = this.cursor
    if (event.type === 'input' && oldStart.key !== oldEnd.key) {
      const startBlock = this.getBlock(oldStart.key)
      const endBlock = this.getBlock(oldEnd.key)
      this.removeBlocks(startBlock, endBlock)
      // there still has little bug, when the oldstart block is `pre`, the input value will be ignored.
      // and act as `backspace`
      if (startBlock.type === 'pre') {
        event.preventDefault()
        const startRemainText = startBlock.type === 'pre'
          ? startBlock.text.substring(0, oldStart.offset - 1)
          : startBlock.text.substring(0, oldStart.offset)

        const endRemainText = endBlock.type === 'pre'
          ? endBlock.text.substring(oldEnd.offset - 1)
          : endBlock.text.substring(oldEnd.offset)

        startBlock.text = startRemainText + endRemainText
        const key = oldStart.key
        const offset = oldStart.offset
        this.cursor = {
          start: { key, offset },
          end: { key, offset }
        }
        return this.partialRender()
      }
    }

    if (start.key !== end.key) {
      if (
        start.key !== oldStart.key ||
        end.key !== oldEnd.key ||
        start.offset !== oldStart.offset ||
        end.offset !== oldEnd.offset
      ) {
        this.cursor = { start, end }
      }
      return
    }

    const oldKey = lastCursor ? lastCursor.start.key : null
    const paragraph = document.querySelector(`#${key}`)
    let text = getTextContent(paragraph, [ CLASS_OR_ID['AG_MATH_RENDER'] ])
    let needRender = false
    if (event.type === 'click' && block.type === 'figure' && block.functionType === 'table') {
      // first cell in thead
      const cursorBlock = block.children[1].children[0].children[0].children[0]
      const offset = cursorBlock.text.length
      const key = cursorBlock.key
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }
      return this.partialRender()
    }

    // remove temp block which generated by operation on code block
    if (block && block.key !== oldKey) {
      let oldBlock = this.getBlock(oldKey)
      if (oldBlock) this.codeBlockUpdate(oldBlock)
      if (oldBlock && oldBlock.type === 'span') {
        oldBlock = this.getParent(oldBlock)
      }
      if (oldBlock && oldBlock.temp && oldBlock.type === 'p') {
        if (oldBlock.children.some(child => child.text)) { // if p block has none empty line.
          delete oldBlock.temp
        } else {
          this.removeBlock(oldBlock)
        }
      }
    }

    if (block && block.type === 'pre') {
      if (block.key !== oldKey) {
        this.cursor = lastCursor = { start, end }
        if (event.type === 'click' && oldKey) {
          this.partialRender()
        }
      }
      return
    }
    // auto pair
    if (block && block.text !== text) {
      const BRACKET_HASH = {
        '{': '}',
        '[': ']',
        '(': ')',
        '*': '*',
        '_': '_',
        '"': '"',
        "'": "'"
      }
      if (start.key === end.key && start.offset === end.offset && event.type === 'input') {
        const { offset } = start
        const { autoPairBracket, autoPairMarkdownSyntax, autoPairQuote } = this
        const inputChar = text.charAt(+offset - 1)
        const preInputChar = text.charAt(+offset - 2)
        const postInputChar = text.charAt(+offset)
        /* eslint-disable no-useless-escape */
        if (
          (autoPairQuote && /["']{1}/.test(inputChar)) ||
          (autoPairBracket && /[\{\[\(]{1}/.test(inputChar)) ||
          (autoPairMarkdownSyntax && /[*_]{1}/.test(inputChar))
        ) {
          text = BRACKET_HASH[event.data]
            ? text.substring(0, offset) + BRACKET_HASH[inputChar] + text.substring(offset)
            : text
        }
        /* eslint-ensable no-useless-escape */
        if (/\s/.test(event.data) && preInputChar === '*' && postInputChar === '*') {
          text = text.substring(0, offset) + text.substring(offset + 1)
        }
      }
      block.text = text
    }

    if (oldKey !== key || oldStart.offset !== start.offset || oldEnd.offset !== end.offset) {
      needRender = true
    }

    this.cursor = lastCursor = { start, end }
    const checkMarkedUpdate = this.checkNeedRender(block)
    const inlineUpdatedBlock = this.isCollapse() && this.checkInlineUpdate(block)

    if (checkMarkedUpdate || inlineUpdatedBlock || needRender) {
      this.partialRender()
    }
  }
}

export default updateCtrl
