import { delEmStrongFac, pushPending } from '../utils/'
import { isLengthEven } from '../../utils'
import { tokenizerFac } from '../inlineTokenizer'
const meta = {
  id: 'del',
  type: 'inline',
  nest: true,
  sort: 25,
  rule: /^(~{2})(?=\S)([\s\S]*?\S)(\\*)\1/
}
function parse (params) {
  let cap = meta.rule.exec(params.src)
  let endPos = params.pos
  let ok = false
  if (cap && isLengthEven(cap[3])) {
    ok = true
    pushPending(params)
    params.src = params.src.substring(cap[0].length)
    endPos = params.pos + cap[0].length
    params.tokens.push({
      children: tokenizerFac(cap[2], undefined, params.notBeginInlines, params.pos + cap[1].length, false),
      type: meta.id,
      raw: cap[0],
      parent: params.tokens,
      marker: cap[1],
      backlash: cap[3] || '',
      range: {
        start: params.pos,
        end: endPos
      }
    })
    params.pos = endPos
  }
  return { ok, params }
}
function render (h, cursor, block, token, outerClass) {
  return delEmStrongFac('del', h, cursor, block, token, outerClass)
}
export default { meta, parse, render }
