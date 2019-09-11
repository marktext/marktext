import BaseFloat from '../baseFloat'
import { patch, h } from '../../parser/render/snabbdom'
import icons from './config'

import './index.css'

const defaultOptions = {
  placement: 'top',
  modifiers: {
    offset: {
      offset: '0, 10'
    }
  },
  showArrow: false
}

class FormatPicker extends BaseFloat {
  static pluginName = 'imageToolbar'

  constructor (muya, options = {}) {
    const name = 'ag-image-toolbar'
    const opts = Object.assign({}, defaultOptions, options)
    super(muya, name, opts)
    this.oldVnode = null
    this.imageInfo = null
    this.options = opts
    this.icons = icons
    this.reference = null
    const toolbarContainer = this.toolbarContainer = document.createElement('div')
    this.container.appendChild(toolbarContainer)
    this.listen()
  }

  listen () {
    const { eventCenter } = this.muya
    super.listen()
    eventCenter.subscribe('muya-image-toolbar', ({ reference, imageInfo }) => {
      this.reference = reference
      if (reference) {
        this.imageInfo = imageInfo
        setTimeout(() => {
          this.show(reference)
          this.render()
        }, 0)
      } else {
        this.hide()
      }
    })
  }

  render () {
    const { icons, oldVnode, toolbarContainer, imageInfo } = this
    const children = icons.map(i => {
      let icon
      let iconWrapperSelector
      if (i.icon) {
        // SVG icon Asset
        iconWrapperSelector = 'div.icon-wrapper'
        icon = h('i.icon', h('i.icon-inner', {
          style: {
            background: `url(${i.icon}) no-repeat`,
            'background-size': '100%'
          }
        }, ''))
      }
      const iconWrapper = h(iconWrapperSelector, icon)
      let itemSelector = `li.item.${i.type}`
      console.log(imageInfo)
      // if (formats.some(f => f.type === i.type || f.type === 'html_tag' && f.tag === i.type)) {
      //   itemSelector += '.active'
      // }
      return h(itemSelector, {
        on: {
          click: event => {
            this.selectItem(event, i)
          }
        }
      }, iconWrapper)
    })

    const vnode = h('ul', children)

    if (oldVnode) {
      patch(oldVnode, vnode)
    } else {
      patch(toolbarContainer, vnode)
    }
    this.oldVnode = vnode
  }

  selectItem (event, item) {
    event.preventDefault()
    event.stopPropagation()

    const { imageInfo } = this
    switch (item.type) {
      case 'delete':
        this.muya.contentState.deleteImage(imageInfo)
        return this.hide()
      case 'edit': {
        const rect = this.reference.getBoundingClientRect()
        const reference = {
          getBoundingClientRect () {
            rect.height = 0
            return rect
          }
        }
        this.muya.eventCenter.dispatch('muya-image-selector', {
          reference,
          imageInfo,
          cb: () => {}
        })
        return this.hide()
      }
    }
  }
}

export default FormatPicker
