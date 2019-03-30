import selection from '../selection'
import { CLASS_OR_ID, IMAGE_EXT_REG } from '../config'

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
