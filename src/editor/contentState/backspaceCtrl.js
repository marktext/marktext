import selection from '../selection'
import { findNearestParagraph, findOutMostParagraph } from '../utils/domManipulate'
import { isCursorAtBegin, onlyHaveOneLine, getEndPosition } from '../codeMirror'

const backspaceCtrl = ContentState => {
  ContentState.prototype.checkBackspaceCase = function () {
    const node = selection.getSelectionStart()
    const nearestParagraph = findNearestParagraph(node)
    const outMostParagraph = findOutMostParagraph(node)
    const block = this.getBlock(nearestParagraph.id)
    const preBlock = this.getPreSibling(block)
    const outBlock = this.findOutMostBlock(block)
    const parent = this.getParent(block)

    const { left: outLeft } = selection.getCaretOffsets(outMostParagraph)
    const { left: inLeft } = selection.getCaretOffsets(nearestParagraph)

    if (
      (parent && parent.type === 'li' && inLeft === 0 && this.isFirstChild(block)) ||
      (parent && parent.type === 'li' && inLeft === 0 && parent.listItemType === 'task' && preBlock.type === 'input') // handle task item
    ) {
      if (this.isOnlyChild(parent)) {
        /**
         * `<ul>
         *   <li>
         *     <p>|text</p>
         *     <p>maybe has other paragraph</p>
         *   </li>
         * <ul>`
         */
        return { type: 'LI', info: 'REPLACEMENT' }
      } else if (this.isFirstChild(parent)) {
        /**
         * `<ul>
         *   <li>
         *     <p>|text</p>
         *     <p>maybe has other paragraph</p>
         *   </li>
         *   <li>
         *     <p>other list item</p>
         *   </li>
         * <ul>`
         */
        return { type: 'LI', info: 'REMOVE_INSERT_BEFORE' }
      } else {
        /**
         * `<ul>
         *   <li>
         *     <p>other list item</p>
         *   </li>
         *   <li>
         *     <p>|text</p>
         *     <p>maybe has other paragraph</p>
         *   </li>
         *   <li>
         *     <p>other list item</p>
         *   </li>
         * <ul>`
         */
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
    const { start, end } = selection.getCursorRange()
    const startBlock = this.getBlock(start.key)
    const endBlock = this.getBlock(end.key)
    // bugfix: #67 problem 1
    if (startBlock.icon) return event.preventDefault()
    // fixbug: unexpect remove all editor html.
    if (start.key === end.key && startBlock.type === 'figure' && !startBlock.preSibling) {
      event.preventDefault()
      let newBlock
      if (this.blocks.length === 1) {
        startBlock.type = 'p'
        startBlock.text = ''
        startBlock.children = []
        newBlock = startBlock
      } else {
        this.removeBlock(startBlock)
        newBlock = this.getNextSibling(startBlock)
      }
      const key = newBlock.key
      const offset = 0

      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }
      return this.render()
    }

    if (start.key !== end.key) {
      event.preventDefault()
      const key = start.key
      const offset = start.offset

      const startRemainText = startBlock.type === 'pre'
        ? startBlock.text.substring(0, start.offset - 1)
        : startBlock.text.substring(0, start.offset)

      const endRemainText = endBlock.type === 'pre'
        ? endBlock.text.substring(end.offset - 1)
        : endBlock.text.substring(end.offset)

      startBlock.text = startRemainText + endRemainText

      if (offset === 0 && !(/th|td/.test(startBlock.type))) {
        startBlock.type = 'p'
      }

      this.removeBlocks(startBlock, endBlock)
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }
      return this.render()
    }

    const node = selection.getSelectionStart()
    const paragraph = findNearestParagraph(node)
    const id = paragraph.id
    const block = this.getBlock(id)
    const parent = this.getBlock(block.parent)
    const preBlock = this.findPreBlockInLocation(block)
    const { left } = selection.getCaretOffsets(paragraph)
    const inlineDegrade = this.checkBackspaceCase()

    const getPreRow = row => {
      const preSibling = this.getBlock(row.preSibling)
      if (preSibling) {
        return preSibling
      } else {
        const rowParent = this.getBlock(row.parent)
        if (rowParent.type === 'tbody') {
          const tHead = this.getBlock(rowParent.preSibling)
          return tHead.children[0]
        } else {
          const table = this.getBlock(rowParent.parent)
          const figure = this.getBlock(table.parent)
          const figurePreSibling = this.getBlock(figure.preSibling)
          return figurePreSibling ? this.lastInDescendant(figurePreSibling) : false
        }
      }
    }

    const tableHasContent = table => {
      const tHead = table.children[0]
      const tBody = table.children[1]
      const tHeadHasContent = tHead.children[0].children.some(th => th.text.trim())
      const tBodyHasContent = tBody.children.some(row => row.children.some(td => td.text.trim()))
      return tHeadHasContent || tBodyHasContent
    }

    if (block.type === 'pre') {
      const cm = this.codeBlocks.get(id)
      // if event.preventDefault(), U can not use backspace in language input.
      if (isCursorAtBegin(cm) && onlyHaveOneLine(cm)) {
        const anchorBlock = block.functionType === 'html' ? this.getParent(this.getParent(block)) : block
        event.preventDefault()
        const value = cm.getValue()
        const newBlock = this.createBlock('p')
        if (value) newBlock.text = value
        this.insertBefore(newBlock, anchorBlock)
        this.removeBlock(anchorBlock)
        this.codeBlocks.delete(id)
        const key = newBlock.key
        const offset = 0

        this.cursor = {
          start: { key, offset },
          end: { key, offset }
        }

        this.render()
      }
    } else if (left === 0 && /th|td/.test(block.type)) {
      event.preventDefault()
      let key
      let offset
      if (preBlock) {
        key = preBlock.key
        offset = preBlock.text.length
      } else if (parent) {
        const preRow = getPreRow(parent)
        const tHead = this.getBlock(parent.parent)
        const table = this.getBlock(tHead.parent)
        const figure = this.getBlock(table.parent)
        const hasContent = tableHasContent(table)

        if (preRow) {
          if (preRow.type === 'tr') {
            const lastCell = preRow.children[preRow.children.length - 1]
            key = lastCell.key
            offset = lastCell.text.length
          } else {
            // if the table is empty change the table to a `p` paragraph
            // else set the cursor to the pre block
            if (!hasContent) {
              figure.children = []
              figure.text = ''
              figure.type = 'p'
              key = figure.key
              offset = 0
            } else {
              key = preRow.key
              offset = preRow.text.length
            }
          }
        } else {
          if (!hasContent) {
            figure.children = []
            figure.text = ''
            figure.type = 'p'
            key = figure.key
            offset = 0
          }
        }
      }
      if (key !== undefined && offset !== undefined) {
        this.cursor = {
          start: { key, offset },
          end: { key, offset }
        }
        this.render()
      }
    } else if (inlineDegrade) {
      event.preventDefault()
      switch (inlineDegrade.type) {
        case 'STOP': // at begin of article
          // do nothing...
          break
        case 'LI': {
          if (inlineDegrade.info === 'REPLACEMENT') {
            const children = parent.children
            const grandpa = this.getBlock(parent.parent)
            if (children[0].type === 'input') {
              this.removeBlock(children[0])
            }
            children.forEach(child => {
              this.insertBefore(child, grandpa)
            })
            this.removeBlock(grandpa)
          } else if (inlineDegrade.info === 'REMOVE_INSERT_BEFORE') {
            const children = parent.children
            const grandpa = this.getBlock(parent.parent)
            if (children[0].type === 'input') {
              this.removeBlock(children[0])
            }
            children.forEach(child => {
              this.insertBefore(child, grandpa)
            })
            this.removeBlock(parent)
          } else if (inlineDegrade.info === 'INSERT_PRE_LIST') {
            const parPre = this.getBlock(parent.preSibling)
            const children = parent.children
            if (children[0].type === 'input') {
              this.removeBlock(children[0])
            }
            children.forEach(child => {
              this.appendChild(parPre, child)
            })
            this.removeBlock(parent)
          }
          break
        }
        case 'BLOCKQUOTE':
          if (inlineDegrade.info === 'REPLACEMENT') {
            this.replaceBlock(block/* new block */, parent/* old block */)
          } else if (inlineDegrade.info === 'INSERT_BEFORE') {
            this.removeBlock(block)
            this.insertBefore(block, parent)
          }
          break
      }
      this.cursor = selection.getCursorRange()
      if (inlineDegrade.type !== 'STOP') {
        this.render()
      }
    } else if (
      left === 0 &&
      preBlock &&
      preBlock.type === 'pre'
    ) {
      event.preventDefault()
      const text = block.text
      const key = preBlock.key
      const cm = this.codeBlocks.get(key)
      const value = cm.getValue() + text
      const offset = 0
      cm.setValue(value)
      const { line, ch } = getEndPosition(cm)

      preBlock.pos = { line, ch: ch - text.length }

      this.removeBlock(block)

      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }
      this.render()
    } else if (left === 0) {
      this.removeBlock(block)
    }
  }
}

export default backspaceCtrl
