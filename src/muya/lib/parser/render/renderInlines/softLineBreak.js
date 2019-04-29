import { CLASS_OR_ID } from '../../../config'

export default function hardLineBreak (h, cursor, block, token, outerClass) {
  const { lineBreak, isAtEnd } = token
  let selector = `span.${CLASS_OR_ID['AG_SOFT_LINE_BREAK']}`
  const result = [
    h(selector, lineBreak)
  ]
  if (isAtEnd) {
    result.push(h('br'))
  }
  return result
}
