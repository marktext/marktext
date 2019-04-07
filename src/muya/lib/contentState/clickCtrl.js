import selection from '../selection'
import { HAS_TEXT_BLOCK_REG } from '../config'

const clickCtrl = ContentState => {
  ContentState.prototype.clickHandler = function (event) {
    const { eventCenter } = this.muya
    const { target } = event
    // handle front menu click
    const { start: oldStart, end: oldEnd } = this.cursor
    if (oldStart && oldEnd) {
      let hasSameParent = false
      const startBlock = this.getBlock(oldStart.key)
      const endBlock = this.getBlock(oldEnd.key)
      if (startBlock && endBlock) {
        const startOutBlock = this.findOutMostBlock(startBlock)
        const endOutBlock = this.findOutMostBlock(endBlock)
        hasSameParent = startOutBlock === endOutBlock
      }
      // show the muya-front-menu only when the cursor in the same paragraph
      if (target.closest('.ag-front-icon') && hasSameParent) {
        const currentBlock = this.findOutMostBlock(startBlock)
        const frontIcon = target.closest('.ag-front-icon')
        const rect = frontIcon.getBoundingClientRect()
        const reference = {
          getBoundingClientRect () {
            return rect
          },
          clientWidth: rect.width,
          clientHeight: rect.height,
          id: currentBlock.key
        }
        this.selectedBlock = currentBlock
        eventCenter.dispatch('muya-front-menu', { reference, outmostBlock: currentBlock, startBlock, endBlock })
        return this.partialRender()
      }
    }
    const { start, end } = selection.getCursorRange()
    // fix #625, the selection maybe not in edit area.
    if (!start || !end) {
      return
    }
    // format-click
    const node = selection.getSelectionStart()
    if (node.classList.contains('ag-inline-rule')) {
      let formatType = null
      let data = null
      switch (node.tagName) {
        case 'SPAN': {
          if (node.hasAttribute('data-emoji')) {
            formatType = 'emoji'
            data = node.getAttribute('data-emoji')
          } else if (node.classList.contains('ag-math-text')) {
            formatType = 'inline_math'
            data = node.innerHTML
          }
          break
        }
        case 'A': {
          formatType = 'link' // auto link or []() link
          data = {
            text: node.innerHTML,
            href: node.getAttribute('href')
          }
          break
        }
        case 'STRONG': {
          formatType = 'strong'
          data = node.innerHTML
          break
        }
        case 'EM': {
          formatType = 'em'
          data = node.innerHTML
          break
        }
        case 'DEL': {
          formatType = 'del'
          data = node.innerHTML
          break
        }
        case 'CODE': {
          formatType = 'inline_code'
          data = node.innerHTML
          break
        }
      }
      if (formatType) {
        eventCenter.dispatch('format-click', {
          event,
          formatType,
          data,
        })
      }
    }
    const block = this.getBlock(start.key)
    let needRender = false
    // is show format float box?
    if (
      start.key === end.key &&
      start.offset !== end.offset &&
      HAS_TEXT_BLOCK_REG.test(block.type) &&
      block.functionType !== 'codeLine' &&
      block.functionType !== 'languageInput'
    ) {
      const reference = this.getPositionReference()
      const { formats } = this.selectionFormats()
      eventCenter.dispatch('muya-format-picker', { reference, formats })
    }
    // bugfix: #67 problem 1
    if (block && block.icon) return event.preventDefault()
    // bugfix: figure block click
    if (block.type === 'figure' && block.functionType === 'table') {
      // first cell in thead
      const cursorBlock = block.children[1].children[0].children[0].children[0]
      const offset = cursorBlock.text.length
      const key = cursorBlock.key
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }
      needRender = true
    }

    // update '```xxx' to code block when you click other place or use press arrow key.
    if (block && start.key !== this.cursor.start.key) {
      const oldBlock = this.getBlock(this.cursor.start.key)
      if (oldBlock) {
        needRender = needRender || this.codeBlockUpdate(oldBlock)
      }
    }

    // change active status when paragraph changed
    if (
      start.key !== this.cursor.start.key ||
      end.key !== this.cursor.end.key
    ) {
      needRender = true
    }

    const needMarkedUpdate = this.checkNeedRender(this.cursor) || this.checkNeedRender({ start, end })
    this.cursor = { start, end }
    if (needMarkedUpdate || needRender) {
      return this.partialRender()
    }
  }
}

export default clickCtrl
