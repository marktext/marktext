import codeMirror, { setMode, setCursorAtLastLine } from '../codeMirror'
import { createInputInCodeBlock } from '../utils/domManipulate'
import { codeMirrorConfig, CLASS_OR_ID } from '../config'

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
      block.text = ''
      block.history = null
      block.lang = match[1]
    }
    return !!match
  }

  ContentState.prototype.pre2CodeMirror = function (isRenderCursor) {
    const { eventCenter } = this
    const pres = document.querySelectorAll(`pre.${CLASS_OR_ID['AG_CODE_BLOCK']}`)
    Array.from(pres).forEach(pre => {
      const id = pre.id
      const block = this.getBlock(id)

      const autofocus = id === this.cursor.start.key && isRenderCursor
      const config = Object.assign(codeMirrorConfig, { autofocus, value: block.text })
      const codeBlock = codeMirror(pre, config)
      const mode = pre.getAttribute('data-lang')
      const input = createInputInCodeBlock(pre)

      const handler = langMode => {
        const {
          name
        } = langMode
        setMode(codeBlock, name)
          .then(m => {
            pre.setAttribute('data-lang', m.name)
            input.value = m.name
            block.lang = m.name.toLowerCase()
            input.blur()
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
        handler({
          name: mode
        })
      }

      if (block.history) {
        codeBlock.setHistory(block.history)
      }

      eventCenter.attachDOMEvent(input, 'keyup', () => {
        const value = input.value
        eventCenter.dispatch('editLanguage', input, value.trim(), handler)
      })

      codeBlock.on('focus', (cm, event) => {
        block.pos = cm.getCursor()
      })

      codeBlock.on('blur', (cm, event) => {
        block.pos = cm.getCursor()
      })

      codeBlock.on('cursorActivity', (cm, event) => {
        block.coords = cm.cursorCoords()
        block.pos = cm.getCursor()
      })

      let lastUndoLength = 0
      codeBlock.on('change', (cm, change) => {
        block.text = cm.getValue()
        block.history = cm.getHistory()

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
