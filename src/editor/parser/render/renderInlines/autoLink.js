import { CLASS_OR_ID } from '../../../config'

// render auto_link to vdom
export default function autoLink (h, cursor, block, token, outerClass) {
  const { start, end } = token.range
  const content = this.highlight(h, block, start, end, token)

  return [
    h(`a.${CLASS_OR_ID['AG_INLINE_RULE']}`, {
      props: {
        href: token.href,
        target: '_blank'
      }
    }, content)
  ]
}
