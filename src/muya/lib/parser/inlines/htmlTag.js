import { CLASS_OR_ID } from '../../config'
import { highlight, pushPending } from '../utils/'
const meta = {
  id: 'htmlTag',
  type: 'inline',
  sort: 200,
  rule: /^(<!--[\s\S]*?-->|<\/?[a-zA-Z\d-]+[\s\S]*?(?!\\)>)/

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
      raw: cap[0],
      tag: cap[1],
      type: meta.id,
      parent: params.tokens,
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
  const className = CLASS_OR_ID['AG_HTML_TAG']
  const { start, end } = token.range
  const tag = highlight(h, block, start, end, token)
  const isBr = /<br(?=\s|\/|>)/.test(token.tag)
  return [
    h(`span.${className}`, isBr ? [...tag, h('br')] : tag)
  ]
}
export default { meta, parse, render }
