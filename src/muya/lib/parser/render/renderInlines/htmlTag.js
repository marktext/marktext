import { CLASS_OR_ID, BLOCK_TYPE6 } from '../../../config'
import { snakeToCamel } from '../../../utils'

export default function htmlTag (h, cursor, block, token, outerClass) {
  const { tag, openTag, closeTag, children, attrs } = token
  const className = children ? this.getClassName(outerClass, block, token, cursor) : CLASS_OR_ID['AG_GRAY']
  const tagClassName = className === CLASS_OR_ID['AG_HIDE'] ? className : CLASS_OR_ID['AG_HTML_TAG']
  const { start, end } = token.range
  const openContent = this.highlight(h, block, start, start + openTag.length, token)
  const closeContent = closeTag
    ? this.highlight(h, block, end - closeTag.length, end, token)
    : ''

  const anchor = Array.isArray(children) && tag !== 'ruby' // important
    ? children.reduce((acc, to) => {
        const chunk = this[snakeToCamel(to.type)](h, cursor, block, to, className)
        return Array.isArray(chunk) ? [...acc, ...chunk] : [...acc, chunk]
      }, []) 
    : ''
  switch (tag) {
    case 'img': {
      return this.htmlImage(h, cursor, block, token, outerClass)
    }
    case 'br': {
      return [h(`span.${CLASS_OR_ID['AG_HTML_TAG']}`, [...openContent, h(tag)])]
    }
    default:
      // handle void html tag
      if (!closeTag) {
        return [h(`span.${CLASS_OR_ID['AG_HTML_TAG']}`, openContent)]
      } else if (tag === 'ruby') {
        return this.htmlRuby(h, cursor, block, token, outerClass)
      } else {
        // if  tag is a block level element, use a inline element `span` to instead.
        // Because we can not nest a block level element in span element(line is span element)
        // we also recommand user not use block level element in paragraph. use block element in html block.
        let selector = BLOCK_TYPE6.includes(tag) ? 'span' : tag
        selector += `.${CLASS_OR_ID['AG_INLINE_RULE']}`
        const data = {
          attrs: {},
          dataset: {}
        }
        if (attrs.id) {
          selector += `#${attrs.id}`
        }
        if (attrs.class && /\S/.test(attrs.class)) {
          const classNames = attrs.class.split(/\s+/)
          for (const className of classNames) {
            selector += `.${className}`
          }
        }

        for (const attr of Object.keys(attrs)) {
          if (attr !== 'id' && attr !== 'class') {
            data.attrs[attr] = attrs[attr]
          }
        }

        return [
          h(`span.${tagClassName}.${CLASS_OR_ID['AG_OUTPUT_REMOVE']}`, openContent),
          h(`${selector}`, data, anchor),
          h(`span.${tagClassName}.${CLASS_OR_ID['AG_OUTPUT_REMOVE']}`, closeContent)
        ]
      }
  }
}
