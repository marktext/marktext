import {
  LOWERCASE_TAGS, CLASS_OR_ID, blockContainerElementNames, emptyElementNames
} from '../config'

const CHOP_TEXT_REG = /(\*{1,3})([^*]+)(\1)/g

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
  return element && element.id === CLASS_OR_ID['AG_EDITOR_ID']
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

// dom operation
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

// DOM operations
export const insertAfter = (newNode, originNode) => {
  const parentNode = originNode.parentNode

  if (originNode.nextSibling) {
    parentNode.insertBefore(newNode, originNode.nextSibling)
  } else {
    parentNode.appendChild(newNode)
  }
}
