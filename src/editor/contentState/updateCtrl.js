import selection from '../selection'
import { tokenizer } from '../parser/parse'
import { conflict } from '../utils'

const INLINE_UPDATE_REG = /^([*+-]\s(\[\s\]\s)?)|^(\d+\.\s)|^(#{1,6})[^#]+|^(>).+|^(\*{3,}|-{3,}|_{3,})/

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
    const { start, end } = this.cursor
    const startOffset = start.offset
    const endOffset = end.offset
    let newBlock

    if ((preSibling && preSibling.type === wrapperTag) && (nextSibling && nextSibling.type === wrapperTag)) {
      newBlock = this.createBlockLi(newText)
      this.appendChild(preSibling, newBlock)
      const partChildren = nextSibling.children.splice(0)
      partChildren.forEach(b => this.appendChild(preSibling, b))
      this.removeBlock(nextSibling)
      this.removeBlock(block)
    } else if (preSibling && preSibling.type === wrapperTag) {
      newBlock = this.createBlockLi(newText)
      this.appendChild(preSibling, newBlock)

      this.removeBlock(block)
    } else if (nextSibling && nextSibling.type === wrapperTag) {
      newBlock = this.createBlockLi(newText)
      this.insertBefore(newBlock, nextSibling.children[0])

      this.removeBlock(block)
    } else if (parent && parent.type === wrapperTag) {
      newBlock = this.createBlockLi(newText)
      this.insertBefore(newBlock, block)

      this.removeBlock(block)
    } else {
      block.type = wrapperTag
      block.text = ''
      if (wrapperTag === 'ol') {
        const start = marker.split('.')[0]
        block.start = start
      }
      newBlock = this.createBlockLi(newText)
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
    console.log(start, end)
    console.log(selection.getSelectionStart())
    console.log(selection.getSelectionEnd())
    const { start: oldStart, end: oldEnd } = this.cursor
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
    const text = paragraph.textContent
    const block = this.getBlock(key)

    let needRender = false

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

    if (block.type === 'pre') {
      if (block.key !== oldKey) {
        this.cursor = { start, end }
        this.render()
      }
      return
    }

    if (block.text !== text) {
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
