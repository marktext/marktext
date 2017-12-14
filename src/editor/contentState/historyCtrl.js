// import selection from '../selection'
// import { findNearestParagraph } from '../utils/domManipulate'

const historyCtrl = ContentState => {
  ContentState.prototype.historyHandler = function (event) {
    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      (event.key === 'z' && event.metaKey) // when user press `commandOrCtrl + z` , don't push history
    ) return

    // const node = selection.getSelectionStart()
    // const paragraph = findNearestParagraph(node)
    // const text = paragraph.textContent
    // const block = this.getBlock(paragraph.id)
    this.history.push({
      type: 'normal',
      blocks: this.blocks,
      cursor: this.cursor
    })
  }
}

export default historyCtrl
