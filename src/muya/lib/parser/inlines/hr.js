import { CLASS_OR_ID } from '../../config'
import { highlight, pushPending } from '../utils'
const meta = {
  id: 'hr',
  type: 'inline',
  begin: true,
  sort: 10,
  rule: /^(\*{3,}$|^\-{3,}$|^\_{3,}$)/ //eslint-disable-line

}
function parse (params) {
  let cap = meta.rule.exec(params.src)
  let endPos = params.pos
  let ok = false
  if (cap) {
    ok = true
    pushPending(params)
    params.src = params.src.substring(cap[0].length)
    endPos = params.pos + cap[0].length
    params.tokens.push({
      type: meta.id,
      nest: meta.nest,
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
  const { start, end } = token.range
  const content = highlight(h, block, start, end, token)
  return [
    h(`span.${CLASS_OR_ID['AG_GRAY']}.${CLASS_OR_ID['AG_REMOVE']}`, content)
  ]
}
export default { meta, parse, render }
