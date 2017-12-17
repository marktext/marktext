import floatBox from '../floatBox'
import { EVENT_KEYS } from '../config'
import {
  isCursorAtFirstLine, isCursorAtLastLine, isCursorAtBegin, search, // eslint-disable-line no-unused-vars
  isCursorAtEnd, setCursorAtFirstLine, onlyHaveOneLine, setCursorAtLastLine // eslint-disable-line no-unused-vars
} from '../codeMirror'
import { findNearestParagraph } from '../utils/domManipulate'
import selection from '../selection'

const arrowCtrl = ContentState => {
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
            (event.key === EVENT_KEYS.ArrowDown && isCursorAtLastLine(cm) && nextBlock) ||
            (event.key === EVENT_KEYS.ArrowRight && isCursorAtEnd(cm) && nextBlock)
          ) {
            activeBlock = nextBlock
            if (nextBlock.type === 'pre') {
              activeBlock = this.createBlock('p')
              activeBlock.temp = true
              this.insertAfter(activeBlock, block)
            }
          } else if (!nextBlock) {
            activeBlock = this.createBlock('p')
            this.insertAfter(activeBlock, block)
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
    }
  }
}

export default arrowCtrl
