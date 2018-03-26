import selection from '../selection'
import { tokenizer } from '../parser/parse'
import { conflict } from '../utils'
import { getTextContent } from '../utils/domManipulate'
import { CLASS_OR_ID } from '../config'

const INLINE_UPDATE_REG = /^([*+-]\s)|^(\[[x\s]{1}\]\s)|^(\d+\.\s)|^(#{1,6})[^#]+|^(>).+|^(\*{3,}|-{3,}|_{3,})/i

const updateCtrl = ContentState => {
  ContentState.prototype.checkNeedRender = function (block) {
    const { start: cStart, end: cEnd } = this.cursor
    const startOffset = cStart.offset
    const endOffset = cEnd.offset
    const tokens = tokenizer(block.text)
    const len = tokens.length
    const textLen = block.text.length
    let i

    for (i = 0; i < len; i++) {
      const token = tokens[i]
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
    if (/th|td|figure/.test(block.type)) return false
    const { text } = block
    const parent = this.getParent(block)
    const [match, bullet, tasklist, order, header, blockquote, hr] = text.match(INLINE_UPDATE_REG) || []
    let newType

    switch (true) {
      case !!hr:
        this.updateHr(block, hr)
        return true

      case !!bullet:
        this.updateList(block, 'bullet', bullet)
        return true

      case !!tasklist && parent && parent.listItemType === 'bullet': // only `bullet` list item can be update to `task` list item
        this.updateTaskListItem(block, 'tasklist', tasklist)
        return true

      case !!order:
        this.updateList(block, 'order', order)
        return true

      case !!header:
        newType = `h${header.length}`
        if (block.type !== newType) {
          block.type = newType // updateHeader
          return true
        }
        break

      case !!blockquote:
        this.updateBlockQuote(block)
        return true

      case !match:
      default:
        newType = 'p'
        if (block.type !== newType) {
          block.type = newType // updateP
          return true
        }
        break
    }

    return false
  }

  ContentState.prototype.updateTaskListItem = function (block, type, marker = '') {
    const parent = this.getParent(block)
    const grandpa = this.getParent(parent)
    const checked = /\[x\]\s/i.test(marker) // use `i` flag to ignore upper case or lower case
    const checkbox = this.createBlock('input')
    const { start, end } = this.cursor

    checkbox.checked = checked
    this.insertBefore(checkbox, block)
    block.text = block.text.substring(marker.length)
    parent.listItemType = 'task'

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
  }

  // handle task list item checkbox click
  ContentState.prototype.listItemCheckBoxClick = function (checkbox) {
    const { checked, id } = checkbox
    const block = this.getBlock(id)
    block.checked = checked
    this.render()
  }

  ContentState.prototype.updateList = function (block, type, marker = '') {
    const parent = this.getParent(block)
    const preSibling = this.getPreSibling(block)
    const nextSibling = this.getNextSibling(block)
    const wrapperTag = type === 'order' ? 'ol' : 'ul' // `bullet` => `ul` and `order` => `ol`
    const newText = block.text.substring(marker.length)
    const { start, end } = this.cursor
    const startOffset = start.offset
    const endOffset = end.offset
    const newBlock = this.createBlockLi(newText, block.type)
    newBlock.listItemType = type

    if (preSibling && preSibling.listType === type && nextSibling && nextSibling.listType === type) {
      this.appendChild(preSibling, newBlock)
      const partChildren = nextSibling.children.splice(0)
      partChildren.forEach(b => this.appendChild(preSibling, b))
      this.removeBlock(nextSibling)
      this.removeBlock(block)
    } else if (preSibling && preSibling.type === wrapperTag) {
      this.appendChild(preSibling, newBlock)

      this.removeBlock(block)
    } else if (nextSibling && nextSibling.listType === type) {
      this.insertBefore(newBlock, nextSibling.children[0])

      this.removeBlock(block)
    } else if (parent && parent.listType === type) {
      this.insertBefore(newBlock, block)

      this.removeBlock(block)
    } else {
      block.type = wrapperTag
      block.listType = type // `bullet` or `order`
      block.text = ''
      if (wrapperTag === 'ol') {
        const start = marker.split('.')[0]
        block.start = /^\d+$/.test(start) ? start : 1
      }
      this.appendChild(block, newBlock)
    }

    const key = newBlock.type === 'li' ? newBlock.children[0].key : newBlock.key
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
    return newBlock.children[0]
  }

  ContentState.prototype.updateBlockQuote = function (block) {
    const newText = block.text.substring(1).trim()
    const newPblock = this.createBlock('p', newText)
    block.type = 'blockquote'
    block.text = ''
    this.appendChild(block, newPblock)

    const { start, end } = this.cursor
    const key = newPblock.key
    this.cursor = {
      start: {
        key,
        offset: start.offset - 1
      },
      end: {
        key,
        offset: end.offset - 1
      }
    }
  }

  ContentState.prototype.updateHr = function (block, marker) {
    block.type = 'hr'
  }

  ContentState.prototype.updateState = function (event) {
    const { start, end } = selection.getCursorRange()
    const { start: oldStart, end: oldEnd } = this.cursor
    if (event.type === 'click' && start.key !== end.key) {
      setTimeout(() => {
        this.updateState(event)
      })
    }
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
        return this.render()
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
        // this.render()
      }
      return
    }
    const key = start.key
    const oldKey = oldStart.key
    const paragraph = document.querySelector(`#${key}`)
    const text = getTextContent(paragraph, [ CLASS_OR_ID['AG_MATH_RENDER'] ])
    const block = this.getBlock(key)

    let needRender = false
    if (event.type === 'click' && block.type === 'figure') {
      // first cell in thead
      const cursorBlock = block.children[1].children[0].children[0].children[0]
      const offset = cursorBlock.text.length
      const key = cursorBlock.key
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }
      return this.render()
    }
    // remove temp block which generated by operation on code block
    if (block && block.key !== oldKey) {
      const oldBlock = this.getBlock(oldKey)
      if (oldBlock) this.codeBlockUpdate(oldBlock)
      if (oldBlock && oldBlock.temp) {
        if (oldBlock.text || oldBlock.children.length) {
          delete oldBlock.temp
        } else {
          this.removeBlock(oldBlock)
          needRender = true
        }
      }
    }

    if (block && block.type === 'pre') {
      if (block.key !== oldKey) {
        this.cursor = { start, end }
        this.render()
      }
      return
    }

    if (block && block.text !== text) {
      block.text = text
    }

    if (oldKey !== key || oldStart.offset !== start.offset || oldEnd.offset !== end.offset) {
      needRender = true
    }

    this.cursor = { start, end }

    const checkMarkedUpdate = this.checkNeedRender(block)
    const checkInlineUpdate = this.checkInlineUpdate(block)

    if (checkMarkedUpdate || checkInlineUpdate || needRender) {
      this.render()
    }
  }
}

export default updateCtrl
