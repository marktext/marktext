import selection from '../selection'
import { findNearestParagraph } from '../utils/domManipulate'
import { tokenizer } from '../parser/parse'
import { conflict, deepCopy, getUniqueId } from '../utils'
import { newABlock } from './index'

const INLINE_UPDATE_REG = /^([*+-]\s(\[\s\]\s)?)|^(\d+\.\s)|^(#{1,6})[^#]+|^(>).+/

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
    const [match, disorder, tasklist, order, header, blockquote] = text.match(INLINE_UPDATE_REG) || []
    let newType

    switch (true) {
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
    const preSibling = this.getPreSibling(block.key)
    const wrapperTag = type === 'order' ? 'ol' : 'ul'
    const newText = block.text.substring(marker.length)
    const { start, end } = this.cursor.range
    let newPblock

    block.text = ''
    block.type = 'li'

    const cloneBlock = deepCopy(block)

    if ((parent && parent.type !== wrapperTag) || (preSibling && preSibling.type !== wrapperTag) || !parent) {
      cloneBlock.key = getUniqueId(this.keys)
      cloneBlock.parent = block.key
      cloneBlock.depth = block.depth + 1
      newPblock = newABlock(this.keys, cloneBlock.key, null, null, newText, cloneBlock.depth + 1, 'p')
      block.type = wrapperTag
      block.children = [ cloneBlock ]
      cloneBlock.children = [ newPblock ]
    } else if (preSibling && preSibling.type === wrapperTag) {
      this.removeBlock(block)
      cloneBlock.parent = preSibling.key
      cloneBlock.depth = preSibling.depth + 1

      if (preSibling.children.length) {
        const lastChild = preSibling.children[preSibling.children.length - 1]
        cloneBlock.preSibling = lastChild.key
      }

      preSibling.children.push(cloneBlock)
      newPblock = newABlock(this.keys, cloneBlock.key, null, null, newText, cloneBlock.depth + 1, 'p')
      cloneBlock.children = [ newPblock ]
    } else {
      newPblock = newABlock(this.keys, block.key, null, null, newText, block.depth + 1, 'p')
      block.children = [ newPblock ]
    }

    this.cursor = {
      key: newPblock.key,
      range: {
        start: Math.max(0, start - marker.length),
        end: Math.max(0, end - marker.length)
      }
    }
  }

  ContentState.prototype.updateBlockQuote = function (block) {
    const newText = block.text.substring(1).trim()
    const newPblock = newABlock(this.keys, block.key, null, null, newText, block.depth + 1, 'p')
    block.type = 'blockquote'
    block.text = ''
    block.children = [ newPblock ]
    const { start, end } = this.cursor.range
    this.cursor = {
      key: newPblock.key,
      range: {
        start: Math.max(0, start - 1),
        end: Math.max(0, end - 1)
      }
    }
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
