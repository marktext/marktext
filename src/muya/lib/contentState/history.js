import { deepCopy } from '../utils'
import { UNDO_DEPTH } from '../config'

// History stores both position changes and content changes, so we need a pointer to see what is the "last" actual content change.
class History {
  constructor(contentState) {
    this.stack = []
    this.id = -1 // unique id for each history entry
    this.index = -1 // what entry we are at in the stack
    this.contentState = contentState
    this.pendingIndex = -1
    this.lastEditIndex = -1 // The current index is not necessarily an "edit" operation.
    this.lastInitIndex = -1
  }

  updateFinalEditIndex() {
    for (let i = this.index; i >= 0; i--) {
      if (this.stack[i].cursor.isEdit) {
        this.lastEditIndex = i
        return
      }
    }
    this.lastEditIndex = -1
  }

  undo() {
    this.commitPending()
    if (this.index >= 0) {
      this.index = this.index - 1
      this.updateFinalEditIndex()

      const state = deepCopy(this.stack[this.index])
      const { blocks, cursor, renderRange } = state
      cursor.noHistory = true
      this.contentState.blocks = blocks
      this.contentState.renderRange = renderRange
      this.contentState.cursor = cursor
      this.contentState.render()
    }
  }

  redo() {
    this.pendingIndex = -1
    const { index, stack } = this
    const len = stack.length
    if (index < len - 1) {
      this.index = index + 1
      this.updateFinalEditIndex()
      const state = deepCopy(stack[this.index])
      const { blocks, cursor, renderRange } = state
      cursor.noHistory = true
      this.contentState.blocks = blocks
      this.contentState.renderRange = renderRange
      this.contentState.cursor = cursor
      this.contentState.render()
    }
  }

  push(state, isPending = false) {
    if (!isPending) this.pendingIndex = -1 // Prevent instant reset of the pendingIndex
    // But, we should reset it if another event comes in that is not pending.
    this.stack.splice(this.index + 1)
    this.id += 1
    const copyState = { id: this.id, ...deepCopy(state) }
    this.stack.push(copyState)
    if (this.stack.length > UNDO_DEPTH) {
      this.stack.shift()
      this.index = this.index - 1
    }
    this.index += 1

    if (state.cursor.isInit) {
      this.lastInitIndex = this.index
    }

    this.updateFinalEditIndex()
    return this.index
  }

  pushPending(state) {
    if (this.pendingIndex === -1) {
      // No pending state yet
      this.pendingIndex = this.push(state, true)
    } else {
      // Replace the pending state
      const dirtyState = this.stack[this.pendingIndex]
      this.stack[this.pendingIndex] = { ...dirtyState, ...deepCopy(state) }
    }
  }

  commitPending() {
    if (this.pendingIndex !== -1) {
      this.pendingIndex = -1
    }
  }

  clearHistory() {
    this.stack = []
    this.index = -1
    this.pendingIndex = -1
    this.lastEditIndex = -1
  }
}

export default History
