import { LOWERCASE_TAGS, CLASS_OR_ID } from '../config'
import { conflict, isLengthEven, isEven, getIdWithoutSet, loadImage, getImageSrc } from '../utils'
import { insertAfter, operateClassName } from '../utils/domManipulate.js'
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
    this.loadImageMap = new Map()
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

  /**
   * [render]: 2 steps:
   * render vdom
   */
  render (blocks, cursor, activeBlockKey) {
    const selector = `${LOWERCASE_TAGS.div}#${CLASS_OR_ID['AG_EDITOR_ID']}`

    const renderBlock = block => {
      const type = block.type === 'hr' ? 'p' : block.type
      const isActive = block.key === activeBlockKey || block.key === cursor.start.key

      let blockSelector = isActive
        ? `${type}#${block.key}.${CLASS_OR_ID['AG_PARAGRAPH']}.${CLASS_OR_ID['AG_ACTIVE']}`
        : `${type}#${block.key}.${CLASS_OR_ID['AG_PARAGRAPH']}`

      const data = {
        props: {},
        dataset: {}
      }

      if (block.children.length) {
        if (block.type === 'ol') {
          Object.assign(data.props, { start: block.start })
        }
        if (block.type === 'li' && block.isTask) {
          blockSelector += `.${CLASS_OR_ID['AG_TASK_LIST_ITEM']}`
        }
        return h(blockSelector, data, block.children.map(child => renderBlock(child)))
      } else {
        let children = block.text
          ? tokenizer(block.text).reduce((acc, token) => {
            const chunk = this[token.type](h, cursor, block, token)
            return Array.isArray(chunk) ? [...acc, ...chunk] : [...acc, chunk]
          }, [])
          : [ h(LOWERCASE_TAGS.br) ]

        if (/^h\d$/.test(block.type)) {
          Object.assign(data.dataset, { head: block.type })
        }

        if (/^h/.test(block.type)) { // h\d or hr
          Object.assign(data.dataset, { role: block.type })
        }

        if (block.type === 'pre') {
          if (block.lang) Object.assign(data.dataset, { lang: block.lang })
          blockSelector += `.${CLASS_OR_ID['AG_CODE_BLOCK']}`
          children = ''
        }

        if (block.type === 'input') {
          const { checked, type, key } = block
          Object.assign(data.props, { type: 'checkbox' })
          if (checked) {
            Object.assign(data.props, { checked: true })
          }
          blockSelector = `${type}#${key}`
          children = ''
        }

        if (block.temp) {
          blockSelector += `.${CLASS_OR_ID['AG_TEMP']}`
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
  }

  hr (h, cursor, block, token, outerClass) {
    return [
      h(`span.${CLASS_OR_ID['AG_GRAY']}.${CLASS_OR_ID['AG_REMOVE']}`, token.marker)
    ]
  }

  header (h, cursor, block, token, outerClass) {
    const className = this.getClassName(outerClass, block, token, cursor)
    return [
      h(`span.${className}.${CLASS_OR_ID['AG_REMOVE']}`, token.marker)
    ]
  }

  ['code_fense'] (h, cursor, block, token, outerClass) {
    return [
      h(`span.${CLASS_OR_ID['AG_GRAY']}`, token.marker),
      h(`span.${CLASS_OR_ID['AG_LANGUAGE']}`, token.content)
    ]
  }

  backlash (h, cursor, block, token, outerClass) {
    const className = this.getClassName(outerClass, block, token, cursor)
    return [
      h(`span.${className}.${CLASS_OR_ID['AG_REMOVE']}`, token.marker)
    ]
  }

  ['inline_code'] (h, cursor, block, token, outerClass) {
    const className = this.getClassName(outerClass, block, token, cursor)
    return [
      h(`span.${className}.${CLASS_OR_ID['AG_REMOVE']}`, token.marker),
      h('code', token.content),
      h(`span.${className}.${CLASS_OR_ID['AG_REMOVE']}`, token.marker)
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
      ? h(`span.${finalClass}.${CLASS_OR_ID['AG_EMOJI_MARKED_TEXT']}`, { dataset: { emoji: validation.emoji } }, token.content)
      : h(`span.${finalClass}.${CLASS_OR_ID['AG_EMOJI_MARKED_TEXT']}`, token.content)

    return [
      h(`span.${finalClass}.${CLASS_OR_ID['AG_EMOJI_MARKER']}`, token.marker),
      emojiVdom,
      h(`span.${finalClass}.${CLASS_OR_ID['AG_EMOJI_MARKER']}`, token.marker)
    ]
  }

  // render factory of `del`,`em`,`strong`
  delEmStrongFac (type, h, cursor, block, token, outerClass) {
    const className = this.getClassName(outerClass, block, token, cursor)

    if (isLengthEven(token.backlash)) {
      return [
        h(`span.${className}.${CLASS_OR_ID['AG_REMOVE']}`, token.marker),
        h(type, [
          ...token.children.reduce((acc, to) => {
            const chunk = this[to.type](h, cursor, block, to, className)
            return Array.isArray(chunk) ? [...acc, ...chunk] : [...acc, chunk]
          }, []),
          ...this.backlashInToken(token.backlash, className)
        ]),
        h(`span.${className}.${CLASS_OR_ID['AG_REMOVE']}`, token.marker)
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
          h(`span.${outerClass}`, chunks[i])
        )
      } else {
        result.push(
          h(`span.${CLASS_OR_ID['AG_BACKLASH']}`, chunks[i])
        )
      }
    }

    // result.push(
    //   h(`span.${CLASS_OR_ID['AG_BUG']}`) // the extral a tag for fix bug
    // )

    return result
  }
  // I dont want operate dom directly, is there any better method? need help!
  image (h, cursor, block, token, outerClass) {
    const className = this.getClassName(outerClass, block, token, cursor)
    const imageClass = CLASS_OR_ID['AG_IMAGE_MARKED_TEXT']

    if (isLengthEven(token.backlash.first) && isLengthEven(token.backlash.second)) {
      let id
      let isSuccess
      let selector
      const src = getImageSrc(token.src + encodeURI(token.backlash.second))
      const alt = token.title + encodeURI(token.backlash.first)

      if (src) {
        if (!this.loadImageMap.has(src)) {
          id = getIdWithoutSet()
          loadImage(src)
            .then(url => {
              const imageWrapper = document.querySelector(`#${id}`)
              const img = document.createElement('img')
              img.src = url
              img.alt = alt
              if (imageWrapper) {
                insertAfter(img, imageWrapper)
                operateClassName(imageWrapper, 'add', className)
              }
              this.loadImageMap.set(src, {
                id,
                isSuccess: true
              })
            })
            .catch(() => {
              const imageWrapper = document.querySelector(`#${id}`)
              if (imageWrapper) {
                operateClassName(imageWrapper, 'add', CLASS_OR_ID['AG_IMAGE_FAIL'])
              }
              this.loadImageMap.set(src, {
                id,
                isSuccess: false
              })
            })
        } else {
          const imageInfo = this.loadImageMap.get(src)
          id = imageInfo.id
          isSuccess = imageInfo.isSuccess
        }
      }

      selector = id ? `span#${id}.${imageClass}.${CLASS_OR_ID['AG_REMOVE']}` : `span.${imageClass}.${CLASS_OR_ID['AG_REMOVE']}`

      if (isSuccess) {
        selector += `.${className}`
      } else {
        selector += `.${CLASS_OR_ID['AG_IMAGE_FAIL']}`
      }

      const children = [
        `![${token.title}`,
        ...this.backlashInToken(token.backlash.first, className),
        `](${token.src}`,
        ...this.backlashInToken(token.backlash.second, className),
        ')'
      ]

      return isSuccess
        ? [
          h(selector, children),
          h('img', { props: { alt, src } })
        ]
        : [h(selector, children)]
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
          h(`span.${CLASS_OR_ID['AG_GRAY']}.${CLASS_OR_ID['AG_REMOVE']}`, '[]('),
          h(`a.${CLASS_OR_ID['AG_NOTEXT_LINK']}`, {
            props: {
              href: token.href + encodeURI(token.backlash.second)
            }
          }, [
            token.href,
            ...this.backlashInToken(token.backlash.second, className)
          ]),
          h(`span.${CLASS_OR_ID['AG_GRAY']}.${CLASS_OR_ID['AG_REMOVE']}`, ')')
        ]
      } else { // has children
        return [
          h(`span.${className}.${CLASS_OR_ID['AG_REMOVE']}`, '['),
          h('a', {
            dataset: {
              href: token.href + encodeURI(token.backlash.second)
            }
          }, [
            ...token.children.reduce((acc, to) => {
              const chunk = this[to.type](h, cursor, block, to, className)
              return Array.isArray(chunk) ? [...acc, ...chunk] : [...acc, chunk]
            }, []),
            ...this.backlashInToken(token.backlash.first, className)
          ]),
          h(`span.${className}.${CLASS_OR_ID['AG_REMOVE']}`, ']('),
          h(`span.${linkClassName}.${CLASS_OR_ID['AG_REMOVE']}`, [
            token.href,
            ...this.backlashInToken(token.backlash.second, className)
          ]),
          h(`span.${className}.${CLASS_OR_ID['AG_REMOVE']}`, ')')
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
