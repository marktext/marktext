import { CLASS_OR_ID } from '../../config'
import { isLengthEven, getImageInfo } from '../../utils'
import { highlight, getClassName, loadImageAsync, pushPending } from '../utils/'
import { tokenizerFac } from '../inlineTokenizer'
// reference_image
const meta = {
  id: 'referenceImage',
  sort: 30,
  type: 'inline',
  rule: /^\!\[([^\]]+?)(\\*)\](?:\[([^\]]*?)(\\*)\])?/ //eslint-disable-line

}

function parse (params) {
  let cap = meta.rule.exec(params.src)
  let endPos = params.pos
  let ok = false
  if (cap && isLengthEven(cap[2]) && isLengthEven(cap[4])) {
    ok = true
    pushPending(params)
    params.src = params.src.substring(cap[0].length)
    endPos = params.pos + cap[0].length
    params.tokens.push({
      isFullLink: !!cap[3],
      label: cap[3] || cap[1],
      alt: cap[1],
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
  }
  return { ok, params }
}
function render (h, cursor, block, token, outerClass, stateRender) {
  const className = getClassName(outerClass, block, token, cursor)
  const imageClass = CLASS_OR_ID['AG_IMAGE_MARKED_TEXT']
  const { start, end } = token.range
  const tag = highlight(h, block, start, end, token)
  let href = ''
  let title = ''
  let { labels } = stateRender
  const { label, backlash, alt } = token
  const rawSrc = label + backlash.second
  if (labels.has((rawSrc).toLowerCase())) {
    ({ href, title } = labels.get(rawSrc.toLowerCase()))
  }
  const imageInfo = getImageInfo(href)
  const { src } = imageInfo
  let id
  let isSuccess
  let selector
  if (src) {
    ({ id, isSuccess } = loadImageAsync(imageInfo, alt, className, CLASS_OR_ID['AG_COPY_REMOVE'], stateRender))
  }
  selector = id ? `span#${id}.${imageClass}` : `span.${imageClass}`
  selector += `.${CLASS_OR_ID['AG_OUTPUT_REMOVE']}`
  if (isSuccess) {
    selector += `.${className}`
  } else {
    selector += `.${CLASS_OR_ID['AG_IMAGE_FAIL']}`
  }

  return isSuccess
    ? [
      h(selector, tag),
      h(`img.${CLASS_OR_ID['AG_COPY_REMOVE']}`, { props: { alt, src, title } })
    ]
    : [h(selector, tag)]
}
export default { meta, parse, render }
