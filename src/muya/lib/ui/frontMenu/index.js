import BaseFloat from '../baseFloat'
import { patch, h } from '../../parser/render/snabbdom'
import { menu, getSubMenu, getLabel } from './config'

import './index.css'

const defaultOptions = {
  placement: 'right',
  modifiers: {
    offset: {
      offset: '20, 5'
    }
  },
  showArrow: false
}

class FrontMenu extends BaseFloat {
  static pluginName = 'frontMenu'
  constructor (muya, options = {}) {
    const name = 'ag-front-menu'
    const opts = Object.assign({}, defaultOptions, options)
    super(muya, name, opts)
    this.oldVnode = null
    this.block = null
    this.options = opts
    const frontMenuContainer = this.frontMenuContainer = document.createElement('div')
    Object.assign(this.container.parentNode.style, {
      overflow: 'visible'
    })
    this.container.appendChild(frontMenuContainer)
    this.listen()
  }

  listen () {
    const { eventCenter } = this.muya
    super.listen()
    eventCenter.subscribe('muya-front-menu', ({ reference, block }) => {
      if (reference) {
        this.block = block
        setTimeout(() => {
          this.show(reference)
          this.render()
        }, 0)
      } else {
        this.hide()
      }
    })
  }

  renderSubMenu (subMenu) {
    const children = subMenu.map(menuItem => {
      const { icon, title, label, shortCut } = menuItem
      const iconWrapperSelector = 'div.icon-wrapper'
      const iconWrapper = h(iconWrapperSelector, h('svg', {
        attrs: {
          'viewBox': icon.viewBox,
          'aria-hidden': 'true'
        }
        }, [h('use', {
          attrs: {
            'xlink:href': `${icon.url}`
          }
        })]
      ))
      const textWrapper = h('span', title)
      const shortCutWrapper = h('div.short-cut', [
        h('span', shortCut)
      ])
      let itemSelector = `li.item.${label}`
      if (label === getLabel(this.block)) {
        itemSelector += `.active`
      }
      return h(itemSelector, {
        on: {
          click: event => {
            this.selectItem(event, { label })
          }
        }
      }, [iconWrapper, textWrapper, shortCutWrapper])
    })
    return h('div.submenu', h('ul', children))
  }

  render () {
    const { oldVnode, frontMenuContainer, block } = this
    const { type, functionType } = block
    const children = menu.map(({ icon, label, text, shortCut }) => {
      const subMenu = getSubMenu(block)
      const iconWrapperSelector = 'div.icon-wrapper'
      const iconWrapper = h(iconWrapperSelector, h('svg', {
        attrs: {
          'viewBox': icon.viewBox,
          'aria-hidden': 'true'
        }
        }, [h('use', {
          attrs: {
            'xlink:href': `${icon.url}`
          }
        })]
      ))
      const textWrapper = h('span', text)
      const shortCutWrapper = h('div.short-cut', [
        h('span', shortCut)
      ])
      let itemSelector = `li.item.${label}`
      const itemChildren = [iconWrapper, textWrapper, shortCutWrapper]
      if (label === 'turnInto' && subMenu.length !== 0) {
        itemChildren.push(this.renderSubMenu(subMenu))
      }
      if (label === 'turnInto' && subMenu.length === 0) {
        itemSelector += `.disabled`
      }
      // front matter can not be duplicated.
      if (label === 'duplicate' && type === 'pre' && functionType === 'frontmatter') {
        itemSelector += `.disabled`
      }
      return h(itemSelector, {
        on: {
          click: event => {
            this.selectItem(event, { label })
          }
        }
      }, itemChildren)
    })

    const vnode = h('ul', children)

    if (oldVnode) {
      patch(oldVnode, vnode)
    } else {
      patch(frontMenuContainer, vnode)
    }
    this.oldVnode = vnode
  }

  selectItem (event, { label }) {
    event.preventDefault()
    event.stopPropagation()
    const { type, functionType } = this.block
    // front matter can not be duplicated.
    if (label === 'duplicate' && type === 'pre' && functionType === 'frontmatter') {
      return
    }
    const { contentState } = this.muya
    contentState.selectedBlock = null
    switch (label) {
      case 'duplicate': {
        contentState.duplicate()
        break
      }
      case 'delete': {
        contentState.deleteParagraph()
        break
      }
      case 'new': {
        contentState.insertParagraph('after', '', true)
        break
      }
      case 'turnInto':
        // do nothing, do not hide float box.
        return
      default:
        contentState.updateParagraph(label)
        break
    }
    // delay hide to avoid dispatch enter hander
    setTimeout(this.hide.bind(this))
  }
}

export default FrontMenu
