import { deepCopy } from '../utils'

export class History {
  constructor (contentState) {
    this.stack = []
    this.index = -1
    this.contentState = contentState
  }
  undo () {
    console.log(this.index)
    if (this.index > -1) {
      const state = this.stack[this.index]
      switch (state.type) {
        case 'normal':
          this.contentState.blocks = state.blocks
          this.contentState.cursor = state.cursor
          this.contentState.render()
          break
        case 'codeBlock':
          state.cmHistory.undo()
          break
      }
      this.index = this.index - 1
    }
  }
  redo () {

  }
  push (state) {
    this.stack.splice(this.index + 1)
    this.stack.push(deepCopy(state))
    this.index = this.index + 1
    console.log(this.index)
    console.log(this.stack)
  }
}

export default History
