import { CLASS_OR_ID } from '../../config'
export const THEAD_ROW_COUNT = 1
export const TABLE_TOOLS = [{
  label: 'table',
  title: 'Resize Table',
  icon: 'icon-table'
}, {
  label: 'left',
  title: 'Align Left',
  icon: 'icon-alignleft'
}, {
  label: 'center',
  title: 'Align Center',
  icon: 'icon-aligncenter'
}, {
  label: 'right',
  title: 'Align Right',
  icon: 'icon-alignright'
}, {
  label: 'delete',
  title: 'Delete Table',
  icon: 'icon-del'
}]

const meta = {
  id: 'npTable',
  type: 'block',
  sort: 16,
  rule: /^ *(\S.*\|.*)\n *([-:]+ *\|[-| :]*)\n((?:.*\|.*(?:\n|$))*)\n*/
}

function parse (params) {
  let cap = meta.rule.exec(params.src)

  let ok = false
  if (cap && params.top) {
    ok = true
    params.src = params.src.substring(cap[0].length)

    let item = {
      type: 'table',
      header: cap[1].replace(/^ *| *\| *$/g, '').split(/ *\| */),
      align: cap[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
      cells: cap[3].replace(/\n$/, '').split('\n')
    }

    for (let i = 0; i < item.align.length; i++) {
      if (/^ *-+: *$/.test(item.align[i])) {
        item.align[i] = 'right'
      } else if (/^ *:-+: *$/.test(item.align[i])) {
        item.align[i] = 'center'
      } else if (/^ *:-+ *$/.test(item.align[i])) {
        item.align[i] = 'left'
      } else {
        item.align[i] = null
      }
    }

    for (let i = 0; i < item.cells.length; i++) {
      item.cells[i] = item.cells[i].split(/ *\| */)
    }

    params.tokens.push(item)
  }
  return { ok, params }
}
function process (params) {
  let cap = meta.rule.exec(params.src)

  let ok = false
  if (cap && params.top) {
    ok = true
    params.src = params.src.substring(cap[0].length)

    let item = {
      type: 'table',
      header: cap[1].replace(/^ *| *\| *$/g, '').split(/ *\| */),
      align: cap[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
      cells: cap[3].replace(/\n$/, '').split('\n')
    }

    for (let i = 0; i < item.align.length; i++) {
      if (/^ *-+: *$/.test(item.align[i])) {
        item.align[i] = 'right'
      } else if (/^ *:-+: *$/.test(item.align[i])) {
        item.align[i] = 'center'
      } else if (/^ *:-+ *$/.test(item.align[i])) {
        item.align[i] = 'left'
      } else {
        item.align[i] = null
      }
    }

    for (let i = 0; i < item.cells.length; i++) {
      item.cells[i] = item.cells[i].split(/ *\| */)
    }
    params.stateRender.appendChild(params.parent, createTableBlock(item, params.stateRender))
  }
  return { ok, params }
}
function createTableBlock (item, stateRender) {
  const toolBar = createToolBar(TABLE_TOOLS, 'table', stateRender)
  const table = stateRender.createBlock('table')
  Object.assign(table, getRowColumnCount(item)) // set row and column
  const tableBlock = stateRender.createBlock('figure')
  table.functionType = 'table'
  stateRender.appendChild(tableBlock, toolBar)
  let i, j
  const theadBlock = stateRender.createBlock('thead')
  const headRow = stateRender.createBlock('tr', '')
  for (i = 0; i < item.header.length; i++) {
    stateRender.appendChild(headRow, stateRender.createBlock('th', item.header[i], {
      align: item.algin[i]
    }))
  }
  stateRender.appendChild(theadBlock, headRow)
  const tbodyBlock = stateRender.createBlock('tbody')
  for (i = 0; i < item.cells.length; i++) {
    let tdHeadRow = stateRender.createBlock('tr', '')
    let row = item.cells[i]
    for (j = 0; j < row.length; j++) {
      stateRender.appendChild(tdHeadRow, stateRender.createBlock('td', row[j], {
        align: item.algin[i]
      }))
    }
    stateRender.appendChild(tbodyBlock, tdHeadRow)
  }
  stateRender.appendChild(table, theadBlock)
  stateRender.appendChild(table, tbodyBlock)
  stateRender.appendChild(tableBlock, table)

  return tableBlock
}
function getRowColumnCount (item) {
  const THEAD_ROW_COUNT = 1
  const row = item.cells.length + THEAD_ROW_COUNT - 1
  const column = item.cells[0].length
  return { row, column } // zero base
}
function createToolBar (tools, toolBarType, stateRender) {
  const toolBar = stateRender.createBlock('div', '', {
    attrs: {
      contenteditable: 'false'
    },
    selector: `.${'ag-tool-' + toolBarType}.${CLASS_OR_ID['AG_TOOL_BAR']}`
  })

  Object.assign(toolBar, { toolBarType: toolBarType })

  const ul = stateRender.createBlock('ul')

  tools.forEach(tool => {
    const toolBlock = stateRender.createBlock('li')
    const svgBlock = stateRender.createBlock('svg')
    svgBlock.icon = tool.icon
    toolBlock.label = tool.label
    toolBlock.title = tool.title
    stateRender.appendChild(toolBlock, svgBlock)
    stateRender.appendChild(ul, toolBlock)
  })
  stateRender.appendChild(toolBar, ul)
  return toolBar
}
export default { meta, parse, process }
