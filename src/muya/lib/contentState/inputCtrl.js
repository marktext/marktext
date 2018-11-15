import selection from '../selection'
import { getTextContent } from '../selection/dom'
import { beginRules } from '../parser/rules'
import { CLASS_OR_ID } from '../config'

const BRACKET_HASH = {
  '{': '}',
  '[': ']',
  '(': ')',
  '*': '*',
  '_': '_',
  '"': '"',
  '\'': '\''
}

const inputCtrl = ContentState => {
  // Input @ to quick insert paragraph
  ContentState.prototype.checkQuickInsert = function (block) {
    const { type, text, functionType } = block
    if (type !== 'span' || functionType) return false
    return /^@[a-zA-Z\d]*$/.test(text)
  }

  ContentState.prototype.inputHandler = function (event) {
    const { start, end } = selection.getCursorRange()
    const { start: oldStart, end: oldEnd } = this.cursor
    const key = start.key
    const block = this.getBlock(key)
    const paragraph = document.querySelector(`#${key}`)
    let text = getTextContent(paragraph, [ CLASS_OR_ID['AG_MATH_RENDER'] ])
    let needRender = false
    let needRenderAll = false

    if (oldStart.key !== oldEnd.key) {
      const startBlock = this.getBlock(oldStart.key)
      const endBlock = this.getBlock(oldEnd.key)
      this.removeBlocks(startBlock, endBlock)
      needRender = true
    }

    // auto pair (not need to auto pair in math block)
    if (block && block.text !== text) {
      if (
        start.key === end.key &&
        start.offset === end.offset &&
        event.type === 'input'
      ) {
        const { offset } = start
        const { autoPairBracket, autoPairMarkdownSyntax, autoPairQuote } = this
        const inputChar = text.charAt(+offset - 1)
        const preInputChar = text.charAt(+offset - 2)
        const postInputChar = text.charAt(+offset)
        /* eslint-disable no-useless-escape */
        if (
          (event.inputType.indexOf('delete') === -1) &&
          (inputChar === postInputChar) &&
          (
            (autoPairQuote && /[']{1}/.test(inputChar)) ||
            (autoPairQuote && /["]{1}/.test(inputChar)) ||
            (autoPairBracket && /[\}\]\)]{1}/.test(inputChar)) ||
            (autoPairMarkdownSyntax && /[*_]{1}/.test(inputChar))
          )
        ) {
          text = text.substring(0, offset) + text.substring(offset + 1)
        } else {
          /* eslint-disable no-useless-escape */
          // Not Unicode aware, since things like \p{Alphabetic} or \p{L} are not supported yet
          if (
            (autoPairQuote && /[']{1}/.test(inputChar) && !(/[a-zA-Z\d]{1}/.test(preInputChar))) ||
            (autoPairQuote && /["]{1}/.test(inputChar)) ||
            (autoPairBracket && /[\{\[\(]{1}/.test(inputChar)) ||
            (block.functionType !== 'codeLine' && autoPairMarkdownSyntax && /[*_]{1}/.test(inputChar))
          ) {
            needRender = true
            text = BRACKET_HASH[event.data]
              ? text.substring(0, offset) + BRACKET_HASH[inputChar] + text.substring(offset)
              : text
          }
          /* eslint-enable no-useless-escape */
          if (/\s/.test(event.data) && preInputChar === '*' && postInputChar === '*') {
            text = text.substring(0, offset) + text.substring(offset + 1)
          }
        }
      }
      block.text = text
      if (beginRules['reference_definition'].test(text)) {
        needRenderAll = true
      }
    }

    // show quick insert
    const rect = paragraph.getBoundingClientRect()
    const checkQuickInsert = this.checkQuickInsert(block)
    const reference = this.getPositionReference()
    reference.getBoundingClientRect = function () {
      const { x, y, left, top, height, bottom } = rect

      return Object.assign({}, {
        left,
        x,
        top,
        y,
        bottom,
        height,
        width: 0,
        right: left
      })
    }

    this.muya.eventCenter.dispatch('muya-quick-insert', reference, block, checkQuickInsert)

    // Update preview content of math block
    if (block && block.type === 'span' && block.functionType === 'codeLine') {
      needRender = true
      this.updateCodeBlocks(block)
    }

    this.cursor = { start, end }
    const checkMarkedUpdate = this.checkNeedRender()
    const inlineUpdatedBlock = this.isCollapse() && this.checkInlineUpdate(block)
    if (checkMarkedUpdate || inlineUpdatedBlock || needRender) {
      return needRenderAll ? this.render() : this.partialRender()
    }
  }
}

export default inputCtrl
