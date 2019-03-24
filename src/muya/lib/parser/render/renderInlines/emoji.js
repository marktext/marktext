import { CLASS_OR_ID } from '../../../config'
import { validEmoji } from '../../../ui/emojis'

// render token of emoji to vdom
export default function emoji (h, cursor, block, token, outerClass) {
  const { start: rStart, end: rEnd } = token.range
  const className = this.getClassName(outerClass, block, token, cursor)
  const validation = validEmoji(token.content)
  const finalClass = validation ? className : CLASS_OR_ID['AG_WARN']
  const CONTENT_CLASSNAME = `span.${finalClass}.${CLASS_OR_ID['AG_INLINE_RULE']}.${CLASS_OR_ID['AG_EMOJI_MARKED_TEXT']}`
  let startMarkerCN = `span.${finalClass}.${CLASS_OR_ID['AG_EMOJI_MARKER']}`
  let endMarkerCN = startMarkerCN
  let content = token.content
  let pos = rStart + token.marker.length

  if (token.highlights && token.highlights.length) {
    content = []
    for (const light of token.highlights) {
      let { start, end, active } = light
      const HIGHLIGHT_CLASSNAME = this.getHighlightClassName(active)
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
