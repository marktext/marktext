import { CLASS_OR_ID } from '../../../config'

export default function htmlTag (h, cursor, block, token, outerClass) {
  const className = CLASS_OR_ID['AG_HTML_TAG']
  const { start, end } = token.range
  const tag = this.highlight(h, block, start, end, token)
  const isBr = /<br(?=\s|\/|>)/.test(token.tag)
  return [
    h(`span.${className}`, isBr ? [...tag, h('br')] : tag)
  ]
}
