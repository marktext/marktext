import { CLASS_OR_ID } from '../../config'
import { highlight, pushPending } from '../utils/'
import { inlines } from './index'
const meta = {
  id: 'referenceDefinition',
  type: 'inline',
  sort: 10,
  begin: true,
  rule: /^( {0,3}\[)([^\]]+?)(\\*)(\]: *)(<?)([^\s>]+)(>?)(?:( +)(["'(]?)([^\n"'\(\)]+)\9)?( *)$/ //eslint-disable-line

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
      type: meta.id,
      parent: params.tokens,
      leftBracket: cap[1],
      label: cap[2],
      backlash: cap[3] || '',
      rightBracket: cap[4],
      leftHrefMarker: cap[5] || '',
      href: cap[6],
      rightHrefMarker: cap[7] || '',
      leftTitlespace: cap[8],
      titleMarker: cap[9] || '',
      title: cap[10] || '',
      rightTitleSpace: cap[11] || '',
      raw: cap[0],
      range: {
        start: params.pos,
        end: endPos
      }
    })
    params.pos = endPos
  }
  return { ok, params }
}
function render (h, cursor, block, token, outerClass) {
  const className = CLASS_OR_ID['AG_REFERENCE_MARKER']
  const {
    leftBracket,
    label,
    backlash,
    // rightBracket,
    // leftHrefMarker,
    // href,
    // rightHrefMarker,
    titleMarker,
    title,
    rightTitleSpace
  } = token
  const { start, end } = token.range
  const leftBracketContent = highlight(h, block, start, start + leftBracket.length, token)
  const labelContent = highlight(h, block, start + leftBracket.length, start + leftBracket.length + label.length, token)
  const middleContent = highlight(
    h,
    block,
    start + leftBracket.length + label.length + backlash.length,
    end - rightTitleSpace.length - titleMarker.length - title.length,
    token
  )
  const titleContent = highlight(
    h,
    block,
    end - rightTitleSpace.length - titleMarker.length - title.length,
    end - titleMarker.length - rightTitleSpace.length,
    token
  )
  const rightContent = highlight(
    h,
    block,
    end - titleMarker.length - rightTitleSpace.length,
    end,
    token
  )
  const backlashStart = start + leftBracket.length + label.length

  return [
    h(`span.${className}`, leftBracketContent),
    h(`span.${CLASS_OR_ID['AG_REFERENCE_LABEL']}`, labelContent),
    ...inlines.get('backlashInToken').render(h, backlash, CLASS_OR_ID['AG_GRAY'], backlashStart, token),
    h(`span.${className}`, middleContent),
    h(`span.${CLASS_OR_ID['AG_REFERENCE_TITLE']}`, titleContent),
    h(`span.${className}`, rightContent)
  ]
}
export default { meta, parse, render }
