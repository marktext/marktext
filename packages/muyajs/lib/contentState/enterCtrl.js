import selection from '../selection'
import { isOsx } from '../config'

/* eslint-disable no-useless-escape */
const FOOTNOTE_REG = /^\[\^([^\^\[\]\s]+?)(?<!\\)\]:$/
/* eslint-enable no-useless-escape */

const checkAutoIndent = (text, offset) => {
  const pairStr = text.substring(offset - 1, offset + 1)
  return /^(\{\}|\[\]|\(\)|><)$/.test(pairStr)
}
const getCodeblockIndentSpace = (text) => {
  const match = /\n([ \t]*).*$/.exec(text)
  return match ? match[1] : ''
}
const getIndentSpace = (text) => {
  const match = /^(\s*)\S/.exec(text)
  return match ? match[1] : ''
}

const enterCtrl = (ContentState) => {
  // TODO@jocs this function need opti.
  ContentState.prototype.chopBlockByCursor = function(block, key, offset) {
    const newBlock = this.createBlock('p')
    const { children } = block
    const index = children.findIndex((child) => child.key === key)
    const activeLine = this.getBlock(key)
    const { text } = activeLine
    newBlock.children = children.splice(index + 1)
    newBlock.children.forEach((c) => (c.parent = newBlock.key))
    children[index].nextSibling = null
    if (newBlock.children.length) {
      newBlock.children[0].preSibling = null
    }
    if (offset === 0) {
      this.removeBlock(activeLine, children)
      this.prependChild(newBlock, activeLine)
    } else if (offset < text.length) {
      activeLine.text = text.substring(0, offset)
      const newLine = this.createBlock('span', { text: text.substring(offset) })
      this.prependChild(newBlock, newLine)
    }
    return newBlock
  }

  ContentState.prototype.chopBlock = function(block) {
    const parent = this.getParent(block)
    const type = parent.type
    const container = this.createBlock(type)
    const index = this.findIndex(parent.children, block)
    const partChildren = parent.children.splice(index + 1)
    block.nextSibling = null
    partChildren.forEach((b) => {
      this.appendChild(container, b)
    })
    this.insertAfter(container, parent)
    return container
  }

  ContentState.prototype.createRow = function(row, isHeader = false) {
    const tr = this.createBlock('tr')
    const len = row.children.length
    let i
    for (i = 0; i < len; i++) {
      const cell = this.createBlock(isHeader ? 'th' : 'td', {
        align: row.children[i].align,
        column: i
      })
      const cellContent = this.createBlock('span', {
        functionType: 'cellContent'
      })

      this.appendChild(cell, cellContent)
      this.appendChild(tr, cell)
    }
    return tr
  }

  ContentState.prototype.createBlockLi = function(paragraphInListItem) {
    const liBlock = this.createBlock('li')
    if (!paragraphInListItem) {
      paragraphInListItem = this.createBlockP()
    }
    this.appendChild(liBlock, paragraphInListItem)
    return liBlock
  }

  ContentState.prototype.createTaskItemBlock = function(paragraphInListItem, checked = false) {
    const listItem = this.createBlock('li')
    const checkboxInListItem = this.createBlock('input')

    listItem.listItemType = 'task'
    checkboxInListItem.checked = checked

    if (!paragraphInListItem) {
      paragraphInListItem = this.createBlockP()
    }
    this.appendChild(listItem, checkboxInListItem)
    this.appendChild(listItem, paragraphInListItem)
    return listItem
  }

  ContentState.prototype.enterInEmptyParagraph = function(block) {
    if (block.type === 'span') block = this.getParent(block)
    const parent = this.getParent(block)

    let newBlock = null
    if (parent && /blockquote/.test(parent.type)) {
      newBlock = this.createBlockP()
      if (this.isOnlyChild(block)) {
        this.insertAfter(newBlock, parent)
        this.removeBlock(parent)
      } else if (this.isFirstChild(block)) {
        this.insertBefore(newBlock, parent)
      } else if (this.isLastChild(block)) {
        this.insertAfter(newBlock, parent)
      } else {
        this.chopBlock(block)
        this.insertAfter(newBlock, parent)
      }

      this.removeBlock(block)
    } else if (parent && (parent.type === 'ul' || parent.type === 'ol')) {
      // Check if this is the last indent, then we should insert it into the grandparent (the root element) instead
      // This effectively exists the list

      const grandParent = this.getParent(parent)
      const greatGrandParent = this.getParent(grandParent)

      if (greatGrandParent && (greatGrandParent.type === 'ul' || greatGrandParent.type === 'ol')) {
        if (block.listItemType === 'task') {
          const { checked } = parent.children[0]
          newBlock = this.createTaskItemBlock(null, checked)
        } else {
          newBlock = this.createBlockLi()
          newBlock.listItemType = parent.listItemType
          newBlock.bulletMarkerOrDelimiter = parent.bulletMarkerOrDelimiter
        }
        newBlock.isLooseListItem = parent.isLooseListItem

        // Insert the new list item after the grandparent (the parent list item of the current list)
        this.insertAfter(newBlock, grandParent)

        block.children.forEach((child) => {
          if (child.type === 'ul' || child.type === 'ol') this.appendChild(newBlock, child)
        })
        if (block.nextSibling) {
          // Also append all the nextSibilings of the current list item to a ul/ol
          // under the newBlock
          const newULBlock = parent.type === 'ul' ? this.createBlock('ul') : this.createBlock('ol')

          let probe = this.getBlock(block.nextSibling)
          const addedChildKeys = []
          while (probe && probe.parent && probe.parent === parent.key) {
            const nextSibilingSaved = probe.nextSibling // save it before we overwrite it by appending it
            this.appendChild(newULBlock, probe)
            addedChildKeys.push(probe.key)
            probe = this.getBlock(nextSibilingSaved)
          }
          if (newULBlock.children.length > 0) {
            this.appendChild(newBlock, newULBlock)
            // Remove all the added siblings from the current parent
            parent.children = parent.children.filter((child) => !addedChildKeys.includes(child.key))
          }
        }
        // Remove list item from the current parent
        this.removeBlock(block, this.blocks, true)

        newBlock = newBlock.listItemType === 'task' ? newBlock.children[1] : newBlock.children[0]
      } else {
        // We have reached end of indent level, so we should exit the list
        newBlock = this.createBlockP()
        this.insertAfter(newBlock, parent)
        // Any sublists it has should be added after the new paragraph
        let prevBlock = newBlock
        block.children.forEach((child) => {
          if (child.type === 'ul' || child.type === 'ol') {
            this.insertAfter(child, prevBlock)
            prevBlock = child
          }
        })
        // Any nextSibilings it has should be added after the new paragraph
        if (block.nextSibling) {
          // Also append all the nextSibilings of the current list item to a ul
          // under a newBlock
          const newULBlock = parent.type === 'ul' ? this.createBlock('ul') : this.createBlock('ol')
          let probe = this.getBlock(block.nextSibling)
          const addedChildKeys = []
          while (probe && probe.parent && probe.parent === parent.key) {
            const nextSibilingSaved = probe.nextSibling // save it before we overwrite it by appending it
            this.appendChild(newULBlock, probe)
            addedChildKeys.push(probe.key)
            probe = this.getBlock(nextSibilingSaved)
          }
          if (newULBlock.children.length > 0) {
            // Remove all the added siblings from the current parent
            parent.children = parent.children.filter((child) => !addedChildKeys.includes(child.key))
            this.insertAfter(newULBlock, prevBlock)
          }
        }
        this.removeBlock(block, this.blocks, true)
      }

      // If the parent list is now empty, we also need to remove it
      if (parent.children.length === 0) {
        this.removeBlock(parent)
      }
    } else {
      newBlock = this.createBlockP()
      if (block.type === 'li') {
        this.insertAfter(newBlock, parent)
        this.removeBlock(block)
      } else {
        this.insertAfter(newBlock, block)
      }
    }

    const { key } = newBlock.children[0]
    const offset = 0
    this.cursor = {
      start: { key, offset },
      end: { key, offset },
      isEdit: true
    }
    return this.partialRender()
  }

  ContentState.prototype.docEnterHandler = function(event) {
    const { eventCenter } = this.muya
    const { selectedImage } = this
    // Show image selector when you press Enter key and there is already one image selected.
    if (selectedImage) {
      event.preventDefault()
      event.stopPropagation()
      const { imageId, ...imageInfo } = selectedImage
      const imageWrapper = document.querySelector(`#${imageId}`)
      const rect = imageWrapper.getBoundingClientRect()
      const reference = {
        getBoundingClientRect() {
          rect.height = 0 // Put image selector below the top border of image.
          return rect
        }
      }

      eventCenter.dispatch('muya-image-selector', {
        reference,
        imageInfo,
        cb: () => {}
      })
      this.selectedImage = null
    }
  }

  ContentState.prototype.enterHandler = function(event) {
    const { start, end } = selection.getCursorRange()
    if (!start || !end) {
      return event.preventDefault()
    }
    let block = this.getBlock(start.key)
    const { text } = block
    const endBlock = this.getBlock(end.key)
    let parent = this.getParent(block)

    event.preventDefault()

    // Don't allow new lines in language identifiers (GH#569)
    if (block.functionType && block.functionType === 'languageInput') {
      // Jump inside the code block and update code language if necessary
      this.updateCodeLanguage(block, block.text.trim())
      return
    }
    // handle select multiple blocks
    if (start.key !== end.key) {
      const key = start.key
      const offset = start.offset

      const startRemainText = block.text.substring(0, start.offset)

      const endRemainText = endBlock.text.substring(end.offset)

      block.text = startRemainText + endRemainText

      this.removeBlocks(block, endBlock)
      this.cursor = {
        start: { key, offset },
        end: { key, offset },
        isEdit: true
      }
      this.partialRender()
      return this.enterHandler(event)
    }

    // handle select multiple charactors
    if (start.key === end.key && start.offset !== end.offset) {
      const key = start.key
      const offset = start.offset
      block.text = block.text.substring(0, start.offset) + block.text.substring(end.offset)
      this.cursor = {
        start: { key, offset },
        end: { key, offset },
        isEdit: true
      }
      this.partialRender()
      return this.enterHandler(event)
    }

    if (
      block.type === 'span' &&
      block.functionType === 'paragraphContent' &&
      !this.getParent(block).parent &&
      start.offset === text.length &&
      FOOTNOTE_REG.test(text)
    ) {
      event.preventDefault()
      event.stopPropagation()
      // Just to feet the `updateFootnote` API and add one white space.
      block.text += ' '
      const key = block.key
      const offset = block.text.length
      this.cursor = {
        start: { key, offset },
        end: { key, offset },
        isEdit: true
      }
      return this.updateFootnote(this.getParent(block), block)
    }

    // handle `shift + enter` insert `soft line break` or `hard line break`
    // only cursor in `line block` can create `soft line break` and `hard line break`
    // handle line in code block
    if (event.shiftKey && block.type === 'span' && block.functionType === 'paragraphContent') {
      let { offset } = start
      const { text, key } = block
      const indent = getIndentSpace(text)
      block.text = text.substring(0, offset) + '\n' + indent + text.substring(offset)

      offset += 1 + indent.length
      this.cursor = {
        start: { key, offset },
        end: { key, offset },
        isEdit: true
      }
      return this.partialRender()
    } else if (block.type === 'span' && block.functionType === 'codeContent') {
      const { text, key } = block
      const autoIndent = checkAutoIndent(text, start.offset)
      const indent = getCodeblockIndentSpace(text.substring(1, start.offset))
      block.text =
        text.substring(0, start.offset) +
        '\n' +
        (autoIndent ? indent + ' '.repeat(this.tabSize) + '\n' : '') +
        indent +
        text.substring(start.offset)

      let offset = start.offset + 1 + indent.length

      if (autoIndent) {
        offset += this.tabSize
      }

      this.cursor = {
        start: { key, offset },
        end: { key, offset },
        isEdit: true
      }
      return this.partialRender()
    }

    // Insert `<br/>` in table cell if you want to open a new line.
    // Why not use `soft line break` or `hard line break` ?
    // Becasuse table cell only have one line.
    if (event.shiftKey && block.functionType === 'cellContent') {
      const { text, key } = block
      const brTag = '<br/>'
      block.text = text.substring(0, start.offset) + brTag + text.substring(start.offset)
      const offset = start.offset + brTag.length
      this.cursor = {
        start: { key, offset },
        end: { key, offset },
        isEdit: true
      }
      return this.partialRender([block])
    }

    const getFirstBlockInNextRow = (row) => {
      let nextSibling = this.getBlock(row.nextSibling)
      if (!nextSibling) {
        const rowContainer = this.getBlock(row.parent)
        const table = this.getBlock(rowContainer.parent)
        const figure = this.getBlock(table.parent)

        if (rowContainer.type === 'thead' && table.children[1]) {
          nextSibling = table.children[1]
        } else if (figure.nextSibling) {
          nextSibling = this.getBlock(figure.nextSibling)
        } else {
          nextSibling = this.createBlockP()
          this.insertAfter(nextSibling, figure)
        }
      }

      return this.firstInDescendant(nextSibling)
    }

    // handle enter in table
    if (block.functionType === 'cellContent') {
      const row = this.closest(block, 'tr')
      const rowContainer = this.getBlock(row.parent)
      const table = this.closest(rowContainer, 'table')

      if ((isOsx && event.metaKey) || (!isOsx && event.ctrlKey)) {
        const nextRow = this.createRow(row, false)
        if (rowContainer.type === 'thead') {
          let tBody = this.getBlock(rowContainer.nextSibling)
          if (!tBody) {
            tBody = this.createBlock('tbody')
            this.appendChild(table, tBody)
          }
          if (tBody.children.length) {
            this.insertBefore(nextRow, tBody.children[0])
          } else {
            this.appendChild(tBody, nextRow)
          }
        } else {
          this.insertAfter(nextRow, row)
        }
        table.row++
      }

      const { key } = getFirstBlockInNextRow(row)
      const offset = 0

      this.cursor = {
        start: { key, offset },
        end: { key, offset },
        isEdit: true
      }
      return this.partialRender()
    }

    if (block.type === 'span') {
      block = parent
      parent = this.getParent(block)
    }
    const paragraph = document.querySelector(`#${block.key}`)

    // Handles custom enter logic in a list item (should not be selecting the p)

    // we only want to select the li if and only if we are currently in the <p> of an li
    // the <p> is the "text content" of the li
    if (parent && parent.type === 'li' && block.type === 'p') {
      block = parent
      parent = this.getParent(block)
    }
    const left = start.offset
    const right = text.length - left
    const type = block.type
    let newBlock

    switch (true) {
      case left !== 0 && right !== 0: {
        // cursor in the middle
        let { pre, post } = selection.chopHtmlByCursor(paragraph)
        if (/^h\d$/.test(block.type)) {
          if (block.headingStyle === 'atx') {
            const PREFIX = /^#+/.exec(pre)[0]
            post = `${PREFIX} ${post}`
          }
          block.children[0].text = pre
          newBlock = this.createBlock(type, {
            headingStyle: block.headingStyle
          })
          const headerContent = this.createBlock('span', {
            text: post,
            functionType: block.headingStyle === 'atx' ? 'atxLine' : 'paragraphContent'
          })
          this.appendChild(newBlock, headerContent)
          if (block.marker) {
            newBlock.marker = block.marker
          }
        } else if (block.type === 'p') {
          newBlock = this.chopBlockByCursor(block, start.key, start.offset)
        } else if (type === 'li') {
          // handle task item
          if (block.listItemType === 'task') {
            const { checked } = block.children[0] // block.children[0] is input[type=checkbox]
            newBlock = this.chopBlockByCursor(block.children[1], start.key, start.offset)
            newBlock = this.createTaskItemBlock(newBlock, checked)
          } else {
            newBlock = this.chopBlockByCursor(block.children[0], start.key, start.offset)
            newBlock = this.createBlockLi(newBlock)
            newBlock.listItemType = block.listItemType
            newBlock.bulletMarkerOrDelimiter = block.bulletMarkerOrDelimiter

            if (block.children.length > 1) {
              // If we have a sublist, we need to move the sublist (not the contents) to the new block instead of inserting an "empty" block at the next line
              this.appendChild(newBlock, block.children[1])
              this.removeBlock(block.children[1])
            }
          }
          newBlock.isLooseListItem = block.isLooseListItem
        } else if (block.type === 'hr') {
          const preText = text.substring(0, left)
          const postText = text.substring(left)

          // Degrade thematice break to paragraph
          if (preText.replace(/ /g, '').length < 3) {
            block.type = 'p'
            block.children[0].functionType = 'paragraphContent'
          }

          if (postText.replace(/ /g, '').length >= 3) {
            newBlock = this.createBlock('hr')
            const content = this.createBlock('span', {
              functionType: 'thematicBreakLine',
              text: postText
            })
            this.appendChild(newBlock, content)
          } else {
            newBlock = this.createBlockP(postText)
          }

          block.children[0].text = preText
        }

        this.insertAfter(newBlock, block)

        break
      }
      case left === 0 && right === 0: {
        // paragraph is empty
        return this.enterInEmptyParagraph(block)
      }
      case left !== 0 && right === 0:
      case left === 0 && right !== 0: {
        // cursor at end of block or at begin of block
        if (type === 'li') {
          if (block.listItemType === 'task') {
            newBlock = this.createTaskItemBlock(null, false)
          } else {
            newBlock = this.createBlockLi()
            newBlock.listItemType = block.listItemType
            newBlock.bulletMarkerOrDelimiter = block.bulletMarkerOrDelimiter
          }
          newBlock.isLooseListItem = block.isLooseListItem
        } else {
          newBlock = this.createBlockP()
        }

        if (left === 0 && right !== 0) {
          this.insertBefore(newBlock, block)
          newBlock = block
        } else {
          if (block.type === 'p') {
            const lastLine = block.children[block.children.length - 1]
            if (lastLine.text === '') {
              this.removeBlock(lastLine)
            }
          } else if (block.type === 'li') {
            if (block.listItemType === 'task') {
              if (block.children.length > 2) {
                // tasks have an additional input infront, so it is children[2]
                // When we have a sublist, we need to move the sublist (not the contents) to the new block instead of inserting an "empty" block at the next line
                this.appendChild(newBlock, block.children[2])
                this.removeBlock(block.children[2])
              }
            } else {
              if (block.children.length > 1) {
                // When we have a sublist, we need to move the sublist (not the contents) to the new block instead of inserting an "empty" block at the next line
                this.appendChild(newBlock, block.children[1])
                this.removeBlock(block.children[1])
              }
            }
          }
          this.insertAfter(newBlock, block)
        }
        break
      }
      default: {
        newBlock = this.createBlockP()
        this.insertAfter(newBlock, block)
        break
      }
    }

    const getParagraphBlock = (block) => {
      if (block.type === 'li') {
        return block.listItemType === 'task' ? block.children[1] : block.children[0]
      } else {
        return block
      }
    }

    this.codeBlockUpdate(getParagraphBlock(newBlock))
    // If block is pre block when updated, need to focus it.
    const preParagraphBlock = getParagraphBlock(block)
    const blockNeedFocus = this.codeBlockUpdate(preParagraphBlock)
    const tableNeedFocus = this.tableBlockUpdate(preParagraphBlock)
    const htmlNeedFocus = this.updateHtmlBlock(preParagraphBlock)
    const mathNeedFocus = this.updateMathBlock(preParagraphBlock)
    let cursorBlock

    switch (true) {
      case !!blockNeedFocus:
        cursorBlock = block
        break
      case !!tableNeedFocus:
        cursorBlock = tableNeedFocus
        break
      case !!htmlNeedFocus:
        cursorBlock = htmlNeedFocus.children[0].children[0] // the second line
        break
      case !!mathNeedFocus:
        cursorBlock = mathNeedFocus
        break
      default:
        cursorBlock = newBlock
        break
    }

    cursorBlock = getParagraphBlock(cursorBlock)
    const key =
      cursorBlock.type === 'p' || cursorBlock.type === 'pre'
        ? cursorBlock.children[0].key
        : cursorBlock.key
    let offset = 0
    if (htmlNeedFocus) {
      const { text } = cursorBlock
      const match = /^[^\n]+\n[^\n]*/.exec(text)
      offset = match && match[0] ? match[0].length : 0
    }

    this.cursor = {
      start: { key, offset },
      end: { key, offset },
      isEdit: true
    }

    let needRenderAll = false

    if (this.isCollapse() && cursorBlock.type === 'p') {
      this.checkInlineUpdate(cursorBlock.children[0])
      needRenderAll = true
    }
    needRenderAll ? this.render() : this.partialRender()
  }
}

export default enterCtrl
