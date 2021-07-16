import { isWin } from '../config'
import { findNearestParagraph, getOffsetOfParagraph } from '../selection/dom'
import { tokenizer } from '../parser'

export const getImageInfo = image => {
  const paragraph = findNearestParagraph(image)
  const raw = image.getAttribute('data-raw')
  const offset = getOffsetOfParagraph(image, paragraph)
  const tokens = tokenizer(raw)
  const token = tokens[0]
  token.range = {
    start: offset,
    end: offset + raw.length
  }
  return {
    key: paragraph.id,
    token,
    imageId: image.id
  }
}

export const correctImageSrc = src => {
  if (src) {
    // Fix ASCII and UNC paths on Windows (#1997).
    if (isWin && /^(?:[a-zA-Z]:\\|[a-zA-Z]:\/).+/.test(src)) {
      src = 'file:///' + src.replace(/\\/g, '/')
    } else if (isWin && /^\\\\\?\\.+/.test(src)) {
      src = 'file:///' + src.substring(4).replace(/\\/g, '/')
    } else if (/^\/.+/.test(src)) {
      // Also adding file protocol on UNIX.
      src = 'file://' + src
    }
  }
  return src
}
