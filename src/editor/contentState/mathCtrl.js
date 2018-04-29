import katex from 'katex'
import { CLASS_OR_ID } from '../config'

import 'katex/dist/katex.min.css'

const mathCtrl = ContentState => {
  ContentState.prototype.renderMath = function (block) {
    const selector = block ? `#${block.key} .${CLASS_OR_ID['AG_MATH_RENDER']}` : `.${CLASS_OR_ID['AG_MATH_RENDER']}`
    const mathEles = document.querySelectorAll(selector)
    const { loadMathMap } = this
    for (const math of mathEles) {
      const content = math.getAttribute('data-math')
      const type = math.getAttribute('data-type')
      const displayMode = type === 'display_math'
      const key = `${content}_${type}`
      if (loadMathMap.has(key)) {
        math.innerHTML = loadMathMap.get(key)
        continue
      }
      try {
        const html = katex.renderToString(content, {
          displayMode
        })
        loadMathMap.set(key, html)
        math.innerHTML = html
      } catch (err) {
        math.innerHTML = 'Invalid'
        math.classList.add(CLASS_OR_ID['AG_MATH_ERROR'])
      }
    }
  }
}

export default mathCtrl
