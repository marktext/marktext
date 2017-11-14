import {
  emptyElementNames,
  paragraphClassName,
  blockContainerElementNames
} from './config.js'

import { html2json, json2html } from 'html2json'

/**
 * RegExp constants
 */
const HEAD_REG = /^(#{1,6})(.+)$/
const EMPHASIZE_REG_G = /(\*{1,3})(.*)(\1)/g
const EMPHASIZE_REG = /(\*{1,3})(.*)(\1)/
const LINE_BREAK_BLOCK_REG = /^(?:`{3,}(.*))/
const INLINE_BLOCK_REG = /^(?:[*+-]\s(\[\s\]\s)?|\d+\.\s|(#{1,6})[^#]+|>\s)/

/**
 * help functions
 */
const conflict = (arr1, arr2) => {
  // Are two array have intersection
  return !(arr1[1] < arr2[0] || arr2[1] < arr1[0])
}
const getId = () => {
  const prefix = 'ag-'
  return `${prefix}${Math.random().toString(32).slice(2)}`
}
/**
 * get unique id name
 */
const getUniqueId = set => {
  let id = getId()
  while (set.has(id)) {
    id = getId()
  }
  set.add(id)
  return id
}

/**
 * markedText to html
 */
const markedText2Html = (markedText, cursorRange) => {
  let result = markedText
  // handle head mark symble
  if (HEAD_REG.test(markedText)) {
    result = markedText.replace(HEAD_REG, '<span class="gray">$1</span>$2')
  }
  // handle emphasize
  if (EMPHASIZE_REG.test(markedText)) {
    const offset = markedText.match(EMPHASIZE_REG).index
    result = result.replace(EMPHASIZE_REG_G, (match, p1, p2, p3) => {
      const isConflicted = conflict([offset, offset + match.length], cursorRange)
      const className = isConflicted ? 'gray' : 'hidden'
      const tags = { startTags: '', endTags: '' }
      switch (p1.length) {
        case 1:
          tags.startTags = '<em>'
          tags.endTags = '</em>'
          break
        case 2:
          tags.startTags = '<strong>'
          tags.endTags = '</strong>'
          break
        case 3:
          tags.startTags = '<strong><em>'
          tags.endTags = '</em></strong>'
      }
      const { startTags, endTags } = tags
      return `<span class="${className}">${p1}</span>${startTags}${p2}${endTags}<span class="${className}">${p2}</span>`
    })
  }
  // handle link
  // TODO
  // handle picture
  // TODO
  // handle code
  // TODO
  // handle auto link
  // TODO
  return result
}
/**
 * checkInlineUpdate
 */

const checkInlineUpdate = text => {
  const token = text.match(INLINE_BLOCK_REG)
  if (!token) return false
  const match = token[0]
  switch (true) {
    case /[*+-]\s/.test(match):
      return token[1] ? { type: 'ul', info: 'tasklist' } : { type: 'ul', info: 'disorder' }
    case /\d+\.\s/.test(match):
      return { type: 'ol' }
    case /#{1,6}/.test(match):
      return { type: `h${token[2].length}` }
    case />\s/.test(match):
      return { type: 'blockquote' }
    default:
      return false
  }
}

const checkLineBreakUpdate = text => {
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

const html2element = html => {
  const wrapper = document.createElement('div')
  wrapper.innerHTML = html
  const children = wrapper.children
  if (children.length > 1) {
    throw new Error(`[${html}] must has one ancestor`)
  }
  return children[0]
}

const replaceElement = (origin, alt) => {
  const parentNode = origin.parentNode
  parentNode.insertBefore(alt, origin)
  parentNode.removeChild(origin)
}

const updateBlock = (origin, tagName) => {
  const json = html2json(origin.outerHTML)
  json.child[0].tag = tagName
  const html = json2html(json)
  replaceElement(origin, html2element(html))
}

/**
 * translate paragraph to ohter block
 */

/**
 * viewModel2Html
 */

const paragraph2Element = paph => {
  const { id, paragraphType, markedText, cursorRange } = paph
  let element = null
  switch (paragraphType) {
    case 'p':
      element = document.createElement('p')
      element.id = id
      element.classList.add(paragraphClassName)
      element.innerHTML = markedText2Html(markedText, cursorRange)
      break
    default: break
  }
  element.id = id
  return element
}

const viewModel2Html = vm => {
  const htmls = vm.map(p => paragraph2Element(p).outerHTML)
  return htmls.join('\n')
}

const findNearestParagraph = node => {
  do {
    if (isAganippeParagraph(node)) return node
    node = node.parentNode
  } while (node)
}

const isBlockContainer = element => {
  return element && element.nodeType !== 3 &&
  blockContainerElementNames.indexOf(element.nodeName.toLowerCase()) !== -1
}

const isAganippeEditorElement = element => {
  return element && element.getAttribute && !!element.getAttribute('aganippe-editor-element')
}

const isAganippeParagraph = element => {
  return element && element.classList && element.classList.contains(paragraphClassName)
}

const traverseUp = (current, testElementFunction) => {
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

const getFirstSelectableLeafNode = element => {
  while (element && element.firstChild) {
    element = element.firstChild
  }

  // We don't want to set the selection to an element that can't have children, this messes up Gecko.
  element = traverseUp(element, el => {
    return emptyElementNames.indexOf(el.nodeName.toLowerCase()) === -1
  })
  // Selecting at the beginning of a table doesn't work in PhantomJS.
  if (element.nodeName.toLowerCase() === 'table') {
    const firstCell = element.querySelector('th, td')
    if (firstCell) {
      element = firstCell
    }
  }
  return element
}

const isElementAtBeginningOfBlock = node => {
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

const findPreviousSibling = node => {
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

const getClosestBlockContainer = node => {
  return traverseUp(node, node => {
    return isBlockContainer(node) || isAganippeEditorElement(node)
  })
}

export {
  updateBlock,
  getUniqueId,
  markedText2Html,
  checkInlineUpdate,
  checkLineBreakUpdate,
  viewModel2Html,
  paragraph2Element,
  findNearestParagraph,
  isBlockContainer,
  traverseUp,
  isAganippeEditorElement,
  isElementAtBeginningOfBlock,
  getFirstSelectableLeafNode,
  findPreviousSibling,
  getClosestBlockContainer
}
