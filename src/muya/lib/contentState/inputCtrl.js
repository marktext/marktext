import selection from '../selection'

const inputCtrl = ContentState => {
  // Input @ to quick insert paragraph
  ContentState.prototype.checkQuickInsert = function (block) {
    const { type, text, functionType } = block
    if (type !== 'span' || functionType) return false
    return /^@[a-zA-Z\d]*$/.test(text)
  }
  ContentState.prototype.inputHandler = function (event) {
    const { start } = selection.getCursorRange()
    const key = start.key
    const block = this.getBlock(key)
    const paragraph = document.querySelector(`#${key}`)
    const rect = paragraph.getBoundingClientRect()
    const checkQuickInsert = this.checkQuickInsert(block)
    const reference = this.getPositionReference()
    reference.getBoundingClientRect = function () {
      const { x, y, left, top, height, bottom } = rect

      return Object.assign({}, {
        left,
        x,
        top,
        y,
        bottom,
        height,
        width: 0,
        right: left
      })
    }
    this.muya.eventCenter.dispatch('muya-quick-insert', reference, block, checkQuickInsert)
  }
}

export default inputCtrl
