import { CLASS_OR_ID } from '../../config'
import { conflict, mixins } from '../../utils'
import { patch, toVNode, toHTML, h } from './snabbdom'
import { beginRules } from '../rules'

import renderInlines from './renderInlines'
import renderBlock from './renderBlock'

class StateRender {
  constructor (eventCenter) {
    this.eventCenter = eventCenter
    this.refreshCodeBlock = false
    this.loadImageMap = new Map()
    this.loadMathMap = new Map()
    this.tokenCache = new Map()
    this.labels = new Map()
    this.container = null
  }

  setContainer (container) {
    this.container = container
  }

  collectLabels (blocks) {
    this.labels.clear()

    const travel = block => {
      const { text, children } = block
      if (children && children.length) {
        children.forEach(c => travel(c))
      } else if (text) {
        const tokens = beginRules['reference_definition'].exec(text)
        if (tokens) {
          const key = (tokens[2] + tokens[3]).toLowerCase()
          if (!this.labels.has(key)) {
            this.labels.set(key, {
              href: tokens[6],
              title: tokens[10] || ''
            })
          }
        }
      }
    }

    blocks.forEach(b => travel(b))
  }

  checkConflicted (block, token, cursor) {
    const { start, end } = cursor
    const key = block.key
    const { start: tokenStart, end: tokenEnd } = token.range

    if (key !== start.key && key !== end.key) {
      return false
    } else if (key === start.key && key !== end.key) {
      return conflict([tokenStart, tokenEnd], [start.offset, start.offset])
    } else if (key !== start.key && key === end.key) {
      return conflict([tokenStart, tokenEnd], [end.offset, end.offset])
    } else {
      return conflict([tokenStart, tokenEnd], [start.offset, start.offset]) ||
        conflict([tokenStart, tokenEnd], [end.offset, end.offset])
    }
  }

  getClassName (outerClass, block, token, cursor) {
    return outerClass || (this.checkConflicted(block, token, cursor) ? CLASS_OR_ID['AG_GRAY'] : CLASS_OR_ID['AG_HIDE'])
  }

  getHighlightClassName (active) {
    return active ? CLASS_OR_ID['AG_HIGHLIGHT'] : CLASS_OR_ID['AG_SELECTION']
  }

  getSelector (block, cursor, activeBlocks) {
    const type = block.type === 'hr' ? 'p' : block.type
    const isActive = activeBlocks.some(b => b.key === block.key) || block.key === cursor.start.key

    let selector = `${type}#${block.key}.${CLASS_OR_ID['AG_PARAGRAPH']}`
    if (isActive) {
      selector += `.${CLASS_OR_ID['AG_ACTIVE']}`
    }
    if (type === 'span') {
      selector += `.${CLASS_OR_ID['AG_LINE']}`
    }
    if (block.temp) {
      selector += `.${CLASS_OR_ID['AG_TEMP']}`
    }
    return selector
  }

  render (blocks, cursor, activeBlocks, matches, refreshCodeBlock) {
    this.refreshCodeBlock = refreshCodeBlock
    const selector = `div#${CLASS_OR_ID['AG_EDITOR_ID']}`

    const children = blocks.map(block => {
      return this.renderBlock(block, cursor, activeBlocks, matches, true)
    })

    const newVdom = h(selector, children)
    const rootDom = document.querySelector(selector) || this.container
    const oldVdom = toVNode(rootDom)

    patch(oldVdom, newVdom)
  }

  // Only render the blocks which you updated
  partialRender (blocks, cursor, activeBlocks, matches, startKey, endKey) {
    const cursorOutMostBlock = activeBlocks[activeBlocks.length - 1]
    // If cursor is not in render blocks, need to render cursor block independently
    const needRenderCursorBlock = blocks.indexOf(cursorOutMostBlock) === -1
    const newVnode = h('section', blocks.map(block => this.renderBlock(block, cursor, activeBlocks, matches)))
    const html = toHTML(newVnode).replace(/^<section>([\s\S]+?)<\/section>$/, '$1')

    const needToRemoved = []
    const firstOldDom = startKey
      ? document.querySelector(`#${startKey}`)
      : document.querySelector(`div#${CLASS_OR_ID['AG_EDITOR_ID']}`).firstElementChild

    needToRemoved.push(firstOldDom)
    let nextSibling = firstOldDom.nextElementSibling
    while (nextSibling && nextSibling.id !== endKey) {
      needToRemoved.push(nextSibling)
      nextSibling = nextSibling.nextElementSibling
    }
    nextSibling && needToRemoved.push(nextSibling)

    firstOldDom.insertAdjacentHTML('beforebegin', html)

    Array.from(needToRemoved).forEach(dom => dom.remove())

    // Render cursor block independently
    if (needRenderCursorBlock) {
      const { key } = cursorOutMostBlock
      const cursorDom = document.querySelector(`#${key}`)
      if (cursorDom) {
        const oldCursorVnode = toVNode(cursorDom)
        const newCursorVnode = this.renderBlock(cursorOutMostBlock, cursor, activeBlocks, matches)
        patch(oldCursorVnode, newCursorVnode)
      }
    }
  }
}

mixins(StateRender, renderInlines, renderBlock)

export default StateRender
