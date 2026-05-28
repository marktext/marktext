import { EVENT_KEYS, KEYS_TO_IGNORE } from '../config'
import selection from '../selection'
import { findNearestParagraph } from '../selection/dom'
import { getParagraphReference, getImageInfo } from '../utils'
import { checkEditEmoji } from '../ui/emojis'

class Keyboard {
  constructor(muya) {
    this.muya = muya
    this.isComposed = false
    this.shownFloat = {}
    this.recordIsComposed()
    this.dispatchEditorState()
    this.keydownBinding()
    this.keyupBinding()
    this.inputBinding()
    this.listen()
  }

  listen() {
    // cache shown float box
    this.muya.eventCenter.subscribe('muya-float', (tool, status) => {
      // We should use tool.name here instead as Vue3's reactivity since objects are stored as Proxy objects
      // This can cause reference issues if we use the original implementation of comparing via references.

      if (status) this.shownFloat[tool.name] = tool
      else delete this.shownFloat[tool.name]

      if (tool.name === 'ag-front-menu' && !status) {
        const seletedParagraph = this.muya.container.querySelector('.ag-selected')
        if (seletedParagraph) {
          this.muya.contentState.selectedBlock = null
          // prevent rerender, so change the class manually.
          seletedParagraph.classList.toggle('ag-selected')
        }
      }
    })
  }

  hideAllFloatTools() {
    for (const tool in this.shownFloat) {
      this.shownFloat[tool].hide()
    }
  }

  recordIsComposed() {
    const { container, eventCenter, contentState } = this.muya
    const handler = (event) => {
      if (event.type === 'compositionstart') {
        this.isComposed = true
      } else if (event.type === 'compositionend') {
        this.isComposed = false
        // Because the compose event will not cause `input` event, So need call `inputHandler` by ourself
        contentState.inputHandler(event)
        eventCenter.dispatch('stateChange')
      }
    }

    eventCenter.attachDOMEvent(container, 'compositionend', handler)
    // eventCenter.attachDOMEvent(container, 'compositionupdate', handler)
    eventCenter.attachDOMEvent(container, 'compositionstart', handler)
  }

  dispatchEditorState() {
    const { container, eventCenter } = this.muya

    let timer = null
    const changeHandler = (event) => {
      if (
        event.type === 'keyup' &&
        (event.key === EVENT_KEYS.ArrowUp || event.key === EVENT_KEYS.ArrowDown) &&
        Object.keys(this.shownFloat).length > 0
      ) {
        return
      }
      // Cursor outside editor area or over not editable elements.
      if (event.target.closest('[contenteditable=false]')) {
        return
      }

      // Ignore the event if it doesnt cause an edit in the editor (e.g control keys etc.)
      if (event.key in KEYS_TO_IGNORE) {
        return
      }

      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        const cursor = selection.getCursorRange()
        if (!cursor.start || !cursor.end) {
          return
        }

        this.muya.dispatchSelectionChange(cursor)
        this.muya.dispatchSelectionFormats(cursor)
        if (!this.isComposed && event.type === 'click') {
          this.muya.dispatchChange()
        }
      })
    }

    eventCenter.attachDOMEvent(container, 'click', changeHandler)
    eventCenter.attachDOMEvent(container, 'keyup', changeHandler)
  }

  keydownBinding() {
    const { container, eventCenter, contentState } = this.muya
    const docHandler = (event) => {
      switch (event.code) {
        case EVENT_KEYS.Enter:
          return contentState.docEnterHandler(event)
        case EVENT_KEYS.Space: {
          if (contentState.selectedImage) {
            const { token } = contentState.selectedImage
            const { src } = getImageInfo(token.src || token.attrs.src)
            if (src) {
              eventCenter.dispatch('preview-image', {
                data: src
              })
            }
          }
          break
        }
        case EVENT_KEYS.Backspace: {
          return contentState.docBackspaceHandler(event)
        }
        case EVENT_KEYS.Delete: {
          return contentState.docDeleteHandler(event)
        }
        case EVENT_KEYS.ArrowUp: // fallthrough
        case EVENT_KEYS.ArrowDown: // fallthrough
        case EVENT_KEYS.ArrowLeft: // fallthrough
        case EVENT_KEYS.ArrowRight: // fallthrough
          return contentState.docArrowHandler(event)
      }
    }

    const handler = (event) => {
      if (event.metaKey || event.ctrlKey) {
        container.classList.add('ag-meta-or-ctrl')
      }

      if (
        Object.keys(this.shownFloat).length > 0 &&
        (event.key === EVENT_KEYS.Enter ||
          event.key === EVENT_KEYS.Escape ||
          event.key === EVENT_KEYS.Tab ||
          event.key === EVENT_KEYS.ArrowUp ||
          event.key === EVENT_KEYS.ArrowDown)
      ) {
        let needPreventDefault = false

        for (const tool in this.shownFloat) {
          if (
            tool === 'ag-format-picker' ||
            tool === 'ag-table-picker' ||
            tool === 'ag-quick-insert' ||
            tool === 'ag-emoji-picker' ||
            tool === 'ag-front-menu' ||
            tool === 'ag-list-picker' ||
            tool === 'ag-image-selector'
          ) {
            needPreventDefault = true
            break
          }
        }
        if (needPreventDefault) {
          event.preventDefault()
        }
        // event.stopPropagation()
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
            this.muya.dispatchChange()
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
    eventCenter.attachDOMEvent(document, 'keydown', docHandler)
  }

  inputBinding() {
    const { container, eventCenter, contentState } = this.muya
    const inputHandler = (event) => {
      if (!this.isComposed) {
        contentState.inputHandler(event)
        this.muya.dispatchChange()
      }

      const { lang, paragraph } = contentState.checkEditLanguage()
      if (lang) {
        eventCenter.dispatch('muya-code-picker', {
          reference: getParagraphReference(paragraph, paragraph.id),
          lang,
          cb: (item) => {
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

  keyupBinding() {
    const { container, eventCenter, contentState } = this.muya
    const handler = (event) => {
      container.classList.remove('ag-meta-or-ctrl')
      // check if edit emoji
      const node = selection.getSelectionStart()
      const paragraph = findNearestParagraph(node)
      const emojiNode = checkEditEmoji(node)
      contentState.selectedImage = null
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

      const { anchor, focus, start, end } = selection.getCursorRange()
      if (!anchor || !focus) {
        return
      }
      if (!this.isComposed) {
        const { anchor: oldAnchor, focus: oldFocus } = contentState.cursor
        if (
          anchor.key !== oldAnchor.key ||
          anchor.offset !== oldAnchor.offset ||
          focus.key !== oldFocus.key ||
          focus.offset !== oldFocus.offset
        ) {
          const needRender =
            contentState.checkNeedRender(contentState.cursor) ||
            contentState.checkNeedRender({ start, end })
          contentState.cursor = { anchor, focus }
          if (needRender) {
            return contentState.partialRender()
          }
        }
      }

      const block = contentState.getBlock(anchor.key)
      if (
        anchor.key === focus.key &&
        anchor.offset !== focus.offset &&
        block.functionType !== 'codeContent' &&
        block.functionType !== 'languageInput'
      ) {
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
