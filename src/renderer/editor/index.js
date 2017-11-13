import {
  viewModel2Html
} from './utils.js'

import {
  getNewParagraph,
  paragraphClassName
} from './config.js'

import cursor from './cursorCtrl.js'

class Aganippe {
  constructor (container, options) {
    this.container = container
    this.viewModel = []
    this.ids = new Set([]) // use to store element'id
    this.init()
  }
  init () {
    const { container, ids, viewModel } = this
    container.setAttribute('contenteditable', true)
    container.id = 'write'
    const newParagraph = getNewParagraph(ids)
    viewModel.push(newParagraph)
    container.innerHTML = viewModel2Html(viewModel)
    const ps = container.querySelectorAll(`.${paragraphClassName}`)
    const lastP = ps[ps.length - 1]
    console.log(lastP)
    const start = lastP.textContent.length
    cursor(lastP, { start })
  }
  getMarkdown () {

  }
  getHtml () {

  }
}

export default Aganippe
