import BaseFloat from '../baseFloat'
import template from './index.tpl.html'
// import tableIcon from '../../assets/icons/table'
import './index.css'

class TablePicker extends BaseFloat {
  constructor (muya) {
    const name = 'ag-table-picker'
    super(muya, name)
    this.checkerCount = {
      row: 6,
      column: 8
    }
    this.render()
    this.listen()
  }

  listen () {
    const { eventCenter } = this.muya
    super.listen()
    this.handlerHover()
    this.handerClick()
    eventCenter.subscribe('muya-table-picker', (data, reference, cb) => {
      if (!this.status) {
        this.show(data, reference, cb)
      } else {
        this.hide()
      }
    })
  }

  render () {
    const { row, column } = this.checkerCount
    this.container.innerHTML += template
    const checker = this.container.querySelector('.checker')
    let i
    let j

    for (i = 0; i < row; i++) {
      const rowContainer = document.createElement('div')
      rowContainer.classList.add('ag-table-picker-row')
      if (i === 0) rowContainer.classList.add('ag-table-picker-header')
      checker.appendChild(rowContainer)
      for (j = 0; j < column; j++) {
        const cell = document.createElement('span')
        cell.classList.add('ag-table-picker-cell')
        cell.setAttribute('data-row', i)
        cell.setAttribute('data-column', j)
        rowContainer.appendChild(cell)
      }
    }

    const rowInput = this.container.querySelector('.ag-table-picker .row-input')
    const columnInput = this.container.querySelector('.ag-table-picker .column-input')
    Object.assign(this, { rowInput, columnInput, checker })
  }

  show ({ row, column }, reference, cb) {
    const { rowInput, columnInput } = this
    this.setClassName(-1, -1, 'selected')
    this.setClassName(row, column, 'current')
    rowInput.value = row + 1
    columnInput.value = column + 1
    super.show(reference, cb)
  }

  setClassName (rawRow, rawColumn, className) {
    const { row: MaxRow, column: MaxColumn } = this.checkerCount // not zero base
    const row = Math.min(rawRow, MaxRow - 1)
    const column = Math.min(rawColumn, MaxColumn - 1)

    let i
    let j
    const rows = document.querySelectorAll('.ag-table-picker-row')
    const cells = document.querySelectorAll('.ag-table-picker-cell')
    for (const c of cells) {
      c.classList.remove(className)
    }
    for (i = 0; i < row + 1; i++) {
      const rowContainer = rows[i]
      for (j = 0; j < column + 1; j++) {
        const cell = rowContainer.children[j]
        cell.classList.add(className)
      }
    }
  }

  handlerHover () {
    const { checker, rowInput, columnInput } = this
    const { eventCenter } = this.muya
    const hander = event => {
      const target = event.target
      if (target.classList.contains('ag-table-picker-cell')) {
        const row = +target.getAttribute('data-row')
        const column = +target.getAttribute('data-column')
        this.setClassName(row, column, 'selected')
        rowInput.value = row + 1
        columnInput.value = column + 1
      }
    }
    eventCenter.attachDOMEvent(checker, 'mouseover', hander)
  }

  handerClick () {
    const { rowInput, columnInput, container } = this
    const { eventCenter } = this.muya

    const hander = event => {
      const { cb } = this
      let row
      let column
      event.preventDefault()
      event.stopPropagation()
      const target = event.target
      if (target.tagName === 'BUTTON') {
        row = rowInput.value - 1
        column = columnInput.value - 1
      } else if (target.classList.contains('ag-table-picker-cell')) {
        row = +target.getAttribute('data-row')
        column = +target.getAttribute('data-column')
      }
      if (target.tagName === 'BUTTON' || target.classList.contains('ag-table-picker-cell')) {
        row = Math.max(row, 1)
        column = Math.max(column, 1)
        cb(row, column)
        this.hide()
      }
    }

    eventCenter.attachDOMEvent(container, 'click', hander)
  }
}

export default TablePicker
