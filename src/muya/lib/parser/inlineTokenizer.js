import { union } from '../utils'
import { pushPending } from './utils'
import { beginInlines, notBeginInlines, nestInlines } from './inlines'

export const tokenizerFac = (src, beginInlines, notBeginInlines, pos = 0, top) => {
  const params = {
    beginInlines: beginInlines,
    notBeginInlines: notBeginInlines,
    src: src,
    tokens: [],
    pending: '',
    pendingStartPos: pos,
    pos: pos,
    top: top
  }

  let result
  if (beginInlines && params.pos === 0) {
    for (let inline of beginInlines.values()) {
      // console.log('beginInlines..', inline, params)
      result = inline.parse(params)
      // console.log('result.. .', result)
      if (result.ok) break
    }
  }
  while (params.src.length) {
    // console.log('t params.src..', JSON.stringify(params.src, null, 2))
    for (let inline of notBeginInlines.values()) {
      // console.log('notBeginInlines..', inline)
      result = inline.parse(params)
      // console.log('result...', result)
      if (result.ok) break
    }
    if (result.ok) continue

    if (!params.pending) params.pendingStartPos = params.pos
    params.pending += params.src[0]

    params.src = params.src.substring(1)
    params.pos++
  }

  // console.log('src...', params.src)
  pushPending(params)
  // console.log('src..2.', params.src)
  // console.log('tokens...', params.tokens)
  return params.tokens
}

export const inlineTokenizer = (src, highlights = []) => {
  const tokens = tokenizerFac(src, beginInlines, notBeginInlines, 0, true)
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
      if (nestInlines.has(token.type) > -1) {
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
  for (const token of tokens) {
    result += token.raw
  }
  return result
}
