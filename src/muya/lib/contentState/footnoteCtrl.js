/* eslint-disable no-useless-escape */
const FOOTNOTE_REG = /^\[\^([^\^\[\]\s]+?)(?<!\\)\]: /
/* eslint-enable no-useless-escape */
const footnoteCtrl = ContentState => {
  ContentState.prototype.updateFootnote = function (block, line) {
    const { start, end } = this.cursor
    const { text } = line
    const match = FOOTNOTE_REG.exec(text)
    const footnoteIdentifer = match[1]
    const sectionWrapper = this.createBlock('figure', {
      functionType: 'footnote'
    })
    const footnoteInput = this.createBlock('span', {
      text: footnoteIdentifer,
      functionType: 'footnoteInput'
    })
    const pBlock = this.createBlockP(text.substring(match[0].length))
    this.appendChild(sectionWrapper, footnoteInput)
    this.appendChild(sectionWrapper, pBlock)
    this.insertBefore(sectionWrapper, block)
    this.removeBlock(block)

    const { key } = pBlock.children[0]
    this.cursor = {
      start: {
        key,
        offset: Math.max(0, start.offset - footnoteIdentifer.length)
      },
      end: {
        key,
        offset: Math.max(0, end.offset - footnoteIdentifer.length)
      }
    }

    if (this.isCollapse()) {
      this.checkInlineUpdate(pBlock.children[0])
    }

    this.render()
    return sectionWrapper
  }

  ContentState.prototype.createFootnote = function (identifier) {
    const { blocks } = this
    const lastBlock = blocks[blocks.length - 1]
    const newBlock = this.createBlockP(`[^${identifier}]: `)
    this.insertAfter(newBlock, lastBlock)
    const key = newBlock.children[0].key
    const offset = newBlock.children[0].text.length
    this.cursor = {
      start: { key, offset },
      end: { key, offset }
    }
    const sectionWrapper = this.updateFootnote(newBlock, newBlock.children[0])
    const id = sectionWrapper.key
    const footnoteEle = document.querySelector(`#${id}`)
    if (footnoteEle) {
      footnoteEle.scrollIntoView({ behavior: 'smooth' })
    }
  }
}

export default footnoteCtrl
