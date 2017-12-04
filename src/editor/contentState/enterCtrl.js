import selection from '../selection'
import { findNearestParagraph } from '../utils/domManipulate'
import { newABlock } from './index'

const enterCtrl = ContentState => {
  ContentState.prototype.chopBlockQuote = function (block) {
    const blockQuote = newABlock(this.keys, null, null, null, '', block.depth - 1, 'blockquote')
    const parent = this.getParent(block)
    const index = this.findIndex(parent.children, block)
    const blocks = parent.children.splice(index + 1)
    block.nextSibling = null
    blocks.forEach(block => this.appendChild(blockQuote, block))
    this.insertAfter(blockQuote, parent)
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
    const parent = this.getParent(block)
    if (parent && parent.type === 'li' && !block.preSibling) {
      block = parent
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
        if (parent.type === 'blockquote') {
          newBlock = newABlock(this.keys, null, null, null, '', block.depth - 1, 'p')

          if (this.isOnlyChild(block)) {
            this.insertAfter(newBlock, parent)
            this.removeBlock(parent)
          } else if (this.isFirstChild(block)) {
            this.insertBefore(newBlock, parent)
          } else if (this.isLastChild(block)) {
            this.insertAfter(newBlock, parent)
          } else {
            this.chopBlockQuote(block)
            this.insertAfter(newBlock, parent)
          }

          this.removeBlock(block)
        }
        if (this.isFirstChild(block) && preType === 'li') {
          console.log(1)
          const liBlock = this.createBlockLi('', block.depth)
          this.insertAfter(liBlock, block)
          newBlock = liBlock.children[0]
        } else if (parent.type === 'li') {
          console.log(block)
          console.log('2')
          const liBlock = this.createBlockLi('', block.depth - 1)
          this.insertAfter(liBlock, parent)
          this.removeBlock(block)
          newBlock = liBlock.children[0]
        } else {
          console.log('x')
          newBlock = newABlock(this.keys, null, null, null, '', block.depth, 'p')
          if (preType === 'li') {
            this.insertAfter(newBlock, parent)
            newBlock.depth = parent.depth
            this.removeBlock(block)
          } else {
            this.insertAfter(newBlock, block)
          }
        }
        break
    }
    this.cursor = {
      key: newBlock.key,
      range: {
        start: 0,
        end: 0
      }
    }
    this.render()
  }
}

export default enterCtrl
