import selection from '../selection'
import { findNearestParagraph } from '../utils/domManipulate'
import { newABlock } from './index'

const enterCtrl = ContentState => {
  ContentState.prototype.chopBlock = function (block) {
    const parent = this.getParent(block)
    const type = parent.type
    const container = newABlock(this.keys, null, null, null, '', block.depth - 1, type)
    const index = this.findIndex(parent.children, block)
    const partChildren = parent.children.splice(index + 1)
    block.nextSibling = null
    partChildren.forEach(b => this.appendChild(container, b))
    this.insertAfter(container, parent)
  }

  ContentState.prototype.createBlockLi = function (text, depth) {
    const liBlock = newABlock(this.keys, null, null, null, '', depth, 'li')
    const pBlock = newABlock(this.keys, liBlock.key, null, null, text, depth + 1, 'p')
    this.appendChild(liBlock, pBlock)
    return liBlock
  }

  ContentState.prototype.enterHandler = function () {
    const node = selection.getSelectionStart()
    let paragraph = findNearestParagraph(node)
    let block = this.getBlock(paragraph.id)
    let parent = this.getParent(block)
    if (parent && parent.type === 'li' && !block.preSibling) {
      block = parent
      parent = this.getParent(block)
    }
    const { left, right } = selection.getCaretOffsets(paragraph)
    const preType = block.type

    let type
    let newBlock
    switch (true) {
      case left !== 0 && right !== 0:
        type = preType
        let { pre, post } = selection.chopHtmlByCursor(paragraph)

        if (/^h/.test(type)) {
          const PREFIX = /^#+/.exec(pre)[0]
          post = `${PREFIX}${post}`
        }

        if (type === 'li') {
          const liBlock = newABlock(this.keys, block.parent, block.key, null, '', block.depth, 'li')
          newBlock = newABlock(this.keys, newBlock.key, null, null, post, newBlock.depth + 1, 'p')
          liBlock.children = [ newBlock ]
          block.children[0].text = pre
        } else {
          block.text = pre
          newBlock = newABlock(this.keys, block.parent, block.key, null, post, block.depth, type)
        }
        this.insertAfter(newBlock, block)
        break
      case left === 0 && right === 0: // paragraph is empty
        if (parent.type === 'blockquote' || parent.type === 'ul') {
          newBlock = newABlock(this.keys, null, null, null, '', block.depth - 1, 'p')

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
          newBlock = this.createBlockLi('', block.depth - 1)
          this.insertAfter(newBlock, parent)
          const index = this.findIndex(parent.children, block)
          const partChildren = parent.children.splice(index + 1)
          partChildren.forEach(b => this.appendChild(newBlock, b))

          this.removeBlock(block)
        } else {
          newBlock = newABlock(this.keys, null, null, null, '', block.depth, 'p')
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
          ? this.createBlockLi('', block.depth)
          : newABlock(this.keys, null, null, null, '', block.depth, 'p')
        if (left === 0 && right !== 0) {
          this.insertBefore(newBlock, block)
        } else {
          this.insertAfter(newBlock, block)
        }
        break
      default:
        newBlock = newABlock(this.keys, null, null, null, '', block.depth, 'p')
        this.insertAfter(newBlock, block)
        break
    }
    this.cursor = {
      key: newBlock.type === 'li' ? newBlock.children[0].key : newBlock.key,
      range: {
        start: 0,
        end: 0
      }
    }
    this.render()
  }
}

export default enterCtrl
