import { CLASS_OR_ID } from '../../config'
import { highlight, getClassName, pushPending } from '../utils/'
const meta = {
  id: 'backlash',
  type: 'inline',
  validate: false,
  sort: 20,
  rule: /^(\\)([\\`*{}\[\]()#+\-.!_>~:\|\<\>]{1})/ //eslint-disable-line

}
function parse (params) {
  let cap = meta.rule.exec(params.src)
  let ok = false
  if (cap) {
    ok = true
    pushPending(params)
    params.src = params.src.substring(cap[0].length)
    params.tokens.push({
      type: meta.id,
      raw: cap[1],
      marker: cap[1],
      parent: params.tokens,
      content: '',
      range: {
        start: params.pospos,
        end: params.pos + cap[1].length
      }
    })
    params.pending += params.pending + cap[2]
    params.pendingStartPos = params.pos + cap[1].length
    params.pos = params.pos + cap[0].length
  }
  return { ok, params }
}
function render (h, cursor, block, token, outerClass) {
  const className = getClassName(outerClass, block, token, cursor)
  const { start, end } = token.range
  const content = highlight(h, block, start, end, token)

  return [
    h(`span.${className}.${CLASS_OR_ID['AG_REMOVE']}`, content)
  ]
}
export default { meta, parse, render }
