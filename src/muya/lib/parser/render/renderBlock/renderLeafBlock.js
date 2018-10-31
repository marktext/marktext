import katex from 'katex'
import prism, { loadedCache } from '../../../prism/'
import { CLASS_OR_ID, DEVICE_MEMORY, isInElectron, PREVIEW_DOMPURIFY_CONFIG } from '../../../config'
import { tokenizer } from '../../parse'
import { snakeToCamel, sanitize, escapeHtml, getLongUniqueId } from '../../../utils'
import { h, htmlToVNode } from '../snabbdom'
import alignLeftIcon from '../../../assets/icons/align_left.svg'
import alignRightIcon from '../../../assets/icons/align_right.svg'
import alignCenterIcon from '../../../assets/icons/align_center.svg'
import tableIcon from '../../../assets/icons/table.svg'
import deleteIcon from '../../../assets/icons/delete.svg'

// todo@jocs any better solutions?
const MARKER_HASK = {
  '<': `%${getLongUniqueId()}%`,
  '>': `%${getLongUniqueId()}%`,
  '"': `%${getLongUniqueId()}%`,
  "'": `%${getLongUniqueId()}%`
}

const ICON_MAP = {
  'icon-alignright': alignRightIcon,
  'icon-alignleft': alignLeftIcon,
  'icon-del': deleteIcon,
  'icon-table': tableIcon,
  'icon-aligncenter': alignCenterIcon
}

const getHighlightHtml = (text, highlights, escape = false) => {
  let code = ''
  let pos = 0
  for (const highlight of highlights) {
    const { start, end, active } = highlight
    code += text.substring(pos, start)
    const className = active ? 'ag-highlight' : 'ag-selection'
    code += escape
      ? `${MARKER_HASK['<']}span class=${MARKER_HASK['"']}${className}${MARKER_HASK['"']}${MARKER_HASK['>']}${text.substring(start, end)}${MARKER_HASK['<']}/span${MARKER_HASK['>']}`
      : `<span class="${className}">${text.substring(start, end)}</span>`
    pos = end
  }
  if (pos !== text.length) {
    code += text.substring(pos)
  }
  return code
}

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
    dataset: {},
    style: {}
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
    const iconSvg = ICON_MAP[icon]
    Object.assign(data.attrs, {
      'viewBox': iconSvg.viewBox,
      'aria-hidden': 'true'
    })

    children = [
      h('use', {
        attrs: {
          'xlink:href': `.${iconSvg.url}`
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
    const code = escapeHtml(getHighlightHtml(text, highlights, true))
      .replace(new RegExp(MARKER_HASK['<'], 'g'), '<')
      .replace(new RegExp(MARKER_HASK['>'], 'g'), '>')
      .replace(new RegExp(MARKER_HASK['"'], 'g'), '"')
      .replace(new RegExp(MARKER_HASK["'"], 'g'), "'")

    selector += `.${CLASS_OR_ID['AG_CODE_LINE']}`

    if (lang && /\S/.test(code) && loadedCache.has(lang)) {
      const wrapper = document.createElement('div')
      wrapper.classList.add(`language-${lang}`)
      wrapper.innerHTML = code
      prism.highlightElement(wrapper, false, function () {
        const highlightedCode = this.innerHTML
        selector += `.language-${lang}`
        children = htmlToVNode(highlightedCode)
      })
    } else {
      children = htmlToVNode(code)
    }
  } else if (type === 'span' && functionType === 'languageInput') {
    const html = getHighlightHtml(text, highlights)
    selector += `.${CLASS_OR_ID['AG_LANGUAGE_INPUT']}`
    children = htmlToVNode(html)
  }

  return h(selector, data, children)
}
