const meta = {
  id: 'gfmFences',
  type: 'block',
  sort: 50,
  rule: /^ *(`{3,}|~{3,})[ \.]*(\S+)? *\n([\s\S]+?)\s*\1 *(?:\n+|$)/ //eslint-disable-line
}

function parse (params) {
  let cap = meta.rule.exec(params.src)
  let ok = false
  if (cap) {
    ok = true
    params.src = params.src.substring(cap[0].length)
    params.tokens.push({
      type: 'code',
      codeBlockStyle: 'fenced',
      lang: cap[2],
      text: cap[3]
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
    let text = cap[3]
    if (text.endsWith('\n')) {
      text = text.replace(/\n+$/, '')
    }
    const block = params.stateRender.createBlock('pre', text, {
      functionType: 'code',
      lang: cap[2],
      codeBlockStyle: 'fenced'
    })
    params.stateRender.appendChild(params.parent, block)
  }
  return { ok, params }
}

export default { meta, parse, process }
