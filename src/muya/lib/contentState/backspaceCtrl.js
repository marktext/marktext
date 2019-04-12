import selection from '../selection'
import { findNearestParagraph, findOutMostParagraph } from '../selection/dom'
import { tokenizer, generator } from '../parser/'

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

    if (!start || !end) {
      return
    }
    const startBlock = this.getBlock(start.key)
    const endBlock = this.getBlock(end.key)
    // fix: #897
    const { text } = startBlock
    const tokens = tokenizer(text)
    let needRender = false
    let preToken = null
    for (const token of tokens) {
      // handle delete the second $ in inline_math.
      if (
        token.range.end === start.offset &&
        token.type === 'inline_math'
      ) {
        needRender = true
        token.raw = token.raw.substr(0, token.raw.length - 1)
        break
      }
      // handle pre token is a <ruby> html tag, need preventdefault.
      if (
        token.range.start + 1 === start.offset &&
        preToken &&
        preToken.type === 'html_tag' &&
        preToken.tag === 'ruby'
      ) {
        needRender = true
        token.raw = token.raw.substr(1)
        break
      }
      preToken = token
    }
    if (needRender) {
      startBlock.text = generator(tokens)
      event.preventDefault()
      start.offset--
      end.offset--
      this.cursor = {
        start,
        end
      }
      return this.partialRender()
    }

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
    // inputCtrl to handle this case.
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

    if (
      block.type === 'span' &&
      block.functionType === 'codeLine' &&
      left === 0 &&
      !block.preSibling
    ) {
      event.preventDefault()
      event.stopPropagation()
      if (
        !block.nextSibling
      ) {
        const preBlock = this.getParent(parent)
        const pBlock = this.createBlock('p')
        const lineBlock = this.createBlock('span', block.text)
        const key = lineBlock.key
        const offset = 0
        this.appendChild(pBlock, lineBlock)
        let referenceBlock = null
        switch (preBlock.functionType) {
          case 'fencecode':
          case 'indentcode':
          case 'frontmatter':
            referenceBlock = preBlock
            break
          case 'multiplemath':
          case 'flowchart':
          case 'mermaid':
          case 'sequence':
          case 'vega-lite':
            referenceBlock = this.getParent(preBlock)
            break
          case 'html':
            referenceBlock = this.getParent(this.getParent(preBlock))
            break
        }
        this.insertBefore(pBlock, referenceBlock)
        this.removeBlock(referenceBlock)

        this.cursor = {
          start: { key, offset },
          end: { key, offset }
        }
        this.partialRender()
      }
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
      preBlock.text += text
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
