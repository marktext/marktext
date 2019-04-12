/**
 * This file is copy from [medium-editor](https://github.com/yabwe/medium-editor)
 * and customize for specialized use.
 */
import {
  isBlockContainer,
  traverseUp,
  getFirstSelectableLeafNode,
  getClosestBlockContainer,
  getCursorPositionWithinMarkedText,
  compareParagraphsOrder,
  findNearestParagraph,
  getTextContent
} from './dom'

import { CLASS_OR_ID } from '../config'

const filterOnlyParentElements = node => {
  return isBlockContainer(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
}

class Selection {
  constructor (doc) {
    this.doc = doc // document
  }

  findMatchingSelectionParent (testElementFunction, contentWindow) {
    const selection = contentWindow.getSelection()
    let range
    let current

    if (selection.rangeCount === 0) {
      return false
    }

    range = selection.getRangeAt(0)
    current = range.commonAncestorContainer

    return traverseUp(current, testElementFunction)
  }

  // https://stackoverflow.com/questions/17678843/cant-restore-selection-after-html-modify-even-if-its-the-same-html
  // Tim Down
  //
  // {object} selectionState - the selection to import
  // {DOMElement} root - the root element the selection is being restored inside of
  // {boolean} [favorLaterSelectionAnchor] - defaults to false. If true, import the cursor immediately
  //      subsequent to an anchor tag if it would otherwise be placed right at the trailing edge inside the
  //      anchor. This cursor positioning, even though visually equivalent to the user, can affect behavior
  //      in MS IE.
  importSelection (selectionState, root, favorLaterSelectionAnchor) {
    if (!selectionState || !root) {
      throw new Error('your must provide a [selectionState] and a [root] element')
    }

    let range = this.doc.createRange()
    range.setStart(root, 0)
    range.collapse(true)

    let node = root
    const nodeStack = []
    let charIndex = 0
    let foundStart = false
    let foundEnd = false
    let trailingImageCount = 0
    let stop = false
    let nextCharIndex
    let allowRangeToStartAtEndOfNode = false
    let lastTextNode = null

    // When importing selection, the start of the selection may lie at the end of an element
    // or at the beginning of an element.  Since visually there is no difference between these 2
    // we will try to move the selection to the beginning of an element since this is generally
    // what users will expect and it's a more predictable behavior.
    //
    // However, there are some specific cases when we don't want to do this:
    //  1) We're attempting to move the cursor outside of the end of an anchor [favorLaterSelectionAnchor = true]
    //  2) The selection starts with an image, which is special since an image doesn't have any 'content'
    //     as far as selection and ranges are concerned
    //  3) The selection starts after a specified number of empty block elements (selectionState.emptyBlocksIndex)
    //
    // For these cases, we want the selection to start at a very specific location, so we should NOT
    // automatically move the cursor to the beginning of the first actual chunk of text
    if (favorLaterSelectionAnchor || selectionState.startsWithImage || typeof selectionState.emptyBlocksIndex !== 'undefined') {
      allowRangeToStartAtEndOfNode = true
    }

    while (!stop && node) {
      // Only iterate over elements and text nodes
      if (node.nodeType > 3) {
        node = nodeStack.pop()
        continue
      }

      // If we hit a text node, we need to add the amount of characters to the overall count
      if (node.nodeType === 3 && !foundEnd) {
        nextCharIndex = charIndex + node.length
        // Check if we're at or beyond the start of the selection we're importing
        if (!foundStart && selectionState.start >= charIndex && selectionState.start <= nextCharIndex) {
          // NOTE: We only want to allow a selection to start at the END of an element if
          //  allowRangeToStartAtEndOfNode is true
          if (allowRangeToStartAtEndOfNode || selectionState.start < nextCharIndex) {
            range.setStart(node, selectionState.start - charIndex)
            foundStart = true
          } else {
            // We're at the end of a text node where the selection could start but we shouldn't
            // make the selection start here because allowRangeToStartAtEndOfNode is false.
            // However, we should keep a reference to this node in case there aren't any more
            // text nodes after this, so that we have somewhere to import the selection to
            lastTextNode = node
          }
        }
        // We've found the start of the selection, check if we're at or beyond the end of the selection we're importing
        if (foundStart && selectionState.end >= charIndex && selectionState.end <= nextCharIndex) {
          if (!selectionState.trailingImageCount) {
            range.setEnd(node, selectionState.end - charIndex)
            stop = true
          } else {
            foundEnd = true
          }
        }
        charIndex = nextCharIndex
      } else {
        if (selectionState.trailingImageCount && foundEnd) {
          if (node.nodeName.toLowerCase() === 'img') {
            trailingImageCount++
          }
          if (trailingImageCount === selectionState.trailingImageCount) {
            // Find which index the image is in its parent's children
            let endIndex = 0
            while (node.parentNode.childNodes[endIndex] !== node) {
              endIndex++
            }
            range.setEnd(node.parentNode, endIndex + 1)
            stop = true
          }
        }

        if (!stop && node.nodeType === 1) {
          // this is an element
          // add all its children to the stack
          let i = node.childNodes.length - 1
          while (i >= 0) {
            nodeStack.push(node.childNodes[i])
            i -= 1
          }
        }
      }

      if (!stop) {
        node = nodeStack.pop()
      }
    }

    // If we've gone through the entire text but didn't find the beginning of a text node
    // to make the selection start at, we should fall back to starting the selection
    // at the END of the last text node we found
    if (!foundStart && lastTextNode) {
      range.setStart(lastTextNode, lastTextNode.length)
      range.setEnd(lastTextNode, lastTextNode.length)
    }

    if (typeof selectionState.emptyBlocksIndex !== 'undefined') {
      range = this.importSelectionMoveCursorPastBlocks(root, selectionState.emptyBlocksIndex, range)
    }

    // If the selection is right at the ending edge of a link, put it outside the anchor tag instead of inside.
    if (favorLaterSelectionAnchor) {
      range = this.importSelectionMoveCursorPastAnchor(selectionState, range)
    }

    this.selectRange(range)
  }

  // Utility method called from importSelection only
  importSelectionMoveCursorPastAnchor (selectionState, range) {
    const nodeInsideAnchorTagFunction = function (node) {
      return node.nodeName.toLowerCase() === 'a'
    }
    if (selectionState.start === selectionState.end &&
      range.startContainer.nodeType === 3 &&
      range.startOffset === range.startContainer.nodeValue.length &&
      traverseUp(range.startContainer, nodeInsideAnchorTagFunction)) {
      let prevNode = range.startContainer
      let currentNode = range.startContainer.parentNode
      while (currentNode !== null && currentNode.nodeName.toLowerCase() !== 'a') {
        if (currentNode.childNodes[currentNode.childNodes.length - 1] !== prevNode) {
          currentNode = null
        } else {
          prevNode = currentNode
          currentNode = currentNode.parentNode
        }
      }
      if (currentNode !== null && currentNode.nodeName.toLowerCase() === 'a') {
        let currentNodeIndex = null
        for (let i = 0; currentNodeIndex === null && i < currentNode.parentNode.childNodes.length; i++) {
          if (currentNode.parentNode.childNodes[i] === currentNode) {
            currentNodeIndex = i
          }
        }
        range.setStart(currentNode.parentNode, currentNodeIndex + 1)
        range.collapse(true)
      }
    }
    return range
  }

  // Uses the emptyBlocksIndex calculated by getIndexRelativeToAdjacentEmptyBlocks
  // to move the cursor back to the start of the correct paragraph
  importSelectionMoveCursorPastBlocks (root, index = 1, range) {
    const treeWalker = this.doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, filterOnlyParentElements, false)
    let startContainer = range.startContainer
    let startBlock
    let targetNode
    let currIndex = 0
    // If index is 0, we still want to move to the next block

    // Chrome counts newlines and spaces that separate block elements as actual elements.
    // If the selection is inside one of these text nodes, and it has a previous sibling
    // which is a block element, we want the treewalker to start at the previous sibling
    // and NOT at the parent of the textnode
    if (startContainer.nodeType === 3 && isBlockContainer(startContainer.previousSibling)) {
      startBlock = startContainer.previousSibling
    } else {
      startBlock = getClosestBlockContainer(startContainer)
    }

    // Skip over empty blocks until we hit the block we want the selection to be in
    while (treeWalker.nextNode()) {
      if (!targetNode) {
        // Loop through all blocks until we hit the starting block element
        if (startBlock === treeWalker.currentNode) {
          targetNode = treeWalker.currentNode
        }
      } else {
        targetNode = treeWalker.currentNode
        currIndex++
        // We hit the target index, bail
        if (currIndex === index) {
          break
        }
        // If we find a non-empty block, ignore the emptyBlocksIndex and just put selection here
        if (targetNode.textContent.length > 0) {
          break
        }
      }
    }

    if (!targetNode) {
      targetNode = startBlock
    }

    // We're selecting a high-level block node, so make sure the cursor gets moved into the deepest
    // element at the beginning of the block
    range.setStart(getFirstSelectableLeafNode(targetNode), 0)

    return range
  }

  // https://stackoverflow.com/questions/4176923/html-of-selected-text
  // by Tim Down
  getSelectionHtml () {
    const sel = this.doc.getSelection()
    let i
    let html = ''
    let len
    let container
    if (sel.rangeCount) {
      container = this.doc.createElement('div')
      for (i = 0, len = sel.rangeCount; i < len; i += 1) {
        container.appendChild(sel.getRangeAt(i).cloneContents())
      }
      html = container.innerHTML
    }
    return html
  }

  chopHtmlByCursor (root) {
    const { left } = this.getCaretOffsets(root)
    const markedText = root.textContent
    const { type, info } = getCursorPositionWithinMarkedText(markedText, left)
    let pre = markedText.slice(0, left)
    let post = markedText.slice(left)
    switch (type) {
      case 'OUT':
        return {
          pre,
          post
        }
      case 'IN':
        return {
          pre: `${pre}${info}`,
          post: `${info}${post}`
        }
      case 'LEFT':
        return {
          pre: markedText.slice(0, left - info),
          post: markedText.slice(left - info)
        }
      case 'RIGHT':
        return {
          pre: markedText.slice(0, left + info),
          post: markedText.slice(left + info)
        }
    }
  }

  /**
   *  Find the caret position within an element irrespective of any inline tags it may contain.
   *
   *  @param {DOMElement} An element containing the cursor to find offsets relative to.
   *  @param {Range} A Range representing cursor position. Will window.getSelection if none is passed.
   *  @return {Object} 'left' and 'right' attributes contain offsets from beginning and end of Element
   */
  getCaretOffsets (element, range) {
    let preCaretRange
    let postCaretRange

    if (!range) {
      range = window.getSelection().getRangeAt(0)
    }

    preCaretRange = range.cloneRange()
    postCaretRange = range.cloneRange()

    preCaretRange.selectNodeContents(element)
    preCaretRange.setEnd(range.endContainer, range.endOffset)

    postCaretRange.selectNodeContents(element)
    postCaretRange.setStart(range.endContainer, range.endOffset)

    return {
      left: preCaretRange.toString().length,
      right: postCaretRange.toString().length
    }
  }

  selectNode (node) {
    const range = this.doc.createRange()
    range.selectNodeContents(node)
    this.selectRange(range)
  }

  select (startNode, startOffset, endNode, endOffset) {
    const range = this.doc.createRange()
    range.setStart(startNode, startOffset)
    if (endNode) {
      range.setEnd(endNode, endOffset)
    } else {
      range.collapse(true)
    }
    this.selectRange(range)
    return range
  }

  /**
   *  Clear the current highlighted selection and set the caret to the start or the end of that prior selection, defaults to end.
   *
   *  @param {boolean} moveCursorToStart  A boolean representing whether or not to set the caret to the beginning of the prior selection.
   */
  clearSelection (moveCursorToStart) {
    const { rangeCount } = this.doc.getSelection()
    if (!rangeCount) return
    if (moveCursorToStart) {
      this.doc.getSelection().collapseToStart()
    } else {
      this.doc.getSelection().collapseToEnd()
    }
  }

  /**
   * Move cursor to the given node with the given offset.
   *
   * @param  {DomElement}  node    Element where to jump
   * @param  {integer}     offset  Where in the element should we jump, 0 by default
   */
  moveCursor (node, offset) {
    this.select(node, offset)
  }

  getSelectionRange () {
    const selection = this.doc.getSelection()
    if (selection.rangeCount === 0) {
      return null
    }
    return selection.getRangeAt(0)
  }

  selectRange (range) {
    const selection = this.doc.getSelection()

    selection.removeAllRanges()
    selection.addRange(range)
  }

  // https://stackoverflow.com/questions/1197401/
  // how-can-i-get-the-element-the-caret-is-in-with-javascript-when-using-contenteditable
  // by You
  getSelectionStart () {
    const node = this.doc.getSelection().anchorNode
    const startNode = (node && node.nodeType === 3 ? node.parentNode : node)

    return startNode
  }

  setCursorRange (cursorRange) {
    const { start, end } = cursorRange
    const startParagraph = document.querySelector(`#${start.key}`)
    const endParagraph = document.querySelector(`#${end.key}`)
    const getNodeAndOffset = (node, offset) => {
      if (node.nodeType === 3) {
        return {
          node,
          offset
        }
      }
      const childNodes = node.childNodes
      const len = childNodes.length
      let i
      let count = 0
      for (i = 0; i < len; i++) {
        const child = childNodes[i]
        if (child.classList && child.classList.contains(CLASS_OR_ID['AG_FRONT_ICON'])) continue
        if (count + getTextContent(child, [ CLASS_OR_ID['AG_MATH_RENDER'], CLASS_OR_ID['AG_RUBY_RENDER'] ]).length >= offset) {
          return getNodeAndOffset(child, offset - count)
        } else {
          count += getTextContent(child, [ CLASS_OR_ID['AG_MATH_RENDER'], CLASS_OR_ID['AG_RUBY_RENDER'] ]).length
        }
      }
      return { node, offset }
    }

    let { node: startNode, offset: startOffset } = getNodeAndOffset(startParagraph, start.offset)
    let { node: endNode, offset: endOffset } = getNodeAndOffset(endParagraph, end.offset)
    startOffset = Math.min(startOffset, startNode.textContent.length)
    endOffset = Math.min(endOffset, endNode.textContent.length)
    this.select(startNode, startOffset, endNode, endOffset)
  }

  getCursorRange () {
    let { anchorNode, anchorOffset, focusNode, focusOffset } = this.doc.getSelection()
    // when the first paragraph is task list, press ctrl + a, then press backspace will cause bug
    // use code bellow to fix the bug
    const findFirstTextNode = anchor => {
      if (anchor.nodeType === 3) return anchor
      // if it's a empty line, just return the span element.
      if (
        anchor.nodeType === 1 &&
        anchor.nodeName === 'SPAN' &&
        anchor.textContent === '' &&
        anchor.classList.contains('ag-line')
      ) {
        return anchor
      }
      const children = anchor.childNodes
      for (const node of children) {
        if (
          /input/i.test(node.nodeName) ||
          node.nodeType === 1 && node.getAttribute('contenteditable') === 'false'
        ) {
          continue
        }
        return findFirstTextNode(node)
      }
    }
    let needFix = false
    if (anchorNode.nodeName === 'LI') {
      needFix = true
      anchorNode = findFirstTextNode(anchorNode)
    }

    if (focusNode.nodeName === 'LI') {
      needFix = true
      focusNode = findFirstTextNode(focusNode)
    }

    let startParagraph = findNearestParagraph(anchorNode)
    let endParagraph = findNearestParagraph(focusNode)
    if (!startParagraph || !endParagraph) {
      return {
        start: null,
        end: null
      }
    }

    const getOffsetOfParagraph = (node, paragraph) => {
      let offset = 0
      let preSibling = node

      if (node === paragraph) return offset

      do {
        preSibling = preSibling.previousSibling
        if (preSibling) {
          offset += getTextContent(preSibling, [ CLASS_OR_ID['AG_MATH_RENDER'], CLASS_OR_ID['AG_RUBY_RENDER'] ]).length
        }
      } while (preSibling)
      return (node === paragraph || node.parentNode === paragraph)
        ? offset
        : offset + getOffsetOfParagraph(node.parentNode, paragraph)
    }

    let result = null

    if (startParagraph === endParagraph) {
      const key = startParagraph.id
      const offset1 = getOffsetOfParagraph(anchorNode, startParagraph) + anchorOffset
      const offset2 = getOffsetOfParagraph(focusNode, endParagraph) + focusOffset
      result = {
        start: { key, offset: Math.min(offset1, offset2) },
        end: { key, offset: Math.max(offset1, offset2) }
      }
    } else {
      const order = compareParagraphsOrder(startParagraph, endParagraph)

      const rawCursor = {
        start: {
          key: startParagraph.id,
          offset: getOffsetOfParagraph(anchorNode, startParagraph) + anchorOffset
        },
        end: {
          key: endParagraph.id,
          offset: getOffsetOfParagraph(focusNode, endParagraph) + focusOffset
        }
      }
      if (order) {
        result = rawCursor
      } else {
        result = { start: rawCursor.end, end: rawCursor.start }
      }
    }
    if (needFix) {
      this.setCursorRange(result)
    }
    return result
  }

  // topOffset is the line counts above cursor, and bottomOffset is line counts bellow cursor.
  getCursorYOffset (paragraph) {
    const { y } = this.getCursorCoords()
    const { height, top } = paragraph.getBoundingClientRect()
    const lineHeight = parseFloat(getComputedStyle(paragraph).lineHeight)
    const topOffset = Math.round((y - top) / lineHeight)
    const bottomOffset = Math.round((top + height - lineHeight - y) / lineHeight)

    return {
      topOffset,
      bottomOffset
    }
  }

  getCursorCoords () {
    const sel = this.doc.getSelection()
    let range
    let x = 0
    let y = 0

    if (sel.rangeCount) {
      range = sel.getRangeAt(0).cloneRange()
      if (range.getClientRects) {
        range.collapse(true)
        let rects = range.getClientRects()
        if (rects.length === 0) {
          rects = range.startContainer && range.startContainer.nodeType === Node.ELEMENT_NODE
            ? range.startContainer.getClientRects()
            : []
        }
        if (rects.length) {
          const { left, top, x: rectX, y: rectY } = rects[0]
          x = rectX || left
          y = rectY || top
        }
      }
    }

    return { x, y }
  }

  getSelectionEnd () {
    const node = this.doc.getSelection().focusNode
    const endNode = (node && node.nodeType === 3 ? node.parentNode : node)

    return endNode
  }
}

export default new Selection(document)
