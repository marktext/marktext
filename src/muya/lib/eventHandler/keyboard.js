import { EVENT_KEYS } from '../config'
import selection from '../selection'
import { findNearestParagraph } from '../selection/dom'
import { getParagraphReference } from '../utils'
import { checkEditEmoji } from '../ui/emojis'

class Keyboard {
  constructor (muya) {
    this.muya = muya
    this.isComposed = false
    this.shownFloat = new Set()
    this.recordIsComposed()
    this.dispatchEditorState()
    this.keydownBinding()
    this.keyupBinding()
    this.inputBinding()
    this.listen()
  }

  listen () {
    // cache shown float box
    this.muya.eventCenter.subscribe('muya-float', (name, status) => {
      status ? this.shownFloat.add(name) : this.shownFloat.delete(name)
      if (name === 'ag-front-menu' && !status) {
        const seletedParagraph = this.muya.container.querySelector('.ag-selected')
        if (seletedParagraph) {
          this.muya.contentState.selectedBlock = null
          // prevent rerender, so change the class manually.
          seletedParagraph.classList.toggle('ag-selected')
        }
      }
    })
  }

  recordIsComposed () {
    const { container, eventCenter, contentState } = this.muya
    const handler = event => {
      if (event.type === 'compositionstart') {
        this.isComposed = true
      } else if (event.type === 'compositionend') {
        this.isComposed = false
        // Because the compose event will not cause `input` event, So need call `inputHandler` by ourself
        contentState.inputHandler(event)
      }
    }

    eventCenter.attachDOMEvent(container, 'compositionend', handler)
    // eventCenter.attachDOMEvent(container, 'compositionupdate', handler)
    eventCenter.attachDOMEvent(container, 'compositionstart', handler)
  }

  dispatchEditorState () {
    const { container, eventCenter, contentState } = this.muya

    let timer = null
    const changeHandler = event => {
      if (
        event.type === 'keyup' &&
        (event.key === EVENT_KEYS.ArrowUp || event.key === EVENT_KEYS.ArrowDown) &&
        this.shownFloat.size > 0
      ) {
        return
      }

      // Cursor outside editor area or over not editable elements.
      if (event.target.closest('[contenteditable=false]')) {
        return
      }
      const { start, end } = selection.getCursorRange()
      if (!start || !end) {
        return
      }

      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        const selectionChanges = contentState.selectionChange()
        const { formats } = contentState.selectionFormats()
        eventCenter.dispatch('selectionChange', selectionChanges)
        eventCenter.dispatch('selectionFormats', formats)
        this.muya.dispatchChange()
      })
    }

    eventCenter.attachDOMEvent(container, 'click', changeHandler)
    eventCenter.attachDOMEvent(container, 'keyup', changeHandler)
  }

  keydownBinding () {
    const { container, eventCenter, contentState } = this.muya

    const handler = event => {
      if (event.metaKey || event.ctrlKey) {
        container.classList.add('ag-meta-or-ctrl')
      }
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
        if (!this.shownFloat.has('ag-format-picker') && !this.shownFloat.has('ag-table-picker')) {
          event.preventDefault()
        }
        event.stopPropagation()
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
          if (!this.isComposed) {
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
          if (!this.isComposed) {
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
    const inputHandler = event => {
      if (!this.isComposed) {
        contentState.inputHandler(event)
      }

      const { lang, paragraph } = contentState.checkEditLanguage()
      if (lang) {
        eventCenter.dispatch('muya-code-picker', {
          reference: getParagraphReference(paragraph, paragraph.id),
          lang,
          cb: item => {
            contentState.selectLanguage(paragraph, item.name)
          }
        })
      } else {
        // hide code picker float box
        eventCenter.dispatch('muya-code-picker', { reference: null })
      }
    }

    eventCenter.attachDOMEvent(container, 'input', inputHandler)
  }

  keyupBinding () {
    const { container, eventCenter, contentState } = this.muya
    const handler = event => {
      container.classList.remove('ag-meta-or-ctrl')
      // check if edit emoji
      const node = selection.getSelectionStart()
      const paragraph = findNearestParagraph(node)
      const emojiNode = checkEditEmoji(node)

      if (
        paragraph &&
        emojiNode &&
        event.key !== EVENT_KEYS.Enter &&
        event.key !== EVENT_KEYS.ArrowDown &&
        event.key !== EVENT_KEYS.ArrowUp &&
        event.key !== EVENT_KEYS.Tab &&
        event.key !== EVENT_KEYS.Escape
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
      // is show format float box?
      const { start, end } = selection.getCursorRange()
      if (!start || !end) {
        return
      }

      if (
        !this.isComposed
      ) {
        const { start: oldStart, end: oldEnd } = contentState.cursor
        if (
          start.key !== oldStart.key ||
          start.offset !== oldStart.offset ||
          end.key !== oldEnd.key ||
          end.offset !== oldEnd.offset
        ) {
          const needRender = contentState.checkNeedRender(contentState.cursor) || contentState.checkNeedRender({ start, end })
          contentState.cursor = { start, end }
          if (needRender) {
            return contentState.partialRender()
          }
        }
      }

      // hide image-path float box
      const imageTextNode = contentState.getImageTextNode()
      if (!imageTextNode) {
        eventCenter.dispatch('muya-image-picker', { list: [] })
      }

      const block = contentState.getBlock(start.key)
      if (start.key === end.key && start.offset !== end.offset && block.functionType !== 'codeLine') {
        const reference = contentState.getPositionReference()
        const { formats } = contentState.selectionFormats()
        eventCenter.dispatch('muya-format-picker', { reference, formats })
      } else {
        eventCenter.dispatch('muya-format-picker', { reference: null })
      }
    }

    eventCenter.attachDOMEvent(container, 'keyup', handler) // temp use input event
  }
}

export default Keyboard
