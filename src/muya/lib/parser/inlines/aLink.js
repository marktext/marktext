import { CLASS_OR_ID } from '../../config'
import { snakeToCamel } from '../../utils'
import { inlines } from './index'
import { highlight, getClassName, pushPending } from '../utils/'
import { tokenizerFac } from '../inlineTokenizer'

const meta = {
  id: 'aLink',
  type: 'inline',
  sort: 45,
  nest: true,
  rule: /^(<a[\s\S]*href\s*=\s*("|')(.+?)\2(?=\s|>)[\s\S]*(?!\\)>)([\s\S]*)(<\/a>)/
}
function parse (params) {
  let cap = meta.rule.exec(params.src)
  let endPos = params.pos
  let ok = false
  if (cap) {
    ok = true
    pushPending(params)
    params.src = params.src.substring(cap[0].length)
    endPos = params.pos + cap[0].length
    params.tokens.push({
      raw: cap[0],
      href: cap[3],
      openTag: cap[1],
      closeTag: cap[5],
      anchor: cap[4],
      children: tokenizerFac(cap[4], undefined, params.notBeginInlines, params.pos + cap[1].length, false),
      backlash: {
        first: cap[3],
        second: cap[5]
      },
      type: meta.id,
      parent: params.tokens,
      range: {
        start: params.pos,
        end: endPos
      }
    })
    params.pos = endPos
  }
  return { ok, params }
}
// `a_link`: `<a href="url">anchor</a>`
function render (h, cursor, block, token, outerClass, stateRender) {
  const className = getClassName(outerClass, block, token, cursor)
  const tagClassName = className === CLASS_OR_ID['AG_HIDE'] ? className : CLASS_OR_ID['AG_HTML_TAG']
  const { start, end } = token.range
  const openTag = highlight(h, block, start, start + token.openTag.length, token)
  const anchor = token.children.reduce((acc, to) => {
    const chunk = inlines.get(snakeToCamel(to.type)).render(h, cursor, block, to, className, stateRender)
    return Array.isArray(chunk) ? [...acc, ...chunk] : [...acc, chunk]
  }, [])
  const closeTag = highlight(h, block, end - token.closeTag.length, end, token)

  return [
    h(`span.${tagClassName}.${CLASS_OR_ID['AG_OUTPUT_REMOVE']}`, openTag),
    h(`a.${CLASS_OR_ID['AG_A_LINK']}`, {
      dataset: {
        href: token.href
      }
    }, anchor),
    h(`span.${tagClassName}.${CLASS_OR_ID['AG_OUTPUT_REMOVE']}`, closeTag)
  ]
}
export default { meta, parse, render }
