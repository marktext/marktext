// These utils only used for this folder.
// Move punctuation and WHITELIST_ATTRIBUTES here just to prevent `navigator is not defined` error when run test.
export const punctuation = ['!', '"', '#', '$', '%', '&', "'", '(', ')', '*', '+', ',', '-', '.', '/', ':', ';', '<', '=', '>', '?', '@', '[', '\\', ']', '^', '_', '`', '{', '|', '}', '~']
// selected from https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes
export const WHITELIST_ATTRIBUTES = [
  'align', 'alt', 'checked', 'class', 'color', 'dir', 'disabled', 'for', 'height', 'hidden',
  'href', 'id', 'lang', 'lazyload', 'rel', 'spellcheck', 'src', 'srcset', 'start', 'style',
  'target', 'title', 'type', 'value', 'width'
]

const validWidthAndHeight = value => {
  if (!/^\d{1,}$/.test(value)) return ''
  value = parseInt(value)
  return value >= 0 ? value : ''
}

export const lowerPriority = (src, offset, rules) => {
  let i
  for (i = 0; i < offset; i++) {
    const text = src.substring(i)
    for (const rule of Object.keys(rules)) {
      const to = rules[rule].exec(text)
      if (to && to[0].length > offset - i) {
        return false
      }
    }
  }
  return true
}

export const getAttributes = html => {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const target = doc.querySelector('body').firstElementChild
  if (!target) return null
  const attrs = {}
  for (const attr of target.getAttributeNames()) {
    if (!WHITELIST_ATTRIBUTES.includes(attr)) continue
    if (/width|height/.test(attr)) {
      attrs[attr] = validWidthAndHeight(target.getAttribute(attr))
    } else {
      attrs[attr] = target.getAttribute(attr)
    }
  }

  return attrs
}

export const parseSrcAndTitle = (text = '') => {
  const parts = text.split(/\s+/)
  const src = parts[0]
  const rawTitle = text.substring(src.length).trim()
  const TITLE_REG = /^('|")(.*?)\1$/ // we only support use `'` and `"` to indicate a title now.
  let title = ''
  if (rawTitle && TITLE_REG.test(rawTitle)) {
    title = rawTitle.replace(TITLE_REG, '$2')
  }
  return { src, title }
}

export const validateEmphasize = (src, offset, marker, pending, rules) => {
  /**
   * Intraword emphasis is disallowed for _
   */
  const lastChar = pending.charAt(pending.length - 1) || ''
  const followedChar = src[offset]
  const ALPHA_REG = /[a-zA-Z]{1}/
  if (/_/.test(marker)) {
    if (ALPHA_REG.test(lastChar)) return false
    if (followedChar && ALPHA_REG.test(followedChar)) return false
  }
  /**
   * 1. This is not emphasis, because the second * is preceded by punctuation and followed by an alphanumeric
   * (hence it is not part of a right-flanking delimiter run:
   * 2. This is not emphasis, because the opening * is preceded by an alphanumeric and followed by punctuation,
   * and hence not part of a left-flanking delimiter run:
   */
  if (ALPHA_REG.test(lastChar) && punctuation.indexOf(src[marker.length]) > -1) {
    return false
  }

  if (followedChar && ALPHA_REG.test(followedChar) && punctuation.indexOf(src[offset - marker.length - 1]) > -1) {
    return false
  }
  /**
   * When there are two potential emphasis or strong emphasis spans with the same closing delimiter,
   * the shorter one (the one that opens later) takes precedence. Thus, for example, **foo **bar baz**
   * is parsed as **foo <strong>bar baz</strong> rather than <strong>foo **bar baz</strong>.
   */
  const mLen = marker.length
  const emphasizeText = src.substring(mLen, offset - mLen)
  const SHORTER_REG = new RegExp(` \\${marker.split('').join('\\')}[^\\${marker.charAt(0)}]`)
  const CLOSE_REG = new RegExp(`[^\\${marker.charAt(0)}]\\${marker.split('').join('\\')}`)
  if (emphasizeText.match(SHORTER_REG) && !emphasizeText.match(CLOSE_REG)) {
    return false
  }
  /**
   * Inline code spans, links, images, and HTML tags group more tightly than emphasis.
   * So, when there is a choice between an interpretation that contains one of these elements
   * and one that does not, the former always wins. Thus, for example, *[foo*](bar) is parsed
   * as *<a href="bar">foo*</a> rather than as <em>[foo</em>](bar).
   */
  return lowerPriority(src, offset, rules)
}
