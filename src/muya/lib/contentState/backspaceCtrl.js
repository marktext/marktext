import selection from '../selection'
import { findNearestParagraph, findOutMostParagraph } from '../selection/dom'
import { isCursorAtBegin, onlyHaveOneLine, getEndPosition } from '../codeMirror'

const backspaceCtrl = ContentState => {
  ContentState.prototype.checkBackspaceCase = function () {
    const node = selection.getSelectionStart()
    const paragraph = findNearestParagraph(node)
    const outMostParagraph = findOutMostParagraph(node)
    let block = this.getBlock(paragraph.id)
    if (block.type === 'span' && block.preSibling) {
      return false
    }
    if (block.type === 'span') {
      block = this.getParent(block)
    }
    const preBlock = this.getPreSibling(block)
    const outBlock = this.findOutMostBlock(block)
    const parent = this.getParent(block)

    const { left: outLeft } = selection.getCaretOffsets(outMostParagraph)
    const { left: inLeft } = selection.getCaretOffsets(paragraph)

    if (
      (parent && parent.type === 'li' && inLeft === 0 && this.isFirstChild(block)) ||
      (parent && parent.type === 'li' && inLeft === 0 && parent.listItemType === 'task' && preBlock.type === 'input') // handle task item
    ) {
      if (this.isOnlyChild(parent)) {
        /**
         * <ul>
         *   <li>
         *     <p>|text</p>
         *     <p>maybe has other paragraph</p>
         *   </li>
         * <ul>
         * ===>
         * <p>|text</p>
         * <p>maybe has other paragraph</p>
         */
        return { type: 'LI', info: 'REPLACEMENT' }
      } else if (this.isFirstChild(parent)) {
        /**
         * <ul>
         *   <li>
         *     <p>|text</p>
         *     <p>maybe has other paragraph</p>
         *   </li>
         *   <li>
         *     <p>other list item</p>
         *   </li>
         * <ul>
         * ===>
         * <p>|text</p>
         * <p>maybe has other paragraph</p>
         * <ul>
         *   <li>
         *     <p>other list item</p>
         *   </li>
         * <ul>
         */
        return { type: 'LI', info: 'REMOVE_INSERT_BEFORE' }
      } else {
        /**
         * <ul>
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
         * <ul>
         * ===>
         * <ul>
         *   <li>
         *     <p>other list item</p>
         *     <p>|text</p>
         *     <p>maybe has other paragraph</p>
         *   </li>
         *   <li>
         *     <p>other list item</p>
         *   </li>
         * <ul>
         */
        return { type: 'LI', info: 'INSERT_PRE_LIST_ITEM' }
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
    // fix: #67 problem 1
    if (startBlock.icon) return event.preventDefault()
    // fix: unexpect remove all editor html. #67 problem 4
    if (startBlock.type === 'figure' && !startBlock.preSibling) {
      event.preventDefault()
      this.removeBlock(startBlock)
      if (start.key !== end.key) {
        this.removeBlocks(startBlock, endBlock)
      }
      let newBlock = this.findNextBlockInLocation(startBlock)
      if (!newBlock) {
        this.blocks = [this.createBlockP()]
        newBlock = this.blocks[0].children[0]
      }
      const key = newBlock.key
      const offset = 0

      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }
      return this.render()
    }

    // If select multiple paragraph or multiple characters in one paragraph, just let
    // updateCtrl to handle this case.
    if (start.key !== end.key || start.offset !== end.offset) {
      return
    }

    const node = selection.getSelectionStart()
    const paragraph = findNearestParagraph(node)
    const id = paragraph.id
    let block = this.getBlock(id)
    let parent = this.getBlock(block.parent)
    const preBlock = this.findPreBlockInLocation(block)
    const { left } = selection.getCaretOffsets(paragraph)
    const inlineDegrade = this.checkBackspaceCase()

    const tableHasContent = table => {
      const tHead = table.children[0]
      const tBody = table.children[1]
      const tHeadHasContent = tHead.children[0].children.some(th => th.text.trim())
      const tBodyHasContent = tBody.children.some(row => row.children.some(td => td.text.trim()))
      return tHeadHasContent || tBodyHasContent
    }

    if (block.type === 'pre' && /code|html/.test(block.functionType)) {
      const cm = this.codeBlocks.get(id)
      // if event.preventDefault(), you can not use backspace in language input.
      if (isCursorAtBegin(cm) && onlyHaveOneLine(cm)) {
        const anchorBlock = block.functionType === 'html' ? this.getParent(this.getParent(block)) : block
        event.preventDefault()
        const value = cm.getValue()
        const newBlock = this.createBlockP(value)
        this.insertBefore(newBlock, anchorBlock)
        this.removeBlock(anchorBlock)
        this.codeBlocks.delete(id)
        const key = newBlock.children[0].key
        const offset = 0

        this.cursor = {
          start: { key, offset },
          end: { key, offset }
        }
        this.partialRender()
      }
    } else if (
      block.type === 'span' && /frontmatter|multiplemath/.test(block.functionType) &&
      left === 0 && !block.preSibling
    ) {
      const isMathLine = block.functionType === 'multiplemath'
      event.preventDefault()
      event.stopPropagation()
      const { key } = block
      const offset = 0
      const pBlock = this.createBlock('p')
      for (const line of parent.children) {
        delete line.functionType
        this.appendChild(pBlock, line)
      }
      if (isMathLine) {
        parent = this.getParent(parent)
      }
      this.insertBefore(pBlock, parent)
      this.removeBlock(parent)

      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }
      this.partialRender()
    } else if (left === 0 && /th|td/.test(block.type)) {
      event.preventDefault()
      event.stopPropagation()
      const tHead = this.getBlock(parent.parent)
      const table = this.getBlock(tHead.parent)
      const figure = this.getBlock(table.parent)
      const hasContent = tableHasContent(table)
      let key
      let offset

      if ((!preBlock || !/th|td/.test(preBlock.type)) && !hasContent) {
        const newLine = this.createBlock('span')
        delete figure.functionType
        figure.children = []
        this.appendChild(figure, newLine)
        figure.text = ''
        figure.type = 'p'
        key = newLine.key
        offset = 0
      } else if (preBlock) {
        key = preBlock.key
        offset = preBlock.text.length
      }

      if (key !== undefined && offset !== undefined) {
        this.cursor = {
          start: { key, offset },
          end: { key, offset }
        }

        this.partialRender()
      }
    } else if (inlineDegrade) {
      event.preventDefault()
      if (block.type === 'span') {
        block = this.getParent(block)
        parent = this.getParent(parent)
      }

      switch (inlineDegrade.type) {
        case 'STOP': // Cursor at begin of article and nothing need to do
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
          } else if (inlineDegrade.info === 'INSERT_PRE_LIST_ITEM') {
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
            this.insertBefore(block, parent)
            this.removeBlock(parent)
          } else if (inlineDegrade.info === 'INSERT_BEFORE') {
            this.removeBlock(block)
            this.insertBefore(block, parent)
          }
          break
      }

      const key = block.type === 'p' ? block.children[0].key : block.key
      const offset = 0
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }

      if (inlineDegrade.type !== 'STOP') {
        this.partialRender()
      }
    } else if (left === 0 && preBlock) {
      event.preventDefault()
      const { text } = block
      const key = preBlock.key
      const offset = preBlock.text.length
      if (preBlock.type === 'pre' && /code|html/.test(preBlock.functionType)) {
        const cm = this.codeBlocks.get(key)
        const value = cm.getValue() + text
        cm.setValue(value)
        const { line, ch } = getEndPosition(cm).anchor

        preBlock.selection = {
          anchor: { line, ch: ch - text.length },
          head: { line, ch: ch - text.length }
        }
      } else {
        preBlock.text += text
      }
      // If block is a line block and its parent paragraph only has one text line,
      // also need to remove the paragrah
      if (this.isOnlyChild(block) && block.type === 'span') {
        this.removeBlock(parent)
      } else {
        this.removeBlock(block)
      }

      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }
      this.partialRender()
    }
  }
}

export default backspaceCtrl
