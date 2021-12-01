import { CLASS_OR_ID } from '../../../config'

// render auto_link to vdom
export default function autoLinkExtension (h, cursor, block, token, outerClass) {
  const { href } = token
  const { start, end } = token.range

  const content = this.highlight(h, block, start, end, token)

  return [
    h(`a.${CLASS_OR_ID.AG_INLINE_RULE}.${CLASS_OR_ID.AG_AUTO_LINK_EXTENSION}`, {
      attrs: {
        spellcheck: 'false'
      },
      props: {
        href: href,
        target: '_blank'
      }
    }, content)
  ]
}
