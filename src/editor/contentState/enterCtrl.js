import selection from '../selection'
import floatBox from '../floatBox'
import { getUniqueId } from '../utils'

const enterCtrl = ContentState => {
  // ContentState.prototype.preBlockChangeKey = function (block) {
  //   if (block.type === 'pre') block.key = getUniqueId(this.keys)
  //   if (block.children.length) block.children.forEach(child => this.preBlockChangeKey(child))
  // }

  ContentState.prototype.chopBlock = function (block) {
    const parent = this.getParent(block)
    const type = parent.type
    const container = this.createBlock(type)
    const index = this.findIndex(parent.children, block)
    const partChildren = parent.children.splice(index + 1)
    block.nextSibling = null
    partChildren.forEach(b => {
      // this.preBlockChangeKey(b)
      this.appendChild(container, b)
    })
    this.insertAfter(container, parent)
  }

  ContentState.prototype.createBlockLi = function (text = '') {
    const liBlock = this.createBlock('li')
    const pBlock = this.createBlock('p', text)
    this.appendChild(liBlock, pBlock)
    return liBlock
  }

  ContentState.prototype.enterHandler = function (event) {
    const { start, end } = this.cursor

    if (start.key !== end.key) {
      event.preventDefault()
      const startBlock = this.getBlock(start.key)
      const endBlock = this.getBlock(end.key)
      const key = start.key
      const offset = start.offset
      console.log(endBlock.text)
      startBlock.text = startBlock.text.substring(0, start.offset) + endBlock.text.substring(end.offset)

      this.removeBlocks(startBlock, endBlock)
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }
      this.render()
      return this.enterHandler(event)
    }

    if (start.key === end.key && start.offset !== end.offset) {
      event.preventDefault()
      const key = start.key
      const offset = start.offset
      const block = this.getBlock(key)
      block.text = block.text.substring(0, start.offset) + block.text.substring(end.offset)
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }
      this.render()
      return this.enterHandler(event)
    }

    let paragraph = document.querySelector(`#${start.key}`)
    let block = this.getBlock(start.key)
    let parent = this.getParent(block)
    // handle float box
    const { list, index, show } = floatBox
    if (show) {
      event.preventDefault()
      floatBox.cb(list[index])
      const isUpdated = this.codeBlockUpdate(block)
      isUpdated && this.render()
      return
    }
    if (block.type === 'pre') {
      return
    }
    event.preventDefault()
    if (parent && parent.type === 'li' && this.isOnlyChild(block)) {
      block = parent
      parent = this.getParent(block)
    }
    const { left, right } = selection.getCaretOffsets(paragraph)
    const preType = block.type

    let type
    let newBlock
    switch (true) {
      case left !== 0 && right !== 0: // cursor in the middle
        type = preType
        let { pre, post } = selection.chopHtmlByCursor(paragraph)

        if (/^h\d/.test(type)) {
          const PREFIX = /^#+/.exec(pre)[0]
          post = `${PREFIX}${post}`
        }

        if (type === 'li') {
          block.children[0].text = pre
          newBlock = this.createBlockLi(post)
        } else {
          block.text = pre
          newBlock = this.createBlock(type, post)
        }
        this.insertAfter(newBlock, block)
        break
      case left === 0 && right === 0: // paragraph is empty
        if (parent && (parent.type === 'blockquote' || parent.type === 'ul')) {
          newBlock = this.createBlock('p')

          if (this.isOnlyChild(block)) {
            this.insertAfter(newBlock, parent)
            this.removeBlock(parent)
          } else if (this.isFirstChild(block)) {
            this.insertBefore(newBlock, parent)
          } else if (this.isLastChild(block)) {
            this.insertAfter(newBlock, parent)
          } else {
            this.chopBlock(block)
            this.insertAfter(newBlock, parent)
          }

          this.removeBlock(block)
        } else if (parent && parent.type === 'li') {
          newBlock = this.createBlockLi()
          this.insertAfter(newBlock, parent)
          const index = this.findIndex(parent.children, block)
          const partChildren = parent.children.splice(index + 1)
          partChildren.forEach(b => this.appendChild(newBlock, b))

          this.removeBlock(block)
        } else {
          newBlock = this.createBlock('p')
          if (preType === 'li') {
            const parent = this.getParent(block)
            this.insertAfter(newBlock, parent)
            newBlock.depth = parent.depth
            this.removeBlock(block)
          } else {
            this.insertAfter(newBlock, block)
          }
        }
        break
      case left !== 0 && right === 0: // cursor at end of paragraph
      case left === 0 && right !== 0: // cursor at begin of paragraph
        if (preType === 'li') type = 'li'
        else type = 'p' // insert after or before
        newBlock = type === 'li'
          ? this.createBlockLi()
          : this.createBlock('p')
        if (left === 0 && right !== 0) {
          this.insertBefore(newBlock, block)
          newBlock = block
        } else {
          this.insertAfter(newBlock, block)
        }
        break
      default:
        newBlock = this.createBlock('p')
        this.insertAfter(newBlock, block)
        break
    }

    this.codeBlockUpdate(newBlock.type === 'li' ? newBlock.children[0] : newBlock)
    // If block is pre block when updated, need to focus it.
    const blockNeedFocus = this.codeBlockUpdate(block.type === 'li' ? block.children[0] : block)
    const cursorBlock = blockNeedFocus ? block : newBlock
    const key = cursorBlock.type === 'li' ? cursorBlock.children[0].key : cursorBlock.key
    const offset = 0
    this.cursor = {
      start: { key, offset },
      end: { key, offset }
    }
    this.render()
  }
}

export default enterCtrl
