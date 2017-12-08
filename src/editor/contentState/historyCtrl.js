import selection from '../selection'
import { findNearestParagraph } from '../utils/domManipulate'

const historyCtrl = ContentState => {
  ContentState.prototype.historyHandler = function (event) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    const node = selection.getSelectionStart()
    const paragraph = findNearestParagraph(node)
    const text = paragraph.textContent
    const block = this.getBlock(paragraph.id)
    if (block.text !== text) {
      this.history.push({
        type: 'normal',
        blocks: this.blocks,
        cursor: this.cursor
      })
    }
  }
}

export default historyCtrl
