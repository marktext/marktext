// used for render table tookbar or others.
import { h } from '../snabbdom'
import { CLASS_OR_ID } from '../../../config'
import TableIcon from '../../../assets/pngicon/table/table@2x.png'
import AlignLeftIcon from '../../../assets/pngicon/algin_left/algin_left@2x.png'
import AlignRightIcon from '../../../assets/pngicon/algin_right/algin_right@2x.png'
import AlignCenterIcon from '../../../assets/pngicon/algin_center/algin_center@2x.png'
import DeleteIcon from '../../../assets/pngicon/delete/delete@2x.png'

export const TABLE_TOOLS = [{
  label: 'table',
  title: 'Resize Table',
  icon: TableIcon
}, {
  label: 'left',
  title: 'Align Left',
  icon: AlignLeftIcon
}, {
  label: 'center',
  title: 'Align Center',
  icon: AlignCenterIcon
}, {
  label: 'right',
  title: 'Align Right',
  icon: AlignRightIcon
}, {
  label: 'delete',
  title: 'Delete Table',
  icon: DeleteIcon
}]

const renderToolBar = (type, tools, activeBlocks) => {
  const children = tools.map(tool => {
    const { label, title, icon } = tool
    const { align } = activeBlocks[0]
    let selector = 'li'
    if (align && label === align) {
      selector += '.active'
    }
    const iconVnode = h('i.icon', h(`i.icon-${label}`, {
      style: {
        background: `url(${icon}) no-repeat`,
        'background-size': '100%'
      }
    }, ''))
    return h(selector, {
      dataset: {
        label,
        tooltip: title
      }
    }, iconVnode)
  })
  let selector = `div.ag-tool-${type}.${CLASS_OR_ID['AG_TOOL_BAR']}`

  return h(selector, {
    attrs: {
      contenteditable: false
    }
  }, h('ul', children))
}

export const renderTableTools = (activeBlocks) => {
  return renderToolBar('table', TABLE_TOOLS, activeBlocks)
}
