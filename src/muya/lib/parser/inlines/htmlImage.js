import { CLASS_OR_ID } from '../../config'
import { getImageInfo } from '../../utils'
import { highlight, getClassName, loadImageAsync, pushPending, getSrcAlt } from '../utils/'
// html_image
const meta = {
  id: 'htmlImage',
  type: 'inline',
  sort: 45,
  rule: /^(<img\s([\s\S]*?src[\s\S]+?)(?!\\)>)/

}
function parse (params) {
  let cap = meta.rule.exec(params.src)
  let endPos = params.pos
  let ok = false
  if (cap) {
    const rawAttr = cap[2]
    const { src: imageSrc, alt } = getSrcAlt(rawAttr)
    if (imageSrc) {
      ok = true
      pushPending(params)
      params.src = params.src.substring(cap[0].length)
      endPos = params.pos + cap[0].length
      params.tokens.push({
        raw: cap[0],
        tag: cap[1],
        src: imageSrc,
        alt,
        type: meta.id,
        parent: params.tokens,
        range: {
          start: params.pos,
          end: endPos
        }
      })
      params.pos = endPos
    }
  }
  return { ok, params }
}

function render (h, cursor, block, token, outerClass, stateRender) {
  const className = getClassName(outerClass, block, token, cursor)
  const imageClass = CLASS_OR_ID['AG_IMAGE_MARKED_TEXT']
  const { start, end } = token.range
  const tag = highlight(h, block, start, end, token)
  const { src: rawSrc, alt } = token
  const imageInfo = getImageInfo(rawSrc)
  const { src } = imageInfo
  let id
  let isSuccess
  let selector
  if (src) {
    ({ id, isSuccess } = loadImageAsync(imageInfo, alt, className, CLASS_OR_ID['AG_COPY_REMOVE'], stateRender))
  }
  selector = id ? `span#${id}.${imageClass}.${CLASS_OR_ID['AG_HTML_TAG']}` : `span.${imageClass}.${CLASS_OR_ID['AG_HTML_TAG']}`
  selector += `.${CLASS_OR_ID['AG_OUTPUT_REMOVE']}`
  if (isSuccess) {
    selector += `.${className}`
  } else {
    selector += `.${CLASS_OR_ID['AG_IMAGE_FAIL']}`
  }

  return isSuccess
    ? [
      h(selector, tag),
      h(`img.${CLASS_OR_ID['AG_COPY_REMOVE']}`, { props: { alt, src } })
    ]
    : [h(selector, tag)]
}
export default { meta, parse, render }
