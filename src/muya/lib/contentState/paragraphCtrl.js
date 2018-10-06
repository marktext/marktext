import selection from '../selection'
import { PARAGRAPH_TYPES, DEFAULT_TURNDOWN_CONFIG } from '../config'
import ExportMarkdown from '../utils/exportMarkdown'

const LINE_BREAKS_REG = /\n/

// get header level
//  eg: h1 => 1
//      h2 => 2
const getCurrentLevel = type => {
  if (/\d/.test(type)) {
    return Number(/\d/.exec(type)[0])
  } else {
    return 0
  }
}

const paragraphCtrl = ContentState => {
  ContentState.prototype.selectionChange = function (fontSize = 16, lineHeight = 1.6, cursor) {
    const { start, end } = cursor || selection.getCursorRange()
    const cursorCoords = selection.getCursorCoords()
    const startBlock = this.getBlock(start.key)
    const endBlock = this.getBlock(end.key)
    const startParents = this.getParents(startBlock)
    const endParents = this.getParents(endBlock)
    const affiliation = startParents
      .filter(p => endParents.includes(p))
      .filter(p => PARAGRAPH_TYPES.includes(p.type))

    start.type = startBlock.type
    start.block = startBlock
    end.type = endBlock.type
    end.block = endBlock

    if (start.type === 'pre' && end.type === 'pre' && startBlock.functionType !== 'frontmatter') {
      const preElement = document.querySelector(`#${start.key}`)
      const { top } = preElement.getBoundingClientRect()
      const { line } = start.block.selection.anchor
      cursorCoords.y = top + line * lineHeight * fontSize
    }

    return {
      start,
      end,
      affiliation,
      cursorCoords
    }
  }

  ContentState.prototype.getCommonParent = function () {
    const { start, end, affiliation } = this.selectionChange()
    const parent = affiliation.length ? affiliation[0] : null
    const startBlock = this.getBlock(start.key)
    const endBlock = this.getBlock(end.key)
    const startParentKeys = this.getParents(startBlock).map(b => b.key)
    const endParentKeys = this.getParents(endBlock).map(b => b.key)
    const children = parent ? parent.children : this.blocks
    let startIndex
    let endIndex
    for (const child of children) {
      if (startParentKeys.includes(child.key)) {
        startIndex = children.indexOf(child)
      }
      if (endParentKeys.includes(child.key)) {
        endIndex = children.indexOf(child)
      }
    }
    return { parent, startIndex, endIndex }
  }

  ContentState.prototype.handleFrontMatter = function () {
    const firstBlock = this.blocks[0]
    if (firstBlock.type === 'pre' && firstBlock.functionType === 'frontmatter') return
    const frontMatter = this.createBlock('pre')
    const emptyLine = this.createBlock('span')
    emptyLine.functionType = 'frontmatter'
    frontMatter.functionType = 'frontmatter'
    this.appendChild(frontMatter, emptyLine)
    this.insertBefore(frontMatter, firstBlock)
    const { key } = emptyLine
    const offset = 0
    this.cursor = {
      start: { key, offset },
      end: { key, offset }
    }
  }

  ContentState.prototype.handleListMenu = function (paraType) {
    const { start, end, affiliation } = this.selectionChange()
    const [blockType, listType] = paraType.split('-')
    const isListed = affiliation.slice(0, 3).filter(b => /ul|ol/.test(b.type))
    const { preferLooseListItem } = this

    if (isListed.length) {
      const listBlock = isListed[0]
      if (listType === isListed[0].listType) {
        const listItems = listBlock.children
        listItems.forEach(listItem => {
          listItem.children.forEach(itemParagraph => {
            if (itemParagraph.type !== 'input') {
              this.insertBefore(itemParagraph, listBlock)
            }
          })
        })
        this.removeBlock(listBlock)
        return
      }
      // if the old list block is task list, remove checkbox
      if (listBlock.listType === 'task') {
        const listItems = listBlock.children
        listItems.forEach(item => {
          const inputBlock = item.children[0]
          inputBlock && this.removeBlock(inputBlock)
        })
      }
      listBlock.type = blockType
      listBlock.listType = listType
      listBlock.children.forEach(b => (b.listItemType = listType))

      if (listType === 'order') {
        listBlock.start = listBlock.start || 1
      }
      // if the new block is task list, add checkbox
      if (listType === 'task') {
        const listItems = listBlock.children
        listItems.forEach(item => {
          const checkbox = this.createBlock('input')
          checkbox.checked = false
          this.insertBefore(checkbox, item.children[0])
        })
      }
    } else {
      if (start.key === end.key || (start.block.parent && start.block.parent === end.block.parent)) {
        const block = this.getBlock(start.key)
        if (listType === 'task') {
          // 1. first update the block to bullet list
          const listItemParagraph = this.updateList(block, 'bullet')
          // 2. second update bullet list to task list
          setTimeout(() => {
            this.updateTaskListItem(listItemParagraph, listType)
            this.partialRender()
          })
        } else {
          this.updateList(block, listType)
        }
      } else {
        const { parent, startIndex, endIndex } = this.getCommonParent()
        const children = parent ? parent.children : this.blocks
        const referBlock = children[endIndex]
        const listWrapper = this.createBlock(listType === 'order' ? 'ol' : 'ul')
        listWrapper.listType = listType
        if (listType === 'order') listWrapper.start = 1

        children.slice(startIndex, endIndex + 1).forEach(child => {
          if (child !== referBlock) {
            this.removeBlock(child, children)
          } else {
            this.insertAfter(listWrapper, child)
            this.removeBlock(child, children)
          }
          const listItem = this.createBlock('li')
          listItem.listItemType = listType
          listItem.isLooseListItem = preferLooseListItem
          this.appendChild(listWrapper, listItem)
          if (listType === 'task') {
            const checkbox = this.createBlock('input')
            checkbox.checked = false
            this.appendChild(listItem, checkbox)
          }
          this.appendChild(listItem, child)
        })
      }
    }
  }

  ContentState.prototype.handleLooseListItem = function () {
    const { affiliation } = this.selectionChange()
    let listContainer = []
    if (affiliation.length >= 1 && /ul|ol/.test(affiliation[0].type)) {
      listContainer = affiliation[0].children
    } else if (affiliation.length >= 3 && affiliation[1].type === 'li') {
      listContainer = affiliation[2].children
    }
    if (listContainer.length > 0) {
      for (const block of listContainer) {
        block.isLooseListItem = !block.isLooseListItem
      }
      this.partialRender()
    }
  }

  ContentState.prototype.handleCodeBlockMenu = function () {
    const { start, end, affiliation } = this.selectionChange()
    let startBlock = this.getBlock(start.key)
    const endBlock = this.getBlock(end.key)
    const startParents = this.getParents(startBlock)
    const endParents = this.getParents(endBlock)
    const hasFencedCodeBlockParent = () => {
      return startParents.some(b => b.type === 'pre' && b.functionType === 'code') ||
        endParents.some(b => b.type === 'pre' && b.functionType === 'code')
    }
    // change fenced code block to p paragraph
    if (affiliation.length && affiliation[0].type === 'pre' && affiliation[0].functionType === 'code') {
      const codeBlock = affiliation[0]
      this.codeBlocks.delete(codeBlock.key)
      codeBlock.type = 'p'
      codeBlock.children = []
      const lines = codeBlock.text.split(LINE_BREAKS_REG).map(line => this.createBlock('span', line))
      for (const line of lines) {
        this.appendChild(codeBlock, line)
      }

      const { key } = codeBlock.children[codeBlock.selection.anchor.line]
      const offset = codeBlock.selection.ahchor.ch
      delete codeBlock.selection
      delete codeBlock.history
      delete codeBlock.lang
      delete codeBlock.coords
      delete codeBlock.text
      delete codeBlock.codeBlockStyle
      delete codeBlock.functionType
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }
    } else {
      if (start.key === end.key) {
        if (startBlock.type === 'span') {
          startBlock = this.getParent(startBlock)
          startBlock.text = startBlock.children.map(line => line.text).join('\n')
          const line = startBlock.children.findIndex(line => line.key === start.key)
          const ch = start.offset
          startBlock.selection = {
            anchor: { line, ch },
            head: { line, ch }
          }
          startBlock.children = []
        }
        const { key } = startBlock
        const offset = 0
        startBlock.type = 'pre'
        startBlock.codeBlockStyle = 'fenced'
        startBlock.functionType = 'code'
        startBlock.history = null
        startBlock.lang = ''
        this.cursor = {
          start: { key, offset },
          end: { key, offset }
        }
      } else if (!hasFencedCodeBlockParent()) {
        const { parent, startIndex, endIndex } = this.getCommonParent()
        const children = parent ? parent.children : this.blocks
        const referBlock = children[endIndex]
        const codeBlock = this.createBlock('pre')
        codeBlock.codeBlockStyle = 'fenced'
        codeBlock.functionType = 'code'
        codeBlock.history = null
        codeBlock.lang = ''
        const markdown = new ExportMarkdown(children.slice(startIndex, endIndex + 1)).generate()

        codeBlock.text = markdown
        this.insertAfter(codeBlock, referBlock)
        let i
        const removeCache = []
        for (i = startIndex; i <= endIndex; i++) {
          const child = children[i]
          removeCache.push(child)
        }
        removeCache.forEach(b => this.removeBlock(b))
        const key = codeBlock.key
        const offset = 0
        this.cursor = {
          start: { key, offset },
          end: { key, offset }
        }
      }
    }
  }

  ContentState.prototype.handleQuoteMenu = function () {
    const { start, end, affiliation } = this.selectionChange()
    let startBlock = this.getBlock(start.key)
    const isBlockQuote = affiliation.slice(0, 2).filter(b => /blockquote/.test(b.type))
    // change blockquote to paragraph
    if (isBlockQuote.length) {
      const quoteBlock = isBlockQuote[0]
      const children = quoteBlock.children
      for (const child of children) {
        this.insertBefore(child, quoteBlock)
      }
      this.removeBlock(quoteBlock)
    // change paragraph to blockquote
    } else {
      if (start.key === end.key) {
        if (startBlock.type === 'span') {
          startBlock = this.getParent(startBlock)
        }
        const quoteBlock = this.createBlock('blockquote')
        this.insertAfter(quoteBlock, startBlock)
        this.removeBlock(startBlock)
        this.appendChild(quoteBlock, startBlock)
      } else {
        const { parent, startIndex, endIndex } = this.getCommonParent()
        const children = parent ? parent.children : this.blocks
        const referBlock = children[endIndex]
        const quoteBlock = this.createBlock('blockquote')

        children.slice(startIndex, endIndex + 1).forEach(child => {
          if (child !== referBlock) {
            this.removeBlock(child, children)
          } else {
            this.insertAfter(quoteBlock, child)
            this.removeBlock(child, children)
          }
          this.appendChild(quoteBlock, child)
        })
      }
    }
  }

  ContentState.prototype.insertMathBlock = function () {
    const { start, end } = selection.getCursorRange()
    if (start.key !== end.key) return
    let block = this.getBlock(start.key)
    if (block.type === 'span') {
      block = this.getParent(block)
    }
    const mathBlock = this.createMathBlock()
    this.insertAfter(mathBlock, block)
    if (block.type === 'p' && block.children.length === 1 && !block.children[0].text) {
      this.removeBlock(block)
    }
    const cursorBlock = mathBlock.children[0].children[0]
    const { key } = cursorBlock
    const offset = 0
    this.cursor = {
      start: { key, offset },
      end: { key, offset }
    }
  }

  ContentState.prototype.updateParagraph = function (paraType) {
    const { start, end } = selection.getCursorRange()
    const block = this.getBlock(start.key)
    const { type, text } = block

    switch (paraType) {
      case 'front-matter': {
        this.handleFrontMatter()
        break
      }
      case 'ul-bullet':
      case 'ul-task':
      case 'ol-order': {
        this.handleListMenu(paraType)
        break
      }
      case 'loose-list-item': {
        this.handleLooseListItem()
        break
      }
      case 'pre': {
        this.handleCodeBlockMenu()
        break
      }
      case 'blockquote': {
        this.handleQuoteMenu()
        break
      }
      case 'mathblock': {
        this.insertMathBlock()
        break
      }
      case 'heading 1':
      case 'heading 2':
      case 'heading 3':
      case 'heading 4':
      case 'heading 5':
      case 'heading 6':
      case 'upgrade heading':
      case 'degrade heading':
      case 'paragraph': {
        if (start.key !== end.key) return
        const [, hash, partText] = /(^#*)(.*)/.exec(text)
        let newLevel = 0 // 1, 2, 3, 4, 5, 6
        let newType = 'p'
        let key
        if (/\d/.test(paraType)) {
          newLevel = Number(paraType.split(/\s/)[1])
          newType = `h${newLevel}`
        } else if (paraType === 'upgrade heading' || paraType === 'degrade heading') {
          const currentLevel = getCurrentLevel(type)
          newLevel = currentLevel
          if (paraType === 'upgrade heading' && currentLevel !== 1) {
            if (currentLevel === 0) newLevel = 6
            else newLevel = currentLevel - 1
          } else if (paraType === 'degrade heading' && currentLevel !== 0) {
            if (currentLevel === 6) newLevel = 0
            else newLevel = currentLevel + 1
          }
          newType = newLevel === 0 ? 'p' : `h${newLevel}`
        }

        const startOffset = start.offset + newLevel - hash.length + 1
        const endOffset = end.offset + newLevel - hash.length + 1
        const newText = '#'.repeat(newLevel) + ` ${partText}`
        if (block.type === 'span' && newType !== 'p') {
          const header = this.createBlock(newType, newText)
          header.headingStyle = DEFAULT_TURNDOWN_CONFIG.headingStyle
          key = header.key
          const parent = this.getParent(block)
          if (this.isOnlyChild(block)) {
            this.insertBefore(header, parent)
            this.removeBlock(parent)
          } else if (this.isFirstChild(block)) {
            this.insertBefore(header, parent)
            this.removeBlock(block)
          } else if (this.isLastChild(block)) {
            this.insertAfter(header, parent)
            this.removeBlock(block)
          } else {
            const pBlock = this.createBlock('p')
            let nextSibling = this.getNextSibling(block)
            while (nextSibling) {
              this.appendChild(pBlock, nextSibling)
              const oldNextSibling = nextSibling
              nextSibling = this.getNextSibling(nextSibling)
              this.removeBlock(oldNextSibling)
            }
            this.removeBlock(block)
            this.insertAfter(header, parent)
            this.insertAfter(pBlock, header)
          }
        } else if (/^h/.test(block.type) && newType === 'p') {
          const pBlock = this.createBlockP(newText)
          key = pBlock.children[0].key
          this.insertAfter(pBlock, block)
          this.removeBlock(block)
        } else {
          const newHeader = this.createBlock(newType, newText)
          newHeader.headingStyle = DEFAULT_TURNDOWN_CONFIG.headingStyle
          key = newHeader.key
          this.insertAfter(newHeader, block)
          this.removeBlock(block)
        }
        this.cursor = {
          start: { key, offset: startOffset },
          end: { key, offset: endOffset }
        }
        break
      }
      case 'hr': {
        const pBlock = this.createBlockP()
        const archor = block.type === 'span' ? this.getParent(block) : block
        const hrBlock = this.createBlock('hr')
        hrBlock.text = '---'
        this.insertAfter(hrBlock, archor)
        this.insertAfter(pBlock, hrBlock)
        if (!text) {
          if (block.type === 'span' && this.isOnlyChild(block)) {
            this.removeBlock(archor)
          } else {
            this.removeBlock(block)
          }
        }
        const { key } = pBlock.children[0]
        const offset = 0
        this.cursor = {
          start: { key, offset },
          end: { key, offset }
        }
        break
      }
    }
    if (paraType === 'front-matter') {
      this.render()
    } else {
      this.partialRender()
    }
    // update menu status
    const selectionChanges = this.selectionChange()
    this.muya.eventCenter.dispatch('selectionChange', selectionChanges)
  }

  ContentState.prototype.insertParagraph = function (location) {
    const { start, end } = this.cursor
    // if cursor is not in one line or paragraph, can not insert paragraph
    if (start.key !== end.key) return
    let block = this.getBlock(start.key)
    if (block.type === 'span') {
      block = this.getParent(block)
    } else if (/th|td/.test(block.type)) {
      // get figure block from table cell
      block = this.getParent(this.getParent(this.getParent(this.getParent(block))))
    }
    const newBlock = this.createBlockP()
    if (location === 'before') {
      this.insertBefore(newBlock, block)
    } else {
      this.insertAfter(newBlock, block)
    }
    const { key } = newBlock.children[0]
    const offset = 0
    this.cursor = {
      start: { key, offset },
      end: { key, offset }
    }
    this.partialRender()
  }
}

export default paragraphCtrl
