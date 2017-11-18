import { html2json, json2html } from 'html2json'
import { validEmoji } from './emojis'
import {
  LOWERCASE_TAGS,
  EMOJI_MARKED_TEXT,
  EDITOR_ATTR_NAME,
  emptyElementNames,
  paragraphClassName,
  blockContainerElementNames
} from './config'

/**
 * RegExp constants
 */

const fragments = [
  '^#{1,6}', // Header
  '(\\*{1,3}|_{1,3})[^*_]+\\1', // Emphasize
  '(`{1,3})([^`]+?|.{2,})\\2', // inline code
  '\\[[^\\[\\]]+\\]\\(.*?\\)', // link
  '\\[\\]\\([^\\(\\)]*?\\)', // no text link
  ':[^:]+?:', // emoji
  '~{2}[^~]+~{2}', // line through
  'https?://[^\\s]+(?=\\s|$)' // auto link
]

const CHOP_REG = new RegExp(fragments.join('|'), 'g') // eslint-disable-line no-useless-escape
const CHOP_TEXT_REG = /(\*{1,3})([^*]+)(\1)/g
const HEAD_REG_G = /^(#{1,6})([^#]*)$/g
const HEAD_REG = /^(#{1,6})([^#]*)$/
const EMPHASIZE_REG_G = /(\*{1,3}|_{1,3})([^*]+)(\1)/g
const EMPHASIZE_REG = /(\*{1,3}|_{1,3})([^*]+)(\1)/
const INLINE_CODE_REG_G = /(`{1,3})([^`]+?|.{2,})(\1)/g
const INLINE_CODE_REG = /(`{1,3})([^`]+?|.{2,})(\1)/
// eslint has bug ? need ignore
const LINK_REG_G = /(\[)([^\[\]]+)(\]\()([^()]*?)(\))/g // eslint-disable-line no-useless-escape
const LINK_REG = /(\[)([^\[\]]+)(\]\()([^()]*?)(\))/ // eslint-disable-line no-useless-escape
const NO_TEXT_LINK_G = /(\[\]\()([^()]*?)(\))/g
const NO_TEXT_LINK = /(\[\]\([^()]*?\))/
const EMOJI_REG_G = /(:)([^:]+?)(:)/g
const EMOJI_REG = /:[^:]+?:/
const LINE_THROUGH_REG_G = /(~{2})([^~]+?)(~{2})/g
const LINE_THROUGH_REG = /~{2}[^~]+?~{2}/
const AUTO_LINK_G = /(https?:\/\/[^\\s]+)(?=\s|$)/g
const AUTO_LINK = /https?:\/\/[^\s]+(?=\s|$)/
// const SIMPLE_LINK_G = /(<)([^<>]+?)(>)/g
// const SIMPLE_LINK = /<[^<>]+?>/g
const LINE_BREAK_BLOCK_REG = /^(?:`{3,}(.*))/
const INLINE_BLOCK_REG = /^(?:[*+-]\s(\[\s\]\s)?|\d+\.\s|(#{1,6})[^#]+|>.+)/
const CHOP_HEADER_REG = /^([*+-]\s(?:\[\s\]\s)?|>\s*|\d+\.\s)/

// help functions
/**
 *  Are two arraies have intersection
 */
const conflict = (arr1, arr2) => {
  return !(arr1[1] < arr2[0] || arr2[1] < arr1[0])
}
const getId = () => {
  const prefix = 'ag-'

  return `${prefix}${Math.random().toString(32).slice(2)}`
}

const chunk2html = ({ chunk, index, lastIndex }, { start, end } = {}) => {
  // if no positionState provided, no conflict.
  const isConflicted = start !== undefined && end !== undefined
    ? conflict([index, lastIndex], [start, end])
    : false
  const className = isConflicted ? 'gray' : 'hidden'

  // handle head mark symble
  if (HEAD_REG.test(chunk)) {
    return chunk.replace(HEAD_REG_G, (match, p1, p2) => {
      return `<a href="#" class="${className}">${p1}</a>${p2}`
    })
  }

  // handle emphasize
  if (EMPHASIZE_REG.test(chunk)) {
    return chunk.replace(EMPHASIZE_REG_G, (match, p1, p2, p3) => {
      let startTags
      let endTags
      switch (p1.length) {
        case 1:
          startTags = '<em>'
          endTags = '</em>'
          break
        case 2:
          startTags = '<strong>'
          endTags = '</strong>'
          break
        case 3:
          startTags = '<strong><em>'
          endTags = '</em></strong>'
      }
      return (
        `<a href="#" class="${className}">${p1}</a>` +
        `${startTags}${p2}${endTags}` +
        `<a href="#" class="${className}">${p3}</a>`
      )
    })
  }
  // handle inline code: markdown text: `code`
  // => `
  //    <a href="#" class="gray|hiden">`</a>
  //    <code>code</code>
  //    <a href="#" class="gray|hidden">`<a>
  //  `
  //  also need to handle more than one `. ex: ``code`another```
  if (INLINE_CODE_REG.test(chunk)) {
    return chunk.replace(INLINE_CODE_REG_G, (match, p1, p2, p3) => {
      return (
        `<a href="#" class="${className}">${p1}</a>` +
        `<code>${p2}</code>` +
        `<a href="#" class="${className}">${p3}</a>`
      )
    })
  }
  // handler no text link: markdown text: `[](www.baidu.com)`
  if (NO_TEXT_LINK.test(chunk)) {
    return chunk.replace(NO_TEXT_LINK_G, (match, p1, p2, p3) => {
      return (
        `<a href="#" class="gray">${p1}</a>` +
        `<a href="${p2}">${p2}</a>` +
        `<a href="#" class="gray">${p3}</a>`
      )
    })
  }

  // handle link: markdown text: [Aganippe](https://github.com/Jocs/aganippe/commits/master)
  //  => html bellow
  //  `
  //  <a href="#" class="gray|hidden">[</a>
  //  <a href="#" data-href="https://github.com/Jocs/aganippe/commits/master">Aganippe</a>
  //  <a href="#" class="gray|hidden">]</a>
  //  <a href="#" class="gray|hidden">(</a>
  //  <a href="#" class="gray|hidden">https://github.com/Jocs/aganippe/commits/master</a>
  //  <a href="#" class="gray|hidden">)</a>
  //
  //  `
  if (LINK_REG.test(chunk)) {
    return chunk.replace(LINK_REG_G, (match, p1, p2, p3, p4, p5) => {
      const linkClassName = className === 'hidden' ? className : ''
      return (
        `<a href="#" class="${className}">${p1}</a>` +
        `<a href="${p4}">${p2}</a>` +
        `<a href="#" class="${className}">${p3}</a>` +
        `<a href="#" class="${linkClassName}">${p4}</a>` +
        `<a href="#" class="${className}">${p5}</a>`
      )
    })
  }
  // handle emoji
  if (EMOJI_REG.test(chunk)) {
    return chunk.replace(EMOJI_REG_G, (match, p1, p2, p3) => {
      const validation = validEmoji(p2)
      if (validation) {
        return (
          `<a href="#" class="${className}">${p1}</a>` +
          `<a href="#" class="${className} ${EMOJI_MARKED_TEXT}" data-emoji="${validation.emoji}">${p2}</a>` +
          `<a href="#" class="${className}">${p3}</a>`
        )
      } else {
        return (
          `<a href="#" class="ag-warn">${p1}</a>` +
          `<a href="#" class="ag-warn ${EMOJI_MARKED_TEXT}">${p2}</a>` +
          `<a href="#" class="ag-warn">${p3}</a>`
        )
      }
    })
  }

  if (LINE_THROUGH_REG.test(chunk)) {
    return chunk.replace(LINE_THROUGH_REG_G, (match, p1, p2, p3) => {
      return (
        `<a href="#" class="${className}">${p1}</a>` +
        `<del>${p2}</del>` +
        `<a href="#" class="${className}">${p3}</a>`
      )
    })
  }

  if (AUTO_LINK.test(chunk)) {
    return chunk.replace(AUTO_LINK_G, (match, p1) => {
      return (
        `<a href="${p1}">${p1}</a>`
      )
    })
  }

  // handle picture
  // TODO
  // handle auto link: markdown text: `<this is a auto link>`
  return chunk
}

