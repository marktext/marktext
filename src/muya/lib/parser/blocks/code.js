
const meta = {
  id: 'code',
  type: 'block',
  sort: 11,
  rule: /^( {4}[^\n]+\n*)+/
}

function parse (params) {
  let cap = meta.rule.exec(params.src)

  let ok = false
  if (cap) {
    ok = true
    params.src = params.src.substring(cap[0].length)
    let text = cap[0].replace(/^ {4}/gm, '')
    params.tokens.push({
      type: meta.id,
      codeBlockStyle: 'indented',
      text: !params.options.pedantic ? text.replace(/\n+$/, '') : text
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
    let text = cap[0].replace(/^ {4}/gm, '')
    text = params.options.pedantic ? cap.replace(/\n+$/, '') : text
    if (text.endsWith('\n')) {
      text = text.replace(/\n+$/, '')
    }
    const block = params.stateRender.createBlock('pre', text, {
      functionType: meta.id,
      lang: '', //
      codeBlockStyle: 'indent'
    })
    params.stateRender.appendChild(params.parent, block)
  }
  return { ok, params }
}
export default { meta, parse, process }
