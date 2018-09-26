
const meta = {
  id: 'newLine',
  type: 'block',
  sort: 3,
  rule: /^\n+/
}

function parse (params) {
  let cap = meta.rule.exec(params.src)
  let ok = false
  if (cap) {
    ok = true
    params.src = params.src.substring(cap[0].length)
    params.tokens.push({
      type: 'space'
    })
  }
  return { ok, params }
}
function process (params) {
  let cap = meta.rule.exec(params.src)
  let ok = false
  if (cap) {
    ok = true
    params.src = params.src.substring(cap[0].length)
  }
  return { ok, params }
}
export default { meta, parse, process }
