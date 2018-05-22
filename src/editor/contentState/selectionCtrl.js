const selectionCtrl = ContentState => {
  // Returns the table from the table cell:
  //   table <-- thead or tbody <-- tr <-- th or td (cell)
  ContentState.prototype.getTableFromTableCell = function (block) {
    const table = this.getParent(this.getParent(this.getParent(block)))
    if (table && table.type !== 'table') {
      return null
    }
    return table
  }

  ContentState.prototype.tableCellHandler = function (event) {
    const { start, end } = this.cursor
    const startBlock = this.getBlock(start.key)
    const endBlock = this.getBlock(end.key)
    const { type: startType } = startBlock
    const { type: endType } = endBlock
    if (/th|td/.test(startType) && /th|td/.test(endType)) {
      if (start.key === end.key) {
        const { text, key } = startBlock
        this.cursor = {
          start: { key, offset: 0 },
          end: { key, offset: text.length }
        }
      } else {
        const startTable = this.getTableFromTableCell(startBlock)
        const endTable = this.getTableFromTableCell(endBlock)
        // Check whether both blocks are in the same table.
        if (!startTable || !endTable) {
          console.error('No table found or invalid type.')
          return
        } else if (startTable.key !== endTable.key) {
          // Select entire document
          return
        }
        const firstTableCell = this.firstInDescendant(startTable)
        const lastTableCell = this.lastInDescendant(startTable)
        if (!firstTableCell || !/th|td/.test(firstTableCell.type) ||
          !lastTableCell || !/th|td/.test(lastTableCell.type)) {
          console.error('No table cell found or invalid type.')
          return
        }
        const { key: startKey } = firstTableCell
        const { key: endKey, text } = lastTableCell
        this.cursor = {
          start: { key: startKey, offset: 0 },
          end: { key: endKey, offset: text.length }
        }
      }

      event.preventDefault()
      event.stopPropagation()
      this.partialRender()
    }
  }
}

export default selectionCtrl
