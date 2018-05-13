import virtualize from 'snabbdom-virtualize/strings'
import { CLASS_OR_ID, IMAGE_EXT_REG } from '../config'
import { conflict, isLengthEven, union, isEven, getUniqueId, loadImage, getImageSrc } from '../utils'
import { insertBefore, insertAfter, operateClassName } from '../utils/domManipulate'
import { tokenizer } from './parse'
import { validEmoji } from '../emojis'

const snabbdom = require('snabbdom')
const patch = snabbdom.init([ // Init patch function with chosen modules
  require('snabbdom/modules/class').default, // makes it easy to toggle classes
  require('snabbdom/modules/attributes').default,
  require('snabbdom/modules/props').default, // for setting properties on DOM elements
  require('snabbdom/modules/dataset').default
])
const h = require('snabbdom/h').default // helper function for creating vnodes
const toVNode = require('snabbdom/tovnode').default

class StateRender {
  constructor (eventCenter) {
    this.eventCenter = eventCenter
    this.loadImageMap = new Map()
    this.container = null
    this.offScreen = null
    this.init()
  }

  init () {
    let section = document.querySelector(`.${CLASS_OR_ID['AG_OFF_SCREEN']}`)
    if (!section) {
      section = document.createElement('section')
      section.classList.add(CLASS_OR_ID['AG_OFF_SCREEN'])
      document.body.appendChild(section)
    }
    this.offScreen = section
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

  renderLeafBlock (block, cursor, activeBlocks, matches) {
    let selector = this.getSelector(block, cursor, activeBlocks)
    // highlight search key in block
    const highlights = matches.filter(m => m.key === block.key)
    const { text, type, align, htmlContent, icon, checked, key, lang, functionType, codeBlockStyle } = block
    const data = {
      attrs: {},
      dataset: {}
    }
    let children = ''

    if (text) {
      children = tokenizer(text, highlights).reduce((acc, token) => [...acc, ...this[token.type](h, cursor, block, token)], [])
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
      children = virtualize(htmlContent)
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
      selector += `.${CLASS_OR_ID['AG_CODEMIRROR_BLOCK']}`
      selector += functionType === 'code' ? `.${CLASS_OR_ID['AG_CODE_BLOCK']}` : `.${CLASS_OR_ID['AG_HTML_BLOCK']}`
      children = ''
    }

    return h(selector, data, children)
  }

  renderContainerBlock (block, cursor, activeBlocks, matches) {
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
    return h(selector, data, block.children.map(child => this.renderBlock(child, cursor, activeBlocks, matches)))
  }

  /**
   * [renderBlock render one block, no matter it is a container block or text block]
   */
  renderBlock (block, cursor, activeBlocks, matches) {
    const method = block.children.length > 0 ? 'renderContainerBlock' : 'renderLeafBlock'

    return this[method](block, cursor, activeBlocks, matches)
  }

  render (blocks, cursor, activeBlocks, matches) {
    const selector = `div#${CLASS_OR_ID['AG_EDITOR_ID']}`

    const children = blocks.map(block => {
      return this.renderBlock(block, cursor, activeBlocks, matches)
    })

    const newVdom = h(selector, children)
    const rootDom = document.querySelector(selector) || this.container
    const oldVdom = toVNode(rootDom)

    patch(oldVdom, newVdom)
  }

  partialRender (blocks, cursor, activeBlocks, matches, startKey, endKey) {
    const cursorOutMostBlock = activeBlocks[activeBlocks.length - 1]
    // If cursor is not in render blocks, need to render cursor block independently
    const needRenderCursorBlock = blocks.indexOf(cursorOutMostBlock) === -1
    const newVnode = h(`section.${CLASS_OR_ID['AG_OFF_SCREEN']}`, blocks.map(block => this.renderBlock(block, cursor, activeBlocks, matches)))
    const { offScreen } = this

    patch(offScreen, newVnode)

    const renderedDoms = offScreen.children
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

    Array.from(renderedDoms).forEach(dom => {
      insertBefore(dom, firstOldDom)
    })

    Array.from(needToRemoved).forEach(dom => dom.remove())

    offScreen.textContent = ''

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

  hr (h, cursor, block, token, outerClass) {
    const { start, end } = token.range
    const content = this.highlight(h, block, start, end, token)
    return [
      h(`span.${CLASS_OR_ID['AG_GRAY']}.${CLASS_OR_ID['AG_REMOVE']}`, content)
    ]
  }

  header (h, cursor, block, token, outerClass) {
    const className = this.getClassName(outerClass, block, token, cursor)
    const { start, end } = token.range
    const content = this.highlight(h, block, start, end, token)
    return [
      h(`span.${className}.${CLASS_OR_ID['AG_REMOVE']}`, content)
    ]
  }

  ['tail_header'] (h, cursor, block, token, outerClass) {
    const className = this.getClassName(outerClass, block, token, cursor)
    const { start, end } = token.range
    const content = this.highlight(h, block, start, end, token)
    if (/^h\d$/.test(block.type)) {
      return [
        h(`span.${className}`, content)
      ]
    } else {
      return content
    }
  }

  ['hard_line_break'] (h, cursor, block, token, outerClass) {
    const className = CLASS_OR_ID['AG_HARD_LINE_BREAK']
    const content = [ token.spaces ]
    if (block.type === 'span' && block.nextSibling) {
      return [
        h(`span.${className}`, content)
      ]
    } else {
      return content
    }
  }

  ['code_fense'] (h, cursor, block, token, outerClass) {
    const { start, end } = token.range
    const { marker } = token

    const markerContent = this.highlight(h, block, start, start + marker.length, token)
    const content = this.highlight(h, block, start + marker.length, end, token)

    return [
      h(`span.${CLASS_OR_ID['AG_GRAY']}`, markerContent),
      h(`span.${CLASS_OR_ID['AG_LANGUAGE']}`, content)
    ]
  }

  backlash (h, cursor, block, token, outerClass) {
    const className = this.getClassName(outerClass, block, token, cursor)
    const { start, end } = token.range
    const content = this.highlight(h, block, start, end, token)

    return [
      h(`span.${className}.${CLASS_OR_ID['AG_REMOVE']}`, content)
    ]
  }

  ['display_math'] (h, cursor, block, token, outerClass) {
    const className = this.getClassName(outerClass, block, token, cursor)
    const { start, end } = token.range
    const { marker } = token

    const startMarker = this.highlight(h, block, start, start + marker.length, token)
    const endMarker = this.highlight(h, block, end - marker.length, end, token)
    const content = this.highlight(h, block, start + marker.length, end - marker.length, token)

    const { content: math, type } = token

    return [
      h(`span.${className}.${CLASS_OR_ID['AG_MATH_MARKER']}`, startMarker),
      h(`span.${className}.${CLASS_OR_ID['AG_MATH']}`, [
        h(`span.${CLASS_OR_ID['AG_MATH_TEXT']}`, content),
        h(`span.${CLASS_OR_ID['AG_MATH_RENDER']}`, {
          dataset: { math, type },
          attrs: { contenteditable: 'false' }
        }, 'Loading')
      ]),
      h(`span.${className}.${CLASS_OR_ID['AG_MATH_MARKER']}`, endMarker)
    ]
  }

  ['inline_math'] (h, cursor, block, token, outerClass) {
    return this['display_math'](h, cursor, block, token, outerClass)
  }

  ['inline_code'] (h, cursor, block, token, outerClass) {
    const className = this.getClassName(outerClass, block, token, cursor)
    const { marker } = token
    const { start, end } = token.range

    const startMarker = this.highlight(h, block, start, start + marker.length, token)
    const endMarker = this.highlight(h, block, end - marker.length, end, token)
    const content = this.highlight(h, block, start + marker.length, end - marker.length, token)

    return [
      h(`span.${className}.${CLASS_OR_ID['AG_REMOVE']}`, startMarker),
      h('code', content),
      h(`span.${className}.${CLASS_OR_ID['AG_REMOVE']}`, endMarker)
    ]
  }

  // change text to highlight vdom
  highlight (h, block, rStart, rEnd, token) {
    const { text } = block
    const { highlights } = token
    let result = []
    let unions = []
    let pos = rStart

    if (highlights) {
      for (const light of highlights) {
        const un = union({ start: rStart, end: rEnd }, light)
        if (un) unions.push(un)
      }
    }

    if (unions.length) {
      for (const u of unions) {
        const { start, end, active } = u
        const className = this.getHighlightClassName(active)

        if (pos < start) {
          result.push(text.substring(pos, start))
        }

        result.push(h(`span.${className}`, text.substring(start, end)))
        pos = end
      }
      if (pos < rEnd) {
        result.push(block.text.substring(pos, rEnd))
      }
    } else {
      result = [ text.substring(rStart, rEnd) ]
    }

    return result
  }
  // render token of text type to vdom.
  text (h, cursor, block, token) {
    const { start, end } = token.range
    return this.highlight(h, block, start, end, token)
  }
  // render token of emoji to vdom
  emoji (h, cursor, block, token, outerClass) {
    const { start: rStart, end: rEnd } = token.range
    const className = this.getClassName(outerClass, block, token, cursor)
    const validation = validEmoji(token.content)
    const finalClass = validation ? className : CLASS_OR_ID['AG_WARN']
    const CONTENT_CLASSNAME = `span.${finalClass}.${CLASS_OR_ID['AG_EMOJI_MARKED_TEXT']}`
    let startMarkerCN = `span.${finalClass}.${CLASS_OR_ID['AG_EMOJI_MARKER']}`
    let endMarkerCN = startMarkerCN
    let content = token.content
    let pos = rStart + token.marker.length

    if (token.highlights && token.highlights.length) {
      content = []
      for (const light of token.highlights) {
        let { start, end, active } = light
        const HIGHLIGHT_CLASSNAME = this.getHighlightClassName(active)
        if (start === rStart) {
          startMarkerCN += `.${HIGHLIGHT_CLASSNAME}`
          start++
        }
        if (end === rEnd) {
          endMarkerCN += `.${HIGHLIGHT_CLASSNAME}`
          end--
        }
        if (pos < start) {
          content.push(block.text.substring(pos, start))
        }
        if (start < end) {
          content.push(h(`span.${HIGHLIGHT_CLASSNAME}`, block.text.substring(start, end)))
        }
        pos = end
      }
      if (pos < rEnd - token.marker.length) {
        content.push(block.text.substring(pos, rEnd - 1))
      }
    }

    const emojiVdom = validation
      ? h(CONTENT_CLASSNAME, {
        dataset: {
          emoji: validation.emoji
        }
      }, content)
      : h(CONTENT_CLASSNAME, content)

    return [
      h(startMarkerCN, token.marker),
      emojiVdom,
      h(endMarkerCN, token.marker)
    ]
  }

  // render factory of `del`,`em`,`strong`
  delEmStrongFac (type, h, cursor, block, token, outerClass) {
    const className = this.getClassName(outerClass, block, token, cursor)
    const COMMON_MARKER = `span.${className}.${CLASS_OR_ID['AG_REMOVE']}`
    const { marker } = token
    const { start, end } = token.range
    const backlashStart = end - marker.length - token.backlash.length
    const content = [
      ...token.children.reduce((acc, to) => {
        const chunk = this[to.type](h, cursor, block, to, className)
        return Array.isArray(chunk) ? [...acc, ...chunk] : [...acc, chunk]
      }, []),
      ...this.backlashInToken(token.backlash, className, backlashStart, token)
    ]
    const startMarker = this.highlight(h, block, start, start + marker.length, token)
    const endMarker = this.highlight(h, block, end - marker.length, end, token)

    if (isLengthEven(token.backlash)) {
      return [
        h(COMMON_MARKER, startMarker),
        h(type, content),
        h(COMMON_MARKER, endMarker)
      ]
    } else {
      return [
        ...startMarker,
        ...content,
        ...endMarker
      ]
    }
  }
  // TODO HIGHLIGHT
  backlashInToken (backlashes, outerClass, start, token) {
    const { highlights = [] } = token
    const chunks = backlashes.split('')
    const len = chunks.length
    const result = []
    let i

    for (i = 0; i < len; i++) {
      const chunk = chunks[i]
      const light = highlights.filter(light => union({ start: start + i, end: start + i + 1 }, light))
      let selector = 'span'
      if (light.length) {
        const className = this.getHighlightClassName(light[0].active)
        selector += `.${className}`
      }
      if (isEven(i)) {
        result.push(
          h(`${selector}.${outerClass}`, chunk)
        )
      } else {
        result.push(
          h(`${selector}.${CLASS_OR_ID['AG_BACKLASH']}`, chunk)
        )
      }
    }

    return result
  }

  loadImageAsync (src, alt, className, imageClass) {
    let id
    let isSuccess

    if (!this.loadImageMap.has(src)) {
      id = getUniqueId()
      loadImage(src)
        .then(url => {
          const imageWrapper = document.querySelector(`#${id}`)
          const img = document.createElement('img')
          img.src = url
          if (alt) img.alt = alt
          if (imageClass) {
            img.classList.add(imageClass)
          }
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

    return { id, isSuccess }
  }

  // I dont want operate dom directly, is there any better method? need help!
  image (h, cursor, block, token, outerClass) {
    const { eventCenter } = this
    const { start: cursorStart, end: cursorEnd } = cursor
    const { start, end } = token.range
    if (
      cursorStart.key === cursorEnd.key &&
      cursorStart.offset === cursorEnd.offset &&
      cursorStart.offset === end - 1 &&
      !IMAGE_EXT_REG.test(token.src)
    ) {
      eventCenter.dispatch('image-path', token.src)
    }

    const className = this.getClassName(outerClass, block, token, cursor)
    const imageClass = CLASS_OR_ID['AG_IMAGE_MARKED_TEXT']

    const titleContent = this.highlight(h, block, start, start + 2 + token.title.length, token)

    const srcContent = this.highlight(
      h, block,
      start + 2 + token.title.length + token.backlash.first.length + 2,
      start + 2 + token.title.length + token.backlash.first.length + 2 + token.src.length,
      token
    )

    const firstBracketContent = this.highlight(h, block, start, start + 2, token)

    const secondBracketContent = this.highlight(
      h, block,
      start + 2 + token.title.length + token.backlash.first.length,
      start + 2 + token.title.length + token.backlash.first.length + 2,
      token
    )

    const lastBracketContent = this.highlight(h, block, end - 1, end, token)

    const firstBacklashStart = start + 2 + token.title.length

    const secondBacklashStart = end - 1 - token.backlash.second.length

    if (isLengthEven(token.backlash.first) && isLengthEven(token.backlash.second)) {
      let id
      let isSuccess
      let selector
      const src = getImageSrc(token.src + encodeURI(token.backlash.second))
      const alt = token.title + encodeURI(token.backlash.first)

      if (src) {
        ({ id, isSuccess } = this.loadImageAsync(src, alt, className))
      }

      selector = id ? `span#${id}.${imageClass}.${CLASS_OR_ID['AG_REMOVE']}` : `span.${imageClass}.${CLASS_OR_ID['AG_REMOVE']}`

      if (isSuccess) {
        selector += `.${className}`
      } else {
        selector += `.${CLASS_OR_ID['AG_IMAGE_FAIL']}`
      }
      const children = [
        ...titleContent,
        ...this.backlashInToken(token.backlash.first, className, firstBacklashStart, token),
        ...secondBracketContent,
        h(`span.${CLASS_OR_ID['AG_IMAGE_SRC']}`, srcContent),
        ...this.backlashInToken(token.backlash.second, className, secondBacklashStart, token),
        ...lastBracketContent
      ]

      return isSuccess
        ? [
          h(selector, children),
          h('img', { props: { alt, src } })
        ]
        : [h(selector, children)]
    } else {
      return [
        ...firstBracketContent,
        ...token.children.reduce((acc, to) => {
          const chunk = this[to.type](h, cursor, block, to, className)
          return Array.isArray(chunk) ? [...acc, ...chunk] : [...acc, chunk]
        }, []),
        ...this.backlashInToken(token.backlash.first, className, firstBacklashStart, token),
        ...secondBracketContent,
        ...srcContent,
        ...this.backlashInToken(token.backlash.second, className, secondBacklashStart, token),
        ...lastBracketContent
      ]
    }
  }

  // html_image
  ['html_image'] (h, cursor, block, token, outerClass) {
    const className = this.getClassName(outerClass, block, token, cursor)
    const imageClass = CLASS_OR_ID['AG_IMAGE_MARKED_TEXT']
    const { start, end } = token.range
    const tag = this.highlight(h, block, start, end, token)
    const { src: rawSrc, alt } = token
    const src = getImageSrc(rawSrc)
    let id
    let isSuccess
    let selector
    if (src) {
      ({ id, isSuccess } = this.loadImageAsync(src, alt, className, CLASS_OR_ID['AG_COPY_REMOVE']))
    }
    selector = id ? `span#${id}.${imageClass}.${CLASS_OR_ID['AG_HTML_TAG']}` : `span.${imageClass}.${CLASS_OR_ID['AG_HTML_TAG']}`
    selector += `.${CLASS_OR_ID['AG_OUTPUT_REMOVE']}`
    if (isSuccess) {
      selector += `.${className}`
    } else {
      selector += `.${CLASS_OR_ID['AG_IMAGE_FAIL']}`
    }

    return isSuccess
      ? [
        h(selector, tag),
        h(`img.${CLASS_OR_ID['AG_COPY_REMOVE']}`, { props: { alt, src } })
      ]
      : [h(selector, tag)]
  }

  // render auto_link to vdom
  ['auto_link'] (h, cursor, block, token, outerClass) {
    const { start, end } = token.range
    const content = this.highlight(h, block, start, end, token)

    return [
      h('a', {
        props: {
          href: token.href
        }
      }, content)
    ]
  }

  // `a_link`: `<a href="url">anchor</a>`
  ['a_link'] (h, cursor, block, token, outerClass) {
    const className = this.getClassName(outerClass, block, token, cursor)
    const tagClassName = className === CLASS_OR_ID['AG_HIDE'] ? className : CLASS_OR_ID['AG_HTML_TAG']
    const { start, end } = token.range
    const openTag = this.highlight(h, block, start, start + token.openTag.length, token)
    const anchor = token.children.reduce((acc, to) => {
      const chunk = this[to.type](h, cursor, block, to, className)
      return Array.isArray(chunk) ? [...acc, ...chunk] : [...acc, chunk]
    }, [])
    const closeTag = this.highlight(h, block, end - token.closeTag.length, end, token)

    return [
      h(`span.${tagClassName}.${CLASS_OR_ID['AG_OUTPUT_REMOVE']}`, openTag),
      h(`a.${CLASS_OR_ID['AG_A_LINK']}`, {
        dataset: {
          href: token.href
        }
      }, anchor),
      h(`span.${tagClassName}.${CLASS_OR_ID['AG_OUTPUT_REMOVE']}`, closeTag)
    ]
  }

  ['html_tag'] (h, cursor, block, token, outerClass) {
    const className = CLASS_OR_ID['AG_HTML_TAG']
    const { start, end } = token.range
    const tag = this.highlight(h, block, start, end, token)
    const isBr = /<br(?=\s|\/|>)/.test(token.tag)
    return [
      h(`span.${className}`, isBr ? [...tag, h('br')] : tag)
    ]
  }

  // 'link': /^(\[)((?:\[[^\]]*\]|[^\[\]]|\](?=[^\[]*\]))*?)(\\*)\]\((.*?)(\\*)\)/, // can nest
  link (h, cursor, block, token, outerClass) {
    const className = this.getClassName(outerClass, block, token, cursor)
    const linkClassName = className === CLASS_OR_ID['AG_HIDE'] ? className : CLASS_OR_ID['AG_LINK_IN_BRACKET']
    const { start, end } = token.range
    const firstMiddleBracket = this.highlight(h, block, start, start + 3, token)

    const firstBracket = this.highlight(h, block, start, start + 1, token)
    const middleBracket = this.highlight(
      h, block,
      start + 1 + token.anchor.length + token.backlash.first.length,
      start + 1 + token.anchor.length + token.backlash.first.length + 2,
      token
    )
    const hrefContent = this.highlight(
      h, block,
      start + 1 + token.anchor.length + token.backlash.first.length + 2,
      start + 1 + token.anchor.length + token.backlash.first.length + 2 + token.href.length,
      token
    )
    const middleHref = this.highlight(
      h, block, start + 1 + token.anchor.length + token.backlash.first.length,
      block, start + 1 + token.anchor.length + token.backlash.first.length + 2 + token.href.length,
      token
    )

    const lastBracket = this.highlight(h, block, end - 1, end, token)

    const firstBacklashStart = start + 1 + token.anchor.length
    const secondBacklashStart = end - 1 - token.backlash.second.length

    if (isLengthEven(token.backlash.first) && isLengthEven(token.backlash.second)) {
      if (!token.children.length && !token.backlash.first) { // no-text-link
        return [
          h(`span.${CLASS_OR_ID['AG_GRAY']}.${CLASS_OR_ID['AG_REMOVE']}`, firstMiddleBracket),
          h(`a.${CLASS_OR_ID['AG_NOTEXT_LINK']}`, {
            props: {
              href: token.href + encodeURI(token.backlash.second)
            }
          }, [
            ...hrefContent,
            ...this.backlashInToken(token.backlash.second, className, secondBacklashStart, token)
          ]),
          h(`span.${CLASS_OR_ID['AG_GRAY']}.${CLASS_OR_ID['AG_REMOVE']}`, lastBracket)
        ]
      } else { // has children
        return [
          h(`span.${className}.${CLASS_OR_ID['AG_REMOVE']}`, firstBracket),
          h('a', {
            dataset: {
              href: token.href + encodeURI(token.backlash.second)
            }
          }, [
            ...token.children.reduce((acc, to) => {
              const chunk = this[to.type](h, cursor, block, to, className)
              return Array.isArray(chunk) ? [...acc, ...chunk] : [...acc, chunk]
            }, []),
            ...this.backlashInToken(token.backlash.first, className, firstBacklashStart, token)
          ]),
          h(`span.${className}.${CLASS_OR_ID['AG_REMOVE']}`, middleBracket),
          h(`span.${linkClassName}.${CLASS_OR_ID['AG_REMOVE']}`, [
            ...hrefContent,
            ...this.backlashInToken(token.backlash.second, className, secondBacklashStart, token)
          ]),
          h(`span.${className}.${CLASS_OR_ID['AG_REMOVE']}`, lastBracket)
        ]
      }
    } else {
      return [
        ...firstBracket,
        ...token.children.reduce((acc, to) => {
          const chunk = this[to.type](h, cursor, block, to, className)
          return Array.isArray(chunk) ? [...acc, ...chunk] : [...acc, chunk]
        }, []),
        ...this.backlashInToken(token.backlash.first, className, firstBacklashStart, token),
        ...middleHref,
        ...this.backlashInToken(token.backlash.second, className, secondBacklashStart, token),
        ...lastBracket
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
