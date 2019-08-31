import katex from 'katex'
import mermaid from 'mermaid/dist/mermaid.core'
import prism, { loadedCache, transfromAliasToOrigin } from '../../../prism/'
import { CLASS_OR_ID, DEVICE_MEMORY, PREVIEW_DOMPURIFY_CONFIG, HAS_TEXT_BLOCK_REG } from '../../../config'
import { tokenizer } from '../../'
import { snakeToCamel, sanitize, escapeHtml, getLongUniqueId, getImageInfo } from '../../../utils'
import { h, htmlToVNode } from '../snabbdom'

// todo@jocs any better solutions?
const MARKER_HASK = {
  '<': `%${getLongUniqueId()}%`,
  '>': `%${getLongUniqueId()}%`,
  '"': `%${getLongUniqueId()}%`,
  "'": `%${getLongUniqueId()}%`
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

const hasReferenceToken = tokens => {
  let result = false
  const travel = tokens => {
    for (const token of tokens) {
      if (/reference_image|reference_link/.test(token.type)) {
        result = true
        break
      }
      if (Array.isArray(token.children) && token.children.length) {
        travel(token.children)
      }
    }
  }
  travel(tokens)
  return result
}

export default function renderLeafBlock (block, activeBlocks, matches, useCache = false) {
  const { loadMathMap } = this
  const { cursor } = this.muya.contentState
  let selector = this.getSelector(block, activeBlocks)
  // highlight search key in block
  const highlights = matches.filter(m => m.key === block.key)
  const {
    text,
    type,
    align,
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
    let tokens = []
    if (highlights.length === 0 && this.tokenCache.has(text)) {
      tokens = this.tokenCache.get(text)
    } else if (
      HAS_TEXT_BLOCK_REG.test(type) &&
      functionType !== 'codeLine' &&
      functionType !== 'languageInput'
    ) {
      const hasBeginRules = type === 'span'
      tokens = tokenizer(text, highlights, hasBeginRules, this.labels)
      const hasReferenceTokens = hasReferenceToken(tokens)
      if (highlights.length === 0 && useCache && DEVICE_MEMORY >= 4 && !hasReferenceTokens) {
        this.tokenCache.set(text, tokens)
      }
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
    const code = this.codeCache.get(block.preSibling)
    switch (functionType) {
      case 'html': {
        selector += `.${CLASS_OR_ID.AG_HTML_PREVIEW}`
        const htmlContent = sanitize(code, PREVIEW_DOMPURIFY_CONFIG)
        // handle empty html bock
        if (/^<([a-z][a-z\d]*)[^>]*?>(\s*)<\/\1>$/.test(htmlContent.trim())) {
          children = htmlToVNode('<div class="ag-empty">&lt;Empty HTML Block&gt;</div>')
        } else {
          const parser = new DOMParser()
          const doc = parser.parseFromString(htmlContent, 'text/html')
          const imgs = doc.documentElement.querySelectorAll('img')
          for (const img of imgs) {
            const src = img.getAttribute('src')
            const imageInfo = getImageInfo(src)
            img.setAttribute('src', imageInfo.src)
          }

          children = htmlToVNode(doc.documentElement.querySelector('body').innerHTML)
        }
        break
      }
      case 'multiplemath': {
        const key = `${code}_display_math`
        selector += `.${CLASS_OR_ID.AG_CONTAINER_PREVIEW}`
        if (code === '') {
          children = '< Empty Mathematical Formula >'
          selector += `.${CLASS_OR_ID.AG_EMPTY}`
        } else if (loadMathMap.has(key)) {
          children = loadMathMap.get(key)
        } else {
          try {
            const html = katex.renderToString(code, {
              displayMode: true
            })

            children = htmlToVNode(html)
            loadMathMap.set(key, children)
          } catch (err) {
            children = '< Invalid Mathematical Formula >'
            selector += `.${CLASS_OR_ID.AG_MATH_ERROR}`
          }
        }
        break
      }
      case 'mermaid': {
        selector += `.${CLASS_OR_ID.AG_CONTAINER_PREVIEW}`
        if (code === '') {
          children = '< Empty Mermaid Block >'
          selector += `.${CLASS_OR_ID.AG_EMPTY}`
        } else {
          try {
            mermaid.parse(code)
            children = code
            this.mermaidCache.add(`#${block.key}`)
          } catch (err) {
            children = '< Invalid Mermaid Codes >'
            selector += `.${CLASS_OR_ID.AG_MATH_ERROR}`
          }
        }
        break
      }
      case 'flowchart':
      case 'sequence':
      case 'vega-lite': {
        selector += `.${CLASS_OR_ID.AG_CONTAINER_PREVIEW}`
        if (code === '') {
          children = '< Empty Diagram Block >'
          selector += `.${CLASS_OR_ID.AG_EMPTY}`
        } else {
          children = ''
          this.diagramCache.set(`#${block.key}`, {
            code,
            functionType
          })
        }
        break
      }
    }
  } else if (type === 'input') {
    Object.assign(data.attrs, {
      type: 'checkbox'
    })
    selector = `${type}#${key}.${CLASS_OR_ID.AG_TASK_LIST_ITEM_CHECKBOX}`
    if (checked) {
      Object.assign(data.attrs, {
        checked: true
      })
      selector += `.${CLASS_OR_ID.AG_CHECKBOX_CHECKED}`
    }
    children = ''
  } else if (type === 'span' && functionType === 'codeLine') {
    const code = escapeHtml(getHighlightHtml(text, highlights, true))
      .replace(new RegExp(MARKER_HASK['<'], 'g'), '<')
      .replace(new RegExp(MARKER_HASK['>'], 'g'), '>')
      .replace(new RegExp(MARKER_HASK['"'], 'g'), '"')
      .replace(new RegExp(MARKER_HASK["'"], 'g'), "'")
    // transfrom alias to original language
    const transformedLang = transfromAliasToOrigin([lang])[0]

    if (transformedLang && /\S/.test(code) && loadedCache.has(transformedLang)) {
      const wrapper = document.createElement('div')
      wrapper.classList.add(`language-${transformedLang}`)
      wrapper.innerHTML = code
      prism.highlightElement(wrapper, false, function () {
        const highlightedCode = this.innerHTML
        selector += `.language-${transformedLang}`
        children = htmlToVNode(highlightedCode)
      })
    } else {
      children = htmlToVNode(code)
    }
  } else if (type === 'span' && functionType === 'languageInput') {
    const html = getHighlightHtml(text, highlights)
    children = htmlToVNode(html)
  }
  if (!block.parent) {
    return h(selector, data, [this.renderIcon(block), ...children])
  } else {
    return h(selector, data, children)
  }
}
