import { getUniqueId } from '../utils'
import selection from '../selection'
import StateRender from '../parser/StateRender'
import enterCtrl from './enterCtrl'
import updateCtrl from './updateCtrl'
import garbageCtrl from './garbageCtrl'
import backspaceCtrl from './backspaceCtrl'
import codeBlockCtrl from './codeBlockCtrl'
import History from './history'
import historyCtrl from './historyCtrl'
import arrowCtrl from './arrowCtrl'
import importMarkdown from '../utils/importMarkdown'

const prototypes = [
  enterCtrl,
  updateCtrl,
  garbageCtrl,
  backspaceCtrl,
  codeBlockCtrl,
  historyCtrl,
  arrowCtrl,
  importMarkdown
]

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
  constructor () {
    this.keys = new Set()
    this.blocks = [ this.createBlock() ]
    this.stateRender = new StateRender()
    this.codeBlocks = new Map()
    this.history = new History(this)
    this.init()
  }

  init () {
    const lastBlock = this.getLastBlock()
    this.cursor = {
      start: {
        key: lastBlock.key,
        offset: lastBlock.text.length
      },
      end: {
        key: lastBlock.key,
        offset: lastBlock.text.length
      }
    }
    this.history.push({
      type: 'normal',
      blocks: this.blocks,
      cursor: this.cursor
    })
  }

  setCursor () {
    const { cursor } = this
    selection.setCursorRange(cursor)
  }

  render () {
    const { blocks, cursor, codeBlocks } = this
    const activeBlockKey = this.getActiveBlockKey()

    this.stateRender.render(blocks, cursor, activeBlockKey, codeBlocks)
    this.setCursor()
    this.pre2CodeMirror()
    console.log('render')
  }

  createBlock (type = 'p', text = '') {
    const key = getUniqueId(this.keys)
    return {
      key,
      type,
      text,
      parent: null,
      preSibling: null,
      nextSibling: null,
      children: []
    }
  }

  // getBlocks
  getBlocks () {
    let key
    let cm
    for ([ key, cm ] of this.codeBlocks.entries()) {
      const value = cm.getValue()
      const block = this.getBlock(key)
      if (block) block.text = value
    }
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

  getPreSibling (block) {
    return block.preSibling ? this.getBlock(block.preSibling) : null
  }

  getNextSibling (block) {
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
  /**
   * if target is descendant of parent return true, else return false
   * @param  {[type]}  parent [description]
   * @param  {[type]}  target [description]
   * @return {Boolean}        [description]
   */
  isInclude (parent, target) {
    const children = parent.children
    if (children.length === 0) {
      return false
    } else {
      if (children.some(child => child.key === target.key)) {
        return true
      } else {
        return children.some(child => this.isInclude(child, target))
      }
    }
  }
  /**
   * remove blocks between before and after, and includes after block.
   */
  removeBlocks (before, after, isRemoveAfter = true) {
    let nextSibling = this.getBlock(before.nextSibling)
    let beforeEnd = false
    while (nextSibling) {
      if (nextSibling.key === after.key || this.isInclude(nextSibling, after)) {
        beforeEnd = true
        break
      }
      this.removeBlock(nextSibling)
      nextSibling = this.getBlock(nextSibling.nextSibling)
    }
    if (!beforeEnd) {
      const parent = this.getParent(before)
      if (parent) {
        this.removeBlocks(parent, after, false)
      }
    }
    let preSibling = this.getBlock(after.preSibling)
    let afterEnd = false
    while (preSibling) {
      if (preSibling.key === before.key || this.isInclude(preSibling, before)) {
        afterEnd = true
        break
      }
      this.removeBlock(preSibling)
      preSibling = this.getBlock(preSibling.preSibling)
    }
    if (!afterEnd) {
      const parent = this.getParent(after)
      if (parent) {
        const isOnlyChild = this.isOnlyChild(after)
        this.removeBlocks(before, parent, isOnlyChild)
      }
    }
    if (isRemoveAfter) {
      this.removeBlock(after)
    }
  }

  removeBlock (block) {
    if (block.type === 'pre') {
      const codeBlockId = block.key
      if (this.codeBlocks.has(codeBlockId)) {
        this.codeBlocks.delete(codeBlockId)
      }
    }
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
    if (!block) return null
    while (block.parent) {
      block = this.getBlock(block.parent)
    }
    return block.key
  }

  getCursorBlock () {
    return this.getBlock(this.cursor.key) || null
  }

  insertAfter (newBlock, oldBlock) {
    const siblings = oldBlock.parent ? this.getBlock(oldBlock.parent).children : this.blocks
    const oldNextSibling = this.getBlock(oldBlock.nextSibling)
    const index = this.findIndex(siblings, oldBlock)
    siblings.splice(index + 1, 0, newBlock)
    oldBlock.nextSibling = newBlock.key
    newBlock.parent = oldBlock.parent
    newBlock.preSibling = oldBlock.key
    if (oldNextSibling) {
      newBlock.nextSibling = oldNextSibling.key
      oldNextSibling.preSibling = newBlock.key
    }
  }

  insertBefore (newBlock, oldBlock) {
    const siblings = oldBlock.parent ? this.getBlock(oldBlock.parent).children : this.blocks
    const oldPreSibling = this.getBlock(oldBlock.preSibling)
    const index = this.findIndex(siblings, oldBlock)
    siblings.splice(index, 0, newBlock)
    oldBlock.preSibling = newBlock.key
    newBlock.parent = oldBlock.parent
    newBlock.nextSibling = oldBlock.key

    if (oldPreSibling) {
      oldPreSibling.nextSibling = newBlock.key
      newBlock.preSibling = oldPreSibling.key
    }
  }

  findOutMostBlock (block) {
    if (!block.parent) return block
    else {
      const parent = this.getBlock(block.parent)
      return this.findOutMostBlock(parent)
    }
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
      lastChild.nextSibling = block.key
      block.preSibling = lastChild.key
    }
  }

  replaceBlock (newBlock, oldBlock) {
    let index
    if (!oldBlock.parent) {
      index = this.findIndex(this.blocks, oldBlock)
      this.blocks.splice(index, 1, newBlock)
    } else {
      const parent = this.getBlock(oldBlock.parent)
      index = this.findIndex(parent.children, oldBlock)
      parent.children.splice(index, 1, newBlock)
    }
    newBlock.parent = oldBlock.parent
    newBlock.preSibling = oldBlock.preSibling
    newBlock.nextSibling = oldBlock.nextSibling
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

  clear () {
    this.keys.clear()
    this.codeBlocks.clear()
  }
}

prototypes.forEach(ctrl => ctrl(ContentState))

export default ContentState
