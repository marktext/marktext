import { EVENT_KEYS, CLASS_OR_ID } from '../config'
import selection from '../selection'
import { findNearestParagraph } from '../selection/dom'
import { getParagraphReference } from '../utils'
import { checkEditLanguage } from '../codeMirror/language'
import { checkEditEmoji } from '../ui/emojis'

class Keyboard {
  constructor (muya) {
    this.muya = muya
    this._isEditChinese = false
    this.shownFloat = new Set()
    this.recordEditChinese()
    this.dispatchUpdateState()
    this.keydownBinding()
    this.keyupBinding()
    this.inputBinding()
    this.listen()
  }

  listen () {
    // cache shown float box
    this.muya.eventCenter.subscribe('muya-float', (name, status) => {
      status ? this.shownFloat.add(name) : this.shownFloat.delete(name)
    })
  }

  recordEditChinese () {
    const { container, eventCenter } = this.muya
    const handler = event => {
      if (event.type === 'compositionstart') {
        this._isEditChinese = true
      } else if (event.type === 'compositionend') {
        this._isEditChinese = false
      }
    }

    eventCenter.attachDOMEvent(container, 'compositionend', handler)
    eventCenter.attachDOMEvent(container, 'compositionstart', handler)
  }

  dispatchUpdateState () {
    const { container, eventCenter, contentState } = this.muya

    let timer = null
    const changeHandler = event => {
      const target = event.target
      if (event.type === 'click' && target.classList.contains(CLASS_OR_ID['AG_FUNCTION_HTML'])) return
      if (event.type === 'keyup' && (event.key === EVENT_KEYS.ArrowUp || event.key === EVENT_KEYS.ArrowDown) && this.shownFloat.size > 0) return
      if (!this._isEditChinese) {
        contentState.updateState(event)
      }
      if (event.type === 'click' || event.type === 'keyup') {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
          const selectionChanges = contentState.selectionChange()
          const { formats } = contentState.selectionFormats()
          eventCenter.dispatch('selectionChange', selectionChanges)
          eventCenter.dispatch('selectionFormats', formats)
          this.muya.dispatchChange()
        })
      }
    }

    eventCenter.attachDOMEvent(container, 'click', changeHandler)
    eventCenter.attachDOMEvent(container, 'keyup', changeHandler)
    eventCenter.attachDOMEvent(container, 'input', changeHandler)
  }

  keydownBinding () {
    const { container, eventCenter, contentState } = this.muya

    const handler = event => {
      if (
        this.shownFloat.size > 0 &&
        (
          event.key === EVENT_KEYS.Enter ||
          event.key === EVENT_KEYS.Escape ||
          event.key === EVENT_KEYS.Tab ||
          event.key === EVENT_KEYS.ArrowUp ||
          event.key === EVENT_KEYS.ArrowDown
        )
      ) {
        event.stopPropagation()
        event.preventDefault()
        return
      }
      switch (event.key) {
        case EVENT_KEYS.Backspace:
          contentState.backspaceHandler(event)
          break
        case EVENT_KEYS.Delete:
          contentState.deleteHandler(event)
          break
        case EVENT_KEYS.Enter:
          if (!this._isEditChinese) {
            contentState.enterHandler(event)
          }
          break
        case 'a':
          if (event.ctrlKey) {
            contentState.tableCellHandler(event)
          }
          break
        case EVENT_KEYS.ArrowUp: // fallthrough
        case EVENT_KEYS.ArrowDown: // fallthrough
        case EVENT_KEYS.ArrowLeft: // fallthrough
        case EVENT_KEYS.ArrowRight: // fallthrough
          if (!this._isEditChinese) {
            contentState.arrowHandler(event)
          }
          break
        case EVENT_KEYS.Tab:
          contentState.tabHandler(event)
          break
        default:
          break
      }
    }

    eventCenter.attachDOMEvent(container, 'keydown', handler)
  }

  inputBinding () {
    const { container, eventCenter, contentState } = this.muya
    const inputHandler = _ => {
      const node = selection.getSelectionStart()
      const paragraph = findNearestParagraph(node)
      const selectionState = selection.exportSelection(paragraph)
      const lang = checkEditLanguage(paragraph, selectionState)
      if (lang) {
        eventCenter.dispatch('muya-code-picker', {
          reference: getParagraphReference(paragraph, paragraph.id),
          lang,
          cb: item => {
            contentState.selectLanguage(paragraph, item.name)
          }
        })
      }
    }

    eventCenter.attachDOMEvent(container, 'input', inputHandler)
  }

  keyupBinding () {
    const { container, eventCenter } = this.muya
    const handler = event => {
      // check if edit emoji
      const node = selection.getSelectionStart()
      const paragraph = findNearestParagraph(node)
      const emojiNode = checkEditEmoji(node)
      if (
        paragraph &&
        emojiNode &&
        event.key !== EVENT_KEYS.Enter &&
        event.key !== EVENT_KEYS.ArrowDown &&
        event.key !== EVENT_KEYS.ArrowUp
      ) {
        const reference = getParagraphReference(emojiNode, paragraph.id)
        eventCenter.dispatch('muya-emoji-picker', {
          reference,
          emojiNode
        })
      }
      if (!emojiNode) {
        eventCenter.dispatch('muya-emoji-picker', {
          emojiNode
        })
      }
    }

    eventCenter.attachDOMEvent(container, 'keyup', handler) // temp use input event
  }
}

export default Keyboard
