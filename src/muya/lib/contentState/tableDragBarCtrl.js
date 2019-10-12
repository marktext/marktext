const calculateAspects = (tableId, barType) => {
  const table = document.querySelector(`#${tableId}`)
  if (barType === 'bottom') {
    const firstRow = table.querySelector('tr')
    return Array.from(firstRow.children).map(cell => cell.clientWidth)
  } else {
    return Array.from(table.querySelectorAll('tr')).map(row => row.clientHeight)
  }
}

export const getAllTableCells = tableId => {
  const table = document.querySelector(`#${tableId}`)
  const rows = table.querySelectorAll('tr')
  const cells = []
  for (const row of Array.from(rows)) {
    cells.push(Array.from(row.children))
  }

  return cells
}

export const getIndex = (barType, cell) => {
  if (cell.tagName === 'SPAN') {
    cell = cell.parentNode
  }
  const row = cell.parentNode
  if (barType === 'bottom') {
    return Array.from(row.children).indexOf(cell)
  } else {
    const rowContainer = row.parentNode
    if (rowContainer.tagName === 'THEAD') {
      return 0
    } else {
      return Array.from(rowContainer.children).indexOf(row) + 1
    }
  }
}

const getDragCells = (tableId, barType, index) => {
  const table = document.querySelector(`#${tableId}`)
  const dragCells = []
  if (barType === 'left') {
    if (index === 0) {
      dragCells.push(...table.querySelectorAll('th'))
    } else {
      const row = table.querySelector('tbody').children[index - 1]
      dragCells.push(...row.children)
    }
  } else {
    const rows = Array.from(table.querySelectorAll('tr'))
    const len = rows.length
    let i
    for (i = 0; i < len; i++) {
      dragCells.push(rows[i].children[index])
    }
  }
  return dragCells
}

