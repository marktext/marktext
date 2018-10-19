import selection from '../selection'
import { HAS_TEXT_BLOCK_REG } from '../config'

const clickCtrl = ContentState => {
  ContentState.prototype.clickHandler = function (event) {
    // is show format float box?
    const { eventCenter } = this.muya
    const { start, end } = selection.getCursorRange()
    const block = this.getBlock(start.key)
    if (start.key === end.key && start.offset !== end.offset && HAS_TEXT_BLOCK_REG.test(block.type)) {
      if (block.type === 'span' && block.functionType) return
      const reference = this.getPositionReference()
      const { formats } = this.selectionFormats()
      eventCenter.dispatch('muya-format-picker', { reference, formats })
    }
  }
}

export default clickCtrl
