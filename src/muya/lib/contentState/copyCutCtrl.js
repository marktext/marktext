import cheerio from 'cheerio'
import selection from '../selection'
import { CLASS_OR_ID } from '../config'
import { getSanitizeHtml } from '../utils/exportHtml'
import ExportMarkdown from '../utils/exportMarkdown'

const copyCutCtrl = ContentState => {
  ContentState.prototype.cutHandler = function () {
    if (this.checkInCodeBlock()) {
      return
    }
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
    this.partialRender()
  }

  ContentState.prototype.checkInCodeBlock = function () {
    const { start, end } = selection.getCursorRange()
    const { type, functionType } = this.getBlock(start.key)

    if (start.key === end.key && type === 'pre' && /code|html/.test(functionType)) {
      return true
    }
    return false
  }

  ContentState.prototype.getClipBoradData = function () {
    const html = selection.getSelectionHtml()
    const $ = cheerio.load(html)
    // console.log(html)
    $(
      `.${CLASS_OR_ID['AG_TOOL_BAR']},
      .${CLASS_OR_ID['AG_MATH_RENDER']},
      .${CLASS_OR_ID['AG_HTML_PREVIEW']},
      .${CLASS_OR_ID['AG_MATH_PREVIEW']},
      .${CLASS_OR_ID['AG_COPY_REMOVE']}`
    ).remove()

    $(`[data-role=hr]`).replaceWith('<hr>')
    const headers = $(`[data-head]`)
    if (headers.length > 0) {
      headers.each((i, a) => {
        const e = $(a)
        const text = e.text()
        e.replaceWith(`<p>${text}</p>`)
      })
    }

    // replace inline rule element: code, a, strong, em, del to span element
    // in order to escape turndown translation
    const inlineRuleElements = $(
      `a.${CLASS_OR_ID['AG_INLINE_RULE']},
      code.${CLASS_OR_ID['AG_INLINE_RULE']},
      strong.${CLASS_OR_ID['AG_INLINE_RULE']},
      em.${CLASS_OR_ID['AG_INLINE_RULE']},
      del.${CLASS_OR_ID['AG_INLINE_RULE']}`
    )
    if (inlineRuleElements.length > 0) {
      inlineRuleElements.each((i, a) => {
        const e = $(a)
        const text = e.text()
        e.replaceWith(`<span>${text}</span>`)
      })
    }

    const aLink = $(`.${CLASS_OR_ID['AG_A_LINK']}`)
    if (aLink.length > 0) {
      aLink.each((i, a) => {
        const anchor = $(a)
        const html = anchor.html()
        anchor.replaceWith(`<span>${html}</span>`)
      })
    }

    const codefense = $(`pre.${CLASS_OR_ID['AG_CODE_BLOCK']}`)
    if (codefense.length > 0) {
      codefense.each((i, cf) => {
        const ele = $(cf)
        const id = ele.attr('id')
        const language = ele.attr('data-lang') || ''
        const cm = this.codeBlocks.get(id)
        const codeText = cm.getValue()
        ele.empty()
        ele.html(`<code class="language-${language}" lang="${language}">${codeText}</code>`)
      })
    }

    const htmlBlock = $(`figure[data-role='HTML']`)
    if (htmlBlock.length > 0) {
      htmlBlock.each((i, hb) => {
        const ele = $(hb)
        const id = ele.attr('id')
        const { text } = this.getBlock(id)
        const pre = $('<pre></pre>')
        pre.text(text)
        ele.replaceWith(pre)
      })
    }

    const mathBlock = $(`figure.ag-multiple-math-block`)
    if (mathBlock.length > 0) {
      mathBlock.each((i, hb) => {
        const ele = $(hb)
        const id = ele.attr('id')
        const { math } = this.getBlock(id).children[1]
        const pre = $('<pre class="multiple-math"></pre>')
        pre.text(math)
        ele.replaceWith(pre)
      })
    }

    const htmlData = $('body').html()
    const textData = this.htmlToMarkdown(htmlData)

    return { html: htmlData, text: textData }
  }

  ContentState.prototype.copyHandler = function (event, type) {
    if (this.checkInCodeBlock()) {
      return
    }
    event.preventDefault()

    const { html, text } = this.getClipBoradData()

    switch (type) {
      case 'normal': {
        event.clipboardData.setData('text/html', html)
        event.clipboardData.setData('text/plain', text)
        break
      }
      case 'copyAsMarkdown': {
        event.clipboardData.setData('text/html', '')
        event.clipboardData.setData('text/plain', text)
        break
      }
      case 'copyAsHtml': {
        event.clipboardData.setData('text/html', '')
        event.clipboardData.setData('text/plain', getSanitizeHtml(text))
        break
      }
      case 'copyTable': {
        const table = this.getTableBlock()
        if (!table) return
        const markdown = new ExportMarkdown([ table ]).generate()
        event.clipboardData.setData('text/html', '')
        event.clipboardData.setData('text/plain', markdown)
        break
      }
    }
  }
}

export default copyCutCtrl
