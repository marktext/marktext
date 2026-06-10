import { URL_REG } from '../config'

const encodeLinkHref = (href) => {
  if (!href) return ''
  if (URL_REG.test(href)) {
    return encodeURI(href)
  }
  return href.replace(/ /g, encodeURI(' ')).replace(/#/g, encodeURIComponent('#'))
}

const linkCtrl = (ContentState) => {
  /**
   * Insert inline link at the cursor position.
   */
  ContentState.prototype.insertLink = function({ text = '', href = '', title = '' }) {
    const { start, end } = this.cursor
    const { formats } = this.selectionFormats({ start, end })
    const { key, offset: startOffset } = start
    const { offset: endOffset } = end
    const block = this.getBlock(key)

    if (
      block.type === 'span' &&
      (block.functionType === 'codeContent' ||
        block.functionType === 'languageInput' ||
        block.functionType === 'thematicBreakLine')
    ) {
      // You can not insert link into code block or language input...
      return
    }

    const { text: blockText } = block
    const linkFormat = formats.filter((f) => f.type === 'link')
    const selectedText = key === end.key && startOffset !== endOffset
      ? blockText.substring(startOffset, endOffset)
      : ''
    const linkText = text || selectedText

    let hrefAndTitle = encodeLinkHref(href)
    if (hrefAndTitle && title) {
      hrefAndTitle += ` "${title}"`
    }

    const linkMarkdown = `[${linkText}](${hrefAndTitle})`

    if (
      linkFormat.length === 1 &&
      linkFormat[0].range.start !== startOffset &&
      linkFormat[0].range.end !== endOffset
    ) {
      // Replace already existing link
      const { start, end } = linkFormat[0].range
      block.text =
        blockText.substring(0, start) +
        linkMarkdown +
        blockText.substring(end)

      this.cursor = {
        start: { key, offset: start + 1 },
        end: { key, offset: start + 1 + linkText.length },
        isEdit: true
      }
    } else if (key !== end.key) {
      // Replace multi-line text
      const endBlock = this.getBlock(end.key)
      const { text: endBlockText } = endBlock
      endBlock.text =
        endBlockText.substring(0, endOffset) +
        linkMarkdown +
        endBlockText.substring(endOffset)
      const offset = endOffset + 1
      this.cursor = {
        start: { key: end.key, offset },
        end: { key: end.key, offset: offset + linkText.length },
        isEdit: true
      }
    } else {
      // Replace single-line text
      block.text =
        blockText.substring(0, startOffset) +
        linkMarkdown +
        blockText.substring(endOffset)

      this.cursor = {
        start: { key, offset: startOffset + 1 },
        end: { key, offset: startOffset + 1 + linkText.length },
        isEdit: true
      }
    }
    this.partialRender()
    this.muya.dispatchChange()
  }

  /**
   * Change a link into text.
   */
  ContentState.prototype.unlink = function(linkInfo) {
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
      },
      isEdit: true
    }

    this.singleRender(block)
    return this.muya.dispatchChange()
  }
}

export default linkCtrl
