import { CLASS_OR_ID } from '../../../config'

export default function displayMath (h, cursor, block, token, outerClass) {
  const className = this.getClassName(outerClass, block, token, cursor)
  const { start, end } = token.range
  const { marker } = token

  const startMarker = this.highlight(h, block, start, start + marker.length, token)
  const endMarker = this.highlight(h, block, end - marker.length, end, token)
  const content = this.highlight(h, block, start + marker.length, end - marker.length, token)

  const { content: math, type } = token

  return [
    h(`span.${className}.${CLASS_OR_ID['AG_MATH_MARKER']}`, startMarker),
    h(`span.${className}.${CLASS_OR_ID['AG_MATH']}`, [
      h(`span.${CLASS_OR_ID['AG_MATH_TEXT']}`, content),
      h(`span.${CLASS_OR_ID['AG_MATH_RENDER']}`, {
        dataset: { math, type },
        attrs: { contenteditable: 'false' }
      }, 'Loading')
    ]),
    h(`span.${className}.${CLASS_OR_ID['AG_MATH_MARKER']}`, endMarker)
  ]
}
