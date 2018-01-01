import cheerio from 'cheerio'
import selection from '../selection'
import { CLASS_OR_ID } from '../config'
// import { findNearestParagraph } from '../utils/domManipulate'

const copyCutCtrl = ContentState => {
  ContentState.prototype.cutHandler = function () {
    const { start, end } = this.cursor
    const startBlock = this.getBlock(start.key)
    const endBlock = this.getBlock(end.key)
    startBlock.text = startBlock.text.substring(0, start.offset) + endBlock.text.substring(end.offset)
    if (start.key !== end.key) {
      this.removeBlocks(startBlock, endBlock)
    }
    this.cursor = {
      start,
      end: start
    }
    this.render()
  }

  ContentState.prototype.copyCutHandler = function (event) {
    // const node = selection.getSelectionStart()
    // const end = selection.getSelectionEnd()
    // const paragraph = findNearestParagraph(node)
    // const endParagraph = findNearestParagraph(end)
    // console.log(paragraph)
    // console.log(endParagraph)
    event.preventDefault()
    const html = selection.getSelectionHtml()
    // console.log(html)
    // const text = event.clipboardData.getData('text/plain')
    const $ = cheerio.load(html)
    $(`.${CLASS_OR_ID['AG_REMOVE']}`).remove()
    $(`.${CLASS_OR_ID['AG_EMOJI_MARKER']}`).text(':')
    $(`.${CLASS_OR_ID['AG_NOTEXT_LINK']}`).empty()
    $(`[data-role=hr]`).replaceWith('<hr>')

    const anchors = $(`a[data-href]`)

    anchors.each((i, a) => {
      const anchor = $(a)
      const href = anchor.attr('data-href')
      anchor.removeAttr('data-href')
      anchor.attr('href', href)
    })

    const codefense = $(`pre.${CLASS_OR_ID['AG_CODE_BLOCK']}`)

    codefense.each((i, cf) => {
      const ele = $(cf)
      const id = ele.attr('id')
      const language = ele.attr('data-lang')
      const cm = this.codeBlocks.get(id)
      const codeText = cm.getValue()
      ele.empty()
      ele.html(`<code class="language-${language}" lang="${language}">${codeText}</code>`)
    })

    event.clipboardData.setData('text/html', $('body').html())
  }
}

export default copyCutCtrl
