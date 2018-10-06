class Clipboard {
  constructor (muya) {
    this.muya = muya
    this._copyType = 'normal' // `normal` or `copyAsMarkdown` or `copyAsHtml`
    this._pasteType = 'normal' // `normal` or `pasteAsPlainText`
    this.listen()
  }

  listen () {
    const { container, eventCenter, contentState } = this.muya
    const copyCutHandler = event => {
      contentState.copyHandler(event, this._copyType)
      if (event.type === 'cut') {
        // when user use `cut` function, the dom has been deleted by default.
        // But should update content state manually.
        contentState.cutHandler()
      }
      this._copyType = 'normal'
    }
    const pasteHandler = event => {
      contentState.pasteHandler(event, this._pasteType)
      this._pasteType = 'normal'
    }

    eventCenter.attachDOMEvent(container, 'paste', pasteHandler)
    eventCenter.attachDOMEvent(container, 'cut', copyCutHandler)
    eventCenter.attachDOMEvent(container, 'copy', copyCutHandler)
  }

  copyAsMarkdown () {
    this._copyType = 'copyAsMarkdown'
    document.execCommand('copy')
  }

  copyAsHtml () {
    this._copyType = 'copyAsHtml'
    document.execCommand('copy')
  }

  pasteAsPlainText () {
    this._pasteType = 'pasteAsPlainText'
    document.execCommand('paste')
  }

  copy (name) {
    switch (name) {
      case 'table':
        this._copyType = 'copyTable'
        document.execCommand('copy')
        break
      default:
        break
    }
  }
}

export default Clipboard
