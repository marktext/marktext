import eventCenter from '../event'
import { noop } from '../utils'
import template from './index.tpl.html'
import './index.css'

class TablePicker {
  constructor (eventCenter) {
    this.eventCenter = eventCenter
    this.status = false
    this.checker = {
      row: 10,
      coloum: 6
    }
    this.container = null
    this.cb = noop
    this.init()
    this.handlerHover()
    this.handerClick()
  }
  init () {
    const { eventCenter } = this
    const { row, coloum } = this.checker
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
      for (j = 0; j < coloum; j++) {
        const cell = document.createElement('span')
        cell.classList.add('ag-table-picker-cell')
        cell.setAttribute('data-row', i)
        cell.setAttribute('data-column', j)
        rowContainer.appendChild(cell)
      }
    }
    this.container = container.children[0]
    document.body.appendChild(this.container)

    const handler = event => {
      console.log('dodod')
      this.hide()
    }

    eventCenter.attachDOMEvent(document, 'click', handler)
  }

  hide () {
    this.status = false
    this.container.classList.remove('show')
    this.cb = noop
  }

  toogle ({ row, column }, { left, top }, cb) {
    const { container, status } = this
    if (status) {
      this.hide()
    } else {
      this.cb = cb
      this.setClassName(row, column, 'current')
      Object.assign(container.style, { left, top })
      container.classList.add('show')
      this.status = true
    }
  }

  setClassName (row, coloum, className) {
    let i
    let j
    const rows = document.querySelectorAll('.ag-table-picker-row')
    const cells = document.querySelectorAll('.ag-table-picker-cell')
    for (const c of cells) {
      c.classList.remove(className)
    }
    for (i = 0; i < row + 1; i++) {
      const rowContainer = rows[i]
      for (j = 0; j < coloum + 1; j++) {
        const cell = rowContainer.children[j]
        cell.classList.add(className)
      }
    }
  }
  handlerHover () {
    const { eventCenter } = this
    const checker = document.querySelector('.ag-table-picker .checker')
    const rowInput = document.querySelector('.ag-table-picker .row-input')
    const columnInput = document.querySelector('.ag-table-picker .column-input')
    const hander = event => {
      const target = event.target
      if (target.classList.contains('ag-table-picker-cell')) {
        const row = +target.getAttribute('data-row')
        const coloum = +target.getAttribute('data-column')
        this.setClassName(row, coloum, 'selected')
        rowInput.value = row + 1
        columnInput.value = coloum + 1
      }
    }
    eventCenter.attachDOMEvent(checker, 'mouseover', hander)
  }

  handerClick () {
    const rowInput = document.querySelector('.ag-table-picker .row-input')
    const columnInput = document.querySelector('.ag-table-picker .column-input')
    const tablePicker = document.querySelector('.ag-table-picker')
    const { cb, eventCenter } = this
    const hander = event => {
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
        console.log(row, column)
        cb(row, column)
        this.hide()
      }
    }

    eventCenter.attachDOMEvent(tablePicker, 'click', hander)
  }
}

export default new TablePicker(eventCenter)
