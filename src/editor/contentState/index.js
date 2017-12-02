import { getUniqueId, conflict } from '../utils'
import { LOWERCASE_TAGS } from '../config'
import StateRender from '../parser/StateRender'
import { rules } from '../parser/rules'
import { tokenizer } from '../parser/parse'
import selection from '../selection'
import { findNearestParagraph } from '../utils/domManipulate'

const initBlocks = set => {
  const key = getUniqueId(set)
  return [{
    key,
    parent: null,
    preSibling: null,
    nextSibling: null,
    text: 'a',
    children: [],
    depth: 0,
    type: LOWERCASE_TAGS.p
  }]
}

// deep first search
const convertBlocksToArray = blocks => {
  const result = []
  blocks.forEach(block => {
    result.push(block)
    if (block.children) convertBlocksToArray(block.children)
  })
  return result
}

class ContentState {
  constructor (blocks) {
    this.keys = new Set()
    this.blocks = blocks || initBlocks(this.keys)
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
    // TODO handle code change and history
    const text = paragraph.textContent
    const selectionState = selection.exportSelection(paragraph)
    const block = this.getBlock(paragraph.id)
    block.text = text
    Object.assign(this.cursor.range, selectionState)
    if (this.checkNeedRender(block)) {
      this.render()
    }
  }

  checkNeedRender (block) {
    const { start: cStart, end: cEnd } = this.cursor.range
    const tokens = tokenizer(block.text, rules)
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

  getLastBlock () {
    const arrayBlocks = this.getArrayBlocks()
    const len = arrayBlocks.length
    return arrayBlocks[len - 1]
  }
}

export default ContentState
/**
 * cursor: {
 *   range: {
 *     start: 3,
 *     end: 5
 *   },
 *   key: '3u2ab'
 * }
 * blocks: [{
 *   key: '3u2ab', // data-3u2ab,
 *   parent: null,
 *   preSibling: null,
 *   nextSibling: '459aui',
 *   text: '',
 *   children: [{
 *     key: '45iou',
 *     parent: '3u2ab',
 *     preSibling: null,
 *     nextSibling: null,
 *     text: '',
 *     type: 'li',
 *     children: [],
 *     depth: 1
 *   }],
 *   type: 'ul',
 *   depth: 0
 * }]
 */
