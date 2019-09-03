import { CLASS_OR_ID } from '../../../config'

export default function hr (h, cursor, block, token, outerClass) {
  const { start, end } = token.range
  const content = this.highlight(h, block, start, end, token)
  return [
    h(`span.${CLASS_OR_ID.AG_GRAY}.${CLASS_OR_ID.AG_REMOVE}`, content)
  ]
}
