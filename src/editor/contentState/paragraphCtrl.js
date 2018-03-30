import selection from '../selection'
import { PARAGRAPH_TYPES } from '../config'
import ExportMarkdown from '../utils/exportMarkdown'

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
  ContentState.prototype.selectionChange = function (fontSize = 16, lineHeight = 1.6) {
    const { start, end } = selection.getCursorRange()
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

    if (start.type === 'pre' && end.type === 'pre') {
      const preElement = document.querySelector(`#${start.key}`)
      const { top } = preElement.getBoundingClientRect()
      const { line } = start.block.pos
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

  ContentState.prototype.handleListMenu = function (paraType) {
    const { start, end, affiliation } = this.selectionChange()
    const [blockType, listType] = paraType.split('-')
    const isListed = affiliation.slice(0, 3).filter(b => /ul|ol/.test(b.type))

    if (isListed.length && listType !== isListed[0].listType) {
      const listBlock = isListed[0]
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
      if (start.key === end.key) {
        const block = this.getBlock(start.key)
        if (listType === 'task') {
          // 1. first update the block to bullet list
          const listItemParagraph = this.updateList(block, 'bullet')
          // 2. second update bullet list to task list
          setTimeout(() => {
            this.updateTaskListItem(listItemParagraph, listType)
            this.render()
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
        this.insertAfter(listWrapper, referBlock)
        if (listType === 'order') listWrapper.start = 1
        let i
        let child
        const removeCache = []
        for (i = startIndex; i <= endIndex; i++) {
          child = children[i]
          removeCache.push(child)
          const listItem = this.createBlock('li')
          listItem.listItemType = listType
          this.appendChild(listWrapper, listItem)
          if (listType === 'task') {
            const checkbox = this.createBlock('input')
            checkbox.checked = false
            this.appendChild(listItem, checkbox)
          }
          this.appendChild(listItem, child)
        }
        removeCache.forEach(b => this.removeBlock(b))
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
      this.render()
    }
  }

  ContentState.prototype.handleCodeBlockMenu = function () {
    const { start, end, affiliation } = this.selectionChange()
    const startBlock = this.getBlock(start.key)
    const endBlock = this.getBlock(end.key)
    const startParents = this.getParents(startBlock)
    const endParents = this.getParents(endBlock)
    const hasPreParent = () => {
      return startParents.some(b => b.type === 'pre') || endParents.some(b => b.type === 'pre')
    }
    if (affiliation.length && affiliation[0].type === 'pre') {
      const codeBlock = affiliation[0]
      delete codeBlock.pos
      delete codeBlock.history
      delete codeBlock.lang
      this.codeBlocks.delete(codeBlock.key)
      codeBlock.type = 'p'
      const key = codeBlock.key
      const offset = codeBlock.text.length
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }
    } else {
      if (start.key === end.key) {
        startBlock.type = 'pre'
        startBlock.history = null
        startBlock.lang = ''
      } else if (!hasPreParent()) {
        const { parent, startIndex, endIndex } = this.getCommonParent()
        const children = parent ? parent.children : this.blocks
        const referBlock = children[endIndex]
        const codeBlock = this.createBlock('pre')
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
        this.cursor = {
          start: { key, offset: 0 },
          end: { key, offset: 0 }
        }
      }
    }
  }

  ContentState.prototype.handleQuoteMenu = function () {
    const { start, end, affiliation } = this.selectionChange()
    const startBlock = this.getBlock(start.key)
    const isBlockQuote = affiliation.slice(0, 2).filter(b => /blockquote/.test(b.type))
    if (isBlockQuote.length) {
      const quoteBlock = isBlockQuote[0]
      const children = quoteBlock.children
      for (const child of children) {
        this.insertBefore(child, quoteBlock)
      }
      this.removeBlock(quoteBlock)
    } else {
      if (start.key === end.key) {
        const quoteBlock = this.createBlock('blockquote')
        this.insertAfter(quoteBlock, startBlock)
        this.removeBlock(startBlock)
        this.appendChild(quoteBlock, startBlock)
      } else {
        const { parent, startIndex, endIndex } = this.getCommonParent()
        const children = parent ? parent.children : this.blocks
        const referBlock = children[endIndex]
        const quoteBlock = this.createBlock('blockquote')
        this.insertAfter(quoteBlock, referBlock)
        let i
        const removeCache = []
        for (i = startIndex; i <= endIndex; i++) {
          const child = children[i]
          removeCache.push(child)
          this.appendChild(quoteBlock, child)
        }

        removeCache.forEach(b => this.removeBlock(b))
      }
    }
  }

  ContentState.prototype.updateParagraph = function (paraType) {
    const { start, end } = selection.getCursorRange()
    const block = this.getBlock(start.key)
    const { type, text } = block

    switch (paraType) {
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
      case 'heading 1':
      case 'heading 2':
      case 'heading 3':
      case 'heading 4':
      case 'heading 5':
      case 'heading 6':
      case 'upgrade heading':
      case 'degrade heading':
      case 'paragraph': {
        const [, hash, partText] = /(^#*)(.*)/.exec(text)
        let newLevel = 0
        let newType = 'p'
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

        start.offset += newLevel - hash.length
        end.offset += newLevel - hash.length
        block.text = '#'.repeat(newLevel) + partText
        block.type = newType
        this.cursor = { start, end }
        break
      }
      case 'hr': {
        const newBlock = this.createBlock('p')
        let hrBlock
        if (text) {
          hrBlock = this.createBlock('hr')
          hrBlock.text = '---'
          this.insertAfter(hrBlock, block)
          this.insertAfter(newBlock, hrBlock)
        } else {
          block.type = 'hr'
          block.text = '---'
          this.insertAfter(newBlock, block)
        }
        const key = newBlock.key
        const offset = 0
        this.cursor = {
          start: { key, offset },
          end: { key, offset }
        }
        break
      }
    }
    this.render()
  }
}

export default paragraphCtrl
