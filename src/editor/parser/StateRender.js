import { LOWERCASE_TAGS, CLASS_OR_ID } from '../config'
import { conflict } from '../utils'
import selection from '../selection'
import { tokenizer } from './parse'
import { rules } from './rules'

const snabbdom = require('snabbdom')
const patch = snabbdom.init([ // Init patch function with chosen modules
  require('snabbdom/modules/class').default, // makes it easy to toggle classes
  require('snabbdom/modules/props').default // for setting properties on DOM elements
])
const h = require('snabbdom/h').default // helper function for creating vnodes
const toVNode = require('snabbdom/tovnode').default

class StateRender {
  constructor () {
    this.container = null
    this.vdom = null
  }

  setContainer (container) {
    this.container = container
  }

  checkConflicted (block, token, cursor) {
    const key = block.key
    const cursorKey = cursor.key
    if (key !== cursorKey) {
      return false
    } else {
      const { start, end } = token.range
      const { start: cStart, end: cEnd } = cursor.range
      return conflict([start, end], [cStart, cEnd])
    }
  }

  getClassName (outerClass, block, token, cursor) {
    return outerClass || (this.checkConflicted(block, token, cursor) ? CLASS_OR_ID['AG_GRAY'] : CLASS_OR_ID['AG_HIDE'])
  }
  /**
   * [render]: 2 steps:
   * render vdom
   * return set cursor method
   */
  render (blocks, cursor) {
    const selector = `${LOWERCASE_TAGS.div}#${CLASS_OR_ID['AG_EDITOR_ID']}.${CLASS_OR_ID['mousetrap']}`
    const children = blocks.map(block => {
      switch (block.type) {
        case LOWERCASE_TAGS.p:
          const childs = block.text
            ? tokenizer(block.text, rules).reduce((acc, token) => {
              const chunk = this[token.type](h, cursor, block, token)
              return Array.isArray(chunk) ? [...acc, ...chunk] : [...acc, chunk]
            }, [])
            : [ h(LOWERCASE_TAGS.br) ]
          console.log(JSON.stringify(childs, null, 2))
          return h(`${LOWERCASE_TAGS.p}#${block.key}.${CLASS_OR_ID['AG_PARAGRAPH']}`, childs)
        case LOWERCASE_TAGS.h1:
          break
      }
    })
    const newVdom = h(selector, children)
    const root = document.querySelector(selector) || this.container
    const oldVdom = toVNode(root)

    patch(oldVdom, newVdom)

    this.vdom = newVdom
    if (cursor && cursor.range) {
      const cursorEle = document.querySelector(`#${cursor.key}`)
      selection.importSelection(cursor.range, cursorEle)
    }
  }

  hr (h, cursor, block, token) {
    // const className = this.checkConflicted(block, token) ? CLASS_OR_ID['AG_GRAY'] : CLASS_OR_ID['AG_HIDE']
    return h(LOWERCASE_TAGS.span, {
    })
  }

  ['inline_code'] (h, cursor, block, token, outerClass) {
    const className = this.getClassName(outerClass, block, token, cursor)
    return [
      h(`a.${className}`, {
        props: { href: '#' }
      }, token.marker),
      h('code', token.content),
      h(`a.${className}`, {
        props: { href: '#' }
      }, token.marker)
    ]
  }

  text (h, cursor, block, token) {
    return token.content
  }

  em (h, cursor, block, token, outerClass) {
    const className = this.getClassName(outerClass, block, token, cursor)
    return [
      h(`a.${className}`, {
        props: { href: '#' }
      }, token.marker),
      h('em', token.children.reduce((acc, to) => {
        const chunk = this[to.type](h, cursor, block, to, className)
        return Array.isArray(chunk) ? [...acc, ...chunk] : [...acc, chunk]
      }, [])),
      h(`a.${className}`, {
        props: { href: '#' }
      }, token.marker)
    ]
  }

  strong (h, cursor, block, token, outerClass) {
    const className = this.getClassName(outerClass, block, token, cursor)
    return [
      h(`a.${className}`, {
        props: { href: '#' }
      }, token.marker),
      h('strong', token.children.reduce((acc, to) => {
        const chunk = this[to.type](h, cursor, block, to, className)
        return Array.isArray(chunk) ? [...acc, ...chunk] : [...acc, chunk]
      }, [])),
      h(`a.${className}`, {
        props: { href: '#' }
      }, token.marker)
    ]
  }
}

export default StateRender
