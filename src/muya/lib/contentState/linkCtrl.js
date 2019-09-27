const linkCtrl = ContentState => {
  /**
   * Change a link into text.
   */
  ContentState.prototype.unlink = function (linkInfo) {
    const { key, token } = linkInfo
    const block = this.getBlock(key)
    const { text } = block
    block.text = text.substring(0, token.range.start) + token.anchor + text.substring(token.range.end)
    this.cursor = {
      start: {
        key,
        offset: token.range.start
      },
      end: {
        key,
        offset: +token.range.start + token.anchor.length
      }
    }

    this.singleRender(block)
    return this.muya.dispatchChange()
  }
}

export default linkCtrl
