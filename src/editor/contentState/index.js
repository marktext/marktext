import { getUniqueId } from '../utils'
import StateRender from '../parser/StateRender'

import enterCtrl from './enterCtrl'
import updateCtrl from './updateCtrl'

const ctrls = [
  enterCtrl,
  updateCtrl
]

export const newABlock = (set, parent = null, preSibling = null, nextSibling = null, text = '', depth = 0, type = 'p') => {
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
    const activeBlock = this.getActiveBlockKey()
    return this.stateRender.render(blocks, cursor, activeBlock)
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

  getParent (block) {
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

  removeBlock (block) {
    const remove = (blocks, block) => {
      const len = blocks.length
      let i
      for (i = 0; i < len; i++) {
        if (blocks[i].key === block.key) {
          const preSibling = this.getBlock(block.preSibling)
          const nextSibling = this.getBlock(block.nextSibling)

          if (preSibling) {
            preSibling.nextSibling = nextSibling ? nextSibling.key : null
          }
          if (nextSibling) {
            nextSibling.preSibling = preSibling ? preSibling.key : null
          }

          return blocks.splice(i, 1)
        } else {
          if (blocks[i].children.length) {
            remove(blocks[i].children, block)
          }
        }
      }
    }
    remove(this.blocks, block)
  }

  getActiveBlockKey () {
    let block = this.getBlock(this.cursor.key)
    while (block.parent) {
      block = this.getBlock(block.parent)
    }
    return block.key
  }

  insertAfter (newBlock, oldBlock) {
    const siblings = oldBlock.parent ? this.getBlock(oldBlock.parent).children : this.blocks
    const index = this.findIndex(siblings, oldBlock)
    siblings.splice(index + 1, 0, newBlock)
    oldBlock.nextSibling = newBlock.key
    newBlock.parent = oldBlock.parent
    newBlock.preSibling = oldBlock.key
    newBlock.nextSibling = siblings[index + 2] ? siblings[index + 2].key : null
  }

  insertBefore (newBlock, oldBlock) {
    const siblings = oldBlock.parent ? this.getBlock(oldBlock.parent).children : this.blocks
    const index = this.findIndex(siblings, oldBlock)
    siblings.splice(index, 0, newBlock)
    oldBlock.preSibling = newBlock.key
    newBlock.parent = oldBlock.parent
    newBlock.preSibling = siblings[index - 1] ? siblings[index - 1].key : null
    newBlock.nextSibling = oldBlock.key
  }

  findIndex (children, block) {
    const len = children.length
    let i
    for (i = 0; i < len; i++) {
      if (children[i].key === block.key) return i
    }
    return -1
  }

  appendChild (parent, block) {
    const len = parent.children.length
    const lastChild = parent.children[len - 1]
    parent.children.push(block)
    block.parent = parent.key
    if (lastChild) {
      block.preSibling = lastChild.key
    }
  }

  isFirstChild (block) {
    return !block.preSibling
  }

  isLastChild (block) {
    return !block.nextSibling
  }

  isOnlyChild (block) {
    return !block.nextSibling && !block.preSibling
  }

  getLastBlock () {
    const arrayBlocks = this.getArrayBlocks()
    const len = arrayBlocks.length
    return arrayBlocks[len - 1]
  }
}

ctrls.forEach(ctrl => ctrl(ContentState))

export default ContentState
