import { replace, checkIsHTML } from '../utils'
import { blockProcesserFac } from '../blockProcesser'
const rules = {
  paragraph: /^((?:[^\n]+\n?(?!hr|heading|lheading|blockquote|tag|def))+)\n*/,
  hr: /^( *[-*_]){3,} *(?:\n+|$)/,
  heading: /^ *(#{1,6}) *([^\n]+?) *#* *(?:\n+|$)/,
  lheading: /^([^\n]+)\n *(=|-){2,} *(?:\n+|$)/,
  def: /^ {0,3}\[([^\]]+)\]: *<?([^\s>]+)>?(?: +["(]([^\n]+)[")])? *(?:\n+|$)/,
  blockquote: /^( *>[^\n]+(\n(?!def)[^\n]+)*\n*)+/,
  tag: '(?!(?:' +
    'a|em|strong|small|s|cite|q|dfn|abbr|data|time|code' +
    '|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo' +
    '|span|br|wbr|ins|del|img)\\b)\\w+(?!:/|[^\\w\\s@]*@)\\b'

}
const meta = {
  id: 'paragraph',
  type: 'block',
  sort: 200,
  rule: replace(rules.paragraph)('hr', rules.hr)('heading', rules.heading)('lheading', rules.lheading)('blockquote', replace(rules.blockquote)('def', rules.def)())('tag', '<' + rules.tag)('def', rules.def)()
}

function parse (params) {
  let cap = meta.rule.exec(params.src)
  let ok = false
  if (cap && params.top) {
    ok = true
    params.src = params.src.substring(cap[0].length)
    params.tokens.push({
      type: meta.id,
      text: cap[1].charAt(cap[1].length - 1) === '\n'
        ? cap[1].slice(0, -1)
        : cap[1]
    })
  }
  return { ok, params }
}
function process (params) {
  let cap = meta.rule.exec(params.src)
  console.log('params,src  . .', params.src, params.top)
  let ok = false
  if (cap && params.top) {
    ok = true
    params.src = params.src.substring(cap[0].length)

    const value = cap[1].charAt(cap[1].length - 1) === '\n' ? cap[1].slice(0, -1) : cap[1]
    if (checkIsHTML(value)) {
      blockProcesserFac(value, params.parent, params.stateRender, params.options, params.beginBlocks, params.notBeginBlocks, false, false)
    } else {
      const pBlock = params.stateRender.createBlock('p')
      blockProcesserFac(value, pBlock, params.stateRender, params.options, params.beginBlocks, params.notBeginBlocks, false, false)
      params.stateRender.appendChild(params.parent, pBlock)
    }
  }
  return { ok, params }
}

export default { meta, parse, process }
