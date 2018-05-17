// render auto_link to vdom
export default function autoLink (h, cursor, block, token, outerClass) {
  const { start, end } = token.range
  const content = this.highlight(h, block, start, end, token)

  return [
    h('a', {
      props: {
        href: token.href
      }
    }, content)
  ]
}
