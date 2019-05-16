const imageCtrl = ContentState => {
  ContentState.prototype.replaceImage = function ({ key, token }, { alt, src, title }) {
    const block = this.getBlock(key)
    const { start, end } = token.range
    const oldText = block.text
    let imageText = '!['
    if (alt) {
      imageText += alt
    }
    imageText += ']('
    if (src) {
      imageText += src
    }
    if (title) {
      imageText += ` "${title}"`
    }
    imageText += ')'
    block.text = oldText.substring(0, start) + imageText + oldText.substring(end)
    return this.singleRender(block, false)
  }
  
  ContentState.prototype.deleteImage = function ({ key, token }) {
    const block = this.getBlock(key)
    const oldText = block.text
    const { start, end } = token.range
    block.text = oldText.substring(0, start) + oldText.substring(end)

    this.cursor = {
      start: { key, offset: start },
      end: { key, offset: start }
    }
    return this.singleRender(block)
  }

  ContentState.prototype.selectImage = function (imageInfo) {
    this.selectedImage = imageInfo
    const block = this.getBlock(imageInfo.key)
    return this.singleRender(block, false)
  }
}

export default imageCtrl
