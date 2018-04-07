import beautify from 'js-beautify'
import codeMirror, { setMode, setCursorAtLastLine } from '../codeMirror'
import { createInputInCodeBlock } from '../utils/domManipulate'
import { escapeInBlockHtml } from '../utils'
import { codeMirrorConfig, CLASS_OR_ID, htmlBeautifyConfig } from '../config'

const beautifyHtml = beautify.html
const CODE_UPDATE_REP = /^`{3,}(.*)/

const codeBlockCtrl = ContentState => {
  ContentState.prototype.selectLanguage = function (paragraph, name) {
    const block = this.getBlock(paragraph.id)
    block.text = block.text.replace(/^(`+)([^`]+$)/g, `$1${name}`)
    this.codeBlockUpdate(block)
    this.render()
  }
  // Fix bug: when click the edge at the code block, the code block will be not focused.
  ContentState.prototype.focusCodeBlock = function (event) {
    const key = event.target.id
    const offset = 0

    this.cursor = {
      start: { key, offset },
      end: { key, offset }
    }
    this.render()
  }
  /**
   * [codeBlockUpdate if block updated to `pre` return true, else return false]
   */
  ContentState.prototype.codeBlockUpdate = function (block) {
    const match = CODE_UPDATE_REP.exec(block.text)
    if (match) {
      block.type = 'pre'
      block.functionType = 'code'
      block.text = ''
      block.history = null
      block.lang = match[1]
    }
    return !!match
  }

  ContentState.prototype.pre2CodeMirror = function (isRenderCursor) {
    const { eventCenter } = this
    const selector = `pre.${CLASS_OR_ID['AG_CODE_BLOCK']}, pre.${CLASS_OR_ID['AG_HTML_BLOCK']}`
    const pres = document.querySelectorAll(selector)
    Array.from(pres).forEach(pre => {
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
            if (input) {
              input.value = m.name
              input.blur()
            }
            if (this.cursor.start.key === block.key && isRenderCursor) {
              if (block.pos) {
                codeBlock.focus()
                codeBlock.setCursor(block.pos)
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

      if (block.pos && this.cursor.start.key === block.key && isRenderCursor) {
        codeBlock.focus()
        codeBlock.setCursor(block.pos)
      }

      if (block.history) {
        codeBlock.setHistory(block.history)
      }

      if (input) {
        eventCenter.attachDOMEvent(input, 'keyup', () => {
          const value = input.value
          eventCenter.dispatch('editLanguage', input, value.trim(), handler)
        })
      }

      codeBlock.on('focus', (cm, event) => {
        block.pos = cm.getCursor()
      })

      codeBlock.on('blur', (cm, event) => {
        block.pos = cm.getCursor()
        if (block.functionType === 'html') {
          // todo @jocs beautifyHtml is not work ???
          block.text = beautifyHtml(cm.getValue(), htmlBeautifyConfig)
        }
      })

      codeBlock.on('cursorActivity', (cm, event) => {
        block.coords = cm.cursorCoords()
        block.pos = cm.getCursor()
      })

      let lastUndoLength = 0
      codeBlock.on('change', (cm, change) => {
        const value = cm.getValue()
        block.text = value
        block.history = cm.getHistory()
        // todo handle preview in HTML block
        if (block.functionType === 'html') {
          const preBlock = this.getNextSibling(block)
          const htmlBlock = this.getParent(this.getParent(block))
          const escapedHtml = escapeInBlockHtml(block.text)
          htmlBlock.text = block.text
          const preEle = document.querySelector(`#${preBlock.key}`)
          console.log(block.text, escapedHtml)
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
