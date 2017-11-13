/**
 * Module Dependencies
 */

import iterator from 'dom-iterator'
const selection = window.getSelection()

/**
 * Get or set cursor, selection, relative to
 * an element.
 *
 * @param  {Element} el
 * @param  {Object} pos selection range
 * @return {Object|Undefined}
 */

function position (el, pos) {
  console.log(el)
  /**
   * Get cursor or selection position
   */

  if (arguments.length === 1) {
    if (!selection.rangeCount) return
    const indexes = {}
    const range = selection.getRangeAt(0)
    const clone = range.cloneRange()
    clone.selectNodeContents(el)
    clone.setEnd(range.endContainer, range.endOffset)
    indexes.end = clone.toString().length
    clone.setStart(range.startContainer, range.startOffset)
    indexes.start = indexes.end - clone.toString().length
    indexes.atStart = clone.startOffset === 0
    indexes.commonAncestorContainer = clone.commonAncestorContainer
    indexes.endContainer = clone.endContainer
    indexes.startContainer = clone.startContainer
    return indexes
  }

  /**
   * Set cursor or selection position
   */

  const setSelection = pos.end && (pos.end !== pos.start)
  let length = 0
  const range = document.createRange()
  const it = iterator(el).select(Node.TEXT_NODE).revisit(false)
  let next = it.next()
  let startindex
  let start = pos.start > el.textContent.length ? el.textContent.length : pos.start
  let end = pos.end > el.textContent.length ? el.textContent.length : pos.end
  let atStart = pos.atStart

  while (next) {
    const olen = length
    length += next.textContent.length
    console.log(next, length, start)
    // Set start point of selection
    const atLength = atStart ? length > start : length >= start
    if (!startindex && atLength) {
      startindex = true
      range.setStart(next, start - olen)
      if (!setSelection) {
        range.collapse(true)
        makeSelection(el, range)
        break
      }
    }

    // Set end point of selection
    if (setSelection && (length >= end)) {
      range.setEnd(next, end - olen)
      makeSelection(el, range)
      break
    }
    next = it.next()
  }
}

/**
 * add selection / insert cursor.
 *
 * @param  {Element} el
 * @param  {Range} range
 */

function makeSelection (el, range) {
  el.focus()
  selection.removeAllRanges()
  selection.addRange(range)
}

export default position
