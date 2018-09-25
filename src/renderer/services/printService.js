class MarkdownPrint {
  constructor (html) {
    this.html = html
  }

  renderMarkdown () {
    this.clearup()
    const { html } = this
    const printContainer = document.createElement('article')
    printContainer.classList.add('print-container')
    printContainer.classList.add('markdown-body')
    this.container = printContainer
    document.body.appendChild(printContainer)
    printContainer.innerHTML = html
  }

  print () {
    this.renderMarkdown()
    window.print()
    this.clearup()
  }

  clearup () {
    if (this.container) {
      this.container.remove()
    }
  }
}

export default MarkdownPrint
