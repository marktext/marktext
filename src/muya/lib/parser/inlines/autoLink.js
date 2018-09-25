import { CLASS_OR_ID } from '../../config'

import { highlight, pushPending } from '../utils/'
const meta = {
  id: 'autoLink',
  type: 'inline',
  sort: 30,
  rule: /^(https?:\/\/[^\s]+)(?=\s|$)/

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
      href: cap[0],
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
// render auto_link to vdom
function render (h, cursor, block, token, outerClass) {
  const { start, end } = token.range
  const content = highlight(h, block, start, end, token)

  return [
    h(`a.${CLASS_OR_ID['AG_INLINE_RULE']}`, {
      props: {
        href: token.href,
        target: '_blank'
      }
    }, content)
  ]
}
export default { meta, parse, render }
