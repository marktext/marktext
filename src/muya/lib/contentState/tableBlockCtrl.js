import { isLengthEven, getParagraphReference } from '../utils'

const TABLE_BLOCK_REG = /^\|.*?(\\*)\|.*?(\\*)\|/

const tableBlockCtrl = ContentState => {
  ContentState.prototype.createTableInFigure = function ({ rows, columns }, tableContents = []) {
    const table = this.createBlock('table', {
      row: rows - 1, // zero base
      column: columns - 1
    })
    const tHead = this.createBlock('thead')
    const tBody = this.createBlock('tbody')

    let i
    let j
    for (i = 0; i < rows; i++) {
      const rowBlock = this.createBlock('tr')
      i === 0 ? this.appendChild(tHead, rowBlock) : this.appendChild(tBody, rowBlock)
      const rowContents = tableContents[i]
      for (j = 0; j < columns; j++) {
        const cell = this.createBlock(i === 0 ? 'th' : 'td', {
          align: rowContents ? rowContents[j].align : '',
          column: j
        })
        const cellContent = this.createBlock('span', {
          text: rowContents ? rowContents[j].text : '',
          functionType: 'cellContent'
        })

        this.appendChild(cell, cellContent)
        this.appendChild(rowBlock, cell)
      }
    }

    this.appendChild(table, tHead)
    if (tBody.children.length) {
      this.appendChild(table, tBody)
    }

    return table
  }

  ContentState.prototype.createFigure = function ({ rows, columns }) {
    const { end } = this.cursor
    const table = this.createTableInFigure({ rows, columns })
    const figureBlock = this.createBlock('figure', {
      functionType: 'table'
    })
    const endBlock = this.getBlock(end.key)
    const anchor = this.getAnchor(endBlock)

    if (!anchor) {
      return
    }

    this.insertAfter(figureBlock, anchor)
    if (/p|h\d/.test(anchor.type) && !endBlock.text) {
      this.removeBlock(anchor)
    }
    this.appendChild(figureBlock, table)
    const { key } = this.firstInDescendant(table) // fist cell key in thead
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

    const table = this.createTableInFigure({ rows, columns }, [rowHeader.map(text => ({ text, align: '' }))])

    block.type = 'figure'
    block.text = ''
    block.children = []
    block.functionType = 'table'
    this.appendChild(block, table)

    return this.firstInDescendant(table.children[1]) // first cell content in tbody
  }

  ContentState.prototype.tableToolBarClick = function (type) {
    const { start: { key } } = this.cursor
    const block = this.getBlock(key)
    const parentBlock = this.getParent(block)
    if (block.functionType !== 'cellContent') {
      throw new Error('table is not active')
    }
    const { column, align } = parentBlock
    const table = this.closest(block, 'table')
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
        const tableEle = document.querySelector(`#${figureKey} [data-label=table]`)
        const { row = 1, column = 1 } = table // zero base

        const handler = (row, column) => {
          const { row: oldRow, column: oldColumn } = table
          let tBody = table.children[1]
          const tHead = table.children[0]
          const headerRow = tHead.children[0]
          const bodyRows = tBody ? tBody.children : []
          let i
          if (column > oldColumn) {
            for (i = oldColumn + 1; i <= column; i++) {
              const th = this.createBlock('th', {
                column: i,
                align: ''
              })
              const thContent = this.createBlock('span', {
                functionType: 'cellContent'
              })
              this.appendChild(th, thContent)
              this.appendChild(headerRow, th)
              bodyRows.forEach(bodyRow => {
                const td = this.createBlock('td', {
                  column: i,
                  align: ''
                })

                const tdContent = this.createBlock('span', {
                  functionType: 'cellContent'
                })
                this.appendChild(td, tdContent)
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
            if (tBody.children.length === 0) {
              this.removeBlock(tBody)
            }
          } else if (row > oldRow) {
            if (!tBody) {
              tBody = this.createBlock('tbody')
              this.appendChild(table, tBody)
            }
            const oneHeaderRow = tHead.children[0]
            for (i = oldRow + 1; i <= row; i++) {
              const bodyRow = this.createRow(oneHeaderRow, false)

              this.appendChild(tBody, bodyRow)
            }
          }

          Object.assign(table, { row, column })

          const cursorBlock = this.firstInDescendant(headerRow)
          const key = cursorBlock.key
          const offset = cursorBlock.text.length
          this.cursor = {
            start: { key, offset },
            end: { key, offset }
          }
          this.muya.eventCenter.dispatch('stateChange')
          this.partialRender()
        }

        const reference = getParagraphReference(tableEle, tableEle.id)
        eventCenter.dispatch('muya-table-picker', { row, column }, reference, handler.bind(this))
      }
    }
  }

  // insert/remove row/column
  ContentState.prototype.editTable = function ({ location, action, target }, cellContentKey) {
    let block
    let start
    let end
    if (cellContentKey) {
      block = this.getBlock(cellContentKey)
    } else {
      ({ start, end } = this.cursor)
      if (start.key !== end.key) {
        throw new Error('Cursor is not in one block, can not editTable')
      }

      block = this.getBlock(start.key)
    }

    if (block.functionType !== 'cellContent') {
      throw new Error('Cursor is not in table block, so you can not insert/edit row/column')
    }

    const cellBlock = this.getParent(block)
    const currentRow = this.getParent(cellBlock)
    const table = this.closest(block, 'table')
    const thead = table.children[0]
    const tbody = table.children[1]
    const columnIndex = currentRow.children.indexOf(cellBlock)
    // const rowIndex = rowContainer.type === 'thead' ? 0 : tbody.children.indexOf(currentRow) + 1

    let cursorBlock

    if (target === 'row') {
      if (action === 'insert') {
        const newRow = (location === 'previous' && cellBlock.type === 'th')
          ? this.createRow(currentRow, true)
          : this.createRow(currentRow, false)
        if (location === 'previous') {
          this.insertBefore(newRow, currentRow)
          if (cellBlock.type === 'th') {
            this.removeBlock(currentRow)
            currentRow.children.forEach(cell => (cell.type = 'td'))
            const firstRow = tbody.children[0]
            this.insertBefore(currentRow, firstRow)
          }
        } else {
          if (cellBlock.type === 'th') {
            const firstRow = tbody.children[0]
            this.insertBefore(newRow, firstRow)
          } else {
            this.insertAfter(newRow, currentRow)
          }
        }
        cursorBlock = newRow.children[columnIndex].children[0]
        // handle remove row
      } else {
        if (location === 'previous') {
          if (cellBlock.type === 'th') return
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
          if (cellBlock.type === 'th' && tbody.children.length >= 2) {
            const firstRow = tbody.children[0]
            this.removeBlock(currentRow)
            this.removeBlock(firstRow)
            this.appendChild(thead, firstRow)
            firstRow.children.forEach(cell => (cell.type = 'th'))
            cursorBlock = firstRow.children[columnIndex].children[0]
          }
          if (cellBlock.type === 'td' && (currentRow.preSibling || currentRow.nextSibling)) {
            cursorBlock = (this.getNextSibling(currentRow) || this.getPreSibling(currentRow)).children[columnIndex].children[0]
            this.removeBlock(currentRow)
          }
        } else {
          if (cellBlock.type === 'th') {
            if (tbody.children.length >= 2) {
              const firstRow = tbody.children[0]
              this.removeBlock(firstRow)
            } else {
              return
            }
          } else {
            const nextRow = this.getNextSibling(currentRow)
            if (nextRow) {
              this.removeBlock(nextRow)
            }
          }
        }
      }
    } else if (target === 'column') {
      if (action === 'insert') {
        [...thead.children, ...tbody.children].forEach(tableRow => {
          const targetCell = tableRow.children[columnIndex]
          const cell = this.createBlock(targetCell.type, {
            align: ''
          })
          const cellContent = this.createBlock('span', {
            functionType: 'cellContent'
          })
          this.appendChild(cell, cellContent)
          if (location === 'left') {
            this.insertBefore(cell, targetCell)
          } else {
            this.insertAfter(cell, targetCell)
          }
          tableRow.children.forEach((cell, i) => {
            cell.column = i
          })
        })
        cursorBlock = location === 'left' ? this.getPreSibling(cellBlock).children[0] : this.getNextSibling(cellBlock).children[0]
        // handle remove column
      } else {
        if (currentRow.children.length <= 2) return
        [...thead.children, ...tbody.children].forEach(tableRow => {
          const targetCell = tableRow.children[columnIndex]
          const removeCell = location === 'left'
            ? this.getPreSibling(targetCell)
            : (location === 'current' ? targetCell : this.getNextSibling(targetCell))
          if (removeCell === cellBlock) {
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
      const figure = affiliation.find(p => p.type === 'figure')
      return figure
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
