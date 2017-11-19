import { html2json, json2html } from 'html2json'
import { getUniqueId } from './index'
import {
  LOWERCASE_TAGS, CLASS_OR_ID, blockContainerElementNames, emptyElementNames
} from '../config'

const CHOP_TEXT_REG = /(\*{1,3})([^*]+)(\1)/g

const html2element = html => {
  const wrapper = document.createElement('div')
  wrapper.innerHTML = html
  const children = wrapper.children

  if (children.length > 1) {
    throw new Error(`[${html}] must has one ancestor`)
  }

  return children[0]
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
  return element && element.getAttribute && !!element.getAttribute(CLASS_OR_ID['AG_EDITOR_ATTR'])
}

export const isAganippeParagraph = element => {
  return element && element.classList && element.classList.contains(CLASS_OR_ID['AG_PARAGRAPH'])
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

export const replaceElement = (oldNode, newNode) => {
  const parentNode = oldNode.parentNode

  return parentNode.replaceChild(newNode, oldNode) // return oldNode
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
    operateClassName(p, 'add', CLASS_OR_ID['AG_PARAGRAPH'])
    p.id = pid
    element.innerHTML = p.outerHTML
  }
  operateClassName(element, 'add', CLASS_OR_ID['AG_PARAGRAPH'])
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
  const blockQuote = document.createElement(LOWERCASE_TAGS.blockquote)
  const id = getUniqueId(ids)
  let nextSibling

  blockQuote.id = id
  operateClassName(blockQuote, 'add', CLASS_OR_ID['AG_PARAGRAPH'])

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

  operateClassName(wrapper, 'add', CLASS_OR_ID['AG_PARAGRAPH'])
  wrapper.id = id
  wrapper.innerHTML = element.outerHTML
  replaceElement(element, wrapper)

  return wrapper
}

export const nestElementWithTag = (ids, element, tagName) => {
  const id = getUniqueId(ids)
  const wrapper = document.createElement(tagName)

  operateClassName(wrapper, 'add', CLASS_OR_ID['AG_PARAGRAPH'])
  wrapper.id = id
  wrapper.innerHTML = element.innerHTML || '<br>'
  element.innerHTML = wrapper.outerHTML

  return element
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
