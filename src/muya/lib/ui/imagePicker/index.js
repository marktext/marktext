import BaseScrollFloat from '../baseScrollFloat'
import { patch, h } from '../../parser/render/snabbdom'
import FolderIcon from '../../assets/icons/folder.svg'
import ImageIcon from '../../assets/icons/image.svg'
import UploadIcon from '../../assets/icons/upload.svg'

import './index.css'

const iconhash = {
  'icon-image': ImageIcon,
  'icon-folder': FolderIcon,
  'icon-upload': UploadIcon
}

class ImagePathPicker extends BaseScrollFloat {
  static pluginName = 'imagePathPicker'

  constructor (muya) {
    const name = 'ag-list-picker'
    super(muya, name)
    this.renderArray = []
    this.oldVnode = null
    this.activeItem = null
    this.floatBox.classList.add('ag-image-picker-wrapper')
    this.listen()
  }

  listen () {
    super.listen()
    const { eventCenter } = this.muya
    eventCenter.subscribe('muya-image-picker', ({ reference, list, cb }) => {
      if (list.length) {
        this.show(reference, cb)
        this.renderArray = list
        this.activeItem = list[0]
        this.render()
      } else {
        this.hide()
      }
    })
  }

  render () {
    const { renderArray, oldVnode, scrollElement, activeItem } = this
    const children = renderArray.map((item) => {
      const { text, iconClass } = item
      const icon = h('div.icon-wrapper', h('svg', {
        attrs: {
          viewBox: iconhash[iconClass].viewBox,
          'aria-hidden': 'true'
        },
        hook: {
          prepatch (oldvnode, vnode) {
            // cheat snabbdom that the pre block is changed!!!
            oldvnode.children = []
            oldvnode.elm.innerHTML = ''
          }
        }
      }, h('use', {
        attrs: {
          'xlink:href': iconhash[iconClass].url
        }
      }))
      )
      const textEle = h('div.language', text)
      const selector = activeItem === item ? 'li.item.active' : 'li.item'
      return h(selector, {
        dataset: {
          label: item.text
        },
        on: {
          click: () => {
            this.selectItem(item)
          }
        }
      }, [icon, textEle])
    })

    const vnode = h('ul', children)

    if (oldVnode) {
      patch(oldVnode, vnode)
    } else {
      patch(scrollElement, vnode)
    }
    this.oldVnode = vnode
  }

  getItemElement (item) {
    const { text } = item
    return this.floatBox.querySelector(`[data-label="${text}"]`)
  }
}

export default ImagePathPicker
