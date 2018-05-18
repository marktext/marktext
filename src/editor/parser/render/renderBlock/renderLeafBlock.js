import { CLASS_OR_ID } from '../../../config'
import { tokenizer } from '../../parse'
import { snakeToCamel } from '../../../utils'
import { h, htmlToVNode } from '../snabbdom'

const PRE_BLOCK_HASH = {
  'code': `.${CLASS_OR_ID['AG_CODE_BLOCK']}`,
  'html': `.${CLASS_OR_ID['AG_HTML_BLOCK']}`,
  'frontmatter': `.${CLASS_OR_ID['AG_FRONT_MATTER']}`
}

export default function renderLeafBlock (block, cursor, activeBlocks, matches, useCache = false) {
  let selector = this.getSelector(block, cursor, activeBlocks)
  // highlight search key in block
  const highlights = matches.filter(m => m.key === block.key)
  const { text, type, headingStyle, align, htmlContent, icon, checked, key, lang, functionType, codeBlockStyle } = block
  const data = {
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
      if (highlights.length === 0 && useCache) this.tokenCache.set(text, tokens)
    }
    children = tokens.reduce((acc, token) => [...acc, ...this[snakeToCamel(token.type)](h, cursor, block, token)], [])
  }

  if (/th|td/.test(type) && align) {
    Object.assign(data.attrs, {
      style: `text-align:${align}`
    })
  } else if (type === 'div' && htmlContent !== undefined) {
    selector += `.${CLASS_OR_ID['AG_HTML_PREVIEW']}`
    Object.assign(data.attrs, {
      contenteditable: 'false'
    })
    children = htmlToVNode(htmlContent)
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
        head: type
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
  } else if (type === 'pre') {
    selector += `.${CLASS_OR_ID['AG_CODEMIRROR_BLOCK']}`
    selector += PRE_BLOCK_HASH[functionType]
    data.hook = {
      prepatch (oldvnode, vnode) {
        // cheat snabbdom that the pre block is not changed!!!
        vnode.children = oldvnode.children
      }
    }
    if (lang) {
      Object.assign(data.dataset, {
        lang
      })
    }

    if (codeBlockStyle) {
      Object.assign(data.dataset, {
        codeBlockStyle
      })
    }

    if (functionType !== 'frontmatter') {
      // do not set it to '' (empty string)
      children = []
    }
  } else if (type === 'span' && functionType === 'frontmatter') {
    selector += `.${CLASS_OR_ID['AG_FRONT_MATTER_LINE']}`
    children = text
  }

  return h(selector, data, children)
}
