import { CLASS_OR_ID } from '../config'

export const getParentCheckBox = function (checkbox) {
  const parent = checkbox.parentElement.parentElement.parentElement
  if (parent.id !== CLASS_OR_ID.AG_EDITOR_ID) {
    return parent.firstElementChild
  } else {
    return null
  }
}
