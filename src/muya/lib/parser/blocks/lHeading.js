const meta = {
  id: 'lHeading',
  type: 'block',
  sort: 60,
  rule: /^([^\n]+)\n *(=|-){2,} *(?:\n+|$)/
}

function parse (params) {
  let cap = meta.rule.exec(params.src)
  let ok = false
  if (cap) {
    ok = true
    params.src = params.src.substring(cap[0].length)
    params.tokens.push({
      type: meta.id,
      headingStyle: 'setext',
      depth: cap[2] === '=' ? 1 : 2,
      text: cap[1]
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
    let type = 'h' + (cap[2] === '=' ? 1 : 2)
    let block = params.stateRender.createBlock(type, cap[1], {
      class: 'setext'
    })
    params.stateRender.appendChild(params.parent, block)
  }
  return { ok, params }
}
export default { meta, parse, process }
