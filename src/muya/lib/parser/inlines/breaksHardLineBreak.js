import { CLASS_OR_ID } from '../../config'
import { pushPending } from '../utils/'
const meta = {
  id: 'breaksHardLineBreak',
  type: 'inline',
  sort: 200,
  rule: /^(\s*)$/

}
function parse (params) {
  let cap = meta.rule.exec(params.src)
  let endPos = params.pos
  let ok = false
  if (cap && params.top) {
    ok = true
    pushPending(params)
    params.src = params.src.substring(cap[0].length)
    endPos = params.pos + cap[0].length
    params.tokens.push({
      raw: cap[0],
      spaces: cap[1],
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
  const className = CLASS_OR_ID['AG_HARD_LINE_BREAK']
  const content = [token.spaces]
  if (block.type === 'span' && block.nextSibling) {
    return [
      h(`span.${className}`, content)
    ]
  } else {
    return content
  }
}
export default { meta, parse, render }
