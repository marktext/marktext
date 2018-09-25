import { LINE_BREAKS_REG } from '../utils'
import { CLASS_OR_ID } from '../../config'
const meta = {
  id: 'frontMatter',
  begin: true,
  type: 'block',
  sort: 10,
  rule: /^---\n([\s\S]+?)---(?:\n+|$)/
}

function parse (params) {
  let cap = meta.rule.exec(params.src)
  let ok = false
  if (!params.bq && params.top && cap) {
    ok = true
    params.src = params.src.substring(cap[0].length)
    params.tokens.push({
      type: 'frontmatter',
      text: cap[1]
    })
  }
  return { ok, params }
}
function process (params) {
  let cap = meta.rule.exec(params.src)
  let ok = false
  if (!params.bq && params.top && cap) {
    ok = true
    params.src = params.src.substring(cap[0].length)
    let block = params.stateRender.createBlock('pre', '', {
      selector: `.${CLASS_OR_ID['AG_FRONT_MATTER']}`,
      dataset: {
        role: 'YAML'
      }
    })

    block.functionType = 'frontmatter'
    const lines = cap[1].replace(/^\s+/, '').split(LINE_BREAKS_REG).map(line => params.stateRender.createBlock('span', line, {
      selector: `.${CLASS_OR_ID['AG_FRONT_MATTER_LINE']}`
    }))

    for (const line of lines) {
      line.functionType = 'frontmatter'
      params.stateRender.appendChild(block, line)
    }
    params.stateRender.appendChild(params.parent, block)
  }
  return { ok, params }
}
export default { meta, parse, process }
