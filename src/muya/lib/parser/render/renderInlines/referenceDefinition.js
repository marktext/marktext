import { CLASS_OR_ID } from '../../../config'

export default function referenceDefinition (h, cursor, block, token, outerClass) {
  const className = CLASS_OR_ID.AG_REFERENCE_MARKER
  const {
    leftBracket,
    label,
    backlash,
    // rightBracket,
    // leftHrefMarker,
    // href,
    // rightHrefMarker,
    titleMarker,
    title,
    rightTitleSpace
  } = token
  const { start, end } = token.range
  const leftBracketContent = this.highlight(h, block, start, start + leftBracket.length, token)
  const labelContent = this.highlight(h, block, start + leftBracket.length, start + leftBracket.length + label.length, token)
  const middleContent = this.highlight(
    h,
    block,
    start + leftBracket.length + label.length + backlash.length,
    end - rightTitleSpace.length - titleMarker.length - title.length,
    token
  )
  const titleContent = this.highlight(
    h,
    block,
    end - rightTitleSpace.length - titleMarker.length - title.length,
    end - titleMarker.length - rightTitleSpace.length,
    token
  )
  const rightContent = this.highlight(
    h,
    block,
    end - titleMarker.length - rightTitleSpace.length,
    end,
    token
  )
  const backlashStart = start + leftBracket.length + label.length

  return [
    h(`span.${className}`, leftBracketContent),
    h(`span.${CLASS_OR_ID.AG_REFERENCE_LABEL}`, labelContent),
    ...this.backlashInToken(h, backlash, CLASS_OR_ID.AG_GRAY, backlashStart, token),
    h(`span.${className}`, middleContent),
    h(`span.${CLASS_OR_ID.AG_REFERENCE_TITLE}`, titleContent),
    h(`span.${className}`, rightContent)
  ]
}
