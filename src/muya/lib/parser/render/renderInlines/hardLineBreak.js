import { CLASS_OR_ID } from '../../../config'

export default function softLineBreak (h, cursor, block, token, outerClass) {
  const { spaces, lineBreak } = token
  const className = CLASS_OR_ID['AG_HARD_LINE_BREAK']
  const spaceClass = CLASS_OR_ID['AG_HARD_LINE_BREAK_SPACE']

  return [
    h(`span.${className}`, [ h(`span.${spaceClass}`, spaces), lineBreak ])
  ]
}
