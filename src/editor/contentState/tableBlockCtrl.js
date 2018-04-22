import { isLengthEven } from '../utils'
import { TABLE_TOOLS } from '../config'

const TABLE_BLOCK_REG = /^\|.*?(\\*)\|.*?(\\*)\|/

const tableBlockCtrl = ContentState => {
  ContentState.prototype.createTable = function ({ rows, columns }, headerTexts) {
    const table = this.createBlock('table')
    const tHead = this.createBlock('thead')
    const tBody = this.createBlock('tbody')

    this.appendChild(table, tHead)
    this.appendChild(table, tBody)
    table.row = rows - 1
    table.column = columns - 1
    let i
    let j
    for (i = 0; i < rows; i++) {
      const rowBlock = this.createBlock('tr')
      i === 0 ? this.appendChild(tHead, rowBlock) : this.appendChild(tBody, rowBlock)
      for (j = 0; j < columns; j++) {
        const cell = this.createBlock(i === 0 ? 'th' : 'td', headerTexts && i === 0 ? headerTexts[j] : '')
        this.appendChild(rowBlock, cell)
        cell.align = ''
        cell.column = j
      }
    }
    return table
  }

  ContentState.prototype.createFigure = function ({ rows, columns }) {
    const { start, end } = this.cursor
    const toolBar = this.createToolBar(TABLE_TOOLS, 'table')
    const table = this.createTable({ rows, columns })
    let figureBlock
    if (start.key === end.key) {
      const startBlock = this.getBlock(start.key)
      const anchor = startBlock.type === 'span' ? this.getParent(startBlock) : startBlock
      if (startBlock.text) {
        figureBlock = this.createBlock('figure')
        this.insertAfter(figureBlock, anchor)
      } else {
        figureBlock = anchor
        figureBlock.type = 'figure'
        figureBlock.functionType = 'table'
        figureBlock.text = ''
        figureBlock.children = []
      }
      this.appendChild(figureBlock, toolBar)
      this.appendChild(figureBlock, table)
    }
    const key = table.children[0].children[0].children[0].key // fist cell key in thead
    const offset = 0
    this.cursor = {
      start: { key, offset },
      end: { key, offset }
    }
    this.eventCenter.dispatch('stateChange')
    this.render()
  }

  ContentState.prototype.initTable = function (block) {
    const { text } = block.children[0]
    const rowHeader = []
    const len = text.length
    let i
    for (i = 0; i < len; i++) {
      const char = text[i]
      if (/^[^|]$/.test(char)) {
        rowHeader[rowHeader.length - 1] += char
      }
      if (/\\/.test(char)) {
        rowHeader[rowHeader.length - 1] += text[++i]
      }
      if (/\|/.test(char) && i !== len - 1) {
        rowHeader.push('')
      }
    }
    const columns = rowHeader.length
    const rows = 2

    const table = this.createTable({ rows, columns }, rowHeader)
    const toolBar = this.createToolBar(TABLE_TOOLS, 'table')

    block.type = 'figure'
    block.text = ''
    block.children = []
    this.appendChild(block, toolBar)
    this.appendChild(block, table)
    return table.children[1].children[0].children[0] // first cell in tbody
  }

  ContentState.prototype.tableToolBarClick = function (type) {
    const { start: { key } } = this.cursor
    const block = this.getBlock(key)
    if (!(/td|th/.test(block.type))) throw new Error('table is not active')
    const { column, align } = block
    const getTable = td => {
      const row = this.getBlock(block.parent)
      const rowContainer = this.getBlock(row.parent)
      return this.getBlock(rowContainer.parent)
    }
    const table = getTable(block)
    const figure = this.getBlock(table.parent)
    switch (type) {
      case 'left':
      case 'center':
      case 'right': {
        const newAlign = align === type ? '' : type
        table.children.forEach(rowContainer => {
          rowContainer.children.forEach(row => {
            row.children[column].align = newAlign
          })
        })
        this.eventCenter.dispatch('stateChange')
        this.render()
        break
      }
      case 'delete': {
        const newLine = this.createBlock('span')
        figure.children = []
        this.appendChild(figure, newLine)
        figure.type = 'p'
        figure.text = ''
        const key = newLine.key
        const offset = 0
        this.cursor = {
          start: { key, offset },
          end: { key, offset }
        }
        this.eventCenter.dispatch('stateChange')
        this.render()
        break
      }
      case 'table': {
        const { tablePicker } = this
        const figureKey = figure.key
        const tableLable = document.querySelector(`#${figureKey} [data-label=table]`)
        const rect = tableLable.getBoundingClientRect()
        const left = `${rect.left + rect.width / 2 - 29}px`
        const top = `${rect.top + rect.height + 8}px`
        const { row = 1, column = 1 } = table // zero base

        const handler = (row, column) => {
          const { row: oldRow, column: oldColumn } = table
          const tBody = table.children[1]
          const tHead = table.children[0]
          const headerRow = tHead.children[0]
          const bodyRows = tBody.children
          let i
          if (column > oldColumn) {
            for (i = oldColumn + 1; i <= column; i++) {
              const th = this.createBlock('th')
              th.column = i
              th.align = ''
              this.appendChild(headerRow, th)
              bodyRows.forEach(bodyRow => {
                const td = this.createBlock('td')
                td.column = i
                td.align = ''
                this.appendChild(bodyRow, td)
              })
            }
          } else if (column < oldColumn) {
            const rows = [headerRow, ...bodyRows]
            rows.forEach(row => {
              while (row.children.length > column + 1) {
                const lastChild = row.children[row.children.length - 1]
                this.removeBlock(lastChild)
              }
            })
          }

          if (row < oldRow) {
            while (tBody.children.length > row) {
              const lastRow = tBody.children[tBody.children.length - 1]
              this.removeBlock(lastRow)
            }
          } else if (row > oldRow) {
            const oneRowInBody = bodyRows[0]
            for (i = oldRow + 1; i <= row; i++) {
              const bodyRow = this.createRow(oneRowInBody)
              this.appendChild(tBody, bodyRow)
            }
          }
          Object.assign(table, { row, column })

          const cursorBlock = headerRow.children[0]
          const key = cursorBlock.key
          const offset = cursorBlock.text.length
          this.cursor = {
            start: { key, offset },
            end: { key, offset }
          }
          this.eventCenter.dispatch('stateChange')
          this.render()
        }

        tablePicker.toggle({ row, column }, { left, top }, handler.bind(this))
        // tablePicker.status ? tableLable.classList.add('active') : tableLable.classList.remove('active')
      }
    }
  }

  ContentState.prototype.tableBlockUpdate = function (block) {
    const { type } = block
    if (type !== 'p') return false
    const { text } = block.children[0]
    const match = TABLE_BLOCK_REG.exec(text)
    return (match && isLengthEven(match[1]) && isLengthEven(match[2])) ? this.initTable(block) : false
  }
}

export default tableBlockCtrl
