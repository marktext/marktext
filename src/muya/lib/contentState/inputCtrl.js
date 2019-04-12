import selection from '../selection'
import { getTextContent } from '../selection/dom'
import { beginRules } from '../parser/rules'
import { tokenizer } from '../parser/'
import { CLASS_OR_ID } from '../config'

const BRACKET_HASH = {
  '{': '}',
  '[': ']',
  '(': ')',
  '*': '*',
  '_': '_',
  '"': '"',
  '\'': '\'',
  '$': '$',
  '~': '~'
}

const BACK_HASH = {
  '}': '{',
  ']': '[',
  ')': '(',
  '*': '*',
  '_': '_',
  '"': '"',
  '\'': '\'',
  '$': '$',
  '~': '~'
}

const inputCtrl = ContentState => {
  // Input @ to quick insert paragraph
  ContentState.prototype.checkQuickInsert = function (block) {
    const { type, text, functionType } = block
    if (type !== 'span' || functionType) return false
    return /^@\S*$/.test(text)
  }

  ContentState.prototype.checkCursorInInlineMath = function (text, offset) {
    const tokens = tokenizer(text, [], false)
    return tokens.filter(t => t.type === 'inline_math').some(t => offset >= t.range.start && offset <= t.range.end)
  }

  ContentState.prototype.checkNotSameToken = function (oldText, text) {
    const oldTokens = tokenizer(oldText)
    const tokens = tokenizer(text)

    const oldCache = {}
    const cache = {}

    for (const { type } of oldTokens) {
      if (oldCache[type]) {
        oldCache[type]++
      } else {
        oldCache[type] = 1
      }
    }

    for (const { type } of tokens) {
      if (cache[type]) {
        cache[type]++
      } else {
        cache[type] = 1
      }
    }

    if (Object.keys(oldCache).length !== Object.keys(cache).length) {
      return true
    }

    for (const key of Object.keys(oldCache)) {
      if (!cache[key] || oldCache[key] !== cache[key]) {
        return true
      }
    }

    return false
  }

  ContentState.prototype.inputHandler = function (event) {
    const { start, end } = selection.getCursorRange()
    if (!start || !end) {
      return
    }

    const { start: oldStart, end: oldEnd } = this.cursor
    const key = start.key
    const block = this.getBlock(key)
    const paragraph = document.querySelector(`#${key}`)
    let text = getTextContent(paragraph, [ CLASS_OR_ID['AG_MATH_RENDER'], CLASS_OR_ID['AG_RUBY_RENDER'] ])
    let needRender = false
    let needRenderAll = false

    if (oldStart.key !== oldEnd.key) {
      const startBlock = this.getBlock(oldStart.key)
      const startOutmostBlock = this.findOutMostBlock(startBlock)
      const endBlock = this.getBlock(oldEnd.key)
      const endOutmostBlock = this.findOutMostBlock(endBlock)
      if (
        // fix #918.
        startBlock.functionType === 'languageInput' &&
        startOutmostBlock === endOutmostBlock &&
        !endBlock.nextSibling
      ) {
        this.removeBlocks(startBlock, endBlock, false)
        endBlock.text = ''
      } else {
        this.removeBlocks(startBlock, endBlock)
      }
      if (this.blocks.length === 1) {
        needRenderAll = true
      }
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
        const prePreInputChar = text.charAt(+offset - 3)
        const postInputChar = text.charAt(+offset)

        if (/^delete/.test(event.inputType)) {
          // handle `deleteContentBackward` or `deleteContentForward`
          const deletedChar = block.text[offset]
          if (event.inputType === 'deleteContentBackward' && postInputChar === BRACKET_HASH[deletedChar]) {
            needRender = true
            text = text.substring(0, offset) + text.substring(offset + 1)
          }
          if (event.inputType === 'deleteContentForward' && inputChar === BACK_HASH[deletedChar]) {
            needRender = true
            start.offset -= 1
            end.offset -= 1
            text = text.substring(0, offset - 1) + text.substring(offset)
          }
          /* eslint-disable no-useless-escape */
        } else if (
          (event.inputType.indexOf('delete') === -1) &&
          (inputChar === postInputChar) &&
          (
            (autoPairQuote && /[']{1}/.test(inputChar)) ||
            (autoPairQuote && /["]{1}/.test(inputChar)) ||
            (autoPairBracket && /[\}\]\)]{1}/.test(inputChar)) ||
            (autoPairMarkdownSyntax && /[$]{1}/.test(inputChar)) ||
            (autoPairMarkdownSyntax && /[*$`~_]{1}/.test(inputChar)) && /[_*~]{1}/.test(prePreInputChar)
          )
        ) {
          needRender = true
          text = text.substring(0, offset) + text.substring(offset + 1)
        } else {
          /* eslint-disable no-useless-escape */
          // Not Unicode aware, since things like \p{Alphabetic} or \p{L} are not supported yet
          const isInInlineMath = this.checkCursorInInlineMath(text, offset)
          if (
            !/\\/.test(preInputChar) &&
            ((autoPairQuote && /[']{1}/.test(inputChar) && !(/[a-zA-Z\d]{1}/.test(preInputChar))) ||
            (autoPairQuote && /["]{1}/.test(inputChar)) ||
            (autoPairBracket && /[\{\[\(]{1}/.test(inputChar)) ||
            (block.functionType !== 'codeLine' && !isInInlineMath && autoPairMarkdownSyntax && /[*$`~_]{1}/.test(inputChar)))
          ) {
            needRender = true
            text = BRACKET_HASH[event.data]
              ? text.substring(0, offset) + BRACKET_HASH[inputChar] + text.substring(offset)
              : text
          }
          /* eslint-enable no-useless-escape */
          // Delete the last `*` of `**` when you insert one space between `**` to create a bullet list.
          if (
            /\s/.test(event.data) &&
            /^\* /.test(text) &&
            preInputChar === '*' &&
            postInputChar === '*'
            ) {
            text = text.substring(0, offset) + text.substring(offset + 1)
            needRender = true
          }
        }
      }

      if (this.checkNotSameToken(block.text, text)) {
        needRender = true
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

    this.muya.eventCenter.dispatch('muya-quick-insert', reference, block, !!checkQuickInsert)

    // Update preview content of math block
    if (block && block.type === 'span' && block.functionType === 'codeLine') {
      needRender = true
      this.updateCodeBlocks(block)
    }

    this.cursor = { start, end }
    const checkMarkedUpdate = this.checkNeedRender()
    const inlineUpdatedBlock = this.isCollapse() && this.checkInlineUpdate(block)
    // just for fix #707,need render All if in combines pre list and next list into one list.
    if (inlineUpdatedBlock) {
      const liBlock = this.getParent(inlineUpdatedBlock)
      if (liBlock && liBlock.type === 'li' && liBlock.preSibling && liBlock.nextSibling) {
        needRenderAll = true
      }
    }
    if (checkMarkedUpdate || inlineUpdatedBlock || needRender) {
      return needRenderAll ? this.render() : this.partialRender()
    }
  }
}

export default inputCtrl
