import {
  markedSymbol,
  emptyElementNames,
  paragraphClassName,
  blockContainerElementNames
} from './config.js'

import { html2json, json2html } from 'html2json'

/**
 * RegExp constants
 */
const HEAD_REG = /^(#{1,6})([^#]*)$/g
const EMPHASIZE_REG_G = /(\*{1,3})([^*]+)(\1)/g
const EMPHASIZE_REG = /(\*{1,3})([^*]+)(\1)/
const LINE_BREAK_BLOCK_REG = /^(?:`{3,}(.*))/
const INLINE_BLOCK_REG = /^(?:[*+-]\s(\[\s\]\s)?|\d+\.\s|(#{1,6})[^#]+|>\s)/

/**
 * help functions
 */
const conflict = (arr1, arr2) => {
  // Are two arraies have intersection
  return !(arr1[1] < arr2[0] || arr2[1] < arr1[0])
}
const getId = () => {
  const prefix = 'ag-'
  return `${prefix}${Math.random().toString(32).slice(2)}`
}
/**
 * get unique id name
 */
export const getUniqueId = set => {
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
export const markedText2Html = (markedText, { start, end }) => {
  let result = markedText
  // handle head mark symble
  if (HEAD_REG.test(markedText)) {
    result = result.replace(HEAD_REG, (match, p1, p2, offset) => {
      const isConflicted = conflict([offset, offset + p1.length], [start, end])
      const className = isConflicted ? 'gray' : 'hidden'
      return `<a href="#" class="${className}">${p1}</a>${p2}`
    })
  }
  // handle emphasize
  if (EMPHASIZE_REG.test(markedText)) {
    result = result.replace(EMPHASIZE_REG_G, (match, p1, p2, p3, offset) => {
      const isConflicted = conflict([offset, offset + match.length], [start, end])
      const className = isConflicted ? 'gray' : 'hidden'
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
      return `<a href="#" class="${className}">${p1}</a>${startTags}${p2}${endTags}<a href="#" class="${className}">${p3}</a>`
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
 * check input marked html
 */
export const checkInputMarkedSymbol = key => {
  return markedSymbol.indexOf(key) > -1
}

/**
 * checkInlineUpdate
 */
export const checkInlineUpdate = text => {
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

export const replaceElement = (origin, alt) => {
  const parentNode = origin.parentNode
  parentNode.insertBefore(alt, origin)
  parentNode.removeChild(origin)
}

export const updateBlock = (origin, tagName) => {
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

export const paragraph2Element = paph => {
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

export const viewModel2Html = vm => {
  const htmls = vm.map(p => paragraph2Element(p).outerHTML)
  return htmls.join('\n')
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
  return element && element.getAttribute && !!element.getAttribute('aganippe-editor-element')
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
  if (element.nodeName.toLowerCase() === 'table') {
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
