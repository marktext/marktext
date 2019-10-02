import { CLASS_OR_ID } from '../../../config'

// render auto_link to vdom
export default function autoLinkExtension (h, cursor, block, token, outerClass) {
  const { linkType, www, url, email } = token
  const { start, end } = token.range

  const content = this.highlight(h, block, start, end, token)

  return [
    h(`a.${CLASS_OR_ID.AG_INLINE_RULE}.${CLASS_OR_ID.AG_AUTO_LINK_EXTENSION}`, {
      props: {
        href: linkType === 'www' ? encodeURI(`http://${www}`) : (linkType === 'url' ? encodeURI(url) : `mailto:${email}`),
        target: '_blank'
      }
    }, content)
  ]
}
