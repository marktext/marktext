import BaseFloat from '../baseFloat'
import { patch, h } from '../../parser/render/snabbdom'
import { toolList } from './config'

import './index.css'

const defaultOptions = {
  placement: 'right-start',
  modifiers: {
    offset: {
      offset: '0, 5'
    }
  },
  showArrow: false
}

class TableBarTools extends BaseFloat {
  static pluginName = 'tableBarTools'

  constructor (muya, options = {}) {
    const name = 'ag-table-bar-tools'
    const opts = Object.assign({}, defaultOptions, options)
    super(muya, name, opts)
    this.options = opts
    this.oldVnode = null
    this.tableInfo = null
    this.floatBox.classList.add('ag-table-bar-tools')
    const tableBarContainer = this.tableBarContainer = document.createElement('div')
    this.container.appendChild(tableBarContainer)
    this.listen()
  }

  listen () {
    super.listen()
    const { eventCenter } = this.muya
    eventCenter.subscribe('muya-table-bar', ({ reference, tableInfo }) => {
      if (reference) {
        this.tableInfo = tableInfo
        this.show(reference)
        this.render()
      } else {
        this.hide()
      }
    })
  }

  render () {
    const { tableInfo, oldVnode, tableBarContainer } = this
    const renderArray = toolList[tableInfo.barType]
    const children = renderArray.map((item) => {
      const { label } = item

      const selector = 'li.item'
      return h(selector, {
        dataset: {
          label: item.action
        },
        on: {
          click: event => {
            this.selectItem(event, item)
          }
        }
      }, label)
    })

    const vnode = h('ul', children)

    if (oldVnode) {
      patch(oldVnode, vnode)
    } else {
      patch(tableBarContainer, vnode)
    }
    this.oldVnode = vnode
  }

  selectItem (event, item) {
    event.preventDefault()
    event.stopPropagation()

    const { contentState } = this.muya
    contentState.editTable(item)
    this.hide()
  }
}

export default TableBarTools
