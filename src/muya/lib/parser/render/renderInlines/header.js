import { CLASS_OR_ID } from '../../../config'

export default function header(h, cursor, block, token, outerClass) {
  const { content } = token
  const { start, end } = token.range
  let className = this.getClassName(outerClass, block, {
    range: {
      start,
      end: end - content.length
    }
  }, cursor)
  // In clean write mode, show heading markers when there is no actual title text.
  // The token's content is only the space/EOL from the regex capture group;
  // actual title text lives in separate tokens. Check block.text instead.
  if (this.muya.options.cleanWrite) {
    const titleText = (block.text || '').replace(/^ {0,3}#{1,6}\s*/, '')
    if (!titleText.trim()) {
      className = CLASS_OR_ID.AG_GRAY
    }
  }
  const markerVnode = this.highlight(h, block, start, end - content.length, token)
  const contentVnode = this.highlight(h, block, end - content.length, end, token)
  const spaceSelector = className === CLASS_OR_ID.AG_HIDE
    ? `span.${CLASS_OR_ID.AG_HEADER_TIGHT_SPACE}.${CLASS_OR_ID.AG_REMOVE}`
    : `span.${CLASS_OR_ID.AG_GRAY}.${CLASS_OR_ID.AG_REMOVE}`

  return [
    h(`span.${className}.${CLASS_OR_ID.AG_REMOVE}`, markerVnode),
    h(spaceSelector, contentVnode)
  ]
}
