import { CLASS_OR_ID } from '../../../config'

export default function softLineBreak (h, cursor, block, token, outerClass) {
  const { spaces, lineBreak, isAtEnd } = token
  const className = CLASS_OR_ID.AG_HARD_LINE_BREAK
  const spaceClass = CLASS_OR_ID.AG_HARD_LINE_BREAK_SPACE
  if (isAtEnd) {
    return [
      h(`span.${className}`, h(`span.${spaceClass}`, spaces)),
      h(`span.${CLASS_OR_ID.AG_LINE_END}`, lineBreak)
    ]
  } else {
    return [
      h(`span.${className}`, [h(`span.${spaceClass}`, spaces), lineBreak])
    ]
  }
}
