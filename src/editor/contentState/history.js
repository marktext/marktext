import { deepCopy } from '../utils'

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
          this.contentState.blocks = state.blocks
          this.contentState.cursor = state.cursor
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
          this.contentState.blocks = state.blocks
          this.contentState.cursor = state.cursor
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
    const UNDO_DEPTH = 20
    this.stack.splice(this.index + 1)
    this.stack.push(deepCopy(state))
    if (this.stack.length > UNDO_DEPTH) {
      this.stack.shift()
      this.index = this.index - 1
    }
    this.index = this.index + 1
  }
}

export default History
