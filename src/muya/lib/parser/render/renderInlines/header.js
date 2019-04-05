import { CLASS_OR_ID } from '../../../config'

export default function header (h, cursor, block, token, outerClass) {
  const { content } = token
  const { start, end } = token.range
  const className = this.getClassName(outerClass, block, token, cursor)
  const markerVnode = this.highlight(h, block, start, end - content.length, token)
  const contentVnode = this.highlight(h, block, end - content.length, end, token)

  return [
    h(`span.${className}.${CLASS_OR_ID['AG_REMOVE']}`, markerVnode),
    h(`span.${className}.${CLASS_OR_ID['AG_REMOVE']}`, contentVnode)
  ]
}
