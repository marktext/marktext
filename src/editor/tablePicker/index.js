import { noop } from '../utils'
import template from './index.tpl.html'
import './index.css'

class TablePicker {
  constructor (eventCenter) {
    this.eventCenter = eventCenter
    this.status = false
    this.checkerCount = {
      row: 10,
      column: 6
    }
    this.container = null
    this.cb = noop
    this.init()
    this.handlerHover()
    this.handerClick()
  }

  init () {
    const { eventCenter } = this
    const { row, column } = this.checkerCount
    const container = document.createElement('div')
    container.innerHTML = template
    const checker = container.querySelector('.checker')
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
    this.container = container.children[0]
    document.body.appendChild(this.container)

    const rowInput = document.querySelector('.ag-table-picker .row-input')
    const columnInput = document.querySelector('.ag-table-picker .column-input')
    Object.assign(this, { rowInput, columnInput, checker })

    const handler = event => {
      this.hide()
    }

    eventCenter.attachDOMEvent(document, 'click', handler)
  }

  hide () {
    this.status = false
    this.container.classList.remove('show')
    this.cb = noop
  }

  toggle ({ row, column }, { left, top }, cb) {
    const { container, status, rowInput, columnInput } = this
    if (status) {
      this.hide()
    } else {
      this.cb = cb
      this.setClassName(-1, -1, 'selected')
      this.setClassName(row, column, 'current')
      rowInput.value = row + 1
      columnInput.value = column + 1
      Object.assign(container.style, { left, top })
      container.classList.add('show')
      this.status = true
    }
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
    const { eventCenter, checker, rowInput, columnInput } = this
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
    const { rowInput, columnInput, container, eventCenter } = this

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

  destroy () {
    this.container.parentNode.removeChild(this.container)
  }
}

export default TablePicker
