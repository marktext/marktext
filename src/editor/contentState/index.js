import { getUniqueId, conflict, deepCopy } from '../utils'
import { LOWERCASE_TAGS } from '../config'
import StateRender from '../parser/StateRender'
import { tokenizer } from '../parser/parse'
import selection from '../selection'
import { findNearestParagraph } from '../utils/domManipulate'

const INLINE_UPDATE_REG = /^([*+-]\s(\[\s\]\s)?)|^(\d+\.\s)|^(#{1,6})[^#]+|^(>).+/

const newABlock = (set, parent = null, preSibling = null, nextSibling = null, text = '', depth = 0, type = 'p') => {
  const key = getUniqueId(set)
  return {
    key,
    parent,
    preSibling,
    nextSibling,
    text,
    children: [],
    depth,
    type
  }
}

// deep first search
const convertBlocksToArray = blocks => {
  const result = []
  blocks.forEach(block => {
    result.push(block)
    if (block.children.length) {
      result.push(...convertBlocksToArray(block.children))
    }
  })
  return result
}

class ContentState {
  constructor (blocks) {
    this.keys = new Set()
    this.blocks = blocks || [ newABlock(this.keys) ]
    this.stateRender = new StateRender()
    const lastBlock = this.getLastBlock()
    this.cursor = {
      key: lastBlock.key,
      range: {
        start: lastBlock.text.length,
        end: lastBlock.text.length
      }
    }
  }

  render () {
    const { blocks, cursor } = this
    return this.stateRender.render(blocks, cursor)
  }

  updateState () {
    const node = selection.getSelectionStart()
    const paragraph = findNearestParagraph(node)
    const text = paragraph.textContent
    const selectionState = selection.exportSelection(paragraph)
    const block = this.getBlock(paragraph.id)
    block.text = text
    Object.assign(this.cursor.range, selectionState)

    if (this.checkNeedRender(block, paragraph) || this.checkInlineUpdate(block)) {
      this.render()
    }
  }

  checkNeedRender (block, paragraph) {
    const html = paragraph.innerHTML
    if (/ag-gray/.test(html)) return true
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

  checkInlineUpdate (block) {
    const { text } = block
    const [match, disorder, tasklist, order, header, blockquote] = text.match(INLINE_UPDATE_REG) || []
    let newType
    switch (true) {
      case !!disorder:
        this.updateList(block, 'disorder', disorder)
        return true
        // maybe no needed `break`

      case !!tasklist:
        this.updateList(block, 'tasklist', disorder) // tasklist is one type of disorder.
        return true
        // maybe no needed `break`

      case !!order:
        this.updateList(block, 'order', order)
        return true
        // maybe no needed `break`

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
        newType = LOWERCASE_TAGS.p
        if (block.type !== newType) {
          block.type = newType // updateP
          return true
        }
        break
    }

    return false
  }

  updateList (block, type, marker) {
    const parent = this.getParent(block.key)
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
      this.removeBlock(block.key)
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

  updateBlockQuote (block) {
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

  // getBlocks
  getBlocks () {
    return this.blocks
  }

  getCursor () {
    return this.cursor
  }

  getArrayBlocks () {
    return convertBlocksToArray(this.blocks)
  }

  getBlock (key) {
    return this.getArrayBlocks().filter(block => block.key === key)[0]
  }

  getParent (key) {
    const block = this.getBlock(key)
    if (block.parent) {
      return this.getBlock(block.parent)
    }
    return null
  }

  getPreSibling (key) {
    const block = this.getBlock(key)
    return block.preSibling ? this.getBlock(block.preSibling) : null
  }

  getNextSibling (key) {
    const block = this.getBlock(key)
    return block.nextSibling ? this.getBlock(block.nextSibling) : null
  }

  getFirstBlock () {
    const arrayBlocks = this.getArrayBlocks()
    if (arrayBlocks.length) {
      return arrayBlocks[0]
    } else {
      throw new Error('article need at least has one paragraph')
    }
  }

  removeBlock (key) {
    const remove = (blocks, key) => {
      const len = blocks.length
      let i
      for (i = 0; i < len; i++) {
        if (blocks[i].key === key) {
          return blocks.splice(i, 1)
        } else {
          if (blocks[i].children.length) {
            remove(blocks[i].children, key)
          }
        }
      }
    }
    remove(this.blocks, key)
  }

  getLastBlock () {
    const arrayBlocks = this.getArrayBlocks()
    const len = arrayBlocks.length
    return arrayBlocks[len - 1]
  }
}

export default ContentState
