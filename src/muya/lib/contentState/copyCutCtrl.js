import selection from '../selection'
import { CLASS_OR_ID } from '../config'
import { getSanitizeHtml } from '../utils/exportHtml'
import ExportMarkdown from '../utils/exportMarkdown'
import marked from '../parser/marked'

const copyCutCtrl = ContentState => {
  ContentState.prototype.cutHandler = function () {
    const { start, end } = selection.getCursorRange()
    if (!start || !end) {
      return
    }
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
    this.checkInlineUpdate(startBlock)
    this.partialRender()
  }

  ContentState.prototype.getClipBoradData = function () {
    const html = selection.getSelectionHtml()
    const wrapper = document.createElement('div')
    wrapper.innerHTML = html
    const removedElements = wrapper.querySelectorAll(
      `.${CLASS_OR_ID.AG_TOOL_BAR},
      .${CLASS_OR_ID.AG_MATH_RENDER},
      .${CLASS_OR_ID.AG_RUBY_RENDER},
      .${CLASS_OR_ID.AG_HTML_PREVIEW},
      .${CLASS_OR_ID.AG_MATH_PREVIEW},
      .${CLASS_OR_ID.AG_COPY_REMOVE},
      .${CLASS_OR_ID.AG_LANGUAGE_INPUT},
      .${CLASS_OR_ID.AG_HTML_TAG} br,
      .${CLASS_OR_ID.AG_FRONT_ICON}`
    )

    for (const e of removedElements) {
      e.remove()
    }

    const images = wrapper.querySelectorAll('span.ag-inline-image img')
    for (const image of images) {
      const src = image.getAttribute('src')
      let originSrc = null
      for (const [sSrc, tSrc] of this.stateRender.urlMap.entries()) {
        if (tSrc === src) {
          originSrc = sSrc
          break
        }
      }

      if (originSrc) {
        image.setAttribute('src', originSrc)
      }
    }

    const hrs = wrapper.querySelectorAll('[data-role=hr]')
    for (const hr of hrs) {
      hr.replaceWith(document.createElement('hr'))
    }

    const headers = wrapper.querySelectorAll('[data-head]')
    for (const header of headers) {
      const p = document.createElement('p')
      p.textContent = header.textContent
      header.replaceWith(p)
    }

    // replace inline rule element: code, a, strong, em, del to span element
    // in order to escape turndown translation

    const inlineRuleElements = wrapper.querySelectorAll(
      `a.${CLASS_OR_ID.AG_INLINE_RULE},
      code.${CLASS_OR_ID.AG_INLINE_RULE},
      strong.${CLASS_OR_ID.AG_INLINE_RULE},
      em.${CLASS_OR_ID.AG_INLINE_RULE},
      del.${CLASS_OR_ID.AG_INLINE_RULE}`
    )
    for (const e of inlineRuleElements) {
      const span = document.createElement('span')
      span.textContent = e.textContent
      e.replaceWith(span)
    }

    const aLinks = wrapper.querySelectorAll(`.${CLASS_OR_ID.AG_A_LINK}`)
    for (const l of aLinks) {
      const span = document.createElement('span')
      span.innerHTML = l.innerHTML
      l.replaceWith(span)
    }

    const codefense = wrapper.querySelectorAll('pre[data-role$=\'code\']')
    for (const cf of codefense) {
      const id = cf.id
      const block = this.getBlock(id)
      const language = block.lang || ''
      const selectedCodeLines = cf.querySelectorAll('.ag-code-line')
      const value = Array.from(selectedCodeLines).map(codeLine => codeLine.textContent).join('\n')
      cf.innerHTML = `<code class="language-${language}">${value}</code>`
    }

    const tightListItem = wrapper.querySelectorAll('.ag-tight-list-item')
    for (const li of tightListItem) {
      for (const item of li.childNodes) {
        if (item.tagName === 'P' && item.childElementCount === 1 && item.classList.contains('ag-paragraph')) {
          li.replaceChild(item.firstElementChild, item)
        }
      }
    }

    const htmlBlock = wrapper.querySelectorAll('figure[data-role=\'HTML\']')
    for (const hb of htmlBlock) {
      const selectedCodeLines = hb.querySelectorAll('span.ag-code-line')
      const value = Array.from(selectedCodeLines).map(codeLine => codeLine.textContent).join('\n')
      const pre = document.createElement('pre')
      pre.textContent = value
      hb.replaceWith(pre)
    }

    // Just work for turndown, turndown will add `leading` and `traling` space in line-break.
    const lineBreaks = wrapper.querySelectorAll('span.ag-soft-line-break, span.ag-hard-line-break')
    for (const b of lineBreaks) {
      b.innerHTML = ''
    }

    const mathBlock = wrapper.querySelectorAll('figure.ag-container-block')
    for (const mb of mathBlock) {
      const preElement = mb.querySelector('pre[data-role]')
      const functionType = preElement.getAttribute('data-role')
      const selectedCodeLines = mb.querySelectorAll('span.ag-code-line')
      const value = Array.from(selectedCodeLines).map(codeLine => codeLine.textContent).join('\n')
      let pre
      switch (functionType) {
        case 'multiplemath':
          pre = document.createElement('pre')
          pre.classList.add('multiple-math')
          pre.textContent = value
          mb.replaceWith(pre)
          break
        case 'mermaid':
        case 'flowchart':
        case 'sequence':
        case 'vega-lite':
          pre = document.createElement('pre')
          pre.innerHTML = `<code class="language-${functionType}">${value}</code>`
          mb.replaceWith(pre)
          break
      }
    }

    let htmlData = wrapper.innerHTML
    const textData = this.htmlToMarkdown(htmlData)

    htmlData = marked(textData)
    return { html: htmlData, text: textData }
  }

  ContentState.prototype.copyHandler = function (event, type) {
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
        const listIndentation = this.listIndentation
        const markdown = new ExportMarkdown([table], listIndentation).generate()
        event.clipboardData.setData('text/html', '')
        event.clipboardData.setData('text/plain', markdown)
        break
      }
    }
  }
}

export default copyCutCtrl
