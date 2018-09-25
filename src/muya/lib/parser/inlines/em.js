import { delEmStrongFac, pushPending, validateEmphasize } from '../utils'
import { isLengthEven } from '../../utils'
import { tokenizerFac } from '../inlineTokenizer'
const meta = {
  id: 'em',
  type: 'inline',

  sort: 21,

  validate: false,
  nest: true,
  rule: /^(\*|_)(?=\S)([\s\S]*?[^\s\*\\])(\\*)\1(?!\1)/ //eslint-disable-line

}

function parse (params) {
  let cap = meta.rule.exec(params.src)
  let endPos = params.pos
  let ok = false
  if (cap && isLengthEven(cap[3])) {
    const isValid = validateEmphasize(params.src, cap[0].length, cap[1], params.pending)
    if (isValid) {
      ok = true
      pushPending(params)
      params.src = params.src.substring(cap[0].length)
      endPos = params.pos + cap[0].length
      params.tokens.push({
        type: meta.id,
        children: tokenizerFac(cap[2], undefined, params.notBeginInlines, params.pos + cap[1].length, false),
        raw: cap[0],
        parent: params.tokens,
        marker: cap[1],
        content: cap[2] || '',
        backlash: cap[3] || '',
        range: {
          start: params.pos,
          end: endPos
        }
      })
      params.pos = endPos
    }
  }
  return { ok, params }
}
function render (h, cursor, block, token, outerClass) {
  return delEmStrongFac('em', h, cursor, block, token, outerClass)
}

export default { meta, parse, render }
