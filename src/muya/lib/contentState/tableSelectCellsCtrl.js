import { getAllTableCells, getIndex } from './tableDragBarCtrl'

const tableSelectCellsCtrl = ContentState => {
  ContentState.prototype.handleCellMouseDown = function (event) {
    if (event.buttons === 2) {
      // the contextmenu is emit.
      return
    }
    const { eventCenter } = this.muya
    const { target } = event
    const cell = target.closest('th') || target.closest('td')
    const tableId = target.closest('table').id
    const row = getIndex('left', cell)
    const column = getIndex('bottom', cell)
    this.cellSelectInfo = {
      tableId,
      anchor: {
        key: cell.id,
        row,
        column
      },
      focus: null,
      isStartSelect: false,
      cells: getAllTableCells(tableId),
      selectedCells: []
    }

    const mouseMoveId = eventCenter.attachDOMEvent(document.body, 'mousemove', this.handleCellMouseMove.bind(this))
    const mouseUpId = eventCenter.attachDOMEvent(document.body, 'mouseup', this.handleCellMouseUp.bind(this))
    this.cellSelectEventIds.push(mouseMoveId, mouseUpId)
  }

  ContentState.prototype.handleCellMouseMove = function (event) {
    const { target } = event
    const cell = target.closest('th') || target.closest('td')
    const table = target.closest('table')
    const isOverSameTableCell = cell && table && table.id === this.cellSelectInfo.tableId
    if (isOverSameTableCell && cell.id !== this.cellSelectInfo.anchor.key) {
      this.cellSelectInfo.isStartSelect = true
      this.muya.blur(true)
    }
    if (isOverSameTableCell && this.cellSelectInfo.isStartSelect) {
      const row = getIndex('left', cell)
      const column = getIndex('bottom', cell)
      this.cellSelectInfo.focus = {
        key: cell.key,
        row,
        column
      }
    } else {
      this.cellSelectInfo.focus = null
    }

    this.calculateSelectedCells()
    this.setSelectedCellsStyle()
  }

  ContentState.prototype.handleCellMouseUp = function (event) {
    const { eventCenter } = this.muya
    for (const id of this.cellSelectEventIds) {
      eventCenter.detachDOMEvent(id)
    }
    this.cellSelectEventIds = []
    if (this.cellSelectInfo && this.cellSelectInfo.isStartSelect) {
      event.preventDefault()
      const { tableId, selectedCells, anchor, focus } = this.cellSelectInfo
      // Mouse up outside table, the focus is null
      if (!focus) {
        return
      }
      // We need to handle this after click event, because click event is emited after mouseup(mouseup will be followed by a click envent), but we set
      // the `selectedTableCells` to null when click event emited.
      setTimeout(() => {
        this.selectedTableCells = {
          tableId,
          row: Math.abs(anchor.row - focus.row) + 1, // 1 base
          column: Math.abs(anchor.column - focus.column) + 1, // 1 base
          cells: selectedCells.map(c => {
            delete c.ele
            return c
          })
        }
        this.cellSelectInfo = null
        const table = this.getBlock(tableId)
        return this.singleRender(table, false)
      })
    }
  }

  ContentState.prototype.calculateSelectedCells = function () {
    const { anchor, focus, cells } = this.cellSelectInfo
    this.cellSelectInfo.selectedCells = []
    if (focus) {
      const startRowIndex = Math.min(anchor.row, focus.row)
      const endRowIndex = Math.max(anchor.row, focus.row)
      const startColIndex = Math.min(anchor.column, focus.column)
      const endColIndex = Math.max(anchor.column, focus.column)
      let i
      let j
      for (i = startRowIndex; i <= endRowIndex; i++) {
        const row = cells[i]
        for (j = startColIndex; j <= endColIndex; j++) {
          const cell = row[j]
          const cellBlock = this.getBlock(cell.id)
          this.cellSelectInfo.selectedCells.push({
            ele: cell,
            key: cell.id,
            text: cellBlock.children[0].text,
            align: cellBlock.align,
            top: i === startRowIndex,
            right: j === endColIndex,
            bottom: i === endRowIndex,
            left: j === startColIndex
          })
        }
      }
    }
  }

  ContentState.prototype.setSelectedCellsStyle = function () {
    const { selectedCells, cells } = this.cellSelectInfo
    for (const row of cells) {
      for (const cell of row) {
        cell.classList.remove('ag-cell-selected')
        cell.classList.remove('ag-cell-border-top')
        cell.classList.remove('ag-cell-border-right')
        cell.classList.remove('ag-cell-border-bottom')
        cell.classList.remove('ag-cell-border-left')
      }
    }

    for (const cell of selectedCells) {
      const { ele, top, right, bottom, left } = cell
      ele.classList.add('ag-cell-selected')
      if (top) {
        ele.classList.add('ag-cell-border-top')
      }
      if (right) {
        ele.classList.add('ag-cell-border-right')
      }
      if (bottom) {
        ele.classList.add('ag-cell-border-bottom')
      }
      if (left) {
        ele.classList.add('ag-cell-border-left')
      }
    }
  }

  // Remove the content of selected table cell, delete the row/column if selected one row/column without content.
  // Delete the table if the selected whole table is empty.
  ContentState.prototype.deleteSelectedTableCells = function (isCut = false) {
    const { tableId, cells } = this.selectedTableCells
    const tableBlock = this.getBlock(tableId)
    const { row, column } = tableBlock
    const rows = new Set()
    let lastColumn = null
    let isSameColumn = true
    let hasContent = false
    for (const cell of cells) {
      const cellBlock = this.getBlock(cell.key)
      const rowBlock = this.getParent(cellBlock)
      const { column: cellColumn } = cellBlock
      rows.add(rowBlock)
      if (cellBlock.children[0].text) {
        hasContent = true
      }
      if (typeof lastColumn === 'object') {
        lastColumn = cellColumn
      } else if (cellColumn !== lastColumn) {
        isSameColumn = false
      }
      cellBlock.children[0].text = ''
    }

    const isOneColumnSelected = rows.size === +row + 1 && isSameColumn
    const isOneRowSelected = cells.length === +column + 1 && rows.size === 1
    const isWholeTableSelected = rows.size === +row + 1 && cells.length === (+row + 1) * (+column + 1)

    if (isCut && isWholeTableSelected) {
      this.selectedTableCells = null
      return this.deleteParagraph(tableId)
    }

    if (hasContent) {
      this.singleRender(tableBlock, false)

      return this.muya.dispatchChange()
    } else {
      const cellKey = cells[0].key
      const cellBlock = this.getBlock(cellKey)
      const cellContentKey = cellBlock.children[0].key
      this.selectedTableCells = null
      if (isOneColumnSelected) {
        // Remove one empty column
        return this.editTable({
          location: 'current',
          action: 'remove',
          target: 'column'
        }, cellContentKey)
      } else if (isOneRowSelected) {
        // Remove one empty row
        return this.editTable({
          location: 'current',
          action: 'remove',
          target: 'row'
        }, cellContentKey)
      } else if (isWholeTableSelected) {
        // Select whole empty table
        return this.deleteParagraph(tableId)
      }
    }
  }

  ContentState.prototype.selectTable = function (table) {
    // For calculateSelectedCells
    this.cellSelectInfo = {
      anchor: {
        row: 0,
        column: 0
      },
      focus: {
        row: table.row,
        column: table.column
      },
      cells: getAllTableCells(table.key)
    }
    this.calculateSelectedCells()
    this.selectedTableCells = {
      tableId: table.key,
      row: table.row + 1,
      column: table.column + 1,
      cells: this.cellSelectInfo.selectedCells.map(c => {
        delete c.ele
        return c
      })
    }
    // reset cellSelectInfo
    this.cellSelectInfo = null
    this.muya.blur()
    return this.singleRender(table, false)
  }

  // Return the cell block if yes, else return null.
  ContentState.prototype.isSingleCellSelected = function () {
    const { selectedTableCells } = this
    if (selectedTableCells && selectedTableCells.cells.length === 1) {
      const key = selectedTableCells.cells[0].key
      return this.getBlock(key)
    }

    return null
  }

  // Return the cell block if yes, else return null.
  ContentState.prototype.isWholeTableSelected = function () {
    const { selectedTableCells } = this
    const table = selectedTableCells ? this.getBlock(selectedTableCells.tableId) : {}
    const { row, column } = table
    if (selectedTableCells && table && selectedTableCells.cells.length === (+row + 1) * (+column + 1)) {
      return table
    }

    return null
  }
}

export default tableSelectCellsCtrl
