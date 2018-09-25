import { CLASS_OR_ID } from '../../config'
import { isLengthEven } from '../../utils'
import { highlight, getClassName, pushPending } from '../utils/'
const meta = {
  id: 'inlineCode',
  type: 'inline',

  sort: 22,
  rule: /^(`{1,3})([^`]+?|.{2,})\1/

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
  const className = getClassName(outerClass, block, token, cursor)
  const { marker } = token
  const { start, end } = token.range

  const startMarker = highlight(h, block, start, start + marker.length, token)
  const endMarker = highlight(h, block, end - marker.length, end, token)
  const content = highlight(h, block, start + marker.length, end - marker.length, token)

  return [
    h(`span.${className}.${CLASS_OR_ID['AG_REMOVE']}`, startMarker),
    h(`code.${CLASS_OR_ID['AG_INLINE_RULE']}`, content),
    h(`span.${className}.${CLASS_OR_ID['AG_REMOVE']}`, endMarker)
  ]
}
export default { meta, parse, render }
