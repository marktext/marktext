import resizeCodeBlockLineNumber from '../utils/resizeCodeLineNumber'
import { throttle } from '../utils'

class Resize {
  constructor (muya) {
    this.muya = muya
    this.listen()
  }

  listen () {
    window.addEventListener('resize', throttle(() => {
      const codeBlocks = document.querySelectorAll('pre.line-numbers')
      if (codeBlocks.length) {
        for (const ele of codeBlocks) {
          resizeCodeBlockLineNumber(ele)
        }
      }
    }, 300))
  }
}

export default Resize
