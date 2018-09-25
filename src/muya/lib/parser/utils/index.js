import highlight from './highlight'
import loadImageAsync from './loadImageAsync'
import delEmStrongFac from './delEmStringFactory'
import { CLASS_OR_ID, punctuation, BLOCK_TYPE7 } from '../../config'
import { conflict } from '../../utils'
import { validateInlines } from '../inlines'
export const LINE_BREAKS_REG = /\n/
export function chopHTML (value) {
  return value.trim().split(/\n{2,}/)
}

export function checkIsHTML (value) {
  const trimedValue = value.trim()
  const match = /^<([a-zA-Z\d-]+)(?=\s|>).*>/.exec(trimedValue)
  if (match && match[1]) {
    const tag = match[1]
    if (BLOCK_TYPE7.indexOf(tag) > -1) {
      return /^<([a-zA-Z\d-]+)(?=\s|>).*>\n/.test(trimedValue)
    }
    return true
  }
  return false
}

export function getSrcAlt (text) {
  const SRC_REG = /src\s*=\s*("|')([^\1]+?)\1/
  const ALT_REG = /alt\s*=\s*("|')([^\1]+?)\1/
  const srcMatch = SRC_REG.exec(text)
  const src = srcMatch ? srcMatch[2] : ''
  const altMatch = ALT_REG.exec(text)
  const alt = altMatch ? altMatch[2] : ''

  return { src, alt }
}

export function lowerPriority (src, offset) {
  let i
  for (i = 0; i < offset; i++) {
    const text = src.substring(i)
    for (let inline of validateInlines.values()) {
      const to = inline.meta.rule.exec(text)
      if (to && to[0].length > offset - i) {
        return false
      }
    }
  }
  return true
}

export function validateEmphasize (src, offset, marker, pending) {
  /**
   * Intraword emphasis is disallowed for _
   */
  const lastChar = pending.charAt(pending.length - 1)
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
  const index = emphasizeText.indexOf(marker)
  if (index > -1 && /\S/.test(emphasizeText[index + mLen])) {
    return false
  }
  /**
   * Inline code spans, links, images, and HTML tags group more tightly than emphasis.
   * So, when there is a choice between an interpretation that contains one of these elements
   * and one that does not, the former always wins. Thus, for example, *[foo*](bar) is parsed
   * as *<a href="bar">foo*</a> rather than as <em>[foo</em>](bar).
   */
  return lowerPriority(src, offset)
}

function checkConflicted (block, token, cursor) {
  const { start, end } = cursor
  const key = block.key
  const { start: tokenStart, end: tokenEnd } = token.range

  if (key !== start.key && key !== end.key) {
    return false
  } else if (key === start.key && key !== end.key) {
    return conflict([tokenStart, tokenEnd], [start.offset, start.offset])
  } else if (key !== start.key && key === end.key) {
    return conflict([tokenStart, tokenEnd], [end.offset, end.offset])
  } else {
    return conflict([tokenStart, tokenEnd], [start.offset, start.offset]) ||
      conflict([tokenStart, tokenEnd], [end.offset, end.offset])
  }
}

export function getClassName (outerClass, block, token, cursor) {
  return outerClass || (checkConflicted(block, token, cursor) ? CLASS_OR_ID['AG_GRAY'] : CLASS_OR_ID['AG_HIDE'])
}

export function getHighlightClassName (active) {
  return active ? CLASS_OR_ID['AG_HIGHLIGHT'] : CLASS_OR_ID['AG_SELECTION']
}

export function pushPending (params) {
  if (params.pending) {
    params.tokens.push({
      type: 'text',
      raw: params.pending,
      content: params.pending,
      range: {
        start: params.pendingStartPos,
        end: params.pos
      }
    })
  }
  params.pendingStartPos = params.pos
  params.pending = ''
  return params
}

export const escape = function escape (html, encode) {
  return html
    .replace(!encode ? /&(?!#?\w+;)/g : /&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export const unescape = function unescape (html) {
  return html.replace(/&([#\w]+);/g, function (_, n) {
    n = n.toLowerCase()
    if (n === 'colon') return ':'
    if (n.charAt(0) === '#') {
      return n.charAt(1) === 'x'
        ? String.fromCharCode(parseInt(n.substring(2), 16))
        : String.fromCharCode(+n.substring(1))
    }
    return ''
  })
}

export const replace = function replace (regex, opt = '') {
  regex = regex.source
  return function self (name, val) {
    if (!name) return new RegExp(regex, opt)
    val = val.source || val
    /* eslint-disable no-useless-escape */
    val = val.replace(/(^|[^\[])\^/g, '$1')
    /* eslint-ensable no-useless-escape */
    regex = regex.replace(name, val)
    return self
  }
}

export const noop = function noop () { }
noop.exec = noop

export {
  highlight, loadImageAsync, delEmStrongFac
}
