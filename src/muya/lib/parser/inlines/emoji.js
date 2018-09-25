import { CLASS_OR_ID } from '../../config'
import { validEmoji } from '../../emojis'
import { isLengthEven } from '../../utils'
import { getClassName, getHighlightClassName, pushPending, lowerPriority } from '../utils/'
// render token of emoji to vdom
const meta = {
  id: 'emoji',
  type: 'inline',
  sort: 23,
  rule: /^(:)([a-z_]+?)\1/

}
function parse (params) {
  let cap = meta.rule.exec(params.src)
  let endPos = params.pos
  let ok = false
  if (cap && isLengthEven(cap[3]) && lowerPriority(params.src, cap[0].length)) {
    ok = true
    pushPending(params)
    params.src = params.src.substring(cap[0].length)
    endPos = params.pos + cap[0].length
    params.tokens.push({
      type: meta.id,
      raw: cap[0],
      parent: params.tokens,
      marker: cap[1],
      content: cap[2] || '',
      backlash: cap[3] || '',
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
  const { start: rStart, end: rEnd } = token.range
  const className = getClassName(outerClass, block, token, cursor)
  const validation = validEmoji(token.content)
  const finalClass = validation ? className : CLASS_OR_ID['AG_WARN']
  const CONTENT_CLASSNAME = `span.${finalClass}.${CLASS_OR_ID['AG_EMOJI_MARKED_TEXT']}`
  let startMarkerCN = `span.${finalClass}.${CLASS_OR_ID['AG_EMOJI_MARKER']}`
  let endMarkerCN = startMarkerCN
  let content = token.content
  let pos = rStart + token.marker.length

  if (token.highlights && token.highlights.length) {
    content = []
    for (const light of token.highlights) {
      let { start, end, active } = light
      const HIGHLIGHT_CLASSNAME = getHighlightClassName(active)
      if (start === rStart) {
        startMarkerCN += `.${HIGHLIGHT_CLASSNAME}`
        start++
      }
      if (end === rEnd) {
        endMarkerCN += `.${HIGHLIGHT_CLASSNAME}`
        end--
      }
      if (pos < start) {
        content.push(block.text.substring(pos, start))
      }
      if (start < end) {
        content.push(h(`span.${HIGHLIGHT_CLASSNAME}`, block.text.substring(start, end)))
      }
      pos = end
    }
    if (pos < rEnd - token.marker.length) {
      content.push(block.text.substring(pos, rEnd - 1))
    }
  }

  const emojiVdom = validation
    ? h(CONTENT_CLASSNAME, {
      dataset: {
        emoji: validation.emoji
      }
    }, content)
    : h(CONTENT_CLASSNAME, content)

  return [
    h(startMarkerCN, token.marker),
    emojiVdom,
    h(endMarkerCN, token.marker)
  ]
}
export default { meta, parse, render }
