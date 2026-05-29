import { findNearestParagraph } from '../selection/dom'
import { tokenizer } from '../parser'

export const getLinkInfo = a => {
  const paragraph = findNearestParagraph(a)
  const raw = a.getAttribute('data-raw')
  const start = a.getAttribute('data-start')
  const end = a.getAttribute('data-end')
  const tokens = tokenizer(raw)
  const token = tokens[0]
  const href = a.getAttribute('href')
  token.range = {
    start,
    end
  }
  return {
    key: paragraph.id,
    token,
    href
  }
}
