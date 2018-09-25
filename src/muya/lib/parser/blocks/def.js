const meta = {
  id: 'def',
  type: 'block',
  sort: 19,
  rule: /^([^\n]+)\n *(=|-){2,} *(?:\n+|$)/
}

function parse (params) {
  let cap = meta.rule.exec(params.src)
  let ok = false
  if (!params.bq && params.top && cap) {
    let text = ''
    do {
      params.src = params.src.substring(cap[0].length)
      params.tokens.links[cap[1].toLowerCase()] = {
        href: cap[2],
        title: cap[3]
      }
      text += cap[0]
      if (cap[0].endsWith('\n\n')) break
      cap = meta.rule.exec(params.src)
    } while (cap)
    params.tokens.push({
      type: 'paragraph',
      text: text.replace(/\n*$/, '')
    })
  }
  return { ok, params }
}
function process (params) {
  let cap = meta.rule.exec(params.src)
  let ok = false
  if (!params.bq && params.top && cap) {
    let text = ''
    do {
      params.src = params.src.substring(cap[0].length)
      params.tokens.links[cap[1].toLowerCase()] = {
        href: cap[2],
        title: cap[3]
      }
      text += cap[0]
      if (cap[0].endsWith('\n\n')) break
      cap = meta.rule.exec(params.src)
    } while (cap)
    const pBlock = params.stateRender.createBlock('p', text.replace(/\n*$/, ''))
    params.stateRender.appendChild(params.parent, pBlock)
  }
  return { ok, params }
}
export default { meta, parse, process }
