import { HAS_TEXT_BLOCK_REG, DEFAULT_TURNDOWN_CONFIG } from '../config'
import { getUniqueId, deepCopy } from '../utils'
import selection from '../selection'
import StateRender from '../parser/render'
import enterCtrl from './enterCtrl'
import updateCtrl from './updateCtrl'
import backspaceCtrl from './backspaceCtrl'
import deleteCtrl from './deleteCtrl'
import codeBlockCtrl from './codeBlockCtrl'
import tableBlockCtrl from './tableBlockCtrl'
import selectionCtrl from './selectionCtrl'
import History from './history'
import arrowCtrl from './arrowCtrl'
import pasteCtrl from './pasteCtrl'
import copyCutCtrl from './copyCutCtrl'
import paragraphCtrl from './paragraphCtrl'
import tabCtrl from './tabCtrl'
import formatCtrl from './formatCtrl'
import searchCtrl from './searchCtrl'
import containerCtrl from './containerCtrl'
import imagePathCtrl from './imagePathCtrl'
import htmlBlockCtrl from './htmlBlock'
import clickCtrl from './clickCtrl'
import inputCtrl from './inputCtrl'
import tocCtrl from './tocCtrl'
import emojiCtrl from './emojiCtrl'
import importMarkdown from '../utils/importMarkdown'

const prototypes = [
  tabCtrl,
  enterCtrl,
  selectionCtrl,
  updateCtrl,
  backspaceCtrl,
  deleteCtrl,
  codeBlockCtrl,
  arrowCtrl,
  pasteCtrl,
  copyCutCtrl,
  tableBlockCtrl,
  paragraphCtrl,
  formatCtrl,
  searchCtrl,
  containerCtrl,
  imagePathCtrl,
  htmlBlockCtrl,
  clickCtrl,
  inputCtrl,
  tocCtrl,
  emojiCtrl,
  importMarkdown
]

class ContentState {
  constructor (muya, options) {
    const { bulletListMarker } = options

    this.muya = muya
    Object.assign(this, options)

    // Use to cache the keys which you don't want to remove.
    this.exemption = new Set()
    this.blocks = [ this.createBlockP() ]
    this.stateRender = new StateRender(muya)
    this.codeBlocks = new Map()
    this.renderRange = [ null, null ]
    this.currentCursor = null
    // you'll select the outmost block of current cursor when you click the front icon.
    this.selectedBlock = null
    this.prevCursor = null
    this.historyTimer = null
    this.history = new History(this)
    this.turndownConfig = Object.assign(DEFAULT_TURNDOWN_CONFIG, { bulletListMarker })
    this.fontSize = 16
    this.lineHeight = 1.6
    this.init()
  }

  set cursor (cursor) {
    const handler = () => {
      const { blocks, renderRange, currentCursor } = this
      this.history.push({
        blocks,
        renderRange,
        cursor: currentCursor
      })
    }
    this.prevCursor = this.currentCursor
    this.currentCursor = cursor

    if (!cursor.noHistory) {
      if (
        this.prevCursor &&
        (
          this.prevCursor.start.key !== cursor.start.key ||
          this.prevCursor.end.key !== cursor.end.key
        )
      ) {
        handler()
      } else {
        if (this.historyTimer) clearTimeout(this.historyTimer)
        this.historyTimer = setTimeout(handler, 2000)
      }
    } else {
      cursor.noHistory && delete cursor.noHistory
    }
  }

  get cursor () {
    return this.currentCursor
  }

  init () {
    const lastBlock = this.getLastBlock()
    const { key, text } = lastBlock
    const offset = text.length
    this.searchMatches = {
      value: '', // the search value
      matches: [], // matches
      index: -1 // active match
    }
    this.cursor = {
      start: { key, offset },
      end: { key, offset }
    }
  }

  getHistory () {
    const { stack, index } = this.history
    return { stack, index }
  }

  setHistory ({ stack, index }) {
    Object.assign(this.history, { stack, index })
  }

