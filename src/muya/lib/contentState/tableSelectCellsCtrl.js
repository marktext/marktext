import { getAllTableCells, getIndex } from './tableDragBarCtrl'

const tableSelectCellsCtrl = ContentState => {
  ContentState.prototype.handleCellMouseDown = function (event) {
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
      this.muya.blur()
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
      const { tableId, selectedCells } = this.cellSelectInfo
      setTimeout(() => {
        this.selectedTableCells = {
          tableId,
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
          this.cellSelectInfo.selectedCells.push({
            ele: cell,
            key: cell.id,
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
}

export default tableSelectCellsCtrl
