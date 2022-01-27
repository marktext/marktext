class Clipboard {
  constructor (muya) {
    this.muya = muya
    this._copyType = 'normal' // `normal` or `copyAsMarkdown` or `copyAsHtml`
    this._pasteType = 'normal' // `normal` or `pasteAsPlainText`
    this._copyInfo = null
    this.listen()
  }

  listen () {
    const { container, eventCenter, contentState } = this.muya
    const docPasteHandler = event => {
      contentState.docPasteHandler(event)
    }
    const docCopyCutHandler = event => {
      contentState.docCopyHandler(event)
      if (event.type === 'cut') {
        // when user use `cut` function, the dom has been deleted by default.
        // But should update content state manually.
        contentState.docCutHandler(event)
      }
    }
    const copyCutHandler = event => {
      contentState.copyHandler(event, this._copyType, this._copyInfo)
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
      this.muya.dispatchChange()
    }

    eventCenter.attachDOMEvent(document, 'paste', docPasteHandler)
    eventCenter.attachDOMEvent(container, 'paste', pasteHandler)
    eventCenter.attachDOMEvent(container, 'cut', copyCutHandler)
    eventCenter.attachDOMEvent(container, 'copy', copyCutHandler)
    eventCenter.attachDOMEvent(document.body, 'cut', docCopyCutHandler)
    eventCenter.attachDOMEvent(document.body, 'copy', docCopyCutHandler)
  }

  // TODO: `document.execCommand` is deprecated!

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

  /**
   * Copy the anchor block(table, paragraph, math block etc) with the info
   * @param {string|object} type copyBlock or copyCodeContent
   * @param {string|object} info  is the block key if it's string, or block if it's object
   */
  copy (type, info) {
    this._copyType = type
    this._copyInfo = info
    document.execCommand('copy')
  }
}

export default Clipboard
