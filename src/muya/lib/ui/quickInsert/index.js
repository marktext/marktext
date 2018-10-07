import { filter } from 'fuzzaldrin'
import { patch, h } from '../../parser/render/snabbdom'
import { deepCopy } from '../../utils'
import BaseFloat from '../baseFloat'
import { quicInsertList } from './config'
import { EVENT_KEYS } from '../../config'
import './index.css'

class QuickInsert extends BaseFloat {
  constructor (muya) {
    const name = 'ag-quick-insert'
    super(muya, name)
    this.reference = null
    this.scrollElement = null
    this.oldVnode = null
    this._renderObj = null
    this.renderArray = null
    this.activeItem = null
    this.block = null
    this.createScrollElement()
    this.render(quicInsertList)
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
      this.activeEleScrollIntoView()
    }
  }

  createScrollElement () {
    const { container } = this
    const scrollElement = document.createElement('div')
    container.appendChild(scrollElement)
    this.scrollElement = scrollElement
  }

  render (list = this._renderObj, needSet = true) {
    if (needSet) {
      this.renderObj = list
    }

    const { scrollElement, activeItem } = this
    let children = Object.keys(list).filter(key => {
      return list[key].length !== 0
    })
      .map(key => {
        const titleVnode = h('div.title', key.toUpperCase())
        const items = []
        for (const item of list[key]) {
          const { title, subTitle, label, icon } = item
          const iconVnode = h('div.icon-container', h('img', {
            attrs: {
              src: icon.url
            }
          })
            // h('svg', {
            //   attrs: {
            //     viewBox: icon.viewBox,
            //     'aria-hidden': 'true'
            //   },
            //   style: {
            //     fill: color
            //   },
            //   hook: {
            //     prepatch (oldvnode, vnode) {
            //       // cheat snabbdom that the pre block is changed!!!
            //       oldvnode.children = []
            //       oldvnode.elm.innerHTML = ''
            //     }
            //   }
            // }, h('use', {
            //   attrs: {
            //     'xlink:href': icon.url
            //   }
            // }))
          )

          const description = h('div.description', [
            h('div.big-title', title),
            h('div.sub-title', subTitle)
          ])
          const selector = activeItem.label === label ? 'div.item.active' : 'div.item'
          items.push(h(selector, {
            dataset: { label },
            on: {
              click: () => {
                this.selectItem(item)
              }
            }
          }, [iconVnode, description]))
        }

        return h('section', [titleVnode, ...items])
      })

    if (children.length === 0) {
      children = h('div.no-result', 'No result')
    }
    const vnode = h('div', children)

    if (this.oldVnode) {
      patch(this.oldVnode, vnode)
    } else {
      patch(scrollElement, vnode)
    }
    this.oldVnode = vnode
  }

  listen () {
    super.listen()
    const { eventCenter, container } = this.muya
    eventCenter.subscribe('muya-quick-insert', (reference, block, status) => {
      if (status) {
        this.block = block
        this.show(reference)
        this.search(block.text.substring(1)) // remove `@` char
      } else {
        this.hide()
      }
    })

    const handler = event => {
      if (!this.status) return
      switch (event.key) {
        case EVENT_KEYS.ArrowUp:
          this.step('previous')
          break
        case EVENT_KEYS.ArrowDown:
        case EVENT_KEYS.Tab:
          this.step('next')
          break
        case EVENT_KEYS.Enter:
          this.selectItem(this.activeItem)
          break
        default:
          break
      }
    }

    eventCenter.attachDOMEvent(container, 'keydown', handler)
  }

  hide () {
    super.hide()
    this.reference = null
  }

  show (reference) {
    if (this.reference && this.reference.id === reference.id && this.status) return
    this.reference = reference
    super.show(reference)
  }

  search (text) {
    const { contentState } = this.muya
    const canInserFrontMatter = contentState.canInserFrontMatter(this.block)
    const obj = deepCopy(quicInsertList)
    if (!canInserFrontMatter) {
      obj['basic block'].splice(2, 1)
    }
    let result = obj
    if (text !== '') {
      result = {}
      Object.keys(obj).forEach(key => {
        result[key] = filter(obj[key], text, { key: 'title' })
      })
    }

    this.render(result)
  }

  selectItem (item) {
    const { contentState } = this.muya
    this.block.text = ''
    let { key } = this.block
    let offset = 0
    contentState.cursor = {
      start: { key, offset },
      end: { key, offset }
    }
    switch (item.label) {
      case 'paragraph':
        contentState.partialRender()
        break
      default:
        contentState.updateParagraph(item.label, true)
        break
    }
    // delay hide to avoid dispatch enter hander
    setTimeout(this.hide.bind(this))
  }

  step (direction) {
    let index = this.renderArray.findIndex(item => {
      return item.label === this.activeItem.label
    })
    index = direction === 'next' ? index + 1 : index - 1
    if (index < 0 || index >= this.renderArray.length) {
      return
    }
    this.activeItem = this.renderArray[index]
    this.render(undefined, false)
    this.activeEleScrollIntoView()
  }

  getItemElement (item) {
    const { label } = item
    return this.scrollElement.querySelector(`[data-label="${label}"]`)
  }

  activeEleScrollIntoView () {
    const activeEle = this.getItemElement(this.activeItem)
    if (activeEle) {
      activeEle.scrollIntoView({
        behavior: 'auto'
      })
    }
  }
}

export default QuickInsert
