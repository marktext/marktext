
import {
  getUniqueId, // eslint-disable-line no-unused-vars
  updateBlock,
  checkLineBreakUpdate,
  createEmptyElement,
  checkInlineUpdate,
  checkMarkedTextUpdate,
  isAganippeEditorElement,
  findNearestParagraph,
  markedText2Html,
  insertAfter // eslint-disable-line no-unused-vars
} from './utils.js'

import {
  paragraphClassName // eslint-disable-line no-unused-vars
} from './config.js'

import Selection from './selection'
import Event from './event'

const selection = new Selection(document)

class Aganippe {
  constructor (container, options) {
    this.container = container
    this.cursor = {
      id: null,
      start: null,
      end: null
    }
    this.ids = new Set([]) // use to store element'id
    this.eventCenter = new Event()
    this.init()
  }
  init () {
    this.ensureContainerDiv()
    const { container, eventCenter } = this
    container.setAttribute('contenteditable', true)
    container.setAttribute('aganippe-editor-element', true)
    container.id = 'write'

    // listen to customEvent `markedTextChange` event, and change markedText to html.
    eventCenter.subscribe('markedTextChange', this.subscribeMarkedText.bind(this))
    this.dispatchMarkedText()

    eventCenter.subscribe('enter', this.subscribeEnter.bind(this))
    this.dispatchEnter()

    this.handleKeyDown()
    this.generateLastEmptyParagraph()
  }

  ensureContainerDiv () {
    if (this.container.tagName.toLowerCase() === 'div') {
      return false
    }
    const { container } = this
    const div = document.createElement('div')
    const attrs = container.attributes
    const parentNode = container.parentNode
    // copy attrs from origin container to new div element
    Array.from(attrs).forEach(attr => {
      div.setAttribute(attr.name, attr.value)
    })
    parentNode.insertBefore(div, container)
    parentNode.removeChild(container)
    this.container = div
  }

  generateLastEmptyParagraph () {
    const { ids, container } = this
    const emptyElement = createEmptyElement(ids, 'p')
    container.appendChild(emptyElement)
    selection.moveCursor(emptyElement, 0)
  }
  /**
   * [dispatchMarkedText when input `markedSymbol` or have input `markedSymbol`]
   */
  dispatchMarkedText () {
    const { container, eventCenter } = this
    const changeHandler = event => {
      const node = selection.getSelectionStart()
      const paragraph = findNearestParagraph(node)
      const text = paragraph.textContent
      const html = paragraph.innerHTML
      const selectionState = selection.exportSelection(paragraph)
      if (checkMarkedTextUpdate(html, text, selectionState)) {
        eventCenter.dispatch('markedTextChange', paragraph, selectionState)
      }
    }
    eventCenter.attachDOMEvent(container, 'click', changeHandler)
    eventCenter.attachDOMEvent(container, 'keyup', changeHandler)
  }
  /**
   * [subscribeMarkedText change markedText to html, and reset the cursor]
   */
  subscribeMarkedText (paragraph, selectionState) {
    const text = paragraph.textContent
    const markedHtml = markedText2Html(text, selectionState)
    paragraph.innerHTML = markedHtml
    selection.importSelection(selectionState, paragraph)
  }

  dispatchEnter () {
    const { container, eventCenter } = this
    const handleKeyDown = event => {
      if (event.key === 'Enter') {
        eventCenter.dispatch('enter', event)
      }
    }
    eventCenter.attachDOMEvent(container, 'keydown', handleKeyDown)
  }

  subscribeEnter (event) {
    event.preventDefault()
    const node = selection.getSelectionStart()
    const paragraph = findNearestParagraph(node)
    const attrs = paragraph.attributes
    const newElement = createEmptyElement(this.ids, paragraph.tagName.toLowerCase(), attrs)
    const { pre, post } = selection.chopHtmlByCursor(paragraph)
    paragraph.innerHTML = pre || '<br>'
    newElement.innerHTML = post || '<br>'
    insertAfter(newElement, paragraph)
    selection.moveCursor(newElement, 0)
  }

  dispatchElementUpdate () {

  }

  handleKeyDown () {
    this.container.addEventListener('input', event => {
      // if #write has textNode child, wrap it a `p` tag.
      const node = selection.getSelectionStart()
      if (isAganippeEditorElement(node)) {
        this.doc.execCommand('formatBlock', false, 'p')
      }

      let paragraph = findNearestParagraph(node)
      const id = paragraph.id
      const selectionState = selection.exportSelection(paragraph)
      const tagName = paragraph.tagName.toLowerCase()
      const text = paragraph.textContent
      const linkBreakUpdate = checkLineBreakUpdate(text)
      const inlineUpdate = checkInlineUpdate(text)
      if (linkBreakUpdate && linkBreakUpdate.type !== tagName) {
        // TODO: update to lineBreak block
      }
      if (inlineUpdate && inlineUpdate.type !== tagName) {
        if (/^h/.test(inlineUpdate.type)) {
          updateBlock(paragraph, inlineUpdate.type)
          paragraph = document.querySelector(`#${id}`)

          selection.importSelection(selectionState, paragraph)
        }
      }
    })
  }

  getMarkdown () {
    // TODO
  }
  getHtml () {
    // TODO
  }
  destroy () {
    this.eventCenter.detachAllDomEvents()
  }
}

export default Aganippe
