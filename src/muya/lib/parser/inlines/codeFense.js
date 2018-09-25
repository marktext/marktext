import { CLASS_OR_ID } from '../../config'
import { highlight, pushPending } from '../utils/'
const meta = {
  id: 'codeFense',
  type: 'inline',
  sort: 10,
  begin: true,
  rule: /^(`{3,})([^`]*)$/

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
  const { marker } = token

  const markerContent = highlight(h, block, start, start + marker.length, token)
  const content = highlight(h, block, start + marker.length, end, token)

  return [
    h(`span.${CLASS_OR_ID['AG_GRAY']}`, markerContent),
    h(`span.${CLASS_OR_ID['AG_LANGUAGE']}`, content)
  ]
}
export default { meta, parse, render }
