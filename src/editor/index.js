
import {
  paragraph2Element // eslint-disable-line no-unused-vars
} from './utils.js'

import {
  getNewParagraph, // eslint-disable-line no-unused-vars
  paragraphClassName // eslint-disable-line no-unused-vars
} from './config.js'

import selection from './selection' // eslint-disable-line no-unused-vars

class Aganippe {
  constructor (container, options) {
    this.doc = document
    this.container = container
    this.viewModel = []
    this.ids = new Set([]) // use to store element'id
    this.init()
  }
  init () {
    const { container, ids, viewModel } = this // eslint-disable-line no-unused-vars
    container.setAttribute('contenteditable', true)
    container.setAttribute('aganippe-editor-element', true)
    container.id = 'write'
    this.generateLastEmptyParagraph()
    this.handleKeyDown()
  }
  generateLastEmptyParagraph () {
    const { ids, viewModel, container, doc } = this
    const newParagraph = getNewParagraph(ids)
    viewModel.push(newParagraph)
    const emptyElement = paragraph2Element(newParagraph)
    container.appendChild(emptyElement)
    selection.moveCursor(doc, emptyElement, 0)
  }

  handleKeyDown () {
    this.container.addEventListener('keyup', event => {
      const node = selection.getSelectionStart(this.doc)
      console.log(node)
      // this.doc.execCommand('formatBlock', false, 'BLOCKQUOTE')
    })
  }

  getMarkdown () {

  }
  getHtml () {

  }
}

export default Aganippe
