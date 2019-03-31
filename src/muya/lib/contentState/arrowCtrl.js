import { EVENT_KEYS, CLASS_OR_ID } from '../config'
import { findNearestParagraph } from '../selection/dom'
import selection from '../selection'

const arrowCtrl = ContentState => {
  ContentState.prototype.findNextRowCell = function (cell) {
    if (!/th|td/.test(cell.type)) {
      throw new Error(`block with type ${cell && cell.type} is not a table cell`)
    }
    const row = this.getParent(cell)
    const rowContainer = this.getParent(row) // thead or tbody
    const column = row.children.indexOf(cell)
    if (rowContainer.type === 'thead') {
      const tbody = this.getNextSibling(rowContainer)
      if (tbody && tbody.children.length) {
        return tbody.children[0].children[column]
      }
    } else if (rowContainer.type === 'tbody') {
      const nextRow = this.getNextSibling(row)
      if (nextRow) {
        return nextRow.children[column]
      }
    }
    return null
  }

  ContentState.prototype.findPrevRowCell = function (cell) {
    if (!/th|td/.test(cell.type)) throw new Error(`block with type ${cell && cell.type} is not a table cell`)
    const row = this.getParent(cell)
    const rowContainer = this.getParent(row) // thead or tbody
    const rowIndex = rowContainer.children.indexOf(row)
    const column = row.children.indexOf(cell)
    if (rowContainer.type === 'tbody') {
      if (rowIndex === 0 && rowContainer.preSibling) {
        const thead = this.getPreSibling(rowContainer)
        return thead.children[0].children[column]
      } else if (rowIndex > 0) {
        return this.getPreSibling(row).children[column]
      }
      return null
    }
    return null
  }

  ContentState.prototype.arrowHandler = function (event) {
    const node = selection.getSelectionStart()
    const paragraph = findNearestParagraph(node)
    const id = paragraph.id
    const block = this.getBlock(id)
    const preBlock = this.findPreBlockInLocation(block)
    const nextBlock = this.findNextBlockInLocation(block)
    const { start, end } = selection.getCursorRange()
    const { topOffset, bottomOffset } = selection.getCursorYOffset(paragraph)
    if (!start || !end) {
      return
    }

    // fix #101
    if (event.key === EVENT_KEYS.ArrowRight && node && node.classList && node.classList.contains(CLASS_OR_ID['AG_MATH_TEXT'])) {
      const { right } = selection.getCaretOffsets(node)
      if (right === 0 && start.key === end.key && start.offset === end.offset) {
        // It's not recommended to use such lower API, but it's work well.
        return selection.select(node.parentNode.nextElementSibling, 0)
      }
    }

    // Just do nothing if the cursor is not collapsed
    if (
      (start.key === end.key && start.offset !== end.offset) ||
      start.key !== end.key
    ) {
      return
    }

    if (
      (event.key === EVENT_KEYS.ArrowUp && topOffset > 0) ||
      (event.key === EVENT_KEYS.ArrowDown && bottomOffset > 0)
    ) {
      if (!/pre|th|td/.test(block.type)) {
        return
      }
    }

    if (/th|td/.test(block.type)) {
      let activeBlock
      const cellInNextRow = this.findNextRowCell(block)
      const cellInPrevRow = this.findPrevRowCell(block)

      if (event.key === EVENT_KEYS.ArrowUp) {
        if (cellInPrevRow) {
          activeBlock = cellInPrevRow
        } else {
          activeBlock = this.findPreBlockInLocation(this.getTableBlock())
        }
      }

      if (event.key === EVENT_KEYS.ArrowDown) {
        if (cellInNextRow) {
          activeBlock = cellInNextRow
        } else {
          activeBlock = this.findNextBlockInLocation(this.getTableBlock())
        }
      }

      if (activeBlock) {
        event.preventDefault()
        event.stopPropagation()
        const offset = activeBlock.type === 'p'
          ? 0
          : (event.key === EVENT_KEYS.ArrowUp
            ? activeBlock.text.length
            : 0)

        const key = activeBlock.type === 'p'
          ? activeBlock.children[0].key
          : activeBlock.key

        this.cursor = {
          start: {
            key,
            offset
          },
          end: {
            key,
            offset
          }
        }

        return this.partialRender()
      }
    }

    if (
      (event.key === EVENT_KEYS.ArrowUp) ||
      (event.key === EVENT_KEYS.ArrowLeft && start.offset === 0)
    ) {
      event.preventDefault()
      event.stopPropagation()
      if (!preBlock) return
      const key = preBlock.key
      const offset = preBlock.text.length
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }

      return this.partialRender()
    } else if (
      (event.key === EVENT_KEYS.ArrowDown) ||
      (event.key === EVENT_KEYS.ArrowRight && start.offset === block.text.length)
    ) {
      event.preventDefault()
      event.stopPropagation()
      let key
      let newBlock
      if (nextBlock) {
        key = nextBlock.key
      } else {
        newBlock = this.createBlockP()
        const lastBlock = this.blocks[this.blocks.length - 1]
        this.insertAfter(newBlock, lastBlock)
        key = newBlock.children[0].key
      }
      const offset = 0
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }

      return this.partialRender()
    }
  }
}

export default arrowCtrl
