const meta = {
  id: 'hr',
  type: 'block',
  sort: 50,
  rule: /^( *[-*_]){3,} *(?:\n+|$)/
}

function parse (params) {
  let cap = meta.rule.exec(params.src)
  let ok = false
  if (cap) {
    ok = true
    params.src = params.src.substring(cap[0].length)
    params.tokens.push({
      type: meta.id
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
    const block = params.stateRender.createBlock('hr', cap[1])
    params.stateRender.appendChild(params.parent, block)
  }
  return { ok, params }
}

export default { meta, parse, process }
