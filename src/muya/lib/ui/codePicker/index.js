import BaseScrollFloat from '../baseScrollFloat'
import { patch, h } from '../../parser/render/snabbdom'
import { search } from '../../codeMirror'
import fileIcons from '../fileIcons'

import './index.css'

class CodePicker extends BaseScrollFloat {
  constructor (muya) {
    const name = 'ag-list-picker'
    super(muya, name)
    this.renderArray = []
    this.oldVnode = null
    this.activeItem = null
    this.listen()
  }

  listen () {
    super.listen()
    const { eventCenter } = this.muya
    eventCenter.subscribe('muya-code-picker', ({ reference, lang, cb }) => {
      const modes = search(lang).map(mode => {
        return Object.assign(mode, { text: mode.name })
      })
      if (modes.length) {
        this.show(reference, cb)
        this.renderArray = modes
        this.activeItem = modes[0]
        this.render()
      } else {
        this.hide()
      }
    })
  }

  render () {
    const { renderArray, oldVnode, scrollElement, activeItem } = this
    let children = renderArray.map(item => {
      let iconClassNames
      if (item.mode.ext && Array.isArray(item.mode.ext)) {
        for (const ext of item.mode.ext) {
          iconClassNames = fileIcons.getClassWithColor(`fackname.${ext}`)
          if (iconClassNames) break
        }
      } else if (item.mode.name) {
        iconClassNames = fileIcons.getClassWithColor(item.mode.name)
      }

      // Because `markdown mode in Codemirror` don't have extensions.
      // if still can not get the className, add a common className 'atom-icon light-cyan'
      if (!iconClassNames) {
        iconClassNames = item.text === 'markdown' ? fileIcons.getClassWithColor('fackname.md') : 'atom-icon light-cyan'
      }
      const iconSelector = 'span' + iconClassNames.split(/\s/).map(s => `.${s}`).join('')
      const icon = h('div.icon-wrapper', h(iconSelector))
      const text = h('div.language', item.name)
      const selector = activeItem === item ? 'li.item.active' : 'li.item'
      return h(selector, {
        dataset: {
          label: item.name
        },
        on: {
          click: () => {
            this.selectItem(item)
          }
        }
      }, [icon, text])
    })

    if (children.length === 0) {
      children = h('div.no-result', 'No result')
    }
    const vnode = h('ul', children)

    if (oldVnode) {
      patch(oldVnode, vnode)
    } else {
      patch(scrollElement, vnode)
    }
    this.oldVnode = vnode
  }

  getItemElement (item) {
    const { name } = item
    return this.floatBox.querySelector(`[data-label="${name}"]`)
  }
}

export default CodePicker
