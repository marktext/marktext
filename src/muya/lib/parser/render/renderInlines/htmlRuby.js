import { CLASS_OR_ID } from '../../../config'
import { htmlToVNode } from '../snabbdom'

export default function htmlRuby (h, cursor, block, token, outerClass) {
  const className = this.getClassName(outerClass, block, token, cursor)
  const { start, end } = token.range
  const content = this.highlight(h, block, start, end, token)
  const vNode = htmlToVNode(token.raw)

  const previewSelector = `span.${CLASS_OR_ID['AG_RUBY_RENDER']}`


  return [
    h(`span.${CLASS_OR_ID['AG_RUBY']}`, [
      h(`span.${className}.${CLASS_OR_ID['AG_INLINE_RULE']}`, content),
      h(previewSelector, {
        attrs: { contenteditable: 'false' }
      }, vNode)
    ])
  ]
}