const getMarkedChunks = markedText => {
  const chunks = []
  let match

  do {
    match = CHOP_REG.exec(markedText)
    if (match) {
      chunks.push({
        index: match.index,
        chunk: match[0],
        lastIndex: CHOP_REG.lastIndex
      })
    }
  } while (match)
  console.log(chunks)
  return chunks
}

/**
 * get unique id base on a set.
 */
export const getUniqueId = set => {
  let id

  do {
    id = getId()
  } while (set.has(id))
  set.add(id)

  return id
}

/**
 * translate marked text to html
 * ex: `###hello **world|**` =>
 * `
 *   <a href="#" class="hidden">###</a>hello <a href="#" class="gray">**</a>world<a href="#" class="gray">
 * `
 * `|` is the cursor position in marked test
 */
export const markedText2Html = (markedText, positionState) => {
  const chunks = getMarkedChunks(markedText)
  let result = markedText

  if (chunks.length > 0) {
    const chunksWithHtml = chunks.map(c => {
      const html = chunk2html(c, positionState)
      return Object.assign(c, { html })
    })
    // does this will have bug ?
    chunksWithHtml.forEach(c => {
      result = result.replace(c.chunk, c.html)
    })
  }

  return result
}

/**
 * check markedTextUpdate
 */

export const checkMarkedTextUpdate = (html, markedText, { start, end }) => {
  if (/gray/.test(html)) return true

  const chunks = getMarkedChunks(markedText)
  const len = chunks.length
  const textLen = markedText.length
  let i

  for (i = 0; i < len; i++) {
    const { index, lastIndex } = chunks[i]
    if (conflict([Math.max(0, index - 1), Math.min(textLen, lastIndex + 1)], [start, end])) {
      return true
    }
  }

  return false
}

