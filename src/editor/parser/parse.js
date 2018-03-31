import { beginRules, inlineRules } from './rules'
import { isLengthEven, union } from '../utils'

const CAN_NEST_RULES = ['strong', 'em', 'link', 'del', 'image'] // image can not nest but it has children

const tokenizerFac = (src, beginRules, inlineRules, pos = 0) => {
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
    // strong | em | emoji | inline_code | del | inline_math
    const chunks = ['strong', 'em', 'inline_code', 'del', 'emoji', 'inline_math']
    const chLen = chunks.length
    let i
    let inChunk
    for (i = 0; i < chLen; i++) {
      const type = chunks[i]
      const to = inlineRules[type].exec(src)
      if (to && isLengthEven(to[3])) {
        inChunk = true
        pushPending()
        const range = {
          start: pos,
          end: pos + to[0].length
        }
        const marker = to[1]
        if (type === 'inline_code' || type === 'emoji' || type === 'inline_math') {
          tokens.push({
            type,
            range,
            marker,
            parent: tokens,
            content: to[2],
            backlash: to[3]
          })
        } else {
          tokens.push({
            type,
            range,
            marker,
            parent: tokens,
            children: tokenizerFac(to[2], undefined, inlineRules, pos + to[1].length),
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
        children: tokenizerFac(linkTo[2], undefined, inlineRules, pos + linkTo[1].length),
        backlash: {
          first: linkTo[3],
          second: linkTo[5]
        }
      })

      src = src.substring(linkTo[0].length)
      pos = pos + linkTo[0].length
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
        children: tokenizerFac(imageTo[2], undefined, inlineRules, pos + imageTo[1].length),
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

    if (!pending) pendingStartPos = pos
    pending += src[0]
    src = src.substring(1)
    pos++
  }

  pushPending()
  return tokens
}

export const tokenizer = (src, highlights = []) => {
  const tokens = tokenizerFac(src, beginRules, inlineRules, 0)
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
      case 'image':
        result += `![${generator(token.children)}${getBash(token.backlash.first)}](${token.src}${getBash(token.backlash.second)})`
        break
      case 'auto_link':
        result += token.href
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
