import {
  getUniqueId,
  markedText2Html
} from './utils.js'

console.log(typeof getUniqueId)
console.log(typeof markedText2Html)

class Aganippe {
  constructor (container, options) {
    this.container = container
    this.viewModel = []
    this.ids = new Set([]) // use to store element'id
    this.init()
  }
  init () {
    const { container } = this
    container.setAttribute('contenteditable', true)
  }
  getMarkdown () {

  }
  getHtml () {

  }
}

export default Aganippe
