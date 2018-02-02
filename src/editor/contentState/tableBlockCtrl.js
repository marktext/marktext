import { isLengthEven } from '../utils'
import TableIcon from '../assets/icons/table.svg'
import LeftIcon from '../assets/icons/align-left.svg'
import CenterIcon from '../assets/icons/align-center.svg'
import RightIcon from '../assets/icons/align-right.svg'
import DeleteIcon from '../assets/icons/delete.svg'
import tablePicker from '../tablePicker'

const TABLE_BLOCK_REG = /^\|.*?(\\*)\|.*?(\\*)\|/

const tableBlockCtrl = ContentState => {
  ContentState.prototype.initTable = function (block) {
    const { text } = block
    const rowHeader = []
    const len = text.length
    let i
    let result
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
    const colLen = rowHeader.length
    const table = this.createBlock('table')
    const tHead = this.createBlock('thead')
    const headRow = this.createBlock('tr')
    const tBody = this.createBlock('tbody')
    const bodyRow = this.createBlock('tr')
    this.appendChild(tHead, headRow)
    this.appendChild(tBody, bodyRow)
    // set the init table row count and column count. the init value is (1, colLen - 1)
    table.row = 1 // zero base
    table.column = colLen - 1 // zero base
    for (i = 0; i < colLen; i++) {
      const headCell = this.createBlock('th', rowHeader[i])
      const bodyCell = this.createBlock('td')
      headCell.column = i
      headCell.align = ''
      bodyCell.column = i
      bodyCell.align = ''

      this.appendChild(headRow, headCell)
      this.appendChild(bodyRow, bodyCell)
      if (i === 0) result = bodyCell
    }
    this.appendChild(table, tHead)
    this.appendChild(table, tBody)

    const toolBar = this.createBlock('div')
    toolBar.editable = false
    const ul = this.createBlock('ul')
    const tools = [{
      label: 'table',
      icon: TableIcon
    }, {
      label: 'left',
      icon: LeftIcon
    }, {
      label: 'center',
      icon: CenterIcon
    }, {
      label: 'right',
      icon: RightIcon
    }, {
      label: 'delete',
      icon: DeleteIcon
    }]

    tools.forEach(tool => {
      const toolBlock = this.createBlock('li')
      const imgBlock = this.createBlock('img')
      imgBlock.src = tool.icon
      toolBlock.label = tool.label
      this.appendChild(toolBlock, imgBlock)
      this.appendChild(ul, toolBlock)
    })
    this.appendChild(toolBar, ul)

    block.type = 'figure'
    block.text = ''
    block.children = []
    this.appendChild(block, toolBar)
    this.appendChild(block, table)
    return result
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
        this.render()
        break
      }
      case 'delete': {
        figure.children = []
        figure.type = 'p'
        figure.text = ''
        const key = figure.key
        const offset = 0
        this.cursor = {
          start: { key, offset },
          end: { key, offset }
        }
        this.render()
        break
      }
      case 'table': {
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

          this.render()
        }

        tablePicker.toogle({ row, column }, { left, top }, handler.bind(this))
        // tablePicker.status ? tableLable.classList.add('active') : tableLable.classList.remove('active')
      }
    }
  }

  ContentState.prototype.tableBlockUpdate = function (block) {
    const { type, text } = block
    if (type !== 'li' && type !== 'p') return false
    const match = TABLE_BLOCK_REG.exec(text)
    return (match && isLengthEven(match[1]) && isLengthEven(match[2])) ? this.initTable(block) : false
  }
}

export default tableBlockCtrl
