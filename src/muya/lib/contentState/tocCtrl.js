const tocCtrl = ContentState => {
  ContentState.prototype.getTOC = function () {
    const { blocks } = this
    const toc = []

    for (const block of blocks) {
      if (/^h\d$/.test(block.type)) {
        const { headingStyle, text, key, type } = block
        const content = headingStyle === 'setext' ? text.trim() : text.replace(/^ *#{1,6} {1,}/, '').trim()
        const lvl = +type.substring(1)
        const slug = key
        toc.push({
          content,
          lvl,
          slug
        })
      }
    }

    return toc
  }
}

export default tocCtrl
