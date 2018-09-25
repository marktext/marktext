import { inlines } from './index'
import { pushPending } from '../utils'
import { isLengthEven } from '../../utils'
const meta = {
  id: 'inlineMath',
  type: 'inline',
  sort: 35,
  rule: /^(\$)([^\$]*?[^\$\\])(\\*)\1(?!\1)/ //eslint-disable-line
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
      type: meta.id,
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
  return { ok, params }
}
function render (h, cursor, block, token, outerClass) {
  return inlines.get('displayMath').render(h, cursor, block, token, outerClass)
}
export default { meta, parse, render }
