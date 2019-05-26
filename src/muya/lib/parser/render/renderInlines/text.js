// render token of text type to vdom.
export default function text (h, cursor, block, token) {
  const { start, end } = token.range
  return [
    h('span.ag-plain-text', this.highlight(h, block, start, end, token))
  ]
}
