import { replace } from '../utils'
const tag = '(?!(?:' +
  'a|em|strong|small|s|cite|q|dfn|abbr|data|time|code' +
  '|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo' +
  '|span|br|wbr|ins|del|img)\\b)\\w+(?!:/|[^\\w\\s@]*@)\\b'
const rule = /^ *(?:comment *(?:\n|\s*$)|closed *(?:\n{2,}|\s*$)|closing *(?:\n{2,}|\s*$))/
const meta = {
  id: 'html',
  type: 'block',
  sort: 17,
  rule: replace(rule)('comment', /<!--[\s\S]*?-->/)('closed', /<(tag)[\s\S]+?<\/\1>/)('closing', /<tag(?:"[^"]*"|'[^']*'|[^'">])*?>/)(/tag/g, tag)()
}

function parse (params) {
  let cap = meta.rule.exec(params.src)
  let ok = false
  if (cap) {
    ok = true
    params.src = params.src.substring(cap[0].length)
    params.tokens.push({
      type: params.options.sanitize ? 'paragraph' : 'html',
      pre: !params.options.sanitizer && (cap[1] === 'pre' || cap[1] === 'script' || cap[1] === 'style'),
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
    let block = params.stateRender.createBlock(params.options.sanitize ? 'paragraph' : 'html', cap[0], {
      pre: !params.options.sanitizer && (cap[1] === 'pre' || cap[1] === 'script' || cap[1] === 'style')
    })
    params.stateRender.appendChild(params.parent, block)
  }
  return { ok, params }
}
export default { meta, parse, process }
