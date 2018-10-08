import { EVENT_KEYS, CLASS_OR_ID } from '../config'
import {
  isCursorAtFirstLine,
  isCursorAtLastLine,
  isCursorAtBegin,
  isCursorAtEnd,
  getBeginPosition,
  getEndPosition
} from '../codeMirror'
import { findNearestParagraph } from '../selection/dom'
import selection from '../selection'

const arrowCtrl = ContentState => {
  ContentState.prototype.findNextRowCell = function (cell) {
    if (!/th|td/.test(cell.type)) throw new Error(`block with type ${cell && cell.type} is not a table cell`)
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

    const { left, right } = selection.getCaretOffsets(paragraph)
    const { start, end } = selection.getCursorRange()
    const { topOffset, bottomOffset } = selection.getCursorYOffset(paragraph)

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
      if (block.type !== 'pre') {
        return
      }
    }

    // handle `html` and `code` block when press arrow key
    if (block.type === 'pre' && /code|html/.test(block.functionType)) {
      // handle cursor in code block. the case at firstline or lastline.
      const cm = this.codeBlocks.get(id)
      const anchorBlock = block.functionType === 'html' ? this.getParent(this.getParent(block)) : block
      let activeBlock
      event.preventDefault()
      event.stopPropagation()
      switch (event.key) {
        case EVENT_KEYS.ArrowLeft: // fallthrough
        case EVENT_KEYS.ArrowUp:
          if (
            (event.key === EVENT_KEYS.ArrowUp && isCursorAtFirstLine(cm) && preBlock) ||
            (event.key === EVENT_KEYS.ArrowLeft && isCursorAtBegin(cm) && preBlock)
          ) {
            activeBlock = preBlock
          }
          break
        case EVENT_KEYS.ArrowRight: // fallthrough
        case EVENT_KEYS.ArrowDown:
          if (
            (event.key === EVENT_KEYS.ArrowDown && isCursorAtLastLine(cm)) ||
            (event.key === EVENT_KEYS.ArrowRight && isCursorAtEnd(cm))
          ) {
            if (nextBlock) {
              activeBlock = nextBlock
            } else {
              activeBlock = this.createBlockP()
              this.insertAfter(activeBlock, anchorBlock)
            }
          }
          break
      }

      if (activeBlock) {
        const cursorBlock = activeBlock.type === 'p' ? activeBlock.children[0] : activeBlock
        const offset = cursorBlock.text.length
        const key = cursorBlock.key
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
      return
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
      (preBlock && preBlock.type === 'pre' && /code|html/.test(preBlock.functionType) && event.key === EVENT_KEYS.ArrowUp) ||
      (preBlock && preBlock.type === 'pre' && /code|html/.test(preBlock.functionType) && event.key === EVENT_KEYS.ArrowLeft && left === 0)
    ) {
      event.preventDefault()
      event.stopPropagation()
      const key = preBlock.key
      const offset = 0
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }

      const cm = this.codeBlocks.get(preBlock.key)
      preBlock.selection = getEndPosition(cm)

      return this.partialRender()
    } else if (
      (nextBlock && nextBlock.type === 'pre' && /code|html/.test(nextBlock.functionType) && event.key === EVENT_KEYS.ArrowDown) ||
      (nextBlock && nextBlock.type === 'pre' && /code|html/.test(nextBlock.functionType) && event.key === EVENT_KEYS.ArrowRight && right === 0)
    ) {
      event.preventDefault()
      event.stopPropagation()
      const key = nextBlock.key
      const offset = 0
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }

      nextBlock.selection = getBeginPosition()

      return this.partialRender()
    } else if (
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
