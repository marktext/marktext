import selection from '../selection'
import { findNearestParagraph, getOffsetOfParagraph } from '../selection/dom'
import { CLASS_OR_ID, IMAGE_EXT_REG } from '../config'
import { tokenizer } from '../parser'

export const checkEditImage = () => {
  const { start, end } = selection.getCursorRange()
  if (!start || !end) {
    return false
  }
  if (start.key === end.key && start.offset === end.offset) {
    const node = selection.getSelectionStart()
    const { right } = selection.getCaretOffsets(node)
    const classList = node && node.classList
    if (classList && (classList.contains(CLASS_OR_ID['AG_IMAGE_SRC'])) && right === 0) {
      return IMAGE_EXT_REG.test(node.textContent) ? false : 'image-path'
    }
    if (classList && (classList.contains(CLASS_OR_ID['AG_IMAGE_MARKED_TEXT'])) && right === 1) {
      return 'image'
    }
  }
  return false
}

export const getImageInfo = image => {
  const paragraph = findNearestParagraph(image)
  const rawEle = image.querySelector('span.ag-image-raw')
  if (!rawEle) {
    throw new Error('There is no raw element in image wrapper.')
  }
  const raw = rawEle.textContent
  const offset = getOffsetOfParagraph(image, paragraph)
  const tokens = tokenizer(raw)
  const token = tokens[0]
  token.range = {
    start: offset,
    end: offset + raw.length
  }
  return {
    key: paragraph.id,
    token
  }
}
