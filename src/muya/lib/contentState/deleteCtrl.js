import selection from '../selection'

const deleteCtrl = ContentState => {
  ContentState.prototype.deleteHandler = function (event) {
    const { start, end } = selection.getCursorRange()
    if (!start || !end) {
      return
    }
    const startBlock = this.getBlock(start.key)
    const nextBlock = this.findNextBlockInLocation(startBlock)

    // TODO: @jocs It will delete all the editor and cause error in console when there is only one empty table. same as #67
    if (startBlock.type === 'figure') event.preventDefault()
    // If select multiple paragraph or multiple characters in one paragraph, just let
    // updateCtrl to handle this case.
    if (start.key !== end.key || start.offset !== end.offset) {
      return
    }
    // Only handle h1~h6 span block
    const { type, text, key } = startBlock
    if (
      /h\d|span/.test(type) &&
      start.offset === text.length
    ) {
      event.preventDefault()
      if (nextBlock && /h\d|span/.test(nextBlock.type)) {
        if (nextBlock.functionType === 'codeLine' && nextBlock.nextSibling) {
          // if code block more than one line, do nothing!
          return
        }
        startBlock.text += nextBlock.text

        const toBeRemoved = [ nextBlock ]

        let parent = this.getParent(nextBlock)
        let target = nextBlock

        while (this.isOnlyRemoveableChild(target)) {
          toBeRemoved.push(parent)
          target = parent
          parent = this.getParent(parent)
        }

        toBeRemoved.forEach(b => this.removeBlock(b))

        const offset = start.offset
        this.cursor = {
          start: { key, offset },
          end: { key, offset }
        }
        this.render()
      }
    }
  }
}

export default deleteCtrl
