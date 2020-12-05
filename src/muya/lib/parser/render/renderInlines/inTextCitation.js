import { CLASS_OR_ID } from '../../../config'
import { getCitationLink } from '../../utils'

export default function inTextCitation (h, cursor, block, token, outerClass) {
  const className = this.getClassName(outerClass, block, token, cursor)
  const { start, end } = token.range
  const { suffix, suffixContent, suffixSpace, citeKey, suffixStartMarker } = token

  const citekeyStart = start + 1
  const citekeyEnd = citekeyStart + citeKey.length
  const markerItem = this.highlight(h, block, start, citekeyStart, token)
  const citekeyItem = this.highlight(h, block, citekeyStart, citekeyEnd, token)

  const { citationLinks, citationLinkTemplate } = this.muya.options

  const suffixItems = []

  if (suffix) {
    const suffixStart = citekeyEnd
    const suffixStartMarkerPos = suffixStart + suffixSpace.length
    const suffixContentStart = suffixStartMarkerPos + suffixStartMarker.length

    const suffixSpaceItem = this.highlight(h, block, suffixStart, suffixStartMarkerPos, token)
    const suffixStartMarkerItem = this.highlight(h, block, suffixStartMarkerPos, suffixContentStart, token)
    const suffixContentItem = this.highlight(h, block, suffixContentStart, suffixContentStart + suffixContent.length, token)
    const suffixEndMarkerItem = this.highlight(h, block, end - 1, end, token)

    suffixItems.push(
      h('span', suffixSpaceItem),
      h(`span.${className}.${CLASS_OR_ID.AG_REMOVE}`, suffixStartMarkerItem),
      h(`span.${className}.${CLASS_OR_ID.AG_REMOVE}.${CLASS_OR_ID.AG_COPY_REMOVE}.${CLASS_OR_ID.AG_INLINE_CITATION_PAREN_START}`),
      h('span', suffixContentItem),
      h(`span.${className}.${CLASS_OR_ID.AG_REMOVE}`, suffixEndMarkerItem),
      h(`span.${className}.${CLASS_OR_ID.AG_REMOVE}.${CLASS_OR_ID.AG_COPY_REMOVE}.${CLASS_OR_ID.AG_INLINE_CITATION_PAREN_END}`)
    )
  }

  const citekeyContent = [h(`span.${className}.${CLASS_OR_ID.AG_REMOVE}`, markerItem), h('span', citekeyItem)]
  const citeKeyElem = citationLinks ? h(`a.${CLASS_OR_ID.AG_INLINE_RULE}.${CLASS_OR_ID.AG_INLINE_CITATION_LINK}`, {
    attrs: {
      spellcheck: 'false',
      href: getCitationLink(citeKey, citationLinkTemplate),
      target: '_blank',
      title: citeKey
    }
  }, citekeyContent) : h('span', citekeyContent)

  return [
    h(`span#citation-${citeKey}.${CLASS_OR_ID.AG_INLINE_CITATION}.${CLASS_OR_ID.AG_INLINE_CITATION_IN_TEXT}.${CLASS_OR_ID.AG_INLINE_RULE}`, [
      citeKeyElem,
      ...suffixItems
    ])
  ]
}
