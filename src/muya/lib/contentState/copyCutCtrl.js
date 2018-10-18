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
    const wrapper = document.createElement('div')
    wrapper.innerHTML = html
    const removedElements = wrapper.querySelectorAll(
      `.${CLASS_OR_ID['AG_TOOL_BAR']},
      .${CLASS_OR_ID['AG_MATH_RENDER']},
      .${CLASS_OR_ID['AG_HTML_PREVIEW']},
      .${CLASS_OR_ID['AG_MATH_PREVIEW']},
      .${CLASS_OR_ID['AG_COPY_REMOVE']}`
    )
    ;[...removedElements].forEach(e => e.remove())

    const hrs = wrapper.querySelectorAll(`[data-role=hr]`)
    ;[...hrs].forEach(hr => hr.replaceWith(document.createElement('hr')))

    const headers = wrapper.querySelectorAll(`[data-head]`)
    ;[...headers].forEach(header => {
      const p = document.createElement('p')
      p.textContent = header.textContent
      header.replaceWith(p)
    })

    // replace inline rule element: code, a, strong, em, del to span element
    // in order to escape turndown translation

    const inlineRuleElements = wrapper.querySelectorAll(
      `a.${CLASS_OR_ID['AG_INLINE_RULE']},
      code.${CLASS_OR_ID['AG_INLINE_RULE']},
      strong.${CLASS_OR_ID['AG_INLINE_RULE']},
      em.${CLASS_OR_ID['AG_INLINE_RULE']},
      del.${CLASS_OR_ID['AG_INLINE_RULE']}`
    )
    ;[...inlineRuleElements].forEach(e => {
      const span = document.createElement('span')
      span.textContent = e.textContent
      e.replaceWith(span)
    })

    const aLinks = wrapper.querySelectorAll(`.${CLASS_OR_ID['AG_A_LINK']}`)
    ;[...aLinks].forEach(l => {
      const span = document.createElement('span')
      span.innerHTML = l.innerHTML
      l.replaceWith(span)
    })

    const codefense = wrapper.querySelectorAll(`pre.${CLASS_OR_ID['AG_CODE_BLOCK']}`)
    ;[...codefense].forEach(cf => {
      const id = cf.id
      const language = cf.getAttribute('data-lang') || ''
      const cm = this.codeBlocks.get(id)
      const value = cm.getValue()
      cf.innerHTML = `<code class="language-${language}" lang="${language}">${value}</code>`
    })

    const htmlBlock = wrapper.querySelectorAll(`figure[data-role='HTML']`)
    ;[...htmlBlock].forEach(hb => {
      const id = hb.id
      const { text } = this.getBlock(id)
      const pre = document.createElement('pre')
      pre.textContent = text
      hb.replaceWith(pre)
    })

    const mathBlock = wrapper.querySelectorAll(`figure.ag-multiple-math-block`)
    ;[...mathBlock].forEach(mb => {
      const id = mb.id
      const { math } = this.getBlock(id).children[1]
      const pre = document.createElement('pre')
      pre.classList.add('multiple-math')
      pre.textContent = math
      mb.replaceWith(pre)
    })

    const htmlData = wrapper.innerHTML
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
