const linkCtrl = ContentState => {
  /**
   * Change a link into text.
   */
  ContentState.prototype.unlink = function (linkInfo) {
    const { key, token } = linkInfo
    const block = this.getBlock(key)
    const { text } = block
    let anchor
    switch (token.type) {
      case 'html_tag':
        anchor = token.content
        break
      case 'link':
        anchor = token.href
        break
      case 'text': {
        const match = /^\[(.+?)\]/.exec(token.raw)
        if (match && match[1]) {
          anchor = match[1]
        }
        break
      }
    }
    if (!anchor) {
      console.error('Can not find anchor when unlink')
      return
    }
    block.text = text.substring(0, token.range.start) + anchor + text.substring(token.range.end)
    this.cursor = {
      start: {
        key,
        offset: token.range.start
      },
      end: {
        key,
        offset: +token.range.start + anchor.length
      }
    }

    this.singleRender(block)
    return this.muya.dispatchChange()
  }
}

export default linkCtrl
