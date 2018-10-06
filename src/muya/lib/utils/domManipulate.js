import {
  CLASS_OR_ID
} from '../config'

/**
 * [description `add` or `remove` className of element
 */
export const operateClassName = (element, ctrl, className) => {
  element.classList[ctrl](className)
}

// dom operation
export const createInputInCodeBlock = codeEle => {
  const inputInCodeFence = document.createElement('input')
  operateClassName(inputInCodeFence, 'add', CLASS_OR_ID['AG_LANGUAGE_INPUT'])
  inputInCodeFence.setAttribute('placeholder', 'Select language...')
  codeEle.appendChild(inputInCodeFence)

  return inputInCodeFence
}

export const insertBefore = (newNode, originNode) => {
  const parentNode = originNode.parentNode
  parentNode.insertBefore(newNode, originNode)
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
