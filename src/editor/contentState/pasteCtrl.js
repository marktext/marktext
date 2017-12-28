const LIST_REG = /ul|ol/

const pasteCtrl = ContentState => {
  // check paste type: `MERGE` or `NEWLINE`
  ContentState.prototype.checkPasteType = function (start, fragment) {
    const fragmentType = fragment.type
    if (fragmentType === 'p') return 'MERGE'
    if (fragmentType === 'blockquote') return 'NEWLINE'
    let parent = this.getParent(start)
    if (parent && parent.type === 'li') parent = this.getParent(parent)
    let startType = start.type
    if (start.type === 'p') {
      startType = parent ? parent.type : startType
    }
    if (LIST_REG.test(fragmentType) && LIST_REG.test(startType)) {
      return 'MERGE'
    } else {
      return startType === fragmentType ? 'MERGE' : 'NEWLINE'
    }
  }

  ContentState.prototype.pasteHandler = function (event) {
    event.preventDefault()
    const text = event.clipboardData.getData('text/plain')
    let html = event.clipboardData.getData('text/html')
    if (!html) {
      html = text.split(/\n+/)
        .filter(t => t)
        .map(t => `<p>${t}</p>`)
        .join('')
    }
    const stateFragments = this.html2State(html)
    if (stateFragments.length <= 0) return
    // step 1: if select content, cut the content, and chop the block text into two part by the cursor.
    const { start, end } = this.cursor
    const startBlock = this.getBlock(start.key)
    const endBlock = this.getBlock(end.key)
    const cacheText = endBlock.text.substring(end.offset)
    startBlock.text = startBlock.text.substring(0, start.offset)
    if (start.key !== end.key) {
      this.cutHandler()
    }
    // step 2: when insert the fragments, check begin a new block, or insert into pre block.
    const firstFragment = stateFragments[0]
    const tailFragments = stateFragments.slice(1)
    const pasteType = this.checkPasteType(startBlock, firstFragment)
    const getLastBlock = blocks => {
      const len = blocks.length
      const lastBlock = blocks[len - 1]
      if (lastBlock.children.length === 0) {
        return lastBlock
      } else {
        return getLastBlock(lastBlock.children)
      }
    }
    const lastBlock = getLastBlock(stateFragments)
    let key = lastBlock.key
    let offset = lastBlock.text.length
    lastBlock.text += cacheText
    switch (pasteType) {
      case 'MERGE':
        if (LIST_REG.test(firstFragment.type)) {
          const children = firstFragment.children
          const firstChildOfFirstFragment = children[0]
          const liChildren = firstChildOfFirstFragment.children
          const startParent = this.getParent(startBlock)
          const liParent = this.getParent(this.getParent(startBlock))
          if (liChildren[0].type === 'p') {
            startBlock.text += liChildren[0].text
            const tail = liChildren.slice(1)
            if (tail.length) {
              tail.forEach(t => {
                this.appendChild(startParent, t)
              })
            }
            const firstFragmentTail = children.slice(1)
            if (firstFragmentTail.length) {
              firstFragmentTail.forEach(t => {
                this.appendChild(liParent, t)
              })
            }
          } else {
            children.forEach(c => {
              this.appendChild(liParent, c)
            })
          }
          let target = liParent
          tailFragments.forEach(block => {
            this.insertAfter(block, target)
            target = block
          })
        } else {
          startBlock.text += firstFragment.text
          let target = startBlock
          tailFragments.forEach(block => {
            this.insertAfter(block, target)
            target = block
          })
        }
        break
      case 'NEWLINE':
        if (startBlock.text.length === 0) this.removeBlock(startBlock)
        let target = startBlock
        stateFragments.forEach(block => {
          this.insertAfter(block, target)
          target = block
        })
        break
      default:
        throw new Error('unknown paste type')
    }
    // step 3: set cursor and render
    const cursorBlock = this.getBlock(key)
    if (!cursorBlock) {
      key = startBlock.key
      offset = startBlock.text.length - cacheText.length
    }
    this.cursor = {
      start: {
        key, offset
      },
      end: {
        key, offset
      }
    }
    this.render()
  }
}

export default pasteCtrl
