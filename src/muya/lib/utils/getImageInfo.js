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
