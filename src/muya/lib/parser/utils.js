// ASCII PUNCTUATION character
// export const punctuation = ['!', '"', '#', '$', '%', '&', "'", '(', ')', '*', '+', ',', '-', '.', '/', ':', ';', '<', '=', '>', '?', '@', '[', '\\', ']', '^', '_', '`', '{', '|', '}', '~']
/* eslint-disable no-useless-escape */
export const PUNCTUATION_REG = new RegExp(/[!"#$%&'()*+,\-./:;<=>?@\[\]^_`{|}~\xA1\xA7\xAB\xB6\xB7\xBB\xBF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061E\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u0AF0\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166D\u166E\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B5A-\u1B60\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2010-\u2027\u2030-\u2043\u2045-\u2051\u2053-\u205E\u207D\u207E\u208D\u208E\u2308-\u230B\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E42\u3001-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA8FC\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65]|\uD800[\uDD00-\uDD02\uDF9F\uDFD0]|\uD801\uDD6F|\uD802[\uDC57\uDD1F\uDD3F\uDE50-\uDE58\uDE7F\uDEF0-\uDEF6\uDF39-\uDF3F\uDF99-\uDF9C]|\uD804[\uDC47-\uDC4D\uDCBB\uDCBC\uDCBE-\uDCC1\uDD40-\uDD43\uDD74\uDD75\uDDC5-\uDDC9\uDDCD\uDDDB\uDDDD-\uDDDF\uDE38-\uDE3D\uDEA9]|\uD805[\uDCC6\uDDC1-\uDDD7\uDE41-\uDE43\uDF3C-\uDF3E]|\uD809[\uDC70-\uDC74]|\uD81A[\uDE6E\uDE6F\uDEF5\uDF37-\uDF3B\uDF44]|\uD82F\uDC9F|\uD836[\uDE87-\uDE8B]/)
/* eslint-enable no-useless-escape */
// selected from https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes
export const WHITELIST_ATTRIBUTES = [
  'align', 'alt', 'checked', 'class', 'color', 'dir', 'disabled', 'for', 'height', 'hidden',
  'href', 'id', 'lang', 'lazyload', 'rel', 'spellcheck', 'src', 'srcset', 'start', 'style',
  'target', 'title', 'type', 'value', 'width', 'data-align'
]

// export const unicodeZsCategory = [
//   '\u0020', '\u00A0', '\u1680', '\u2000', '\u2001', '\u2001',
//   '\u2002', '\u2003', '\u2004', '\u2005', '\u2006', '\u2007',
//   '\u2008', '\u2009', '\u200A', '\u202F', '\u205F', '\u3000'
// ]

// export const space = ['\u0020'] // space

// export const whitespaceCharacter = [
//   ...space, // space
//   '\u0009', // tab
//   '\u000A', // newline
//   '\u000B', // tabulation
//   '\u000C', // form feed
//   '\u000D' // carriage return
// ]

// export const unicodeWhitespaceCharacter = [
//   ...unicodeZsCategory,
//   '\u0009', // tab
//   '\u000D', // carriage return
//   '\u000A', // newline
//   '\u000C' // form feed
// ]

const UNICODE_WHITESPACE_REG = /^\s/

const validWidthAndHeight = value => {
  if (!/^\d{1,}$/.test(value)) return ''
  value = parseInt(value)
  return value >= 0 ? value : ''
}

export const lowerPriority = (src, offset, rules) => {
  let i
  const ignoreIndex = []
  for (i = 0; i < offset; i++) {
    if (ignoreIndex.includes(i)) {
      continue
    }
    const text = src.substring(i)
    for (const rule of Object.keys(rules)) {
      const to = rules[rule].exec(text)
      if (to && to[0].length <= offset - i) {
        ignoreIndex.push(i + to[0].length - 1)
      }
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
  if (target.tagName === 'IMG') {
    Object.assign(attrs, {
      title: '',
      src: '',
      alt: ''
    })
  }
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
  if (parts.length === 1) {
    return {
      src: text.trim(),
      title: ''
    }
  }
  const rawTitle = parts.pop()
  let src = ''
  const TITLE_REG = /^('|")(.*?)\1$/ // we only support use `'` and `"` to indicate a title now.
  let title = ''
  if (rawTitle && TITLE_REG.test(rawTitle)) {
    title = rawTitle.replace(TITLE_REG, '$2')
  }
  if (title) {
    src = text.substring(0, text.length - rawTitle.length).trim()
  } else {
    src = text.trim()
  }
  return { src, title }
}

const canOpenEmphasis = (src, marker, pending) => {
  const precededChar = pending.charAt(pending.length - 1) || '\n'
  const followedChar = src[marker.length]
  // not followed by Unicode whitespace,
  if (UNICODE_WHITESPACE_REG.test(followedChar)) {
    return false
  }
  // and either (2a) not followed by a punctuation character,
  // or (2b) followed by a punctuation character and preceded by Unicode whitespace or a punctuation character.
  // For purposes of this definition, the beginning and the end of the line count as Unicode whitespace.
  if (PUNCTUATION_REG.test(followedChar) && !(UNICODE_WHITESPACE_REG.test(precededChar) || PUNCTUATION_REG.test(precededChar))) {
    return false
  }
  if (/_/.test(marker) && !(UNICODE_WHITESPACE_REG.test(precededChar) || PUNCTUATION_REG.test(precededChar))) {
    return false
  }
  return true
}

const canCloseEmphasis = (src, offset, marker) => {
  const precededChar = src[offset - marker.length - 1]
  const followedChar = src[offset] || '\n'
  // not preceded by Unicode whitespace,
  if (UNICODE_WHITESPACE_REG.test(precededChar)) {
    return false
  }
  // either (2a) not preceded by a punctuation character,
  // or (2b) preceded by a punctuation character and followed by Unicode whitespace or a punctuation character.
  if (PUNCTUATION_REG.test(precededChar) && !(UNICODE_WHITESPACE_REG.test(followedChar) || PUNCTUATION_REG.test(followedChar))) {
    return false
  }
  if (/_/.test(marker) && !(UNICODE_WHITESPACE_REG.test(followedChar) || PUNCTUATION_REG.test(followedChar))) {
    return false
  }
  return true
}

export const validateEmphasize = (src, offset, marker, pending, rules) => {
  if (!canOpenEmphasis(src, marker, pending)) {
    return false
  }
  if (!canCloseEmphasis(src, offset, marker)) {
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
