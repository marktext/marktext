import { beginRules, inlineRules } from './rules'

const isEven = (str = '') => {
  const len = str.length
  return len % 2 === 0
}

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
    const beginR = ['header', 'hr', 'code_fense']
    const len = beginR.length
    let i
    for (i = 0; i < len; i++) {
      const to = beginRules[beginR[i]].exec(src)
      if (to) {
        const token = {
          type: beginR[i],
          marker: to[1],
          content: to[2] || '',
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
        content: '',
        range: {
          start: pos,
          end: pos + backTo[0].length
        }
      })
      pending += pending + backTo[2]
      src = src.substring(backTo[0].length)
      pos = pos + backTo[0].length
      continue
    }
    // strong | em | emoji | inline_code | del
    const chunks = ['strong', 'em', 'inline_code', 'del', 'emoji']
    const chLen = chunks.length
    let i
    let inChunk
    for (i = 0; i < chLen; i++) {
      const type = chunks[i]
      const to = inlineRules[type].exec(src)
      if (to && isEven(to[3])) {
        inChunk = true
        pushPending()
        const range = {
          start: pos,
          end: pos + to[0].length
        }
        const marker = to[1]
        if (type === 'inline_code' || type === 'emoji') {
          tokens.push({
            type,
            range,
            marker,
            content: to[2],
            backlash: to[3]
          })
        } else {
          tokens.push({
            type,
            range,
            marker,
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
    if (linkTo && isEven(linkTo[3]) && isEven(linkTo[5])) {
      pushPending()
      tokens.push({
        type: 'link',
        marker: linkTo[1],
        href: linkTo[4],
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
        range: {
          start: pos,
          end: pos + imageTo[0].length
        },
        title: imageTo[2],
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

export const tokenizer = src => {
  return tokenizerFac(src, beginRules, inlineRules, 0)
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
