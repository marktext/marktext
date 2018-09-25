import { CLASS_OR_ID, IMAGE_EXT_REG, isInElectron } from '../../config'
import { getImageInfo, isLengthEven } from '../../utils'
import { highlight, getClassName, loadImageAsync, pushPending } from '../utils/'
import { inlines } from './index'
// I dont want operate dom directly, is there any better method? need help!
const meta = {
  id: 'image',
  type: 'inline',

  sort: 22,
  nest: true,
  rule: /^(\!\[)(.*?)(\\*)\]\((.*?)(\\*)\)/ //eslint-disable-line

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

      src: cap[4],
      alt: cap[2],
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
  const { start: cursorStart, end: cursorEnd } = cursor
  const { start, end } = token.range
  if (
    cursorStart.key === cursorEnd.key &&
    cursorStart.offset === cursorEnd.offset &&
    cursorStart.offset === end - 1 &&
    !IMAGE_EXT_REG.test(token.src) &&
    isInElectron
  ) {
    // TODO:not use global class
    stateRender.eventCenter.dispatch('image-path', token.src)
  }

  const className = getClassName(outerClass, block, token, cursor)
  const imageClass = CLASS_OR_ID['AG_IMAGE_MARKED_TEXT']
  const titleContent = highlight(h, block, start, start + 2 + token.alt.length, token)
  const srcContent = highlight(
    h, block,
    start + 2 + token.alt.length + token.backlash.first.length + 2,
    start + 2 + token.alt.length + token.backlash.first.length + 2 + token.src.length,
    token
  )

  const secondBracketContent = highlight(
    h, block,
    start + 2 + token.alt.length + token.backlash.first.length,
    start + 2 + token.alt.length + token.backlash.first.length + 2,
    token
  )

  const lastBracketContent = highlight(h, block, end - 1, end, token)

  const firstBacklashStart = start + 2 + token.alt.length

  const secondBacklashStart = end - 1 - token.backlash.second.length

  let id
  let isSuccess
  let selector
  const imageInfo = getImageInfo(token.src + encodeURI(token.backlash.second))
  const { src } = imageInfo
  const alt = token.alt + encodeURI(token.backlash.first)

  if (src) {
    ({ id, isSuccess } = loadImageAsync(imageInfo, alt, className, null, stateRender))
  }

  selector = id ? `span#${id}.${imageClass}.${CLASS_OR_ID['AG_REMOVE']}` : `span.${imageClass}.${CLASS_OR_ID['AG_REMOVE']}`

  if (isSuccess) {
    selector += `.${className}`
  } else {
    selector += `.${CLASS_OR_ID['AG_IMAGE_FAIL']}`
  }
  const children = [
    ...titleContent,
    ...inlines.get('backlashInToken').render(h, token.backlash.first, className, firstBacklashStart, token),
    ...secondBracketContent,
    h(`span.${CLASS_OR_ID['AG_IMAGE_SRC']}`, srcContent),
    ...inlines.get('backlashInToken').render(h, token.backlash.second, className, secondBacklashStart, token),
    ...lastBracketContent
  ]

  return isSuccess
    ? [
      h(selector, children),
      h('img', { props: { alt, src } })
    ]
    : [h(selector, children)]
}
export default { meta, parse, render }
