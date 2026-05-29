// used for render table tookbar or others.
import { h } from '../snabbdom'
import { CLASS_OR_ID } from '../../../config'
import TableIcon from '../../../assets/pngicon/table/table@2x.png'
import AlignLeftIcon from '../../../assets/pngicon/algin_left/2.png'
import AlignRightIcon from '../../../assets/pngicon/algin_right/2.png'
import AlignCenterIcon from '../../../assets/pngicon/algin_center/2.png'
import DeleteIcon from '../../../assets/pngicon/table_delete/2.png'

export const getTableTools = (t) => Object.freeze([{
  label: 'table',
  title: t('table.resizeTable'),
  icon: TableIcon
}, {
  label: 'left',
  title: t('table.alignLeft'),
  icon: AlignLeftIcon
}, {
  label: 'center',
  title: t('table.alignCenter'),
  icon: AlignCenterIcon
}, {
  label: 'right',
  title: t('table.alignRight'),
  icon: AlignRightIcon
}, {
  label: 'delete',
  title: t('table.deleteTable'),
  icon: DeleteIcon
}])

const renderToolBar = (type, tools, activeBlocks) => {
  const children = tools.map(tool => {
    const { label, title, icon } = tool
    const { align } = activeBlocks[1] // activeBlocks[0] is span block. cell content.
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
  const selector = `div.ag-tool-${type}.${CLASS_OR_ID.AG_TOOL_BAR}`

  return h(selector, {
    attrs: {
      contenteditable: false
    }
  }, h('ul', children))
}

export const renderTableTools = (activeBlocks, t) => {
  const tableTools = getTableTools(t)
  return renderToolBar('table', tableTools, activeBlocks)
}
