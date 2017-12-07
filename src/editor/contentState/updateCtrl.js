import selection from '../selection'
import { findNearestParagraph } from '../utils/domManipulate'
import { tokenizer } from '../parser/parse'
import { conflict } from '../utils'

const INLINE_UPDATE_REG = /^([*+-]\s(\[\s\]\s)?)|^(\d+\.\s)|^(#{1,6})[^#]+|^(>).+|^(\*{3,}|-{3,}|_{3,})/

const updateCtrl = ContentState => {
  ContentState.prototype.checkNeedRender = function (block) {
    const { start: cStart, end: cEnd } = this.cursor.range
    const tokens = tokenizer(block.text)
    let i
    const len = tokens.length
    const textLen = block.text.length
    for (i = 0; i < len; i++) {
      const token = tokens[i]
      if (token.type === 'text') continue
      const { start, end } = token.range
      if (conflict([Math.max(0, start - 1), Math.min(textLen, end + 1)], [cStart, cEnd])) return true
    }
    return false
  }

  ContentState.prototype.checkInlineUpdate = function (block) {
    const { text } = block
    const [match, disorder, tasklist, order, header, blockquote, hr] = text.match(INLINE_UPDATE_REG) || []
    let newType

    switch (true) {
      case !!hr:
        this.updateHr(block, hr)
        return true

      case !!disorder:
        this.updateList(block, 'disorder', disorder)
        return true

      case !!tasklist:
        this.updateList(block, 'tasklist', disorder) // tasklist is one type of disorder.
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

  ContentState.prototype.updateList = function (block, type, marker) {
    const parent = this.getParent(block)
    const preSibling = this.getPreSibling(block)
    const nextSibling = this.getNextSibling(block)
    const wrapperTag = type === 'order' ? 'ol' : 'ul'
    const newText = block.text.substring(marker.length)
    const { start, end } = this.cursor.range
    let newBlock

    if ((preSibling && preSibling.type === wrapperTag) && (nextSibling && nextSibling.type === wrapperTag)) {
      newBlock = this.createBlockLi(newText, preSibling.depth + 1)
      this.appendChild(preSibling, newBlock)
      const partChildren = nextSibling.children.splice(0)
      partChildren.forEach(b => this.appendChild(preSibling, b))
      this.removeBlock(nextSibling)
      this.removeBlock(block)
    } else if (preSibling && preSibling.type === wrapperTag) {
      newBlock = this.createBlockLi(newText, preSibling.depth + 1)
      this.appendChild(preSibling, newBlock)

      this.removeBlock(block)
    } else if (nextSibling && nextSibling.type === wrapperTag) {
      newBlock = this.createBlockLi(newText, nextSibling.depth + 1)
      this.insertBefore(newBlock, nextSibling.children[0])

      this.removeBlock(block)
    } else if (parent && parent.type === wrapperTag) {
      newBlock = this.createBlockLi(newText, parent.depth + 1)
      this.insertBefore(newBlock, block)

      this.removeBlock(block)
    } else {
      block.type = wrapperTag
      block.text = ''
      newBlock = this.createBlockLi(newText, block.depth + 1)
      this.appendChild(block, newBlock)
    }

    this.cursor = {
      key: newBlock.type === 'li' ? newBlock.children[0].key : newBlock.key,
      range: {
        start: Math.max(0, start - marker.length),
        end: Math.max(0, end - marker.length)
      }
    }
  }

  ContentState.prototype.updateBlockQuote = function (block) {
    const newText = block.text.substring(1).trim()
    const newPblock = this.createBlock('p', newText)
    block.type = 'blockquote'
    block.text = ''
    this.appendChild(block, newPblock)
    const { start, end } = this.cursor.range
    this.cursor = {
      key: newPblock.key,
      range: {
        start: Math.max(0, start - 1),
        end: Math.max(0, end - 1)
      }
    }
  }

  ContentState.prototype.updateHr = function (block, marker) {
    block.type = 'hr'
  }

  ContentState.prototype.updateState = function () {
    const node = selection.getSelectionStart()
    const paragraph = findNearestParagraph(node)
    const text = paragraph.textContent
    const selectionState = selection.exportSelection(paragraph)
    const block = this.getBlock(paragraph.id)
    const { key, range } = this.cursor
    const { start: oldStart, end: oldEnd } = range
    const { start, end } = selectionState
    let needRender = false

    block.text = text

    if (key !== block.key || start !== oldStart || end !== oldEnd) {
      Object.assign(this.cursor.range, selectionState)
      this.cursor.key = block.key
      needRender = true
    }

    const checkMarkedUpdate = this.checkNeedRender(block)
    const checkInlineUpdate = this.checkInlineUpdate(block)

    if (checkMarkedUpdate || checkInlineUpdate || needRender) {
      this.render()
    }
  }
}

export default updateCtrl
