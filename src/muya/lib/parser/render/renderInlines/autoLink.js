import { CLASS_OR_ID } from '../../../config'
import { sanitizeHyperlink } from '../../../utils/url'

// render auto_link to vdom
export default function autoLink (h, cursor, block, token, outerClass) {
  const className = this.getClassName(outerClass, block, token, cursor)
  const { isLink, marker, href, email } = token
  const { start, end } = token.range

  const startMarker = this.highlight(h, block, start, start + marker.length, token)
  const endMarker = this.highlight(h, block, end - marker.length, end, token)
  const content = this.highlight(h, block, start + marker.length, end - marker.length, token)

  const hyperlink = isLink ? encodeURI(href) : `mailto:${email}`
  return [
    h(`span.${className}`, startMarker),
    h(`a.${CLASS_OR_ID.AG_INLINE_RULE}.${CLASS_OR_ID.AG_AUTO_LINK}`, {
      attrs: {
        spellcheck: 'false'
      },
      props: {
        href: sanitizeHyperlink(hyperlink),
        target: '_blank'
      }
    }, content),
    h(`span.${className}`, endMarker)
  ]
}