  setCursor () {
    selection.setCursorRange(this.cursor)
  }

  setNextRenderRange () {
    const { start, end } = this.cursor
    const startBlock = this.getBlock(start.key)
    const endBlock = this.getBlock(end.key)
    const startOutMostBlock = this.findOutMostBlock(startBlock)
    const endOutMostBlock = this.findOutMostBlock(endBlock)

    this.renderRange = [ startOutMostBlock.preSibling, endOutMostBlock.nextSibling ]
  }

  render (isRenderCursor = true) {
    const { blocks, cursor, searchMatches: { matches, index }, selectedBlock } = this
    const activeBlocks = this.getActiveBlocks()
    matches.forEach((m, i) => {
      m.active = i === index
    })
    this.setNextRenderRange()
    this.stateRender.collectLabels(blocks)
    this.stateRender.render(blocks, cursor, activeBlocks, matches, selectedBlock)
    if (isRenderCursor) this.setCursor()
  }

  partialRender () {
    const { blocks, cursor, searchMatches: { matches, index }, selectedBlock } = this
    const activeBlocks = this.getActiveBlocks()
    const [ startKey, endKey ] = this.renderRange
    matches.forEach((m, i) => {
      m.active = i === index
    })
    const startIndex = startKey ? blocks.findIndex(block => block.key === startKey) : 0
    const endIndex = endKey ? blocks.findIndex(block => block.key === endKey) + 1 : blocks.length
    const needRenderBlocks = blocks.slice(startIndex, endIndex)

    this.setNextRenderRange()
    this.stateRender.collectLabels(blocks)
    this.stateRender.partialRender(needRenderBlocks, cursor, activeBlocks, matches, startKey, endKey, selectedBlock)
    this.setCursor()
  }

  /**
   * A block in Aganippe present a paragraph(block syntax in GFM) or a line in paragraph.
   * a line block must in a `p block` or `pre block(frontmatter)` and `p block`'s children must be line blocks.
   */
  createBlock (type = 'span', text = '', editable = true) { // span type means it is a line block.
    const key = getUniqueId()
    return {
      key,
      type,
      text,
      editable,
      parent: null,
      preSibling: null,
      nextSibling: null,
      children: []
    }
  }

  createBlockP (text = '') {
    const pBlock = this.createBlock('p')
    const lineBlock = this.createBlock('span', text)
    this.appendChild(pBlock, lineBlock)
    return pBlock
  }

  isCollapse (cursor = this.cursor) {
    const { start, end } = cursor
    return start.key === end.key && start.offset === end.offset
  }

  // getBlocks
  getBlocks () {
    return this.blocks
  }

  getCursor () {
    return this.cursor
  }

  getBlock (key) {
    if (!key) return null
    let result = null
    const travel = blocks => {
      for (const block of blocks) {
        if (block.key === key) {
          result = block
          return
        }
        const { children } = block
        if (children.length) {
          travel(children)
        }
      }
    }
    travel(this.blocks)
    return result
  }

  copyBlock (origin) {
    const copiedBlock = deepCopy(origin)
    const travel = (block, parent, preBlock, nextBlock) => {
      const key = getUniqueId()
      block.key = key
      block.parent = parent ? parent.key : null
      block.preSibling = preBlock ? preBlock.key : null
      block.nextSibling = nextBlock ? nextBlock.key : null
      const { children } = block
      const len = children.length
      if (children && len) {
        let i
        for (i = 0; i < len; i++) {
          const b = children[i]
          const preB = i >= 1 ? children[i - 1] : null
          const nextB = i < len - 1 ? children[i + 1] : null
          travel(b, block, preB, nextB)
        }
      }
    }

    travel(copiedBlock, null, null, null)
    return copiedBlock
  }

  getParent (block) {
    if (block && block.parent) {
      return this.getBlock(block.parent)
    }
    return null
  }
  // return block and its parents
  getParents (block) {
    const result = []
    result.push(block)
    let parent = this.getParent(block)
    while (parent) {
      result.push(parent)
      parent = this.getParent(parent)
    }
    return result
  }

