/**
 * [renderBlock render one block, no matter it is a container block or text block]
 */
import katex from 'katex'
import { CLASS_OR_ID, DEVICE_MEMORY } from '../config'
import { inlineTokenizer } from './inlineTokenizer'
import { snakeToCamel } from './../utils'
import { h, htmlToVNode } from './utils/snabbdom'
import { inlines } from './inlines'

function renderBlock (block, cursor, activeBlocks, matches, useCache = false) {
  const method = block.children.length > 0
    ? 'renderContainerBlock'
    : 'renderLeafBlock'

  return this[method](block, cursor, activeBlocks, matches, useCache)
}

function renderContainerBlock (block, cursor, activeBlocks, matches, useCache = false) {
  // console.log('xxx.x..')

  let selector = this.getSelector(block, cursor, activeBlocks)
  selector += (block.selector ? block.selector : '')
  const data = {
    attrs: block.attrs ? block.attrs : {},
    dataset: block.dataset ? block.dataset : {}
  }

  // handle `div` block
  if (/div/.test(block.type)) {
    if (block.functionType) {
      selector += `.${'ag-function-' + block.functionType}`
    }
    if (block.editable !== undefined && !block.editable) {
      Object.assign(data.attrs, { contenteditable: 'false' })
    }
  }

  if (block.type === 'li' && block.label) {
    const { label, title } = block
    const { align } = activeBlocks[0]

    if (align && block.label === align) {
      selector += '.active'
    }
    Object.assign(data.dataset, { label })
    Object.assign(data.attrs, { title })
  }

  return h(selector, data, block.children.map(child => this.renderBlock(child, cursor, activeBlocks, matches, useCache)))
}

const PRE_BLOCK_HASH = {
  'code': `.${CLASS_OR_ID['AG_CODE_BLOCK']}`,
  'html': `.${CLASS_OR_ID['AG_HTML_BLOCK']}`,
  'frontmatter': `.${CLASS_OR_ID['AG_FRONT_MATTER']}`
}

function renderLeafBlock (block, cursor, activeBlocks, matches, useCache = false) {
  const { loadMathMap, refreshCodeBlock } = this
  let selector = this.getSelector(block, cursor, activeBlocks)
  // highlight search key in block
  selector += (block.selector ? block.selector : '')
  const highlights = matches.filter(m => m.key === block.key)
  const {
    text,
    type,
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
    attrs: block.attrs ? block.attrs : {},
    dataset: block.dataset ? block.dataset : {}
  }
  let children = ''

  if (text) {
    let tokens = null
    if (highlights.length === 0 && this.tokenCache.has(text)) {
      tokens = this.tokenCache.get(text)
    } else {
      tokens = inlineTokenizer(text, highlights)
      if (highlights.length === 0 && useCache && DEVICE_MEMORY >= 4) this.tokenCache.set(text, tokens)
    }
    var self = this
    children = tokens.reduce(function (acc, token) {
      // console.log('token.  .', token.type, self)
      return [...acc, ...inlines.get(snakeToCamel(token.type)).render(h, cursor, block, token, null, self)]
    }, [])
    /* children = tokens.reduce((acc, token) => {
      console.log('token..', token.type)
      return [...acc, ...inlines.get(snakeToCamel(token.type)).render(h, cursor, block, token, null, this)], []
    }) */
  }

  if (editable === false) {
    Object.assign(data.attrs, {
      contenteditable: 'false'
    })
  }

  if (type === 'div') {
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
    children = text
  }

  return h(selector, data, children)
}

export default {
  renderBlock,
  renderLeafBlock,
  renderContainerBlock
}
