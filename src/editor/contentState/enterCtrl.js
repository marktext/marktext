import selection from '../selection'
import { findNearestParagraph } from '../utils/domManipulate'
import floatBox from '../floatBox'

const enterCtrl = ContentState => {
  ContentState.prototype.chopBlock = function (block) {
    const parent = this.getParent(block)
    const type = parent.type
    const container = this.createBlock(type)
    const index = this.findIndex(parent.children, block)
    const partChildren = parent.children.splice(index + 1)
    block.nextSibling = null
    partChildren.forEach(b => this.appendChild(container, b))
    this.insertAfter(container, parent)
  }

  ContentState.prototype.createBlockLi = function (text = '') {
    const liBlock = this.createBlock('li')
    const pBlock = this.createBlock('p', text)
    this.appendChild(liBlock, pBlock)
    return liBlock
  }

  ContentState.prototype.enterHandler = function (event) {
    const node = selection.getSelectionStart()
    let paragraph = findNearestParagraph(node)
    let block = this.getBlock(paragraph.id)
    let parent = this.getParent(block)
    // handle float box
    const { list, index, show } = floatBox
    if (show) {
      event.preventDefault()
      return floatBox.cb(list[index])
    }
    if (block.type === 'pre') {
      return
    }
    event.preventDefault()
    if (parent && parent.type === 'li' && this.isOnlyChild(block)) {
      console.log(JSON.stringify(block, null, 2))
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

        if (/^h/.test(type)) {
          const PREFIX = /^#+/.exec(pre)[0]
          post = `${PREFIX}${post}`
        }

        if (type === 'li') {
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
        } else if (parent.type === 'li') {
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
    this.cursor = {
      key: cursorBlock.type === 'li' ? cursorBlock.children[0].key : cursorBlock.key,
      range: {
        start: 0,
        end: 0
      }
    }
    this.render()
  }
}

export default enterCtrl