/**
 * check edit emoji
 */

export const checkEditEmoji = (event, node) => {
  const { type } = event
  if (type === 'click') return false
  const preSibling = node.previousElementSibling
  if (
    node.classList.contains(EMOJI_MARKED_TEXT) ||
    (preSibling && preSibling.classList.contains(EMOJI_MARKED_TEXT))
  ) {
    return true
  }
  return false
}

export const setInlineEmoji = (node, emoji, selection) => {
  node.textContent = `${emoji.aliases[0]}`
  node.setAttribute('data-emoji', emoji.emoji)
  selection.moveCursor(node.nextElementSibling, 1)
}

export const throttle = fn => {
  let timer = null
  return (...args) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      fn(...args)
    }, 300)
  }
}

/**
 * checkInlineUpdate
 */
export const checkInlineUpdate = text => {
  const token = text.match(INLINE_BLOCK_REG)
  if (!token) return false
  const match = token[0]
  switch (true) {
    case /^[*+-]\s/.test(match):
      return token[1] ? { type: LOWERCASE_TAGS.li, info: 'tasklist' } : { type: LOWERCASE_TAGS.li, info: 'disorder' }
    case /^\d+\.\s/.test(match):
      return { type: LOWERCASE_TAGS.li, info: 'order' }
    case /^#{1,6}/.test(match):
      return { type: `h${token[2].length}` }
    case /^>/.test(match):
      return { type: LOWERCASE_TAGS.blockquote }
    default:
      return false
  }
}

