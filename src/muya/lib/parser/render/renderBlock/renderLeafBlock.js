import katex from 'katex'
import { CLASS_OR_ID, DEVICE_MEMORY, isInElectron } from '../../../config'
import { tokenizer } from '../../parse'
import { snakeToCamel } from '../../../utils'
import { h, htmlToVNode } from '../snabbdom'

const PRE_BLOCK_HASH = {
  'code': `.${CLASS_OR_ID['AG_CODE_BLOCK']}`,
  'html': `.${CLASS_OR_ID['AG_HTML_BLOCK']}`,
  'frontmatter': `.${CLASS_OR_ID['AG_FRONT_MATTER']}`
}

export default function renderLeafBlock (block, cursor, activeBlocks, matches, useCache = false) {
  const { loadMathMap, refreshCodeBlock } = this
  let selector = this.getSelector(block, cursor, activeBlocks)
  // highlight search key in block
  const highlights = matches.filter(m => m.key === block.key)
  const {
    text,
    type,
    headingStyle,
    align,
    htmlContent,
    icon,
    checked,
    key,
    lang,
    functionType,
    codeBlockStyle,
    math,
    editable
  } = block
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
    if (typeof htmlContent === 'string') {
      selector += `.${CLASS_OR_ID['AG_HTML_PREVIEW']}`
      children = htmlToVNode(htmlContent)
    } else if (typeof math === 'string') {
      const key = `${math}_display_math`
      selector += `.${CLASS_OR_ID['AG_MATH_PREVIEW']}`
      if (math === '') {
        children = '< Empty Mathematical Formula >'
        selector += `.${CLASS_OR_ID['AG_MATH_EMPTY']}`
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
  } else if (type === 'pre') {
    selector += `.${CLASS_OR_ID['AG_CODEMIRROR_BLOCK']}`
    selector += PRE_BLOCK_HASH[functionType]
    data.hook = {
      prepatch (oldvnode, vnode) {
        // cheat snabbdom that the pre block is not changed!!!
        if (!refreshCodeBlock) {
          vnode.children = oldvnode.children
        }
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

    if (/code|html/.test(functionType)) {
      // do not set it to '' (empty string)
      children = []
    }
  } else if (type === 'span' && /frontmatter|multiplemath/.test(functionType)) {
    if (functionType === 'frontmatter') {
      selector += `.${CLASS_OR_ID['AG_FRONT_MATTER_LINE']}`
    }
    if (functionType === 'multiplemath') {
      selector += `.${CLASS_OR_ID['AG_MULTIPLE_MATH_LINE']}`
    }
    children = text
  }

  return h(selector, data, children)
}
