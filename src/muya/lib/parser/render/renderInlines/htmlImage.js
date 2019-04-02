import { CLASS_OR_ID } from '../../../config'
import { getImageInfo } from '../../../utils'

// html_image
export default function htmlImage (h, cursor, block, token, outerClass) {
  const className = this.getClassName(outerClass, block, token, cursor)
  const imageClass = CLASS_OR_ID['AG_IMAGE_MARKED_TEXT']
  const { start, end } = token.range
  const tag = this.highlight(h, block, start, end, token)
  const { src: rawSrc, alt = '', width, height } = token.attrs
  const imageInfo = getImageInfo(rawSrc)
  const { src } = imageInfo
  let id
  let isSuccess
  let selector
  if (src) {
    ({ id, isSuccess } = this.loadImageAsync(imageInfo, alt, className, CLASS_OR_ID['AG_COPY_REMOVE']))
  }
  selector = id ? `span#${id}.${imageClass}.${CLASS_OR_ID['AG_HTML_TAG']}` : `span.${imageClass}.${CLASS_OR_ID['AG_HTML_TAG']}`
  selector += `.${CLASS_OR_ID['AG_OUTPUT_REMOVE']}`
  if (isSuccess) {
    selector += `.${className}`
  } else {
    selector += `.${CLASS_OR_ID['AG_IMAGE_FAIL']}`
  }
  const props = { alt, src }
  if (typeof width === 'number') {
    props.width = width
  }
  if (typeof height === 'number') {
    props.height = height
  }
  return isSuccess
    ? [
      h(selector, tag),
      h(`img.${CLASS_OR_ID['AG_COPY_REMOVE']}`, { props })
    ]
    : [h(selector, tag)]
}
