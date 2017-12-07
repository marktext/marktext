import { LOWERCASE_TAGS, CLASS_OR_ID } from '../config'
import { conflict, isLengthEven, isEven, getIdWithoutSet, loadImage } from '../utils'
import { insertAfter, operateClassName } from '../utils/domManipulate.js'
import selection from '../selection'
import { tokenizer } from './parse'
import { validEmoji } from '../emojis'

const snabbdom = require('snabbdom')
const patch = snabbdom.init([ // Init patch function with chosen modules
  require('snabbdom/modules/class').default, // makes it easy to toggle classes
  require('snabbdom/modules/props').default, // for setting properties on DOM elements
  require('snabbdom/modules/dataset').default
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
  render (blocks, cursor, activeBlockKey) {
    const selector = `${LOWERCASE_TAGS.div}#${CLASS_OR_ID['AG_EDITOR_ID']}.${CLASS_OR_ID['mousetrap']}`

    const renderBlock = block => {
      const type = block.type === 'hr' ? 'p' : block.type
      const blockSelector = block.key === activeBlockKey || block.key === cursor.key
        ? `${type}#${block.key}.${CLASS_OR_ID['AG_PARAGRAPH']}.${CLASS_OR_ID['AG_ACTIVE']}`
        : `${type}#${block.key}.${CLASS_OR_ID['AG_PARAGRAPH']}`

      if (block.children.length) {
        return h(blockSelector, block.children.map(child => renderBlock(child)))
      } else {
        const children = block.text
          ? tokenizer(block.text).reduce((acc, token) => {
            const chunk = this[token.type](h, cursor, block, token)
            return Array.isArray(chunk) ? [...acc, ...chunk] : [...acc, chunk]
          }, [])
          : [ h(LOWERCASE_TAGS.br) ]
        const data = {
          dataset: {}
        }
        if (/^h\d$/.test(block.type)) {
          Object.assign(data.dataset, { head: block.type })
        }
        if (/^h/.test(block.type)) { // h\d or hr
          Object.assign(data.dataset, { role: block.type })
        }

        return h(blockSelector, data, children)
      }
    }

    const children = blocks.map(block => {
      return renderBlock(block)
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

  hr (h, cursor, block, token, outerClass) {
    const className = CLASS_OR_ID['AG_GRAY']
    return [
      h(`a.${className}`, {
        props: { href: '#' }
      }, token.marker)
    ]
  }

  header (h, cursor, block, token, outerClass) {
    const className = this.getClassName(outerClass, block, token, cursor)
    return [
      h(`a.${className}`, {
        props: { href: '#' }
      }, token.marker)
    ]
  }

  ['code_fense'] (h, cursor, block, token, outerClass) {
    return [
      h(`a.${CLASS_OR_ID['AG_GRAY']}`, {
        props: { href: '#' }
      }, token.marker),
      h(`a.${CLASS_OR_ID['AG_LANGUAGE']}`, {
        props: { href: '#' }
      }, token.content)
    ]
  }

  backlash (h, cursor, block, token, outerClass) {
    const className = this.getClassName(outerClass, block, token, cursor)
    return [
      h(`a.${className}`, {
        props: { href: '#' }
      }, token.marker)
    ]
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

  emoji (h, cursor, block, token, outerClass) {
    const className = this.getClassName(outerClass, block, token, cursor)
    const validation = validEmoji(token.content)
    const finalClass = validation ? className : CLASS_OR_ID['AG_WARN']
    const emojiVdom = validation
      ? h(`a.${finalClass}.${CLASS_OR_ID['AG_EMOJI_MARKED_TEXT']}`, { dataset: { emoji: validation.emoji } }, token.content)
      : h(`a.${finalClass}.${CLASS_OR_ID['AG_EMOJI_MARKED_TEXT']}`, token.content)
    return [
      h(`a.${finalClass}`, { props: { href: '#' } }, token.marker),
      emojiVdom,
      h(`a.${finalClass}`, { props: { href: '#' } }, token.marker)
    ]
  }

  // render factory of `del`,`em`,`strong`
  delEmStrongFac (type, h, cursor, block, token, outerClass) {
    const className = this.getClassName(outerClass, block, token, cursor)
    if (isLengthEven(token.backlash)) {
      return [
        h(`a.${className}`, {
          props: { href: '#' }
        }, token.marker),
        h(type, [
          ...token.children.reduce((acc, to) => {
            const chunk = this[to.type](h, cursor, block, to, className)
            return Array.isArray(chunk) ? [...acc, ...chunk] : [...acc, chunk]
          }, []),
          ...this.backlashInToken(token.backlash, className)
        ]),
        h(`a.${className}`, {
          props: { href: '#' }
        }, token.marker)
      ]
    } else {
      return [
        token.marker,
        ...token.children.reduce((acc, to) => {
          const chunk = this[to.type](h, cursor, block, to, className)
          return Array.isArray(chunk) ? [...acc, ...chunk] : [...acc, chunk]
        }, []),
        ...this.backlashInToken(token.backlash, className),
        token.marker
      ]
    }
  }

  backlashInToken (backlashes, outerClass) {
    const chunks = backlashes.split('')
    const len = chunks.length
    const result = []
    let i

    for (i = 0; i < len; i++) {
      if (isEven(i)) {
        result.push(
          h(`a.${outerClass}`, {
            props: {
              href: '#'
            }
          }, chunks[i])
        )
      } else {
        result.push(
          h(`a.${CLASS_OR_ID['AG_BACKLASH']}`, {
            props: {
              href: '#'
            }
          }, chunks[i])
        )
      }
    }

    result.push(
      h(`a.${CLASS_OR_ID['AG_BUG']}`) // the extral a tag for fix bug
    )

    return result
  }
  // I dont want operate dom directly, is there any better method? need help!
  image (h, cursor, block, token, outerClass) {
    const className = this.getClassName(outerClass, block, token, cursor)
    const imageClass = CLASS_OR_ID['AG_IMAGE_MARKED_TEXT']

    if (isLengthEven(token.backlash.first) && isLengthEven(token.backlash.second)) {
      const id = getIdWithoutSet()
      loadImage(token.src + encodeURI(token.backlash.second))
        .then(url => {
          const imageWrapper = document.querySelector(`#${id}`)
          const img = document.createElement('img')
          img.src = url
          img.alt = token.title + encodeURI(token.backlash.first)
          if (imageWrapper) {
            insertAfter(img, imageWrapper)
            operateClassName(imageWrapper, 'add', className)
          }
        })
        .catch(() => {
          const imageWrapper = document.querySelector(`#${id}`)
          if (imageWrapper) {
            operateClassName(imageWrapper, 'add', CLASS_OR_ID['AG_IMAGE_FAIL'])
          }
        })

      return [
        h(`a#${id}.${imageClass}`, { props: { href: '#' } }, [
          `![${token.title}`,
          ...this.backlashInToken(token.backlash.first, className),
          `](${token.src}`,
          ...this.backlashInToken(token.backlash.second, className),
          ')'
        ])
      ]
    } else {
      return [
        '![',
        ...token.children.reduce((acc, to) => {
          const chunk = this[to.type](h, cursor, block, to, className)
          return Array.isArray(chunk) ? [...acc, ...chunk] : [...acc, chunk]
        }, []),
        ...this.backlashInToken(token.backlash.first, className),
        '](',
        token.src,
        ...this.backlashInToken(token.backlash.second, className),
        ')'
      ]
    }
  }

  ['auto_link'] (h, cursor, block, token, outerClass) {
    return [
      h('a', {
        porps: {
          href: token.href
        }
      }, token.href)
    ]
  }

  // 'link': /^(\[)((?:\[[^\]]*\]|[^\[\]]|\](?=[^\[]*\]))*?)(\\*)\]\((.*?)(\\*)\)/, // can nest
  link (h, cursor, block, token, outerClass) {
    const className = this.getClassName(outerClass, block, token, cursor)
    const linkClassName = className === CLASS_OR_ID['AG_HIDE'] ? className : CLASS_OR_ID['AG_LINK_IN_BRACKET']
    if (isLengthEven(token.backlash.first) && isLengthEven(token.backlash.second)) {
      if (!token.children.length && !token.backlash.first) { // no-text-link
        return [
          h(`a.${CLASS_OR_ID['AG_GRAY']}`, { props: { href: '#' } }, '[]('),
          h('span', {
            dataset: {
              href: token.href + encodeURI(token.backlash.second),
              role: 'link'
            }
          }, [
            token.href,
            ...this.backlashInToken(token.backlash.second, className)
          ]),
          h(`a.${CLASS_OR_ID['AG_GRAY']}`, { props: { href: '#' } }, ')')
        ]
      } else { // has children
        return [
          h(`a.${className}`, { props: { href: '#' } }, '['),
          h('span', {
            dataset: {
              href: token.href + encodeURI(token.backlash.second),
              role: 'link'
            }
          }, [
            ...token.children.reduce((acc, to) => {
              const chunk = this[to.type](h, cursor, block, to, className)
              return Array.isArray(chunk) ? [...acc, ...chunk] : [...acc, chunk]
            }, []),
            ...this.backlashInToken(token.backlash.first, className)
          ]),
          h(`a.${className}`, { props: { href: '#' } }, ']('),
          h(`span.${linkClassName}`, [
            token.href,
            ...this.backlashInToken(token.backlash.second, className)
          ]),
          h(`a.${className}`, { props: { href: '#' } }, ')')
        ]
      }
    } else {
      return [
        '[',
        ...token.children.reduce((acc, to) => {
          const chunk = this[to.type](h, cursor, block, to, className)
          return Array.isArray(chunk) ? [...acc, ...chunk] : [...acc, chunk]
        }, []),
        ...this.backlashInToken(token.backlash.first, className),
        `](${token.href}`,
        ...this.backlashInToken(token.backlash.second, className),
        ')'
      ]
    }
  }

  del (h, cursor, block, token, outerClass) {
    return this.delEmStrongFac('del', h, cursor, block, token, outerClass)
  }

  em (h, cursor, block, token, outerClass) {
    return this.delEmStrongFac('em', h, cursor, block, token, outerClass)
  }

  strong (h, cursor, block, token, outerClass) {
    return this.delEmStrongFac('strong', h, cursor, block, token, outerClass)
  }
}

export default StateRender
