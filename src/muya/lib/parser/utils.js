// These utils only used for this folder.
// Move punctuation and WHITELIST_ATTRIBUTES here just to prevent `navigator is not defined` error when run test.
// ASCII PUNCTUATION character
export const punctuation = ['!', '"', '#', '$', '%', '&', "'", '(', ')', '*', '+', ',', '-', '.', '/', ':', ';', '<', '=', '>', '?', '@', '[', '\\', ']', '^', '_', '`', '{', '|', '}', '~']
// selected from https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes
export const WHITELIST_ATTRIBUTES = [
  'align', 'alt', 'checked', 'class', 'color', 'dir', 'disabled', 'for', 'height', 'hidden',
  'href', 'id', 'lang', 'lazyload', 'rel', 'spellcheck', 'src', 'srcset', 'start', 'style',
  'target', 'title', 'type', 'value', 'width'
]

export const unicodeZsCategory = [
  '\u0020', '\u00A0', '\u1680', '\u2000', '\u2001', '\u2001',
  '\u2002', '\u2003', '\u2004', '\u2005', '\u2006', '\u2007',
  '\u2008', '\u2009', '\u200A', '\u202F', '\u205F', '\u3000'
]

export const space = ['\u0020'] // space

export const whitespaceCharacter = [
  ...space, // space
  '\u0009', // tab
  '\u000A', // newline
  '\u000B', // tabulation
  '\u000C', // form feed
  '\u000D' // carriage return
]

export const unicodeWhitespaceCharacter = [
  ...unicodeZsCategory,
  '\u0009', // tab
  '\u000D', // carriage return
  '\u000A', // newline
  '\u000C' // form feed
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

const canOpenEmphasis = (src, marker, pending) => {
  const precededChar = pending.charAt(pending.length - 1) || ''
  const followedChar = src[marker.length]
  // not followed by Unicode whitespace, 
  if (unicodeWhitespaceCharacter.includes(followedChar)) {
    return false
  }
  // and either (2a) not followed by a punctuation character,
  // or (2b) followed by a punctuation character and preceded by Unicode whitespace or a punctuation character.
  // For purposes of this definition, the beginning and the end of the line count as Unicode whitespace.
  if (punctuation.includes(followedChar) && !(!precededChar || unicodeWhitespaceCharacter.includes(precededChar) || punctuation.includes(precededChar))) {
    return false
  }
  if (/_/.test(marker) && !(!precededChar || unicodeWhitespaceCharacter.includes(precededChar) || punctuation.includes(precededChar))) {
    return false
  }
  return true
}

const canCloseEmphasis = (src, offset, marker, pending) => {
  const precededChar = src[offset - marker.length - 1]
  const followedChar = src[offset] || ''
  // not preceded by Unicode whitespace, 
  if (unicodeWhitespaceCharacter.includes(precededChar)) {
    return false
  }
  // either (2a) not preceded by a punctuation character,
  // or (2b) preceded by a punctuation character and followed by Unicode whitespace or a punctuation character.
  if (punctuation.includes(precededChar) && !(!followedChar || unicodeWhitespaceCharacter.includes(followedChar) || punctuation.includes(followedChar))) {
    return false
  }
  if (/_/.test(marker) && !(!followedChar || unicodeWhitespaceCharacter.includes(followedChar) || punctuation.includes(followedChar))) {
    return false
  }
  return true
}

export const validateEmphasize = (src, offset, marker, pending, rules) => {
  if (!canOpenEmphasis(src, marker, pending)) {
    return false
  }
  if (!canCloseEmphasis(src, offset, marker, pending)) {
    return false
  }

  /**
   * 16.When there are two potential emphasis or strong emphasis spans with the same closing delimiter,
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
   * 17.Inline code spans, links, images, and HTML tags group more tightly than emphasis.
   * So, when there is a choice between an interpretation that contains one of these elements
   * and one that does not, the former always wins. Thus, for example, *[foo*](bar) is parsed
   * as *<a href="bar">foo*</a> rather than as <em>[foo</em>](bar).
   */
  return lowerPriority(src, offset, rules)
}
