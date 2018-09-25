import { CLASS_OR_ID } from '../../config'
import { isLengthEven, snakeToCamel } from '../../utils'
import { highlight, getClassName, pushPending } from '../utils/'
import { inlines } from './index'
import { tokenizerFac } from '../inlineTokenizer'
const meta = {
  id: 'referenceLink',
  type: 'inline',
  sort: 30,
  rule: /^\[([^\]]+?)(\\*)\](?:\[([^\]]*?)(\\*)\])?/

}
function parse (params) {
  let cap = meta.rule.exec(params.src)
  let endPos = params.pos
  let ok = false

  if (cap && isLengthEven(cap[2]) && isLengthEven(cap[4])) {
    console.log('parse .2.', params, cap)
    ok = true
    pushPending(params)
    params.src = params.src.substring(cap[0].length)
    endPos = params.pos + cap[0].length
    params.tokens.push({
      isFullLink: !!cap[3],
      label: cap[3] || cap[1],
      anchor: cap[1],
      children: tokenizerFac(cap[1], undefined, params.notBeginInlines, params.pos + 1, false),
      backlash: {
        first: cap[2],
        second: cap[4]
      },
      type: meta.id,
      raw: cap[0],
      parent: params.tokens,
      range: {
        start: params.pos,
        end: endPos
      }
    })
    params.pos = endPos
    console.log('params..', params, null, 2)
  }

  return { ok, params }
}
function render (h, cursor, block, token, outerClass, stateRender) {
  const className = getClassName(outerClass, block, token, cursor)
  const labelClass = className === CLASS_OR_ID['AG_GRAY']
    ? CLASS_OR_ID['AG_REFERENCE_LABEL']
    : className
  const { start, end } = token.range
  const {
    anchor,
    children,
    backlash,
    isFullLink,
    label
  } = token
  const MARKER = '['
  let href = ''
  let title = ''
  const key = (label + backlash.second).toLowerCase()
  let { labels } = stateRender
  if (labels.has(key)) {
    ({ href, title } = labels.get(key))
  }
  const backlashStart = start + MARKER.length + anchor.length
  const startMarker = highlight(
    h,
    block,
    start,
    start + MARKER.length,
    token
  )

  const content = [
    ...children.reduce((acc, to) => {
      const chunk = inlines.get(snakeToCamel(to.type)).render(h, cursor, block, to, className, stateRender)
      return Array.isArray(chunk) ? [...acc, ...chunk] : [...acc, chunk]
    }, []),
    ...inlines.get('backlashInToken').render(h, backlash.first, className, backlashStart, token)
  ]
  const endMarker = highlight(
    h,
    block,
    start + MARKER.length + anchor.length + backlash.first.length,
    end,
    token
  )
  const anchorSelector = href ? `a.${CLASS_OR_ID['AG_INLINE_RULE']}` : `span.${CLASS_OR_ID['AG_REFERENCE_LINK']}`
  const dataSet = {
    props: {
      title
    }
  }
  if (href) {
    Object.assign(dataSet.props, { href })
  }

  if (isFullLink) {
    const labelContent = highlight(
      h,
      block,
      start + 3 * MARKER.length + anchor.length + backlash.first.length,
      end - MARKER.length - backlash.second.length,
      token
    )
    const middleMarker = highlight(
      h,
      block,
      start + MARKER.length + anchor.length + backlash.first.length,
      start + 3 * MARKER.length + anchor.length + backlash.first.length,
      token
    )
    const lastMarker = highlight(
      h,
      block,
      end - MARKER.length,
      end,
      token
    )
    const secondBacklashStart = end - MARKER.length - backlash.second.length

    return [
      h(`span.${className}`, startMarker),
      h(anchorSelector, dataSet, content),
      h(`span.${className}`, middleMarker),
      h(`span.${labelClass}`, labelContent),
      ...inlines.get('backlashInToken').render(h, backlash.second, className, secondBacklashStart, token),
      h(`span.${className}`, lastMarker)
    ]
  } else {
    return [
      h(`span.${className}`, startMarker),
      h(anchorSelector, dataSet, content),
      h(`span.${className}`, endMarker)
    ]
  }
}
export default { meta, parse, render }
