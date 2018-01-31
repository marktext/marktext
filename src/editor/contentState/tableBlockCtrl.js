import { isLengthEven } from '../utils'

const TABLE_BLOCK_REG = /^\|.*?(\\*)\|.*?(\\*)\|/

const tableBlockCtrl = ContentState => {
  ContentState.prototype.createTable = function (block) {
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
    const tHead = this.createBlock('thead')
    const headRow = this.createBlock('tr')
    const tBody = this.createBlock('tbody')
    const bodyRow = this.createBlock('tr')
    this.appendChild(tHead, headRow)
    this.appendChild(tBody, bodyRow)
    for (i = 0; i < colLen; i++) {
      const headCell = this.createBlock('th', rowHeader[i])
      const bodyCell = this.createBlock('td')
      this.appendChild(headRow, headCell)
      this.appendChild(bodyRow, bodyCell)
      if (i === 0) result = bodyCell
    }
    block.type = 'table'
    block.text = ''
    block.children = []
    this.appendChild(block, tHead)
    this.appendChild(block, tBody)
    return result
  }

  ContentState.prototype.tableBlockUpdate = function (block) {
    const { type, text } = block
    if (type !== 'li' && type !== 'p') return false
    const match = TABLE_BLOCK_REG.exec(text)
    return (match && isLengthEven(match[1]) && isLengthEven(match[2])) ? this.createTable(block) : false
  }
}

export default tableBlockCtrl
