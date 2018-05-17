import { CLASS_OR_ID } from '../../../config'

// `a_link`: `<a href="url">anchor</a>`
export default function aLink (h, cursor, block, token, outerClass) {
  const className = this.getClassName(outerClass, block, token, cursor)
  const tagClassName = className === CLASS_OR_ID['AG_HIDE'] ? className : CLASS_OR_ID['AG_HTML_TAG']
  const { start, end } = token.range
  const openTag = this.highlight(h, block, start, start + token.openTag.length, token)
  const anchor = token.children.reduce((acc, to) => {
    const chunk = this[to.type](h, cursor, block, to, className)
    return Array.isArray(chunk) ? [...acc, ...chunk] : [...acc, chunk]
  }, [])
  const closeTag = this.highlight(h, block, end - token.closeTag.length, end, token)

  return [
    h(`span.${tagClassName}.${CLASS_OR_ID['AG_OUTPUT_REMOVE']}`, openTag),
    h(`a.${CLASS_OR_ID['AG_A_LINK']}`, {
      dataset: {
        href: token.href
      }
    }, anchor),
    h(`span.${tagClassName}.${CLASS_OR_ID['AG_OUTPUT_REMOVE']}`, closeTag)
  ]
}
