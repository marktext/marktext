import floatBox from '../floatBox'
import { EVENT_KEYS } from '../config'
import {
  isCursorAtFirstLine, isCursorAtLastLine, isCursorAtBegin, search, // eslint-disable-line no-unused-vars
  isCursorAtEnd, setCursorAtFirstLine, onlyHaveOneLine, setCursorAtLastLine // eslint-disable-line no-unused-vars
} from '../codeMirror'
import { findNearestParagraph } from '../utils/domManipulate'
import selection from '../selection'

const HAS_TEXT_BLOCK_REG = /^(h\d|p|th|td|hr)/

const arrowCtrl = ContentState => {
  ContentState.prototype.firstInDescendant = function (block) {
    if (block.children.length === 0 && HAS_TEXT_BLOCK_REG.test(block.type)) {
      return block
    } else if (block.children.length) {
      const children = block.children
      if (children[0].type === 'input') { // handle task item
        return this.firstInDescendant(children[1])
      } else {
        return this.firstInDescendant(children[0])
      }
    }
  }

  ContentState.prototype.lastInDescendant = function (block) {
    if (block.children.length === 0 && HAS_TEXT_BLOCK_REG.test(block.type)) {
      return block
    } else if (block.children.length) {
      const children = block.children
      const lastChild = children[children.length - 1]
      return this.lastInDescendant(lastChild)
    }
  }

  ContentState.prototype.findPreBlockInLocation = function (block) {
    const parent = this.getParent(block)
    const preBlock = this.getPreSibling(block)
    if (block.preSibling && preBlock.type !== 'input') { // handle task item
      return this.lastInDescendant(preBlock)
    } else if (parent) {
      return this.findPreBlockInLocation(parent)
    } else {
      return null
    }
  }

  ContentState.prototype.findNextBlockInLocation = function (block) {
    const parent = this.getParent(block)
    const nextBlock = this.getNextSibling(block)

    if (block.nextSibling) {
      return this.firstInDescendant(nextBlock)
    } else if (parent) {
      return this.findNextBlockInLocation(parent)
    } else {
      return null
    }
  }

  ContentState.prototype.arrowHandler = function (event) {
    // when the float box is show, use up and down to select item.
    const { list, index, show } = floatBox
    const node = selection.getSelectionStart()
    const paragraph = findNearestParagraph(node)
    const id = paragraph.id
    const block = this.getBlock(id)
    const preBlock = this.getPreSibling(block)
    const nextBlock = this.getNextSibling(block)
    const { left, right } = selection.getCaretOffsets(paragraph)
    const { start, end } = selection.getCursorRange()

    if (
      (start.key === end.key && start.offset !== end.offset) ||
      start.key !== end.key
    ) {
      return
    }

    if (show && (event.key === EVENT_KEYS.ArrowUp || event.key === EVENT_KEYS.ArrowDown)) {
      event.preventDefault()
      switch (event.key) {
        case EVENT_KEYS.ArrowDown:
          if (index < list.length - 1) {
            floatBox.setOptions(list, index + 1)
          }
          break
        case EVENT_KEYS.ArrowUp:
          if (index > 0) {
            floatBox.setOptions(list, index - 1)
          }
          break
      }
    } else if (block.type === 'pre') {
      // handle cursor in code block. the case at firstline or lastline.
      const cm = this.codeBlocks.get(id)
      let activeBlock
      event.preventDefault()

      switch (event.key) {
        case EVENT_KEYS.ArrowLeft: // fallthrough
        case EVENT_KEYS.ArrowUp:
          if (
            (event.key === EVENT_KEYS.ArrowUp && isCursorAtFirstLine(cm) && preBlock) ||
            (event.key === EVENT_KEYS.ArrowLeft && isCursorAtBegin(cm) && preBlock)
          ) {
            activeBlock = preBlock
            if (preBlock.type === 'pre') {
              activeBlock = this.createBlock('p')
              activeBlock.temp = true
              this.insertAfter(activeBlock, preBlock)
            }
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
              if (nextBlock.type === 'pre') {
                activeBlock = this.createBlock('p')
                activeBlock.temp = true
                this.insertAfter(activeBlock, block)
              }
            } else {
              activeBlock = this.createBlock('p')
              this.insertAfter(activeBlock, block)
            }
          }
          break
      }

      if (activeBlock) {
        const offset = activeBlock.text.length
        const key = activeBlock.key
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

        this.render()
      }
    } else if (
      (preBlock && preBlock.type === 'pre' && event.key === EVENT_KEYS.ArrowUp) ||
      (preBlock && preBlock.type === 'pre' && event.key === EVENT_KEYS.ArrowLeft && left === 0)
    ) {
      event.preventDefault()
      const codeBlockId = preBlock.key
      const cm = this.codeBlocks.get(codeBlockId)
      return setCursorAtLastLine(cm)
    } else if (
      (nextBlock && nextBlock.type === 'pre' && event.key === EVENT_KEYS.ArrowDown) ||
      (nextBlock && nextBlock.type === 'pre' && event.key === EVENT_KEYS.ArrowRight && right === 0)
    ) {
      event.preventDefault()
      const codeBlockId = nextBlock.key
      const cm = this.codeBlocks.get(codeBlockId)
      return setCursorAtFirstLine(cm)
    } else if (
      (event.key === EVENT_KEYS.ArrowUp) ||
      (event.key === EVENT_KEYS.ArrowLeft && start.offset === 0)
    ) {
      event.preventDefault()
      const preBlockInLocation = this.findPreBlockInLocation(block)
      if (!preBlockInLocation) return
      const key = preBlockInLocation.key
      const offset = preBlockInLocation.text.length
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }
      this.render()
    } else if (
      (event.key === EVENT_KEYS.ArrowDown) ||
      (event.key === EVENT_KEYS.ArrowRight && start.offset === block.text.length)
    ) {
      event.preventDefault()
      const nextBlockInLocation = this.findNextBlockInLocation(block)
      let key
      if (nextBlockInLocation) {
        key = nextBlockInLocation.key
      } else {
        const newBlock = this.createBlock('p')
        const lastBlock = this.blocks[this.blocks.length - 1]
        this.insertAfter(newBlock, lastBlock)
        key = newBlock.key
      }
      const offset = 0
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }
      this.render()
    }
  }
}

export default arrowCtrl
