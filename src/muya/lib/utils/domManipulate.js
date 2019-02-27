
/**
 * [description `add` or `remove` className of element
 */
export const operateClassName = (element, ctrl, className) => {
  element.classList[ctrl](className)
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
