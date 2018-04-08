import selection from '../selection'

const tabCtrl = ContentState => {
  ContentState.prototype.findNextCell = function (block) {
    if (!(/td|th/.test(block.type))) throw new Error('only th and td can have next cell')
    const nextSibling = this.getBlock(block.nextSibling)
    const parent = this.getBlock(block.parent)
    const tbOrTh = this.getBlock(parent.parent)
    if (nextSibling) {
      return nextSibling
    } else {
      if (parent.nextSibling) {
        const nextRow = this.getBlock(parent.nextSibling)
        return nextRow.children[0]
      } else if (tbOrTh.type === 'thead') {
        const tBody = this.getBlock(tbOrTh.nextSibling)
        if (tBody.children.length) {
          return tBody.children[0].children[0]
        }
      }
    }
    return false
  }

  ContentState.prototype.isIndentableListItem = function () {
    const { start, end } = this.cursor
    const startBlock = this.getBlock(start.key)
    if (startBlock.type !== 'p' || !startBlock.parent) {
      return false
    }

    const listItem = this.getParent(startBlock)
    if (listItem.type !== 'li' || start.key !== end.key || start.offset !== end.offset) {
      return false
    }

    // Now we know it's a list item. Check whether we can indent the list item.
    const list = this.getParent(listItem)
    return list && /ol|ul/.test(list.type) && list.children.indexOf(listItem) >= 1
  }

  ContentState.prototype.indentListItem = function () {
    const { start } = this.cursor
    const startBlock = this.getBlock(start.key)
    const listItem = this.getParent(startBlock)
    const list = this.getParent(listItem)
    const prevListItem = this.getPreSibling(listItem)

    this.removeBlock(listItem)

    // Search for a list in previous block
    let newList = this.getLastChild(prevListItem)
    if (!newList || !/ol|ul/.test(newList.type)) {
      newList = this.createBlock(list.type)
      this.appendChild(prevListItem, newList)
    }

    // Update item type only if we insert into an existing list
    if (newList.children.length !== 0) {
      listItem.isLooseListItem = newList.children[0].isLooseListItem
    }

    this.appendChild(newList, listItem)
    this.render()
  }

  // ContentState.prototype.insertTab = function () {
  //   // TODO(fxha): Tabs and all spaces with length > 1 are converted to a single space
  //                  in editor mode. Maybe write a HTML "tab" element
  //   // TODO(fxha): create setting entry "tabSize: <int>"
  //   const tabCharacter = new Array(4).join(' ')
  //   const { start, end } = this.cursor
  //   const startBlock = this.getBlock(start.key)
  //   const endBlock = this.getBlock(end.key)
  //   if (this.cursor.start.key === this.cursor.end.key) {
  //     startBlock.text = startBlock.text.substring(0, start.offset) + tabCharacter + endBlock.text.substring(end.offset)
  //     // workaround: see todo 1
  //     this.cursor.start.offset += 1 // tabCharacter.length
  //     this.cursor.end.offset += 1 // tabCharacter.length
  //     this.render()
  //   }
  // }

  ContentState.prototype.tabHandler = function (event) {
    // disable tab focus
    event.preventDefault()

    const { start, end } = selection.getCursorRange()
    const startBlock = this.getBlock(start.key)
    const endBlock = this.getBlock(end.key)
    let nextCell
    if (start.key === end.key && /th|td/.test(startBlock.type)) {
      nextCell = this.findNextCell(startBlock)
    } else if (/th|td/.test(endBlock.type)) {
      nextCell = endBlock
    }
    if (nextCell) {
      const key = nextCell.key
      const textLength = nextCell.text.length
      this.cursor = {
        start: { key, offset: 0 },
        end: { key, offset: textLength }
      }
      this.render()
    } else if (this.isIndentableListItem()) {
      this.indentListItem()
    } // else {
    //   this.insertTab()
    // }
  }
}

export default tabCtrl
