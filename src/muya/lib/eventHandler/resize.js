import resizeCodeBlockLineNumber from '../utils/resizeCodeLineNumber'

class Resize {
  constructor (muya) {
    this.muya = muya
    this.timer = null
    this.listen()
  }

  listen () {
    window.addEventListener('resize', function () {
      if (this.timer) {
        clearTimeout(this.timer)
      }
      this.timer = setTimeout(() => {
        console.log('wwww')
        const codeBlocks = document.querySelectorAll('pre.line-numbers')
        if (codeBlocks.length) {
          for (const ele of codeBlocks) {
            resizeCodeBlockLineNumber(ele)
          }
        }
      }, 300)
    })
  }
}

export default Resize
