import katex from 'katex'
import prism from '../../../prism/'
import { CLASS_OR_ID, DEVICE_MEMORY, isInElectron, PREVIEW_DOMPURIFY_CONFIG } from '../../../config'
import { tokenizer } from '../../parse'
import { snakeToCamel, sanitize } from '../../../utils'
import { h, htmlToVNode } from '../snabbdom'

export default function renderLeafBlock (block, cursor, activeBlocks, matches, useCache = false) {
  const { loadMathMap } = this
  let selector = this.getSelector(block, cursor, activeBlocks)
  // highlight search key in block
  const highlights = matches.filter(m => m.key === block.key)
  const {
    text,
    type,
    headingStyle,
    align,
    icon,
    checked,
    key,
    lang,
    functionType,
    editable
  } = block
  const data = {
    props: {},
    attrs: {},
    dataset: {}
  }
  let children = ''
  if (text) {
    let tokens = null
    if (highlights.length === 0 && this.tokenCache.has(text)) {
      tokens = this.tokenCache.get(text)
    } else {
      tokens = tokenizer(text, highlights)
      if (highlights.length === 0 && useCache && DEVICE_MEMORY >= 4) this.tokenCache.set(text, tokens)
    }
    children = tokens.reduce((acc, token) => [...acc, ...this[snakeToCamel(token.type)](h, cursor, block, token)], [])
  }

  if (editable === false) {
    Object.assign(data.attrs, {
      contenteditable: 'false'
    })
  }

  if (/th|td/.test(type) && align) {
    Object.assign(data.attrs, {
      style: `text-align:${align}`
    })
  } else if (type === 'div') {
    if (functionType === 'preview') {
      selector += `.${CLASS_OR_ID['AG_HTML_PREVIEW']}`
      const htmlContent = sanitize(this.muya.contentState.codeBlocks.get(block.preSibling), PREVIEW_DOMPURIFY_CONFIG)
      // handle empty html bock
      if (/<([a-z][a-z\d]*).*>\s*<\/\1>/.test(htmlContent)) {
        children = htmlToVNode('<div class="ag-empty">&lt;Empty HTML Block&gt;</div>')
      } else {
        children = htmlToVNode(htmlContent)
      }
    } else if (functionType === 'multiplemath') {
      const math = this.muya.contentState.codeBlocks.get(block.preSibling)
      const key = `${math}_display_math`
      selector += `.${CLASS_OR_ID['AG_MATH_PREVIEW']}`
      if (math === '') {
        children = '< Empty Mathematical Formula >'
        selector += `.${CLASS_OR_ID['AG_EMPTY']}`
      } else if (loadMathMap.has(key)) {
        children = loadMathMap.get(key)
      } else {
        try {
          const html = katex.renderToString(math, {
            displayMode: true
          })

          children = htmlToVNode(html)
          loadMathMap.set(key, children)
        } catch (err) {
          children = '< Invalid Mathematical Formula >'
          selector += `.${CLASS_OR_ID['AG_MATH_ERROR']}`
        }
      }
    }
  } else if (type === 'svg' && icon) {
    selector += '.icon'
    Object.assign(data.attrs, {
      'aria-hidden': 'true'
    })
    children = [
      h('use', {
        attrs: {
          'xlink:href': `#${icon}`
        }
      })
    ]
  } else if (/^h/.test(type)) {
    if (/^h\d$/.test(type)) {
      Object.assign(data.dataset, {
        head: type,
        id: isInElectron ? require('markdown-toc').slugify(text.replace(/^#+\s(.*)/, (_, p1) => p1)) : ''
      })
      selector += `.${headingStyle}`
    }
    Object.assign(data.dataset, {
      role: type
    })
  } else if (type === 'input') {
    Object.assign(data.attrs, {
      type: 'checkbox'
    })
    selector = `${type}#${key}.${CLASS_OR_ID['AG_TASK_LIST_ITEM_CHECKBOX']}`
    if (checked) {
      Object.assign(data.attrs, {
        checked: true
      })
      selector += `.${CLASS_OR_ID['AG_CHECKBOX_CHECKED']}`
    }
    children = ''
  } else if (type === 'span' && functionType === 'codeLine') {
    selector += `.${CLASS_OR_ID['AG_CODE_LINE']}`
    if (lang && /\S/.test(text)) {
      const highlightedCode = prism.highlight(text, prism.languages[lang], lang)
      const vnode = htmlToVNode(`<code>${highlightedCode}</code>`)

      selector += `.language-${lang}`
      children = vnode.children
    } else {
      children = text
    }
  } else if (type === 'span' && functionType === 'languageInput') {
    selector += `.${CLASS_OR_ID['AG_LANGUAGE_INPUT']}`
    children = text
  }

  return h(selector, data, children)
}
