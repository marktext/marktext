import { isInElectron } from '../../config'
const meta = {
  id: 'heading',
  type: 'block',
  sort: 50,
  rule: /^ *(#{1,6}) *([^\n]+?) *#* *(?:\n+|$)/
}

function parse (params) {
  let cap = meta.rule.exec(params.src)
  let ok = false
  if (cap) {
    ok = true
    params.src = params.src.substring(cap[0].length)
    params.tokens.push({
      type: meta.id,
      headingStyle: 'atx',
      depth: cap[1].length,
      text: cap[2]
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
    let type = 'h' + cap[1].length
    let block = params.stateRender.createBlock(type, cap[0], {
      class: 'atx',
      selector: '.atx',
      dataset: {
        head: type,
        id: isInElectron ? require('markdown-toc').slugify(cap[0].replace(/^#+\s(.*)/, (_, p1) => p1)) : '',
        role: type
      }
    })
    params.stateRender.appendChild(params.parent, block)
  }
  return { ok, params }
}
export default { meta, parse, process }