export const checkLineBreakUpdate = text => {
  const token = text.match(LINE_BREAK_BLOCK_REG)
  if (!token) return false
  const match = token[0]

  switch (true) {
    case /`{3,}.*/.test(match):
      return { type: 'pre', info: token[1] }
    default:
      return false
  }
}

export const html2element = html => {
  const wrapper = document.createElement('div')
  wrapper.innerHTML = html
  const children = wrapper.children

  if (children.length > 1) {
    throw new Error(`[${html}] must has one ancestor`)
  }

  return children[0]
}

export const updateBlock = (origin, tagName) => {
  const json = html2json(origin.outerHTML)

  json.child[0].tag = tagName
  if (/^h/.test(tagName)) {
    json.child[0].attr['data-head-level'] = tagName
  }
  const html = json2html(json)
  const newElement = html2element(html)
  replaceElement(origin, newElement)
  return newElement
}

export const chopHeader = markedText => {
  return markedText.replace(CHOP_HEADER_REG, '')
}

// DOM operations
export const insertAfter = (newNode, originNode) => {
  const parentNode = originNode.parentNode

  if (originNode.nextSibling) {
    parentNode.insertBefore(newNode, originNode.nextSibling)
  } else {
    parentNode.appendChild(newNode)
  }
}

export const insertBefore = (newNode, originNode) => {
  const parentNode = originNode.parentNode

  parentNode.insertBefore(newNode, originNode)
}

export const replaceElement = (origin, alt) => {
  const parentNode = origin.parentNode

  parentNode.insertBefore(alt, origin)
  parentNode.removeChild(origin)
}

export const createEmptyElement = (ids, tagName, attrs) => {
  const id = getUniqueId(ids)
  const element = document.createElement(tagName)

  element.innerHTML = '<br>'
  if (attrs) {
    Array.from(attrs).forEach(attr => {
      element.setAttribute(attr.name, attr.value)
    })
  }

  if (tagName === LOWERCASE_TAGS.li) {
    const pid = getUniqueId(ids)
    const p = document.createElement(LOWERCASE_TAGS.p)
    p.innerHTML = '<br>'
    operateClassName(p, 'add', paragraphClassName)
    p.id = pid
    element.innerHTML = p.outerHTML
  }
  operateClassName(element, 'add', paragraphClassName)
  element.id = id

  return element
}
// delete node
export const removeNode = node => {
  const parentNode = node.parentNode

  parentNode.removeChild(node)
}
// is firstChildElement
export const isFirstChildElement = node => {
  return !node.previousElementSibling
}

export const isOnlyChildElement = node => {
  return !node.previousElementSibling && !node.nextElementSibling
}

export const isLastChildElement = node => {
  return !node.nextElementSibling
}
// chop one blockQute into two
export const chopBlockQuote = (ids, node) => {
  const blockQuote = document.createElement('blockquote')
  const id = getUniqueId(ids)
  let nextSibling

  blockQuote.id = id
  operateClassName(blockQuote, 'add', paragraphClassName)

  do {
    nextSibling = node.nextElementSibling
    if (nextSibling) {
      blockQuote.appendChild(nextSibling.cloneNode(true))
      removeNode(nextSibling)
    }
  } while (nextSibling)

  insertAfter(blockQuote, node.parentNode)
}

export const wrapperElementWithTag = (ids, element, tagName) => {
  const wrapper = document.createElement(tagName)
  const id = getUniqueId(ids)

  operateClassName(wrapper, 'add', paragraphClassName)
  wrapper.id = id
  wrapper.innerHTML = element.outerHTML
  replaceElement(element, wrapper)

  return wrapper
}

export const nestElementWithTag = (ids, element, tagName) => {
  const id = getUniqueId(ids)
  const wrapper = document.createElement(tagName)

  operateClassName(wrapper, 'add', paragraphClassName)
  wrapper.id = id
  wrapper.innerHTML = element.innerHTML || '<br>'
  element.innerHTML = wrapper.outerHTML

  return element
}

/**
 * [description `add` or `remove` className of element
 */
export const operateClassName = (element, ctrl, className) => {
  const containClassName = element.classList.contains(className)
  const needOperation = ctrl === 'add' ? !containClassName : containClassName

  return needOperation && element.classList[ctrl](className)
}

export const findNearestParagraph = node => {
  do {
    if (isAganippeParagraph(node)) return node
    node = node.parentNode
  } while (node)
}

export const isBlockContainer = element => {
  return element && element.nodeType !== 3 &&
  blockContainerElementNames.indexOf(element.nodeName.toLowerCase()) !== -1
}

export const isAganippeEditorElement = element => {
  return element && element.getAttribute && !!element.getAttribute(EDITOR_ATTR_NAME)
}

export const isAganippeParagraph = element => {
  return element && element.classList && element.classList.contains(paragraphClassName)
}

export const traverseUp = (current, testElementFunction) => {
  if (!current) {
    return false
  }

  do {
    if (current.nodeType === 1) {
      if (testElementFunction(current)) {
        return current
      }
      // do not traverse upwards past the nearest containing editor
      if (isAganippeEditorElement(current)) {
        return false
      }
    }

    current = current.parentNode
  } while (current)

  return false
}

export const getFirstSelectableLeafNode = element => {
  while (element && element.firstChild) {
    element = element.firstChild
  }

  // We don't want to set the selection to an element that can't have children, this messes up Gecko.
  element = traverseUp(element, el => {
    return emptyElementNames.indexOf(el.nodeName.toLowerCase()) === -1
  })
  // Selecting at the beginning of a table doesn't work in PhantomJS.
  if (element.nodeName.toLowerCase() === LOWERCASE_TAGS.table) {
    const firstCell = element.querySelector('th, td')
    if (firstCell) {
      element = firstCell
    }
  }
  return element
}

export const isElementAtBeginningOfBlock = node => {
  let textVal
  let sibling
  while (!isBlockContainer(node) && !isAganippeEditorElement(node)) {
    sibling = node.previousSibling
    while (sibling) {
      textVal = sibling.nodeType === 3 ? sibling.nodeValue : sibling.textContent
      if (textVal.length > 0) {
        return false
      }
      sibling = sibling.previousSibling
    }
    node = node.parentNode
  }
  return true
}

export const findPreviousSibling = node => {
  if (!node || isAganippeEditorElement(node)) {
    return false
  }

  var previousSibling = node.previousSibling
  while (!previousSibling && !isAganippeEditorElement(node.parentNode)) {
    node = node.parentNode
    previousSibling = node.previousSibling
  }

  return previousSibling
}

export const getClosestBlockContainer = node => {
  return traverseUp(node, node => {
    return isBlockContainer(node) || isAganippeEditorElement(node)
  })
}

export const getCursorPositionWithinMarkedText = (markedText, cursorOffset) => {
  const chunks = []
  let match
  let result = { type: 'OUT' }

  do {
    match = CHOP_TEXT_REG.exec(markedText)
    if (match) {
      chunks.push({
        index: match.index + match[1].length,
        leftSymbol: match[1],
        rightSymbol: match[3],
        lastIndex: CHOP_TEXT_REG.lastIndex - match[3].length
      })
    }
  } while (match)

  chunks.forEach(chunk => {
    const { index, leftSymbol, rightSymbol, lastIndex } = chunk
    if (cursorOffset > index && cursorOffset < lastIndex) {
      result = { type: 'IN', info: leftSymbol } // rightSymbol is also ok
    } else if (cursorOffset === index) {
      result = { type: 'LEFT', info: leftSymbol.length }
    } else if (cursorOffset === lastIndex) {
      result = { type: 'RIGHT', info: rightSymbol.length }
    }
  })
  return result
}
