import { highlight, getClassName, pushPending } from '../utils/'
const meta = {
  id: 'tailHeader',
  type: 'inline',
  sort: 40,
  validate: false,
  rule: /^(\s{1,}#{1,})(\s*)$/
}
function parse (params) {
  let cap = meta.rule.exec(params.src)
  let endPos = params.pos
  let ok = false
  if (cap && params.top) {
    ok = true
    pushPending(params)
    params.src = params.src.substring(cap[1].length)
    endPos = params.pos + cap[1].length
    params.tokens.push({
      raw: cap[1],
      marker: cap[1],
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
  const className = getClassName(outerClass, block, token, cursor)
  const { start, end } = token.range
  const content = highlight(h, block, start, end, token)
  if (/^h\d$/.test(block.type)) {
    return [
      h(`span.${className}`, content)
    ]
  } else {
    return content
  }
}
export default { meta, parse, render }