  getPreSibling (block) {
    return block.preSibling ? this.getBlock(block.preSibling) : null
  }

  getNextSibling (block) {
    return block.nextSibling ? this.getBlock(block.nextSibling) : null
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

  removeTextOrBlock (block) {
    if (block.functionType === 'languageInput') return
    const checkerIn = block => {
      if (this.exemption.has(block.key)) {
        return true
      } else {
        const parent = this.getBlock(block.parent)
        return parent ? checkerIn(parent) : false
      }
    }

    const checkerOut = block => {
      const children = block.children
      if (children.length) {
        if (children.some(child => this.exemption.has(child.key))) {
          return true
        } else {
          return children.some(child => checkerOut(child))
        }
      } else {
        return false
      }
    }

    if (checkerIn(block) || checkerOut(block)) {
      block.text = ''
      const { children } = block
      if (children.length) {
        children.forEach(child => this.removeTextOrBlock(child))
      }
    } else if (block.editable) {
      this.removeBlock(block)
    }
  }
  // help func in removeBlocks
  findFigure (block) {
    if (block.type === 'figure') {
      return block.key
    } else {
      const parent = this.getBlock(block.parent)
      return this.findFigure(parent)
    }
  }

  /**
   * remove blocks between before and after, and includes after block.
   */
  removeBlocks (before, after, isRemoveAfter = true, isRecursion = false) {
    if (!isRecursion) {
      if (/td|th/.test(before.type)) {
        this.exemption.add(this.findFigure(before))
      }
      if (/td|th/.test(after.type)) {
        this.exemption.add(this.findFigure(after))
      }
    }
    let nextSibling = this.getBlock(before.nextSibling)
    let beforeEnd = false
    while (nextSibling) {
      if (nextSibling.key === after.key || this.isInclude(nextSibling, after)) {
        beforeEnd = true
        break
      }
      this.removeTextOrBlock(nextSibling)
      nextSibling = this.getBlock(nextSibling.nextSibling)
    }
    if (!beforeEnd) {
      const parent = this.getParent(before)
      if (parent) {
        this.removeBlocks(parent, after, false, true)
      }
    }
    let preSibling = this.getBlock(after.preSibling)
    let afterEnd = false
    while (preSibling) {
      if (preSibling.key === before.key || this.isInclude(preSibling, before)) {
        afterEnd = true
        break
      }
      this.removeTextOrBlock(preSibling)
      preSibling = this.getBlock(preSibling.preSibling)
    }
    if (!afterEnd) {
      const parent = this.getParent(after)
      if (parent) {
        const removeAfter = isRemoveAfter && (this.isOnlyRemoveableChild(after))
        this.removeBlocks(before, parent, removeAfter, true)
      }
    }
    if (isRemoveAfter) {
      this.removeTextOrBlock(after)
    }
    if (!isRecursion) {
      this.exemption.clear()
    }
  }

  removeBlock (block, fromBlocks = this.blocks) {
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
    remove(Array.isArray(fromBlocks) ? fromBlocks : fromBlocks.children, block)
  }

  getActiveBlocks () {
    let result = []
    let block = this.getBlock(this.cursor.start.key)
    if (block) result.push(block)
    while (block && block.parent) {
      block = this.getBlock(block.parent)
      result.push(block)
    }
    return result
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
    newBlock.preSibling = null

    if (oldPreSibling) {
      oldPreSibling.nextSibling = newBlock.key
      newBlock.preSibling = oldPreSibling.key
    }
  }

  findOutMostBlock (block) {
    const parent = this.getBlock(block.parent)
    return parent ? this.findOutMostBlock(parent) : block
  }

  findIndex (children, block) {
    return children.findIndex(child => child === block)
  }

  prependChild (parent, block) {
    block.parent = parent.key
    block.preSibling = null
    if (parent.children.length) {
      block.nextSibling = parent.children[0].key
    }
    parent.children.unshift(block)
  }

  appendChild (parent, block) {
    const len = parent.children.length
    const lastChild = parent.children[len - 1]
    parent.children.push(block)
    block.parent = parent.key
    if (lastChild) {
      lastChild.nextSibling = block.key
      block.preSibling = lastChild.key
    } else {
      block.preSibling = null
    }
    block.nextSibling = null
  }

  replaceBlock (newBlock, oldBlock) {
    const blockList = oldBlock.parent ? this.getParent(oldBlock).children : this.blocks
    const index = this.findIndex(blockList, oldBlock)

    blockList.splice(index, 1, newBlock)
    newBlock.parent = oldBlock.parent
    newBlock.preSibling = oldBlock.preSibling
    newBlock.nextSibling = oldBlock.nextSibling
  }

  canInserFrontMatter (block) {
    if (!block) return true
    const parent = this.getParent(block)
    return block.type === 'span' &&
      !block.preSibling &&
      !parent.preSibling &&
      !parent.parent
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

  isOnlyRemoveableChild (block) {
    if (block.editable === false) return false
    const parent = this.getParent(block)
    return (parent ? parent.children : this.blocks).filter(child => child.editable && child.functionType !== 'languageInput').length === 1
  }

  getLastChild (block) {
    if (block) {
      const len = block.children.length
      if (len) {
        return block.children[len - 1]
      }
    }
    return null
  }

  firstInDescendant (block) {
    const children = block.children
    if (block.children.length === 0 && HAS_TEXT_BLOCK_REG.test(block.type)) {
      return block
    } else if (children.length) {
      if (
        children[0].type === 'input' ||
        (children[0].type === 'div' && children[0].editable === false)
      ) { // handle task item
        return this.firstInDescendant(children[1])
      } else {
        return this.firstInDescendant(children[0])
      }
    }
  }

  lastInDescendant (block) {
    if (block.children.length === 0 && HAS_TEXT_BLOCK_REG.test(block.type)) {
      return block
    } else if (block.children.length) {
      const children = block.children
      let lastChild = children[children.length - 1]
      while (lastChild.editable === false) {
        lastChild = this.getPreSibling(lastChild)
      }
      return this.lastInDescendant(lastChild)
    }
  }

  findPreBlockInLocation (block) {
    const parent = this.getParent(block)
    const preBlock = this.getPreSibling(block)
    if (
      block.preSibling &&
      preBlock.type !== 'input' &&
      preBlock.type !== 'div' &&
      preBlock.editable !== false
    ) { // handle task item and table
      return this.lastInDescendant(preBlock)
    } else if (parent) {
      return this.findPreBlockInLocation(parent)
    } else {
      return null
    }
  }

  findNextBlockInLocation (block) {
    const parent = this.getParent(block)
    const nextBlock = this.getNextSibling(block)

    if (
      nextBlock && nextBlock.editable !== false
    ) {
      return this.firstInDescendant(nextBlock)
    } else if (parent) {
      return this.findNextBlockInLocation(parent)
    } else {
      return null
    }
  }

  getPositionReference () {
    const { fontSize, lineHeight } = this
    const { start } = this.cursor
    const block = this.getBlock(start.key)
    const { x, y } = selection.getCursorCoords()
    const height = fontSize * lineHeight
    const width = 0
    const bottom = y + height
    const right = x + width
    const left = x
    const top = y
    return {
      getBoundingClientRect () {
        return { x, y, top, left, right, bottom, height, width }
      },
      clientWidth: width,
      clientHeight: height,
      id: block ? block.key : null
    }
  }

  getLastBlock () {
    const { blocks } = this
    const len = blocks.length
    return this.lastInDescendant(blocks[len - 1])
  }

  clear () {
    this.history.clearHistory()
  }
}

prototypes.forEach(ctrl => ctrl(ContentState))

export default ContentState
