import { checkIsHTML, chopHTML, LINE_BREAKS_REG } from '../utils'
const meta = {
  id: 'text',
  type: 'block',
  sort: 300,
  rule: /^[^\n]+/
}

function parse (params) {
  let cap = meta.rule.exec(params.src)
  let ok = false
  if (cap) {
    ok = true
    params.src = params.src.substring(cap[0].length)
    params.tokens.push({
      type: meta.id,
      text: cap[0]
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
    const value = cap[0]
    let block
    if (/\S/.test(value)) {
      if (checkIsHTML(value) && /^(#document-fragment|pre|p)$/.test(params.parent.type)) {
        const fragments = chopHTML(value)
        fragments.forEach(fragment => {
          if (checkIsHTML(fragment)) {
            // is html block
            block = params.stateRender.createHtmlBlock(fragment)
            params.stateRender.appendChild(params.parent, block)
          } else {
            // not html block
            block = params.stateRender.createBlockP(fragment)
            params.stateRender.appendChild(params.parent, block)
          }
        })
      } else if (params.parent.type === 'li') {
        block = params.stateRender.createBlock('p')
        // fix: #153
        const lines = value.replace(/^\s+/, '').split(LINE_BREAKS_REG).map(line => params.stateRender.createBlock('span', line))
        for (const line of lines) {
          params.stateRender.appendChild(block, line)
        }
        params.stateRender.appendChild(params.parent, block)
      } else if (params.parent.type === 'p') {
        const lines = value.split(LINE_BREAKS_REG).map(line => params.stateRender.createBlock('span', line))
        for (const line of lines) {
          params.stateRender.appendChild(params.parent, line)
        }
      }
    }
  }
  return { ok, params }
}
export default { meta, parse, process }
