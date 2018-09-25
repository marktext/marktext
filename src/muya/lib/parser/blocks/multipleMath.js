import { LINE_BREAKS_REG } from '../utils'
import { CLASS_OR_ID } from '../../config'
const meta = {
  id: 'multipleMath',
  type: 'block',
  sort: 50,
  rule: /^\$\$\n([\s\S]+?)\n\$\$(?:\n+|$)/
}

function parse (params) {
  let cap = meta.rule.exec(params.src)
  let ok = false
  if (cap) {
    ok = true
    params.src = params.src.substring(cap[0].length)
    params.tokens.push({
      type: 'multiplemath',
      text: cap[1]
    })
  }
  return { ok, params }
}

function process (params) {
  let cap = meta.rule.exec(params.src)
  let ok = false
  if (cap) {
    ok = true
    params.src = params.src.substring(cap[0].length)
    const FUNCTION_TYPE = 'multiplemath'
    const mathBlock = params.stateRender.createBlock('figure', '', { selector: `.${CLASS_OR_ID['AG_MULTIPLE_MATH_BLOCK']}` })
    const textArea = params.stateRender.createBlock('pre', '', {
      selector: `.${CLASS_OR_ID['AG_MULTIPLE_MATH']}`,
      dataset: {
        role: 'MATH'
      }
    })
    const mathPreview = params.stateRender.createBlock('div', '', { editable: false })
    if (typeof cap[1] === 'string' && cap[1]) {
      const lines = cap[1].replace(/^\s+/, '').split(LINE_BREAKS_REG).map(line => params.stateRender.createBlock('span', line, {
        selector: `.${CLASS_OR_ID['AG_MULTIPLE_MATH_LINE']}`
      }))
      for (const line of lines) {
        line.functionType = FUNCTION_TYPE
        params.stateRender.appendChild(textArea, line)
      }
    } else {
      const emptyLine = params.stateRender.createBlock('span', '', {
        selector: `.${CLASS_OR_ID['AG_MULTIPLE_MATH_LINE']}`
      })
      emptyLine.functionType = FUNCTION_TYPE
      params.stateRender.appendChild(textArea, emptyLine)
    }

    mathBlock.functionType = textArea.functionType = mathPreview.functionType = FUNCTION_TYPE
    mathPreview.math = cap[1]
    params.stateRender.appendChild(mathBlock, textArea)
    params.stateRender.appendChild(mathBlock, mathPreview)
    params.stateRender.appendChild(params.parent, mathBlock)
  }
  return { ok, params }
}

export default { meta, parse, process }
