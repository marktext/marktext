import BaseScrollFloat from '../baseScrollFloat'
import Emoji from '../emojis'
import { patch, h } from '../../parser/render/snabbdom'
import './index.css'

class EmojiPicker extends BaseScrollFloat {
  static pluginName = 'emojiPicker'
  constructor (muya) {
    const name = 'ag-emoji-picker'
    super(muya, name)
    this._renderObj = null
    this.renderArray = null
    this.activeItem = null
    this.oldVnode = null
    this.emoji = new Emoji()
    this.listen()
  }

  set renderObj (obj) {
    this._renderObj = obj
    const renderArray = []
    Object.keys(obj).forEach(key => {
      renderArray.push(...obj[key])
    })
    this.renderArray = renderArray
    if (this.renderArray.length > 0) {
      this.activeItem = this.renderArray[0]
      const activeEle = this.getItemElement(this.activeItem)
      this.activeEleScrollIntoView(activeEle)
    }
  }

  listen () {
    super.listen()
    const { eventCenter } = this.muya
    eventCenter.subscribe('muya-emoji-picker', ({ reference, emojiNode }) => {
      if (!emojiNode) return this.hide()
      const text = emojiNode.textContent.trim()
      if (text) {
        const renderObj = this.emoji.search(text)
        this.renderObj = renderObj
        const cb = item => {
          this.muya.contentState.setEmoji(item)
        }
        if (this.renderArray.length) {
          this.show(reference, cb)
          this.render()
        } else {
          this.hide()
        }
      }
    })
  }

  render () {
    const { scrollElement, _renderObj, activeItem, oldVnode } = this
    const children = Object.keys(_renderObj).map(category => {
      const title = h('div.title', category)
      const emojis = _renderObj[category].map(e => {
        const selector = activeItem === e ? 'div.item.active' : 'div.item'
        return h(selector, {
          dataset: { label: e.aliases[0] },
          props: { title: e.description },
          on: {
            click: () => {
              this.selectItem(e)
            }
          }
        }, h('span', e.emoji))
      })

      return h('section', [title, h('div.emoji-wrapper', emojis)])
    })

    const vnode = h('div', children)

    if (oldVnode) {
      patch(oldVnode, vnode)
    } else {
      patch(scrollElement, vnode)
    }
    this.oldVnode = vnode
  }

  getItemElement (item) {
    const label = item.aliases[0]
    return this.floatBox.querySelector(`[data-label="${label}"]`)
  }

  destroy () {
    super.destroy()
    this.emoji.destroy()
  }
}

export default EmojiPicker
