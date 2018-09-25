import katex from 'katex'
import { CLASS_OR_ID } from '../../config'
import { htmlToVNode } from '../utils/snabbdom'
import { highlight, getClassName, pushPending } from '../utils'
import { isLengthEven } from '../../utils'
import 'katex/dist/katex.min.css'

const meta = {
  id: 'displayMath',
  type: 'inline',
  begin: true,

  sort: 10,
  rule: /^(\$\$)([^\$]*?[^\$\\])(\\*)\1$///eslint-disable-line

}
function parse (params) {
  let cap = meta.rule.exec(params.src)
  let endPos = params.pos
  let ok = false
  if (cap && isLengthEven(cap[3])) {
    ok = true
    pushPending(params)
    params.src = params.src.substring(cap[0].length)
    endPos = params.pos + cap[0].length
    params.tokens.push({
      type: meta.id,
      nest: meta.nest,
      raw: cap[0],
      parent: params.tokens,
      marker: cap[1],
      content: cap[2] || '',
      backlash: cap[3] || '',
      range: {
        start: params.pos,
        end: endPos
      }
    })
    params.pos = endPos
  }
  return { ok, params }
}
function render (h, cursor, block, token, outerClass, stateRender) {
  const className = getClassName(outerClass, block, token, cursor)
  const { start, end } = token.range
  const { marker } = token

  const startMarker = highlight(h, block, start, start + marker.length, token)
  const endMarker = highlight(h, block, end - marker.length, end, token)
  const content = highlight(h, block, start + marker.length, end - marker.length, token)

  const { content: math, type } = token

  const { loadMathMap } = stateRender

  const displayMode = type === 'display_math'
  const key = `${math}_${type}`
  let mathVnode = null
  let previewSelector = `span.${CLASS_OR_ID['AG_MATH_RENDER']}`
  if (loadMathMap.has(key)) {
    mathVnode = loadMathMap.get(key)
  } else {
    try {
      const html = katex.renderToString(math, {
        displayMode
      })
      mathVnode = htmlToVNode(html)
      loadMathMap.set(key, mathVnode)
    } catch (err) {
      mathVnode = '< Invalid Mathematical Formula >'
      previewSelector += `.${CLASS_OR_ID['AG_MATH_ERROR']}`
    }
  }

  return [
    h(`span.${className}.${CLASS_OR_ID['AG_MATH_MARKER']}`, startMarker),
    h(`span.${className}.${CLASS_OR_ID['AG_MATH']}`, [
      h(`span.${CLASS_OR_ID['AG_MATH_TEXT']}`, content),
      h(previewSelector, {
        attrs: { contenteditable: 'false' }
      }, mathVnode)
    ]),
    h(`span.${className}.${CLASS_OR_ID['AG_MATH_MARKER']}`, endMarker)
  ]
}
export default { meta, parse, render }
