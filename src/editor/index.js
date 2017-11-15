
import {
  getUniqueId, // eslint-disable-line no-unused-vars
  updateBlock,
  paragraph2Element, // eslint-disable-line no-unused-vars
  checkLineBreakUpdate,
  checkInlineUpdate,
  isAganippeEditorElement,
  findNearestParagraph,
  checkInputMarkedSymbol,
  markedText2Html
} from './utils.js'

import {
  getNewParagraph, // eslint-disable-line no-unused-vars
  paragraphClassName // eslint-disable-line no-unused-vars
} from './config.js'

import Selection from './selection' // eslint-disable-line no-unused-vars

const selection = new Selection(document)

class Aganippe {
  constructor (container, options) {
    this.container = container
    this.viewModel = []
    this.cursor = {
      id: null,
      start: null,
      end: null
    }
    this.ids = new Set([]) // use to store element'id
    this.init()
  }
  init () {
    this.ensureContainerDiv()
    const { container, ids, viewModel } = this // eslint-disable-line no-unused-vars
    container.setAttribute('contenteditable', true)
    container.setAttribute('aganippe-editor-element', true)
    container.id = 'write'
    this.generateLastEmptyParagraph()
    this.handleKeyDown()
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
    const { ids, viewModel, container } = this
    const newParagraph = getNewParagraph(ids)
    viewModel.push(newParagraph)
    const emptyElement = paragraph2Element(newParagraph)
    container.appendChild(emptyElement)
    selection.moveCursor(emptyElement, 0)
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

      if (checkInputMarkedSymbol(event.key) || 1) {
        const markedHtml = markedText2Html(text, selectionState)
        paragraph.innerHTML = markedHtml
        selection.importSelection(selectionState, paragraph)
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
    // TODO
    // destroy the event bind.
  }
}

export default Aganippe
