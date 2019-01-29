import { CLASS_OR_ID } from '../../../config'

export default function header (h, cursor, block, token, outerClass) {
  const { start, end } = token.range
  const className = this.getClassName(outerClass, block, token, cursor)
  const content = this.highlight(h, block, start, end, token)

  return [
    h(`span.${className}.${CLASS_OR_ID['AG_REMOVE']}`, content)
  ]
}
