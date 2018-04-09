import { beginRules, inlineRules } from './rules'
import { isLengthEven, union } from '../utils'
import { punctuation } from '../config'

const CAN_NEST_RULES = ['strong', 'em', 'link', 'del', 'image', 'a_link'] // image can not nest but it has children

const validateRules = Object.assign({}, inlineRules)
delete validateRules.em
delete validateRules.strong
delete validateRules['tail_header']
delete validateRules['backlash']

const getSrcAlt = text => {
  const SRC_REG = /src\s*=\s*("|')([^\1]+?)\1/
  const ALT_REG = /alt\s*=\s*("|')([^\1]+?)\1/
  const srcMatch = SRC_REG.exec(text)
  const src = srcMatch ? srcMatch[2] : ''
  const altMatch = ALT_REG.exec(text)
  const alt = altMatch ? altMatch[2] : ''

  return { src, alt }
}

const validateEmphasize = (src, offset, marker, pending) => {
  console.log(src, offset, marker)
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
  let i
  for (i = 0; i < offset; i++) {
    const text = src.substring(i)
    for (const rule of Object.keys(validateRules)) {
      const to = validateRules[rule].exec(text)
      if (to && to[0].length > offset - i) {
        return false
      }
    }
  }
  return true
}

const tokenizerFac = (src, beginRules, inlineRules, pos = 0, top) => {
  const tokens = []
  let pending = ''
  let pendingStartPos = pos

  const pushPending = () => {
    if (pending) {
      tokens.push({
        type: 'text',
        content: pending,
        range: {
          start: pendingStartPos,
          end: pos
        }
      })
    }

    pendingStartPos = pos
    pending = ''
  }

  if (beginRules) {
    const beginR = ['header', 'hr', 'code_fense', 'display_math']

    for (const ruleName of beginR) {
      const to = beginRules[ruleName].exec(src)

      if (to) {
        if (ruleName === 'display_math' && !isLengthEven(to[3])) continue
        const token = {
          type: ruleName,
          parent: tokens,
          marker: to[1],
          content: to[2] || '',
          backlash: to[3] || '',
          range: {
            start: pos,
            end: pos + to[0].length
          }
        }
        tokens.push(token)
        src = src.substring(to[0].length)
        pos = pos + to[0].length
        break
      }
    }
  }

  while (src.length) {
    // backlash
    const backTo = inlineRules.backlash.exec(src)
    console.log(backTo)
    if (backTo) {
      pushPending()
      tokens.push({
        type: 'backlash',
        marker: backTo[1],
        parent: tokens,
        content: '',
        range: {
          start: pos,
          end: pos + backTo[1].length
        }
      })
      pending += pending + backTo[2]
      pendingStartPos = pos + backTo[1].length
      src = src.substring(backTo[0].length)
      pos = pos + backTo[0].length
      continue
    }
    // strong | em
    const emRules = ['strong', 'em']
    let inChunk
    for (const rule of emRules) {
      const to = inlineRules[rule].exec(src)
      if (to && isLengthEven(to[3])) {
        const isValid = validateEmphasize(src, to[0].length, to[1], pending)
        if (isValid) {
          inChunk = true
          pushPending()
          const range = {
            start: pos,
            end: pos + to[0].length
          }
          const marker = to[1]
          tokens.push({
            type: rule,
            range,
            marker,
            parent: tokens,
            children: tokenizerFac(to[2], undefined, inlineRules, pos + to[1].length, false),
            backlash: to[3]
          })
          src = src.substring(to[0].length)
          pos = pos + to[0].length
        }
        break
      }
    }
    if (inChunk) continue

    // strong | em | emoji | inline_code | del | inline_math
    const chunks = ['inline_code', 'del', 'emoji', 'inline_math']
    for (const rule of chunks) {
      const to = inlineRules[rule].exec(src)
      if (to && isLengthEven(to[3])) {
        inChunk = true
        pushPending()
        const range = {
          start: pos,
          end: pos + to[0].length
        }
        const marker = to[1]
        if (rule === 'inline_code' || rule === 'emoji' || rule === 'inline_math') {
          tokens.push({
            type: rule,
            range,
            marker,
            parent: tokens,
            content: to[2],
            backlash: to[3]
          })
        } else {
          tokens.push({
            type: rule,
            range,
            marker,
            parent: tokens,
            children: tokenizerFac(to[2], undefined, inlineRules, pos + to[1].length, false),
            backlash: to[3]
          })
        }
        src = src.substring(to[0].length)
        pos = pos + to[0].length
        break
      }
    }
    if (inChunk) continue
    // link
    const linkTo = inlineRules.link.exec(src)
    if (linkTo && isLengthEven(linkTo[3]) && isLengthEven(linkTo[5])) {
      pushPending()
      tokens.push({
        type: 'link',
        marker: linkTo[1],
        href: linkTo[4],
        parent: tokens,
        anchor: linkTo[2],
        range: {
          start: pos,
          end: pos + linkTo[0].length
        },
        children: tokenizerFac(linkTo[2], undefined, inlineRules, pos + linkTo[1].length, false),
        backlash: {
          first: linkTo[3],
          second: linkTo[5]
        }
      })

      src = src.substring(linkTo[0].length)
      pos = pos + linkTo[0].length
      continue
    }

    // a_link `<a href="url">Anchor</a>`
    const aLinkTo = inlineRules['a_link'].exec(src)
    if (aLinkTo) {
      pushPending()
      tokens.push({
        type: 'a_link',
        href: aLinkTo[3],
        openTag: aLinkTo[1],
        closeTag: aLinkTo[5],
        anchor: aLinkTo[4],
        parent: tokens,
        range: {
          start: pos,
          end: pos + aLinkTo[0].length
        },
        children: tokenizerFac(aLinkTo[4], undefined, inlineRules, pos + aLinkTo[1].length, false)
      })

      src = src.substring(aLinkTo[0].length)
      pos = pos + aLinkTo[0].length
      continue
    }

    // html-image
    const htmlImageTo = inlineRules['html_image'].exec(src)
    if (htmlImageTo) {
      const rawAttr = htmlImageTo[2]
      const { src: imageSrc, alt } = getSrcAlt(rawAttr)
      if (imageSrc) {
        pushPending()
        tokens.push({
          type: 'html_image',
          tag: htmlImageTo[1],
          parent: tokens,
          src: imageSrc,
          alt,
          range: {
            start: pos,
            end: pos + htmlImageTo[0].length
          }
        })
        src = src.substring(htmlImageTo[0].length)
        pos = pos + htmlImageTo[0].length
        continue
      }
    }

    // html-tag
    const htmlTo = inlineRules['html_tag'].exec(src)
    if (htmlTo) {
      pushPending()
      tokens.push({
        type: 'html_tag',
        tag: htmlTo[1],
        parent: tokens,
        range: {
          start: pos,
          end: pos + htmlTo[0].length
        }
      })
      src = src.substring(htmlTo[0].length)
      pos = pos + htmlTo[0].length
      continue
    }

    // image
    const imageTo = inlineRules.image.exec(src)
    if (imageTo) {
      pushPending()
      tokens.push({
        type: 'image',
        marker: imageTo[1],
        src: imageTo[4],
        parent: tokens,
        range: {
          start: pos,
          end: pos + imageTo[0].length
        },
        title: imageTo[2],
        children: tokenizerFac(imageTo[2], undefined, inlineRules, pos + imageTo[1].length, false),
        backlash: {
          first: imageTo[3],
          second: imageTo[5]
        }
      })
      src = src.substring(imageTo[0].length)
      pos = pos + imageTo[0].length
      continue
    }
    // auto link
    const autoLTo = inlineRules['auto_link'].exec(src)
    if (autoLTo) {
      pushPending()
      tokens.push({
        type: 'auto_link',
        href: autoLTo[0],
        parent: tokens,
        range: {
          start: pos,
          end: pos + autoLTo[0].length
        }
      })
      src = src.substring(autoLTo[0].length)
      pos = pos + autoLTo[0].length
      continue
    }
    // tail header
    const tailTo = inlineRules['tail_header'].exec(src)
    if (tailTo && top) {
      pushPending()
      tokens.push({
        type: 'tail_header',
        marker: tailTo[1],
        parent: tokens,
        range: {
          start: pos,
          end: pos + tailTo[1].length
        }
      })
      src = src.substring(tailTo[1].length)
      pos += tailTo[1].length
      continue
    }

    if (!pending) pendingStartPos = pos
    pending += src[0]
    src = src.substring(1)
    pos++
  }

  pushPending()
  return tokens
}

export const tokenizer = (src, highlights = []) => {
  const tokens = tokenizerFac(src, beginRules, inlineRules, 0, true)
  const postTokenizer = tokens => {
    for (const token of tokens) {
      for (const light of highlights) {
        const highlight = union(token.range, light)
        if (highlight) {
          if (token.highlights && Array.isArray(token.highlights)) {
            token.highlights.push(highlight)
          } else {
            token.highlights = [highlight]
          }
        }
      }
      if (CAN_NEST_RULES.indexOf(token.type) > -1) {
        postTokenizer(token.children)
      }
    }
  }
  if (highlights.length) {
    postTokenizer(tokens)
  }

  return tokens
}

// transform `tokens` to text ignore the range of token
// the opposite of tokenizer
export const generator = tokens => {
  let result = ''
  const getBash = bash => bash !== undefined ? bash : ''
  for (const token of tokens) {
    switch (token.type) {
      case 'hr':
      case 'header':
      case 'code_fense':
      case 'backlash':
        result += token.marker + token.content
        break
      case 'text':
        result += token.content
        break
      case 'em':
      case 'del':
      case 'strong':
        result += `${token.marker}${generator(token.children)}${getBash(token.backlash)}${token.marker}`
        break
      case 'emoji':
      case 'inline_code':
      case 'inline_math':
        result += `${token.marker}${token.content}${getBash(token.backlash)}${token.marker}`
        break
      case 'link':
        result += `[${generator(token.children)}${getBash(token.backlash.first)}](${token.href}${getBash(token.backlash.second)})`
        break
      case 'a_link':
        result += `${token.openTag}${token.anchor}${token.closeTag}`
        break
      case 'image':
        result += `![${generator(token.children)}${getBash(token.backlash.first)}](${token.src}${getBash(token.backlash.second)})`
        break
      case 'auto_link':
        result += token.href
        break
      case 'html-image':
      case 'html_tag':
        result += token.tag
        break
      case 'tail_header':
        result += token.marker
        break
      default:
        throw new Error(`unhandle token type: ${token.type}`)
    }
  }
  return result
}

/**
 * [{
 *   type: 'hr',
 *   marker: '****',
 *   range: {
 *     start: 0,
 *     end: 4
 *   }
 * }, {
 *   type: 'text',
 *   content: 'abc',
 *   range: {
 *     start: 5, end: 7
 *   }
 * }, {
 *   type: 'strong',
 *   marker: '**',
 *   range: { start: 8, end: 10 }
 *   children: [{
 *     type: 'text',
 *     content: 'abc',
 *     range: { start, 8, end: 9 }
 *   }]
 * }]
 */
