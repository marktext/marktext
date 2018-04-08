import { EVENT_KEYS, CLASS_OR_ID } from '../config'
import {
  isCursorAtFirstLine, isCursorAtLastLine, isCursorAtBegin, search, // eslint-disable-line no-unused-vars
  isCursorAtEnd, setCursorAtFirstLine, onlyHaveOneLine, setCursorAtLastLine // eslint-disable-line no-unused-vars
} from '../codeMirror'
import { findNearestParagraph } from '../utils/domManipulate'
import selection from '../selection'

const HAS_TEXT_BLOCK_REG = /^(h\d|p|th|td|hr|pre)/

const arrowCtrl = ContentState => {
  ContentState.prototype.firstInDescendant = function (block) {
    const children = block.children
    if (block.children.length === 0 && HAS_TEXT_BLOCK_REG.test(block.type)) {
      return block
    } else if (children.length) {
      if (children[0].type === 'input' || (children[0].type === 'div' && children[0].editable === false)) { // handle task item
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
      let lastChild = children[children.length - 1]
      while (lastChild.editable === false) {
        lastChild = this.getPreSibling(lastChild)
      }
      return this.lastInDescendant(lastChild)
    }
  }

  ContentState.prototype.findPreBlockInLocation = function (block) {
    const parent = this.getParent(block)
    const preBlock = this.getPreSibling(block)
    if (block.preSibling && preBlock.type !== 'input' && preBlock.type !== 'div' && preBlock.editable !== false) { // handle task item and table
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

    if (block.nextSibling && nextBlock.editable !== false) {
      return this.firstInDescendant(nextBlock)
    } else if (parent) {
      return this.findNextBlockInLocation(parent)
    } else {
      return null
    }
  }

  ContentState.prototype.arrowHandler = function (event) {
    // when the float box is show, use up and down to select item.
    const { floatBox } = this
    const { list, index, show } = this.floatBox
    const node = selection.getSelectionStart()
    const paragraph = findNearestParagraph(node)
    const id = paragraph.id
    const block = this.getBlock(id)
    const preBlock = this.findPreBlockInLocation(block)
    const nextBlock = this.findNextBlockInLocation(block)

    const { left, right } = selection.getCaretOffsets(paragraph)
    const { start, end } = selection.getCursorRange()

    // fix #101
    if (event.key === EVENT_KEYS.ArrowRight && node && node.classList && node.classList.contains(CLASS_OR_ID['AG_MATH_TEXT'])) {
      const { right } = selection.getCaretOffsets(node)
      if (right === 0 && start.key === end.key && start.offset === end.offset) {
        // It's not recommended to use such lower API, but it's work well.
        return selection.select(node.parentNode.nextElementSibling, 0)
      }
    }

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
      const anchorBlock = block.functionType === 'html' ? this.getParent(this.getParent(block)) : block
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
            if (/^(?:pre|th|td)$/.test(preBlock.type)) {
              activeBlock = this.createBlock('p')
              activeBlock.temp = true
              this.insertBefore(activeBlock, anchorBlock)
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
              if (/^(?:pre|th|td)$/.test(nextBlock.type)) {
                activeBlock = this.createBlock('p')
                activeBlock.temp = true
                this.insertAfter(activeBlock, anchorBlock)
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

        return this.render()
      }
    } else if (/th|td/.test(block.type)) {
      let activeBlock
      const anchorBlock = this.getParent(this.getParent(this.getParent(this.getParent(block))))

      if (
        (block.type === 'th' && preBlock && /^(?:pre|td)$/.test(preBlock.type) && event.key === EVENT_KEYS.ArrowUp) ||
        (block.type === 'th' && preBlock && /^(?:pre|td)$/.test(preBlock.type) && event.key === EVENT_KEYS.ArrowLeft && left === 0)
      ) {
        activeBlock = this.createBlock('p')
        activeBlock.temp = true
        this.insertBefore(activeBlock, anchorBlock)
      }

      if (
        (block.type === 'td' && nextBlock && /^(?:pre|th)$/.test(nextBlock.type) && event.key === EVENT_KEYS.ArrowDown) ||
        (block.type === 'td' && nextBlock && /^(?:pre|th)$/.test(nextBlock.type) && event.key === EVENT_KEYS.ArrowRight && right === 0)
      ) {
        activeBlock = this.createBlock('p')
        activeBlock.temp = true
        this.insertAfter(activeBlock, anchorBlock)
      }

      if (activeBlock) {
        event.preventDefault()
        const offset = 0
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

        return this.render()
      }
    } else if (
      (preBlock && preBlock.type === 'pre' && event.key === EVENT_KEYS.ArrowUp) ||
      (preBlock && preBlock.type === 'pre' && event.key === EVENT_KEYS.ArrowLeft && left === 0)
    ) {
      event.preventDefault()
      const key = preBlock.key
      const offset = 0
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }

      return this.render()
    } else if (
      (nextBlock && nextBlock.type === 'pre' && event.key === EVENT_KEYS.ArrowDown) ||
      (nextBlock && nextBlock.type === 'pre' && event.key === EVENT_KEYS.ArrowRight && right === 0)
    ) {
      event.preventDefault()
      const key = nextBlock.key
      const offset = 0
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }
      return this.render()
    }

    if (
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
