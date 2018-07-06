import { deepCopy } from '../utils'
import { UNDO_DEPTH } from '../config'

export class History {
  constructor (contentState) {
    this.stack = []
    this.index = -1
    this.contentState = contentState
  }

  undo () {
    if (this.index > 0) {
      this.index = this.index - 1

      const state = deepCopy(this.stack[this.index])
      switch (state.type) {
        case 'normal':
          const { blocks, cursor, renderRange } = state
          cursor.noHistory = true
          this.contentState.blocks = blocks
          this.contentState.renderRange = renderRange
          this.contentState.cursor = cursor
          this.contentState.render()
          break
        case 'codeBlock':
          const id = state.id
          const codeBlock = this.contentState.codeBlocks.get(id)
          codeBlock.focus()
          codeBlock.undo()
          break
      }
    }
  }

  redo () {
    const { index, stack } = this
    const len = stack.length
    if (index < len - 1) {
      this.index = index + 1
      const state = deepCopy(stack[this.index])
      switch (state.type) {
        case 'normal':
          const { blocks, cursor, renderRange } = state
          cursor.noHistory = true
          this.contentState.blocks = blocks
          this.contentState.renderRange = renderRange
          this.contentState.cursor = cursor
          this.contentState.render()
          break
        case 'codeBlock':
          const id = state.id
          const codeBlock = this.contentState.codeBlocks.get(id)
          codeBlock.focus()
          codeBlock.redo()
          break
      }
    }
  }

  push (state) {
    this.stack.splice(this.index + 1)
    const copyState = deepCopy(state)
    this.stack.push(copyState)
    if (this.stack.length > UNDO_DEPTH) {
      this.stack.shift()
      this.index = this.index - 1
    }
    this.index = this.index + 1
  }

  clearHistory () {
    this.stack = []
    this.index = -1
  }
}

export default History
