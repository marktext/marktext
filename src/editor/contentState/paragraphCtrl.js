import selection from '../selection'

const paragraphCtrl = ContentState => {
  ContentState.prototype.selectionChange = function () {
    const { start, end } = selection.getCursorRange()
    start.type = this.getBlock(start.key).type
    end.type = this.getBlock(end.key).type
    return { start, end }
  }
}

export default paragraphCtrl
