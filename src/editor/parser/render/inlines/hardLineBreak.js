import { CLASS_OR_ID } from '../../../config'

export default function hardLineBreak (h, cursor, block, token, outerClass) {
  const className = CLASS_OR_ID['AG_HARD_LINE_BREAK']
  const content = [token.spaces]
  if (block.type === 'span' && block.nextSibling) {
    return [
      h(`span.${className}`, content)
    ]
  } else {
    return content
  }
}
