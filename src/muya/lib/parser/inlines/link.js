import { CLASS_OR_ID } from '../../config'
import { isLengthEven, snakeToCamel } from '../../utils'
import { highlight, getClassName, pushPending } from '../utils/'
import { inlines } from './index'
import { tokenizerFac } from '../inlineTokenizer'
// 'link': /^(\[)((?:\[[^\]]*\]|[^\[\]]|\](?=[^\[]*\]))*?)(\\*)\]\((.*?)(\\*)\)/, // can nest
const meta = {
  id: 'link',
  type: 'inline',
  sort: 22,
  nest: true,
  rule: /^(\[)((?:\[[^\]]*\]|[^\[\]]|\](?=[^\[]*\]))*?)(\\*)\]\((.*?)(\\*)\)/ //eslint-disable-line

}
function parse (params) {
  let cap = meta.rule.exec(params.src)
  let endPos = params.pos
  let ok = false
  if (cap && isLengthEven(cap[3]) && isLengthEven(cap[5])) {
    ok = true
    pushPending(params)
    params.src = params.src.substring(cap[0].length)
    endPos = params.pos + cap[0].length
    params.tokens.push({

      href: cap[4],
      anchor: cap[2],
      children: tokenizerFac(cap[2], undefined, params.notBeginInlines, params.pos + cap[1].length, false),
      backlash: {
        first: cap[3],
        second: cap[5]
      },
      type: meta.id,
      raw: cap[0],
      parent: params.tokens,
      marker: cap[1],
      range: {
        start: params.pos,
        end: endPos
      }
    })
    params.pos = endPos
  }
  return { ok, params }
}
function render (h, cursor, block, token, outerClass, stateRender) {
  const className = getClassName(outerClass, block, token, cursor)
  const linkClassName = className === CLASS_OR_ID['AG_HIDE'] ? className : CLASS_OR_ID['AG_LINK_IN_BRACKET']
  const { start, end } = token.range
  const firstMiddleBracket = highlight(h, block, start, start + 3, token)

  const firstBracket = highlight(h, block, start, start + 1, token)
  const middleBracket = highlight(
    h, block,
    start + 1 + token.anchor.length + token.backlash.first.length,
    start + 1 + token.anchor.length + token.backlash.first.length + 2,
    token
  )
  const hrefContent = highlight(
    h, block,
    start + 1 + token.anchor.length + token.backlash.first.length + 2,
    start + 1 + token.anchor.length + token.backlash.first.length + 2 + token.href.length,
    token
  )
  const middleHref = highlight(
    h, block, start + 1 + token.anchor.length + token.backlash.first.length,
    block, start + 1 + token.anchor.length + token.backlash.first.length + 2 + token.href.length,
    token
  )

  const lastBracket = highlight(h, block, end - 1, end, token)

  const firstBacklashStart = start + 1 + token.anchor.length
  const secondBacklashStart = end - 1 - token.backlash.second.length

  if (isLengthEven(token.backlash.first) && isLengthEven(token.backlash.second)) {
    if (!token.children.length && !token.backlash.first) { // no-text-link
      return [
        h(`span.${CLASS_OR_ID['AG_GRAY']}.${CLASS_OR_ID['AG_REMOVE']}`, firstMiddleBracket),
        h(`a.${CLASS_OR_ID['AG_NOTEXT_LINK']}.${CLASS_OR_ID['AG_INLINE_RULE']}`, {
          props: {
            href: token.href + encodeURI(token.backlash.second),
            target: '_blank'
          }
        }, [
          ...hrefContent,
          ...inlines.get('backlashInToken').render(h, token.backlash.second, className, secondBacklashStart, token, stateRender)
        ]),
        h(`span.${CLASS_OR_ID['AG_GRAY']}.${CLASS_OR_ID['AG_REMOVE']}`, lastBracket)
      ]
    } else { // has children
      return [
        h(`span.${className}.${CLASS_OR_ID['AG_REMOVE']}`, firstBracket),
        h(`a.${CLASS_OR_ID['AG_INLINE_RULE']}`, {
          props: {
            href: token.href + encodeURI(token.backlash.second),
            target: '_blank'
          }
        }, [
          ...token.children.reduce((acc, to) => {
            const chunk = inlines.get(snakeToCamel(to.type)).render(h, cursor, block, to, className, stateRender)
            return Array.isArray(chunk) ? [...acc, ...chunk] : [...acc, chunk]
          }, []),
          ...inlines.get('backlashInToken').render(h, token.backlash.first, className, firstBacklashStart, token, stateRender)
        ]),
        h(`span.${className}.${CLASS_OR_ID['AG_REMOVE']}`, middleBracket),
        h(`span.${linkClassName}.${CLASS_OR_ID['AG_REMOVE']}`, [
          ...hrefContent,
          ...inlines.get('backlashInToken').render(h, token.backlash.second, className, secondBacklashStart, token, stateRender)
        ]),
        h(`span.${className}.${CLASS_OR_ID['AG_REMOVE']}`, lastBracket)
      ]
    }
  } else {
    return [
      ...firstBracket,
      ...token.children.reduce((acc, to) => {
        const chunk = inlines.get(snakeToCamel(to.type)).render(h, cursor, block, to, className, stateRender)
        return Array.isArray(chunk) ? [...acc, ...chunk] : [...acc, chunk]
      }, []),
      ...inlines.get('backlashInToken').render(h, token.backlash.first, className, firstBacklashStart, token, stateRender),
      ...middleHref,
      ...inlines.get('backlashInToken').render(h, token.backlash.second, className, secondBacklashStart, token, stateRender),
      ...lastBracket
    ]
  }
}
export default { meta, parse, render }