const tableDragBarCtrl = ContentState => {
  ContentState.prototype.handleMouseDown = function (event) {
    event.preventDefault()
    const { eventCenter } = this.muya
    const { clientX, clientY, target } = event
    const tableId = target.closest('table').id
    const barType = target.classList.contains('left') ? 'left' : 'bottom'
    const index = getIndex(barType, target)
    const aspects = calculateAspects(tableId, barType)
    this.dragInfo = {
      tableId,
      clientX,
      clientY,
      barType,
      index,
      curIndex: index,
      dragCells: getDragCells(tableId, barType, index),
      cells: getAllTableCells(tableId),
      aspects,
      offset: 0
    }

    for (const row of this.dragInfo.cells) {
      for (const cell of row) {
        if (!this.dragInfo.dragCells.includes(cell)) {
          cell.classList.add('ag-cell-transform')
        }
      }
    }

    const mouseMoveId = eventCenter.attachDOMEvent(document, 'mousemove', this.handleMouseMove.bind(this))
    const mouseUpId = eventCenter.attachDOMEvent(document, 'mouseup', this.handleMouseUp.bind(this))
    this.dragEventIds.push(mouseMoveId, mouseUpId)
  }

  ContentState.prototype.handleMouseMove = function (event) {
    if (!this.dragInfo) {
      return
    }
    const { barType } = this.dragInfo
    const attrName = barType === 'bottom' ? 'clientX' : 'clientY'
    const offset = this.dragInfo.offset = event[attrName] - this.dragInfo[attrName]
    if (Math.abs(offset) < 5) {
      return
    }
    this.isDragTableBar = true
    this.hideUnnecessaryBar()
    this.calculateCurIndex()
    this.setDragTargetStyle()
    this.setSwitchStyle()
  }

  ContentState.prototype.handleMouseUp = function (event) {
    const { eventCenter } = this.muya
    for (const id of this.dragEventIds) {
      eventCenter.detachDOMEvent(id)
    }
    this.dragEventIds = []
    if (!this.isDragTableBar) {
      return
    }

    this.setDropTargetStyle()

    // The drop animation need 300ms.
    setTimeout(() => {
      this.switchTableData()
      this.resetDragTableBar()
    }, 300)
  }

  ContentState.prototype.hideUnnecessaryBar = function () {
    const { barType } = this.dragInfo
    const hideClassName = barType === 'bottom' ? 'left' : 'bottom'
    const needHideBar = document.querySelector(`.ag-drag-handler.${hideClassName}`)
    if (needHideBar) {
      needHideBar.style.display = 'none'
    }
  }

  ContentState.prototype.calculateCurIndex = function () {
    let { offset, aspects, index } = this.dragInfo
    let curIndex = index
    const len = aspects.length
    let i
    if (offset > 0) {
      for (i = index; i < len; i++) {
        const aspect = aspects[i]
        if (i === index) {
          offset -= Math.floor(aspect / 2)
        } else {
          offset -= aspect
        }
        if (offset < 0) {
          break
        } else {
          curIndex++
        }
      }
    } else if (offset < 0) {
      for (i = index; i >= 0; i--) {
        const aspect = aspects[i]
        if (i === index) {
          offset += Math.floor(aspect / 2)
        } else {
          offset += aspect
        }
        if (offset > 0) {
          break
        } else {
          curIndex--
        }
      }
    }

    this.dragInfo.curIndex = Math.max(0, Math.min(curIndex, len - 1))
  }

  ContentState.prototype.setDragTargetStyle = function () {
    const { offset, barType, dragCells } = this.dragInfo

    for (const cell of dragCells) {
      if (!cell.classList.contains('ag-drag-cell')) {
        cell.classList.add('ag-drag-cell')
        cell.classList.add(`ag-drag-${barType}`)
      }
      const valueName = barType === 'bottom' ? 'translateX' : 'translateY'
      cell.style.transform = `${valueName}(${offset}px)`
    }
  }

  ContentState.prototype.setSwitchStyle = function () {
    const { index, offset, curIndex, barType, aspects, cells } = this.dragInfo
    const aspect = aspects[index]
    const len = aspects.length

    let i
    if (offset > 0) {
      if (barType === 'bottom') {
        for (const row of cells) {
          for (i = 0; i < len; i++) {
            const cell = row[i]
            if (i > index && i <= curIndex) {
              cell.style.transform = `translateX(${-aspect}px)`
            } else if (i !== index) {
              cell.style.transform = 'translateX(0px)'
            }
          }
        }
      } else {
        for (i = 0; i < len; i++) {
          const row = cells[i]
          for (const cell of row) {
            if (i > index && i <= curIndex) {
              cell.style.transform = `translateY(${-aspect}px)`
            } else if (i !== index) {
              cell.style.transform = 'translateY(0px)'
            }
          }
        }
      }
    } else {
      if (barType === 'bottom') {
        for (const row of cells) {
          for (i = 0; i < len; i++) {
            const cell = row[i]
            if (i >= curIndex && i < index) {
              cell.style.transform = `translateX(${aspect}px)`
            } else if (i !== index) {
              cell.style.transform = 'translateX(0px)'
            }
          }
        }
      } else {
        for (i = 0; i < len; i++) {
          const row = cells[i]
          for (const cell of row) {
            if (i >= curIndex && i < index) {
              cell.style.transform = `translateY(${aspect}px)`
            } else if (i !== index) {
              cell.style.transform = 'translateY(0px)'
            }
          }
        }
      }
    }
  }

  ContentState.prototype.setDropTargetStyle = function () {
    const { dragCells, barType, curIndex, index, aspects, offset } = this.dragInfo
    let move = 0
    let i
    if (offset > 0) {
      for (i = index + 1; i <= curIndex; i++) {
        move += aspects[i]
      }
    } else {
      for (i = curIndex; i < index; i++) {
        move -= aspects[i]
      }
    }
    for (const cell of dragCells) {
      cell.classList.remove('ag-drag-cell')
      cell.classList.remove(`ag-drag-${barType}`)
      cell.classList.add('ag-cell-transform')
      const valueName = barType === 'bottom' ? 'translateX' : 'translateY'
      cell.style.transform = `${valueName}(${move}px)`
    }
  }

  ContentState.prototype.switchTableData = function () {
    const { barType, index, curIndex, tableId, offset } = this.dragInfo
    const table = this.getBlock(tableId)
    const tHead = table.children[0]
    const tBody = table.children[1]
    const rows = [tHead.children[0], ...(tBody ? tBody.children : [])]
    let i

    if (index !== curIndex) {
      // Cursor in the same cell.
      const { start, end } = this.cursor
      let key = null
      if (barType === 'bottom') {
        for (const row of rows) {
          const isCursorCell = row.children[index].children[0].key === start.key
          const { text } = row.children[index].children[0]
          const { align } = row.children[index]
          if (offset > 0) {
            for (i = index; i < curIndex; i++) {
              row.children[i].children[0].text = row.children[i + 1].children[0].text
              row.children[i].align = row.children[i + 1].align
            }
            row.children[curIndex].children[0].text = text
            row.children[curIndex].align = align
          } else {
            for (i = index; i > curIndex; i--) {
              row.children[i].children[0].text = row.children[i - 1].children[0].text
              row.children[i].align = row.children[i - 1].align
            }
            row.children[curIndex].children[0].text = text
            row.children[curIndex].align = align
          }
          if (isCursorCell) {
            key = row.children[curIndex].children[0].key
          }
        }
      } else {
        let column = null
        const temp = rows[index].children.map((cell, i) => {
          if (cell.children[0].key === start.key) {
            column = i
          }
          return cell.children[0].text
        })
        if (offset > 0) {
          for (i = index; i < curIndex; i++) {
            rows[i].children.forEach((cell, ii) => {
              cell.children[0].text = rows[i + 1].children[ii].children[0].text
            })
          }
          rows[curIndex].children.forEach((cell, i) => {
            if (i === column) {
              key = cell.children[0].key
            }
            cell.children[0].text = temp[i]
          })
        } else {
          for (i = index; i > curIndex; i--) {
            rows[i].children.forEach((cell, ii) => {
              cell.children[0].text = rows[i - 1].children[ii].children[0].text
            })
          }
          rows[curIndex].children.forEach((cell, i) => {
            if (i === column) {
              key = cell.children[0].key
            }
            cell.children[0].text = temp[i]
          })
        }
      }
      if (key) {
        this.cursor = {
          start: {
            key,
            offset: start.offset
          },
          end: {
            key,
            offset: end.offset
          }
        }
        return this.singleRender(table)
      } else {
        return this.partialRender()
      }
    }
  }

  ContentState.prototype.resetDragTableBar = function () {
    this.dragInfo = null
    this.isDragTableBar = false
  }
}

export default tableDragBarCtrl
