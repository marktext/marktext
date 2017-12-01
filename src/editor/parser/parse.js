const isEven = (str = '') => {
  const len = str.length
  return len % 2 === 0
}

const beginRules = {
  'hr': /^\*{3,}|^\-{3,}|^\_{3,}/,
  'code_fense': /^`{3,}[^`]*/,
  'header': /^#{1,6}/ // can nest
}

const inlineRules = {
  'backlash': /^(\\)([\\`*{}\[\]()#+\-.!_>~])/,
  'strong': /^(\*{2}|_{2})([^\s]|[^\s].*?[^\s])(\\*)\1/, // can nest
  'em': /^(\*{1}|_{1})([^\s]|[^\s].*?[^\s])(\\*)\1/, // can nest
  'inline_code': /^(`{1,3})([^`]+?|.{2,})(\\*)\1/,
  'image': /^(\!\[)(.*?)(\\*)\]\((.*?)(\\*)\)/,
  'link': /^(\[)((?:\[[^\]]*\]|[^\[\]]|\](?=[^\[]*\]))*?)(\\*)\]\((.*?)(\\*)\)/, // can nest
  'emoji': /^(:)([^:\\]+?)\1/,
  'del': /^(~{2})(?=\S)([\s\S]*?\S)(\\*)\1/, // can nest
  'auto_link': /^(https?:\/\/[^\s]+)(?=\s|$)/
}

const rules = Object.assign({}, beginRules, inlineRules)
const src = ':smile:'


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

const tokenizer = (src, rules, pos = 0) => {
  const tokens = []
  let pending = ''
  let pendingStartPos = pos
  const pushPending = () => {
    if (pending) tokens.push({
      type: 'text',
      content: pending,
      range: {
        start: pendingStartPos,
        end: pos
      }
    })
    pendingStartPos = pos
    pending = ''
  }
  while (src.length) {
    // backlash
    const backTo = rules.backlash.exec(src)
    if (backTo) {
      pushPending()
      tokens.push({
        type: 'backlash',
        marker: backTo[1],
        content: backTo[2],
        range: {
          start: pos,
          end: pos + backTo[0].length
        }
      })
      src = src.substring(backTo[0].length)
      pos = pos + backTo[0].length
      continue
    }
    // strong | em | emoji | inline_code | del
    const chunks = ['strong', 'em', 'inline_code', 'del', 'emoji']
    const emLen = chunks.length
    let i
    let inChunk
    for (i = 0; i < emLen; i++) {
      const type = chunks[i]
      const to = rules[type].exec(src)
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
            type, range, marker,
            content: to[2],
            backlash: to[3]
          })
        } else {
          tokens.push({
            type,
            range,
            marker,
            children: tokenizer(to[2], inlineRules, pos + to[1].length),
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
    const linkTo = rules.link.exec(src)
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
        children: tokenizer(linkTo[2], inlineRules, pos + linkTo[1].length),
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
    const imageTo = rules.image.exec(src)
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
    const autoLTo = rules['auto_link'].exec(src)
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

console.log(JSON.stringify(tokenizer(src, rules), null, 2))
