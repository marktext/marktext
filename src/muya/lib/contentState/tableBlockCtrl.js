import { isLengthEven, getParagraphReference } from '../utils'

const TABLE_BLOCK_REG = /^\|.*?(\\*)\|.*?(\\*)\|/

const tableBlockCtrl = ContentState => {
  ContentState.prototype.createTableInFigure = function ({ rows, columns }, headerTexts) {
    const table = this.createBlock('table')
    const tHead = this.createBlock('thead')
    const tBody = this.createBlock('tbody')

    table.row = rows - 1 // zero base
    table.column = columns - 1 // zero base
    let i
    let j
    for (i = 0; i < rows; i++) {
      const rowBlock = this.createBlock('tr')
      i === 0 ? this.appendChild(tHead, rowBlock) : this.appendChild(tBody, rowBlock)
      for (j = 0; j < columns; j++) {
        const cell = this.createBlock(i === 0 ? 'th' : 'td', {
          text: headerTexts && i === 0 ? headerTexts[j] : ''
        })
        this.appendChild(rowBlock, cell)
        cell.align = ''
        cell.column = j
      }
    }

    this.appendChild(table, tHead)
    if (tBody.children.length) {
      this.appendChild(table, tBody)
    }

    return table
  }

  ContentState.prototype.closest = function (block, type) {
    if (!block) {
      return null
    }
    if (block.type === type) {
      return block
    } else {
      const parent = this.getParent(block)
      return this.closest(parent, type)
    }
  }

  ContentState.prototype.getAnchor = function (block) {
    const { type, functionType } = block
    switch (type) {
      case 'span':
        if (functionType === 'codeContent') {
          return this.closest(block, 'figure') || this.closest(block, 'pre')
        } else {
          return this.getParent(block)
        }

      case 'th':
      case 'td':
        return this.closest(block, 'figure')

      default:
        return null
    }
  }

  ContentState.prototype.createFigure = function ({ rows, columns }) {
    const { end } = this.cursor
    const table = this.createTableInFigure({ rows, columns })
    const figureBlock = this.createBlock('figure')
    figureBlock.functionType = 'table'
    const endBlock = this.getBlock(end.key)
    const anchor = this.getAnchor(endBlock)

    if (!anchor) return
    this.insertAfter(figureBlock, anchor)
    if (/p|h\d/.test(anchor.type) && !endBlock.text) {
      this.removeBlock(anchor)
    }
    this.appendChild(figureBlock, table)
    const key = table.children[0].children[0].children[0].key // fist cell key in thead
    const offset = 0
    this.cursor = {
      start: { key, offset },
      end: { key, offset }
    }
    this.partialRender()
  }

  ContentState.prototype.createTable = function (tableChecker) {
    this.createFigure(tableChecker)

    this.muya.dispatchSelectionChange()
    this.muya.dispatchSelectionFormats()
    this.muya.dispatchChange()
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

    const table = this.createTableInFigure({ rows, columns }, rowHeader)

    block.type = 'figure'
    block.text = ''
    block.children = []
    block.functionType = 'table'
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
        this.muya.eventCenter.dispatch('stateChange')
        this.partialRender()
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
        this.muya.eventCenter.dispatch('stateChange')
        this.partialRender()
        break
      }
      case 'table': {
        const { eventCenter } = this.muya
        const figureKey = figure.key
        const tableLable = document.querySelector(`#${figureKey} [data-label=table]`)
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
          this.muya.eventCenter.dispatch('stateChange')
          this.partialRender()
        }
        const reference = getParagraphReference(tableLable, tableLable.id)
        eventCenter.dispatch('muya-table-picker', { row, column }, reference, handler.bind(this))
      }
    }
  }

  // insert/remove row/column
  ContentState.prototype.editTable = function ({ location, action, target }) {
    const { start, end } = this.cursor
    const block = this.getBlock(start.key)
    if (start.key !== end.key || !/th|td/.test(block.type)) {
      throw new Error('Cursor is not in table block, so you can not insert/edit row/column')
    }
    const currentRow = this.getParent(block)
    const rowContainer = this.getParent(currentRow) // tbody or thead
    const table = this.getParent(rowContainer)
    const thead = table.children[0]
    const tbody = table.children[1]
    const { column } = table
    const columnIndex = currentRow.children.indexOf(block)
    let cursorBlock

    const createRow = (column, isHeader) => {
      const tr = this.createBlock('tr')
      let i
      for (i = 0; i <= column; i++) {
        const cell = this.createBlock(isHeader ? 'th' : 'td')
        cell.align = currentRow.children[i].align
        cell.column = i
        this.appendChild(tr, cell)
      }
      return tr
    }

    if (target === 'row') {
      if (action === 'insert') {
        const newRow = (location === 'previous' && block.type === 'th')
          ? createRow(column, true)
          : createRow(column, false)
        if (location === 'previous') {
          this.insertBefore(newRow, currentRow)
          if (block.type === 'th') {
            this.removeBlock(currentRow)
            currentRow.children.forEach(cell => (cell.type = 'td'))
            const firstRow = tbody.children[0]
            this.insertBefore(currentRow, firstRow)
          }
        } else {
          if (block.type === 'th') {
            const firstRow = tbody.children[0]
            this.insertBefore(newRow, firstRow)
          } else {
            this.insertAfter(newRow, currentRow)
          }
        }
        cursorBlock = newRow.children[columnIndex]
        // handle remove row
      } else {
        if (location === 'previous') {
          if (block.type === 'th') return
          if (!currentRow.preSibling) {
            const headRow = thead.children[0]
            if (!currentRow.nextSibling) return
            this.removeBlock(headRow)
            this.removeBlock(currentRow)
            currentRow.children.forEach(cell => (cell.type = 'th'))
            this.appendChild(thead, currentRow)
          } else {
            const preRow = this.getPreSibling(currentRow)
            this.removeBlock(preRow)
          }
        } else if (location === 'current') {
          if (block.type === 'th' && tbody.children.length >= 2) {
            const firstRow = tbody.children[0]
            this.removeBlock(currentRow)
            this.removeBlock(firstRow)
            this.appendChild(thead, firstRow)
            firstRow.children.forEach(cell => (cell.type = 'th'))
            cursorBlock = firstRow.children[columnIndex]
          }
          if (block.type === 'td' && (currentRow.preSibling || currentRow.nextSibling)) {
            cursorBlock = (this.getNextSibling(currentRow) || this.getPreSibling(currentRow)).children[columnIndex]
            this.removeBlock(currentRow)
          }
        } else {
          if (block.type === 'th') {
            if (tbody.children.length >= 2) {
              const firstRow = tbody.children[0]
              this.removeBlock(firstRow)
            } else {
              return
            }
          } else {
            const nextRow = this.getNextSibling(currentRow)
            if (nextRow) this.removeBlock(nextRow)
          }
        }
      }
    } else if (target === 'column') {
      if (action === 'insert') {
        [...thead.children, ...tbody.children].forEach(tableRow => {
          const targetCell = tableRow.children[columnIndex]
          const cell = this.createBlock(targetCell.type)
          cell.align = ''
          if (location === 'left') {
            this.insertBefore(cell, targetCell)
          } else {
            this.insertAfter(cell, targetCell)
          }
          tableRow.children.forEach((cell, i) => {
            cell.column = i
          })
        })
        cursorBlock = location === 'left' ? this.getPreSibling(block) : this.getNextSibling(block)
        // handle remove column
      } else {
        if (currentRow.children.length <= 2) return
        [...thead.children, ...tbody.children].forEach(tableRow => {
          const targetCell = tableRow.children[columnIndex]
          const removeCell = location === 'left'
            ? this.getPreSibling(targetCell)
            : (location === 'current' ? targetCell : this.getNextSibling(targetCell))
          if (removeCell === block) {
            cursorBlock = this.findNextBlockInLocation(block)
          }

          if (removeCell) this.removeBlock(removeCell)
          tableRow.children.forEach((cell, i) => {
            cell.column = i
          })
        })
      }
    }

    const newColum = thead.children[0].children.length - 1
    const newRow = thead.children.length + tbody.children.length - 1
    Object.assign(table, { row: newRow, column: newColum })

    if (cursorBlock) {
      const { key } = cursorBlock
      const offset = 0
      this.cursor = { start: { key, offset }, end: { key, offset } }
    } else {
      this.cursor = { start, end }
    }

    this.partialRender()
    this.muya.eventCenter.dispatch('stateChange')
  }

  ContentState.prototype.getTableBlock = function () {
    const { start, end } = this.cursor
    const startBlock = this.getBlock(start.key)
    const endBlock = this.getBlock(end.key)
    const startParents = this.getParents(startBlock)
    const endParents = this.getParents(endBlock)
    const affiliation = startParents
      .filter(p => endParents.includes(p))

    if (affiliation.length) {
      const table = affiliation.find(p => p.type === 'figure')
      return table
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
