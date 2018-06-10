import { CLASS_OR_ID } from '../../../config'
import { snakeToCamel } from '../../../utils'

export default function referenceLink (h, cursor, block, token, outerClass) {
  const className = this.getClassName(outerClass, block, token, cursor)
  const labelClass = className === CLASS_OR_ID['AG_GRAY']
    ? CLASS_OR_ID['AG_REFERENCE_LABEL']
    : className
  const { start, end } = token.range
  const {
    anchor,
    children,
    backlash,
    isFullLink
  } = token
  const MARKER = '['
  const backlashStart = start + MARKER.length + anchor.length
  const startMarker = this.highlight(
    h,
    block,
    start,
    start + MARKER.length,
    token
  )
  const content = [
    ...children.reduce((acc, to) => {
      const chunk = this[snakeToCamel(to.type)](h, cursor, block, to, className)
      return Array.isArray(chunk) ? [...acc, ...chunk] : [...acc, chunk]
    }, []),
    ...this.backlashInToken(h, backlash, className, backlashStart, token)
  ]
  const endMarker = this.highlight(
    h,
    block,
    start + MARKER.length + anchor.length + backlash.length,
    end,
    token
  )

  if (isFullLink) {
    const labelContent = this.highlight(
      h,
      block,
      start + 3 * MARKER.length + anchor.length,
      end - MARKER.length,
      token
    )
    const middleMarker = this.highlight(
      h,
      block,
      start + MARKER.length + anchor.length,
      start + 3 * MARKER.length + anchor.length,
      token
    )
    const lastMarker = this.highlight(
      h,
      block,
      end - MARKER.length,
      end,
      token
    )

    return [
      h(`span.${className}`, startMarker),
      h(`span.${CLASS_OR_ID['AG_REFERENCE_LINK']}`, {
        dataset: {
          role: 'link'
        }
      }, content),
      h(`span.${className}`, middleMarker),
      h(`span.${labelClass}`, labelContent),
      h(`span.${className}`, lastMarker)
    ]
  } else {
    return [
      h(`span.${className}`, startMarker),
      h(`span.${CLASS_OR_ID['AG_REFERENCE_LINK']}`, {
        dataset: {
          role: 'link'
        }
      }, content),
      h(`span.${className}`, endMarker)
    ]
  }
}
