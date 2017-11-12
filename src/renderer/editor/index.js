class Aganippe {
  constructor (container, options) {
    this.container = container
    this.init()
  }
  init () {
    const { container } = this
    container.setAttribute('contenteditable', true)
  }
}

export default Aganippe
