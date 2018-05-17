import { CLASS_OR_ID } from '../../config'
import { conflict, mixins, snackToCamel } from '../../utils'
import { tokenizer } from '../parse'
import { htmlToVNode, patch, toVNode, toHTML, h } from './snabbdom'

import renderInlines from './inlines'

const PRE_BLOCK_HASH = {
  'code': `.${CLASS_OR_ID['AG_CODE_BLOCK']}`,
  'html': `.${CLASS_OR_ID['AG_HTML_BLOCK']}`,
  'frontmatter': `.${CLASS_OR_ID['AG_FRONT_MATTER']}`
}

class StateRender {
  constructor (eventCenter) {
    this.eventCenter = eventCenter
    this.loadImageMap = new Map()
    this.tokenCache = new Map()
    this.container = null
  }

  setContainer (container) {
    this.container = container
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

  renderLeafBlock (block, cursor, activeBlocks, matches, useCache = false) {
    let selector = this.getSelector(block, cursor, activeBlocks)
    // highlight search key in block
    const highlights = matches.filter(m => m.key === block.key)
    const { text, type, headingStyle, align, htmlContent, icon, checked, key, lang, functionType, codeBlockStyle } = block
    const data = {
      attrs: {},
      dataset: {}
    }
    let children = ''

    if (text) {
      let tokens = null
      if (highlights.length === 0 && this.tokenCache.has(text)) {
        tokens = this.tokenCache.get(text)
      } else {
        tokens = tokenizer(text, highlights)
        if (highlights.length === 0 && useCache) this.tokenCache.set(text, tokens)
      }
      children = tokens.reduce((acc, token) => [...acc, ...this[snackToCamel(token.type)](h, cursor, block, token)], [])
    }

    if (/th|td/.test(type) && align) {
      Object.assign(data.attrs, {
        style: `text-align:${align}`
      })
    } else if (type === 'div' && htmlContent !== undefined) {
      selector += `.${CLASS_OR_ID['AG_HTML_PREVIEW']}`
      Object.assign(data.attrs, {
        contenteditable: 'false'
      })
      children = htmlToVNode(htmlContent)
    } else if (type === 'svg' && icon) {
      selector += '.icon'
      Object.assign(data.attrs, {
        'aria-hidden': 'true'
      })
      children = [
        h('use', {
          attrs: {
            'xlink:href': `#${icon}`
          }
        })
      ]
    } else if (/^h/.test(type)) {
      if (/^h\d$/.test(type)) {
        Object.assign(data.dataset, {
          head: type
        })
        selector += `.${headingStyle}`
      }
      Object.assign(data.dataset, {
        role: type
      })
    } else if (type === 'input') {
      Object.assign(data.attrs, {
        type: 'checkbox'
      })
      selector = `${type}#${key}.${CLASS_OR_ID['AG_TASK_LIST_ITEM_CHECKBOX']}`
      if (checked) {
        Object.assign(data.attrs, {
          checked: true
        })
        selector += `.${CLASS_OR_ID['AG_CHECKBOX_CHECKED']}`
      }
      children = ''
    } else if (type === 'pre') {
      selector += `.${CLASS_OR_ID['AG_CODEMIRROR_BLOCK']}`
      selector += PRE_BLOCK_HASH[functionType]
      data.hook = {
        prepatch (oldvnode, vnode) {
          // cheat snabbdom that the pre block is not changed!!!
          vnode.children = oldvnode.children
        }
      }
      if (lang) {
        Object.assign(data.dataset, {
          lang
        })
      }

      if (codeBlockStyle) {
        Object.assign(data.dataset, {
          codeBlockStyle
        })
      }

      if (functionType !== 'frontmatter') {
        // do not set it to '' (empty string)
        children = []
      }
    } else if (type === 'span' && functionType === 'frontmatter') {
      selector += `.${CLASS_OR_ID['AG_FRONT_MATTER_LINE']}`
      children = text
    }

    return h(selector, data, children)
  }

  renderContainerBlock (block, cursor, activeBlocks, matches, useCache = false) {
    let selector = this.getSelector(block, cursor, activeBlocks)
    const data = {
      attrs: {},
      dataset: {}
    }
    // handle `div` block
    if (/div/.test(block.type)) {
      if (block.toolBarType) {
        selector += `.${'ag-tool-' + block.toolBarType}.${CLASS_OR_ID['AG_TOOL_BAR']}`
      }
      if (block.functionType) {
        selector += `.${'ag-function-' + block.functionType}`
      }
      if (block.editable !== undefined && !block.editable) {
        Object.assign(data.attrs, { contenteditable: 'false' })
      }
    }
    // handle `figure` block
    if (block.type === 'figure') {
      if (block.functionType === 'html') { // HTML Block
        Object.assign(data.dataset, { role: block.functionType.toUpperCase() })
      }
    }
    // hanle list block
    if (/ul|ol/.test(block.type) && block.listType) {
      switch (block.listType) {
        case 'order':
          selector += `.${CLASS_OR_ID['AG_ORDER_LIST']}`
          break
        case 'bullet':
          selector += `.${CLASS_OR_ID['AG_BULLET_LIST']}`
          break
        case 'task':
          selector += `.${CLASS_OR_ID['AG_TASK_LIST']}`
          break
        default:
          break
      }
    }
    if (block.type === 'li' && block.label) {
      const { label } = block
      const { align } = activeBlocks[0]

      if (align && block.label === align) {
        selector += '.active'
      }
      Object.assign(data.dataset, { label })
    }
    if (block.type === 'li' && block.listItemType) {
      switch (block.listItemType) {
        case 'order':
          selector += `.${CLASS_OR_ID['AG_ORDER_LIST_ITEM']}`
          break
        case 'bullet':
          selector += `.${CLASS_OR_ID['AG_BULLET_LIST_ITEM']}`
          break
        case 'task':
          selector += `.${CLASS_OR_ID['AG_TASK_LIST_ITEM']}`
          break
        default:
          break
      }
      selector += block.isLooseListItem ? `.${CLASS_OR_ID['AG_LOOSE_LIST_ITEM']}` : `.${CLASS_OR_ID['AG_TIGHT_LIST_ITEM']}`
    }
    if (block.type === 'ol') {
      Object.assign(data.attrs, { start: block.start })
    }
    if (block.type === 'pre' && block.functionType === 'frontmatter') {
      Object.assign(data.dataset, { role: 'YAML' })
      selector += `.${CLASS_OR_ID['AG_FRONT_MATTER']}`
    }

    return h(selector, data, block.children.map(child => this.renderBlock(child, cursor, activeBlocks, matches, useCache)))
  }

  /**
   * [renderBlock render one block, no matter it is a container block or text block]
   */
  renderBlock (block, cursor, activeBlocks, matches, useCache = false) {
    const method = block.children.length > 0 ? 'renderContainerBlock' : 'renderLeafBlock'

    return this[method](block, cursor, activeBlocks, matches, useCache)
  }

  render (blocks, cursor, activeBlocks, matches) {
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

mixins(StateRender, renderInlines)

export default StateRender
