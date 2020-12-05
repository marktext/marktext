import { CLASS_OR_ID } from '../../../config'
import { getCitationLink } from '../../utils'

export default function citation (h, cursor, block, token, outerClass) {
  const className = this.getClassName(outerClass, block, token, cursor)
  const { start, end } = token.range
  const startMarker = this.highlight(h, block, start, start + 1, token)
  const endMarker = this.highlight(h, block, end - 1, end, token)
  const startContent = start + 1
  const citeItems = []
  const citationItemRegex = /(.*?)(?:(?<![a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-])(-?@)([\p{L}\d\-:.#$%&+?<>~/]+))(.*?)(?:(;)((?!.*?@[\p{L}\d\-:.#$%&+?<>~/]+.*?).+$)?|$)/gu
  const { citationLinks, citationLinkTemplate } = this.muya.options
  const { content } = token

  let m
  let pos = startContent
  let keyMarkerElem = null

  while ((m = citationItemRegex.exec(content)) !== null) {
    if (m.index === citationItemRegex.lastIndex) {
      citationItemRegex.lastIndex++
    }

    // format: [prefix @citekey suffix/locator; prefix @citekey....]
    // capture groups:
    // 0 - full match
    // 1 - prefix
    // 2 - citekey marker (@)
    // 3 - citekey
    // 4 - suffix / locator
    // 5 - delimiter (;)
    // 6 - incomplete next citation item without citekey yet

    m.forEach((match, groupIndex) => {
      if (match === undefined) {
        return
      }

      switch (groupIndex) {
        case 0: return
        case 2: // key marker
          keyMarkerElem = h(`span.${className}.${CLASS_OR_ID.AG_INLINE_CITATION_KEY_MARKER}.${CLASS_OR_ID.AG_REMOVE}`,
            this.highlight(h, block, pos, pos + match.length, token)
          )
          break
        case 3: { // key
          const hight = this.highlight(h, block, pos, pos + match.length, token)
          const citekeyElem = h(`span.${CLASS_OR_ID.AG_INLINE_CITATION_CITEKEY}`, hight)
          const content = [keyMarkerElem, citekeyElem]

          const item = citationLinks ? h(`a.${CLASS_OR_ID.AG_INLINE_RULE}.${CLASS_OR_ID.AG_INLINE_CITATION_LINK}`, {
            attrs: {
              spellcheck: 'false',
              href: getCitationLink(match, citationLinkTemplate),
              target: '_blank',
              title: match
            }
          }, content) : h('span', content)
          citeItems.push(item)
        }
          break

        default:
          if (match.length > 0) {
            citeItems.push(h('span', this.highlight(h, block, pos, pos + match.length, token)))
          }
      }
      pos += match.length
    })
  }

  return [
    h(`span.${CLASS_OR_ID.AG_INLINE_CITATION}.${CLASS_OR_ID.AG_INLINE_CITATION_FULL}.${CLASS_OR_ID.AG_INLINE_RULE}`, [
      h(`span.${className}.${CLASS_OR_ID.AG_REMOVE}.${CLASS_OR_ID.AG_COPY_REMOVE}.${CLASS_OR_ID.AG_INLINE_CITATION_PAREN_START}`),
      h(`span.${className}.${CLASS_OR_ID.AG_REMOVE}.${CLASS_OR_ID.AG_INLINE_CITATION_START_MARKER}`, startMarker),
      ...citeItems,
      h(`span.${className}.${CLASS_OR_ID.AG_REMOVE}.${CLASS_OR_ID.AG_INLINE_CITATION_END_MARKER}`, endMarker),
      h(`span.${className}.${CLASS_OR_ID.AG_REMOVE}.${CLASS_OR_ID.AG_COPY_REMOVE}.${CLASS_OR_ID.AG_INLINE_CITATION_PAREN_END}`)
    ])
  ]
}
