import selection from '../selection'
import { findNearestParagraph, findOutMostParagraph } from '../utils/domManipulate'
import { isCursorAtBegin, onlyHaveOneLine, setCursorAtLastLine } from '../codeMirror'

const backspaceCtrl = ContentState => {
  ContentState.prototype.checkBackspaceCase = function () {
    const node = selection.getSelectionStart()
    const nearestParagraph = findNearestParagraph(node)
    const outMostParagraph = findOutMostParagraph(node)
    const block = this.getBlock(nearestParagraph.id)
    const outBlock = this.findOutMostBlock(block)
    const parent = this.getParent(block)

    const { left: outLeft } = selection.getCaretOffsets(outMostParagraph)
    const { left: inLeft } = selection.getCaretOffsets(nearestParagraph)

    if (parent && parent.type === 'li' && inLeft === 0 && this.isFirstChild(block)) {
      if (this.isOnlyChild(parent)) {
        return { type: 'LI', info: 'REPLACEMENT' }
      } else if (this.isFirstChild(parent)) {
        return { type: 'LI', info: 'REMOVE_INSERT_BEFORE' }
      } else {
        return { type: 'LI', info: 'INSERT_PRE_LIST' }
      }
    }
    if (parent && parent.type === 'blockquote' && inLeft === 0) {
      if (this.isOnlyChild(block)) {
        return { type: 'BLOCKQUOTE', info: 'REPLACEMENT' }
      } else if (this.isFirstChild(block)) {
        return { type: 'BLOCKQUOTE', info: 'INSERT_BEFORE' }
      }
    }
    if (!outBlock.preSibling && outLeft === 0) {
      return { type: 'STOP' }
    }
  }

  ContentState.prototype.backspaceHandler = function (event) {
    const node = selection.getSelectionStart()
    const paragraph = findNearestParagraph(node)
    const id = paragraph.id
    const block = this.getBlock(id)
    const parent = this.getBlock(block.parent)
    const preBlock = this.getBlock(block.preSibling)
    const selectionState = selection.exportSelection(paragraph)
    const { left } = selection.getCaretOffsets(paragraph)
    const inlineDegrade = this.checkBackspaceCase()

    if (block.type === 'pre') {
      const cm = this.codeBlocks.get(id)
      // if event.preventDefault(), U can not use backspace in language input.
      if (isCursorAtBegin(cm) && onlyHaveOneLine(cm)) {
        event.preventDefault()
        const value = cm.getValue()
        const newBlock = this.createBlock('p')
        if (value) newBlock.text = value
        this.insertBefore(newBlock, block)
        this.removeBlock(block)
        this.codeBlocks.delete(id)
        this.cursor.key = newBlock.key
        this.cursor.range = { start: 0, end: 0 }
        this.render()
      }
    } else if (
      left === 0 &&
      preBlock &&
      preBlock.type === 'pre'
    ) {
      event.preventDefault()
      const text = block.text
      const cm = this.codeBlocks.get(preBlock.key)
      const value = cm.getValue() + text
      cm.setValue(value)
      this.removeBlock(block)
      setCursorAtLastLine(cm)
    } else if (inlineDegrade) {
      event.preventDefault()
      switch (inlineDegrade.type) {
        case 'STOP': // at begin of article
          // do nothing...
          break
        case 'LI': {
          if (inlineDegrade.info === 'REPLACEMENT') {
            const children = parent.children
            const parentsparent = this.getBlock(parent.parent)
            children.forEach(child => {
              this.insertBefore(child, parentsparent)
            })
            this.removeBlock(parentsparent)
          } else if (inlineDegrade.info === 'REMOVE_INSERT_BEFORE') {
            const children = parent.children
            const parentsparent = this.getBlock(parent.parent)
            children.forEach(child => {
              this.insertBefore(child, parentsparent)
            })
            this.removeBlock(parent)
          } else if (inlineDegrade.info === 'INSERT_PRE_LIST') {
            const parPre = this.getBlock(parent.preSibling)
            const children = parent.children
            children.forEach(child => {
              this.appendChild(parPre, child)
            })
            this.removeBlock(parent)
            console.log(JSON.stringify(this.blocks, null, 2))
          }
          break
        }
        case 'BLOCKQUOTE':
          if (inlineDegrade.info === 'REPLACEMENT') {
            this.replaceBlock(block, parent)
          } else if (inlineDegrade.info === 'INSERT_BEFORE') {
            this.removeBlock(block)
            this.insertBefore(block, parent)
          }
          break
      }
      this.cursor = {
        key: block.key,
        range: selectionState
      }
      this.render()
    } else if (left === 0) {
      this.removeBlock(block)
    }
  }
}

export default backspaceCtrl
