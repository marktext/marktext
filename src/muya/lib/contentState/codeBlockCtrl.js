import codeMirror, { setMode, setCursorAtLastLine } from '../codeMirror'
import { createInputInCodeBlock } from '../utils/domManipulate'
import { sanitize, getParagraphReference } from '../utils'
import { codeMirrorConfig, BLOCK_TYPE7, PREVIEW_DOMPURIFY_CONFIG, CLASS_OR_ID } from '../config'

const CODE_UPDATE_REP = /^`{3,}(.*)/

const beautifyHtml = html => {
  const HTML_REG = /^<([a-zA-Z\d-]+)(?=\s|>).*?>/
  const HTML_NEWLINE_REG = /^<([a-zA-Z\d-]+)(?=\s|>).*?>\n/
  const match = HTML_REG.exec(html)
  const tag = match ? match[1] : null
  // no empty line in block html
  let result = html // .split(/\n/).filter(line => /\S/.test(line)).join('\n')
  // start inline tag must ends with `\n`
  if (tag) {
    if (BLOCK_TYPE7.indexOf(tag) > -1 && !HTML_NEWLINE_REG.test(html)) {
      result = result.replace(HTML_REG, (m, p) => `${m}\n`)
    }
  }
  return result
}

const codeBlockCtrl = ContentState => {
  ContentState.prototype.selectLanguage = function (paragraph, name) {
    const block = this.getBlock(paragraph.id)
    block.text = block.text.replace(/^(`+)([^`]+$)/g, `$1${name}`)
    this.codeBlockUpdate(block)
    this.partialRender()
  }
  // Fix bug: when click the edge at the code block, the code block will be not focused.
  ContentState.prototype.focusCodeBlock = function (event) {
    const key = event.target.id
    const offset = 0

    this.cursor = {
      start: { key, offset },
      end: { key, offset }
    }
    this.partialRender()
  }
  /**
   * [codeBlockUpdate if block updated to `pre` return true, else return false]
   */
  ContentState.prototype.codeBlockUpdate = function (block, code = '', lang) {
    if (block.type === 'span') {
      block = this.getParent(block)
    }
    // if it's not a p block, no need to update
    if (block.type !== 'p') return false
    // if p block's children are more than one, no need to update
    if (block.children.length !== 1) return false
    const { text } = block.children[0]
    const match = CODE_UPDATE_REP.exec(text)
    if (match || lang) {
      block.type = 'pre'
      block.functionType = 'code'
      block.codeBlockStyle = 'fenced'
      block.text = code
      block.history = null
      block.lang = lang || (match ? match[1] : '')
      block.children = []
      const { key } = block
      const offset = 0
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }
      return true
    }
    return false
  }

  ContentState.prototype.pre2CodeMirror = function (isRenderCursor, blocks) {
    const { eventCenter } = this.muya
    let selector = ''
    if (blocks) {
      selector = blocks.map(({ type, key }) => {
        if (type === 'pre') {
          return `pre#${key}.${CLASS_OR_ID['AG_CODEMIRROR_BLOCK']}`
        } else {
          return `#${key} pre.${CLASS_OR_ID['AG_CODEMIRROR_BLOCK']}`
        }
      }).join(', ')
    } else {
      selector = `pre.${CLASS_OR_ID['AG_CODEMIRROR_BLOCK']}`
    }

    const pres = document.querySelectorAll(selector)

    Array.from(pres).forEach(pre => {
      // If pre element has children, means that this code block is not editing,
      // and don't need to update to codeMirror.
      if (pre.children.length) return
      const id = pre.id
      const block = this.getBlock(id)
      const value = block.text
      const autofocus = id === this.cursor.start.key && isRenderCursor
      const config = Object.assign(codeMirrorConfig, { autofocus, value })
      const codeBlock = codeMirror(pre, config)
      const mode = pre.getAttribute('data-lang')
      let input
      if (block.functionType === 'code') {
        input = createInputInCodeBlock(pre)
      }

      const handler = ({ name }) => {
        setMode(codeBlock, name)
          .then(m => {
            pre.setAttribute('data-lang', m.name)
            block.lang = m.name.toLowerCase()
            // change indent code block to fence code block
            if (block.codeBlockStyle !== 'fenced') {
              block.codeBlockStyle = 'fenced'
            }
            if (input) {
              input.value = m.name
              input.blur()
            }
            if (this.cursor.start.key === block.key && isRenderCursor) {
              if (block.selection) {
                codeBlock.focus()
                const { anchor, head } = block.selection
                codeBlock.setSelection(anchor, head)
              } else {
                setCursorAtLastLine(codeBlock)
              }
            }
          })
          .catch(err => {
            console.warn(err)
          })
      }

      this.codeBlocks.set(id, codeBlock)

      if (mode) {
        handler({ name: mode })
      }

      if (block.selection && this.cursor.start.key === block.key && isRenderCursor) {
        const { anchor, head } = block.selection
        codeBlock.focus()
        codeBlock.setSelection(anchor, head)
      }

      if (block.history) {
        codeBlock.setHistory(block.history)
      }

      if (input) {
        eventCenter.attachDOMEvent(input, 'input', () => {
          const value = input.value
          eventCenter.dispatch('muya-code-picker', {
            reference: getParagraphReference(input, id),
            lang: value.trim(),
            cb: handler
          })
        })
      }

      codeBlock.on('focus', (cm, event) => {
        block.selection = cm.listSelections()[0]
      })

      codeBlock.on('blur', (cm, event) => {
        block.selection = cm.listSelections()[0]
        if (block.functionType === 'html') {
          const value = cm.getValue()

          block.text = beautifyHtml(value)
        }
      })

      codeBlock.on('cursorActivity', (cm, event) => {
        block.coords = cm.cursorCoords()
        block.selection = cm.listSelections()[0]
      })

      let lastUndoLength = 0
      codeBlock.on('change', (cm, change) => {
        const value = cm.getValue()
        block.text = value
        block.history = cm.getHistory()
        if (block.functionType === 'html') {
          const preBlock = this.getNextSibling(block)
          const htmlBlock = this.getParent(this.getParent(block))
          const escapedHtml = sanitize(block.text, PREVIEW_DOMPURIFY_CONFIG)
          htmlBlock.text = block.text
          const preEle = document.querySelector(`#${preBlock.key}`)
          preEle.innerHTML = escapedHtml
          preBlock.htmlContent = escapedHtml
        }
        const { undo } = cm.historySize()
        if (undo > lastUndoLength) {
          this.history.push({
            type: 'codeBlock',
            id
          })
          lastUndoLength = undo
        }
      })
    })
  }
}

export default codeBlockCtrl
