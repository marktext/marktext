
import blockTokenizer from '../blockTokenizer'
import { replace } from '../utils'
import { blockProcesserFac } from '../blockProcesser'
const rules = {
  def: /^ {0,3}\[([^\]]+)\]: *<?([^\s>]+)>?(?: +["(]([^\n]+)[")])? *(?:\n+|$)/,
  blockquote: /^( *>[^\n]+(\n(?!def)[^\n]+)*\n*)+/

}
const meta = {
  id: 'blockQuote',
  type: 'block',
  sort: 15,
  rule: replace(rules.blockquote)('def', rules.def)()
}

function parse (params) {
  let cap = meta.rule.exec(params.src)

  let ok = false
  if (cap) {
    ok = true
    params.src = params.src.substring(cap[0].length)
    params.tokens.push({
      type: 'blockquote_start'
    })
    cap = cap[0].replace(/^ *> ?/gm, '')
    // Pass `params.top` to keep the current
    // "params.toplevel" state. This is exactly
    // how markdown.pl works.
    params.tokens.push(...blockTokenizer(cap, params.options, params.beginBlocks, params.notBeginBlocks, params.top, true))
    params.tokens.push({
      type: 'blockquote_end'
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

    let bqBlock = params.stateRender.createBlock('blockquote', '')
    blockProcesserFac(cap[0] && cap[0].replace(/^ *> ?/gm, ''), bqBlock, params.stateRender, params.options, params.beginBlocks, params.notBeginBlocks, false, true)
    params.stateRender.appendChild(params.parent, bqBlock)
  }
  return { ok, params }
}
export default { meta, parse, process }
