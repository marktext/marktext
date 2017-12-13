import codeMirror, {
  setMode, setCursorAtLastLine
} from '../codeMirror'

import { createInputInCodeBlock } from '../utils/domManipulate'
import { codeMirrorConfig, CLASS_OR_ID } from '../config'
import floatBox from '../floatBox'
import eventCenter from '../event'

const CODE_UPDATE_REP = /^`{3,}(.*)/

const codeBlockCtrl = ContentState => {
  /**
   * [codeBlockUpdate if block updated to `pre` return true, else return false]
   */
  ContentState.prototype.codeBlockUpdate = function (block) {
    const match = CODE_UPDATE_REP.exec(block.text)
    if (match) {
      block.type = 'pre'
      block.text = ''
      block.lang = match[1]
    }
    return !!match
  }

  ContentState.prototype.pre2CodeMirror = function () {
    const pres = document.querySelectorAll(`pre.${CLASS_OR_ID['AG_CODE_BLOCK']}`)
    Array.from(pres).forEach(pre => {
      if (this.codeBlocks.has(pre.id)) return false

      pre.innerHTML = ''
      const id = pre.id
      const block = this.getBlock(id)
      const autofocus = id === this.cursor.key
      const config = Object.assign(codeMirrorConfig, { autofocus })
      const codeBlock = codeMirror(pre, config)
      const mode = pre.getAttribute('data-lang')
      const input = createInputInCodeBlock(pre)

      const handler = langMode => {
        const {
          mode
        } = langMode
        setMode(codeBlock, mode)
          .then(mode => {
            pre.setAttribute('data-lang', mode.name)
            input.value = mode.name
            block.lang = mode.name.toLowerCase()
            input.blur()
            if (this.cursor.key === block.key) {
              if (block.pos) {
                codeBlock.setCursor(block.pos)
              } else {
                setCursorAtLastLine(codeBlock)
              }
            }
          })
          .catch(err => {
            console.warn(err)
          })
        floatBox.hideIfNeeded()
      }

      if (block.text) {
        codeBlock.setValue(block.text)
      }

      this.codeBlocks.set(id, codeBlock)

      if (mode) {
        handler({
          mode
        })
      }

      if (block.pos && this.cursor.key === block.key) codeBlock.setCursor(block.pos)

      eventCenter.attachDOMEvent(input, 'keyup', () => {
        const value = input.value
        eventCenter.dispatch('editLanguage', input, value.trim(), handler)
      })

      codeBlock.on('focus', event => {
        block.pos = codeBlock.getCursor()
      })
      codeBlock.on('blur', event => {
        block.pos = codeBlock.getCursor()
      })
    })
  }
}

export default codeBlockCtrl
