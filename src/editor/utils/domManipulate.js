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

export const findOutMostParagraph = node => {
  do {
    let parentNode = node.parentNode
    if (isAganippeEditorElement(parentNode) && isAganippeParagraph(node)) return node
    node = parentNode
  } while (node)
}

export const isBlockContainer = element => {
  return element && element.nodeType !== 3 &&
  blockContainerElementNames.indexOf(element.nodeName.toLowerCase()) !== -1
}

export const isAganippeEditorElement = element => {
  return element && element.getAttribute && !!element.id === (CLASS_OR_ID['AG_EDITOR_ID'])
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

export const replaceElement = (newNode, oldNode) => {
  const parentNode = oldNode.parentNode

  parentNode.replaceChild(newNode, oldNode) // return oldNode
  return newNode
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
  return replaceElement(wrapper, element)
}

// export const deWrapperElement = element => {
//   const parentNode = element.parentNode
//   const copy = element.cloneNode(true)
//   return replaceElement(copy, parentNode)
// }
/**
 * `<ul><li><p>hello</p><p>world</p></li></ul>` => `<p>hello</p><p>world</p>`
 */
export const replacementLists = element => {
  const parentNode = element.parentNode
  const children = parentNode.children
  let firstCopy
  Array.from(children).forEach(child => {
    const copy = child.cloneNode(true)
    if (element === child) firstCopy = copy
    insertBefore(copy, parentNode.parentNode)
  })
  removeNode(parentNode.parentNode)
  return firstCopy
}
/**
 * `<ul><li><p>hello</p></li><li><p>jocs</p></li></ul>` => `<p>hello</p><ul><li><p>jocs</p></li></ul>`
 */
export const removeAndInsertBefore = element => {
  const parentNode = element.parentNode // li
  const children = parentNode.children
  let firstCopy
  Array.from(children).forEach((child, i) => {
    const copy = child.cloneNode(true)
    if (i === 0) firstCopy = copy
    insertBefore(copy, parentNode.parentNode)
  })
  removeNode(parentNode)

  return firstCopy
}
/**
 * `
 *  <ul>
 *    <li><p>hello</p></li>
 *    <li><p>world</p></li>
 *  </ul>
 * ` =>
 * `
 *  <ul>
 *    <li>
 *        <p>hello</p>
 *        <p>world</p>
 *    </li>
 *  </ul>
 * `
 */
export const removeAndInsertPreList = element => {
  const previousSibling = element.parentNode.previousElementSibling
  const children = element.parentNode.children
  let firstCopy
  Array.from(children).forEach((child, i) => {
    const copy = child.cloneNode(true)
    if (i === 0) firstCopy = copy
    previousSibling.appendChild(copy)
  })
  removeNode(element.parentNode)
  return firstCopy
}

export const insertBeforeBlockQuote = element => {
  const copy = element.cloneNode(true)
  insertBefore(copy, element.parentNode)
  removeNode(element)
  return copy
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

export const createInputInCodeBlock = codeEle => {
  const input = document.createElement('input')
  operateClassName(input, 'add', CLASS_OR_ID['AG_LANGUAGE_INPUT'])
  operateClassName(input, 'add', CLASS_OR_ID['mousetrap'])
  codeEle.appendChild(input)
  return input
}

export const isCodeBlockParagraph = paragraph => {
  return paragraph && paragraph.classList.contains(CLASS_OR_ID['AG_CODE_BLOCK'])
}

export const hr2P = (paragraph, selection) => {
  const tagName = paragraph.tagName.toLowerCase()
  if (tagName !== LOWERCASE_TAGS.hr) {
    return console.warn(`${tagName} is not a HR element.`)
  }
  const newElement = updateBlock(paragraph, LOWERCASE_TAGS.p)
  newElement.textContent = '---'
  selection.importSelection({
    start: 3,
    end: 3
  }, newElement)
  return newElement
}

// use the same id.
export const updateBlock = (origin, tagName) => {
  const json = html2json(origin.outerHTML)

  json.child[0].tag = tagName
  if (/^h\d$/.test(tagName)) {
    json.child[0].attr['data-head-level'] = tagName
  } else if (json.child[0].attr['data-head-level']) {
    delete json.child[0].attr['data-head-level']
  }
  const html = json2html(json)
  const newElement = html2element(html)
  return replaceElement(newElement, origin)
}
