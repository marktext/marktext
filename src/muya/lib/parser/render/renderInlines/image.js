import { CLASS_OR_ID, IMAGE_EXT_REG, isInElectron } from '../../../config'
import { getImageInfo } from '../../../utils'

// I dont want operate dom directly, is there any better method? need help!
export default function image (h, cursor, block, token, outerClass) {
  const { eventCenter } = this
  const { start: cursorStart, end: cursorEnd } = cursor
  const { start, end } = token.range

  if (
    cursorStart.key === cursorEnd.key &&
    cursorStart.offset === cursorEnd.offset &&
    cursorStart.offset === end - 1 &&
    !IMAGE_EXT_REG.test(token.src) &&
    isInElectron
  ) {
    eventCenter.dispatch('image-path', token.src)
  }

  const className = this.getClassName(outerClass, block, token, cursor)
  const imageClass = CLASS_OR_ID['AG_IMAGE_MARKED_TEXT']
  const titleContent = this.highlight(h, block, start, start + 2 + token.alt.length, token)
  const srcContent = this.highlight(
    h, block,
    start + 2 + token.alt.length + token.backlash.first.length + 2,
    start + 2 + token.alt.length + token.backlash.first.length + 2 + token.srcAndTitle.length,
    token
  )

  const secondBracketContent = this.highlight(
    h, block,
    start + 2 + token.alt.length + token.backlash.first.length,
    start + 2 + token.alt.length + token.backlash.first.length + 2,
    token
  )

  const lastBracketContent = this.highlight(h, block, end - 1, end, token)

  const firstBacklashStart = start + 2 + token.alt.length

  const secondBacklashStart = end - 1 - token.backlash.second.length

  let id
  let isSuccess
  let selector
  const imageInfo = getImageInfo(token.src + encodeURI(token.backlash.second))
  const { src } = imageInfo
  const alt = token.alt + encodeURI(token.backlash.first)
  const { title } = token

  if (src) {
    ({ id, isSuccess } = this.loadImageAsync(imageInfo, alt, className))
  }

  selector = id ? `span#${id}.${imageClass}.${CLASS_OR_ID['AG_REMOVE']}` : `span.${imageClass}.${CLASS_OR_ID['AG_REMOVE']}`

  if (isSuccess) {
    selector += `.${className}`
  } else {
    selector += `.${CLASS_OR_ID['AG_IMAGE_FAIL']}`
  }
  const children = [
    ...titleContent,
    ...this.backlashInToken(h, token.backlash.first, className, firstBacklashStart, token),
    ...secondBracketContent,
    h(`span.${CLASS_OR_ID['AG_IMAGE_SRC']}`, srcContent),
    ...this.backlashInToken(h, token.backlash.second, className, secondBacklashStart, token),
    ...lastBracketContent
  ]

  return isSuccess
    ? [
      h(selector, children),
      h('img', { props: { alt, src, title } })
    ]
    : [h(selector, children)]
}
