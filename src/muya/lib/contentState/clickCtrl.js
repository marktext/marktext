import selection from '../selection'
import { HAS_TEXT_BLOCK_REG } from '../config'

const clickCtrl = ContentState => {
  ContentState.prototype.clickHandler = function (event) {
    const { eventCenter } = this.muya
    const { start, end } = selection.getCursorRange()
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
