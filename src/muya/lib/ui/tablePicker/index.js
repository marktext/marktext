import BaseFloat from '../baseFloat'
import { patch, h } from '../../parser/render/snabbdom'
import './index.css'
import { EVENT_KEYS } from '../../config'

class TablePicker extends BaseFloat {
  static pluginName = 'tablePicker'

  constructor (muya) {
    const name = 'ag-table-picker'
    super(muya, name)
    this.checkerCount = {
      row: 6,
      column: 8
    }
    this.oldVnode = null
    this.current = null
    this.select = null
    const tableContainer = this.tableContainer = document.createElement('div')
    this.container.appendChild(tableContainer)
    this.listen()
  }

  listen () {
    const { eventCenter } = this.muya
    super.listen()
    eventCenter.subscribe('muya-table-picker', (data, reference, cb) => {
      if (!this.status) {
        this.show(data, reference, cb)
        this.render()
      } else {
        this.hide()
      }
    })
  }

  render () {
    const { row, column } = this.checkerCount
    const { row: cRow, column: cColumn } = this.current
    const { row: sRow, column: sColumn } = this.select
    const { tableContainer, oldVnode } = this
    const tableRows = []
    let i
    let j
    for (i = 0; i < row; i++) {
      let rowSelector = 'div.ag-table-picker-row'
      const cells = []
      for (j = 0; j < column; j++) {
        let cellSelector = 'span.ag-table-picker-cell'
        if (i <= cRow && j <= cColumn) {
          cellSelector += '.current'
        }
        if (i <= sRow && j <= sColumn) {
          cellSelector += '.selected'
        }
        cells.push(h(cellSelector, {
          key: j.toString(),
          dataset: {
            row: i.toString(),
            column: j.toString()
          },
          on: {
            mouseenter: event => {
              const { target } = event
              const r = target.getAttribute('data-row')
              const c = target.getAttribute('data-column')
              this.select = { row: r, column: c }
              this.render()
            },
            click: _ => {
              this.selectItem()
            }
          }
        }))
      }

      tableRows.push(h(rowSelector, cells))
    }

    const tableFooter = h('div.footer', [
      h('input.row-input', {
        props: {
          type: 'text',
          value: +this.select.row + 1
        },
        on: {
          keyup: event => {
            this.keyupHandler(event, 'row')
          }
        }
      }),
      'x',
      h('input.column-input', {
        props: {
          type: 'text',
          value: +this.select.column + 1
        },
        on: {
          keyup: event => {
            this.keyupHandler(event, 'column')
          }
        }
      }),
      h('button', {
        on: {
          click: _ => {
            this.selectItem()
          }
        }
      }, 'OK')
    ])

    const vnode = h('div', [h('div.checker', tableRows), tableFooter])

    if (oldVnode) {
      patch(oldVnode, vnode)
    } else {
      patch(tableContainer, vnode)
    }
    this.oldVnode = vnode
  }

  keyupHandler (event, type) {
    let number = +this.select[type]
    const value = +event.target.value
    if (event.key === EVENT_KEYS.ArrowUp) {
      number++
    } else if (event.key === EVENT_KEYS.ArrowDown) {
      number--
    } else if (event.key === EVENT_KEYS.Enter) {
      this.selectItem()
    } else if (typeof value === 'number') {
      number = value - 1
    }
    if (number !== +this.select[type]) {
      this.select[type] = Math.max(number, 0)
      this.render()
    }
  }

  show (current, reference, cb) { // current { row, column } zero base
    this.current = this.select = current
    super.show(reference, cb)
  }

  selectItem () {
    const { cb } = this
    const { row, column } = this.select
    cb(Math.max(row, 0), Math.max(column, 0))
    this.hide()
  }
}

export default TablePicker
