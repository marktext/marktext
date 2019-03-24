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
    isFullLink,
    label
  } = token
  const MARKER = '['
  let href = ''
  let title = ''
  const key = (label + backlash.second).toLowerCase()
  if (this.labels.has(key)) {
    ({ href, title } = this.labels.get(key))
  } else {
    // if the link's reference definition is not defined, just show as normal text.#432
    return this.highlight(h, block, start, end, token)
  }
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
    ...this.backlashInToken(h, backlash.first, className, backlashStart, token)
  ]
  const endMarker = this.highlight(
    h,
    block,
    start + MARKER.length + anchor.length + backlash.first.length,
    end,
    token
  )
  const anchorSelector = href ? `a.${CLASS_OR_ID['AG_INLINE_RULE']}` : `span.${CLASS_OR_ID['AG_REFERENCE_LINK']}`
  const dataSet = {
    props: {
      title
    }
  }
  if (href) {
    Object.assign(dataSet.props, { href })
  }

  if (isFullLink) {
    const labelContent = this.highlight(
      h,
      block,
      start + 3 * MARKER.length + anchor.length + backlash.first.length,
      end - MARKER.length - backlash.second.length,
      token
    )
    const middleMarker = this.highlight(
      h,
      block,
      start + MARKER.length + anchor.length + backlash.first.length,
      start + 3 * MARKER.length + anchor.length + backlash.first.length,
      token
    )
    const lastMarker = this.highlight(
      h,
      block,
      end - MARKER.length,
      end,
      token
    )
    const secondBacklashStart = end - MARKER.length - backlash.second.length

    return [
      h(`span.${className}`, startMarker),
      h(anchorSelector, dataSet, content),
      h(`span.${className}`, middleMarker),
      h(`span.${labelClass}`, labelContent),
      ...this.backlashInToken(h, backlash.second, className, secondBacklashStart, token),
      h(`span.${className}`, lastMarker)
    ]
  } else {
    return [
      h(`span.${className}`, startMarker),
      h(anchorSelector, dataSet, content),
      h(`span.${className}`, endMarker)
    ]
  }
}
